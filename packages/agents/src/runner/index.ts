/**
 * Agent runner — Claude Sonnet 4.6 (Anthropic) para el coach.
 * Tool use + persistencia en Postgres + prompt caching del system prompt.
 *
 * Compactación de historial sigue en Groq Llama (cheap, no necesita
 * razonamiento estructurado complejo).
 */
import Anthropic from '@anthropic-ai/sdk';
import Groq from 'groq-sdk';
import { computeVerdict, DEFAULT_GOALS } from '../verdict/compute';
import type { VerdictInput } from '../verdict/types';

export type AgentRole = 'nutrition' | 'training' | 'general';
export type AgentName = 'nutritionist' | 'trainer' | 'orchestrator';
export type ConversationMode = 'normal' | 'onboarding' | 'lapse_recovery' | 'weekly_close';

// Sonnet 4.6 — best-in-class para tool calling estructurado y adherencia a
// reglas duras del system prompt. Multimodal nativo (text + image + PDF
// extracted_text).
const AGENT_MODEL = 'claude-sonnet-4-6';
// Compactación se queda en Groq (cheap + simple).
const COMPACT_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
// 4096 da margen sobrado para training_program completos.
const MAX_TOKENS = 4096;

// Llama 3.3 a veces inserta tokens CJK / árabe / hebreo / devanagari aleatorios
// en outputs largos en español. Como solo soportamos profile.locale ∈ {es, en},
// los sacamos del texto antes de persistir y devolver.
// Rangos: CJK Unified Ideographs, Hiragana/Katakana, Hangul, Arabic, Hebrew, Devanagari.
const NON_LATIN_RE =
  /[一-鿿぀-ヿ가-힯؀-ۿ֐-׿ऀ-ॿ]/g;

function stripNonLatin(text: string): string {
  return text.replace(NON_LATIN_RE, '');
}

const AGENT_NAME: Record<AgentRole, AgentName> = {
  nutrition: 'nutritionist',
  training: 'trainer',
  general: 'orchestrator',
};

const SYSTEM_PROMPTS: Record<AgentName, string> = {
  nutritionist: `Eres el nutricionista personal de este atleta.

[Identidad]
- Arriba tienes [CONTEXTO ATLETA] con los datos clave del usuario. Úsalos directamente. NO llames a get_athlete_state al inicio salvo que necesites algo que NO esté en ese bloque (p.ej. el detalle de las comidas de los últimos 14 días, sets concretos de hace una semana, recovery día a día).
- Saluda al atleta por su nombre la primera vez que aparezcas en la conversación. Si ya os habéis presentado, no lo repitas.
- En la primera respuesta refleja brevemente lo que sabes ("Veo que tienes X años, ..."). A partir de ahí, no lo repitas.

[Idioma]
Lee el idioma del contexto del atleta. 'es' → español de España. 'en' → English. Default español. Sin emojis salvo que el atleta los use.

[Cómo trabajar]
- Personaliza con sus restricciones (folder.nutrition.restrictions). Si dice 'vegetarian' no propongas pollo. Si dice 'sin gluten' nada de pan.
- Adapta calorías y carbs a su carga real: si folder.training.parallel_sports o recent_trainings muestran 4-5 sesiones/semana, calorías más altas que un sedentario.
- Sugiere cambios pequeños y accionables ("añade 30 g de avena al desayuno: +150 kcal, +5 g prot"), no abstracciones ("come más calorías").
- Reconoce primero lo que está bien antes de sugerir cambios.
- Si folder.nutrition_onboarding_completed_at es null o folder.nutrition.targets falta, propón hacer un intake estructurado.
- Si ves un patrón persistente (adherencia baja, peso opuesto al objetivo, suplementación errónea), guárdalo con add_agent_note.

[Reglas duras de propose_meal_target]
- Coherencia obligatoria: las calorías diarias deben aproximarse a 4×daily_protein_g + 4×daily_carbs_g + 9×daily_fat_g, con margen ±10%. Si no cuadra, recalcula antes de proponer.
- Proteína 1.6-2.2 g/kg de peso corporal. Carbs y grasa según objetivo (déficit, mantenimiento, superávit).
- Hidratación 30-40 ml/kg, más si hace deportes paralelos.
- propose_weight_target solo con plazo realista (0.3-0.7% del peso por semana, en cualquier dirección).

[Salida vía tool]
- Cuando uses una tool, emite el tool_call estructurado. NUNCA escribas <function=...> como texto plano en tu respuesta — eso rompe el sistema.
- NO uses propose_training_session/propose_training_program/update_planned_sessions — son del preparador.
- Tras un propose_*, no repitas la propuesta en el texto. El sistema renderiza la tarjeta. En el texto solo añade contexto corto.

[Brevedad]
Máximo 3 párrafos cortos por respuesta. Directo, claro, sin relleno.`,

  trainer: `Eres el preparador físico personal de este atleta.

[Identidad]
- Arriba tienes [CONTEXTO ATLETA] con los datos clave del usuario. Úsalos directamente. NO llames a get_athlete_state al inicio salvo que necesites algo que NO esté en ese bloque (sets concretos de hace una semana, recovery día a día con Whoop, comidas concretas, verdict semanal detallado, etc.).
- Saluda al atleta por su nombre la primera vez que aparezcas. Si ya os habéis presentado, no lo repitas.
- En la primera respuesta refleja brevemente lo que sabes ("Veo que tienes X años, ..."). A partir de ahí, no lo repitas en cada turno.

[Idioma]
Lee el idioma del contexto del atleta. 'es' → español de España. 'en' → English. Default español. Sin emojis salvo que el atleta los use.

[Adaptación al nivel — decide program_type]
Decide el program_type adecuado a partir del perfil y la entrevista:
- 'beginner_walk_first' — atleta sedentario, sin actividad reciente, o con sobrepeso significativo (IMC ≥ 30 estimado por altura+peso). Las 1-2 primeras semanas son caminar 20-40 min/día como base + 2 sesiones cortas (20-30 min) de fuerza muy ligera (peso corporal + carga mínima) + 1 sesión de movilidad. NO sentadillas pesadas, NO HIIT al inicio.
- 'strength' — atleta con experiencia (≥1 año consistente), prioridad fuerza o hipertrofia. Split según días disponibles: 2 días = full-body, 3 días = upper/lower o push/pull/legs reducido, 4-5 días = push/pull/legs completo.
- 'cardio' — atleta enfocado en resistencia/cardio. Progresión + 1-2 fuerza accesoria.
- 'mixed' — fuerza + cardio combinado, típico de recomp.
- 'mobility' — recuperación / vuelta tras lesión leve.
- 'rehab' — rehab estructurado, solo si hay lesión activa.
- 'maintenance' — atleta entrenado en fase de mantenimiento.

[Reglas duras de prescripción]
- Mínimos por sesión según minutes_per_session: 4 ejercicios @30 min, 6 @45-60, 8 @90.
- Estructura obligatoria de sesión de fuerza: calentamiento (1 bloque corto) + compuestos principales (2-3) + accesorios (2-3) + opcional core/conditioning.
- Solo ejercicios viables con folder.training.equipment.
- NUNCA propongas movimientos en folder.training.blocked_movements ni que carguen una zona dañada en folder.training.injuries.
- Cada ejercicio debe traer sets, reps, rpe, rest_s.
- Progresión semanal explícita en notes ("+2.5 kg si completaste 3×8 con RPE ≤7").
- Si el atleta tiene deportes paralelos en folder.training.parallel_sports con fixed_days: evita piernas el día anterior; deja recuperación.

[Salida vía tool]
- Para proponer el programa entero: llama propose_training_program con TODOS los campos (program_type, start_date, period_weeks, sessions_per_week, minutes_per_session, goal, rationale, sessions[]). period_weeks ≥ 4.
- **Si ya hay un plan activo (active_plan no es null):** NO propongas otro programa salvo que el atleta lo pida EXPLÍCITAMENTE ("hazme uno nuevo", "rehaz el plan entero"). Por defecto, usa update_planned_sessions sobre sesiones futuras del plan activo.
- **Si el atleta cambia UN solo parámetro (minutos por sesión, días, equipamiento, etc.) sin pedir un programa nuevo:**
  1. Persiste el cambio con save_intake_field (path='training.minutes_per_session', path='training.days_per_week', path='training.equipment', etc.).
  2. Usa update_planned_sessions para ajustar las sesiones futuras según ese parámetro.
  3. **NO toques los demás parámetros.** Si el atleta dice "ahora tengo 90 minutos", NO añadas días extra ni cambies el split. Solo alarga cada sesión.
- Para sesiones individuales puntuales (fuera de programa): propose_training_session.
- NUNCA escribas <function=...> como texto plano en tu respuesta — emite el tool_call estructurado. Si lo haces como texto, el sistema falla.

[Revisión de plan activo]
Si hay active_plan y el atleta lleva ≥7 días:
- Revisa recent_trainings con sets reales (peso, reps, RPE) y strain Whoop si linkado.
- Si >30% skipped → propón bajar volumen con update_planned_sessions.
- Si RPE real >> prescrito sostenido → propón bajar carga.
- Si recovery <50 dos días seguidos → sesión de descarga.

[Brevedad]
Máximo 3 párrafos cortos. Directo, técnico pero accesible.`,

  orchestrator: `Eres el orquestador. Decides si una pregunta del atleta va al nutricionista, al preparador, o si la respondes tú directamente. Hablas español de España, breve.`,
};

