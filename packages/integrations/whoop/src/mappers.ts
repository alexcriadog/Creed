import type { WhoopCycle, WhoopRecovery, WhoopSleep, WhoopWorkout } from './client';

const milliToMinutes = (ms: number | undefined): number | null =>
  ms !== undefined ? Math.round(ms / 60000) : null;

export interface CycleRow {
  whoop_id: number;
  start_at: string;
  end_at: string | null;
  strain: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  raw: unknown;
}

export function cycleToRow(cycle: WhoopCycle): CycleRow {
  return {
    whoop_id: Number(cycle.id),
    start_at: cycle.start,
    end_at: cycle.end ?? null,
    strain: cycle.score?.strain ?? null,
    avg_hr: cycle.score?.average_heart_rate ?? null,
    max_hr: cycle.score?.max_heart_rate ?? null,
    raw: cycle,
  };
}

export interface RecoveryRow {
  cycle_whoop_id: number;
  date: string; // YYYY-MM-DD
  score: number | null;
  resting_heart_rate: number | null;
  hrv_rmssd_milli: number | null;
  spo2_pct: number | null;
  skin_temp_celsius: number | null;
  raw: unknown;
}

export function recoveryToRow(rec: WhoopRecovery): RecoveryRow {
  // Whoop recovery created_at is the timestamp; date is the calendar day
  const date = (rec.created_at ?? new Date().toISOString()).slice(0, 10);
  return {
    cycle_whoop_id: Number(rec.cycle_id),
    date,
    score: rec.score?.recovery_score ?? null,
    resting_heart_rate: rec.score?.resting_heart_rate ?? null,
    hrv_rmssd_milli: rec.score?.hrv_rmssd_milli ?? null,
    spo2_pct: rec.score?.spo2_percentage ?? null,
    skin_temp_celsius: rec.score?.skin_temp_celsius ?? null,
    raw: rec,
  };
}

export interface SleepRow {
  whoop_id: number;
  start_at: string;
  end_at: string;
  duration_in_bed_minutes: number | null;
  rem_minutes: number | null;
  deep_minutes: number | null;
  light_minutes: number | null;
  awake_minutes: number | null;
  efficiency_pct: number | null;
  needed_minutes: number | null;
  is_nap: boolean;
  raw: unknown;
}

export function sleepToRow(s: WhoopSleep): SleepRow {
  const stage = s.score?.stage_summary;
  return {
    whoop_id: Number(s.id),
    start_at: s.start,
    end_at: s.end,
    duration_in_bed_minutes: milliToMinutes(stage?.total_in_bed_time_milli),
    rem_minutes: milliToMinutes(stage?.total_rem_sleep_time_milli),
    deep_minutes: milliToMinutes(stage?.total_slow_wave_sleep_time_milli),
    light_minutes: milliToMinutes(stage?.total_light_sleep_time_milli),
    awake_minutes: milliToMinutes(stage?.total_awake_time_milli),
    efficiency_pct: s.score?.sleep_efficiency_percentage ?? null,
    needed_minutes: milliToMinutes(s.score?.sleep_needed?.baseline_milli),
    is_nap: s.nap ?? false,
    raw: s,
  };
}

export interface WorkoutRow {
  whoop_id: number;
  sport: string | null;
  start_at: string;
  end_at: string;
  strain: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  kilojoule: number | null;
  distance_meters: number | null;
  raw: unknown;
}

export function workoutToRow(w: WhoopWorkout): WorkoutRow {
  return {
    whoop_id: Number(w.id),
    sport: w.sport_name ?? (w.sport_id !== undefined ? `sport_${w.sport_id}` : null),
    start_at: w.start,
    end_at: w.end,
    strain: w.score?.strain ?? null,
    avg_hr: w.score?.average_heart_rate ?? null,
    max_hr: w.score?.max_heart_rate ?? null,
    kilojoule: w.score?.kilojoule ?? null,
    distance_meters: w.score?.distance_meter ?? null,
    raw: w,
  };
}
