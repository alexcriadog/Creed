-- Documentos del atleta (informes/pautas de la nutricionista, analíticas) y
-- medidas corporales que reporta Whoop. Ambos alimentan al MCP de claude.ai.
-- Spec: docs/superpowers/specs/2026-09-20-creed-mcp-design.md §3

create table public.documents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  kind        text not null check (kind in ('nutri_report','nutri_plan','analitica','otro')),
  title       text not null,
  doc_date    date not null,
  text        text not null check (char_length(text) <= 50000),
  source_path text,                           -- opcional: fichero original en Storage
  created_at  timestamptz not null default now(),
  search      tsvector generated always as
                (to_tsvector('spanish', coalesce(title, '') || ' ' || coalesce(text, ''))) stored
);

comment on table public.documents is
  'Texto íntegro de documentos relevantes (nutri, analíticas). Búsqueda full-text en español vía columna search.';

create index documents_user_date on public.documents (user_id, doc_date desc);
create index documents_search on public.documents using gin (search);

alter table public.documents enable row level security;
create policy documents_self_select on public.documents for select using (user_id = auth.uid());
create policy documents_self_insert on public.documents for insert with check (user_id = auth.uid());
create policy documents_self_update on public.documents for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy documents_self_delete on public.documents for delete using (user_id = auth.uid());

create table public.whoop_body_measurements (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  height_m   numeric(4,2),
  weight_kg  numeric(5,2),
  max_hr     smallint,
  raw        jsonb not null,
  synced_at  timestamptz not null default now()
);

comment on table public.whoop_body_measurements is
  'Snapshot de GET /v2/user/measurement/body. Solo se inserta una fila cuando algún valor cambia.';

create index whoop_body_user_time on public.whoop_body_measurements (user_id, synced_at desc);

alter table public.whoop_body_measurements enable row level security;
-- Solo lectura para el usuario; escribe el sync con service role.
create policy whoop_body_self_select on public.whoop_body_measurements for select using (user_id = auth.uid());