// Addendum cuando conversation.mode === 'onboarding'. Cubre intake estructurado
// + "¿algo más?" + persistencia de respuestas estructuradas vía save_intake_field.
const INTAKE_ADDENDUM: Record<AgentName, string> = {
  trainer: `MODO ENTREVISTA INICIAL (intake).

Tu objetivo: cubrir los puntos 1-12 abajo conversacionalmente (uno a uno, reaccionando a cada respuesta), llamar save_intake_field tras cada respuesta estructurada, cerrar con "¿algo más?", y solo entonces llamar propose_training_program con un programa de calidad.

ORDEN DE LA ENTREVISTA (salta el punto si la respuesta ya está en folder.training y es coherente):

1. Saluda por profile.display_name y refleja lo que ya sabes ("Veo que tienes X años, Y cm, Z kg, objetivo W"). Pregunta si todo sigue igual.
2. Objetivo concreto en estas 4-8 semanas (perder grasa, ganar músculo, preparar prueba, volver tras lesión, mantenerme). Persiste save_intake_field path='training.primary_goal'.
3. Nivel actual de actividad: sedentario / 1-2 días sin estructura / consistente <1 año / 1-3 años / ≥3 años. Persiste save_intake_field path='training.self_level'.
4. Días por semana que puede entrenar (1-7). Persiste save_intake_field path='training.days_per_week'.
5. Minutos por sesión que tiene de media (15/30/45/60/90+). PREGUNTA OBLIGATORIA. No propongas plan sin esto. Persiste save_intake_field path='training.minutes_per_session'.
6. Lugar y equipamiento (gym completo, gym básico, casa con material, casa sin material, aire libre). Persiste save_intake_field path='training.location' y path='training.equipment' como array de strings.
7. Lesiones, dolores activos, movimientos a evitar. Persiste save_intake_field path='training.injuries' y path='training.blocked_movements'. Si hay dolor activo significativo → considera program_type 'rehab' o 'mobility' como primera fase.
8. Experiencia previa (años entrenando, última rutina). Acepta foto o screenshot si quiere subir.
9. ¿Practicas algún otro deporte además del entreno? PREGUNTA GENÉRICA — NO menciones padel, fútbol, escalada ni ningún deporte concreto. Si responde que sí: pregunta cuál, frecuencia (sesiones por semana mínimo y máximo) y si hay días fijos. Persiste save_intake_field path='training.parallel_sports' con valor [{sport, sessions_per_week_min, sessions_per_week_max, fixed_days}]. fixed_days es array de números 1-7 (1=lunes, 7=domingo). Usa esto al planear: evita piernas el día anterior a un fixed_day, deja recuperación.
10. RM/pesos máximos en compuestos clave (sentadilla, press banca, peso muerto, dominadas) — pregunta SOLO si self_level es ≥1-3 años y program_type va a ser strength. Persiste save_intake_field path='training.maxes'.
11. "¿Hay algo más que quieras contarme? Cualquier cosa: manías, una molestia que aparece a veces, miedos, o algún detalle que no te haya preguntado." Espera respuesta antes de avanzar.
12. Recapitula en 2 líneas. Decide el program_type explícitamente. Llama propose_training_program con TODOS los campos: program_type, start_date (próximo lunes en formato YYYY-MM-DD), period_weeks (≥4), sessions_per_week, minutes_per_session, goal, rationale, sessions[]. Respeta los mínimos de ejercicios por sesión según los minutos.

REGLAS DE PERSISTENCIA:
- save_intake_field acepta paths 'training.<campo>' o 'nutrition.<campo>'. No inventes paths.
- Tras cada respuesta del atleta a las preguntas 2-10, llama save_intake_field inmediatamente. Esto NO sustituye al tool propose_training_program final.
- Si el atleta sube una imagen, léela y comenta lo relevante antes de seguir.`,

  nutritionist: `MODO ENTREVISTA INICIAL (intake).

Tu objetivo: cubrir los puntos 1-12 abajo conversacionalmente, persistir cada respuesta con save_intake_field, cerrar con "¿algo más?", y solo entonces llamar propose_meal_target.

ORDEN DE LA ENTREVISTA (salta el punto si ya está en folder.nutrition):

1. Saluda por profile.display_name y refleja lo que sabes (edad, altura, peso, objetivo).
2. Objetivo nutricional concreto (definir, perder, mantener, recomposición). Persiste save_intake_field path='nutrition.goal'.
3. Comidas al día que le encaja hacer (1-6). Persiste save_intake_field path='nutrition.meals_per_day'.
4. Estilo de cocina y tiempo disponible. Persiste save_intake_field path='nutrition.cooking_style'.
5. Hidratación actual aproximada (litros/día). Persiste save_intake_field path='nutrition.hydration_l'.
6. Alcohol: frecuencia y contexto. Persiste save_intake_field path='nutrition.alcohol'.
7. Restricciones (alergias, intolerancias, dieta — vegetariano, halal, sin gluten, …). Persiste save_intake_field path='nutrition.restrictions' como array.
8. Suplementos que toma. Persiste save_intake_field path='nutrition.supplements' como array.
9. Acepta foto de comida típica o screenshot de una app. Si sube una analítica de sangre (PDF), referencia los valores relevantes (hierro, vitamina D, perfil lipídico, glucosa).
10. ¿Practicas algún otro deporte además del entreno? PREGUNTA GENÉRICA — NO menciones padel ni ningún deporte concreto. Si responde que sí, necesitas saberlo para calibrar calorías y carbohidratos los días de partido. (Si el coach trainer ya lo guardó, ya está en folder.training.parallel_sports.)
11. "¿Hay algo más que quieras contarme? Cualquier alergia menor, suplemento puntual, algo que no le siente bien, o detalle que no te haya preguntado." Espera respuesta.
12. Recapitula en 2 líneas y llama propose_meal_target con números realistas que cumplan la coherencia 4×prot + 4×carb + 9×fat ≈ kcal (±10%). Proteína 1.6-2.2 g/kg de peso corporal.

REGLAS DE PERSISTENCIA:
- save_intake_field acepta paths 'nutrition.<campo>'. No inventes paths.
- Tras cada respuesta estructurada (puntos 2-8), llama save_intake_field inmediatamente.`,

  orchestrator: '',
};

