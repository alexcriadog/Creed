/**
 * Agent runner — Groq Llama 3.3 70B (modo cheap por defecto del usuario).
 * Tool use + persistencia en Postgres. OpenAI-compatible API.
 *
 * Cambiar a Sonnet 4.6 cuando el usuario lo pida (model_assignments en panel
 * admin permitiría override por flujo, pero por ahora hardcoded).
 *
 * Tools 5a:
 *  - get_athlete_state: snapshot completo + verdict
 *  - add_agent_note: registra observación en agent_notes
 */
import Groq from 'groq-sdk';
import type { Groq as GroqNS } from 'groq-sdk';
import { computeVerdict, DEFAULT_GOALS } from '../verdict/compute';
import type { VerdictInput } from '../verdict/types';

export type AgentRole = 'nutrition' | 'training' | 'general';
export type AgentName = 'nutritionist' | 'trainer' | 'orchestrator';
export type ConversationMode = 'normal' | 'onboarding' | 'lapse_recovery' | 'weekly_close';

const MODEL = 'llama-3.3-70b-versatile';
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

type ChatMessage = GroqNS.Chat.ChatCompletionMessageParam;
type ToolDef = GroqNS.Chat.ChatCompletionTool;

const TOOLS: ToolDef[] = [
  {
    type: 'function',
    function: {
      name: 'get_athlete_state',
      description:
        'Devuelve el estado actual del atleta: comidas últimos 7 días, peso reciente, recovery medio 14d, sesiones recientes, mood, veredicto compuesto. Llama esto ANTES de aconsejar.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_agent_note',
      description:
        'Registra una observación importante en el dossier del atleta (visible para el otro coach y para el cierre semanal). Usar cuando observes un patrón persistente, no para cada respuesta.',
      parameters: {
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
            description: 'Categoría de la nota.',
          },
          body: {
            type: 'string',
            description: 'Texto de la nota (1-3 frases).',
          },
        },
        required: ['category', 'body'],
      },
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

interface StoredToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface MessageRow {
  turn: number;
  role: 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls: StoredToolCall[] | null;
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

function historyToOpenAI(history: MessageRow[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const m of history) {
    if (m.role === 'user' && m.content) {
      out.push({ role: 'user', content: m.content });
    } else if (m.role === 'assistant') {
      const msg: ChatMessage = {
        role: 'assistant',
        content: m.content ?? '',
      };
      if (m.tool_calls && Array.isArray(m.tool_calls) && m.tool_calls.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (msg as any).tool_calls = m.tool_calls;
      }
      out.push(msg);
    } else if (m.role === 'tool' && m.tool_call_id && m.content !== null) {
      out.push({
        role: 'tool',
        tool_call_id: m.tool_call_id,
        content: m.content,
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
  const groq = new Groq({ apiKey: opts.apiKey });
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

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...historyToOpenAI(history),
    { role: 'user', content: opts.userMessage },
  ];

  const toolCallsExecuted: RunAgentResult['toolCalls'] = [];
  let totalIn = 0;
  let totalOut = 0;
  let assistantText = '';

  for (let iter = 0; iter < 4; iter++) {
    const response = await groq.chat.completions.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages,
      tools: TOOLS,
      tool_choice: 'auto',
    });
    if (response.usage) {
      totalIn += response.usage.prompt_tokens ?? 0;
      totalOut += response.usage.completion_tokens ?? 0;
    }

    const choice = response.choices[0];
    if (!choice) break;
    const aMsg = choice.message;
    const text = aMsg.content ?? '';
    const toolCalls = (aMsg.tool_calls ?? []) as StoredToolCall[];

    nextTurn++;
    const { data: assistantMsg, error: aErr } = await opts.supabase
      .from('messages')
      .insert({
        conversation_id: opts.conversationId,
        user_id: opts.userId,
        turn: nextTurn,
        role: 'assistant',
        agent: agentName,
        content: text || null,
        tool_calls: toolCalls.length > 0 ? toolCalls : null,
        model: MODEL,
        input_tokens: response.usage?.prompt_tokens ?? null,
        output_tokens: response.usage?.completion_tokens ?? null,
      })
      .select('id')
      .single();
    if (aErr) throw new Error(`save_assistant_msg: ${aErr.message}`);

    assistantText = text;

    if (toolCalls.length === 0 || choice.finish_reason !== 'tool_calls') {
      break;
    }

    messages.push({
      role: 'assistant',
      content: text,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tool_calls: toolCalls as any,
    });

    for (const tc of toolCalls) {
      let parsedArgs: Record<string, unknown> = {};
      try {
        parsedArgs = JSON.parse(tc.function.arguments) as Record<string, unknown>;
      } catch {
        // ignore — pass empty
      }

      const exec = await executeTool(
        opts.supabase,
        opts.userId,
        opts.conversationId,
        agentName,
        tc.function.name,
        parsedArgs,
      );

      toolCallsExecuted.push({
        name: tc.function.name,
        arguments: parsedArgs,
        result: exec.result,
        ...(exec.error ? { error: exec.error } : {}),
        duration_ms: exec.duration_ms,
      });

      await opts.supabase.from('tool_calls').insert({
        user_id: opts.userId,
        conversation_id: opts.conversationId,
        message_id: assistantMsg.id,
        tool_name: tc.function.name,
        arguments: parsedArgs,
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
        tool_call_id: tc.id,
      });

      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: resultText,
      });
    }
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
