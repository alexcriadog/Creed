'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export interface ActionResult<T = void> {
  ok: boolean;
  error?: string;
  data?: T;
}

export interface ProposalRow {
  id: string;
  agent: string;
  proposal_type:
    | 'training_session'
    | 'meal_target'
    | 'weight_target'
    | 'training_program'
    | 'session_update';
  payload: Record<string, unknown>;
  rationale: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  responded_at: string | null;
  message_id: string | null;
  applied_to_id: string | null;
}

export async function listPendingProposals(limit = 5): Promise<ProposalRow[]> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('agent_proposals')
    .select(
      'id, agent, proposal_type, payload, rationale, status, created_at, responded_at, message_id, applied_to_id',
    )
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as ProposalRow[];
}

export async function listProposalsForConversation(
  conversationId: string,
): Promise<ProposalRow[]> {
  if (!z.string().uuid().safeParse(conversationId).success) return [];
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('agent_proposals')
    .select(
      'id, agent, proposal_type, payload, rationale, status, created_at, responded_at, message_id, applied_to_id',
    )
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  return (data ?? []) as ProposalRow[];
}

interface TrainingSessionPayload {
  scheduled_for: string;
  type?: string;
  prescribed?: unknown;
}

interface MealTargetPayload {
  daily_calories?: number;
  daily_protein_g?: number;
  daily_carbs_g?: number;
  daily_fat_g?: number;
  hydration_l?: number;
}

interface WeightTargetPayload {
  target_weight_kg: number;
  target_date?: string;
}

