'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const nutritionSchema = z.object({
  goal: z.enum(['lose_fat', 'maintain', 'build_muscle', 'recomp', 'performance']),
  meals_per_day: z.number().int().min(1).max(8),
  cooking_style: z.enum(['cook_self', 'mixed', 'order_made']),
  hydration_l: z.number().min(0).max(10).optional().nullable(),
  alcohol: z.enum(['never', 'occasional', 'weekly', 'daily']),
  restrictions: z.array(z.string()).max(20).optional(),
  supplements: z.array(z.string()).max(20).optional(),
  target_weight_kg: z.number().min(20).max(300).optional().nullable(),
  target_weeks: z.number().int().min(1).max(104).optional().nullable(),
  free_notes: z.string().max(2000).optional(),
});

const trainingSchema = z.object({
  years_training: z.number().int().min(0).max(60),
  days_per_week: z.number().int().min(0).max(7),
  location: z.enum([
    'gym_commercial',
    'gym_specialized',
    'home_full',
    'home_basic',
    'outdoor',
    'mixed',
  ]),
  equipment: z.array(z.string()).max(30).optional(),
  primary_goal: z.enum([
    'strength',
    'hypertrophy',
    'endurance',
    'general_health',
    'sport_specific',
  ]),
  injuries: z.array(z.string()).max(20).optional(),
  blocked_movements: z.array(z.string()).max(20).optional(),
  cardio_minutes_week: z.number().int().min(0).max(2000).optional().nullable(),
  self_level: z.enum(['beginner', 'intermediate', 'advanced']),
  free_notes: z.string().max(2000).optional(),
});

async function ensureUser(): Promise<{ userId: string } | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  // Idempotencia: si por algún motivo no existe athlete_folder, lo creamos.
  await supabase
    .from('athlete_folder')
    .upsert({ user_id: user.id }, { onConflict: 'user_id', ignoreDuplicates: true });
  return { userId: user.id };
}

async function maybeMarkOnboardingComplete(userId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data: folder } = await supabase
    .from('athlete_folder')
    .select('nutrition_onboarding_completed_at, training_onboarding_completed_at')
    .eq('user_id', userId)
    .single();
  if (
    folder?.nutrition_onboarding_completed_at &&
    folder?.training_onboarding_completed_at
  ) {
    await supabase
      .from('profiles')
      .update({ onboarding_status: 'complete' })
      .eq('id', userId);
  }
}

function arr(formData: FormData, key: string): string[] {
  return formData.getAll(key).map((v) => String(v)).filter(Boolean);
}

function num(formData: FormData, key: string): number | null {
  const v = formData.get(key);
  if (v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function saveNutritionOnboarding(formData: FormData): Promise<void> {
  const auth = await ensureUser();
  if (!auth) redirect('/login');

  const parsed = nutritionSchema.safeParse({
    goal: formData.get('goal'),
    meals_per_day: Number(formData.get('meals_per_day') ?? 4),
    cooking_style: formData.get('cooking_style'),
    hydration_l: num(formData, 'hydration_l'),
    alcohol: formData.get('alcohol'),
    restrictions: arr(formData, 'restrictions'),
    supplements: arr(formData, 'supplements'),
    target_weight_kg: num(formData, 'target_weight_kg'),
    target_weeks: num(formData, 'target_weeks'),
    free_notes: String(formData.get('free_notes') ?? ''),
  });

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'invalid_input';
    redirect(`/onboarding/nutrition?error=${encodeURIComponent(msg)}`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('athlete_folder')
    .update({
      nutrition: parsed.data,
      nutrition_onboarding_completed_at: new Date().toISOString(),
    })
    .eq('user_id', auth.userId);

  if (error) {
    redirect(`/onboarding/nutrition?error=${encodeURIComponent(error.message)}`);
  }

  await maybeMarkOnboardingComplete(auth.userId);
  revalidatePath('/onboarding/nutrition');
  revalidatePath('/onboarding/training');
  redirect('/onboarding/training');
}

export async function saveTrainingOnboarding(formData: FormData): Promise<void> {
  const auth = await ensureUser();
  if (!auth) redirect('/login');

  const parsed = trainingSchema.safeParse({
    years_training: Number(formData.get('years_training') ?? 0),
    days_per_week: Number(formData.get('days_per_week') ?? 3),
    location: formData.get('location'),
    equipment: arr(formData, 'equipment'),
    primary_goal: formData.get('primary_goal'),
    injuries: arr(formData, 'injuries'),
    blocked_movements: arr(formData, 'blocked_movements'),
    cardio_minutes_week: num(formData, 'cardio_minutes_week'),
    self_level: formData.get('self_level'),
    free_notes: String(formData.get('free_notes') ?? ''),
  });

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'invalid_input';
    redirect(`/onboarding/training?error=${encodeURIComponent(msg)}`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('athlete_folder')
    .update({
      training: parsed.data,
      training_onboarding_completed_at: new Date().toISOString(),
    })
    .eq('user_id', auth.userId);

  if (error) {
    redirect(`/onboarding/training?error=${encodeURIComponent(error.message)}`);
  }

  await maybeMarkOnboardingComplete(auth.userId);
  revalidatePath('/onboarding/training');
  revalidatePath('/');
  redirect('/');
}
