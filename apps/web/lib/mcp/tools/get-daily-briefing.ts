import { z } from 'zod';
import { defineTool, McpError } from '../types';
import { isoDay } from '../schemas';
import { dayRangeMadrid, todayMadrid, TZ } from '../dates';
import { round1, tonnage } from '../format';
import { maybeRefreshWhoop } from '../whoop-refresh';

const timeFormatter = new Intl.DateTimeFormat('es-ES', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const num = (v: number | null | undefined): number | undefined => (v == null ? undefined : Number(v));
const hours = (minutes: number | null | undefined): number | undefined => (minutes == null ? undefined : round1(minutes / 60));

interface SessionRow {
  id: string;
  notes: string | null;
  routines: { name: string } | null;
  sets: { weight_kg: number | null; reps: number | null; is_warmup: boolean }[] | null;
}

export const getDailyBriefingTool = defineTool({
  name: 'get_daily_briefing',
  description:
    'Foto del día del atleta: recovery, sueño y strain de Whoop, workouts detectados por Whoop, entrenos y ' +
    'comidas registrados ese día, último peso y programa activo con la rutina que tocaría. Llámala al empezar ' +
    'cualquier conversación sobre entrenar hoy, "¿cómo estoy?", o antes de proponer la sesión. Si ' +
    'whoop_stale=true, avisa de que los datos de Whoop pueden no estar al día. Por defecto, hoy (Europe/Madrid).',
  inputSchema: z.object({ date: isoDay.optional() }),
  handler: async (ctx, input) => {
    const date = input.date ?? todayMadrid(ctx.now);
    const range = dayRangeMadrid(date);
    const refresh = await maybeRefreshWhoop(ctx);

    const [rec, sleep, cycle, whoopWorkouts, sessions, meals, weight, program] = await Promise.all([
      ctx.supabase.from('whoop_recovery').select('score, hrv_rmssd_milli, resting_heart_rate, skin_temp_celsius, raw').eq('user_id', ctx.userId).eq('date', date).maybeSingle(),
      ctx.supabase.from('whoop_sleep').select('sleep_minutes, duration_in_bed_minutes, efficiency_pct, rem_minutes, deep_minutes, light_minutes, needed_minutes, raw').eq('user_id', ctx.userId).eq('is_nap', false).gte('end_at', range.from).lt('end_at', range.to).order('end_at', { ascending: false }).limit(1).maybeSingle(),
      ctx.supabase.from('whoop_cycles').select('strain').eq('user_id', ctx.userId).gte('start_at', range.from).lt('start_at', range.to).order('start_at', { ascending: false }).limit(1).maybeSingle(),
      ctx.supabase.from('whoop_workouts').select('sport, start_at, end_at, strain, avg_hr').eq('user_id', ctx.userId).gte('start_at', range.from).lt('start_at', range.to).order('start_at'),
      ctx.supabase.from('sessions').select('id, notes, routines(name), sets(weight_kg, reps, is_warmup)' as string).eq('user_id', ctx.userId).gte('started_at', range.from).lt('started_at', range.to).order('started_at'),
      ctx.supabase.from('meals').select('consumed_at, meal_type, raw_text, total_calories, total_protein_g, total_carbs_g, total_fat_g').eq('user_id', ctx.userId).gte('consumed_at', range.from).lt('consumed_at', range.to).order('consumed_at'),
      ctx.supabase.from('body_measurements').select('measured_at, weight_kg').eq('user_id', ctx.userId).not('weight_kg', 'is', null).order('measured_at', { ascending: false }).limit(1).maybeSingle(),
      ctx.supabase.from('programs').select('name, routines(name, position)' as string).eq('user_id', ctx.userId).eq('status', 'active').maybeSingle(),
    ]);
    for (const r of [rec, sleep, cycle, whoopWorkouts, sessions, meals, weight, program]) {
      if (r.error) throw new McpError('db_error', r.error.message);
    }

    const r = rec.data;
    const s = sleep.data;
    const recScore = ((r?.raw as { score?: Record<string, number> } | null)?.score) ?? {};
    const sleepScore = ((s?.raw as { score?: Record<string, number> } | null)?.score) ?? {};

    const mealRows = meals.data ?? [];
    const totals = {
      kcal: mealRows.reduce((a, m) => a + (m.total_calories ?? 0), 0),
      protein_g: round1(mealRows.reduce((a, m) => a + Number(m.total_protein_g ?? 0), 0)),
      carbs_g: round1(mealRows.reduce((a, m) => a + Number(m.total_carbs_g ?? 0), 0)),
      fat_g: round1(mealRows.reduce((a, m) => a + Number(m.total_fat_g ?? 0), 0)),
    };

    // Próxima rutina: la siguiente a la última sesión enlazada a una rutina del programa.
    const programRow = program.data as unknown as { name: string; routines: { name: string; position: number }[] | null } | null;
    let nextRoutine: string | undefined;
    const routines = (programRow?.routines ?? []).slice().sort((a, b) => a.position - b.position);
    if (routines.length) {
      const { data: last } = await ctx.supabase
        .from('sessions')
        .select('routines(name)' as string)
        .eq('user_id', ctx.userId)
        .not('routine_id', 'is', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const lastName = (last as unknown as { routines: { name: string } | null } | null)?.routines?.name;
      const idx = routines.findIndex((x) => x.name === lastName);
      nextRoutine = routines[(idx + 1) % routines.length]!.name;
    }

    return {
      date,
      whoop_stale: refresh.stale,
      recovery: r
        ? {
            score: r.score,
            hrv_ms: num(r.hrv_rmssd_milli),
            rhr: r.resting_heart_rate ?? undefined,
            spo2_pct: recScore.spo2_percentage,
            skin_temp_c: num(r.skin_temp_celsius),
          }
        : null,
      sleep: s
        ? {
            hours: hours(s.sleep_minutes) ?? 0,
            in_bed_hours: hours(s.duration_in_bed_minutes),
            efficiency_pct: num(s.efficiency_pct),
            performance_pct: sleepScore.sleep_performance_percentage,
            needed_hours: hours(s.needed_minutes),
            rem_h: hours(s.rem_minutes),
            deep_h: hours(s.deep_minutes),
            light_h: hours(s.light_minutes),
          }
        : null,
      strain: cycle.data?.strain != null ? Number(cycle.data.strain) : null,
      whoop_workouts: (whoopWorkouts.data ?? []).map((w) => ({
        sport: w.sport,
        start: w.start_at,
        minutes: w.end_at ? Math.round((Date.parse(w.end_at) - Date.parse(w.start_at)) / 60_000) : undefined,
        strain: num(w.strain),
        avg_hr: w.avg_hr ?? undefined,
      })),
      sessions: ((sessions.data ?? []) as unknown as SessionRow[]).map((x) => {
        const work = (x.sets ?? []).filter((z) => !z.is_warmup);
        return {
          session_id: x.id,
          routine: x.routines?.name ?? undefined,
          sets: work.length,
          tonnage_kg: tonnage(work.map((z) => ({ weight_kg: num(z.weight_kg) ?? null, reps: z.reps }))),
          notes: x.notes ?? undefined,
        };
      }),
      meals: {
        items: mealRows.map((m) => ({
          time: timeFormatter.format(new Date(m.consumed_at)),
          type: m.meal_type ?? undefined,
          description: String(m.raw_text).slice(0, 120),
          kcal: m.total_calories ?? undefined,
        })),
        totals,
      },
      weight_kg: num(weight.data?.weight_kg),
      weight_date: weight.data ? todayMadrid(new Date(weight.data.measured_at)) : undefined,
      program: programRow ? { name: programRow.name, next_routine: nextRoutine } : null,
    };
  },
});
