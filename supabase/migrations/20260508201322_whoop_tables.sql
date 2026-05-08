-- Migration: tablas Whoop (whoop_connections + 4 tablas de datos) + RLS
-- Source of truth: docs/03-data-model.md §5, docs/04-whoop-integration.md §6,9,10
-- 
-- NOTA sobre cifrado de tokens:
-- Originalmente planteamos pgsodium + Vault (docs/04 §7). Para MVP simplificamos
-- a cifrado AES-256-GCM en TypeScript con WHOOP_TOKEN_ENCRYPTION_KEY env var.
-- Las tablas guardan los tokens como bytea ya cifrados desde el código.
-- En V1 podemos migrar a pgsodium si crece el uso.

-- ============================================================
-- whoop_connections (1:1 con profiles)
-- ============================================================
create table public.whoop_connections (
  user_id                  uuid primary key references public.profiles(id) on delete cascade,
  whoop_user_id            text not null unique,
  access_token_encrypted   bytea not null,
  refresh_token_encrypted  bytea not null,
  expires_at               timestamptz not null,
  scopes                   text[] not null,
  status                   text not null default 'connected'
                            check (status in ('connected','expired','revoked','error')),
  last_synced_at           timestamptz,
  last_error               text,
  connected_at             timestamptz not null default now()
);

alter table public.whoop_connections enable row level security;

-- Sólo lectura del dueño. Sin INSERT/UPDATE/DELETE para anon/authenticated:
-- los Route Handlers / Edge Functions usan service_role.
create policy whoop_connections_select_own on public.whoop_connections for select
  using (auth.uid() = user_id);

-- ============================================================
-- whoop_cycles
-- ============================================================
create table public.whoop_cycles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  whoop_id    bigint not null,
  start_at    timestamptz not null,
  end_at      timestamptz,
  strain      numeric(4,2) check (strain between 0 and 21),
  avg_hr      smallint,
  max_hr      smallint,
  raw         jsonb not null,
  synced_at   timestamptz not null default now(),
  unique (user_id, whoop_id)
);

create index whoop_cycles_user_start_idx on public.whoop_cycles (user_id, start_at desc);

alter table public.whoop_cycles enable row level security;
create policy whoop_cycles_select_own on public.whoop_cycles for select
  using (auth.uid() = user_id);

-- ============================================================
-- whoop_recovery
-- ============================================================
create table public.whoop_recovery (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.profiles(id) on delete cascade,
  cycle_whoop_id       bigint not null,
  date                 date not null,
  score                smallint check (score between 0 and 100),
  resting_heart_rate   smallint,
  hrv_rmssd_milli      numeric(6,2),
  spo2_pct             numeric(4,1),
  skin_temp_celsius    numeric(4,2),
  raw                  jsonb not null,
  synced_at            timestamptz not null default now(),
  unique (user_id, cycle_whoop_id)
);

create index whoop_recovery_user_date_idx on public.whoop_recovery (user_id, date desc);

alter table public.whoop_recovery enable row level security;
create policy whoop_recovery_select_own on public.whoop_recovery for select
  using (auth.uid() = user_id);

-- ============================================================
-- whoop_sleep
-- ============================================================
create table public.whoop_sleep (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     uuid not null references public.profiles(id) on delete cascade,
  whoop_id                    bigint not null,
  start_at                    timestamptz not null,
  end_at                      timestamptz not null,
  duration_in_bed_minutes     integer,
  sleep_minutes               integer,
  rem_minutes                 integer,
  deep_minutes                integer,
  light_minutes               integer,
  awake_minutes               integer,
  efficiency_pct              numeric(4,1),
  needed_minutes              integer,
  is_nap                      boolean default false,
  raw                         jsonb not null,
  synced_at                   timestamptz not null default now(),
  unique (user_id, whoop_id)
);

create index whoop_sleep_user_start_idx on public.whoop_sleep (user_id, start_at desc);

alter table public.whoop_sleep enable row level security;
create policy whoop_sleep_select_own on public.whoop_sleep for select
  using (auth.uid() = user_id);

-- ============================================================
-- whoop_workouts
-- ============================================================
create table public.whoop_workouts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  whoop_id        bigint not null,
  sport           text,
  start_at        timestamptz not null,
  end_at          timestamptz not null,
  strain          numeric(4,2),
  avg_hr          smallint,
  max_hr          smallint,
  kilojoule       numeric(8,2),
  distance_meters numeric(8,1),
  raw             jsonb not null,
  synced_at       timestamptz not null default now(),
  unique (user_id, whoop_id)
);

create index whoop_workouts_user_start_idx on public.whoop_workouts (user_id, start_at desc);

alter table public.whoop_workouts enable row level security;
create policy whoop_workouts_select_own on public.whoop_workouts for select
  using (auth.uid() = user_id);

-- ============================================================
-- Comments
-- ============================================================
comment on table public.whoop_connections is 'OAuth tokens cifrados (AES-256-GCM en TS) + estado de sync.';
comment on column public.whoop_connections.access_token_encrypted is 'AES-256-GCM con WHOOP_TOKEN_ENCRYPTION_KEY. Formato: iv(12) || tag(16) || ciphertext.';
comment on table public.whoop_cycles is 'Ciclos diarios Whoop (~24h, definido por Whoop). raw guarda payload original.';
comment on table public.whoop_recovery is 'Score de recovery 0-100 + HRV + RHR + SpO2 + temp piel.';
comment on table public.whoop_sleep is 'Sesiones de sueño (incluye siestas si is_nap).';
comment on table public.whoop_workouts is 'Workouts detectados o marcados por el atleta.';
