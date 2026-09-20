import { z } from 'zod';
import { defineTool, McpError } from '../types';

interface RoutineExerciseRow {
  exercise_id: string;
  position: number;
  target_sets: number | null;
  target_reps: string | null;
  target_rir: number | null;
  target_rpe: number | null;
  rest_seconds: number | null;
  notes: string | null;
  exercises: { slug: string; name_en: string } | null;
}

interface RoutineRow {
  id: string;
  name: string;
  position: number;
  notes: string | null;
  routine_exercises: RoutineExerciseRow[] | null;
}

interface ProgramRow {
  id: string;
  name: string;
  goal: string | null;
  rationale: string | null;
  start_date: string | null;
  period_weeks: number | null;
  routines: RoutineRow[] | null;
}

// Tipado como string para que postgrest-js no intente parsear el select anidado.
const SELECT: string =
  'id, name, goal, rationale, start_date, period_weeks, ' +
  'routines(id, name, position, notes, routine_exercises(exercise_id, position, target_sets, target_reps, target_rir, target_rpe, rest_seconds, notes, exercises(slug, name_en)))';

export const getProgramTool = defineTool({
  name: 'get_program',
  description:
    'Devuelve el programa de entrenamiento activo (rutinas ordenadas, ejercicios y objetivos de series/reps/RIR). ' +
    'Úsala antes de proponer qué entrenar, al revisar progresión o cuando el usuario pregunte por su plan.',
  inputSchema: z.object({}),
  handler: async (ctx) => {
    const { data, error } = await ctx.supabase
      .from('programs')
      .select(SELECT)
      .eq('user_id', ctx.userId)
      .eq('status', 'active')
      .maybeSingle();
    if (error) throw new McpError('db_error', error.message);
    if (!data) return { program: null };
    const program = data as unknown as ProgramRow;

    const routines = (program.routines ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((r) => ({
        id: r.id,
        name: r.name,
        position: r.position,
        notes: r.notes ?? undefined,
        exercises: (r.routine_exercises ?? [])
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((e) => ({
            exercise_id: e.exercise_id,
            slug: e.exercises?.slug,
            name_en: e.exercises?.name_en,
            target_sets: e.target_sets ?? undefined,
            target_reps: e.target_reps ?? undefined,
            target_rir: e.target_rir ?? undefined,
            target_rpe: e.target_rpe ?? undefined,
            rest_seconds: e.rest_seconds ?? undefined,
            notes: e.notes ?? undefined,
          })),
      }));

    return {
      program: {
        id: program.id,
        name: program.name,
        goal: program.goal ?? undefined,
        rationale: program.rationale ?? undefined,
        start_date: program.start_date,
        period_weeks: program.period_weeks ?? undefined,
        routines,
      },
    };
  },
});
