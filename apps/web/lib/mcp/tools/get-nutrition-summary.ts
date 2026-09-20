import { z } from 'zod';
import { defineTool, McpError } from '../types';
import { isoDay } from '../schemas';
import { assertDateRange, dayRangeMadrid, todayMadrid, TZ } from '../dates';
import { round1 } from '../format';

const timeFormatter = new Intl.DateTimeFormat('es-ES', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

interface DayAgg {
  date: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  meals: { time: string; type?: string; description: string; kcal?: number }[];
}

export const getNutritionSummaryTool = defineTool({
  name: 'get_nutrition_summary',
  description:
    'Resumen de comidas por día (kcal y macros, estimados) en un rango de hasta 31 días, con medias del periodo. ' +
    'Úsala para valorar si el usuario come acorde a su objetivo, revisar la proteína, o cruzarlo con entrenos y recovery.',
  inputSchema: z.object({ from: isoDay, to: isoDay }),
  handler: async (ctx, { from, to }) => {
    assertDateRange(from, to, 31);
    const { data, error } = await ctx.supabase
      .from('meals')
      .select('consumed_at, meal_type, raw_text, total_calories, total_protein_g, total_carbs_g, total_fat_g')
      .eq('user_id', ctx.userId)
      .gte('consumed_at', dayRangeMadrid(from).from)
      .lt('consumed_at', dayRangeMadrid(to).to)
      .order('consumed_at');
    if (error) throw new McpError('db_error', error.message);

    const byDay = new Map<string, DayAgg>();
    for (const m of data ?? []) {
      const at = new Date(m.consumed_at);
      const date = todayMadrid(at);
      const day = byDay.get(date) ?? { date, kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, meals: [] };
      day.kcal += m.total_calories ?? 0;
      day.protein_g += Number(m.total_protein_g ?? 0);
      day.carbs_g += Number(m.total_carbs_g ?? 0);
      day.fat_g += Number(m.total_fat_g ?? 0);
      day.meals.push({
        time: timeFormatter.format(at),
        type: m.meal_type ?? undefined,
        description: String(m.raw_text).slice(0, 120),
        kcal: m.total_calories ?? undefined,
      });
      byDay.set(date, day);
    }

    const days = [...byDay.values()].map((d) => ({
      ...d,
      protein_g: round1(d.protein_g),
      carbs_g: round1(d.carbs_g),
      fat_g: round1(d.fat_g),
    }));
    const n = days.length || 1;
    const sum = (k: 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g') => days.reduce((a, d) => a + d[k], 0);
    return {
      days,
      averages: {
        kcal: Math.round(sum('kcal') / n),
        protein_g: round1(sum('protein_g') / n),
        carbs_g: round1(sum('carbs_g') / n),
        fat_g: round1(sum('fat_g') / n),
        days_with_data: days.length,
      },
    };
  },
});
