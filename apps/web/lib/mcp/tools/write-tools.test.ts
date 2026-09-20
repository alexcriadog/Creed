import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, type TestUser } from '../test-utils';
import type { McpContext } from '../types';
import { logWorkoutTool } from './log-workout';
import { logMealTool } from './log-meal';
import { logMeasurementTool } from './log-measurement';
import { saveDocumentTool } from './save-document';

let u: TestUser;
beforeAll(async () => {
  u = await createTestUser();
});
afterAll(async () => {
  await u.cleanup();
});
const ctx = (): McpContext => ({ supabase: u.supabase, userId: u.id, now: new Date('2026-09-20T10:00:00Z') });

describe('log_workout', () => {
  it('guarda sesión + series resolviendo ejercicios (catálogo y custom)', async () => {
    const out = await logWorkoutTool.handler(
      ctx(),
      logWorkoutTool.inputSchema.parse({
        date: '2026-09-19',
        notes: 'buen día',
        exercises: [
          { name: 'press banca', sets: [{ weight_kg: 80, reps: 8 }, { weight_kg: 80, reps: 7, rir: 1 }] },
          { name: 'máquina rara', sets: [{ weight_kg: 40, reps: 12 }] },
        ],
      }),
    );
    expect(out.exercises.map((e) => e.matched)).toEqual(['Barbell_Bench_Press_-_Medium_Grip', 'custom']);
    expect(out.total_sets).toBe(3);
    expect(out.tonnage_kg).toBe(80 * 8 + 80 * 7 + 40 * 12);

    const { data: session } = await u.supabase
      .from('sessions')
      .select('status, source, notes, scheduled_for, started_at')
      .eq('id', out.session_id)
      .single();
    expect(session).toMatchObject({ status: 'completed', source: 'text', notes: 'buen día', scheduled_for: '2026-09-19' });
    // 00:00 Madrid (CEST) = 22:00Z del día anterior
    expect(session?.started_at).toBe('2026-09-18T22:00:00+00:00');

    const { data: sets } = await u.supabase
      .from('sets')
      .select('set_number, weight_kg, reps, rir, completed, exercises(slug)')
      .eq('session_id', out.session_id)
      .order('set_number');
    expect(sets).toHaveLength(3);
    const bench = sets!.filter((s) => (s.exercises as unknown as { slug: string }).slug.includes('Bench_Press'));
    expect(bench.map((s) => s.set_number)).toEqual([1, 2]);
    expect(bench[1]).toMatchObject({ set_number: 2, weight_kg: 80, reps: 7, rir: 1, completed: true });
  });

  it('enlaza la rutina del programa activo por nombre (case-insensitive)', async () => {
    const { data: program } = await u.supabase
      .from('programs')
      .insert({ user_id: u.id, name: 'Test', status: 'active' })
      .select('id')
      .single();
    const { data: routine } = await u.supabase
      .from('routines')
      .insert({ user_id: u.id, program_id: program!.id, name: 'Upper A' })
      .select('id')
      .single();
    const out = await logWorkoutTool.handler(
      ctx(),
      logWorkoutTool.inputSchema.parse({
        date: '2026-09-20',
        routine: 'upper a',
        started_at: '2026-09-20T18:30:00+02:00',
        duration_min: 60,
        exercises: [{ name: 'sentadilla', sets: [{ weight_kg: 100, reps: 5 }] }],
      }),
    );
    const { data: s } = await u.supabase
      .from('sessions')
      .select('routine_id, program_id, started_at, completed_at')
      .eq('id', out.session_id)
      .single();
    expect(s).toMatchObject({ routine_id: routine!.id, program_id: program!.id });
    expect(s?.started_at).toBe('2026-09-20T16:30:00+00:00');
    expect(s?.completed_at).toBe('2026-09-20T17:30:00+00:00');
  });

  it('rechaza fecha inválida y lista vacía', () => {
    expect(() => logWorkoutTool.inputSchema.parse({ date: '19/09/2026', exercises: [{ name: 'x', sets: [{}] }] })).toThrow();
    expect(() => logWorkoutTool.inputSchema.parse({ date: '2026-09-19', exercises: [] })).toThrow();
  });
});

describe('log_meal', () => {
  it('guarda comida estimada por Claude', async () => {
    const out = await logMealTool.handler(
      ctx(),
      logMealTool.inputSchema.parse({
        consumed_at: '2026-09-20T08:30:00+02:00',
        meal_type: 'breakfast',
        description: '3 huevos, tostada, café',
        kcal: 420,
        protein_g: 24,
        carbs_g: 30,
        fat_g: 22,
        items: [{ name: 'huevo', grams: 150 }],
      }),
    );
    expect(out.kcal).toBe(420);
    const { data } = await u.supabase
      .from('meals')
      .select('raw_text, meal_type, total_calories, total_protein_g, source, confidence, parsed, parser_version')
      .eq('id', out.meal_id)
      .single();
    expect(data).toMatchObject({
      raw_text: '3 huevos, tostada, café',
      meal_type: 'breakfast',
      total_calories: 420,
      total_protein_g: 24,
      source: 'claude',
      confidence: 'estimated',
      parsed: { items: [{ name: 'huevo', grams: 150 }] },
      parser_version: 'claude-mcp',
    });
  });

  it('exige zona horaria en consumed_at', () => {
    expect(() => logMealTool.inputSchema.parse({ consumed_at: '2026-09-20T08:30:00', description: 'x', kcal: 1, protein_g: 0, carbs_g: 0, fat_g: 0 })).toThrow();
  });
});

describe('log_measurement', () => {
  it('guarda peso y % grasa; masa muscular y notas en notes JSON', async () => {
    const out = await logMeasurementTool.handler(
      ctx(),
      logMeasurementTool.inputSchema.parse({
        measured_at: '2026-09-18',
        weight_kg: 78.4,
        body_fat_pct: 15.2,
        muscle_mass_kg: 36.1,
        notes: 'InBody de la nutri',
      }),
    );
    expect(out.measured_at).toBe('2026-09-17T22:00:00.000Z');
    const { data } = await u.supabase
      .from('body_measurements')
      .select('weight_kg, body_fat_pct, notes')
      .eq('id', out.measurement_id)
      .single();
    expect(data?.weight_kg).toBe(78.4);
    expect(data?.body_fat_pct).toBe(15.2);
    expect(JSON.parse(data!.notes!)).toEqual({ muscle_mass_kg: 36.1, notes: 'InBody de la nutri' });
  });

  it('acepta instante ISO y deja notes null si no hay extra', async () => {
    const out = await logMeasurementTool.handler(
      ctx(),
      logMeasurementTool.inputSchema.parse({ measured_at: '2026-09-19T07:00:00+02:00', weight_kg: 78 }),
    );
    const { data } = await u.supabase.from('body_measurements').select('notes, measured_at').eq('id', out.measurement_id).single();
    expect(data).toEqual({ notes: null, measured_at: '2026-09-19T05:00:00+00:00' });
  });
});

describe('save_document', () => {
  it('guarda documento y devuelve tamaño', async () => {
    const out = await saveDocumentTool.handler(
      ctx(),
      saveDocumentTool.inputSchema.parse({ kind: 'nutri_plan', title: 'Pauta', doc_date: '2026-09-18', text: 'Comer más proteína.' }),
    );
    expect(out).toMatchObject({ kind: 'nutri_plan', title: 'Pauta', doc_date: '2026-09-18', chars: 19 });
    const { data } = await u.supabase.from('documents').select('text').eq('id', out.document_id).single();
    expect(data?.text).toBe('Comer más proteína.');
  });
});
