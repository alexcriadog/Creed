import { z } from 'zod';
import { defineTool, McpError } from '../types';
import { resolveExercise } from '../exercises/resolve';
import { todayMadrid } from '../dates';

export const setProgramTool = defineTool({
  name: 'set_program',
  description:
    'Crea (o sustituye) el programa de entrenamiento ACTIVO del usuario: rutinas con ejercicios y objetivos ' +
    '(series, reps, RIR/RPE, descanso). Úsala cuando acordéis un plan nuevo o cambiéis el actual; el anterior ' +
    'queda archivado. Guarda en rationale por qué es así, para releerlo en futuras conversaciones con get_program. ' +
    'Ejemplo: { "name": "Upper/Lower 4d", "goal": "hipertrofia", "routines": [{ "name": "Upper A", ' +
    '"exercises": [{ "name": "press banca", "target_sets": 4, "target_reps": "6-8", "target_rir": 2, "rest_seconds": 150 }] }] }',
  inputSchema: z.object({
    name: z.string().min(2).max(80),
    goal: z.string().max(200).optional(),
    rationale: z.string().max(2000).optional().describe('Por qué este plan; se guarda para releerlo'),
    period_weeks: z.number().int().min(1).max(12).optional(),
    routines: z
      .array(
        z.object({
          name: z.string().min(1).max(80),
          notes: z.string().max(500).optional(),
          exercises: z
            .array(
              z.object({
                name: z.string().min(1).max(120),
                exercise_id: z.string().uuid().optional(),
                target_sets: z.number().int().min(1).max(20),
                target_reps: z.string().max(20).describe('"8-10" o "10"'),
                target_rir: z.number().int().min(0).max(10).optional(),
                target_rpe: z.number().min(1).max(10).optional(),
                rest_seconds: z.number().int().min(0).max(600).optional(),
                notes: z.string().max(300).optional(),
              }),
            )
            .min(1)
            .max(20),
        }),
      )
      .min(1)
      .max(10),
  }),
  handler: async (ctx, input) => {
    const { data: archived, error: archiveErr } = await ctx.supabase
      .from('programs')
      .update({ status: 'archived', updated_at: ctx.now.toISOString() })
      .eq('user_id', ctx.userId)
      .eq('status', 'active')
      .select('id');
    if (archiveErr) throw new McpError('db_error', archiveErr.message);

    const { data: program, error: programErr } = await ctx.supabase
      .from('programs')
      .insert({
        user_id: ctx.userId,
        name: input.name,
        goal: input.goal ?? null,
        rationale: input.rationale ?? null,
        created_by: 'coach',
        status: 'active',
        period_weeks: input.period_weeks ?? null,
        start_date: todayMadrid(ctx.now),
      })
      .select('id')
      .single();
    if (programErr) throw new McpError('db_error', programErr.message);

    const routinesOut: { routine_id: string; name: string; exercises: { name: string; matched: string; alternatives?: string[] }[] }[] = [];
    for (const [routineIdx, r] of input.routines.entries()) {
      const { data: routine, error: routineErr } = await ctx.supabase
        .from('routines')
        .insert({
          user_id: ctx.userId,
          program_id: program.id,
          name: r.name,
          created_by: 'coach',
          position: routineIdx,
          notes: r.notes ?? null,
        })
        .select('id')
        .single();
      if (routineErr) throw new McpError('db_error', routineErr.message);

      const exercisesOut: { name: string; matched: string; alternatives?: string[] }[] = [];
      const rows: Record<string, unknown>[] = [];
      for (const [exIdx, ex] of r.exercises.entries()) {
        const resolved = await resolveExercise(ctx, { name: ex.name, exercise_id: ex.exercise_id });
        exercisesOut.push({ name: ex.name, matched: resolved.matched, alternatives: resolved.alternatives });
        rows.push({
          routine_id: routine.id,
          user_id: ctx.userId,
          exercise_id: resolved.id,
          position: exIdx,
          target_sets: ex.target_sets,
          target_reps: ex.target_reps,
          target_rir: ex.target_rir ?? null,
          target_rpe: ex.target_rpe ?? null,
          rest_seconds: ex.rest_seconds ?? null,
          notes: ex.notes ?? null,
        });
      }
      const { error: reErr } = await ctx.supabase.from('routine_exercises').insert(rows);
      if (reErr) throw new McpError('db_error', reErr.message);
      routinesOut.push({ routine_id: routine.id, name: r.name, exercises: exercisesOut });
    }

    return {
      program_id: program.id,
      name: input.name,
      routines: routinesOut,
      archived_previous: (archived?.length ?? 0) > 0,
    };
  },
});
