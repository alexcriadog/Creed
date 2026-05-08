'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const logMoodEnergySchema = z.object({
  mood: z.number().int().min(1).max(5).optional(),
  energy: z.number().int().min(1).max(5).optional(),
  notes: z.string().max(500).optional(),
  loggedAt: z.string().datetime().optional(),
});

export interface ActionResult<T = void> {
  ok: boolean;
  error?: string;
  data?: T;
}

export interface LogMoodEnergyInput {
  mood?: number;
  energy?: number;
  notes?: string;
  loggedAt?: string;
}

export interface MoodEnergyRow {
  id: string;
  logged_at: string;
  mood: number | null;
  energy: number | null;
  notes: string | null;
}

export async function logMoodEnergy(
  input: LogMoodEnergyInput,
): Promise<ActionResult<{ id: string }>> {
  if (input.mood === undefined && input.energy === undefined) {
    return { ok: false, error: 'mood o energy requeridos' };
  }
  const parsed = logMoodEnergySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'invalid_input' };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  const { data, error } = await supabase
    .from('mood_energy_log')
    .insert({
      user_id: user.id,
      mood: parsed.data.mood ?? null,
      energy: parsed.data.energy ?? null,
      notes: parsed.data.notes ?? null,
      logged_at: parsed.data.loggedAt ?? new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath('/');
  return { ok: true, data: { id: data.id } };
}

export async function getLatestMoodEnergy(): Promise<MoodEnergyRow | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data } = await supabase
    .from('mood_energy_log')
    .select('id, logged_at, mood, energy, notes')
    .eq('user_id', user.id)
    .gte('logged_at', startOfDay.toISOString())
    .order('logged_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ?? null;
}
