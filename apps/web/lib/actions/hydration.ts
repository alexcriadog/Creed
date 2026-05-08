'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const sourceSchema = z.enum(['water', 'coffee', 'tea', 'sports_drink', 'other']);

const logHydrationSchema = z.object({
  amountMl: z.number().int().positive().max(5000),
  source: sourceSchema.optional(),
  loggedAt: z.string().datetime().optional(),
});

export interface ActionResult<T = void> {
  ok: boolean;
  error?: string;
  data?: T;
}

export interface LogHydrationInput {
  amountMl: number;
  source?: z.infer<typeof sourceSchema>;
  loggedAt?: string;
}

export async function logHydration(
  input: LogHydrationInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = logHydrationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'invalid_input' };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  const { data, error } = await supabase
    .from('hydration_log')
    .insert({
      user_id: user.id,
      amount_ml: parsed.data.amountMl,
      source: parsed.data.source ?? 'water',
      logged_at: parsed.data.loggedAt ?? new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath('/');
  return { ok: true, data: { id: data.id } };
}

export async function sumHydrationToday(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data } = await supabase
    .from('hydration_log')
    .select('amount_ml')
    .eq('user_id', user.id)
    .gte('logged_at', startOfDay.toISOString());

  return (data ?? []).reduce((sum, r) => sum + (r.amount_ml ?? 0), 0);
}
