# Fase 4 — Registro de sesión · Plan

> **Para agentes ejecutores:** SUB-SKILL: `superpowers:subagent-driven-development`. Pasos en checkbox.

**Goal:** "Empezar" una rutina genera una **sesión en vivo**; el atleta registra cada serie (reps, peso, RIR/RPE) y la marca hecha; al terminar queda en el **historial**. UI premium (design system v2).

**Architecture:** Tablas `sessions` + `sets` (RLS por usuario). `sessions.ts` instancia una sesión desde una rutina (pre-rellena series desde `routine_exercises`) y registra lo ejecutado. Pantalla de sesión en vivo + historial, con los componentes v2.

**Tech Stack:** Supabase · Expo SDK 56 + expo-router · NativeWind · reanimated 4 · @creed/ui-native v2 · jest-expo + RNTL v14.

## Global Constraints

- **Docker CAÍDO** → Tarea 1 (migración): escribir + revisión estática, apply diferido al humano (`pnpm db:migration:new`, NO `db:start/reset/gen:types`). Tareas 2-4 autónomas (jest mockea supabase; tsc + expo export sin BD).
- **Patrón data layer:** como `routines.ts`/`exercises.ts` (cliente supabase plano; inserts encadenan `.select().single()` — Supabase v2 devuelve `data:null` sin él; `user_id` en cada insert vía `requireUser()` = `auth.getUser()`). RLS `<tabla>_self_<action>` con `auth.uid()`. Enums = `text check (...)`.
- **UI:** premium light glass (design.md), componentes v2 (`@creed/ui-native`: Screen via Header/GlassCard, Button, Input, Chip, AppText, NumberStepper, Badge, FAB, IconButton), motion (`usePressScale`/`useFadeSlideIn`/`haptic` via `Animated.View`), `expo-image`. Rutas en `apps/mobile/src/app/(app)/`. RNTL v14 → `await render()`. Quality gate frontend-design.
- Reutiliza: `getRoutine` (routine + exercises con targets), `displayName` (exercises.ts). Commits `<type>: <desc>` sin trailer.

## Estructura
```
supabase/migrations/<ts>_sessions_sets.sql
apps/mobile/src/lib/sessions.ts (+ sessions.test.ts)
apps/mobile/src/app/(app)/session/[id].tsx        ← sesión en vivo (héroe)
apps/mobile/src/app/(app)/history/index.tsx        ← historial
apps/mobile/src/app/(app)/history/[id].tsx         ← detalle (solo lectura)
apps/mobile/src/app/(app)/routines/[id].tsx        ← (modificar) botón "Empezar"
apps/mobile/src/app/(app)/index.tsx                ← (modificar) entrada "Historial"
apps/mobile/src/components/session/* (si hace falta: SetRow)
```

---

### Task 1: Migración `sessions` + `sets` (+ RLS)

**Docker caído:** `pnpm db:migration:new sessions_sets` (op local), escribe el SQL, revisión estática, commit solo la migración. NO ejecutes db:start/reset/gen:types.

