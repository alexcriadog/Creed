import { z } from 'zod';
import { defineTool, McpError } from '../types';
import { isoDay } from '../schemas';
import { searchExercises } from '../exercises/resolve';
import { startOfDayMadrid, todayMadrid } from '../dates';
import { e1rm, tonnage } from '../format';

interface SetRow {
  exercise_id: string;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  rir: number | null;
  rpe: number | null;
  is_warmup: boolean;
  exercises: { slug: string; name_en: string } | null;
}

interface SessionRow {
  id: string;
  started_at: string;
  notes: string | null;
  whoop_workout_id: string | null;
  routines: { name: string } | null;
  sets: SetRow[] | null;
}

const SESSION_SELECT: string =
  'id, started_at, notes, whoop_workout_id, routines(name), ' +
  'sets(exercise_id, set_number, weight_kg, reps, rir, rpe, is_warmup, exercises(slug, name_en))';

const num = (v: number | null): number | null => (v == null ? null : Number(v));

export const getTrainingHistoryTool = defineTool({
  name: 'get_training_history',
  description:
    'Historial de entrenos de fuerza. Sin `exercise`: últimas sesiones con sus series agrupadas por ejercicio, ' +
    'tonelaje y strain de Whoop si está enlazado. Con `exercise` (p. ej. "press banca"): progresión de ese ' +
    'ejercicio, sesión a sesión, con la mejor serie y el 1RM estimado (Epley). Úsala para valorar progreso, ' +
    'elegir pesos para la próxima sesión o detectar estancamientos.',
  inputSchema: z.object({
    exercise: z.string().max(80).optional().describe('Nombre del ejercicio (español o inglés) para ver su progresión'),
    since: isoDay.optional().describe('Solo sesiones desde esta fecha'),
    limit: z.number().int().min(1).max(50).default(10),
  }),
  handler: async (ctx, { exercise, since, limit }) => {
    let target: { id: string; slug: string; name_en: string } | undefined;
    if (exercise) {
      const [hit] = await searchExercises(ctx, exercise, 1);
      if (!hit) throw new McpError('exercise_not_found', `No encuentro "${exercise}" en el catálogo.`);
      target = hit;
    }

    let query = ctx.supabase
      .from('sessions')
      .select(target ? `${SESSION_SELECT.replace('sets(', 'sets!inner(')}` : SESSION_SELECT)
      .eq('user_id', ctx.userId)
      .eq('status', 'completed')
      .order('started_at', { ascending: false })
      .limit(limit);
    if (target) query = query.eq('sets.exercise_id', target.id);
    if (since) query = query.gte('started_at', startOfDayMadrid(since).toISOString());

    const { data, error } = await query;
    if (error) throw new McpError('db_error', error.message);
    const sessions = (data ?? []) as unknown as SessionRow[];
    const dateOf = (iso: string) => todayMadrid(new Date(iso));

    if (target) {
      const progression = sessions.map((s) => {
        const work = (s.sets ?? []).filter((x) => !x.is_warmup && x.weight_kg != null && x.reps != null);
        const best = work.reduce<SetRow | null>(
          (b, x) => (!b || e1rm(Number(x.weight_kg), x.reps!) > e1rm(Number(b.weight_kg), b.reps!) ? x : b),
          null,
        );
        return {
          date: dateOf(s.started_at),
          best_set: best ? { weight_kg: Number(best.weight_kg), reps: best.reps!, rir: best.rir ?? undefined } : null,
          e1rm_kg: best ? e1rm(Number(best.weight_kg), best.reps!) : null,
          sets: work.length,
          tonnage_kg: tonnage(work.map((x) => ({ weight_kg: num(x.weight_kg), reps: x.reps }))),
        };
      });
      return { exercise: { slug: target.slug, name_en: target.name_en }, progression };
    }

    const whoopIds = sessions.map((s) => s.whoop_workout_id).filter((x): x is string => !!x);
    const whoopById = new Map<string, { strain: number | null; avg_hr: number | null }>();
    if (whoopIds.length) {
      const { data: workouts, error: wErr } = await ctx.supabase
        .from('whoop_workouts')
        .select('whoop_id, strain, avg_hr')
        .eq('user_id', ctx.userId)
        .in('whoop_id', whoopIds);
      if (wErr) throw new McpError('db_error', wErr.message);
      for (const w of workouts ?? []) whoopById.set(w.whoop_id, { strain: num(w.strain), avg_hr: w.avg_hr });
    }

    return {
      sessions: sessions.map((s) => {
        const byExercise = new Map<string, { name: string; sets: Record<string, unknown>[] }>();
        for (const x of (s.sets ?? []).slice().sort((a, b) => a.set_number - b.set_number)) {
          const name = x.exercises?.name_en ?? x.exercises?.slug ?? 'desconocido';
          const entry = byExercise.get(x.exercise_id) ?? { name, sets: [] };
          entry.sets.push({
            weight_kg: num(x.weight_kg) ?? undefined,
            reps: x.reps ?? undefined,
            rir: x.rir ?? undefined,
            rpe: x.rpe != null ? Number(x.rpe) : undefined,
            warmup: x.is_warmup || undefined,
          });
          byExercise.set(x.exercise_id, entry);
        }
        const work = (s.sets ?? []).filter((x) => !x.is_warmup);
        return {
          session_id: s.id,
          date: dateOf(s.started_at),
          routine: s.routines?.name ?? undefined,
          exercises: [...byExercise.values()],
          total_sets: work.length,
          tonnage_kg: tonnage(work.map((x) => ({ weight_kg: num(x.weight_kg), reps: x.reps }))),
          notes: s.notes ?? undefined,
          whoop: s.whoop_workout_id ? whoopById.get(s.whoop_workout_id) : undefined,
        };
      }),
    };
  },
});
