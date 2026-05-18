'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export interface ActionResult<T = void> {
  ok: boolean;
  error?: string;
  data?: T;
}

export interface ConversationListItem {
  id: string;
  agent_role: 'nutrition' | 'training' | 'general';
  mode: string | null;
  status: string;
  title: string | null;
  last_message_at: string | null;
  created_at: string;
  first_user_message: string | null;
}

const roleSchema = z.enum(['nutrition', 'training', 'general']);

export async function listConversationsForRole(
  role: z.infer<typeof roleSchema>,
  limit = 10,
): Promise<ConversationListItem[]> {
  if (!roleSchema.safeParse(role).success) return [];

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: convs } = await supabase
    .from('conversations')
    .select('id, agent_role, mode, status, title, last_message_at, created_at')
    .eq('user_id', user.id)
    .eq('agent_role', role)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!convs || convs.length === 0) return [];

  // Primer mensaje del usuario para usar como título cuando no hay uno.
  const ids = convs.map((c) => c.id as string);
  const { data: firstMsgs } = await supabase
    .from('messages')
    .select('conversation_id, content, turn')
    .in('conversation_id', ids)
    .eq('role', 'user')
    .order('turn', { ascending: true });

  const firstByConv = new Map<string, string>();
  for (const m of (firstMsgs ?? []) as Array<{
    conversation_id: string;
    content: string | null;
  }>) {
    if (!firstByConv.has(m.conversation_id) && m.content) {
      firstByConv.set(m.conversation_id, m.content);
    }
  }

  return convs.map((c) => {
    const first = firstByConv.get(c.id as string) ?? null;
    return {
      id: c.id as string,
      agent_role: c.agent_role as 'nutrition' | 'training' | 'general',
      mode: c.mode as string | null,
      status: c.status as string,
      title: c.title as string | null,
      last_message_at: c.last_message_at as string | null,
      created_at: c.created_at as string,
      first_user_message: first ? first.slice(0, 80) : null,
    };
  });
}

export async function archiveConversation(
  conversationId: string,
): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(conversationId).success) {
    return { ok: false, error: 'invalid_id' };
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  const { error } = await supabase
    .from('conversations')
    .update({ status: 'archived' })
    .eq('id', conversationId)
    .eq('user_id', user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/ia');
  return { ok: true };
}

export async function startNewConversation(
  role: z.infer<typeof roleSchema>,
  mode: 'normal' | 'onboarding' = 'normal',
): Promise<ActionResult<{ id: string }>> {
  if (!roleSchema.safeParse(role).success) {
    return { ok: false, error: 'invalid_role' };
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  // Archivar la conversation activa actual de ese role (si existe) para que
  // el listado no muestre dos "active" del mismo coach a la vez.
  await supabase
    .from('conversations')
    .update({ status: 'archived' })
    .eq('user_id', user.id)
    .eq('agent_role', role)
    .eq('status', 'active');

  const { data, error } = await supabase
    .from('conversations')
    .insert({
      user_id: user.id,
      agent_role: role,
      mode,
    })
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath('/ia');
  return { ok: true, data: { id: data.id as string } };
}
