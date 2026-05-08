-- Fase 4c: weekly_verdicts — output del cierre semanal computado.
create table weekly_verdicts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles(id) on delete cascade,
  week_start      date not null,
  status          text not null check (status in ('green','amber','red')),
  components      jsonb not null,
  coach_message   text,
  created_at      timestamptz not null default now(),
  unique (user_id, week_start)
);
create index weekly_verdicts_user_week_idx
  on weekly_verdicts (user_id, week_start desc);

alter table weekly_verdicts enable row level security;
create policy weekly_verdicts_self_select on weekly_verdicts
  for select using (user_id = auth.uid());
-- Insert only from service role (Edge Function / cron) — no policy for INSERT.
