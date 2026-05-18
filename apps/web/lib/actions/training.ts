'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const sessionStatusSchema = z.enum(['scheduled', 'done', 'skipped', 'partial']);

const createSessionSchema = z.object({
  scheduledFor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
  type: z.string().trim().max(40).optional(),
  notes: z.string().max(500).optional(),
});

const addSetSchema = z.object({
  sessionId: z.string().uuid(),
  exercise: z.string().trim().min(1).max(80),
  setNumber: z.number().int().positive().max(50),
  reps: z.number().int().positive().max(200).optional(),
  weightKg: z.number().min(0).max(1000).optional(),
  rpe: z.number().int().min(1).max(10).optional(),
  isWarmup: z.boolean().optional(),
});

const updateSetSchema = z.object({
  setId: z.string().uuid(),
  reps: z.number().int().positive().max(200).nullish(),
  weightKg: z.number().min(0).max(1000).nullish(),
  rpe: z.number().int().min(1).max(10).nullish(),
  exercise: z.string().trim().min(1).max(80).optional(),
  isWarmup: z.boolean().optional(),
});

const rescheduleSchema = z.object({
  sessionId: z.string().uuid(),
  scheduledFor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
});

const substituteSchema = z.object({
  sessionId: z.string().uuid(),
  newType: z.string().trim().min(1).max(40),
  scheduledFor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD').optional(),
  notes: z.string().max(500).optional(),
});

const markDoneSchema = z.object({
  sessionId: z.string().uuid(),
  status: sessionStatusSchema,
  rpe: z.number().int().min(1).max(10).optional(),
  notes: z.string().max(500).optional(),
});

export interface ActionResult<T = void> {
  ok: boolean;
  error?: string;
  data?: T;
}

export interface SessionRow {
  id: string;
  scheduled_for: string;
  type: string | null;
  status: string;
  done_at: string | null;
  rpe: number | null;
  notes: string | null;
  whoop_workout_id: string | null;
}

export interface SetRow {
  id: string;
  session_id: string;
  exercise: string;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
  rpe: number | null;
  is_warmup: boolean;
}

export async function createSession(
  input: z.infer<typeof createSessionSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createSessionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'invalid_input' };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  const { data, error } = await supabase
    .from('training_sessions')
    .insert({
      user_id: user.id,
      scheduled_for: parsed.data.scheduledFor,
      type: parsed.data.type ?? null,
      notes: parsed.data.notes ?? null,
      status: 'scheduled',
    })
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath('/');
  return { ok: true, data: { id: data.id } };
}

export async function markSessionDone(
  input: z.infer<typeof markDoneSchema>,
): Promise<ActionResult> {
  const parsed = markDoneSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'invalid_input' };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  const { error } = await supabase
    .from('training_sessions')
    .update({
      status: parsed.data.status,
      rpe: parsed.data.rpe ?? null,
      notes: parsed.data.notes ?? null,
      done_at: parsed.data.status === 'done' ? new Date().toISOString() : null,
    })
    .eq('id', parsed.data.sessionId);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/');
  return { ok: true };
}

export async function addSet(
  input: z.infer<typeof addSetSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = addSetSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'invalid_input' };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  const { data, error } = await supabase
    .from('training_sets')
    .insert({
      session_id: parsed.data.sessionId,
      user_id: user.id,
      exercise: parsed.data.exercise,
      set_number: parsed.data.setNumber,
      reps: parsed.data.reps ?? null,
      weight_kg: parsed.data.weightKg ?? null,
      rpe: parsed.data.rpe ?? null,
      is_warmup: parsed.data.isWarmup ?? false,
    })
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath('/');
  return { ok: true, data: { id: data.id } };
}

export async function deleteSession(id: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: 'invalid_id' };
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  const { error } = await supabase.from('training_sessions').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/');
  return { ok: true };
}

export async function updateSessionNotes(
  sessionId: string,
  notes: string,
): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(sessionId).success) {
    return { ok: false, error: 'invalid_id' };
  }
  if (notes.length > 2000) {
    return { ok: false, error: 'notes_too_long' };
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  const { error } = await supabase
    .from('training_sessions')
    .update({ notes: notes.trim() || null })
    .eq('id', sessionId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/');
  return { ok: true };
}

export async function listRecentSessions(limit = 14): Promise<SessionRow[]> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('training_sessions')
    .select('id, scheduled_for, type, status, done_at, rpe, notes, whoop_workout_id')
    .eq('user_id', user.id)
    .order('scheduled_for', { ascending: false })
    .limit(limit);

  return data ?? [];
}

export interface WhoopWorkoutLite {
  whoop_id: string;
  sport: string | null;
  start_at: string;
  end_at: string | null;
  strain: number | null;
  avg_hr: number | null;
}

export async function linkWhoopWorkout(
  sessionId: string,
  whoopWorkoutId: string,
): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(sessionId).success) {
    return { ok: false, error: 'invalid_session_id' };
  }
  if (typeof whoopWorkoutId !== 'string' || whoopWorkoutId.length === 0) {
    return { ok: false, error: 'invalid_whoop_id' };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  const { data: workout, error: wErr } = await supabase
    .from('whoop_workouts')
    .select('whoop_id, start_at, end_at')
    .eq('user_id', user.id)
    .eq('whoop_id', whoopWorkoutId)
    .maybeSingle();
  if (wErr || !workout) {
    return { ok: false, error: 'workout_not_found' };
  }

  const scheduledFor = workout.start_at.slice(0, 10);
  const { error: upErr } = await supabase
    .from('training_sessions')
    .update({
      whoop_workout_id: workout.whoop_id,
      status: 'done',
      done_at: workout.end_at,
      scheduled_for: scheduledFor,
    })
    .eq('id', sessionId)
    .eq('user_id', user.id);
  if (upErr) return { ok: false, error: upErr.message };

  revalidatePath('/plan');
  return { ok: true };
}