export async function acceptProposal(proposalId: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(proposalId).success) {
    return { ok: false, error: 'invalid_id' };
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  const { data: prop, error: readErr } = await supabase
    .from('agent_proposals')
    .select('id, proposal_type, payload, status')
    .eq('id', proposalId)
    .single();
  if (readErr || !prop) return { ok: false, error: 'not_found' };
  if (prop.status !== 'pending') return { ok: false, error: 'already_responded' };

  let appliedToId: string | null = null;

  try {
    if (prop.proposal_type === 'training_session') {
      const p = prop.payload as TrainingSessionPayload;
      if (!p.scheduled_for) {
        return { ok: false, error: 'invalid_payload: scheduled_for required' };
      }
      const { data: session, error: insErr } = await supabase
        .from('training_sessions')
        .insert({
          user_id: user.id,
          scheduled_for: p.scheduled_for,
          type: p.type ?? null,
          prescribed: p.prescribed ?? null,
          status: 'scheduled',
        })
        .select('id')
        .single();
      if (insErr) return { ok: false, error: insErr.message };
      appliedToId = session.id;
    } else if (prop.proposal_type === 'meal_target') {
      const p = prop.payload as MealTargetPayload;
      const { data: folder } = await supabase
        .from('athlete_folder')
        .select('nutrition')
        .eq('user_id', user.id)
        .single();
      const merged = {
        ...((folder?.nutrition as Record<string, unknown>) ?? {}),
        targets: p,
        targets_set_at: new Date().toISOString(),
      };
      const { error: updErr } = await supabase
        .from('athlete_folder')
        .update({ nutrition: merged })
        .eq('user_id', user.id);
      if (updErr) return { ok: false, error: updErr.message };
    } else if (prop.proposal_type === 'session_update') {
      const p = prop.payload as {
        updates?: Array<{
          session_id: string;
          type?: string;
          prescribed?: unknown;
          notes?: string;
        }>;
      };
      const updates = p.updates ?? [];
      if (updates.length === 0) {
        return { ok: false, error: 'invalid_payload: empty updates' };
      }
      // Solo aplicamos a sesiones del usuario que estén status=scheduled.
      for (const u of updates) {
        const patch: Record<string, unknown> = {};
        if (u.type !== undefined) patch.type = u.type;
        if (u.prescribed !== undefined) patch.prescribed = u.prescribed;
        if (u.notes !== undefined) patch.notes = u.notes;
        if (Object.keys(patch).length === 0) continue;
        const { error: upErr } = await supabase
          .from('training_sessions')
          .update(patch)
          .eq('id', u.session_id)
          .eq('user_id', user.id)
          .eq('status', 'scheduled');
        if (upErr) return { ok: false, error: upErr.message };
      }
      revalidatePath('/plan');
    } else if (prop.proposal_type === 'training_program') {
      const p = prop.payload as {
        start_date?: string;
        period_weeks?: number;
        goal?: string;
        rationale?: string;
        sessions?: Array<{
          scheduled_for: string;
          type?: string;
          prescribed?: unknown;
        }>;
      };
      if (
        !p.start_date ||
        !p.period_weeks ||
        !Array.isArray(p.sessions) ||
        p.sessions.length === 0
      ) {
        return {
          ok: false,
          error: 'invalid_payload: program needs start_date, period_weeks, sessions[]',
        };
      }
      // 1. Supersede plan activo si existe.
      await supabase
        .from('training_plans')
        .update({ status: 'superseded' })
        .eq('user_id', user.id)
        .eq('status', 'active');
      // 2. Calcular period_end = start_date + (period_weeks*7 - 1) días.
      const startDate = new Date(p.start_date + 'T00:00:00');
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + p.period_weeks * 7 - 1);
      const periodEnd = endDate.toISOString().slice(0, 10);
      // 3. Crear nuevo plan activo.
      const { data: plan, error: planErr } = await supabase
        .from('training_plans')
        .insert({
          user_id: user.id,
          week_start: p.start_date,
          period_weeks: p.period_weeks,
          period_end: periodEnd,
          goal: p.goal ?? null,
          rationale: p.rationale ?? null,
          generated_by: 'trainer_agent',
          status: 'active',
        })
        .select('id')
        .single();
      if (planErr) return { ok: false, error: planErr.message };
      appliedToId = plan.id;
      // 4. Crear sesiones. Si las sesiones recibidas cubren UNA semana modelo
      //    (span < 7 días) y period_weeks > 1, replicamos el patrón a las N
      //    semanas. Esto permite al coach ahorrar tokens enviando solo la
      //    plantilla de una semana.
      const sessionDates = p.sessions.map((s) =>
        new Date(s.scheduled_for + 'T00:00:00').getTime(),
      );
      const minDate = Math.min(...sessionDates);
      const maxDate = Math.max(...sessionDates);
      const spanDays = (maxDate - minDate) / 86_400_000;
      const isOneWeekTemplate = spanDays < 7 && p.period_weeks > 1;

      const rows: Array<{
        plan_id: string;
        user_id: string;
        scheduled_for: string;
        type: string | null;
        prescribed: unknown;
        status: string;
      }> = [];

      const toIso = (d: Date): string => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      if (isOneWeekTemplate) {
        for (let w = 0; w < p.period_weeks; w++) {
          for (const s of p.sessions) {
            const d = new Date(s.scheduled_for + 'T00:00:00');
            d.setDate(d.getDate() + 7 * w);
            rows.push({
              plan_id: plan.id,
              user_id: user.id,
              scheduled_for: toIso(d),
              type: s.type ?? null,
              prescribed: s.prescribed ?? null,
              status: 'scheduled',
            });
          }
        }
      } else {
        for (const s of p.sessions) {
          rows.push({
            plan_id: plan.id,
            user_id: user.id,
            scheduled_for: s.scheduled_for,
            type: s.type ?? null,
            prescribed: s.prescribed ?? null,
            status: 'scheduled',
          });
        }
      }

      const { error: sessErr } = await supabase
        .from('training_sessions')
        .insert(rows);
      if (sessErr) return { ok: false, error: sessErr.message };
      revalidatePath('/plan');
    } else if (prop.proposal_type === 'weight_target') {
      const p = prop.payload as WeightTargetPayload;
      if (!p.target_weight_kg) {
        return { ok: false, error: 'invalid_payload: target_weight_kg required' };
      }
      const update: Record<string, unknown> = {
        target_weight_kg: p.target_weight_kg,
      };
      if (p.target_date) update.target_date = p.target_date;
      const { error: updErr } = await supabase
        .from('athlete_folder')
        .update(update)
        .eq('user_id', user.id);
      if (updErr) return { ok: false, error: updErr.message };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'apply_failed' };
  }

  const { error: markErr } = await supabase
    .from('agent_proposals')
    .update({
      status: 'accepted',
      responded_at: new Date().toISOString(),
      applied_to_id: appliedToId,
    })
    .eq('id', proposalId);
  if (markErr) return { ok: false, error: markErr.message };

  revalidatePath('/ia');
  revalidatePath('/');
  return { ok: true };
}

export async function rejectProposal(proposalId: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(proposalId).success) {
    return { ok: false, error: 'invalid_id' };
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  const { error } = await supabase
    .from('agent_proposals')
    .update({ status: 'rejected', responded_at: new Date().toISOString() })
    .eq('id', proposalId)
    .eq('status', 'pending');
  if (error) return { ok: false, error: error.message };
  revalidatePath('/ia');
  return { ok: true };
}
