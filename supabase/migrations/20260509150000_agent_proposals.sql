-- Fase 5b: agent_proposals — coaches proponen, atleta acepta/rechaza.

create table agent_proposals (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles(id) on delete cascade,
  conversation_id uuid references conversations(id) on delete set null,
  message_id      uuid references messages(id) on delete set null,
  agent           text not null check (agent in
                   ('nutritionist','trainer','orchestrator')),
  proposal_type   text not null check (proposal_type in
                   ('training_session','meal_target','weight_target')),
  payload         jsonb not null,
  rationale       text,
  status          text not null default 'pending'
                   check (status in ('pending','accepted','rejected')),
  created_at      timestamptz not null default now(),
  responded_at    timestamptz,
  applied_to_id   uuid
);

create index agent_proposals_user_status_idx
  on agent_proposals (user_id, status, created_at desc);
create index agent_proposals_conversation_idx
  on agent_proposals (conversation_id, created_at asc);
create index agent_proposals_message_idx
  on agent_proposals (message_id);

alter table agent_proposals enable row level security;

create policy agent_proposals_self_select on agent_proposals
  for select using (user_id = auth.uid());

create policy agent_proposals_self_update on agent_proposals
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- INSERT only via service role (runner del coach).

comment on column agent_proposals.payload is
  'Estructura concreta de la propuesta. Para training_session: {scheduled_for, type, prescribed:{blocks:[{name,exercises:[{name,sets,reps,rpe,rest_s,notes}]}]}}. Para meal_target: {daily_calories, daily_protein_g, daily_carbs_g, daily_fat_g, hydration_l}. Para weight_target: {target_weight_kg, target_date}.';
