import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, adminClient, type TestUser } from '../test-utils';
import type { McpContext } from '../types';
import { logWorkoutTool } from './log-workout';
import { logMealTool } from './log-meal';
import { logMeasurementTool } from './log-measurement';
import { saveDocumentTool } from './save-document';
import { getTrainingHistoryTool } from './get-training-history';
import { getNutritionSummaryTool } from './get-nutrition-summary';
import { getBodyTrendTool } from './get-body-trend';
import { searchDocsTool, getDocTool } from './search-docs';

let u: TestUser;
const ctx = (): McpContext => ({ supabase: u.supabase, userId: u.id, now: new Date('2026-09-20T10:00:00Z') });

beforeAll(async () => {
  u = await createTestUser();
  await logWorkoutTool.handler(ctx(), {
    date: '2026-09-10',
    notes: 'flojo',
    exercises: [
      { name: 'press banca', sets: [{ weight_kg: 60, reps: 10, is_warmup: true }, { weight_kg: 80, reps: 8, is_warmup: false }] },
    ],
  });
  const second = await logWorkoutTool.handler(ctx(), {
    date: '2026-09-17',
    exercises: [
      { name: 'press banca', sets: [{ weight_kg: 82.5, reps: 8, is_warmup: false }, { weight_kg: 82.5, reps: 6, is_warmup: false }] },
      { name: 'remo con barra', sets: [{ weight_kg: 70, reps: 10, is_warmup: false }] },
    ],
  });
  // Workout de Whoop enlazado a la segunda sesión
  const admin = adminClient();
  await admin.from('whoop_workouts').insert({
    user_id: u.id, whoop_id: 'w-1', sport: 'weightlifting',
    start_at: '2026-09-17T16:00:00Z', end_at: '2026-09-17T17:00:00Z', strain: 9.8, avg_hr: 120, max_hr: 160, raw: {},
  });
  await admin.from('sessions').update({ whoop_workout_id: 'w-1' }).eq('id', second.session_id);

  await logMealTool.handler(ctx(), { consumed_at: '2026-09-19T08:00:00+02:00', meal_type: 'breakfast', description: 'desayuno', kcal: 500, protein_g: 30, carbs_g: 50, fat_g: 20, confidence: 'estimated' });
  await logMealTool.handler(ctx(), { consumed_at: '2026-09-19T14:00:00+02:00', meal_type: 'lunch', description: 'comida', kcal: 800, protein_g: 50, carbs_g: 80, fat_g: 30, confidence: 'estimated' });
  // 00:30 del día 20 en Madrid: NO cuenta para el 19
  await logMealTool.handler(ctx(), { consumed_at: '2026-09-20T00:30:00+02:00', description: 'picoteo', kcal: 200, protein_g: 5, carbs_g: 30, fat_g: 8, confidence: 'estimated' });

  await logMeasurementTool.handler(ctx(), { measured_at: '2026-09-01', weight_kg: 80 });
  await logMeasurementTool.handler(ctx(), { measured_at: '2026-09-15', weight_kg: 78.5, muscle_mass_kg: 36 });
  await admin.from('whoop_body_measurements').insert({ user_id: u.id, height_m: 1.8, weight_kg: 79, max_hr: 195, raw: {}, synced_at: '2026-09-10T08:00:00Z' });

  await saveDocumentTool.handler(ctx(), { kind: 'nutri_plan', title: 'Pauta sept', doc_date: '2026-09-15', text: 'Prioriza proteína en el desayuno. Evita ultraprocesados.' });
  await saveDocumentTool.handler(ctx(), { kind: 'analitica', title: 'Analítica', doc_date: '2026-08-01', text: 'Ferritina 45. Vitamina D 28.' });
});
afterAll(async () => {
  await u.cleanup();
});

