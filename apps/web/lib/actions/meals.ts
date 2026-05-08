'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const mealTypeSchema = z.enum(['breakfast', 'lunch', 'dinner', 'snack', 'other']);

const createMealSchema = z.object({
  rawText: z.string().trim().min(1).max(2000),
  mealType: mealTypeSchema.optional(),
  consumedAt: z.string().datetime().optional(),
});

export interface CreateMealInput {
  rawText: string;
  mealType?: z.infer<typeof mealTypeSchema>;
  consumedAt?: string;
}

export interface ActionResult<T = void> {
  ok: boolean;
  error?: string;
  data?: T;
}

export interface MealRow {
  id: string;
  consumed_at: string;
  meal_type: string | null;
  raw_text: string;
  total_calories: number | null;
  total_protein_g: number | null;
  parser_confidence: number | null;
}

export async function createMeal(
  input: CreateMealInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createMealSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'invalid_input' };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  const { data, error } = await supabase
    .from('meals')
    .insert({
      user_id: user.id,
      consumed_at: parsed.data.consumedAt ?? new Date().toISOString(),
      meal_type: parsed.data.mealType ?? null,
      raw_text: parsed.data.rawText,
    })
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath('/');
  return { ok: true, data: { id: data.id } };
}

export async function deleteMeal(id: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: 'invalid_id' };
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  const { error } = await supabase.from('meals').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/');
  return { ok: true };
}

export async function listRecentMeals(limit = 10): Promise<MealRow[]> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('meals')
    .select('id, consumed_at, meal_type, raw_text, total_calories, total_protein_g, parser_confidence')
    .eq('user_id', user.id)
    .order('consumed_at', { ascending: false })
    .limit(limit);

  return data ?? [];
}

export async function countMealsToday(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from('meals')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('consumed_at', startOfDay.toISOString());

  return count ?? 0;
}
