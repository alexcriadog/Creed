-- Compactación de conversaciones largas. Una summary por conversación.
-- Cuando una conversación supera N turnos, un job en background genera la
-- summary de los turnos más antiguos para no reenviar todo al LLM cada vez.

create table conversation_summaries (
  conversation_id     uuid primary key references conversations(id) on delete cascade,
  user_id             uuid not null references profiles(id) on delete cascade,
  summary             text not null,
  last_compacted_turn integer not null,
  model               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index conversation_summaries_user_idx
  on conversation_summaries (user_id, updated_at desc);

alter table conversation_summaries enable row level security;

create policy conversation_summaries_self_select on conversation_summaries
  for select using (user_id = auth.uid());

-- INSERT/UPDATE only via service role (runner background job).

comment on column conversation_summaries.last_compacted_turn is
  'Turn más reciente incluido en la summary. loadHistory filtra messages.turn > last_compacted_turn.';
