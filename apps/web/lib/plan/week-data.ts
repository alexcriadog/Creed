/**
 * Lectura agrupada de datos de la semana para /plan.
 * Fetch único de sesiones, sets, comidas, peso, mood, hidratación.
 * Resultado se filtra client-side por día seleccionado para evitar refetch
 * en cada cambio de día.
 */
import { createSupabaseServerClient } from '@/lib/supabase/server';
export { mondayOf, isoDate, parseIsoDate } from './dates';
import { isoDate } from './dates';

export interface PlanSessionRow {
  id: string;
  scheduled_for: string;
  type: string | null;
  status: string;
  done_at: string | null;
  rpe: number | null;
  notes: string | null;
  prescribed: unknown;
  whoop_workout_id: string | null;
}

export interface PlanSetRow {
  id: string;
  session_id: string;
  exercise: string;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
  rpe: number | null;
  is_warmup: boolean;
}

export interface PlanMealRow {
  id: string;
  consumed_at: string;
  meal_type: string | null;
  raw_text: string;
  photo_path: string | null;
  total_calories: number | null;
  total_protein_g: number | null;
  total_carbs_g: number | null;
  total_fat_g: number | null;
  parser_confidence: number | null;
  user_corrected: boolean;
}

export interface PlanMeasurementRow {
  id: string;
  measured_at: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
}

export interface PlanMoodRow {
  id: string;
  logged_at: string;
  mood: number | null;
  energy: number | null;
}

export interface PlanHydrationRow {
  id: string;
  logged_at: string;
  amount_ml: number;
  source: string;
}

export interface WeekData {
  sessions: PlanSessionRow[];
  sets: PlanSetRow[];
  meals: PlanMealRow[];
  measurements: PlanMeasurementRow[];
  moods: PlanMoodRow[];
  hydration: PlanHydrationRow[];
  whoopStatus: 'connected' | 'expired' | 'revoked' | 'error' | null;
  whoopLastSyncedAt: string | null;
  hasActivePlan: boolean;
}

export async function fetchWeekData(monday: Date): Promise<WeekData | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  const startIso = monday.toISOString();
  const endIso = sunday.toISOString();
  const startDate = isoDate(monday);
  const endDate = isoDate(sunday);

  const [
    sessionsRes,
    mealsRes,
    measurementsRes,
    moodsRes,
    hydrationRes,
    whoopRes,
    activePlanRes,
  ] = await Promise.all([
    supabase
      .from('training_sessions')
      .select(
        'id, scheduled_for, type, status, done_at, rpe, notes, prescribed, whoop_workout_id',
      )
      .eq('user_id', user.id)
      .gte('scheduled_for', startDate)
      .lte('scheduled_for', endDate)
      .order('scheduled_for', { ascending: true }),
    supabase
      .from('meals')
      .select(
        'id, consumed_at, meal_type, raw_text, photo_path, total_calories, total_protein_g, total_carbs_g, total_fat_g, parser_confidence, user_corrected',
      )
      .eq('user_id', user.id)
      .gte('consumed_at', startIso)
      .lte('consumed_at', endIso)
      .order('consumed_at', { ascending: true }),
    supabase
      .from('body_measurements')
      .select('id, measured_at, weight_kg, body_fat_pct')
      .eq('user_id', user.id)
      .gte('measured_at', startIso)
      .lte('measured_at', endIso)
      .order('measured_at', { ascending: true }),
    supabase
      .from('mood_energy_log')
      .select('id, logged_at, mood, energy')
      .eq('user_id', user.id)
      .gte('logged_at', startIso)
      .lte('logged_at', endIso)
      .order('logged_at', { ascending: true }),
    supabase
      .from('hydration_log')
      .select('id, logged_at, amount_ml, source')
      .eq('user_id', user.id)
      .gte('logged_at', startIso)
      .lte('logged_at', endIso)
      .order('logged_at', { ascending: true }),
    supabase
      .from('whoop_connections')
      .select('status, last_synced_at')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('training_plans')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle(),
  ]);

  const sessions = (sessionsRes.data ?? []) as PlanSessionRow[];
  const sessionIds = sessions.map((s) => s.id);

  let sets: PlanSetRow[] = [];
  if (sessionIds.length > 0) {
    const { data: setsData } = await supabase
      .from('training_sets')
      .select('id, session_id, exercise, set_number, reps, weight_kg, rpe, is_warmup')
      .in('session_id', sessionIds)
      .order('set_number', { ascending: true });
    sets = (setsData ?? []) as PlanSetRow[];
  }

  return {
    sessions,
    sets,
    meals: (mealsRes.data ?? []) as PlanMealRow[],
    measurements: (measurementsRes.data ?? []) as PlanMeasurementRow[],
    moods: (moodsRes.data ?? []) as PlanMoodRow[],
    hydration: (hydrationRes.data ?? []) as PlanHydrationRow[],
    whoopStatus: (whoopRes.data?.status as WeekData['whoopStatus']) ?? null,
    whoopLastSyncedAt: whoopRes.data?.last_synced_at ?? null,
    hasActivePlan: !!activePlanRes.data?.id,
  };
}