describe('get_training_history', () => {
  it('lista sesiones recientes primero, con series por ejercicio, tonelaje y whoop', async () => {
    const out = await getTrainingHistoryTool.handler(ctx(), { limit: 10 });
    expect(out.sessions!.map((s) => s.date)).toEqual(['2026-09-17', '2026-09-10']);
    const last = out.sessions![0]!;
    expect(last.total_sets).toBe(3);
    expect(last.tonnage_kg).toBe(82.5 * 14 + 700);
    expect(last.exercises.map((e) => e.name)).toEqual(['Barbell Bench Press - Medium Grip', 'Bent Over Barbell Row']);
    expect(last.whoop).toEqual({ strain: 9.8, avg_hr: 120 });
    // el calentamiento no cuenta en total_sets ni tonelaje, pero sí se lista
    expect(out.sessions![1]).toMatchObject({ total_sets: 1, tonnage_kg: 640, notes: 'flojo' });
    expect(out.sessions![1]!.exercises[0]!.sets[0]).toMatchObject({ weight_kg: 60, reps: 10, warmup: true });
  });

  it('since filtra', async () => {
    const out = await getTrainingHistoryTool.handler(ctx(), { since: '2026-09-15', limit: 10 });
    expect(out.sessions!.map((s) => s.date)).toEqual(['2026-09-17']);
  });

  it('progresión por ejercicio con e1RM (Epley), ignorando calentamientos', async () => {
    const out = await getTrainingHistoryTool.handler(ctx(), { exercise: 'press banca', limit: 10 });
    expect(out.exercise).toEqual({ slug: 'Barbell_Bench_Press_-_Medium_Grip', name_en: 'Barbell Bench Press - Medium Grip' });
    expect(out.progression!.map((p) => [p.date, p.e1rm_kg, p.sets])).toEqual([
      ['2026-09-17', 104.5, 2],
      ['2026-09-10', 101.3, 1],
    ]);
    expect(out.progression![0]!.best_set).toEqual({ weight_kg: 82.5, reps: 8 });
  });

  it('ejercicio desconocido → error claro', async () => {
    await expect(getTrainingHistoryTool.handler(ctx(), { exercise: 'zzzz-nada', limit: 10 })).rejects.toThrow(/catálogo/);
  });
});

describe('get_nutrition_summary', () => {
  it('agrega por día en Madrid con medias', async () => {
    const out = await getNutritionSummaryTool.handler(ctx(), { from: '2026-09-18', to: '2026-09-20' });
    expect(out.days.map((d) => [d.date, d.kcal])).toEqual([
      ['2026-09-19', 1300],
      ['2026-09-20', 200],
    ]);
    const day = out.days[0]!;
    expect(day).toMatchObject({ protein_g: 80, carbs_g: 130, fat_g: 50 });
    expect(day.meals.map((m) => m.time)).toEqual(['08:00', '14:00']);
    expect(out.averages).toEqual({ kcal: 750, protein_g: 42.5, carbs_g: 80, fat_g: 29, days_with_data: 2 });
  });

  it('rechaza rangos de más de 31 días', async () => {
    await expect(getNutritionSummaryTool.handler(ctx(), { from: '2026-01-01', to: '2026-03-01' })).rejects.toThrow(/31/);
  });
});

describe('get_body_trend', () => {
  it('mezcla manual y whoop, desc, con masa muscular', async () => {
    const out = await getBodyTrendTool.handler(ctx(), { limit: 30 });
    expect(out.measurements.map((m) => [m.date, m.source, m.weight_kg])).toEqual([
      ['2026-09-15', 'manual', 78.5],
      ['2026-09-10', 'whoop', 79],
      ['2026-09-01', 'manual', 80],
    ]);
    expect(out.measurements[0]).toMatchObject({ muscle_mass_kg: 36 });
    expect(out.measurements[1]).toMatchObject({ height_m: 1.8, max_hr: 195 });
  });
});

describe('search_docs / get_doc', () => {
  it('busca por texto (stemming español) y devuelve el completo', async () => {
    const out = await searchDocsTool.handler(ctx(), { query: 'proteínas', limit: 5 });
    expect(out.documents.map((d) => d.title)).toEqual(['Pauta sept']);
    const doc = await getDocTool.handler(ctx(), { id: out.documents[0]!.id });
    expect(doc.text).toContain('ultraprocesados');
  });

  it('sin query lista los últimos por fecha; kind filtra', async () => {
    const all = await searchDocsTool.handler(ctx(), { limit: 5 });
    expect(all.documents.map((d) => d.title)).toEqual(['Pauta sept', 'Analítica']);
    const only = await searchDocsTool.handler(ctx(), { kind: 'analitica', limit: 5 });
    expect(only.documents.map((d) => d.title)).toEqual(['Analítica']);
  });

  it('get_doc de otro usuario → not_found', async () => {
    await expect(getDocTool.handler(ctx(), { id: '00000000-0000-0000-0000-000000000000' })).rejects.toThrow(/no encontrado/i);
  });
});