// TOOLS sigue en formato OpenAI-style para compatibilidad con datos
// históricos en `messages.tool_calls`. Se convierten a Anthropic en runtime
// vía toAnthropicTools().
type ToolDef = {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

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
  {
    type: 'function',
    function: {
      name: 'propose_training_program',
      description:
        'Propone un programa completo de N semanas (mín 4, máx 12). Cuando el atleta lo acepta, supersede el plan activo anterior y crea todas las sesiones en su calendario marcadas como prescritas. Usa este tool SOLO al cerrar la entrevista inicial o cuando el atleta pide "monta-me el mes". REGLAS DURAS DE CALIDAD (obligatorias): (a) program_type debe escogerse según el perfil real del atleta; si es sedentario o con sobrepeso significativo arranca con "beginner_walk_first", no metas fuerza pesada en semana 1. (b) Cada sesión de tipo strength|push|pull|legs|full|upper|lower debe tener AL MENOS: 4 ejercicios si minutes_per_session=30, 6 si 45-60, 8 si ≥90, contando todos los ejercicios incluido calentamiento. (c) Estructura obligatoria de sesión de fuerza: 1 bloque de calentamiento + 2-3 compuestos + 2-3 accesorios + opcional core/conditioning. (d) Cada ejercicio debe traer sets, reps, rpe, rest_s. (e) No propongas ejercicios con equipamiento que el atleta no tiene. No uses movimientos en blocked_movements ni que dañen una zona en injuries. (f) Si hay deportes paralelos con fixed_days, evita piernas el día anterior. EFICIENCIA DE TOKENS (importante): Para ahorrar tokens en la salida, envía SOLO las sesiones de UNA semana modelo (sessions cubriendo la primera semana del programa) — el sistema replicará automáticamente ese patrón a las N semanas (mismos días de la semana, mismas sesiones). Si quieres progresión semana a semana distinta, manda las sesiones explícitamente para cada semana. Y devuelve el JSON COMPACTO (sin indentación, sin espacios innecesarios entre claves). NUNCA escribas la llamada como texto <function=...> — emite tool_call estructurado.',
      parameters: {
        type: 'object',
        properties: {
          program_type: {
            type: 'string',
            enum: [
              'beginner_walk_first',
              'strength',
              'cardio',
              'mixed',
              'mobility',
              'rehab',
              'maintenance',
            ],
            description:
              "Modalidad del programa. 'beginner_walk_first' para sedentarios/sobrepeso; 'strength' fuerza/hipertrofia; 'cardio' resistencia; 'mixed' fuerza+cardio (recomp); 'mobility' vuelta tras lesión leve; 'rehab' rehab estructurado; 'maintenance' mantenimiento de entrenado.",
          },
          start_date: {
            type: 'string',
            description: 'Lunes de la primera semana (YYYY-MM-DD).',
          },
          period_weeks: {
            type: 'number',
            description: 'Número de semanas del programa (4-12).',
          },
          sessions_per_week: {
            type: 'number',
            description: 'Sesiones por semana planificadas (1-7).',
          },
          minutes_per_session: {
            type: 'number',
            description:
              'Minutos por sesión que el atleta dispone (15-120). Marca los mínimos de ejercicios por sesión.',
          },
          goal: {
            type: 'string',
            description: 'Objetivo concreto del mesociclo (1 línea).',
          },
          rationale: {
            type: 'string',
            description:
              'Por qué este program_type y este split, basado en el perfil y la entrevista (2-3 frases).',
          },
          sessions: {
            type: 'array',
            description:
              'Sesiones distribuidas. Cada una con scheduled_for (día sugerido, flexible), type (push/pull/legs/full/upper/lower/cardio/walk/hiit/mobility/mixed/rest), prescribed (blocks con exercises sets/reps/rpe/rest_s). Respeta los mínimos por minutes_per_session.',
            items: {
              type: 'object',
              properties: {
                scheduled_for: {
                  type: 'string',
                  description: 'YYYY-MM-DD.',
                },
                type: {
                  type: 'string',
                  enum: [
                    'push',
                    'pull',
                    'legs',
                    'full',
                    'upper',
                    'lower',
                    'cardio',
                    'walk',
                    'hiit',
                    'mobility',
                    'mixed',
                    'rest',
                  ],
                },
                prescribed: {
                  type: 'object',
                  description:
                    'Estructura: {blocks:[{name,exercises:[{name,sets,reps,rpe,rest_s,notes}]}]}. Para "walk" puede ser un bloque único con un exercise "Caminar" sets=1 reps=null y notes con minutos. Para "mobility" 1-2 bloques con ejercicios de movilidad/estiramientos.',
                },
              },
              required: ['scheduled_for', 'type', 'prescribed'],
            },
          },
        },
        required: [
          'program_type',
          'start_date',
          'period_weeks',
          'sessions_per_week',
          'minutes_per_session',
          'goal',
          'rationale',
          'sessions',
        ],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_planned_sessions',
      description:
        'Propone cambios a sesiones futuras del plan activo (status=scheduled). Útil tras una semana de datos reales (RPE alto, fallos, recovery bajo). Solo afecta a sesiones no iniciadas. Genera una propuesta que el atleta acepta o rechaza.',
      parameters: {
        type: 'object',
        properties: {
          rationale: {
            type: 'string',
            description: 'Por qué los cambios (1-2 frases).',
          },
          updates: {
            type: 'array',
            description: 'Lista de cambios.',
            items: {
              type: 'object',
              properties: {
                session_id: { type: 'string', description: 'UUID de la sesión.' },
                type: { type: 'string', description: 'Nuevo tipo si cambia.' },
                prescribed: {
                  type: 'object',
                  description: 'Nuevo prescribed si cambia.',
                },
                notes: {
                  type: 'string',
                  description: 'Notas/explicación de qué cambia y por qué.',
                },
              },
              required: ['session_id'],
            },
          },
        },
        required: ['rationale', 'updates'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_intake_field',
      description:
        'Guarda una respuesta estructurada del atleta durante la entrevista inicial en athlete_folder. Usar SOLO en mode=onboarding cuando una respuesta encaja en un campo concreto del folder (p.ej. deportes paralelos, lesiones, equipamiento). NO inventar paths.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description:
              "Path en formato 'training.<campo>' o 'nutrition.<campo>'. Ej: 'training.parallel_sports', 'nutrition.restrictions', 'training.injuries'.",
          },
          value: {
            description:
              'Valor a guardar. Tipo libre (string, number, array, object). Ej: [{sport:"padel", sessions_per_week_min:3, sessions_per_week_max:4, fixed_days:[3]}].',
          },
        },
        required: ['path', 'value'],
      },
    },
  },
];

