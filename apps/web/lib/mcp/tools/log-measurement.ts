import { z } from 'zod';
import { defineTool, McpError } from '../types';
import { startOfDayMadrid } from '../dates';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export const logMeasurementTool = defineTool({
  name: 'log_measurement',
  description:
    'Guarda medidas corporales: peso de báscula, composición corporal (bioimpedancia/InBody de la nutricionista) ' +
    'o perímetros. Úsala cuando el usuario comparta un peso, un informe de composición o medidas. Si además ' +
    'comparte el informe completo, guárdalo también con save_document. measured_at acepta YYYY-MM-DD o ISO 8601.',
  inputSchema: z.object({
    measured_at: z.string().min(10).max(40),
    weight_kg: z.number().min(20).max(400).optional(),
    body_fat_pct: z.number().min(0).max(70).optional(),
    muscle_mass_kg: z.number().min(5).max(150).optional(),
    waist_cm: z.number().min(30).max(250).optional(),
    hip_cm: z.number().min(30).max(250).optional(),
    chest_cm: z.number().min(30).max(250).optional(),
    arm_cm: z.number().min(10).max(100).optional(),
    thigh_cm: z.number().min(20).max(150).optional(),
    notes: z.string().max(1000).optional().describe('Origen (báscula, InBody…) u observaciones'),
  }),
  handler: async (ctx, input) => {
    const measuredAt = ISO_DAY.test(input.measured_at)
      ? startOfDayMadrid(input.measured_at)
      : new Date(input.measured_at);
    if (Number.isNaN(measuredAt.getTime())) {
      throw new McpError('invalid_date', `Fecha inválida "${input.measured_at}".`);
    }

    // muscle_mass_kg y notas van serializados en notes: la tabla no tiene columna propia.
    const extra: Record<string, unknown> = {};
    if (input.muscle_mass_kg !== undefined) extra.muscle_mass_kg = input.muscle_mass_kg;
    if (input.notes) extra.notes = input.notes;

    const { data, error } = await ctx.supabase
      .from('body_measurements')
      .insert({
        user_id: ctx.userId,
        measured_at: measuredAt.toISOString(),
        weight_kg: input.weight_kg ?? null,
        body_fat_pct: input.body_fat_pct ?? null,
        waist_cm: input.waist_cm ?? null,
        hip_cm: input.hip_cm ?? null,
        chest_cm: input.chest_cm ?? null,
        arm_cm: input.arm_cm ?? null,
        thigh_cm: input.thigh_cm ?? null,
        notes: Object.keys(extra).length ? JSON.stringify(extra) : null,
      })
      .select('id')
      .single();
    if (error) throw new McpError('db_error', error.message);

    const { notes: _notes, measured_at: _m, ...echo } = input;
    return { measurement_id: data.id, measured_at: measuredAt.toISOString(), ...echo };
  },
});
