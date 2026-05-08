-- Whoop API v2 returns UUIDs (text) for sleep + workout IDs (vs long in v1).
-- La migración inicial los puso bigint; los convertimos a text aquí.
-- Documented in https://developer.whoop.com/docs/developing/v1-v2-migration/
-- Safe: no production data yet en el momento de esta migración.

alter table public.whoop_sleep
  alter column whoop_id type text using whoop_id::text;

alter table public.whoop_workouts
  alter column whoop_id type text using whoop_id::text;

-- cycle_id en whoop_recovery sigue siendo bigint (cycles mantienen long IDs en v2).
-- whoop_cycles.whoop_id sigue siendo bigint (long en v2).
