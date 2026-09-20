import { z } from 'zod';
import { defineTool, McpError } from '../types';
import { isoDay } from '../schemas';
import { assertDateRange, dayRangeMadrid, todayMadrid } from '../dates';
import { round1 } from '../format';

/** Semana ISO 8601 (YYYY-Www) de un día YYYY-MM-DD. */
export function isoWeek(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const weekday = d.getUTCDay() || 7; // lunes=1 … domingo=7
  d.setUTCDate(d.getUTCDate() + 4 - weekday); // jueves de esa semana
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

const avg = (xs: number[]): number | null => (xs.length ? round1(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

interface Bucket {
  recovery: number[];
  hrv: number[];
  rhr: number[];
  sleep: number[];
  strain: number[];
  workouts: number;
}

export const getWhoopSummaryTool = defineTool({
  name: 'get_whoop_summary',
  description:
    'Métricas de Whoop agregadas por día o semana ISO: recovery medio, HRV, FC en reposo, horas de sueño ' +
    '(sin siestas, asignadas al día de despertar), strain y nº de workouts. Rango máximo 90 días. Úsala para ' +
    'tendencias: fatiga acumulada, efecto del sueño en el rendimiento, cuándo meter descarga.',
  inputSchema: z.object({
    from: isoDay,
    to: isoDay,
    granularity: z.enum(['day', 'week']).default('day'),
  }),
  handler: async (ctx, { from, to, granularity }) => {
    assertDateRange(from, to, 90);
    const range = { from: dayRangeMadrid(from).from, to: dayRangeMadrid(to).to };

    const [rec, sleep, cycles, workouts] = await Promise.all([
      ctx.supabase.from('whoop_recovery').select('date, score, hrv_rmssd_milli, resting_heart_rate').eq('user_id', ctx.userId).gte('date', from).lte('date', to),
      ctx.supabase.from('whoop_sleep').select('end_at, sleep_minutes').eq('user_id', ctx.userId).eq('is_nap', false).gte('end_at', range.from).lt('end_at', range.to),
      ctx.supabase.from('whoop_cycles').select('start_at, strain').eq('user_id', ctx.userId).gte('start_at', range.from).lt('start_at', range.to),
      ctx.supabase.from('whoop_workouts').select('start_at').eq('user_id', ctx.userId).gte('start_at', range.from).lt('start_at', range.to),
    ]);
    for (const r of [rec, sleep, cycles, workouts]) if (r.error) throw new McpError('db_error', r.error.message);

    const key = (date: string) => (granularity === 'week' ? isoWeek(date) : date);
    const buckets = new Map<string, Bucket>();
    const bucket = (k: string): Bucket => {
      let b = buckets.get(k);
      if (!b) {
        b = { recovery: [], hrv: [], rhr: [], sleep: [], strain: [], workouts: 0 };
        buckets.set(k, b);
      }
      return b;
    };

    for (const r of rec.data ?? []) {
      const b = bucket(key(r.date));
      if (r.score != null) b.recovery.push(r.score);
      if (r.hrv_rmssd_milli != null) b.hrv.push(Number(r.hrv_rmssd_milli));
      if (r.resting_heart_rate != null) b.rhr.push(r.resting_heart_rate);
    }
    for (const s of sleep.data ?? []) {
      if (s.sleep_minutes != null) bucket(key(todayMadrid(new Date(s.end_at)))).sleep.push(s.sleep_minutes / 60);
    }
    for (const c of cycles.data ?? []) {
      if (c.strain != null) bucket(key(todayMadrid(new Date(c.start_at)))).strain.push(Number(c.strain));
    }
    for (const w of workouts.data ?? []) bucket(key(todayMadrid(new Date(w.start_at)))).workouts += 1;

    const rows = [...buckets.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([period, b]) => ({
        period,
        recovery_avg: avg(b.recovery),
        hrv_ms_avg: avg(b.hrv),
        rhr_avg: avg(b.rhr),
        sleep_h_avg: avg(b.sleep),
        strain_avg: avg(b.strain),
        workouts: b.workouts,
      }));
    return { granularity, rows };
  },
});
