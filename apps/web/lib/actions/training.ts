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
