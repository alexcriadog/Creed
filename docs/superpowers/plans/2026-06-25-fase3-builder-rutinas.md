# Fase 3 — Sistema de diseño v2 + Builder de rutinas (héroe) · Plan

> **Para agentes ejecutores:** SUB-SKILL: `superpowers:subagent-driven-development`. Pasos en checkbox.

**Goal:** Elevar la UI de Creed a "premium glass moderno" (sistema de diseño v2) y construir el **builder de rutinas + programas**, la pantalla héroe del producto, sobre ese sistema.

**Architecture:** Se enriquece `packages/ui-native` con un design system pulido (tokens precisos light+dark, fuente real, glass con blur, motion con reanimated, háptica). Se reestilan las pantallas existentes. Se añaden tablas `programs/program_days/routines/routine_exercises` (RLS) y la UI del builder, que consume el catálogo de la Fase 2.

**Tech Stack:** Expo SDK 56 + expo-router · NativeWind v4 · react-native-reanimated 4 · react-native-gesture-handler · expo-blur · expo-haptics · expo-linear-gradient · expo-font (Inter) · expo-image · Supabase.

## Global Constraints

- **Dirección visual (committed, no mezclar):** *glassmorphism premium claro con profundidad*, según `docs/design.md`. Atmósfera con gradiente sutil, superficies glass con blur real (`expo-blur`), sombras suaves + inset highlight, acento `#4F62E0` usado **semánticamente** (acción/selección), colores de estado recovery (verde `#34B36B`/ámbar `#E2A23A`/rojo `#DE4A3C`) solo para señal. **No** flipear a dark por defecto (design.md elige claro); pero dejar dark mode pulido vía tokens.
- **Calidad (quality gate frontend-design):** jerarquía por contraste de escala, ritmo de espaciado intencional (no padding uniforme), profundidad por capas/overlap/sombra, tipografía con carácter, estados press/focus/active **diseñados**, motion que clarifica (no micro-interacciones random). Que no parezca template. Cada pantalla debe verse creíble en un screenshot de producto real.
- **RN, no web:** sin framer-motion/CSS; usar reanimated (worklets) para motion, `expo-blur` para glass, `expo-haptics` para feedback, gesture-handler para reordenar. Tokens oklch de design.md → **hex** (RN no renderiza oklch); clamp/vw → tamaños fijos.
- **Estructura:** rutas en `apps/mobile/src/app/(app)/`; lib en `src/lib/`; componentes en `packages/ui-native/src/`. RNTL v14 → `render()` async en tests.
- **Docker CAÍDO:** Tarea 4 (migración) y el seed = escribir + revisión estática; aplicar BD diferido al humano. Tareas de UI/datos (mock) = autónomas (jest + tsc + expo export).
- **RLS:** `programs/routines/...` por usuario: `<tabla>_self_<action>` con `user_id = auth.uid()`. Enums = `text check (...)`. Commits `<type>: <desc>` sin trailer.

---

### Task 1: Design system v2 — fundamentos (tokens, fuente, atmósfera, motion/háptica)

**Dirección, no transcripción.** Construye la base del sistema premium.

**Files:** `packages/ui-native/src/theme.ts` (tokens), `packages/ui-native/src/motion.ts` (hooks reanimated + háptica), `packages/ui-native/tailwind-preset.js` (ampliar), `apps/mobile/src/app/_layout.tsx` (cargar fuente + GestureHandlerRootView), `apps/mobile/src/lib/use-fonts.ts`.

- [ ] **Instala** en mobile: `pnpm --filter @creed/mobile add expo-blur expo-haptics expo-linear-gradient @expo-google-fonts/inter`. (reanimated/gesture-handler/expo-image/expo-font ya están.)
- [ ] **Tokens (`theme.ts` + ampliar el preset):** exporta el sistema completo desde los valores de `docs/design.md`, convertidos a hex:
  - Colores light + **dark** (canvas, canvas-tint, surface con niveles, border subtle/default/strong, text primary/secondary/muted/on-accent, accent/strong/soft, status green/amber/red). Parte de los hex ya existentes en el preset (Fase 1) y **complétalos** (dark mode, accent-strong, soft, gradientes).
  - **Gradientes** (para atmósfera y botón primario): p.ej. canvas gradient sutil `#F6F7FA → #EDEFF4` (light); accent gradient `#4F62E0 → #3D4FCC`.
  - **Sombras** (RN `shadow*`/elevation) en 3 niveles (sm/md/lg) coherentes con el glass de design.md.
  - **Radios** sm/md/lg/xl/2xl/pill (ya en el preset) y **espaciado** (ritmo 4px).
  - Tipografía: escala de tamaños fijos (xs..display) + pesos; familia Inter (`Inter_400Regular/500Medium/600SemiBold/700Bold`) cargada con expo-font. (Geist sería ideal pero Inter es fiable vía @expo-google-fonts; documenta la decisión.)
