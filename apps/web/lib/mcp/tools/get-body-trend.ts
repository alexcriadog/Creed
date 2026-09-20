import { z } from 'zod';
import { defineTool, McpError } from '../types';
import { todayMadrid } from '../dates';

function parseNotes(notes: string | null): { muscle_mass_kg?: number; notes?: string } {
  if (!notes) return {};
  try {
    const parsed = JSON.parse(notes) as { muscle_mass_kg?: number; notes?: string };
    return typeof parsed === 'object' && parsed ? parsed : { notes };
  } catch {
    return { notes };
  }
}

const num = (v: number | null | undefined): number | undefined => (v == null ? undefined : Number(v));

export const getBodyTrendTool = defineTool({
  name: 'get_body_trend',
  description:
    'Evolución de peso y composición corporal: medidas manuales o de la nutricionista (peso, % grasa, masa ' +
    'muscular, perímetros) y el peso que reporta Whoop, de más reciente a más antigua. Úsala para valorar ' +
    'tendencia de peso o el resultado de una fase.',
  inputSchema: z.object({ limit: z.number().int().min(1).max(60).default(30) }),
  handler: async (ctx, { limit }) => {
    const [manual, whoop] = await Promise.all([
      ctx.supabase
        .from('body_measurements')
        .select('measured_at, weight_kg, body_fat_pct, waist_cm, hip_cm, chest_cm, arm_cm, thigh_cm, notes')
        .eq('user_id', ctx.userId)
        .order('measured_at', { ascending: false })
        .limit(limit),
      ctx.supabase
        .from('whoop_body_measurements')
        .select('synced_at, weight_kg, height_m, max_hr')
        .eq('user_id', ctx.userId)
        .order('synced_at', { ascending: false })
        .limit(limit),
    ]);
    if (manual.error) throw new McpError('db_error', manual.error.message);
    if (whoop.error) throw new McpError('db_error', whoop.error.message);

    const rows = [
      ...(manual.data ?? []).map((m) => {
        const extra = parseNotes(m.notes);
        return {
          at: m.measured_at as string,
          date: todayMadrid(new Date(m.measured_at)),
          source: 'manual' as const,
          weight_kg: num(m.weight_kg),
          body_fat_pct: num(m.body_fat_pct),
          muscle_mass_kg: extra.muscle_mass_kg,
          waist_cm: num(m.waist_cm),
          hip_cm: num(m.hip_cm),
          chest_cm: num(m.chest_cm),
          arm_cm: num(m.arm_cm),
          thigh_cm: num(m.thigh_cm),
          notes: extra.notes,
        };
      }),
      ...(whoop.data ?? []).map((w) => ({
        at: w.synced_at as string,
        date: todayMadrid(new Date(w.synced_at)),
        source: 'whoop' as const,
        weight_kg: num(w.weight_kg),
        height_m: num(w.height_m),
        max_hr: w.max_hr ?? undefined,
      })),
    ]
      .sort((a, b) => (a.at < b.at ? 1 : -1))
      .slice(0, limit)
      .map(({ at: _at, ...rest }) => rest);

    return { measurements: rows };
  },
});
