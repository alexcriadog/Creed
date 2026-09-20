import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, type TestUser } from '../test-utils';
import { normalizeQuery, searchExercises, resolveExercise } from './resolve';
import type { McpContext } from '../types';

let u: TestUser;
beforeAll(async () => {
  u = await createTestUser();
});
afterAll(async () => {
  await u.cleanup();
});
const ctx = (): McpContext => ({ supabase: u.supabase, userId: u.id, now: new Date() });

describe('normalizeQuery', () => {
  it('traduce alias ES (sin tildes, sin mayúsculas) y conserva el original', () => {
    expect(normalizeQuery('Press Banca')).toEqual(['barbell bench press - medium grip', 'press banca']);
    expect(normalizeQuery('Sentadilla búlgara')).toEqual(['split squat with dumbbells', 'sentadilla bulgara']);
    expect(normalizeQuery('Barbell Squat')).toEqual(['barbell squat']);
  });
});

describe('searchExercises', () => {
  it('encuentra press banca en el catálogo vía alias', async () => {
    const hits = await searchExercises(ctx(), 'press banca');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.name_en).toBe('Barbell Bench Press - Medium Grip');
  });

  it('el match exacto por name_en va primero', async () => {
    const hits = await searchExercises(ctx(), 'barbell bench press - medium grip');
    expect(hits[0]?.name_en.toLowerCase()).toBe('barbell bench press - medium grip');
  });

  it('devuelve vacío si no hay match', async () => {
    expect(await searchExercises(ctx(), 'zzzz-no-existe')).toEqual([]);
  });
});

describe('resolveExercise', () => {
  it('resuelve alias ES al ejercicio canónico sin alternativas', async () => {
    const r = await resolveExercise(ctx(), { name: 'Sentadilla' });
    expect(r).toEqual({ id: expect.any(String), matched: 'Barbell_Squat' });
  });

  it('sin match exacto elige el más genérico y lista alternativas', async () => {
    const r = await resolveExercise(ctx(), { name: 'preacher' });
    expect(r.matched).toBe('Preacher_Curl');
    expect(r.alternatives?.length).toBeGreaterThan(0);
  });

  it('usa exercise_id si viene', async () => {
    const [hit] = await searchExercises(ctx(), 'hack squat');
    const r = await resolveExercise(ctx(), { name: 'lo que sea', exercise_id: hit!.id });
    expect(r).toEqual({ id: hit!.id, matched: hit!.slug });
  });

  it('falla con exercise_id inexistente', async () => {
    await expect(
      resolveExercise(ctx(), { name: 'x', exercise_id: '00000000-0000-0000-0000-000000000000' }),
    ).rejects.toThrow(/No existe/);
  });

  it('crea custom si no hay match y lo reutiliza la segunda vez (case-insensitive)', async () => {
    const a = await resolveExercise(ctx(), { name: 'Máquina rara del gym' });
    expect(a.matched).toBe('custom');
    const b = await resolveExercise(ctx(), { name: 'máquina rara del gym' });
    expect(b).toEqual({ id: a.id, matched: 'custom' });
    const { data } = await u.supabase.from('exercises').select('is_custom, created_by, name_es').eq('id', a.id).single();
    expect(data).toMatchObject({ is_custom: true, created_by: u.id, name_es: 'Máquina rara del gym' });
  });

  it('el custom de un usuario no se cuela en la búsqueda de otro', async () => {
    const other = await createTestUser();
    try {
      const hits = await searchExercises({ supabase: other.supabase, userId: other.id, now: new Date() }, 'máquina rara del gym');
      expect(hits).toEqual([]);
    } finally {
      await other.cleanup();
    }
  });
});
