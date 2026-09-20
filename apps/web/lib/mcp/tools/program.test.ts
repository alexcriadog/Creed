import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, type TestUser } from '../test-utils';
import type { McpContext } from '../types';
import { setProgramTool } from './set-program';
import { getProgramTool } from './get-program';

let u: TestUser;
beforeAll(async () => {
  u = await createTestUser();
});
afterAll(async () => {
  await u.cleanup();
});
const ctx = (): McpContext => ({ supabase: u.supabase, userId: u.id, now: new Date('2026-09-20T10:00:00Z') });

describe('set_program / get_program', () => {
  it('sin programa devuelve null', async () => {
    expect(await getProgramTool.handler(ctx(), {})).toEqual({ program: null });
  });

  it('crea programa activo y lo lee con targets ordenados', async () => {
    const p1 = await setProgramTool.handler(
      ctx(),
      setProgramTool.inputSchema.parse({
        name: 'Upper/Lower',
        goal: 'fuerza',
        rationale: 'porque sí',
        period_weeks: 8,
        routines: [
          {
            name: 'Upper A',
            exercises: [
              { name: 'press banca', target_sets: 4, target_reps: '6-8', target_rir: 2, rest_seconds: 150 },
              { name: 'remo con barra', target_sets: 3, target_reps: '8-10' },
            ],
          },
          { name: 'Lower A', exercises: [{ name: 'sentadilla', target_sets: 5, target_reps: '5', target_rpe: 8 }] },
        ],
      }),
    );
    expect(p1.archived_previous).toBe(false);
    expect(p1.routines.map((r) => r.name)).toEqual(['Upper A', 'Lower A']);
    expect(p1.routines[0]!.exercises[0]).toMatchObject({ name: 'press banca', matched: 'Barbell_Bench_Press_-_Medium_Grip' });

    const read = await getProgramTool.handler(ctx(), {});
    expect(read.program).toMatchObject({ name: 'Upper/Lower', goal: 'fuerza', rationale: 'porque sí', period_weeks: 8, start_date: '2026-09-20' });
    expect(read.program!.routines.map((r) => r.name)).toEqual(['Upper A', 'Lower A']);
    expect(read.program!.routines[0]!.exercises).toEqual([
      expect.objectContaining({ slug: 'Barbell_Bench_Press_-_Medium_Grip', target_sets: 4, target_reps: '6-8', target_rir: 2, rest_seconds: 150 }),
      expect.objectContaining({ slug: 'Bent_Over_Barbell_Row', target_sets: 3, target_reps: '8-10' }),
    ]);
    expect(read.program!.routines[1]!.exercises[0]).toMatchObject({ slug: 'Barbell_Squat', target_rpe: 8 });
  });

  it('el segundo set_program archiva al primero', async () => {
    const p2 = await setProgramTool.handler(
      ctx(),
      setProgramTool.inputSchema.parse({
        name: 'PPL',
        routines: [{ name: 'Push', exercises: [{ name: 'dips', target_sets: 3, target_reps: '10' }] }],
      }),
    );
    expect(p2.archived_previous).toBe(true);
    const { data } = await u.supabase.from('programs').select('name, status').order('created_at');
    expect(data).toEqual([
      { name: 'Upper/Lower', status: 'archived' },
      { name: 'PPL', status: 'active' },
    ]);
    const read = await getProgramTool.handler(ctx(), {});
    expect(read.program?.name).toBe('PPL');
  });
});