export async function unlinkWhoopWorkout(sessionId: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(sessionId).success) {
    return { ok: false, error: 'invalid_session_id' };
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  const { count: setsCount } = await supabase
    .from('training_sets')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', sessionId);

  const patch: Record<string, unknown> = { whoop_workout_id: null };
  if ((setsCount ?? 0) === 0) {
    patch.status = 'scheduled';
    patch.done_at = null;
  }

  const { error } = await supabase
    .from('training_sessions')
    .update(patch)
    .eq('id', sessionId)
    .eq('user_id', user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/plan');
  return { ok: true };
}

export async function listUnlinkedWhoopWorkoutsForWeek(
  weekStart: string,
): Promise<WhoopWorkoutLite[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return [];
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const monday = new Date(weekStart + 'T00:00:00');
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const { data: workouts } = await supabase
    .from('whoop_workouts')
    .select('whoop_id, sport, start_at, end_at, strain, avg_hr')
    .eq('user_id', user.id)
    .gte('start_at', monday.toISOString())
    .lte('start_at', sunday.toISOString())
    .order('start_at', { ascending: true });

  if (!workouts || workouts.length === 0) return [];

  const ids = workouts.map((w) => w.whoop_id as string);
  const { data: linked } = await supabase
    .from('training_sessions')
    .select('whoop_workout_id')
    .eq('user_id', user.id)
    .in('whoop_workout_id', ids);
  const linkedSet = new Set(
    (linked ?? []).map((l) => l.whoop_workout_id as string),
  );

  return (workouts as WhoopWorkoutLite[]).filter(
    (w) => !linkedSet.has(w.whoop_id),
  );
}

export async function listSetsForSession(sessionId: string): Promise<SetRow[]> {
  if (!z.string().uuid().safeParse(sessionId).success) return [];
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('training_sets')
    .select('id, session_id, exercise, set_number, reps, weight_kg, rpe, is_warmup')
    .eq('session_id', sessionId)
    .order('set_number', { ascending: true });

  return data ?? [];
}

export async function updateSet(
  input: z.infer<typeof updateSetSchema>,
): Promise<ActionResult> {
  const parsed = updateSetSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'invalid_input' };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  const patch: Record<string, unknown> = {};
  if (parsed.data.reps !== undefined) patch.reps = parsed.data.reps;
  if (parsed.data.weightKg !== undefined) patch.weight_kg = parsed.data.weightKg;
  if (parsed.data.rpe !== undefined) patch.rpe = parsed.data.rpe;
  if (parsed.data.exercise !== undefined) patch.exercise = parsed.data.exercise;
  if (parsed.data.isWarmup !== undefined) patch.is_warmup = parsed.data.isWarmup;

  if (Object.keys(patch).length === 0) {
    return { ok: false, error: 'no_fields_to_update' };
  }

  const { error } = await supabase
    .from('training_sets')
    .update(patch)
    .eq('id', parsed.data.setId);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/plan');
  return { ok: true };
}

export async function deleteSet(setId: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(setId).success) {
    return { ok: false, error: 'invalid_id' };
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  const { error } = await supabase.from('training_sets').delete().eq('id', setId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/plan');
  return { ok: true };
}

export async function rescheduleSession(
  input: z.infer<typeof rescheduleSchema>,
): Promise<ActionResult> {
  const parsed = rescheduleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'invalid_input' };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  const { error } = await supabase
    .from('training_sessions')
    .update({ scheduled_for: parsed.data.scheduledFor })
    .eq('id', parsed.data.sessionId);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/plan');
  return { ok: true };
}

// substituteSession: marca la original como skipped y crea una nueva del tipo
// indicado en la misma fecha (o en otra si se pasa scheduledFor). Las dos
// quedan visibles en el día; el usuario ve la original tachada.
export async function substituteSession(
  input: z.infer<typeof substituteSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = substituteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'invalid_input' };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  const { data: original, error: readErr } = await supabase
    .from('training_sessions')
    .select('id, scheduled_for')
    .eq('id', parsed.data.sessionId)
    .single();

  if (readErr || !original) {
    return { ok: false, error: 'session_not_found' };
  }

  const { error: skipErr } = await supabase
    .from('training_sessions')
    .update({ status: 'skipped' })
    .eq('id', parsed.data.sessionId);

  if (skipErr) return { ok: false, error: skipErr.message };

  const { data: created, error: createErr } = await supabase
    .from('training_sessions')
    .insert({
      user_id: user.id,
      scheduled_for: parsed.data.scheduledFor ?? original.scheduled_for,
      type: parsed.data.newType,
      notes: parsed.data.notes ?? null,
      status: 'scheduled',
    })
    .select('id')
    .single();

  if (createErr) return { ok: false, error: createErr.message };
  revalidatePath('/plan');
  return { ok: true, data: { id: created.id } };
}