export interface AttachmentRef {
  id: string;
  kind: 'image' | 'document';
  storage_path: string;
  mime_type: string;
  original_filename: string | null;
  extracted_text: string | null;
}

export interface RunAgentOptions {
  apiKey: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  userId: string;
  conversationId: string;
  agentRole: AgentRole;
  userMessage: string;
  attachments?: AttachmentRef[];
}

export interface RunAgentResult {
  assistantText: string;
  turn: number;
  inputTokens: number;
  outputTokens: number;
  userMessageId: string | null;
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
  id: string;
  turn: number;
  role: 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls: StoredToolCall[] | null;
  tool_call_id: string | null;
}

interface HistoryAttachment {
  message_id: string;
  kind: 'image' | 'document';
  original_filename: string | null;
  extracted_text: string | null;
}

interface ConversationSummary {
  summary: string;
  last_compacted_turn: number;
}

async function loadHistoryWithSummary(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  conversationId: string,
): Promise<{
  summary: ConversationSummary | null;
  messages: MessageRow[];
  attachmentsByMessageId: Map<string, HistoryAttachment[]>;
}> {
  const [summaryResp, messagesResp] = await Promise.all([
    supabase
      .from('conversation_summaries')
      .select('summary, last_compacted_turn')
      .eq('conversation_id', conversationId)
      .maybeSingle(),
    supabase
      .from('messages')
      .select('id, turn, role, content, tool_calls, tool_call_id')
      .eq('conversation_id', conversationId)
      .order('turn', { ascending: true }),
  ]);

  const summary = summaryResp.data as ConversationSummary | null;
  const allMessages = (messagesResp.data ?? []) as MessageRow[];
  const messages = summary
    ? allMessages.filter((m) => m.turn > summary.last_compacted_turn)
    : allMessages;

  const messageIds = messages.map((m) => m.id);
  const attachmentsByMessageId = new Map<string, HistoryAttachment[]>();
  if (messageIds.length > 0) {
    const { data: atts } = await supabase
      .from('message_attachments')
      .select('message_id, kind, original_filename, extracted_text')
      .in('message_id', messageIds);
    for (const a of (atts ?? []) as HistoryAttachment[]) {
      const arr = attachmentsByMessageId.get(a.message_id) ?? [];
      arr.push(a);
      attachmentsByMessageId.set(a.message_id, arr);
    }
  }

  return { summary, messages, attachmentsByMessageId };
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

  // La compactación es cheap y no necesita razonamiento estructurado —
  // se queda en Groq Llama para minimizar coste.
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    console.warn('[runner] GROQ_API_KEY missing — skipping compaction');
    return;
  }
  // apiKey arg keeps signature stable; not used in this branch.
  void apiKey;
  const groq = new Groq({ apiKey: groqApiKey });
  const response = await groq.chat.completions.create({
    model: COMPACT_MODEL,
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
      model: COMPACT_MODEL,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'conversation_id' },
  );
}

