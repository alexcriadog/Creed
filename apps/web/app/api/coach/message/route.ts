/**
 * Coach message — POST /api/coach/message
 *
 * Body: { conversationId: uuid, agentRole, message }
 * Llama runAgent() y devuelve la respuesta final del coach + tool calls.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { runAgent, type AgentRole } from '@creed/agents';
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

const requestSchema = z.object({
  conversationId: z.string().uuid(),
  agentRole: z.enum(['nutrition', 'training', 'general']),
  message: z.string().trim().min(1).max(4000),
});

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_body', message: parsed.error.issues[0]?.message },
      { status: 400 },
    );
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'groq_not_configured' }, { status: 503 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data: conv, error: convErr } = await supabase
    .from('conversations')
    .select('id, status')
    .eq('id', parsed.data.conversationId)
    .single();
  if (convErr || !conv) {
    return NextResponse.json({ error: 'conversation_not_found' }, { status: 404 });
  }
  if (conv.status !== 'active') {
    return NextResponse.json({ error: 'conversation_closed' }, { status: 400 });
  }

  const admin = createSupabaseServiceRoleClient();

  try {
    const result = await runAgent({
      apiKey,
      supabase: admin,
      userId: user.id,
      conversationId: parsed.data.conversationId,
      agentRole: parsed.data.agentRole as AgentRole,
      userMessage: parsed.data.message,
    });
    return NextResponse.json({
      assistantText: result.assistantText,
      turn: result.turn,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      toolCalls: result.toolCalls.map((t) => ({
        name: t.name,
        result: t.result,
        error: t.error,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    console.error('[coach.message] threw', message, err);
    return NextResponse.json(
      { error: 'agent_failed', message: message.slice(0, 300) },
      { status: 500 },
    );
  }
}
