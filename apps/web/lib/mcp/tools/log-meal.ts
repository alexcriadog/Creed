import { z } from 'zod';
import { defineTool, McpError } from '../types';
import { isoInstant } from '../schemas';

export const logMealTool = defineTool({
  name: 'log_meal',
  description:
    'Registra una comida con kcal y macros ESTIMADOS por ti a partir de lo que el usuario describe o fotografía. ' +
    'Úsala cada vez que el usuario diga qué ha comido. Estima con raciones típicas españolas; si la descripción ' +
    'es muy vaga ("he cenado"), pide una aclaración corta antes de guardar. Guarda siempre la descripción ' +
    'original. Ejemplo: { "consumed_at": "2026-09-20T08:30:00+02:00", "meal_type": "breakfast", ' +
    '"description": "3 huevos revueltos, tostada integral, café con leche", "kcal": 480, "protein_g": 27, ' +
    '"carbs_g": 32, "fat_g": 26 }',
  inputSchema: z.object({
    consumed_at: isoInstant.describe('Instante ISO 8601 con zona (p. ej. 2026-09-20T08:30:00+02:00)'),
    meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack', 'other']).optional(),
    description: z.string().min(2).max(1000).describe('Lo que el usuario ha dicho que ha comido, literal'),
    kcal: z.number().int().min(0).max(10000),
    protein_g: z.number().min(0).max(1000),
    carbs_g: z.number().min(0).max(2000),
    fat_g: z.number().min(0).max(1000),
    items: z
      .array(z.object({ name: z.string().max(80), grams: z.number().min(0).max(5000).optional() }))
      .max(30)
      .optional()
      .describe('Desglose opcional por alimento'),
    confidence: z.enum(['estimated', 'measured']).default('estimated'),
  }),
  handler: async (ctx, input) => {
    const { data, error } = await ctx.supabase
      .from('meals')
      .insert({
        user_id: ctx.userId,
        consumed_at: input.consumed_at,
        meal_type: input.meal_type ?? null,
        raw_text: input.description,
        parsed: input.items ? { items: input.items } : null,
        total_calories: input.kcal,
        total_protein_g: input.protein_g,
        total_carbs_g: input.carbs_g,
        total_fat_g: input.fat_g,
        parser_version: 'claude-mcp',
        source: 'claude',
        confidence: input.confidence,
      })
      .select('id')
      .single();
    if (error) throw new McpError('db_error', error.message);
    return {
      meal_id: data.id,
      consumed_at: input.consumed_at,
      meal_type: input.meal_type,
      kcal: input.kcal,
      protein_g: input.protein_g,
      carbs_g: input.carbs_g,
      fat_g: input.fat_g,
    };
  },
});
