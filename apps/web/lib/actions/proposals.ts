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
  proposal_type: 'training_session' | 'meal_target' | 'weight_target';
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

  revalidatePath('/chat');
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
  revalidatePath('/chat');
  return { ok: true };
}
