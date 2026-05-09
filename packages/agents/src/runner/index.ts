/**
 * Agent runner — Sonnet 4.6 con tool use + persistencia en Postgres.
 *
 * No streaming en esta versión (fase 5a). El streaming SSE llega en 5b.
 * Tools 5a (lectura + nota):
 *  - get_athlete_state: snapshot completo
 *  - add_agent_note: registra observación
 */
import Anthropic from '@anthropic-ai/sdk';
import type { Anthropic as AnthropicNS } from '@anthropic-ai/sdk';
import { computeVerdict, DEFAULT_GOALS } from '../verdict/compute';
import type { VerdictInput } from '../verdict/types';

export type AgentRole = 'nutrition' | 'training' | 'general';
export type AgentName = 'nutritionist' | 'trainer' | 'orchestrator';
export type ConversationMode = 'normal' | 'onboarding' | 'lapse_recovery' | 'weekly_close';

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 1024;

const AGENT_NAME: Record<AgentRole, AgentName> = {
  nutrition: 'nutritionist',
  training: 'trainer',
  general: 'orchestrator',
};

const SYSTEM_PROMPTS: Record<AgentName, string> = {
  nutritionist: `Eres el coach nutricional de un atleta de fuerza. Hablas español de España, tono cercano, breve, directo. Sin emojis salvo el atleta los use.

Tu función:
- Conocer el estado actual del atleta usando la tool get_athlete_state ANTES de aconsejar.
- Sugerir cambios pequeños y concretos basados en sus datos reales.
- Cuando observes un patrón importante, registra una nota con add_agent_note.
- No inventes macros: si las necesitas, pídelas o léelas con get_athlete_state.

Reglas:
- Brevedad. Una respuesta nunca más de 3 párrafos cortos.
- Si propones cambio, sé específico: "añade X g de proteína al desayuno", no "come más proteína".
- Reconoce lo que está bien antes de sugerir mejoras.`,

  trainer: `Eres el preparador físico de un atleta de fuerza. Hablas español de España, tono directo, técnico pero accesible. Sin emojis salvo el atleta los use.

Tu función:
- Conocer su estado (recovery, sesiones recientes, RPE) con get_athlete_state ANTES de aconsejar.
- Programar sesiones realistas según recovery y adherencia.
- Cuando notes un patrón (lapso, sobreentreno, progresión estancada), registra con add_agent_note.

Reglas:
- Si recovery <50, propón sesión de descarga o descanso.
- Si recovery >70 dos días seguidos, propón intensidad alta.
- Sé específico con sets/reps/RPE cuando propongas.`,

  orchestrator: `Eres el orquestador. Decides si una pregunta del atleta va al nutricionista, al preparador, o si la respondes tú directamente. Hablas español de España, breve.`,
};

const TOOLS: AnthropicNS.Messages.Tool[] = [
  {
    name: 'get_athlete_state',
    description:
      'Devuelve el estado actual del atleta: comidas últimos 7 días, peso reciente, recovery medio 14d, sesiones recientes, mood, veredicto compuesto. Llama esto ANTES de aconsejar.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'add_agent_note',
    description:
      'Registra una observación importante en el dossier del atleta (visible para el otro coach y para el cierre semanal). Usar cuando observes un patrón persistente, no para cada respuesta.',
    input_schema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: [
            'plan_change',
            'observation',
            'red_flag',
            'recovery_low',
            'lapse_summary',
            'adherence_drop',
          ],
        },
        body: { type: 'string', description: 'Texto de la nota (1-3 frases).' },
      },
      required: ['category', 'body'],
    },
  },
];

export interface RunAgentOptions {
  apiKey: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  userId: string;
  conversationId: string;
  agentRole: AgentRole;
  userMessage: string;
}

export interface RunAgentResult {
  assistantText: string;
  turn: number;
  inputTokens: number;
  outputTokens: number;
  toolCalls: Array<{
    name: string;
    arguments: Record<string, unknown>;
    result?: unknown;
    error?: string;
    duration_ms: number;
  }>;
}

interface MessageRow {
  turn: number;
  role: 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls: AnthropicNS.Messages.ToolUseBlock[] | null;
  tool_call_id: string | null;
}

async function loadHistory(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  conversationId: string,
): Promise<MessageRow[]> {
  const { data } = await supabase
    .from('messages')
    .select('turn, role, content, tool_calls, tool_call_id')
    .eq('conversation_id', conversationId)
    .order('turn', { ascending: true });
  return (data ?? []) as MessageRow[];
}

