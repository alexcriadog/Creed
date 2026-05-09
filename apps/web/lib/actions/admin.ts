'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export interface ActionResult<T = void> {
  ok: boolean;
  error?: string;
  data?: T;
}

const settingSchema = z.object({
  key: z.string().min(1).max(80),
  value: z.unknown(),
});

const modelAssignmentSchema = z.object({
  flow: z.enum([
    'nutritionist_chat',
    'trainer_chat',
    'orchestrator',
    'onboarding',
    'lapse_recovery',
    'weekly_close',
    'weekly_plan',
    'meal_parser',
    'conversation_compactor',
  ]),
  model: z.string().min(1).max(80),
});

const costLimitSchema = z.object({
  service: z.enum(['anthropic', 'whoop', 'groq']),
  monthlyCapEur: z.number().min(0).max(10000),
  alarmThresholdPct: z.number().int().min(1).max(100),
  pauseAtCap: z.boolean(),
});

async function ensureAdmin(): Promise<{ userId: string } | { error: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'unauthorized' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (profile?.role !== 'admin') return { error: 'forbidden' };
  return { userId: user.id };
}

export async function updateAppSetting(
  input: z.infer<typeof settingSchema>,
): Promise<ActionResult> {
  const parsed = settingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'invalid_input' };
  }
  const auth = await ensureAdmin();
  if ('error' in auth) return { ok: false, error: auth.error };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('app_settings')
    .update({
      value: parsed.data.value,
      updated_at: new Date().toISOString(),
      updated_by: auth.userId,
    })
    .eq('key', parsed.data.key);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin');
  revalidatePath('/admin/settings');
  return { ok: true };
}

export async function updateModelAssignment(
  input: z.infer<typeof modelAssignmentSchema>,
): Promise<ActionResult> {
  const parsed = modelAssignmentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'invalid_input' };
  }
  const auth = await ensureAdmin();
  if ('error' in auth) return { ok: false, error: auth.error };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('model_assignments')
    .update({
      model: parsed.data.model,
      updated_at: new Date().toISOString(),
      updated_by: auth.userId,
    })
    .eq('flow', parsed.data.flow);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/models');
  return { ok: true };
}

export async function updateCostLimit(
  input: z.infer<typeof costLimitSchema>,
): Promise<ActionResult> {
  const parsed = costLimitSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'invalid_input' };
  }
  const auth = await ensureAdmin();
  if ('error' in auth) return { ok: false, error: auth.error };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('cost_limits')
    .update({
      monthly_cap_eur: parsed.data.monthlyCapEur,
      alarm_threshold_pct: parsed.data.alarmThresholdPct,
      pause_at_cap: parsed.data.pauseAtCap,
      updated_at: new Date().toISOString(),
      updated_by: auth.userId,
    })
    .eq('service', parsed.data.service);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/models');
  return { ok: true };
}

export interface AuditLogRow {
  id: string;
  user_id: string | null;
  action: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export async function listAdminAuditLog(limit = 30): Promise<AuditLogRow[]> {
  const auth = await ensureAdmin();
  if ('error' in auth) return [];

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('audit_log')
    .select('id, user_id, action, metadata, created_at')
    .eq('action', 'admin_setting_changed')
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as AuditLogRow[];
}
