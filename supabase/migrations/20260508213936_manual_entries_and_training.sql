-- Fase 4a: Tablas para registro manual + entrenamiento.
-- meals, body_measurements, hydration_log, mood_energy_log,
-- training_plans, training_sessions, training_sets.
-- Todas con RLS por user_id (igual patrón que whoop_*).

-- ------------------------------------------------------------------
-- 6.1 body_measurements
-- ------------------------------------------------------------------
create table body_measurements (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  measured_at   timestamptz not null,
  weight_kg     numeric(5,2) check (weight_kg > 0),
  body_fat_pct  numeric(4,1) check (body_fat_pct between 0 and 70),
  waist_cm      numeric(5,1),
  hip_cm        numeric(5,1),
  chest_cm      numeric(5,1),
  arm_cm        numeric(5,1),
  thigh_cm      numeric(5,1),
  notes         text,
  created_at    timestamptz not null default now()
);
create index body_measurements_user_measured_idx
  on body_measurements (user_id, measured_at desc);

alter table body_measurements enable row level security;
create policy body_measurements_self_select on body_measurements
  for select using (user_id = auth.uid());
create policy body_measurements_self_insert on body_measurements
  for insert with check (user_id = auth.uid());
create policy body_measurements_self_update on body_measurements
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy body_measurements_self_delete on body_measurements
  for delete using (user_id = auth.uid());

-- ------------------------------------------------------------------
-- 6.2 meals
-- ------------------------------------------------------------------
create table meals (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references profiles(id) on delete cascade,
  consumed_at         timestamptz not null,
  meal_type           text check (meal_type in
                       ('breakfast','lunch','dinner','snack','other')),
  raw_text            text not null,
  parsed              jsonb,
  total_calories      integer,
  total_protein_g     numeric(5,1),
  total_carbs_g       numeric(5,1),
  total_fat_g         numeric(5,1),
  parser_confidence   numeric(3,2) check (parser_confidence between 0 and 1),
  parser_version      text,
  user_corrected      boolean not null default false,
  photo_path          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index meals_user_consumed_idx on meals (user_id, consumed_at desc);
create index meals_user_day_idx
  on meals (user_id, ((consumed_at AT TIME ZONE 'UTC')::date));

alter table meals enable row level security;
create policy meals_self_select on meals
  for select using (user_id = auth.uid());
create policy meals_self_insert on meals
  for insert with check (user_id = auth.uid());
create policy meals_self_update on meals
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy meals_self_delete on meals
  for delete using (user_id = auth.uid());

-- ------------------------------------------------------------------
-- 6.3 hydration_log
-- ------------------------------------------------------------------
create table hydration_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  logged_at   timestamptz not null,
  amount_ml   integer not null check (amount_ml > 0),
  source      text not null default 'water'
               check (source in ('water','coffee','tea','sports_drink','other')),
  created_at  timestamptz not null default now()
);
create index hydration_log_user_logged_idx
  on hydration_log (user_id, logged_at desc);

alter table hydration_log enable row level security;
create policy hydration_log_self_select on hydration_log
  for select using (user_id = auth.uid());
create policy hydration_log_self_insert on hydration_log
  for insert with check (user_id = auth.uid());
create policy hydration_log_self_update on hydration_log
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy hydration_log_self_delete on hydration_log
  for delete using (user_id = auth.uid());

-- ------------------------------------------------------------------
-- 6.4 mood_energy_log
-- ------------------------------------------------------------------
create table mood_energy_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  logged_at   timestamptz not null,
  mood        smallint check (mood between 1 and 5),
  energy      smallint check (energy between 1 and 5),
  notes       text,
  created_at  timestamptz not null default now()
);
create index mood_energy_log_user_logged_idx
  on mood_energy_log (user_id, logged_at desc);

alter table mood_energy_log enable row level security;
create policy mood_energy_log_self_select on mood_energy_log
  for select using (user_id = auth.uid());
create policy mood_energy_log_self_insert on mood_energy_log
  for insert with check (user_id = auth.uid());
create policy mood_energy_log_self_update on mood_energy_log
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy mood_energy_log_self_delete on mood_energy_log
  for delete using (user_id = auth.uid());

-- ------------------------------------------------------------------
-- 7.1 training_plans
-- ------------------------------------------------------------------
create table training_plans (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references profiles(id) on delete cascade,
  week_start          date not null,
  goal                text,
  rationale           text,
  generated_by        text not null default 'manual'
                       check (generated_by in ('trainer_agent','manual')),
  generator_version   text,
  status              text not null default 'active'
                       check (status in ('draft','active','superseded','archived')),
  created_at          timestamptz not null default now(),
  unique (user_id, week_start, status)
);
create index training_plans_user_week_idx
  on training_plans (user_id, week_start desc);

alter table training_plans enable row level security;
create policy training_plans_self_select on training_plans
  for select using (user_id = auth.uid());
create policy training_plans_self_insert on training_plans
  for insert with check (user_id = auth.uid());
create policy training_plans_self_update on training_plans
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy training_plans_self_delete on training_plans
  for delete using (user_id = auth.uid());

-- ------------------------------------------------------------------
-- 7.2 training_sessions
-- ------------------------------------------------------------------
create table training_sessions (
  id              uuid primary key default gen_random_uuid(),
  plan_id         uuid references training_plans(id) on delete cascade,
  user_id         uuid not null references profiles(id) on delete cascade,
  scheduled_for   date not null,
  type            text,
  prescribed      jsonb,
  status          text not null default 'scheduled'
                   check (status in ('scheduled','done','skipped','partial')),
  done_at         timestamptz,
  rpe             smallint check (rpe between 1 and 10),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index training_sessions_user_scheduled_idx
  on training_sessions (user_id, scheduled_for desc);
create index training_sessions_user_status_idx
  on training_sessions (user_id, status);

alter table training_sessions enable row level security;
create policy training_sessions_self_select on training_sessions
  for select using (user_id = auth.uid());
create policy training_sessions_self_insert on training_sessions
  for insert with check (user_id = auth.uid());
create policy training_sessions_self_update on training_sessions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy training_sessions_self_delete on training_sessions
  for delete using (user_id = auth.uid());

-- ------------------------------------------------------------------
-- 7.3 training_sets
-- ------------------------------------------------------------------
create table training_sets (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references training_sessions(id) on delete cascade,
  user_id       uuid not null references profiles(id) on delete cascade,
  exercise      text not null,
  set_number    smallint not null check (set_number > 0),
  reps          smallint check (reps > 0),
  weight_kg     numeric(6,2),
  rpe           smallint check (rpe between 1 and 10),
  is_warmup     boolean not null default false,
  notes         text,
  performed_at  timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
create index training_sets_session_idx on training_sets (session_id, set_number);
create index training_sets_user_performed_idx
  on training_sets (user_id, performed_at desc);

alter table training_sets enable row level security;
create policy training_sets_self_select on training_sets
  for select using (user_id = auth.uid());
create policy training_sets_self_insert on training_sets
  for insert with check (user_id = auth.uid());
create policy training_sets_self_update on training_sets
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy training_sets_self_delete on training_sets
  for delete using (user_id = auth.uid());

-- ------------------------------------------------------------------
-- updated_at triggers (meals + training_sessions)
-- ------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger meals_set_updated_at
  before update on meals
  for each row execute function public.set_updated_at();

create trigger training_sessions_set_updated_at
  before update on training_sessions
  for each row execute function public.set_updated_at();