```sql
-- Sesión: instancia ejecutada de una rutina (o suelta/Whoop).
create table public.sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  routine_id       uuid references public.routines(id) on delete set null,
  program_id       uuid references public.programs(id) on delete set null,
  scheduled_for    date,
  started_at       timestamptz not null default now(),
  completed_at     timestamptz,
  status           text not null default 'in_progress' check (status in ('planned','in_progress','completed','skipped')),
  source           text not null default 'manual' check (source in ('manual','whoop','coach')),
  whoop_workout_id text,
  session_rir      smallint check (session_rir between 0 and 10),
  session_rpe      numeric(3,1) check (session_rpe between 1 and 10),
  notes            text,
  created_at       timestamptz not null default now()
);
create index sessions_user_started_idx on public.sessions (user_id, started_at desc);
create unique index sessions_whoop_unique on public.sessions (user_id, whoop_workout_id) where whoop_workout_id is not null;

-- Serie ejecutada (unidad atómica).
create table public.sets (
  id                  uuid primary key default gen_random_uuid(),
  session_id          uuid not null references public.sessions(id) on delete cascade,
  user_id             uuid not null references public.profiles(id) on delete cascade,
  exercise_id         uuid not null references public.exercises(id) on delete restrict,
  routine_exercise_id uuid references public.routine_exercises(id) on delete set null,
  set_number          smallint not null default 1,
  reps                smallint check (reps between 0 and 1000),
  weight_kg           numeric(6,2) check (weight_kg >= 0),
  rir                 smallint check (rir between 0 and 10),
  rpe                 numeric(3,1) check (rpe between 1 and 10),
  is_warmup           boolean not null default false,
  completed           boolean not null default false,
  performed_at        timestamptz,
  notes               text
);
create index sets_session_idx on public.sets (session_id);

alter table public.sessions enable row level security;
alter table public.sets enable row level security;

create policy sessions_self_select on public.sessions for select using (user_id = auth.uid());
create policy sessions_self_insert on public.sessions for insert with check (user_id = auth.uid());
create policy sessions_self_update on public.sessions for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy sessions_self_delete on public.sessions for delete using (user_id = auth.uid());

create policy sets_self_select on public.sets for select using (user_id = auth.uid());
create policy sets_self_insert on public.sets for insert with check (user_id = auth.uid());
create policy sets_self_update on public.sets for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy sets_self_delete on public.sets for delete using (user_id = auth.uid());
```
- [ ] Revisión estática (FKs a profiles/routines/programs/exercises/routine_exercises; 8 políticas; índices; checks). Commit `feat(db): tablas sessions + sets (+ RLS)`.

---

### Task 2: Capa de datos `sessions.ts` (+ tests)

Tipos `Session`, `SessionSet` (embebe exercise: name_en/name_es/image_url/primary_muscle), `SessionWithSets = Session & { sets: SessionSet[] }`. Funciones (cliente supabase, inserts con `.select().single()`, `user_id` vía `requireUser()`):
- `startSession(routineId: string): Promise<Session>` — inserta sesión (`source:'manual'`, `status:'in_progress'`, `routine_id`, `started_at` default). Luego, leyendo la rutina (`getRoutine(routineId)`), **pre-crea series** en `sets`: por cada `routine_exercise`, `target_sets` filas (set_number 1..n, `exercise_id`, `routine_exercise_id`, `completed:false`, reps/weight null). Devuelve la sesión.
- `getActiveSession(): Promise<Session | null>` — sesión `in_progress` del usuario (`.maybeSingle()`), para reanudar.
- `getSession(id): Promise<SessionWithSets | null>` — sesión + `sets` (join a `exercises (name_en,name_es,image_url,primary_muscle)`), ordenadas por exercise_id/position y set_number.
- `updateSet(setId, patch: { reps?; weight_kg?; rir?; rpe?; completed?; performed_at? }): Promise<void>`.
- `addSet(sessionId, exerciseId, routineExerciseId, setNumber): Promise<SessionSet>` · `removeSet(id): Promise<void>`.
- `completeSession(id): Promise<void>` — `status:'completed'`, `completed_at: now()`.
- `listSessions(): Promise<(Session & { routine_name: string | null; set_count: number })[]>` — historial, `started_at desc`, con nombre de rutina (join routines) y nº de series (count). (Si el join/count es complejo, devuelve sesión + routine join y cuenta client-side de un select ligero.)

- [ ] **TDD** (mock supabase, mock-prefijo): `startSession` inserta sesión con status in_progress + pre-crea sets desde los targets de la rutina; `updateSet` actualiza el set; `completeSession` setea status completed + completed_at; `listSessions` ordena por started_at desc. Run `jest src/lib/sessions.test.ts`.
- [ ] Verifica: jest verde + tsc 0. Commit `feat(mobile): capa de datos de sesiones`.

---

### Task 3: Pantalla de sesión en vivo (HÉROE) — máxima UI