- [ ] **Carga de fuente (`use-fonts.ts` + `_layout.tsx`):** `useFonts` de @expo-google-fonts/inter; mientras carga, mantener splash / no romper. Envolver la app en `GestureHandlerRootView` (requisito de gesture-handler) además del `SafeAreaProvider` y `AuthProvider` que ya hay. Mantener `import '../../global.css'`.
- [ ] **Motion/háptica (`motion.ts`):** hooks reanimated reutilizables — `usePressScale()` (escala 0.97 al pulsar, spring), `useFadeSlideIn(delay)` (entrada fade+translateY para staged reveals), y `haptic(type)` envolviendo expo-haptics (light/medium/success). Worklets correctos.
- [ ] **Verifica (no bloqueante):** `pnpm --filter @creed/mobile exec tsc --noEmit` (0) + `cd apps/mobile && npx expo export --platform ios` bundea (luego `rm -rf dist`). Commit `feat(ui-native): design system v2 — tokens, fuente Inter, motion + háptica`.

---

### Task 2: Componentes premium

**Dirección, no transcripción.** Construye un set de componentes con acabado, en `packages/ui-native/src/`. Cada uno: estados press/disabled/loading diseñados, tokens del theme, accesible (`accessibilityRole`, hit slop).

**Inventario:**
- `Surface`/`GlassCard` — superficie glass con `expo-blur` (BlurView) + borde sutil + sombra + radius; prop `intensity`/`tone`. (Reemplaza el Surface básico actual.)
- `Button` — variantes `primary` (gradiente accent vía expo-linear-gradient), `secondary` (glass), `ghost`; press-scale (reanimated) + háptica; estados loading/disabled; tamaños sm/md. (Eleva el Button actual conservando su API `label/onPress/loading/variant`.)
- `Input` — label flotante o superior, focus ring (borde accent al enfocar), placeholder muted, estados error.
- `Chip` — seleccionable (toggle), variante filtro; activo = accent, inactivo = glass.
- `AppText` — variantes `display/title/heading/body/label/muted` con la escala/pesos del theme (Inter). Conserva `variant` previo (title/body/muted) como alias.
- `Header` — título grande + opcional back/acción; respeta safe-area.
- `IconButton` / `FAB` — botón circular con háptica + press-scale; FAB con sombra elevada y gradiente.
- `Divider`, `Badge` (para grupo muscular / estado).

Usa `lucide-react-native` para iconos (instálalo: `pnpm --filter @creed/mobile add lucide-react-native`).

- [ ] **TDD** donde aporta señal: test de `Button` (press dispara onPress; loading lo bloquea) y `Chip` (toggle) bajo el harness jest (RNTL v14 `await render`). El resto, render + acabado visual.
- [ ] Actualiza el barrel `src/index.ts` exportando todos.
- [ ] **Verifica:** jest verde (Button/Chip) · `tsc` 0 · `expo export` bundea. Commit `feat(ui-native): componentes premium (GlassCard, Button, Input, Chip, Header, FAB…)`.

---

### Task 3: Reestilar pantallas existentes con v2

**Dirección.** Aplica el sistema v2 a las pantallas ya hechas para coherencia premium. No cambies su lógica/datos, solo la capa visual.

- `(auth)/login` y `(auth)/verify`: pantalla con atmósfera (gradiente), logo/título con jerarquía, `Input` v2, `Button` primary con gradiente + háptica. Sensación de producto, no formulario.
- `(app)/index` ("Hoy"): cabecera con saludo + fecha; tarjeta(s) glass placeholder ("Aquí vivirá tu día"); CTA grande a "Ejercicios" y (preparando Fase 3b) a "Rutinas". Composición con jerarquía, no lista plana.
- `(app)/exercises` (lista + detalle): tarjetas glass, `expo-image` para las imágenes (mejor que RN Image — placeholder/transición), chips de filtro v2 con scroll horizontal bien resuelto (sin recorte), header. Detalle: imagen hero con overlay de gradiente + título encima, secciones.

- [ ] Mantén verdes los tests existentes (`exercises-list.test`, etc.) — si cambian imports, ajústalos. RNTL v14 async.
- [ ] **Verifica:** suite mobile verde · `tsc` 0 · `expo export`. Commit `feat(mobile): reestilo premium de login/home/catálogo con design system v2`.

