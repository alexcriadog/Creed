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
  nutritionist: `Eres el coach nutricional de un atleta.

IDIOMA DE RESPUESTA: lee profile.locale del payload de get_athlete_state y responde EN ESE IDIOMA. Si profile.locale es 'es' responde en español de España. Si es 'en' responde en English. Default español.

Tono cercano, breve, directo. Sin emojis salvo el atleta los use.

ANTES de cualquier consejo, llama a la tool get_athlete_state. El payload incluye:
- profile: nombre, sexo, altura, idioma.
- folder.primary_objective y target_weight_kg/target_date (objetivo del atleta).
- folder.nutrition: respuestas del cuestionario nutricional (goal, meals_per_day, cooking_style, hydration_l, alcohol, restrictions, supplements, target_weight_kg, target_weeks, free_notes).
- recent_meals: comidas registradas con macros parseadas.
- verdict: veredicto compuesto de la semana (status + componentes).

Cómo trabajar:
- Personaliza siempre con su nombre y sus restricciones (folder.nutrition.restrictions). Si dice 'vegetarian' no propongas pollo.
- Sugiere cambios pequeños, específicos y accionables: "añade 30g de avena al desayuno (+150 kcal, +5g prot)", no "come más calorías".
- Reconoce primero lo que está bien antes de sugerir cambios.
- Si folder.nutrition_onboarding_completed_at es null, pídeselo amablemente — sin esos datos no puedes personalizar.
- Si observas un patrón persistente (adherencia baja, peso opuesto al objetivo, suplementación errónea), guárdalo con add_agent_note.

Cuando tengas una propuesta CONCRETA (no especulativa), usa las tools propose_*:
- propose_meal_target: cuando recomiendes targets diarios (kcal, proteína, carbs, grasa, agua). Solo cuando tengas datos suficientes para proponer números realistas.
- propose_weight_target: cuando vayas a fijar un peso objetivo y plazo realista basado en su goal y progreso actual.
NO uses propose_training_session — eso es del preparador.
Las propuestas aparecen como tarjetas inline con Aceptar/Rechazar. Si el atleta acepta, los targets se guardan automáticamente. NO repitas la propuesta en texto — el sistema renderiza la tarjeta. En el texto solo añade contexto extra ("voy a sugerir esto basándome en…") y deja que la tarjeta hable.

Brevedad: máximo 3 párrafos cortos por respuesta.`,

  trainer: `Eres el preparador físico de un atleta.

IDIOMA DE RESPUESTA: lee profile.locale del payload de get_athlete_state y responde EN ESE IDIOMA. Si profile.locale es 'es' responde en español de España. Si es 'en' responde en English. Default español.

Tono directo y técnico pero accesible. Sin emojis salvo el atleta los use.

ANTES de cualquier consejo, llama a la tool get_athlete_state. El payload incluye:
- profile y folder.primary_objective.
- folder.training: cuestionario de entrenamiento (years_training, days_per_week, location, equipment, primary_goal, injuries, blocked_movements, cardio_minutes_week, self_level, free_notes).
- recent_trainings: sesiones de la semana (incluye whoop_workout_id si vienen de Whoop). Las que tienen 'notes' es lo que el atleta hizo realmente.
- recent_recoveries: recovery diario de Whoop.
- verdict: veredicto compuesto.

Cómo trabajar:
- Respeta SIEMPRE folder.training.injuries y blocked_movements. Si tiene "lower_back" no propongas peso muerto pesado.
- Adáptate al equipamiento real (folder.training.equipment) y los días disponibles (days_per_week).
- Lee 'notes' de cada training_session: si dice "solo tren inferior" o "cumplí lo prescrito", ajusta la próxima en consecuencia.
- Si recovery <50 dos días seguidos: descarga o descanso.
- Si recovery >70 sostenido y adherencia alta: sube intensidad o volumen progresivo.
- Sé específico con sets/reps/RPE/descansos.
- Si folder.training_onboarding_completed_at es null, pídeselo — necesitas saber lesiones y equipamiento.
- Patrones (lapso, sobreentreno, progresión estancada) → add_agent_note.

Cuando tengas una sesión CONCRETA que proponer:
- Usa propose_training_session con scheduled_for (YYYY-MM-DD), type (push/pull/legs/full/cardio/rest), prescribed completo (blocks con exercises sets/reps/rpe/rest_s) y rationale.
- La propuesta aparece como tarjeta inline. Si el atleta acepta, se crea la sesión en su calendario. NO repitas la sesión en texto — la tarjeta lo muestra.
- Solo propón sesiones específicas para los próximos 1-3 días, no semanas enteras.

Brevedad: máximo 3 párrafos cortos.`,

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
  {
    type: 'function',
    function: {
      name: 'propose_training_session',
      description:
        'Propone una sesión de entreno concreta. El atleta verá una tarjeta inline con Aceptar/Rechazar. Si acepta, se crea la sesión en su calendario. Usar SOLO cuando tengas una propuesta concreta y específica con sets/reps/RPE — no para sugerencias vagas.',
      parameters: {
        type: 'object',
        properties: {
          scheduled_for: {
            type: 'string',
            description: 'Fecha YYYY-MM-DD.',
          },
          type: {
            type: 'string',
            description:
              "Tipo de sesión: push, pull, legs, full, cardio, rest, etc.",
          },
          prescribed: {
            type: 'object',
            description:
              'Plan: {blocks:[{name,exercises:[{name,sets,reps,rpe,rest_s,notes}]}]}',
          },
          rationale: {
            type: 'string',
            description: 'Motivo breve (1-2 frases) basado en su recovery/notas/adherencia.',
          },
        },
        required: ['scheduled_for', 'type', 'prescribed', 'rationale'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_meal_target',
      description:
        'Propone targets diarios de macros e hidratación. Si el atleta acepta, se guardan en folder.nutrition.targets y los usaremos para evaluar adherencia. Usar tras revisar su comidas y peso recientes.',
      parameters: {
        type: 'object',
        properties: {
          daily_calories: { type: 'number' },
          daily_protein_g: { type: 'number' },
          daily_carbs_g: { type: 'number' },
          daily_fat_g: { type: 'number' },
          hydration_l: { type: 'number' },
          rationale: {
            type: 'string',
            description: 'Por qué estos números (1-2 frases).',
          },
        },
        required: ['daily_calories', 'daily_protein_g', 'rationale'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_weight_target',
      description:
        'Propone un peso objetivo y plazo. Si el atleta acepta, se guarda en folder.target_weight_kg y target_date.',
      parameters: {
        type: 'object',
        properties: {
          target_weight_kg: { type: 'number' },
          target_date: {
            type: 'string',
            description: 'YYYY-MM-DD (opcional).',
          },
          rationale: {
            type: 'string',
            description: 'Por qué este peso/plazo es realista.',
          },
        },
        required: ['target_weight_kg', 'rationale'],
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

interface ConversationSummary {
  summary: string;
  last_compacted_turn: number;
}

async function loadHistoryWithSummary(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  conversationId: string,
): Promise<{ summary: ConversationSummary | null; messages: MessageRow[] }> {
  const [summaryResp, messagesResp] = await Promise.all([
    supabase
      .from('conversation_summaries')
      .select('summary, last_compacted_turn')
      .eq('conversation_id', conversationId)
      .maybeSingle(),
    supabase
      .from('messages')
      .select('turn, role, content, tool_calls, tool_call_id')
      .eq('conversation_id', conversationId)
      .order('turn', { ascending: true }),
  ]);

  const summary = summaryResp.data as ConversationSummary | null;
  const allMessages = (messagesResp.data ?? []) as MessageRow[];
  const messages = summary
    ? allMessages.filter((m) => m.turn > summary.last_compacted_turn)
    : allMessages;
  return { summary, messages };
}

const COMPACT_THRESHOLD_TURNS = 30;
const COMPACT_KEEP_RECENT = 10;

async function compactConversation(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  apiKey: string,
  userId: string,
  conversationId: string,
  agentName: AgentName,
): Promise<void> {
  const { data: msgs } = await supabase
    .from('messages')
    .select('turn, role, content')
    .eq('conversation_id', conversationId)
    .in('role', ['user', 'assistant'])
    .order('turn', { ascending: true });

  const messages = (msgs ?? []) as Array<{
    turn: number;
    role: string;
    content: string | null;
  }>;
  if (messages.length < COMPACT_THRESHOLD_TURNS) return;

  const cutoff = messages[messages.length - COMPACT_KEEP_RECENT];
  if (!cutoff) return;
  const lastCompactedTurn = cutoff.turn - 1;
  const toSummarize = messages.filter((m) => m.turn <= lastCompactedTurn);
  if (toSummarize.length === 0) return;

  const transcript = toSummarize
    .map((m) => `[turn ${m.turn} · ${m.role}] ${m.content ?? ''}`)
    .join('\n');

  const groq = new Groq({ apiKey });
  const response = await groq.chat.completions.create({
    model: MODEL,
    max_tokens: 600,
    messages: [
      {
        role: 'system',
        content: `Eres un compactador de conversaciones de coaching ${agentName === 'nutritionist' ? 'nutricional' : agentName === 'trainer' ? 'físico' : ''}. Resume la conversación a continuación en 200-400 palabras, manteniendo:
- Objetivos del atleta acordados
- Decisiones tomadas (targets, sesiones aceptadas)
- Patrones observados (adherencia, lesiones, restricciones)
- Cualquier dato concreto que el coach necesite recordar (peso target, alergias, equipamiento)
Omite saludos, fluff y mensajes redundantes. Devuelve solo el resumen, sin preámbulo.`,
      },
      { role: 'user', content: transcript },
    ],
  });

  const summary = response.choices[0]?.message?.content?.trim();
  if (!summary) return;

  await supabase.from('conversation_summaries').upsert(
    {
      conversation_id: conversationId,
      user_id: userId,
      summary,
      last_compacted_turn: lastCompactedTurn,
      model: MODEL,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'conversation_id' },
  );
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
  messageId: string | null,
  name: string,
  args: Record<string, unknown>,
): Promise<{ result: unknown; error?: string; duration_ms: number }> {
  const start = Date.now();
  try {
    if (name === 'get_athlete_state') {
      const result = await getAthleteState(supabase, userId);
      return { result, duration_ms: Date.now() - start };
    }
    if (
      name === 'propose_training_session' ||
      name === 'propose_meal_target' ||
      name === 'propose_weight_target'
    ) {
      const proposal_type = (
        {
          propose_training_session: 'training_session',
          propose_meal_target: 'meal_target',
          propose_weight_target: 'weight_target',
        } as const
      )[name];
      const rationale = String(args.rationale ?? '');
      const payload: Record<string, unknown> = { ...args };
      delete payload.rationale;
      const { data, error } = await supabase
        .from('agent_proposals')
        .insert({
          user_id: userId,
          conversation_id: conversationId,
          message_id: messageId,
          agent: agentName,
          proposal_type,
          payload,
          rationale: rationale || null,
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
        result: { proposal_id: data.id, type: proposal_type, status: 'pending' },
        duration_ms: Date.now() - start,
      };
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

  const [
    profileResp,
    folderResp,
    recoveries,
    weights,
    meals,
    trainings,
    moods,
    notes,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('display_name, sex, date_of_birth, height_cm, locale, timezone')
      .eq('id', userId)
      .single(),
    supabase
      .from('athlete_folder')
      .select(
        'primary_objective, baseline_weight_kg, target_weight_kg, target_date, restrictions, equipment, schedule, nutrition, training, notes_summary, nutrition_onboarding_completed_at, training_onboarding_completed_at',
      )
      .eq('user_id', userId)
      .single(),
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
      .select('scheduled_for, type, status, rpe, notes, whoop_workout_id')
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
    profile: profileResp.data ?? null,
    folder: folderResp.data ?? null,
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

  const { summary, messages: history } = await loadHistoryWithSummary(
    opts.supabase,
    opts.conversationId,
  );
  const lastTurn =
    history.length > 0
      ? Math.max(...history.map((m) => m.turn))
      : (summary?.last_compacted_turn ?? 0);

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

  const fullSystem = summary
    ? `${systemPrompt}\n\nRESUMEN DE LA CONVERSACIÓN PREVIA (compactado, turns 1..${summary.last_compacted_turn}):\n${summary.summary}`
    : systemPrompt;

  const messages: ChatMessage[] = [
    { role: 'system', content: fullSystem },
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
        assistantMsg.id,
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

  // Background compactación si la conversación pasa el umbral.
  if (nextTurn >= COMPACT_THRESHOLD_TURNS) {
    void compactConversation(
      opts.supabase,
      opts.apiKey,
      opts.userId,
      opts.conversationId,
      agentName,
    ).catch((e) => {
      console.error(
        '[runner] compactConversation failed',
        e instanceof Error ? e.message : e,
      );
    });
  }

  return {
    assistantText,
    turn: nextTurn,
    inputTokens: totalIn,
    outputTokens: totalOut,
    toolCalls: toolCallsExecuted,
  };
}
