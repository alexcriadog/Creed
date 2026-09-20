import { z } from 'zod';
import { defineTool, McpError } from '../types';
import { isoDay, isoInstant } from '../schemas';
import { resolveExercise } from '../exercises/resolve';
import { startOfDayMadrid } from '../dates';
import { tonnage } from '../format';

const setSchema = z.object({
  weight_kg: z.number().min(0).max(1000).optional().describe('Peso en kg; omite si es peso corporal'),
  reps: z.number().int().min(0).max(1000).optional(),
  rir: z.number().int().min(0).max(10).optional().describe('Reps en reserva'),
  rpe: z.number().min(1).max(10).optional(),
  is_warmup: z.boolean().default(false),
  notes: z.string().max(200).optional(),
});

export const logWorkoutTool = defineTool({
  name: 'log_workout',
  description:
    'Guarda un entrenamiento de fuerza YA REALIZADO (sesión + series por ejercicio). Úsala cuando el usuario ' +
    'te pase lo que ha entrenado (texto de WhatsApp, notas, dictado). Si algún peso, reps o número de series es ' +
    'ambiguo, pregunta antes; no inventes valores. Los ejercicios se resuelven contra el catálogo (alias en ' +
    'español válidos: "press banca", "sentadilla", "jalón"…); la respuesta indica el match de cada uno ' +
    '(matched=slug, o "custom" si se creó uno nuevo, con alternatives si no fue exacto). Si el match no es el ' +
    'que el usuario quería, corrige con search_exercises + exercise_id. ' +
    'Ejemplo: { "date": "2026-09-19", "routine": "Upper A", "exercises": [{ "name": "press banca", ' +
    '"sets": [{ "weight_kg": 80, "reps": 8 }, { "weight_kg": 80, "reps": 7, "rir": 1 }] }] }',
  inputSchema: z.object({
    date: isoDay.describe('Día del entreno (Europe/Madrid)'),
    started_at: isoInstant.optional().describe('Inicio ISO 8601 con zona, si se conoce'),
    duration_min: z.number().int().min(1).max(600).optional(),
    routine: z.string().max(80).optional().describe('Nombre de la rutina del programa activo, si aplica'),
    notes: z.string().max(2000).optional().describe('Sensaciones, molestias, contexto'),
    exercises: z
      .array(
        z.object({
          name: z.string().min(1).max(120),
          exercise_id: z.string().uuid().optional().describe('Id del catálogo (search_exercises) para fijar la elección'),
          sets: z.array(setSchema).min(1).max(30),
        }),
      )
      .min(1)
      .max(30),
  }),
  handler: async (ctx, input) => {
    const startedAt = input.started_at ? new Date(input.started_at) : startOfDayMadrid(input.date);
    const completedAt = input.duration_min
      ? new Date(startedAt.getTime() + input.duration_min * 60_000)
      : startedAt;

    let routineId: string | null = null;
    let programId: string | null = null;
    if (input.routine) {
      const { data: routine, error } = await ctx.supabase
        .from('routines')
        .select('id, program_id')
        .eq('user_id', ctx.userId)
        .ilike('name', input.routine)
        .limit(1)
        .maybeSingle();
      if (error) throw new McpError('db_error', error.message);
      if (routine) {
        routineId = routine.id;
        programId = routine.program_id;
      }
    }

    const { data: session, error: sessionErr } = await ctx.supabase
      .from('sessions')
      .insert({
        user_id: ctx.userId,
        routine_id: routineId,
        program_id: programId,
        scheduled_for: input.date,
        started_at: startedAt.toISOString(),
        completed_at: completedAt.toISOString(),
        status: 'completed',
        source: 'text',
        notes: input.notes ?? null,
      })
      .select('id')
      .single();
    if (sessionErr) throw new McpError('db_error', sessionErr.message);

    try {
      const summary: { name: string; matched: string; alternatives?: string[]; sets: number }[] = [];
      const rows: Record<string, unknown>[] = [];
      for (const ex of input.exercises) {
        const resolved = await resolveExercise(ctx, { name: ex.name, exercise_id: ex.exercise_id });
        summary.push({ name: ex.name, matched: resolved.matched, alternatives: resolved.alternatives, sets: ex.sets.length });
        ex.sets.forEach((s, i) =>
          rows.push({
            session_id: session.id,
            user_id: ctx.userId,
            exercise_id: resolved.id,
            set_number: i + 1,
            reps: s.reps ?? null,
            weight_kg: s.weight_kg ?? null,
            rir: s.rir ?? null,
            rpe: s.rpe ?? null,
            is_warmup: s.is_warmup,
            completed: true,
            performed_at: startedAt.toISOString(),
            notes: s.notes ?? null,
          }),
        );
      }
      const { error: setsErr } = await ctx.supabase.from('sets').insert(rows);
      if (setsErr) throw new McpError('db_error', setsErr.message);

      const workSets = input.exercises.flatMap((e) =>
        e.sets.filter((s) => !s.is_warmup).map((s) => ({ weight_kg: s.weight_kg ?? null, reps: s.reps ?? null })),
      );
      return {
        session_id: session.id,
        date: input.date,
        routine: routineId ? input.routine : undefined,
        exercises: summary,
        total_sets: rows.length,
        tonnage_kg: tonnage(workSets),
      };
    } catch (e) {
      // No dejamos una sesión vacía si fallan las series.
      await ctx.supabase.from('sessions').delete().eq('id', session.id);
      throw e;
    }
  },
});
