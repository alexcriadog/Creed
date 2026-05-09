-- Fase 5a: tablas para los agentes (chat, tool calls, agent notes).

create table conversations (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references profiles(id) on delete cascade,
  title             text,
  agent_role        text check (agent_role in
                     ('nutrition','training','general','mixed')),
  mode              text not null default 'normal'
                     check (mode in
                       ('normal','onboarding','lapse_recovery','weekly_close')),
  status            text not null default 'active'
                     check (status in ('active','closed','archived')),
  last_message_at   timestamptz not null default now(),
  created_at        timestamptz not null default now()
);
create index conversations_user_last_idx
  on conversations (user_id, last_message_at desc);
create index conversations_user_role_status_idx
  on conversations (user_id, agent_role, status);

alter table conversations enable row level security;
create policy conversations_self_select on conversations
  for select using (user_id = auth.uid());
create policy conversations_self_insert on conversations
  for insert with check (user_id = auth.uid());
create policy conversations_self_update on conversations
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create table messages (
  id                       uuid primary key default gen_random_uuid(),
  conversation_id          uuid not null references conversations(id) on delete cascade,
  user_id                  uuid not null references profiles(id) on delete cascade,
  turn                     smallint not null,
  role                     text not null
                            check (role in ('user','assistant','system','tool')),
  agent                    text check (agent in
                            ('nutritionist','trainer','orchestrator')),
  content                  text,
  tool_calls               jsonb,
  tool_call_id             text,
  model                    text,
  input_tokens             integer,
  output_tokens            integer,
  cache_read_tokens        integer,
  cache_creation_tokens    integer,
  status                   text not null default 'complete'
                            check (status in ('complete','partial','error')),
  created_at               timestamptz not null default now(),
  unique (conversation_id, turn)
);
create index messages_conversation_turn_idx
  on messages (conversation_id, turn asc);
create index messages_user_created_idx
  on messages (user_id, created_at desc);

alter table messages enable row level security;
create policy messages_self_select on messages
  for select using (user_id = auth.uid());

create table tool_calls (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references profiles(id) on delete cascade,
  conversation_id   uuid references conversations(id) on delete set null,
  message_id        uuid not null references messages(id) on delete cascade,
  tool_name         text not null,
  arguments         jsonb not null,
  result            jsonb,
  error             text,
  duration_ms       integer,
  created_at        timestamptz not null default now()
);
create index tool_calls_user_created_idx
  on tool_calls (user_id, created_at desc);
create index tool_calls_conversation_idx
  on tool_calls (conversation_id, created_at desc);

alter table tool_calls enable row level security;
create policy tool_calls_self_select on tool_calls
  for select using (user_id = auth.uid());

create table agent_notes (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references profiles(id) on delete cascade,
  agent             text not null check (agent in
                     ('nutritionist','trainer','orchestrator','system')),
  category          text not null,
  body              text not null,
  signal            jsonb,
  conversation_id   uuid references conversations(id) on delete set null,
  message_id        uuid references messages(id) on delete set null,
  created_at        timestamptz not null default now()
);
create index agent_notes_user_created_idx
  on agent_notes (user_id, created_at desc);
create index agent_notes_user_agent_idx
  on agent_notes (user_id, agent, created_at desc);

alter table agent_notes enable row level security;
create policy agent_notes_self_select on agent_notes
  for select using (user_id = auth.uid());