**Dirección, máximo cuidado.** Es el "active workout" — referencia Hevy/Strong pero con el glass premium de Creed.

**Files:** `(app)/session/[id].tsx`, modificar `(app)/routines/[id].tsx` (botón "Empezar"), opcional `packages/ui-native` o local `components/session/set-row.tsx`.

- **Empezar:** en el editor de rutina (`routines/[id].tsx`) añade un botón primario **"Empezar entreno"** → `startSession(routineId)` → `router.push('/(app)/session/<id>')`. (También vale desde la lista de rutinas, opcional.)
- **Sesión en vivo (`session/[id].tsx`):** Header con nombre de la rutina + **cronómetro** (tiempo desde `started_at`, actualizado con un intervalo). Por cada ejercicio: cabecera (imagen `expo-image` + nombre + músculo Badge + el target "4×8-10 · RIR 2" como referencia). Debajo, sus **series** como filas: nº de serie · input **Peso (kg)** · input **Reps** · (RIR opcional) · un **check** grande para marcar la serie hecha (háptica `success` + relleno accent al completar). Botón "Añadir serie" por ejercicio (`addSet`). Cada edición persiste con `updateSet` (optimista; al marcar hecha, `performed_at:now()`). Progreso visible (p.ej. "8/12 series"). Botón fijo abajo **"Finalizar entreno"** → `completeSession` → vuelve (o a un resumen) con háptica de éxito.
- Motion: entrada staged, press-scale en los checks, transición fluida. Manejo de errores como en el builder (no tragar; rollback/alert en fallo de persistencia; no marcar éxito si falló).
- [ ] Test de render con sesión mock (RNTL `await render`): muestra los ejercicios y sus series con los targets/inputs. Mock de `sessions.ts`.
- [ ] Verifica: jest verde · tsc 0 · expo export bundea. Commit `feat(mobile): pantalla de sesión en vivo (registro de series)`.

---

### Task 4: Historial de sesiones

**Files:** `(app)/history/index.tsx`, `(app)/history/[id].tsx`, modificar `(app)/index.tsx` (entrada "Historial").

- **Lista (`history/index.tsx`):** `listSessions()` → tarjetas glass por sesión: fecha (relativa/absoluta), nombre de rutina, nº de series + (opcional) volumen total; estado (completada/en curso). Vacío con estado bonito. Tap → detalle. Una sesión `in_progress` se distingue (Badge "En curso") y al tocar reanuda en `session/[id]`.
- **Detalle (`history/[id].tsx`):** `getSession(id)` en **solo lectura** — ejercicios + series ejecutadas (peso×reps, RIR), duración, fecha. Reutiliza composición de la sesión en vivo pero sin edición.
- **Entrada:** en Home (`(app)/index.tsx`) añade una CTA/acceso a "Historial" (`/(app)/history`), manteniendo la composición equilibrada (Ejercicios / Rutinas / Programa / Historial).
- [ ] Test de render de la lista con sesiones mock (RNTL `await render`). Mock de `sessions.ts`.
- [ ] Verifica: jest verde · tsc 0 · expo export. Commit `feat(mobile): historial de sesiones (lista + detalle)`.

---

## Criterio de salida Fase 4
- [ ] "Empezar" una rutina crea una sesión con sus series pre-rellenadas; registras reps/peso/RIR y marcas series; "Finalizar" la cierra; aparece en el historial.
- [ ] `pnpm --filter @creed/mobile test` verde · `tsc` 0 · `expo export` bundea.
- [ ] Migración `sessions_sets` escrita (apply diferido a Docker).
- [ ] (Humano) con BD: ejecutar una rutina en el simulador y verla en el historial.

## Notas de ejecución (autónomo)
- Tareas 3-4 UI-heavy: implementadores capaces (sonnet; opus para la Tarea 3 héroe), revisor con quality gate frontend-design.
- Tras review final + fix wave → mergear Fase 4 a `main`.