---

### Task 4: Migración programs / program_days / routines / routine_exercises (+ RLS)

**Files:** `supabase/migrations/<ts>_routines_programs.sql` (vía `pnpm db:migration:new routines_programs`).

**Docker CAÍDO:** crea el archivo (op local, sin Docker) + escribe el SQL + revisión estática. **NO** ejecutes `db:start/db:reset/db:gen:types`. Commit solo la migración.

SQL completo:
```sql
-- Programa: contenedor del plan del usuario (1 activo a la vez).
create table public.programs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  name          text not null,
  goal          text,
  rationale     text,
  created_by    text not null default 'athlete' check (created_by in ('athlete','coach')),
  status        text not null default 'draft' check (status in ('draft','active','archived')),
  period_weeks  smallint check (period_weeks between 1 and 12),
  start_date    date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index programs_one_active_per_user
  on public.programs (user_id) where status = 'active';

-- Rutina: plantilla de un día reutilizable ("Upper A").
create table public.routines (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  program_id   uuid references public.programs(id) on delete set null,
  name         text not null,
  created_by   text not null default 'athlete' check (created_by in ('athlete','coach')),
  position     smallint not null default 0,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index routines_user_idx on public.routines (user_id);
create index routines_program_idx on public.routines (program_id);

-- Líneas de la plantilla.
create table public.routine_exercises (
  id              uuid primary key default gen_random_uuid(),
  routine_id      uuid not null references public.routines(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  exercise_id     uuid not null references public.exercises(id) on delete restrict,
  position        smallint not null default 0,
  target_sets     smallint check (target_sets between 1 and 20),
  target_reps     text,                       -- "8-10" o "10"
  target_rir      smallint check (target_rir between 0 and 10),
  target_rpe      numeric(3,1) check (target_rpe between 1 and 10),
  rest_seconds    smallint check (rest_seconds between 0 and 600),
  superset_group  smallint,
  notes           text
);
create index routine_exercises_routine_idx on public.routine_exercises (routine_id);

-- Horario semanal del programa: weekday -> routine.
create table public.program_days (
  id          uuid primary key default gen_random_uuid(),
  program_id  uuid not null references public.programs(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  weekday     smallint not null check (weekday between 0 and 6),  -- 0=lunes
  routine_id  uuid not null references public.routines(id) on delete cascade,
  unique (program_id, weekday)
);

-- RLS: todo por usuario.
alter table public.programs enable row level security;
alter table public.routines enable row level security;
alter table public.routine_exercises enable row level security;
alter table public.program_days enable row level security;

create policy programs_self_select on public.programs for select using (user_id = auth.uid());
create policy programs_self_insert on public.programs for insert with check (user_id = auth.uid());
create policy programs_self_update on public.programs for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy programs_self_delete on public.programs for delete using (user_id = auth.uid());

create policy routines_self_select on public.routines for select using (user_id = auth.uid());
create policy routines_self_insert on public.routines for insert with check (user_id = auth.uid());
create policy routines_self_update on public.routines for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy routines_self_delete on public.routines for delete using (user_id = auth.uid());

create policy routine_exercises_self_select on public.routine_exercises for select using (user_id = auth.uid());
create policy routine_exercises_self_insert on public.routine_exercises for insert with check (user_id = auth.uid());
create policy routine_exercises_self_update on public.routine_exercises for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy routine_exercises_self_delete on public.routine_exercises for delete using (user_id = auth.uid());

create policy program_days_self_select on public.program_days for select using (user_id = auth.uid());
create policy program_days_self_insert on public.program_days for insert with check (user_id = auth.uid());
create policy program_days_self_update on public.program_days for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy program_days_self_delete on public.program_days for delete using (user_id = auth.uid());
```
- [ ] Revisión estática del SQL (FKs, checks, índices, 16 políticas correctas). Commit `feat(db): tablas programs/routines/routine_exercises/program_days (+ RLS)`.

---

### Task 5: Capa de datos del móvil — rutinas & programas (+ tests)

**Files:** `apps/mobile/src/lib/routines.ts` + `routines.test.ts`.

Tipos `Program`, `Routine`, `RoutineExercise` (con el ejercicio embebido para la UI). Funciones (cliente supabase, patrón de la Fase 2; tests mockean supabase):
- `listRoutines(): Promise<Routine[]>` — del usuario, ordenadas por position.
- `getRoutine(id): Promise<Routine & { exercises: RoutineExercise[] } | null>` — rutina + sus líneas con join a `exercises` (nombre/imagen/músculo).
- `createRoutine(input): Promise<Routine>` · `updateRoutine` · `deleteRoutine`.
- `addRoutineExercise(routineId, exerciseId, targets)` · `updateRoutineExercise` · `removeRoutineExercise` · `reorderRoutineExercises(routineId, orderedIds)`.
- Programas: `getActiveProgram()`, `createProgram`, `setProgramDay(programId, weekday, routineId)`, `listProgramDays(programId)`.

