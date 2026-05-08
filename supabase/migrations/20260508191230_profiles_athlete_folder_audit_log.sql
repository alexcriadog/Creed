-- Migration: profiles + athlete_folder + audit_log + RLS + triggers
-- Source of truth: docs/03-data-model.md §4 (identidad), §9.3 (audit_log)
-- Conventions: docs/03-data-model.md §2

-- ============================================================
-- Helper: updated_at trigger
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- profiles — extiende auth.users
-- ============================================================
create table public.profiles (
  id                      uuid primary key references auth.users(id) on delete cascade,
  display_name            text not null,
  timezone                text not null default 'Europe/Madrid',
  locale                  text not null default 'es' check (locale in ('es','en')),
  sex                     text check (sex in ('male','female','other')),
  date_of_birth           date,
  height_cm               numeric(5,1) check (height_cm > 0),
  notification_channel    text not null default 'email'
                           check (notification_channel in ('push','email','none')),
  notification_hour       smallint not null default 21
                           check (notification_hour between 0 and 23),
  push_endpoint           jsonb,
  onboarding_status       text not null default 'pending'
                           check (onboarding_status in ('pending','in_progress','complete')),
  role                    text not null default 'athlete'
                           check (role in ('athlete','admin')),
  consents                jsonb not null default '{}'::jsonb,
  deletion_requested_at   timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy profiles_select_own on public.profiles for select
  using (auth.uid() = id);

create policy profiles_update_own on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- INSERT/DELETE solo desde service_role (trigger auth.users + cascade del delete user)
-- Sin política → bloqueado para anon/authenticated.

-- ============================================================
-- athlete_folder — memoria estructurada del atleta (1:1 con profiles)
-- ============================================================
create table public.athlete_folder (
  user_id                 uuid primary key references public.profiles(id) on delete cascade,
  primary_objective       text check (primary_objective in
                           ('lose_fat','build_muscle','build_strength','recomp','maintain')),
  secondary_objectives    text[] not null default '{}',
  baseline_weight_kg      numeric(5,2),
  baseline_body_fat_pct   numeric(4,1),
  target_weight_kg        numeric(5,2),
  target_date             date,
  restrictions            jsonb not null default '{}'::jsonb,
  equipment               jsonb not null default '{}'::jsonb,
  schedule                jsonb not null default '{}'::jsonb,
  notes_summary           text,
  version                 integer not null default 1,
  initialized_at          timestamptz,
  updated_at              timestamptz not null default now()
);

-- Auto-bump version on any update
create or replace function public.athlete_folder_bump_version()
returns trigger
language plpgsql
as $$
begin
  new.version = old.version + 1;
  new.updated_at = now();
  return new;
end;
$$;

create trigger athlete_folder_bump_version
  before update on public.athlete_folder
  for each row
  execute function public.athlete_folder_bump_version();

alter table public.athlete_folder enable row level security;

create policy athlete_folder_select_own on public.athlete_folder for select
  using (auth.uid() = user_id);

create policy athlete_folder_update_own on public.athlete_folder for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- audit_log — eventos sensibles
-- ============================================================
create table public.audit_log (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references public.profiles(id) on delete set null,
  action       text not null,
  metadata     jsonb,
  ip           inet,
  user_agent   text,
  created_at   timestamptz not null default now()
);

create index audit_log_user_id_created_at_idx
  on public.audit_log (user_id, created_at desc);

create index audit_log_action_created_at_idx
  on public.audit_log (action, created_at desc);

alter table public.audit_log enable row level security;

create policy audit_log_select_own on public.audit_log for select
  using (auth.uid() = user_id);

-- INSERT solo desde service_role (no política → bloqueado).

-- ============================================================
-- Trigger: auto-crear profiles + athlete_folder al crear auth.users
-- ============================================================
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  -- Crear profiles con display_name = parte local del email por defecto.
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(split_part(new.email, '@', 1), 'atleta')
  );

  -- Crear athlete_folder vacío (1:1 con profiles).
  insert into public.athlete_folder (user_id)
  values (new.id);

  -- Audit
  insert into public.audit_log (user_id, action, metadata)
  values (new.id, 'account_created', jsonb_build_object('email_domain', split_part(new.email, '@', 2)));

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_auth_user();

-- ============================================================
-- Comments
-- ============================================================
comment on table public.profiles is 'Perfil del atleta. 1:1 con auth.users.';
comment on column public.profiles.role is 'athlete (default) o admin (concedido manualmente con UPDATE SQL).';
comment on column public.profiles.consents is 'Mapa de consentimientos (privacy_policy_v1, anthropic_processing, etc.) → ISO timestamp de aceptación.';

comment on table public.athlete_folder is 'Memoria estructurada compartida por los dos coaches sobre el mismo atleta.';
comment on column public.athlete_folder.version is 'Auto-incrementado en cada UPDATE vía trigger.';

comment on table public.audit_log is 'Eventos sensibles (account_created, account_deleted, admin_setting_changed, admin_read_conversation, etc.). Inserts solo desde service_role.';
