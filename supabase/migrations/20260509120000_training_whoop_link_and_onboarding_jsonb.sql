-- 1. training_sessions: vincular sesiones a workouts de Whoop
alter table training_sessions
  add column if not exists whoop_workout_id text;

create index if not exists training_sessions_whoop_workout_idx
  on training_sessions (whoop_workout_id) where whoop_workout_id is not null;

-- Garantiza unicidad por user+whoop_workout_id (idempotencia en sync)
create unique index if not exists training_sessions_user_whoop_workout_unique
  on training_sessions (user_id, whoop_workout_id) where whoop_workout_id is not null;

-- 2. athlete_folder: campos para onboarding por coach
alter table athlete_folder
  add column if not exists nutrition_onboarding_completed_at timestamptz,
  add column if not exists training_onboarding_completed_at  timestamptz,
  add column if not exists nutrition jsonb not null default '{}'::jsonb,
  add column if not exists training  jsonb not null default '{}'::jsonb;

comment on column athlete_folder.nutrition is
  'Respuestas del cuestionario de nutrición (objetivo, restricciones, hábitos, suplementos).';
comment on column athlete_folder.training is
  'Respuestas del cuestionario de entrenamiento (años, días/semana, lesiones, nivel).';
