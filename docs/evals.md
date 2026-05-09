# Evals — Suite de calidad de los coaches

> 15 casos representativos para validar la calidad de los agentes. Sirven para detectar
> regresiones cuando cambiamos prompts o modelos, y como criterio de aceptación cuando
> añadimos un agente nuevo.
>
> **Threshold de aceptación**: 14/15 (93%). Configurable en `app_settings.eval_pass_threshold_pct`.

## Cómo se ejecutan

Cada caso especifica:
- `agent`: `nutritionist` | `trainer` | `orchestrator`
- `context`: snapshot sintético del athlete (lo que devolvería `get_athlete_state`)
- `user_message`: mensaje del atleta
- `expect`: criterios de aceptación (any combination):
  - `must_include[]`: substrings que DEBEN aparecer en la respuesta o en los `tool_calls`
  - `must_not_include[]`: substrings que NO pueden aparecer
  - `require_tool_call`: nombre de la tool que debería llamarse (ej. `propose_meal_target`)
  - `require_tool_call_payload[]`: campos dentro del payload del tool call que deben existir

Harness (a construir): `packages/agents/src/evals/runner.ts`. Llama directo a Groq con los
prompts del runner pero pasando un `supabase` mock que devuelve `context` cuando el coach
llama `get_athlete_state`.

CI ejecuta `pnpm --filter @creed/agents evals:smoke` (5 casos críticos) y muestra fail si
alguno de esos no pasa. Suite completa (`evals:full`) se corre on-demand.

---

## Los 15 casos

### Nutricionista

#### N1 — Respeta restricciones vegetarianas

```yaml
agent: nutritionist
context:
  profile: {display_name: "Maria"}
  folder:
    nutrition:
      goal: build_muscle
      restrictions: [vegetarian]
      meals_per_day: 4
user_message: "Qué comer hoy de cena para meter más proteína?"
expect:
  must_not_include: ["pollo", "chicken", "carne", "ternera", "atún", "salmón"]
  must_include: ["proteína"]
```

#### N2 — Personaliza por nombre

```yaml
agent: nutritionist
context:
  profile: {display_name: "Carlos"}
  folder: {nutrition: {goal: lose_fat}}
user_message: "Hola"
expect:
  must_include: ["Carlos"]
```

#### N3 — Pide onboarding si está vacío

```yaml
agent: nutritionist
context:
  profile: {display_name: "Ana"}
  folder:
    nutrition: {}
    nutrition_onboarding_completed_at: null
user_message: "Cuántas calorías debería comer al día?"
expect:
  must_include: ["onboarding", "cuestionario"]
```

#### N4 — Respeta peso objetivo

```yaml
agent: nutritionist
context:
  folder:
    nutrition: {goal: lose_fat, target_weight_kg: 70}
    baseline_weight_kg: 78
  weights:
    - {date: "2026-05-01", weight_kg: 78}
    - {date: "2026-05-08", weight_kg: 78.2}
user_message: "Cómo voy?"
expect:
  must_include: ["déficit", "70"]
```

#### N5 — Propone macros con propose_meal_target

```yaml
agent: nutritionist
context:
  folder: {nutrition: {goal: build_muscle, meals_per_day: 5}}
  weights: [{date: "2026-05-08", weight_kg: 75}]
user_message: "Calcula y propón mis macros diarios."
expect:
  require_tool_call: propose_meal_target
  require_tool_call_payload:
    - daily_calories
    - daily_protein_g
    - rationale
```

#### N6 — Avisa si calorías propuestas violan piso mínimo

```yaml
agent: nutritionist
context:
  profile: {sex: f}
  folder: {nutrition: {goal: lose_fat, target_weight_kg: 50}}
user_message: "Quiero estar a 1000 kcal/día para perder rápido."
expect:
  must_include: ["1200"]
  must_not_include: ["sin problema", "perfecto"]
```

### Preparador

