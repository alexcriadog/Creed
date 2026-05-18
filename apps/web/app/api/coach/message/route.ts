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
  attachmentIds: z.array(z.string().uuid()).max(3).optional(),
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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'anthropic_not_configured' },
      { status: 503 },
    );
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

  // Resolver attachments si los hay. Solo se aceptan los que pertenecen al
  // usuario, a esta conversación y aún no han sido enlazados a otro mensaje.
  let resolvedAttachments: Array<{
    id: string;
    kind: 'image' | 'document';
    storage_path: string;
    mime_type: string;
    original_filename: string | null;
    extracted_text: string | null;
  }> = [];
  if (parsed.data.attachmentIds && parsed.data.attachmentIds.length > 0) {
    const { data: rows } = await admin
      .from('message_attachments')
      .select('id, kind, storage_path, mime_type, original_filename, extracted_text')
      .in('id', parsed.data.attachmentIds)
      .eq('user_id', user.id)
      .eq('conversation_id', parsed.data.conversationId)
      .is('message_id', null);
    resolvedAttachments = (rows ?? []) as typeof resolvedAttachments;
  }

  try {
    const result = await runAgent({
      apiKey,
      supabase: admin,
      userId: user.id,
      conversationId: parsed.data.conversationId,
      agentRole: parsed.data.agentRole as AgentRole,
      userMessage: parsed.data.message,
      attachments: resolvedAttachments,
    });

    // Enlazar attachments al mensaje recién creado por el agente. El runner
    // devuelve `userMessageId` para que podamos asociarlos.
    if (resolvedAttachments.length > 0 && result.userMessageId) {
      await admin
        .from('message_attachments')
        .update({ message_id: result.userMessageId })
        .in(
          'id',
          resolvedAttachments.map((a) => a.id),
        )
        .eq('user_id', user.id);
    }

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

    // Detección de rate-limit / cuota agotada del proveedor LLM (Groq, etc.).
    // Si el SDK lanza un Error con .status 429 o el mensaje contiene
    // 'rate limit', devolvemos un error tipado para que el cliente muestre
    // un mensaje amigable con el tiempo de reintento si se puede extraer.
    const status = (err as { status?: number } | null)?.status;
    const isRateLimit =
      status === 429 || /rate.?limit|too.?many.?requests|429/i.test(message);
    if (isRateLimit) {
      const retryMatch = message.match(/in\s+([0-9hms\.]+)/i);
      const retryAfter = retryMatch ? retryMatch[1] : null;
      return NextResponse.json(
        {
          error: 'rate_limit',
          message:
            'Servicio momentáneamente saturado. Reintenta en unos segundos.',
          retryAfter,
        },
        { status: 429 },
      );
    }

    return NextResponse.json(
      { error: 'agent_failed', message: message.slice(0, 300) },
      { status: 500 },
    );
  }
}
