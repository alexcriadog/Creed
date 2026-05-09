/**
 * Coach conversations — GET (list) / POST (create new).
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const createSchema = z.object({
  agentRole: z.enum(['nutrition', 'training', 'general']),
  title: z.string().trim().max(120).optional(),
});

export async function GET(): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('conversations')
    .select('id, agent_role, mode, status, title, last_message_at, created_at')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('last_message_at', { ascending: false })
    .limit(20);
  if (error) {
    return NextResponse.json(
      { error: 'db_error', message: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ conversations: data ?? [] });
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('conversations')
    .insert({
      user_id: user.id,
      agent_role: parsed.data.agentRole,
      mode: 'normal',
      title: parsed.data.title ?? null,
    })
    .select('id, agent_role, mode, status, title, created_at, last_message_at')
    .single();
  if (error) {
    return NextResponse.json(
      { error: 'db_error', message: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ conversation: data });
}
