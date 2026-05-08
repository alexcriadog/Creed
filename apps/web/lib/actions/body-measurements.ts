'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const logWeightSchema = z.object({
  weightKg: z.number().positive().max(500),
  bodyFatPct: z.number().min(0).max(70).optional(),
  measuredAt: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
});

export interface LogWeightInput {
  weightKg: number;
  bodyFatPct?: number;
  measuredAt?: string;
  notes?: string;
}

export interface ActionResult<T = void> {
  ok: boolean;
  error?: string;
  data?: T;
}

export interface BodyMeasurementRow {
  id: string;
  measured_at: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  notes: string | null;
}

export async function logWeight(
  input: LogWeightInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = logWeightSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'invalid_input' };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  const { data, error } = await supabase
    .from('body_measurements')
    .insert({
      user_id: user.id,
      measured_at: parsed.data.measuredAt ?? new Date().toISOString(),
      weight_kg: parsed.data.weightKg,
      body_fat_pct: parsed.data.bodyFatPct ?? null,
      notes: parsed.data.notes ?? null,
    })
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath('/');
  return { ok: true, data: { id: data.id } };
}

export async function deleteMeasurement(id: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: 'invalid_id' };
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  const { error } = await supabase.from('body_measurements').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/');
  return { ok: true };
}

export async function listRecentMeasurements(limit = 30): Promise<BodyMeasurementRow[]> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('body_measurements')
    .select('id, measured_at, weight_kg, body_fat_pct, notes')
    .eq('user_id', user.id)
    .order('measured_at', { ascending: false })
    .limit(limit);

  return data ?? [];
}
