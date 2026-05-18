-- training_sessions: convertir índice único parcial en full unique para que
-- el upsert ON CONFLICT (user_id, whoop_workout_id) de syncWhoop pueda
-- inferirlo. PostgreSQL no infiere índices parciales sin repetir el predicado,
-- y el cliente Supabase JS no expone esa opción.
--
-- Las sesiones manuales (whoop_workout_id IS NULL) siguen sin chocar entre sí
-- porque PostgreSQL trata cada NULL como distinto por defecto (NULLS DISTINCT).

drop index if exists training_sessions_user_whoop_workout_unique;

create unique index training_sessions_user_whoop_workout_unique
  on training_sessions (user_id, whoop_workout_id);