#### T1 — Respeta lesiones declaradas

```yaml
agent: trainer
context:
  folder:
    training:
      injuries: [lower_back]
      blocked_movements: [deadlift_heavy]
      days_per_week: 4
      equipment: [barbell, dumbbells, rack]
user_message: "Propón sesión de pierna pesada para mañana."
expect:
  must_not_include: ["peso muerto pesado", "deadlift", "sentadilla con 1RM"]
```

#### T2 — Adapta a equipamiento real

```yaml
agent: trainer
context:
  folder: {training: {equipment: [dumbbells, bands], location: home_basic}}
user_message: "Sesión de empuje hoy."
expect:
  must_not_include: ["barra olímpica", "rack", "máquina"]
  must_include: ["mancuerna"]
```

#### T3 — Recovery bajo → propone descarga

```yaml
agent: trainer
context:
  recoveries:
    - {date: "2026-05-08", score: 32}
    - {date: "2026-05-07", score: 28}
user_message: "Qué hago hoy?"
expect:
  must_include: ["descans", "carga"]
  must_not_include: ["máxima intensidad", "PR"]
```

#### T4 — Recovery alto sostenido → sube intensidad

```yaml
agent: trainer
context:
  recoveries:
    - {date: "2026-05-08", score: 88}
    - {date: "2026-05-07", score: 85}
    - {date: "2026-05-06", score: 91}
user_message: "Sesión hoy?"
expect:
  must_include: ["intens"]
```

#### T5 — Lee notas de sesión previa

```yaml
agent: trainer
context:
  recent_trainings:
    - {scheduled_for: "2026-05-08", type: pull, status: partial,
       notes: "Solo hice tirones, lumbar molestaba en remo"}
user_message: "Qué tocaría mañana?"
expect:
  must_include: ["lumbar", "remo"]
```

#### T6 — Propone training_session específico

```yaml
agent: trainer
context:
  folder: {training: {primary_goal: hypertrophy, days_per_week: 4}}
  recent_trainings: []
user_message: "Propón mi próxima sesión."
expect:
  require_tool_call: propose_training_session
  require_tool_call_payload:
    - scheduled_for
    - prescribed.blocks
    - rationale
```

### Orquestador / cross-coach

#### X1 — Orquestador rutea al nutricionista

```yaml
agent: orchestrator
user_message: "Cuántas calorías al día?"
expect:
  must_include: ["nutri"]
```

#### X2 — Orquestador rutea al preparador

```yaml
agent: orchestrator
user_message: "Qué peso uso en sentadilla?"
expect:
  must_include: ["prepara"]
```

#### X3 — Modo lapso: tono empático sin juicio

```yaml
agent: trainer
mode: lapse_recovery
context:
  recent_trainings:
    - {scheduled_for: "2026-04-25", status: skipped}
  recoveries: []
user_message: "Llevo 14 días sin entrenar, no sé por dónde empezar."
expect:
  must_not_include: ["debiste", "te lo dije", "fallaste"]
  must_include: ["sin problema", "vuelve", "hoy"]
```

#### X4 — Adherencia baja: nota proactiva

```yaml
agent: nutritionist
context:
  meals: []  # 0 comidas registradas en 7 días
  weights: [{date: "2026-05-01", weight_kg: 78}, {date: "2026-05-08", weight_kg: 79.2}]
  folder: {nutrition: {goal: lose_fat}}
user_message: "Cómo voy?"
expect:
  require_tool_call: add_agent_note
  must_include: ["registr"]
```

---

## Cómo añadir casos nuevos

1. Añadir bloque YAML aquí en este doc.
2. Crear `packages/agents/src/evals/cases/<id>.json` con la misma data.
3. Si el caso es crítico, añadirlo al smoke set en `runner.ts`.

## Smoke set (CI)

Casos en CI: **N1, N3, T1, T3, X3** — los más críticos para no regresar.
