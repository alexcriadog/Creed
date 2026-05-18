import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ChatClient, type AgentRole, type ChatMessage } from './chat-client';
import { listProposalsForConversation } from '@/lib/actions/proposals';
import { listConversationsForRole } from '@/lib/actions/conversations';
import { AppHeader } from '@/components/app-header';
import { BottomNav } from '@/components/bottom-nav';

export const dynamic = 'force-dynamic';

interface Conversation {
  id: string;
  agent_role: AgentRole | null;
  status: string;
  last_message_at: string;
}

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; conv?: string; conversationId?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const params = await searchParams;
  const requestedRole = (params.role ?? 'nutrition') as AgentRole;
  const validRole: AgentRole =
    requestedRole === 'training' || requestedRole === 'general'
      ? requestedRole
      : 'nutrition';

  // Solo carga la conversación si viene ?conv=<id>. Sin ese param, el cliente
  // muestra el listado (vista landing) y el usuario decide: tap en una para
  // continuarla, o escribir para empezar una nueva.
  let activeConv: Conversation | null = null;
  if (params.conv && /^[0-9a-f-]{36}$/i.test(params.conv)) {
    const { data } = await supabase
      .from('conversations')
      .select('id, agent_role, status, last_message_at')
      .eq('id', params.conv)
      .eq('user_id', user.id)
      .eq('agent_role', validRole)
      .maybeSingle();
    activeConv = (data ?? null) as Conversation | null;
  }

  const conversationList = await listConversationsForRole(validRole, 20);

  let initialMessages: ChatMessage[] = [];
  let initialProposals: Awaited<ReturnType<typeof listProposalsForConversation>> = [];
  if (activeConv) {
    const [msgsResp, attsResp, proposalsResp] = await Promise.all([
      supabase
        .from('messages')
        .select('id, turn, role, agent, content, created_at')
        .eq('conversation_id', activeConv.id)
        .in('role', ['user', 'assistant'])
        .order('turn', { ascending: true }),
      supabase
        .from('message_attachments')
        .select('id, message_id, kind, original_filename, mime_type')
        .eq('conversation_id', activeConv.id)
        .not('message_id', 'is', null),
      listProposalsForConversation(activeConv.id),
    ]);

    type AttRow = {
      id: string;
      message_id: string;
      kind: 'image' | 'document';
      original_filename: string | null;
      mime_type: string;
    };
    const attsByMessage = new Map<string, AttRow[]>();
    for (const a of ((attsResp.data ?? []) as AttRow[])) {
      const arr = attsByMessage.get(a.message_id) ?? [];
      arr.push(a);
      attsByMessage.set(a.message_id, arr);
    }

    initialMessages = (msgsResp.data ?? [])
      .filter((m) => m.content || attsByMessage.has(m.id))
      .map((m) => ({
        id: m.id,
        turn: m.turn,
        role: m.role as 'user' | 'assistant',
        content: (m.content as string | null) ?? '',
        attachments: (attsByMessage.get(m.id) ?? []).map((a) => ({
          id: a.id,
          kind: a.kind,
          filename: a.original_filename ?? a.mime_type,
        })),
      }));
    initialProposals = proposalsResp;
  }

  return (
    <>
      <main className="mx-auto flex h-[100dvh] max-w-md flex-col px-4 pb-28 pt-6 sm:max-w-lg sm:px-6 sm:pt-10">
        <AppHeader />

        <nav className="mb-4 flex gap-2" aria-label="Cambiar coach">
          <RoleTab
            href="/ia?role=nutrition"
            label="Nutricionista"
            active={validRole === 'nutrition'}
          />
          <RoleTab
            href="/ia?role=training"
            label="Coach"
            active={validRole === 'training'}
          />
        </nav>

        <ChatClient
          key={`${validRole}:${activeConv?.id ?? 'landing'}`}
          agentRole={validRole}
          initialConversationId={activeConv?.id ?? null}
          initialMessages={initialMessages}
          initialProposals={initialProposals}
          conversationList={conversationList}
        />
      </main>
      <BottomNav />
    </>
  );
}

function RoleTab({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className="rounded-[var(--radius-md)] px-3 py-1.5 text-[length:var(--text-sm)] font-medium transition"
      style={{
        background: active
          ? 'var(--color-accent)'
          : 'var(--color-surface-raised)',
        color: active
          ? 'var(--color-text-on-accent)'
          : 'var(--color-text-secondary)',
        border: active
          ? '1px solid var(--color-accent)'
          : '1px solid var(--color-border-default)',
      }}
    >
      {label}
    </Link>
  );
}
