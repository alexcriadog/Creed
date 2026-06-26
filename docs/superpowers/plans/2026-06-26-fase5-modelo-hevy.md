# Fase 5 — Modelo Hevy (programa = carpeta de rutinas) · Plan

> SUB-SKILL: subagent-driven-development. Refina la Fase 3: deshace el horario semanal.

**Goal:** El programa deja de tener horario por días. Modelo estilo Hevy/Strong: **programa = grupo de rutinas**; el día a día empiezas un entreno **eligiendo una rutina** desde Home; la sesión en vivo (Fase 4) ya existe. Whoop (futuro) detecta y linka.

**Architecture:** `routines.program_id` ya enlaza rutina↔programa (link directo) → se **dropea `program_days`** (horario) sin perder nada. Home gana un héroe "Empezar entreno" → selector de rutina → `startSession`. La pantalla `program/` pasa de "semana" a "programa + sus rutinas".

**Tech Stack:** Supabase (Docker ARRIBA → aplicar de verdad) · Expo SDK 56 + expo-router · @creed/ui-native v2 · jest-expo + RNTL v14.

## Global Constraints
- **Docker arriba** → T1 aplica la migración de verdad (`db:migration:new` + `db:reset` + `db:gen:types`), no diferido.
- UI premium light glass (design.md), componentes v2, motion/háptica. Quality gate frontend-design.
- Patrón data layer como `routines.ts`/`sessions.ts` (inserts `.select().single()`; `user_id` vía `requireUser()`; RLS `<tabla>_self_<action>`).
- Reutiliza `startSession(routineId)` (sessions.ts), `getRoutine`, `listRoutines`, `getActiveProgram`. Commits `<type>: <desc>` sin trailer.

---

### Task 1: DB drop `program_days` + recorte de capa de datos
**Files:** `supabase/migrations/<ts>_drop_program_days.sql` (nueva), `apps/mobile/src/lib/routines.ts`, `apps/mobile/src/lib/routines.test.ts` (si hay refs).
- Migración: `drop table if exists public.program_days cascade;` (quita tabla + políticas + índice). NO toca programs/routines/routine_exercises.
- Aplicar de verdad: `pnpm db:migration:new drop_program_days` → escribir SQL → `pnpm db:reset` → `pnpm db:gen:types`.
- `routines.ts`: eliminar `ProgramDay` type, `setProgramDay`, `listProgramDays`. Añadir `listRoutines({ programId? })` (filtro opcional por `program_id`) **o** `listRoutinesByProgram(programId)` para la pantalla de programa. Mantener el resto.
- Quitar cualquier test que dependa de program_days.
- [ ] Verifica jest + tsc + `db:reset` aplica limpio. Commit `feat(db): drop program_days (modelo Hevy)`.

### Task 2: "Empezar entreno" (selector de rutina + héroe en Home)
**Files:** `apps/mobile/src/app/(app)/start.tsx` (nueva — selector), `apps/mobile/src/app/(app)/index.tsx` (Home).
- `start.tsx`: lista las rutinas (`listRoutines`, agrupadas por programa si aplica) como tarjetas glass; cada una → `startSession(id)` → `router.replace('/(app)/session/<id>')`. Estado vacío ("Crea tu primera rutina" → /routines). Manejo de errores (alert, sin navegar) como Fase 3/4. Premium + motion.
- `index.tsx`: el héroe placeholder ("Próximo entreno / Tu plan llega pronto") → **"Empezar entreno"** prominente (botón grande / tarjeta destacada) → `router.push('/(app)/start')`. Re-enfocar la tarjeta "Tu programa" (quitar copy "organiza tu semana día a día" → "Tu programa y sus rutinas"). Mantener Ejercicios/Rutinas/Historial.
- [ ] Test de render de `start.tsx` (mock routines.ts: muestra las rutinas). jest + tsc + expo export. Commit `feat(mobile): empezar entreno desde Home (selector de rutina)`.

### Task 3: Pantalla de programa = programa + sus rutinas (fuera horario)
**Files:** `apps/mobile/src/app/(app)/program/index.tsx` (rehacer), borrar `program/day/*` + `program/program-week.test.tsx`, nuevo test de render.
- `program/index.tsx`: cabecera del programa activo (`getActiveProgram`: nombre + meta) + lista de **sus rutinas** (`listRoutines` filtradas por `program_id`), cada tarjeta → abrir rutina (`/routines/[id]`) y/o "Empezar" (`startSession`). Sin grid de días. Estado sin programa/sin rutinas bonito.
- Borrar la pantalla de día (`program/day/`) y `program-week.test.tsx` (horario obsoleto).
- [ ] Test de render del programa (mock routines.ts). jest + tsc + expo export. Commit `feat(mobile): programa = sus rutinas (sin horario semanal)`.

## Criterio de salida
- [ ] No queda horario semanal; desde Home "Empezar entreno" eliges rutina → sesión; programa muestra sus rutinas.
- [ ] `program_days` dropeada y aplicada en BD viva; `db:gen:types` regenerado.
- [ ] jest verde · tsc 0 · expo export bundea. Review final → merge a `main`.

## Roadmap apuntado
- **Calendario (futuro):** vista retrospectiva (mes con marcas en días entrenados → tocar día → su sesión), estilo Hevy perfil. NO horario prescriptivo.
- **Fase 6:** coach dentro del builder.
