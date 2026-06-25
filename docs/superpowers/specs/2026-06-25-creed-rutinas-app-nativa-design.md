# Diseño — Core de entreno basado en rutinas + app nativa

> Estado: ✅ Validado en brainstorming (2026-06-25). Pendiente de revisión del autor antes de planificar la Fase 1.
> Tipo: spec de rediseño. Sustituye el modelo de entreno actual y pivota el cliente a app nativa.

## Tabla de contenidos

1. [Contexto y motivación](#1-contexto-y-motivación)
2. [Decisiones cerradas](#2-decisiones-cerradas)
3. [Arquitectura: plataforma y monorepo](#3-arquitectura-plataforma-y-monorepo)
4. [Modelo de datos](#4-modelo-de-datos)
5. [Catálogo de ejercicios](#5-catálogo-de-ejercicios)
6. [Flujos](#6-flujos)
7. [Integración del coach (agentes)](#7-integración-del-coach-agentes)
8. [Alcance del MVP y fases](#8-alcance-del-mvp-y-fases)
9. [Fuera de alcance / post-MVP](#9-fuera-de-alcance--post-mvp)
10. [Riesgos y trade-offs](#10-riesgos-y-trade-offs)
11. [Decisiones abiertas](#11-decisiones-abiertas)

---

## 1. Contexto y motivación

Creed hoy modela el entreno como un **plan semanal de texto generado por el coach**: `training_plans` (mesociclo) → `training_sessions` (día con un blob `prescribed` jsonb) → `training_sets` (ejercicio en **texto libre**). No existe el concepto de **rutina reutilizable** ni una **base de ejercicios**.

El autor quiere reorientar la app sobre un eje distinto: **crear la rutina es el centro**. De la rutina nacen las sesiones (creadas a mano o detectadas por Whoop), y para que las rutinas tengan valor real hace falta un **catálogo de ejercicios grande**. Además, el autor quiere **retirar la web actual** (que no le convence) y construir una **app nativa publicable en la App Store**.

Este spec captura el rediseño completo: el modelo de datos normalizado del core de entreno (independiente de plataforma) y el pivote del cliente a Expo / React Native.

**Principio rector:** el **constructor de rutinas es la pantalla héroe**. Todo lo demás (sesiones, Whoop, analítica, nutrición) orbita a su alrededor. El coach no es un chat aparte: vive **dentro del builder**.

---

## 2. Decisiones cerradas

Cerradas en la sesión de brainstorming 2026-06-25:

| Decisión | Valor |
|---|---|
| **Propiedad de las rutinas** | Híbrida: el atleta las crea **y** el coach las genera/mejora |
| **Jerarquía** | Programa › Rutina › Ejercicio › Serie › Sesión |
| **Nomenclatura UI** | Estilo Hevy: **Programa / Rutina / Ejercicio** (el log siempre "Sesión") |
| **Modelo de datos** | Normalizado limpio desde cero — **no** se arrastra el `prescribed` jsonb actual |
| **Detección de sesión** | Ambas vías: Whoop auto-empareja **y** inicio manual desde la rutina |
| **Catálogo** | Rico: ~800-1000 ejercicios con imagen/GIF + instrucciones, importado de dataset open-source + traducido a español |
| **Métrica de esfuerzo** | **RIR y RPE ambos** (columnas separadas, nullable) en targets y en series ejecutadas |
| **Eje del producto** | **Crear la rutina**. El coach ayuda a (a) crearla de 0 y (b) revisar/mejorar una existente |
| **Plataforma cliente** | **Expo / React Native** (iOS App Store + Android), reutilizando el backend TS |
| **Web actual** | Retirar la UI de atleta; mantener web mínima solo para `/admin` |

---

## 3. Arquitectura: plataforma y monorepo

```
apps/
  mobile/     ← NUEVO · Expo (React Native) · app del atleta → App Store + Play
  admin/      ← web mínima (Next.js recortado de apps/web) solo para /admin
packages/
  db/                  ← REUSO (tipos Supabase, queries)
  agents/              ← REUSO (coach + parser; cambian tools, no la infra)
  integrations/whoop   ← REUSO (OAuth, sync, webhook)
  i18n/                ← REUSO
  ui-native/           ← NUEVO · design system para RN (NativeWind + tokens de design.md)
supabase/              ← REUSO + migraciones nuevas (catálogo, rutinas, programas, sesiones)
```

**Decisiones de plataforma:**

- **Expo (React Native)** porque reutiliza todo el backend TS, da iOS + Android desde un código, y EAS Build gestiona TestFlight/store. Descartados: Swift nativo (solo iOS, lenguaje nuevo, cero reuse) y PWA+Capacitor (techo de calidad bajo, Apple rechaza wrappers, no resuelve el descontento con la web).
- **Design system nativo con NativeWind** (Tailwind para RN) para conservar los tokens de `design.md` y el modelo mental Tailwind. `packages/ui` actual (shadcn/Tailwind web) **no porta a RN** y se reemplaza por `ui-native`.
- **El backend no se toca en su lógica**: Supabase, RLS, agents, Whoop, verdict siguen igual. El pivote es del **cliente**.
- **Admin** se queda en web (Next.js recortado), porque es uso de escritorio del autor.

---

## 4. Modelo de datos

Cinco entidades nuevas/rediseñadas. Todas con RLS: filas de usuario aisladas por `user_id`; el catálogo global es legible por cualquier autenticado.

### `exercises` — catálogo global

```
id            uuid PK
slug          text unique           -- 'barbell-bench-press'
name_es       text
name_en       text
primary_muscle      text            -- enum: chest, back, lats, traps, shoulders,
                                    --   biceps, triceps, forearms, quads, hamstrings,
                                    --   glutes, calves, abs, ...
secondary_muscles   text[]          -- mismo enum
equipment     text                  -- enum: barbell, dumbbell, machine, cable,
                                    --   bodyweight, kettlebell, band, ...
movement_pattern text               -- enum: push, pull, squat, hinge, lunge, carry, core, isolation
mechanic      text                  -- compound | isolation
category      text                  -- strength | cardio | mobility | stretching | ...
instructions_es text[]              -- pasos
image_url     text
gif_url       text
is_custom     boolean default false
created_by    uuid null             -- null = global; si no, dueño del custom
created_at    timestamptz
```

**RLS:** `is_custom = false` legible por todos; `is_custom = true` solo por `created_by`. Inserción de customs por atleta o coach.

### `programs` — el contenedor ("PPL de fuerza")

```
id            uuid PK
user_id       uuid FK profiles
name          text
goal          text
rationale     text
created_by    text                  -- 'athlete' | 'coach'
status        text                  -- draft | active | archived
period_weeks  int                   -- 1-12
start_date    date
created_at    timestamptz
```

Restricción: **un único programa `active` por usuario** (índice parcial único). Reemplaza conceptualmente a `training_plans`.

### `program_days` — horario semanal del programa

```
id            uuid PK
program_id    uuid FK programs
weekday       smallint              -- 0-6 (lun-dom)
routine_id    uuid FK routines
```

Mapea "Lun→Upper A, Mar→Lower A…". (Programas rotativos A/B/C → post-MVP.)

### `routines` — plantilla de un día ("Upper A"), reutilizable

```
id            uuid PK
user_id       uuid FK profiles
program_id    uuid FK programs null  -- null = rutina suelta reutilizable
name          text
created_by    text                   -- 'athlete' | 'coach'
position      int
notes         text
created_at    timestamptz
updated_at    timestamptz
```

### `routine_exercises` — líneas de la plantilla

```
id              uuid PK
routine_id      uuid FK routines
exercise_id     uuid FK exercises
position        int
target_sets     smallint
target_reps     text                 -- "8-10" (rango) o número
target_rir      smallint null        -- reps en reserva
target_rpe      numeric(3,1) null    -- esfuerzo percibido
rest_seconds    smallint null
superset_group  smallint null        -- agrupa ejercicios en superserie
notes           text
```

### `sessions` — el log (lo que de verdad pasó)

```
id              uuid PK
user_id         uuid FK profiles
routine_id      uuid FK routines null   -- plantilla instanciada; null = freestyle/Whoop sin plan
program_id      uuid FK programs null
scheduled_for   date
started_at      timestamptz null
completed_at    timestamptz null
status          text                    -- planned | in_progress | completed | skipped
source          text                    -- 'manual' | 'whoop' | 'coach'
whoop_workout_id text null              -- enlace Whoop (unique con user_id)
session_rir     smallint null
session_rpe     numeric(3,1) null
notes           text
created_at      timestamptz
```

### `sets` — unidad atómica (lo ejecutado)

```
id                  uuid PK
session_id          uuid FK sessions
user_id             uuid FK profiles
exercise_id         uuid FK exercises      -- normalizado, no texto libre
routine_exercise_id uuid FK routine_exercises null  -- de qué línea de plantilla viene
set_number          smallint
reps                smallint null
weight_kg           numeric(6,2) null
rir                 smallint null
rpe                 numeric(3,1) null
is_warmup           boolean default false
completed           boolean default false  -- checkoff durante el entreno
performed_at        timestamptz
notes               text
```

**Por qué este modelo:** `sets.exercise_id` apuntando al catálogo desbloquea la analítica que da valor a "una base grande": volumen por grupo muscular (`sum(sets) join exercises.primary_muscle`), progresión por ejercicio en el tiempo, e1RM, PRs. Imposible con texto libre.

---

## 5. Catálogo de ejercicios

**Fuente:** `free-exercise-db` (~800 ejercicios, dominio público) con `primaryMuscles`, `secondaryMuscles`, `equipment`, `force`, `mechanic`, `category`, instrucciones e imágenes. Cumple la regla "reusar antes que escribir".

**Pipeline de import (script one-shot en `packages/db` o `scripts/`):**

1. Verificar licencia del dataset → importar JSON a `exercises`.
2. **Traducir a español** nombres + instrucciones con un modelo barato ya disponible (Groq Llama 3.3 / Gemini Flash), + pasada de curación manual de los ejercicios más comunes.
3. Subir imágenes/GIF a **Supabase Storage**; `image_url`/`gif_url` apuntan ahí.
4. Mapear sus campos a los enums propios (`primary_muscle`, `equipment`, `movement_pattern`).

**Resultado:** catálogo navegable y buscable por músculo / equipo / patrón. El atleta y el coach pueden añadir ejercicios **custom** (`is_custom = true`).

---

## 6. Flujos

### 6.1 El builder (atleta) — pantalla héroe

Buscas ejercicios en el catálogo → los añades con `target_sets / reps / rir o rpe / rest` → ordenas (soporta supersets vía `superset_group`) → guardas la rutina. Agrupas rutinas en un **programa** con horario semanal (`program_days`).

### 6.2 El coach dentro del builder (dos modos)

- **"Créala de 0 con el coach"** → genera una rutina o un programa completo desde el perfil del atleta (`athlete_folder`: objetivo, días/semana, minutos, equipo, lesiones, `blocked_movements`) eligiendo del **catálogo real**. El resultado cae en el builder, **editable** — son filas reales (`routines` + `routine_exercises`), no texto.
- **"Pídele feedback"** → el coach analiza la rutina actual y devuelve **puntos negativos + mejoras concretas aplicables** (añadir/quitar/intercambiar ejercicio, ajustar volumen/series), cada una aplicable con un toque. Si la rutina está bien, lo dice — solo sugiere "si es necesario".

### 6.3 Ciclo de la sesión (orbita la rutina)

- **Manual:** "Empezar" en la rutina del día → crea `session` (`source='manual'`, `status='in_progress'`), pre-rellena las series desde `routine_exercises`, el atleta marca/edita lo real (reps, peso, rir/rpe, `completed`), y completa (`status='completed'`).
- **Whoop:** el webhook crea una `session` (`source='whoop'`). Si hay una sesión `planned` ese día, **ofrece emparejar** (set `whoop_workout_id`). Si no, queda como sesión no planificada (cardio/freestyle) que el atleta puede etiquetar con una rutina o dejar suelta.

---

## 7. Integración del coach (agentes)

El coach (trainer) deja de inventar `prescribed` jsonb en texto libre. Pasa a operar sobre el catálogo y las entidades reales mediante nuevas tools:

| Tool | Qué hace |
|---|---|
| `search_exercises(filtros)` | Busca en el catálogo por músculo/equipo/patrón para elegir movimientos reales |
| `generate_routine(perfil)` | Crea una rutina (`routines` + `routine_exercises`) referenciando `exercise_id` del catálogo |
| `generate_program(perfil)` | Crea un programa completo (`programs` + `program_days` + rutinas) |
| `review_routine(routine_id)` | Devuelve crítica estructurada (puntos negativos) + ediciones sugeridas aplicables |

Las tools respetan `athlete_folder.training.blocked_movements`, `equipment` y `injuries`. El patrón de **propuesta → el atleta acepta → se crean/editan filas** se mantiene (consistente con `agent_proposals` actual), de modo que el atleta siempre tiene la última palabra.

---

## 8. Alcance del MVP y fases

**Filosofía:** MVP completo y bien diseñado **alrededor del eje "crear la rutina"**. Loop héroe: **crear rutina → ejecutarla → coach la mejora**. Lo pasivo (Whoop, peso, veredicto) entra por ser el diferenciador.

Cada fase es su propio ciclo spec → plan → implementar, con criterio de salida concreto.

| Fase | Qué | Criterio de salida |
|---|---|---|
| **1 · Cimientos** | Expo en el monorepo, `ui-native` (NativeWind + tokens), auth Supabase, navegación, EAS→TestFlight | La app arranca en el iPhone vía TestFlight; login real funciona |
| **2 · Catálogo** | Tabla `exercises`, script import + traducción ES + media a Storage, UI navegar/buscar | Navegas ~800 ejercicios en español con imagen, filtrando por músculo/equipo |
| **3 · Rutinas + Programas** | Migraciones `routines/routine_exercises/programs/program_days`, **el builder**, programa con horario | Creas "Upper A" a mano y un programa Upper/Lower; los ves en calendario |
| **4 · Sesión + registro** | `sessions/sets`, "Empezar rutina" → log de series, historial | Ejecutas una rutina y queda registrada con sus series reales |
| **5 · Coach en el builder** ⭐ | Tools `search_exercises/generate_routine/generate_program/review_routine`; UI "créala de 0" + "pídele feedback" aplicable | El coach crea una rutina de 0 y critica/mejora una existente |
| **6 · Contexto pasivo nativo** | Portar dashboard Whoop (recovery/strain), peso+EMA, semáforo de veredicto, y Whoop detecta/empareja sesión | Dashboard diario completo + sesiones auto-detectadas |
| **7 · Nutrición + chat** | Portar quick-log de comida (parser ya existe) + chat con el coach | Registras comida y hablas con el coach desde la app |
| **8 · Admin + submission** | Recortar `apps/web` a `/admin`, pulido, EAS submit | 🚀 App en App Store; autor con panel admin web |

**MVP = fases 1-7.** La 8 lo publica.

---

## 9. Fuera de alcance / post-MVP

- Analítica avanzada (gráficas de volumen por músculo, e1RM, PRs) — el modelo de datos ya lo soporta; la UI es posterior.
- Fotos de progreso con comparación lado a lado.
- Programas rotativos A/B/C (no atados a día de la semana).
- Push notifications (recordatorio diario; ya existe fallback email).
- Release en Android store (Expo lo da casi gratis, pero el foco MVP es iOS/App Store).
- Plan semanal con Opus, modo lapso pulido, cierre semanal — heredados del roadmap previo, no parte de este eje.

---

## 10. Riesgos y trade-offs

| Riesgo | Mitigación |
|---|---|
| `packages/ui` (web) no porta a RN → hay que reconstruir el design system | `ui-native` con NativeWind conserva tokens y mental model; coste contenido a Fase 1 |
| La UI web de atleta ya construida se retira (trabajo perdido) | El backend que la alimenta (Supabase, agents, Whoop) se reutiliza intacto; la pérdida es solo de capa de presentación |
| Coste no presupuestado: Apple Developer 99 $/año + review | Asumido por el autor; EAS gestiona el build/submit |
| Calidad de la traducción ES del catálogo | LLM barato + curación manual de los más comunes; nombres revisables y editables |
| Licencia del dataset de ejercicios | Verificar antes de importar (paso 1 del pipeline); `free-exercise-db` es dominio público |
| Curva de aprendizaje RN/Expo | Mismo lenguaje (TS) y backend; Fase 1 acotada para absorber la curva con una pantalla viva |
| Detección Whoop de entrenos no planificados | Quedan como sesión `source='whoop'` sin rutina, etiquetables; no rompen el plan |

---

## 11. Decisiones abiertas

| Pregunta | Cuándo se cierra |
|---|---|
| ¿Mantener `admin` en `apps/web` recortado o reescribir como app web nueva? | Fase 8 |
| Estrategia exacta de traducción ES (batch LLM vs aprovechar datos ES de wger) | Fase 2 |
| ¿Onboarding entrevista se rehace en nativo o se simplifica para MVP? | Fase 5/7 |
| Modelo del coach para `generate_program` (Sonnet vs Opus por coste/calidad) | Fase 5, calibrar con evals |
| ¿RIR o RPE por defecto en la UI del builder (con el otro como avanzado)? | Fase 3 |
