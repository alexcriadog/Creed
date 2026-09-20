import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, adminClient, type TestUser } from '../test-utils';
import type { McpContext } from '../types';
import { getWhoopSummaryTool, isoWeek } from './get-whoop-summary';
import { getDailyBriefingTool } from './get-daily-briefing';
import { logMealTool } from './log-meal';
import { logWorkoutTool } from './log-workout';
import { logMeasurementTool } from './log-measurement';
import { setProgramTool } from './set-program';

let u: TestUser;
const ctx = (): McpContext => ({ supabase: u.supabase, userId: u.id, now: new Date('2026-09-20T10:00:00Z') });

beforeAll(async () => {
  u = await createTestUser();
  const admin = adminClient();
  await admin.from('whoop_cycles').insert([
    { user_id: u.id, whoop_id: 1, start_at: '2026-09-17T22:00:00Z', end_at: '2026-09-18T22:00:00Z', strain: 8.0, avg_hr: 68, max_hr: 150, raw: {} },
    { user_id: u.id, whoop_id: 2, start_at: '2026-09-18T22:00:00Z', end_at: '2026-09-19T22:00:00Z', strain: 12.3, avg_hr: 70, max_hr: 160, raw: {} },
    { user_id: u.id, whoop_id: 3, start_at: '2026-09-19T22:00:00Z', end_at: null, strain: 5.1, avg_hr: 65, max_hr: 120, raw: {} },
  ]);
  await admin.from('whoop_recovery').insert([
    { user_id: u.id, cycle_whoop_id: 1, date: '2026-09-18', score: 40, resting_heart_rate: 55, hrv_rmssd_milli: 50, raw: {} },
    { user_id: u.id, cycle_whoop_id: 2, date: '2026-09-19', score: 60, resting_heart_rate: 52, hrv_rmssd_milli: 70, raw: { score: { spo2_percentage: 97 } } },
    { user_id: u.id, cycle_whoop_id: 3, date: '2026-09-20', score: 80, resting_heart_rate: 50, hrv_rmssd_milli: 90, skin_temp_celsius: 33.4, raw: { score: { spo2_percentage: 98 } } },
  ]);
  await admin.from('whoop_sleep').insert([
    { user_id: u.id, whoop_id: 's1', start_at: '2026-09-18T22:30:00Z', end_at: '2026-09-19T06:30:00Z', duration_in_bed_minutes: 480, sleep_minutes: 400, rem_minutes: 90, deep_minutes: 80, light_minutes: 230, awake_minutes: 80, efficiency_pct: 83.3, needed_minutes: 470, is_nap: false, raw: {} },
    { user_id: u.id, whoop_id: 's2', start_at: '2026-09-19T22:30:00Z', end_at: '2026-09-20T06:30:00Z', duration_in_bed_minutes: 480, sleep_minutes: 430, rem_minutes: 90, deep_minutes: 80, light_minutes: 260, awake_minutes: 50, efficiency_pct: 89.6, needed_minutes: 470, is_nap: false, raw: { score: { sleep_performance_percentage: 91 } } },
    { user_id: u.id, whoop_id: 's3', start_at: '2026-09-20T13:00:00Z', end_at: '2026-09-20T13:30:00Z', duration_in_bed_minutes: 30, sleep_minutes: 25, rem_minutes: 0, deep_minutes: 5, light_minutes: 20, awake_minutes: 5, efficiency_pct: 83, needed_minutes: null, is_nap: true, raw: {} },
  ]);
  await admin.from('whoop_workouts').insert([
    { user_id: u.id, whoop_id: 'w1', sport: 'weightlifting', start_at: '2026-09-19T16:00:00Z', end_at: '2026-09-19T17:00:00Z', strain: 9.8, avg_hr: 120, max_hr: 160, raw: {} },
    { user_id: u.id, whoop_id: 'w2', sport: 'running', start_at: '2026-09-20T07:00:00Z', end_at: '2026-09-20T07:40:00Z', strain: 7.5, avg_hr: 140, max_hr: 170, raw: {} },
  ]);
  await logMealTool.handler(ctx(), { consumed_at: '2026-09-20T08:00:00+02:00', meal_type: 'breakfast', description: 'desayuno', kcal: 400, protein_g: 25, carbs_g: 40, fat_g: 15, confidence: 'estimated' });
  await logMeasurementTool.handler(ctx(), { measured_at: '2026-09-18', weight_kg: 78.2 });
  await setProgramTool.handler(ctx(), {
    name: 'UL',
    routines: [
      { name: 'Upper', exercises: [{ name: 'press banca', target_sets: 3, target_reps: '8' }] },
      { name: 'Lower', exercises: [{ name: 'sentadilla', target_sets: 3, target_reps: '8' }] },
    ],
  });
  await logWorkoutTool.handler(ctx(), { date: '2026-09-19', routine: 'Upper', exercises: [{ name: 'press banca', sets: [{ weight_kg: 80, reps: 8, is_warmup: false }] }] });
  await logWorkoutTool.handler(ctx(), { date: '2026-09-20', started_at: '2026-09-20T09:00:00+02:00', exercises: [{ name: 'sentadilla', sets: [{ weight_kg: 100, reps: 5, is_warmup: false }] }] });
});
afterAll(async () => {
  await u.cleanup();
});