- [ ] **TDD** (mock supabase): test que `listRoutines` consulta `routines` ordenado por position; `addRoutineExercise` inserta con `user_id` implícito y los targets; `reorderRoutineExercises` actualiza positions. RNTL no necesario (lógica pura).
- [ ] **Verifica:** jest verde · `tsc` 0. Commit `feat(mobile): capa de datos de rutinas y programas`.

---

### Task 6: Builder de rutinas (PANTALLA HÉROE) — máxima UI

**Dirección, máximo cuidado de UX/visual.** Esta es la pantalla central del producto.

**Files:** `(app)/routines/index.tsx` (mis rutinas), `(app)/routines/new.tsx` o `[id].tsx` (builder editor), `(app)/routines/exercise-picker.tsx` (selector desde catálogo), + componentes en `packages/ui-native` si hace falta (p.ej. `SetTargetRow`, `NumberStepper`).

**UX del builder:**
- **Lista "Mis rutinas":** tarjetas glass con nombre, nº ejercicios, grupos musculares (badges), CTA "Nueva rutina" (FAB). Vacío con estado bonito.
- **Editor de rutina:** nombre editable arriba; lista de ejercicios añadidos, cada uno como fila con imagen (expo-image), nombre, y sus targets (sets × reps, RIR/RPE, descanso) editables inline con `NumberStepper`/inputs; **reordenar arrastrando** (gesture-handler + reanimated); swipe o botón para quitar; agrupar en superserie. Botón "Añadir ejercicio" → abre el picker.
- **Exercise picker:** sheet/modal que reutiliza el catálogo de la Fase 2 (`listExercises` + buscador + filtro músculo) para elegir; al tocar, añade a la rutina y vuelve. Multi-add fluido.
- Guardado: `createRoutine` + `addRoutineExercise` (optimista, con feedback háptico de éxito).
- Motion: entrada staged de las filas, press-scale, transición al picker. Detalle premium en todo.

- [ ] Test de render del editor con rutina mock (RNTL `await render`): muestra los ejercicios añadidos y sus targets. Mock de `routines.ts`/`exercises.ts`.
- [ ] Entrada desde Home ("Rutinas"). 
- [ ] **Verifica:** jest verde · `tsc` 0 · `expo export`. Commit `feat(mobile): builder de rutinas (lista + editor + picker)`.

---

### Task 7: Programas + horario semanal

**Dirección.** Sobre el builder, la capa de programa.

**Files:** `(app)/program/index.tsx` (programa activo + semana), `(app)/program/schedule.tsx` (asignar rutina a cada día).

- **Vista de programa:** nombre, objetivo, y una **semana** (Lun–Dom) donde cada día muestra la rutina asignada (o "descanso"); tarjetas glass; tap en un día → elegir rutina (de "mis rutinas"). 
- Crear programa (nombre + objetivo + semanas) si no hay activo.
- Usa `getActiveProgram`/`setProgramDay`/`listProgramDays`.
- Entrada desde Home.

- [ ] Test de render de la semana con programa mock. RNTL async.
- [ ] **Verifica:** jest verde · `tsc` 0 · `expo export`. Commit `feat(mobile): programa con horario semanal`.

---

## Criterio de salida Fase 3
- [ ] Design system v2 aplicado; las pantallas se ven premium (no template).
- [ ] Builder de rutinas funcional: crear rutina, añadir ejercicios del catálogo, fijar targets, reordenar; programa con semana.
- [ ] `pnpm --filter @creed/mobile test` verde · `tsc` 0 · `expo export` bundea.
- [ ] Migración `routines_programs` escrita (apply diferido a Docker).
- [ ] (Humano) con BD: aplicar migración + probar el builder en simulador.

## Notas de ejecución (autónomo)
- Tareas 1-3 y 6-7 son **UI-heavy**: dispatchar implementadores capaces (sonnet; opus para la Tarea 6 héroe) con esta dirección; el revisor aplica el **quality gate de frontend-design** además de spec/calidad.
- Tareas 4-5 (schema/datos) precisas. Docker caído → apply diferido.
- Tras pasar review, mergear Fase 3 a `main` (patrón establecido).