function historyToAnthropic(
  history: MessageRow[],
): AnthropicNS.Messages.MessageParam[] {
  const out: AnthropicNS.Messages.MessageParam[] = [];
  for (const m of history) {
    if (m.role === 'user' && m.content) {
      out.push({ role: 'user', content: m.content });
    } else if (m.role === 'assistant') {
      const blocks: AnthropicNS.Messages.ContentBlockParam[] = [];
      if (m.content) blocks.push({ type: 'text', text: m.content });
      if (m.tool_calls && Array.isArray(m.tool_calls)) {
        for (const tc of m.tool_calls) {
          blocks.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.name,
            input: tc.input,
          });
        }
      }
      if (blocks.length > 0) {
        out.push({ role: 'assistant', content: blocks });
      }
    } else if (m.role === 'tool' && m.tool_call_id && m.content) {
      out.push({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: m.tool_call_id,
            content: m.content,
          },
        ],
      });
    }
  }
  return out;
}

async function executeTool(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  conversationId: string,
  agentName: AgentName,
  name: string,
  args: Record<string, unknown>,
): Promise<{ result: unknown; error?: string; duration_ms: number }> {
  const start = Date.now();
  try {
    if (name === 'get_athlete_state') {
      const result = await getAthleteState(supabase, userId);
      return { result, duration_ms: Date.now() - start };
    }
    if (name === 'add_agent_note') {
      const category = String(args.category ?? '');
      const body = String(args.body ?? '');
      if (!category || !body) {
        return {
          result: null,
          error: 'category y body son requeridos',
          duration_ms: Date.now() - start,
        };
      }
      const { data, error } = await supabase
        .from('agent_notes')
        .insert({
          user_id: userId,
          agent: agentName,
          category,
          body,
          conversation_id: conversationId,
        })
        .select('id')
        .single();
      if (error) {
        return {
          result: null,
          error: error.message,
          duration_ms: Date.now() - start,
        };
      }
      return {
        result: { id: data.id, ok: true },
        duration_ms: Date.now() - start,
      };
    }
    return {
      result: null,
      error: `unknown_tool: ${name}`,
      duration_ms: Date.now() - start,
    };
  } catch (err) {
    return {
      result: null,
      error: err instanceof Error ? err.message : 'unknown',
      duration_ms: Date.now() - start,
    };
  }
}

