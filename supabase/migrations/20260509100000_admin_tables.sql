-- Fase 7 (anticipado): tablas operacionales del panel admin.
-- Source: docs/03-data-model.md §14b + docs/05-agents.md §17.

-- Helper: ¿el usuario actual es admin?
create or replace function public.is_admin()
returns boolean
language sql stable
as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid()),
    false
  );
$$;

-- ------------------------------------------------------------------
-- 14b.1 prompt_versions
-- ------------------------------------------------------------------
create table prompt_versions (
  id           uuid primary key default gen_random_uuid(),
  agent        text not null check (agent in
                ('nutritionist','trainer','orchestrator','onboarding','weekly_plan')),
  version      integer not null,
  content      text not null,
  active       boolean not null default false,
  created_at   timestamptz not null default now(),
  created_by   uuid references profiles(id) on delete set null,
  unique (agent, version)
);
create unique index prompt_versions_one_active_per_agent
  on prompt_versions (agent) where active;

alter table prompt_versions enable row level security;
create policy prompt_versions_admin_select on prompt_versions
  for select using (public.is_admin());
create policy prompt_versions_admin_insert on prompt_versions
  for insert with check (public.is_admin());
create policy prompt_versions_admin_update on prompt_versions
  for update using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------------
-- 14b.2 model_assignments
-- ------------------------------------------------------------------
create table model_assignments (
  flow         text primary key check (flow in
                ('nutritionist_chat','trainer_chat','orchestrator',
                 'onboarding','lapse_recovery','weekly_close',
                 'weekly_plan','meal_parser','conversation_compactor')),
  model        text not null,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references profiles(id) on delete set null
);

alter table model_assignments enable row level security;
create policy model_assignments_admin_select on model_assignments
  for select using (public.is_admin());
create policy model_assignments_admin_update on model_assignments
  for update using (public.is_admin()) with check (public.is_admin());
create policy model_assignments_admin_insert on model_assignments
  for insert with check (public.is_admin());

insert into model_assignments (flow, model) values
  ('nutritionist_chat',       'claude-sonnet-4-6'),
  ('trainer_chat',            'claude-sonnet-4-6'),
  ('orchestrator',            'llama-3.1-8b-instant'),
  ('onboarding',              'claude-sonnet-4-6'),
  ('lapse_recovery',          'claude-sonnet-4-6'),
  ('weekly_close',            'claude-sonnet-4-6'),
  ('weekly_plan',             'claude-sonnet-4-6'),
  ('meal_parser',             'llama-3.3-70b-versatile'),
  ('conversation_compactor',  'llama-3.3-70b-versatile');

-- ------------------------------------------------------------------
-- 14b.3 cost_limits
-- ------------------------------------------------------------------
create table cost_limits (
  service             text primary key check (service in ('anthropic','whoop','groq')),
  monthly_cap_eur     numeric(10,2) not null,
  alarm_threshold_pct smallint not null default 80
                       check (alarm_threshold_pct between 1 and 100),
  pause_at_cap        boolean not null default false,
  updated_at          timestamptz not null default now(),
  updated_by          uuid references profiles(id) on delete set null
);

alter table cost_limits enable row level security;
create policy cost_limits_admin_select on cost_limits
  for select using (public.is_admin());
create policy cost_limits_admin_update on cost_limits
  for update using (public.is_admin()) with check (public.is_admin());
create policy cost_limits_admin_insert on cost_limits
  for insert with check (public.is_admin());

insert into cost_limits (service, monthly_cap_eur, alarm_threshold_pct, pause_at_cap) values
  ('anthropic', 30.00, 80, false),
  ('groq',       5.00, 80, false),
  ('whoop',      0.00, 80, false);

-- ------------------------------------------------------------------
-- 14b.4 app_settings
-- ------------------------------------------------------------------
create table app_settings (
  key          text primary key,
  value        jsonb not null,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references profiles(id) on delete set null
);

alter table app_settings enable row level security;
create policy app_settings_admin_select on app_settings
  for select using (public.is_admin());
create policy app_settings_admin_update on app_settings
  for update using (public.is_admin()) with check (public.is_admin());
create policy app_settings_admin_insert on app_settings
  for insert with check (public.is_admin());

insert into app_settings (key, value) values
  ('recovery_green_min',                   '67'::jsonb),
  ('recovery_red_max',                     '33'::jsonb),
  ('adherence_meals_green_min',            '70'::jsonb),
  ('adherence_meals_red_max',              '40'::jsonb),
  ('adherence_training_green_min',         '80'::jsonb),
  ('adherence_training_red_max',           '40'::jsonb),
  ('weight_trend_window_days',             '14'::jsonb),
  ('weight_trend_red_streak_days',         '7'::jsonb),
  ('cal_floor_female',                     '1200'::jsonb),
  ('cal_floor_male',                       '1500'::jsonb),
  ('conversation_compact_threshold_turns', '30'::jsonb),
  ('eval_pass_threshold_pct',              '93'::jsonb),
  ('meals_per_day_target',                 '4'::jsonb),
  ('trainings_per_week_target',            '4'::jsonb);

-- ------------------------------------------------------------------
-- Audit trigger: cualquier UPDATE en estas 4 tablas → audit_log
-- ------------------------------------------------------------------
create or replace function public.admin_settings_audit()
returns trigger
language plpgsql
security definer
as $$
declare
  pk_value text;
begin
  pk_value := case TG_TABLE_NAME
    when 'app_settings' then NEW.key
    when 'model_assignments' then NEW.flow
    when 'cost_limits' then NEW.service
    when 'prompt_versions' then NEW.id::text
    else 'unknown'
  end;

  insert into audit_log (user_id, action, metadata)
  values (
    auth.uid(),
    'admin_setting_changed',
    jsonb_build_object(
      'table', TG_TABLE_NAME,
      'key',   pk_value,
      'old',   to_jsonb(OLD),
      'new',   to_jsonb(NEW)
    )
  );
  return NEW;
end;
$$;

create trigger app_settings_audit_trg
  after update on app_settings
  for each row execute function public.admin_settings_audit();

create trigger model_assignments_audit_trg
  after update on model_assignments
  for each row execute function public.admin_settings_audit();

create trigger cost_limits_audit_trg
  after update on cost_limits
  for each row execute function public.admin_settings_audit();

create trigger prompt_versions_audit_trg
  after update on prompt_versions
  for each row execute function public.admin_settings_audit();
