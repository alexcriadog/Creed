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
  notes               text,
  created_at          timestamptz not null default now()
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
