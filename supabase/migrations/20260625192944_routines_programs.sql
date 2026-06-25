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