function historyToAnthropic(
  history: MessageRow[],
  attachmentsByMessageId: Map<string, HistoryAttachment[]>,
): Anthropic.MessageParam[] {
  const out: Anthropic.MessageParam[] = [];
  for (const m of history) {
    if (m.role === 'user' && m.content) {
      // Re-inyectar el extracted_text de los adjuntos (en BD solo persistimos
      // el texto del usuario; el modelo necesita el contenido completo).
      const atts = attachmentsByMessageId.get(m.id) ?? [];
      const docTexts = atts
        .filter((a) => a.kind === 'document' && a.extracted_text)
        .map(
          (a) =>
            `[Documento adjunto: ${a.original_filename ?? 'documento'}]\n${a.extracted_text}`,
        );
      const content =
        docTexts.length > 0 ? `${m.content}\n\n${docTexts.join('\n\n')}` : m.content;
      out.push({ role: 'user', content });
    } else if (m.role === 'assistant') {
      // Convertir tool_calls OpenAI-style → content blocks Anthropic.
      const toolCalls = (m.tool_calls ?? []) as StoredToolCall[];
      const blocks: Anthropic.ContentBlockParam[] = [];
      if (m.content) blocks.push({ type: 'text', text: m.content });
      for (const tc of toolCalls) {
        let input: Record<string, unknown> = {};
        try {
          input = JSON.parse(tc.function.arguments) as Record<string, unknown>;
        } catch {
          // ignore
        }
        blocks.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.function.name,
          input,
        });
      }
      if (blocks.length === 0) blocks.push({ type: 'text', text: '' });
      out.push({ role: 'assistant', content: blocks });
    } else if (m.role === 'tool' && m.tool_call_id && m.content !== null) {
      // Tool results en Anthropic van como user message con block tool_result.
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

function toAnthropicTools(tools: ToolDef[]): Anthropic.Tool[] {
  return tools.map((t) => ({
    name: t.function.name,
    description: t.function.description ?? '',
    input_schema: (t.function.parameters ?? {
      type: 'object',
      properties: {},
    }) as Anthropic.Tool.InputSchema,
  }));
}

// Guarda contra que el modelo dispare dos veces la misma propuesta en el
// mismo turno (o conversación). Si ya existe una pending del mismo tipo en
// la conversación, devolvemos error para que el modelo aprenda y no
// reintente. La BD también tiene unique partial index como red de seguridad.
async function hasPendingProposalOfType(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  conversationId: string,
  proposalType: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('agent_proposals')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('proposal_type', proposalType)
    .eq('status', 'pending')
    .limit(1)
    .maybeSingle();
  return !!data?.id;
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
    if (name === 'update_planned_sessions') {
      const rationale = String(args.rationale ?? '');
      const updates = Array.isArray(args.updates) ? args.updates : [];
      if (updates.length === 0) {
        return {
          result: null,
          error: 'updates_empty',
          duration_ms: Date.now() - start,
        };
      }
      if (
        await hasPendingProposalOfType(
          supabase,
          conversationId,
          'session_update',
        )
      ) {
        return {
          result: null,
          error:
            'Ya existe una propuesta session_update pendiente en esta conversación. El atleta debe aceptar o rechazar la anterior antes de generar otra. NO reintentes este tool en este turno.',
          duration_ms: Date.now() - start,
        };
      }
      const payload: Record<string, unknown> = { updates };
      const { data, error } = await supabase
        .from('agent_proposals')
        .insert({
          user_id: userId,
          conversation_id: conversationId,
          message_id: messageId,
          agent: agentName,
          proposal_type: 'session_update',
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
        result: {
          proposal_id: data.id,
          type: 'session_update',
          status: 'pending',
        },
        duration_ms: Date.now() - start,
      };
    }
    if (name === 'propose_training_program') {
      if (
        await hasPendingProposalOfType(
          supabase,
          conversationId,
          'training_program',
        )
      ) {
        return {
          result: null,
          error:
            'Ya existe una propuesta training_program pendiente en esta conversación. El atleta debe aceptar o rechazar la anterior antes de generar otra. NO reintentes este tool en este turno.',
          duration_ms: Date.now() - start,
        };
      }
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
          proposal_type: 'training_program',
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
        result: {
          proposal_id: data.id,
          type: 'training_program',
          status: 'pending',
        },
        duration_ms: Date.now() - start,
      };
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
      if (await hasPendingProposalOfType(supabase, conversationId, proposal_type)) {
        return {
          result: null,
          error: `Ya existe una propuesta ${proposal_type} pendiente en esta conversación. El atleta debe aceptar o rechazar la anterior antes de generar otra. NO reintentes este tool en este turno.`,
          duration_ms: Date.now() - start,
        };
      }
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
    if (name === 'save_intake_field') {
      const rawPath = typeof args.path === 'string' ? args.path : '';
      const value = args.value;
      const match = rawPath.match(/^(training|nutrition)\.([a-zA-Z0-9_]+)$/);
      if (!match) {
        return {
          result: null,
          error: `invalid_path: ${rawPath}`,
          duration_ms: Date.now() - start,
        };
      }
      const section = match[1] as 'training' | 'nutrition';
      const field = match[2]!;
      // Lee folder, merge en el JSONB de la sección correspondiente.
      const { data: folder, error: readErr } = await supabase
        .from('athlete_folder')
        .select(section)
        .eq('user_id', userId)
        .maybeSingle();
      if (readErr) {
        return {
          result: null,
          error: readErr.message,
          duration_ms: Date.now() - start,
        };
      }
      const existing =
        (folder?.[section] as Record<string, unknown> | null) ?? {};
      const next = { ...existing, [field]: value };
      const { error: updErr } = await supabase
        .from('athlete_folder')
        .update({ [section]: next })
        .eq('user_id', userId);
      if (updErr) {
        return {
          result: null,
          error: updErr.message,
          duration_ms: Date.now() - start,
        };
      }
      return {
        result: { ok: true, section, field },
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

// Construye un snapshot compacto del atleta (~150-300 tokens) que se inyecta
// en el system prompt en cada turno. Cubre lo esencial: identidad, objetivo,
// configuración de entrenamiento, nutrición y estado del plan + última semana.
// El agente PUEDE seguir llamando get_athlete_state para detalles puntuales
// (qué comió un día, sets de hace una semana, recovery día a día).
async function buildAthleteSnapshot(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
): Promise<string> {
  const today = new Date();
  const since7d = new Date(today.getTime() - 7 * 86_400_000).toISOString();
  const since7dDate = since7d.slice(0, 10);

  const [profileResp, folderResp, planResp, sessionsResp, recoveryResp] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('display_name, sex, date_of_birth, height_cm, locale, timezone')
        .eq('id', userId)
        .maybeSingle(),
      supabase
        .from('athlete_folder')
        .select(
          'primary_objective, baseline_weight_kg, target_weight_kg, target_date, nutrition, training',
        )
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('training_plans')
        .select('week_start, period_weeks, period_end, goal')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle(),
      supabase
        .from('training_sessions')
        .select('id, status, whoop_workout_id, type')
        .eq('user_id', userId)
        .gte('scheduled_for', since7dDate)
        .order('scheduled_for', { ascending: false }),
      supabase
        .from('whoop_recovery')
        .select('score')
        .eq('user_id', userId)
        .gte('date', since7dDate),
    ]);

  const p = (profileResp.data ?? {}) as {
    display_name?: string;
    sex?: string;
    date_of_birth?: string;
    height_cm?: number;
    locale?: string;
    timezone?: string;
  };
  const f = (folderResp.data ?? {}) as {
    primary_objective?: string;
    baseline_weight_kg?: number;
    target_weight_kg?: number;
    target_date?: string;
    nutrition?: Record<string, unknown> | null;
    training?: Record<string, unknown> | null;
  };
  const nut = (f.nutrition ?? {}) as Record<string, unknown>;
  const tra = (f.training ?? {}) as Record<string, unknown>;
  const plan = planResp.data as
    | {
        week_start: string;
        period_weeks: number;
        period_end: string | null;
        goal: string | null;
      }
    | null;

  const age = p.date_of_birth
    ? Math.floor(
        (today.getTime() - new Date(p.date_of_birth + 'T00:00:00').getTime()) /
          (365.25 * 86_400_000),
      )
    : null;

  // Línea identidad.
  const identityParts: string[] = [];
  if (p.display_name) identityParts.push(p.display_name);
  if (age) identityParts.push(`${age} años`);
  if (p.sex) identityParts.push(p.sex === 'male' ? 'hombre' : p.sex === 'female' ? 'mujer' : p.sex);
  if (p.height_cm) identityParts.push(`${p.height_cm} cm`);
  if (f.baseline_weight_kg) identityParts.push(`${f.baseline_weight_kg} kg`);
  if (p.locale) identityParts.push(`idioma ${p.locale}`);

  // Línea objetivo.
  const goalParts: string[] = [];
  if (f.primary_objective) goalParts.push(String(f.primary_objective));
  if (f.target_weight_kg) goalParts.push(`target ${f.target_weight_kg} kg`);
  if (f.target_date) goalParts.push(`para ${f.target_date}`);

  // Entrenamiento.
  const trainingParts: string[] = [];
  if (tra.self_level) trainingParts.push(String(tra.self_level));
  if (tra.days_per_week) trainingParts.push(`${tra.days_per_week} días/sem`);
  if (tra.minutes_per_session)
    trainingParts.push(`${tra.minutes_per_session} min/sesión`);
  if (tra.location) trainingParts.push(String(tra.location));
  const equipment = Array.isArray(tra.equipment)
    ? (tra.equipment as string[]).slice(0, 4).join('/')
    : tra.equipment
      ? String(tra.equipment)
      : null;
  if (equipment) trainingParts.push(`equipo: ${equipment}`);
  const injuries =
    Array.isArray(tra.injuries) ? (tra.injuries as string[]).join(', ') : tra.injuries
      ? String(tra.injuries)
      : null;
  const blocked =
    Array.isArray(tra.blocked_movements) && (tra.blocked_movements as unknown[]).length > 0
      ? (tra.blocked_movements as string[]).join(', ')
      : null;
  const parallelSports = Array.isArray(tra.parallel_sports)
    ? (tra.parallel_sports as Array<{
        sport: string;
        sessions_per_week_min?: number;
        sessions_per_week_max?: number;
        fixed_days?: number[];
      }>)
        .map((s) => {
          const days = s.fixed_days?.length
            ? ` fijos: ${s.fixed_days.join(',')}`
            : '';
          const freq =
            s.sessions_per_week_max && s.sessions_per_week_min
              ? `${s.sessions_per_week_min}-${s.sessions_per_week_max}/sem`
              : '';
          return `${s.sport} ${freq}${days}`.trim();
        })
        .join(' · ')
    : null;

  // Nutrición.
  const nutritionParts: string[] = [];
  const targets = nut.targets as
    | {
        daily_calories?: number;
        daily_protein_g?: number;
        daily_carbs_g?: number;
        daily_fat_g?: number;
        hydration_l?: number;
      }
    | undefined;
  if (targets) {
    const t: string[] = [];
    if (targets.daily_calories) t.push(`${targets.daily_calories} kcal`);
    if (targets.daily_protein_g) t.push(`${targets.daily_protein_g}g P`);
    if (targets.daily_carbs_g) t.push(`${targets.daily_carbs_g}g C`);
    if (targets.daily_fat_g) t.push(`${targets.daily_fat_g}g F`);
    if (targets.hydration_l) t.push(`${targets.hydration_l}L agua`);
    if (t.length) nutritionParts.push(`targets ${t.join('/')}`);
  } else {
    nutritionParts.push('sin targets aún');
  }
  if (nut.meals_per_day) nutritionParts.push(`${nut.meals_per_day} comidas/día`);
  const restrictions = Array.isArray(nut.restrictions)
    ? (nut.restrictions as string[]).join(', ')
    : null;

  // Plan activo.
  const planParts: string[] = [];
  if (plan) {
    planParts.push(
      `${plan.period_weeks} sem desde ${plan.week_start}${plan.period_end ? ` hasta ${plan.period_end}` : ''}`,
    );
    if (plan.goal) planParts.push(`"${plan.goal}"`);
  }

  // Última semana.
  const sessions = (sessionsResp.data ?? []) as Array<{
    id: string;
    status: string;
    whoop_workout_id: string | null;
  }>;
  const done = sessions.filter((s) => s.status === 'done').length;
  const skipped = sessions.filter((s) => s.status === 'skipped').length;
  const total = sessions.length;
  const linkedWhoop = sessions.filter((s) => s.whoop_workout_id).length;
  const recoveries = (recoveryResp.data ?? [])
    .map((r: { score: number | null }) => r.score)
    .filter((s: number | null): s is number => typeof s === 'number');
  const avgRecovery =
    recoveries.length > 0
      ? Math.round(recoveries.reduce((a: number, b: number) => a + b, 0) / recoveries.length)
      : null;

  const lines: string[] = [];
  lines.push('[CONTEXTO ATLETA — datos clave del usuario]');
  if (identityParts.length) lines.push(`Identidad: ${identityParts.join(' · ')}.`);
  if (goalParts.length) lines.push(`Objetivo: ${goalParts.join(' · ')}.`);
  if (trainingParts.length || injuries || blocked || parallelSports) {
    const trainBits = trainingParts.length ? trainingParts.join(' · ') : '';
    const extras: string[] = [];
    if (injuries) extras.push(`Lesiones: ${injuries}`);
    if (blocked) extras.push(`Evita: ${blocked}`);
    if (parallelSports) extras.push(`Deportes: ${parallelSports}`);
    lines.push(
      `Entrenamiento: ${[trainBits, ...extras].filter(Boolean).join(' · ')}.`,
    );
  }
  if (nutritionParts.length || restrictions) {
    const nutBits = nutritionParts.length ? nutritionParts.join(' · ') : '';
    const restr = restrictions ? `Restricciones: ${restrictions}` : '';
    lines.push(`Nutrición: ${[nutBits, restr].filter(Boolean).join(' · ')}.`);
  }
  if (planParts.length) {
    lines.push(`Plan activo: ${planParts.join(' · ')}.`);
  } else {
    lines.push('Plan activo: ninguno.');
  }
  if (total > 0 || avgRecovery !== null) {
    const last: string[] = [];
    if (total > 0)
      last.push(
        `${done}/${total} sesiones${skipped > 0 ? ` (${skipped} skipped)` : ''}`,
      );
    if (linkedWhoop > 0) last.push(`${linkedWhoop} con Whoop`);
    if (avgRecovery !== null) last.push(`recovery medio ${avgRecovery}`);
    lines.push(`Últimos 7 días: ${last.join(' · ')}.`);
  }
  lines.push(
    'Si necesitas más detalle (comidas concretas, sets antiguos, recovery día a día), llama a get_athlete_state. Para preguntas que se contesten con lo de arriba, NO llames a la tool.',
  );

  return lines.join('\n');
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
      .select(
        'id, scheduled_for, type, status, rpe, notes, whoop_workout_id, plan_id, prescribed',
      )
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

  // Enriquecer trainings con sets reales + datos Whoop linkados.
  const sessionRows = (trainings.data ?? []) as Array<{
    id: string;
    whoop_workout_id: string | null;
  }>;
  const sessionIds = sessionRows.map((s) => s.id);
  const linkedWhoopIds = sessionRows
    .map((s) => s.whoop_workout_id)
    .filter((x): x is string => !!x);

  const [setsResp, whoopWorkoutsResp, activePlanResp] = await Promise.all([
    sessionIds.length > 0
      ? supabase
          .from('training_sets')
          .select('session_id, exercise, set_number, reps, weight_kg, rpe, is_warmup')
          .in('session_id', sessionIds)
          .order('set_number', { ascending: true })
      : Promise.resolve({ data: [] }),
    linkedWhoopIds.length > 0
      ? supabase
          .from('whoop_workouts')
          .select('whoop_id, sport, start_at, end_at, strain, avg_hr, max_hr')
          .in('whoop_id', linkedWhoopIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from('training_plans')
      .select('id, week_start, period_weeks, period_end, goal, status')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle(),
  ]);

  const setsBySession = new Map<string, unknown[]>();
  for (const s of (setsResp.data ?? []) as Array<{ session_id: string }>) {
    if (!setsBySession.has(s.session_id)) setsBySession.set(s.session_id, []);
    setsBySession.get(s.session_id)!.push(s);
  }
  const whoopById = new Map<string, unknown>();
  for (const w of (whoopWorkoutsResp.data ?? []) as Array<{ whoop_id: string }>) {
    whoopById.set(w.whoop_id, w);
  }
  const trainingsEnriched = sessionRows.map((s) => ({
    ...s,
    sets: setsBySession.get(s.id) ?? [],
    whoop: s.whoop_workout_id ? whoopById.get(s.whoop_workout_id) ?? null : null,
  }));

  return {
    today: todayIso,
    profile: profileResp.data ?? null,
    folder: folderResp.data ?? null,
    verdict: {
      status: verdict.status,
      text: verdict.text,
      components: verdict.components,
    },
    active_plan: activePlanResp.data ?? null,
    recent_meals: (meals.data ?? []).slice(0, 10),
    recent_trainings: trainingsEnriched,
    recent_recoveries: (recoveries.data ?? []).slice(-7),
    recent_moods: moods.data ?? [],
    weights: weights.data ?? [],
    recent_agent_notes: notes.data ?? [],
  };
}

export async function runAgent(opts: RunAgentOptions): Promise<RunAgentResult> {
  const agentName = AGENT_NAME[opts.agentRole];

  // Cargar conversation.mode para decidir si va el prompt de onboarding.
  const { data: conv } = await opts.supabase
    .from('conversations')
    .select('mode')
    .eq('id', opts.conversationId)
    .maybeSingle();
  const mode = (conv?.mode ?? 'normal') as ConversationMode;

  const systemPrompt = SYSTEM_PROMPTS[agentName];
  const intakeAddendum =
    mode === 'onboarding' ? INTAKE_ADDENDUM[agentName] : '';

  const { summary, messages: history, attachmentsByMessageId } =
    await loadHistoryWithSummary(opts.supabase, opts.conversationId);
  const lastTurn =
    history.length > 0
      ? Math.max(...history.map((m) => m.turn))
      : (summary?.last_compacted_turn ?? 0);

  // Persistir mensaje user. El content guardado NO incluye el extracted_text
  // de los adjuntos — el cliente renderiza un badge a partir de la tabla
  // message_attachments. El extracted_text se re-inyecta cuando reconstruimos
  // el historial para el modelo (ver historyToOpenAI).
  const persistedContent = opts.userMessage;

  let nextTurn = lastTurn + 1;
  const { data: userRow, error: userErr } = await opts.supabase
    .from('messages')
    .insert({
      conversation_id: opts.conversationId,
      user_id: opts.userId,
      turn: nextTurn,
      role: 'user',
      content: persistedContent,
    })
    .select('id')
    .single();
  if (userErr) throw new Error(`save_user_msg: ${userErr.message}`);
  const userMessageId = (userRow?.id as string | undefined) ?? null;

  // Snapshot compacto del atleta inyectado en cada turno. Ahorra llamadas
  // redundantes a get_athlete_state (que tira un payload masivo) cuando el
  // agente solo necesita los datos clave del usuario.
  const athleteSnapshot = await buildAthleteSnapshot(opts.supabase, opts.userId);

  const fullSystem = [
    systemPrompt,
    athleteSnapshot,
    intakeAddendum,
    summary
      ? `RESUMEN DE LA CONVERSACIÓN PREVIA (compactado, turns 1..${summary.last_compacted_turn}):\n${summary.summary}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  // Construir user turn para Anthropic.
  // - Si hay imágenes: content[] con bloques text + image (base64 source).
  // - Si solo hay docs: string con userMessage + extracted_text.
  const images = (opts.attachments ?? []).filter((a) => a.kind === 'image');
  const hasImages = images.length > 0;

  let userTurnContent: string | Anthropic.ContentBlockParam[];
  if (hasImages) {
    const parts: Anthropic.ContentBlockParam[] = [
      { type: 'text', text: opts.userMessage },
    ];
    for (const img of images) {
      try {
        const { data: blob } = await opts.supabase.storage
          .from('chat-attachments')
          .download(img.storage_path);
        if (blob) {
          const buf = Buffer.from(await blob.arrayBuffer());
          parts.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: img.mime_type as
                | 'image/jpeg'
                | 'image/png'
                | 'image/gif'
                | 'image/webp',
              data: buf.toString('base64'),
            },
          });
        }
      } catch (e) {
        console.warn('[runner] image_download_failed', e);
      }
    }
    const docs = (opts.attachments ?? []).filter((a) => a.kind === 'document');
    for (const d of docs) {
      if (d.extracted_text) {
        parts.push({
          type: 'text',
          text: `[Documento adjunto: ${d.original_filename ?? 'documento'}]\n${d.extracted_text}`,
        });
      }
    }
    userTurnContent = parts;
  } else {
    const docs = (opts.attachments ?? []).filter((a) => a.kind === 'document');
    const docTexts = docs
      .filter((d) => d.extracted_text)
      .map(
        (d) =>
          `[Documento adjunto: ${d.original_filename ?? 'documento'}]\n${d.extracted_text}`,
      );
    userTurnContent =
      docTexts.length > 0
        ? `${opts.userMessage}\n\n${docTexts.join('\n\n')}`
        : opts.userMessage;
  }

  const anthropic = new Anthropic({ apiKey: opts.apiKey });
  const anthropicTools = toAnthropicTools(TOOLS);

  // System con prompt caching ephemeral — el system+snapshot+intake cambia
  // poco entre turnos, cacheado nos baja el coste ~70% de la parte de input.
  const systemBlocks: Anthropic.TextBlockParam[] = [
    {
      type: 'text',
      text: fullSystem,
      cache_control: { type: 'ephemeral' },
    },
  ];

  const messages: Anthropic.MessageParam[] = [
    ...historyToAnthropic(history, attachmentsByMessageId),
    { role: 'user', content: userTurnContent },
  ];

  const toolCallsExecuted: RunAgentResult['toolCalls'] = [];
  let totalIn = 0;
  let totalOut = 0;
  let assistantText = '';

  for (let iter = 0; iter < 3; iter++) {
    const response = await anthropic.messages.create({
      model: AGENT_MODEL,
      max_tokens: MAX_TOKENS,
      temperature: 0.2,
      system: systemBlocks,
      tools: anthropicTools,
      messages,
    });
    totalIn += response.usage?.input_tokens ?? 0;
    totalOut += response.usage?.output_tokens ?? 0;

    // Extraer texto + tool_use de los content blocks. Convertimos los
    // tool_use a formato OpenAI-style para persistir en `messages.tool_calls`
    // (compat con datos históricos y schema BD).
    let text = '';
    const toolCalls: StoredToolCall[] = [];
    for (const block of response.content) {
      if (block.type === 'text') {
        text += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          type: 'function',
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input ?? {}),
          },
        });
      }
    }
    text = stripNonLatin(text);

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
        model: AGENT_MODEL,
        input_tokens: response.usage?.input_tokens ?? null,
        output_tokens: response.usage?.output_tokens ?? null,
      })
      .select('id')
      .single();
    if (aErr) throw new Error(`save_assistant_msg: ${aErr.message}`);

    assistantText = text;

    if (toolCalls.length === 0 || response.stop_reason !== 'tool_use') {
      break;
    }

    // Echo del assistant turn al historial (text + tool_use blocks).
    messages.push({
      role: 'assistant',
      content: response.content,
    });

    // Ejecutar tools y devolver tool_result en un único user message.
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
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

      toolResults.push({
        type: 'tool_result',
        tool_use_id: tc.id,
        content: resultText,
        ...(exec.error ? { is_error: true } : {}),
      });
    }

    messages.push({
      role: 'user',
      content: toolResults,
    });
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
    userMessageId,
    toolCalls: toolCallsExecuted,
  };
}
