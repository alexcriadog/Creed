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

const updateMealSchema = z.object({
  mealId: z.string().uuid(),
  rawText: z.string().trim().min(1).max(2000).optional(),
  mealType: mealTypeSchema.nullish(),
  photoPath: z.string().max(500).nullish(),
  totalCalories: z.number().min(0).max(20000).nullish(),
  totalProteinG: z.number().min(0).max(2000).nullish(),
  totalCarbsG: z.number().min(0).max(2000).nullish(),
  totalFatG: z.number().min(0).max(2000).nullish(),
  userCorrected: z.boolean().optional(),
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

export async function updateMeal(
  input: z.infer<typeof updateMealSchema>,
): Promise<ActionResult> {
  const parsed = updateMealSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'invalid_input' };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  const patch: Record<string, unknown> = {};
  if (parsed.data.rawText !== undefined) patch.raw_text = parsed.data.rawText;
  if (parsed.data.mealType !== undefined) patch.meal_type = parsed.data.mealType;
  if (parsed.data.photoPath !== undefined) patch.photo_path = parsed.data.photoPath;
  if (parsed.data.totalCalories !== undefined) patch.total_calories = parsed.data.totalCalories;
  if (parsed.data.totalProteinG !== undefined) patch.total_protein_g = parsed.data.totalProteinG;
  if (parsed.data.totalCarbsG !== undefined) patch.total_carbs_g = parsed.data.totalCarbsG;
  if (parsed.data.totalFatG !== undefined) patch.total_fat_g = parsed.data.totalFatG;
  if (parsed.data.userCorrected !== undefined) patch.user_corrected = parsed.data.userCorrected;

  if (Object.keys(patch).length === 0) {
    return { ok: false, error: 'no_fields_to_update' };
  }

  const { error } = await supabase.from('meals').update(patch).eq('id', parsed.data.mealId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/plan');
  return { ok: true };
}

// uploadMealPhoto: sube un File al bucket meal-photos en {user_id}/{mealId}/{filename}
// y guarda la ruta en meals.photo_path. Devuelve el path para invocar el parser
// con visión a continuación.
export async function uploadMealPhoto(
  mealId: string,
  file: File,
): Promise<ActionResult<{ photoPath: string }>> {
  if (!z.string().uuid().safeParse(mealId).success) {
    return { ok: false, error: 'invalid_id' };
  }
  if (file.size === 0) return { ok: false, error: 'empty_file' };
  if (file.size > 8 * 1024 * 1024) return { ok: false, error: 'file_too_large' };
  if (!file.type.startsWith('image/')) return { ok: false, error: 'not_an_image' };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  // Aseguramos que el meal pertenece al usuario antes de subir.
  const { data: meal, error: readErr } = await supabase
    .from('meals')
    .select('id')
    .eq('id', mealId)
    .single();
  if (readErr || !meal) return { ok: false, error: 'meal_not_found' };

  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : 'jpg';
  const safeExt = /^[a-z0-9]{1,5}$/.test(ext) ? ext : 'jpg';
  const path = `${user.id}/${mealId}/photo-${Date.now()}.${safeExt}`;

  const { error: uploadErr } = await supabase.storage
    .from('meal-photos')
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadErr) return { ok: false, error: uploadErr.message };

  const { error: updateErr } = await supabase
    .from('meals')
    .update({ photo_path: path })
    .eq('id', mealId);

  if (updateErr) return { ok: false, error: updateErr.message };

  revalidatePath('/plan');
  return { ok: true, data: { photoPath: path } };
}