describe('isoWeek', () => {
  it('calcula la semana ISO', () => {
    expect(isoWeek('2026-09-20')).toBe('2026-W38');
    expect(isoWeek('2026-01-01')).toBe('2026-W01');
    expect(isoWeek('2027-01-01')).toBe('2026-W53');
  });
});

describe('get_whoop_summary', () => {
  it('agrega por día (sueño por día de despertar, sin siestas)', async () => {
    const out = await getWhoopSummaryTool.handler(ctx(), { from: '2026-09-18', to: '2026-09-20', granularity: 'day' });
    expect(out.rows).toEqual([
      { period: '2026-09-18', recovery_avg: 40, hrv_ms_avg: 50, rhr_avg: 55, sleep_h_avg: null, strain_avg: 8, workouts: 0 },
      { period: '2026-09-19', recovery_avg: 60, hrv_ms_avg: 70, rhr_avg: 52, sleep_h_avg: 6.7, strain_avg: 12.3, workouts: 1 },
      { period: '2026-09-20', recovery_avg: 80, hrv_ms_avg: 90, rhr_avg: 50, sleep_h_avg: 7.2, strain_avg: 5.1, workouts: 1 },
    ]);
  });

  it('agrega por semana ISO', async () => {
    const out = await getWhoopSummaryTool.handler(ctx(), { from: '2026-09-14', to: '2026-09-20', granularity: 'week' });
    expect(out.rows).toEqual([
      { period: '2026-09-W38'.replace('09-', ''), recovery_avg: 60, hrv_ms_avg: 70, rhr_avg: 52.3, sleep_h_avg: 6.9, strain_avg: 8.5, workouts: 2 },
    ]);
  });

  it('rechaza más de 90 días', async () => {
    await expect(getWhoopSummaryTool.handler(ctx(), { from: '2026-01-01', to: '2026-06-01', granularity: 'day' })).rejects.toThrow(/90/);
  });
});

describe('get_daily_briefing', () => {
  it('compone el día: recovery, sueño, strain, workouts, sesiones, comida, peso, programa', async () => {
    const out = await getDailyBriefingTool.handler(ctx(), { date: '2026-09-20' });
    expect(out.date).toBe('2026-09-20');
    expect(out.whoop_stale).toBe(true); // sin whoop_connections
    expect(out.recovery).toEqual({ score: 80, hrv_ms: 90, rhr: 50, spo2_pct: 98, skin_temp_c: 33.4 });
    expect(out.sleep).toMatchObject({ hours: 7.2, in_bed_hours: 8, efficiency_pct: 89.6, performance_pct: 91, needed_hours: 7.8, rem_h: 1.5, deep_h: 1.3, light_h: 4.3 });
    expect(out.strain).toBe(5.1);
    expect(out.whoop_workouts).toEqual([{ sport: 'running', start: '2026-09-20T07:00:00+00:00', minutes: 40, strain: 7.5, avg_hr: 140 }]);
    expect(out.sessions).toEqual([{ session_id: expect.any(String), routine: undefined, sets: 1, tonnage_kg: 500, notes: undefined }]);
    expect(out.meals.totals).toEqual({ kcal: 400, protein_g: 25, carbs_g: 40, fat_g: 15 });
    expect(out.meals.items[0]).toMatchObject({ time: '08:00', type: 'breakfast', kcal: 400 });
    expect(out.weight_kg).toBe(78.2);
    expect(out.weight_date).toBe('2026-09-18');
    // última sesión con rutina fue "Upper" → toca "Lower"
    expect(out.program).toEqual({ name: 'UL', next_routine: 'Lower' });
  });

  it('día sin datos devuelve nulls, no errores', async () => {
    const out = await getDailyBriefingTool.handler(ctx(), { date: '2026-09-01' });
    expect(out.recovery).toBeNull();
    expect(out.sleep).toBeNull();
    expect(out.strain).toBeNull();
    expect(out.whoop_workouts).toEqual([]);
    expect(out.meals.totals.kcal).toBe(0);
  });

  it('por defecto usa hoy en Madrid', async () => {
    const out = await getDailyBriefingTool.handler(ctx(), {});
    expect(out.date).toBe('2026-09-20');
  });
});