async function getAthleteState(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
): Promise<unknown> {
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const since14dDate = new Date(today.getTime() - 14 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const since14dIso = new Date(today.getTime() - 14 * 86_400_000).toISOString();
  const since7dDate = new Date(today.getTime() - 7 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const [recoveries, weights, meals, trainings, moods, notes] = await Promise.all([
    supabase
      .from('whoop_recovery')
      .select('date, score')
      .eq('user_id', userId)
      .gte('date', since14dDate),
    supabase
      .from('body_measurements')
      .select('measured_at, weight_kg, body_fat_pct')
      .eq('user_id', userId)
      .gte('measured_at', since14dIso)
      .order('measured_at', { ascending: true }),
    supabase
      .from('meals')
      .select('consumed_at, meal_type, raw_text, total_calories, total_protein_g')
      .eq('user_id', userId)
      .gte('consumed_at', since14dIso)
      .order('consumed_at', { ascending: false })
      .limit(20),
    supabase
      .from('training_sessions')
      .select('scheduled_for, type, status, rpe, notes')
      .eq('user_id', userId)
      .gte('scheduled_for', since7dDate)
      .order('scheduled_for', { ascending: false }),
    supabase
      .from('mood_energy_log')
      .select('logged_at, mood, energy')
      .eq('user_id', userId)
      .gte('logged_at', since14dIso)
      .order('logged_at', { ascending: false })
      .limit(7),
    supabase
      .from('agent_notes')
      .select('agent, category, body, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const verdictInput: VerdictInput = {
    today: todayIso,
    recoveries: (recoveries.data ?? []).map(
      (r: { date: string; score: number | null }) => ({
        date: r.date,
        score: r.score,
      }),
    ),
    weights: (weights.data ?? [])
      .filter((w: { weight_kg: number | null }) => w.weight_kg !== null)
      .map((w: { measured_at: string; weight_kg: number }) => ({
        date: w.measured_at.slice(0, 10),
        weight_kg: Number(w.weight_kg),
      })),
    meals: (meals.data ?? []).map((m: { consumed_at: string }) => ({
      date: m.consumed_at.slice(0, 10),
    })),
    trainings: (trainings.data ?? []).map(
      (t: { scheduled_for: string; status: string }) => ({
        date: t.scheduled_for,
        status: t.status,
      }),
    ),
    moods: (moods.data ?? []).map(
      (m: { mood: number | null; energy: number | null }) => ({
        mood: m.mood,
        energy: m.energy,
      }),
    ),
    goals: DEFAULT_GOALS,
  };

  const verdict = computeVerdict(verdictInput);

  return {
    today: todayIso,
    verdict: {
      status: verdict.status,
      text: verdict.text,
      components: verdict.components,
    },
    recent_meals: (meals.data ?? []).slice(0, 10),
    recent_trainings: trainings.data ?? [],
    recent_recoveries: (recoveries.data ?? []).slice(-7),
    recent_moods: moods.data ?? [],
    weights: weights.data ?? [],
    recent_agent_notes: notes.data ?? [],
  };
}

export async function runAgent(opts: RunAgentOptions): Promise<RunAgentResult> {
  const anthropic = new Anthropic({ apiKey: opts.apiKey });
  const agentName = AGENT_NAME[opts.agentRole];
  const systemPrompt = SYSTEM_PROMPTS[agentName];

  const history = await loadHistory(opts.supabase, opts.conversationId);
  const lastTurn =
    history.length > 0 ? Math.max(...history.map((m) => m.turn)) : 0;

  let nextTurn = lastTurn + 1;
  const { error: userErr } = await opts.supabase
    .from('messages')
    .insert({
      conversation_id: opts.conversationId,
      user_id: opts.userId,
      turn: nextTurn,
      role: 'user',
      content: opts.userMessage,
    })
    .select('id')
    .single();
  if (userErr) throw new Error(`save_user_msg: ${userErr.message}`);

  const messages: AnthropicNS.Messages.MessageParam[] = [
    ...historyToAnthropic(history),
    { role: 'user', content: opts.userMessage },
  ];

  const toolCallsExecuted: RunAgentResult['toolCalls'] = [];
  let totalIn = 0;
  let totalOut = 0;
  let assistantText = '';

  for (let iter = 0; iter < 4; iter++) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      tools: TOOLS,
      messages,
    });
    totalIn += response.usage.input_tokens;
    totalOut += response.usage.output_tokens;

    const textBlocks = response.content
      .filter((b): b is AnthropicNS.Messages.TextBlock => b.type === 'text')
      .map((b) => b.text);
    const toolUses = response.content.filter(
      (b): b is AnthropicNS.Messages.ToolUseBlock => b.type === 'tool_use',
    );

    nextTurn++;
    const { data: assistantMsg, error: aErr } = await opts.supabase
      .from('messages')
      .insert({
        conversation_id: opts.conversationId,
        user_id: opts.userId,
        turn: nextTurn,
        role: 'assistant',
        agent: agentName,
        content: textBlocks.join('\n\n') || null,
        tool_calls: toolUses.length > 0 ? toolUses : null,
        model: MODEL,
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      })
      .select('id')
      .single();
    if (aErr) throw new Error(`save_assistant_msg: ${aErr.message}`);

    assistantText = textBlocks.join('\n\n');

    if (response.stop_reason !== 'tool_use' || toolUses.length === 0) {
      break;
    }

    messages.push({ role: 'assistant', content: response.content });
    const toolResults: AnthropicNS.Messages.ToolResultBlockParam[] = [];

    for (const tu of toolUses) {
      const exec = await executeTool(
        opts.supabase,
        opts.userId,
        opts.conversationId,
        agentName,
        tu.name,
        tu.input as Record<string, unknown>,
      );

      toolCallsExecuted.push({
        name: tu.name,
        arguments: tu.input as Record<string, unknown>,
        result: exec.result,
        ...(exec.error ? { error: exec.error } : {}),
        duration_ms: exec.duration_ms,
      });

      await opts.supabase.from('tool_calls').insert({
        user_id: opts.userId,
        conversation_id: opts.conversationId,
        message_id: assistantMsg.id,
        tool_name: tu.name,
        arguments: tu.input,
        result: exec.error ? null : exec.result,
        error: exec.error ?? null,
        duration_ms: exec.duration_ms,
      });

      const resultText = exec.error
        ? `Error: ${exec.error}`
        : JSON.stringify(exec.result);

      nextTurn++;
      await opts.supabase.from('messages').insert({
        conversation_id: opts.conversationId,
        user_id: opts.userId,
        turn: nextTurn,
        role: 'tool',
        agent: agentName,
        content: resultText,
        tool_call_id: tu.id,
      });

      toolResults.push({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: resultText,
        ...(exec.error ? { is_error: true } : {}),
      });
    }
    messages.push({ role: 'user', content: toolResults });
  }

  await opts.supabase
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', opts.conversationId);

  return {
    assistantText,
    turn: nextTurn,
    inputTokens: totalIn,
    outputTokens: totalOut,
    toolCalls: toolCallsExecuted,
  };
}
