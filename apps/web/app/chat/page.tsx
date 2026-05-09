import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ChatClient, type AgentRole, type ChatMessage } from './chat-client';
import { listProposalsForConversation } from '@/lib/actions/proposals';
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
  searchParams: Promise<{ role?: string; conversationId?: string }>;
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

  const { data: convs } = await supabase
    .from('conversations')
    .select('id, agent_role, status, last_message_at')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .eq('agent_role', validRole)
    .order('last_message_at', { ascending: false })
    .limit(1);

  const activeConv = (convs?.[0] ?? null) as Conversation | null;

  let initialMessages: ChatMessage[] = [];
  let initialProposals: Awaited<ReturnType<typeof listProposalsForConversation>> = [];
  if (activeConv) {
    const [msgsResp, proposalsResp] = await Promise.all([
      supabase
        .from('messages')
        .select('id, turn, role, agent, content, created_at')
        .eq('conversation_id', activeConv.id)
        .in('role', ['user', 'assistant'])
        .order('turn', { ascending: true }),
      listProposalsForConversation(activeConv.id),
    ]);
    initialMessages = (msgsResp.data ?? [])
      .filter((m) => m.content)
      .map((m) => ({
        id: m.id,
        turn: m.turn,
        role: m.role as 'user' | 'assistant',
        content: m.content as string,
      }));
    initialProposals = proposalsResp;
  }

  return (
    <>
      <main className="mx-auto flex h-[100dvh] max-w-md flex-col px-4 pb-28 pt-6 sm:max-w-lg sm:px-6 sm:pt-10">
        <AppHeader />

        <nav className="mb-4 flex gap-2" aria-label="Cambiar coach">
          <RoleTab
            href="/chat?role=nutrition"
            label="Nutricionista"
            active={validRole === 'nutrition'}
          />
          <RoleTab
            href="/chat?role=training"
            label="Coach"
            active={validRole === 'training'}
          />
        </nav>

        <ChatClient
          agentRole={validRole}
          initialConversationId={activeConv?.id ?? null}
          initialMessages={initialMessages}
          initialProposals={initialProposals}
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
