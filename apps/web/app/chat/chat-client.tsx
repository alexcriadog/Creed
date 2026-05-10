'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ProposalCard } from '@/components/proposal-card';
import type { ProposalRow } from '@/lib/actions/proposals';

export type AgentRole = 'nutrition' | 'training' | 'general';

export interface ChatMessage {
  id: string;
  turn: number;
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  agentRole: AgentRole;
  initialConversationId: string | null;
  initialMessages: ChatMessage[];
  initialProposals: ProposalRow[];
}

const ROLE_LABEL: Record<AgentRole, string> = {
  nutrition: 'nutricionista',
  training: 'preparador',
  general: 'asistente',
};

const ROLE_INITIAL: Record<AgentRole, string> = {
  nutrition: 'N',
  training: 'C',
  general: 'A',
};

const ROLE_CHIP_CLASS: Record<AgentRole, string> = {
  nutrition: 'agent-chip-nutrition',
  training: 'agent-chip-coach',
  general: 'agent-chip-coach',
};

export function ChatClient({
  agentRole,
  initialConversationId,
  initialMessages,
  initialProposals,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [conversationId, setConversationId] = useState<string | null>(
    initialConversationId,
  );
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const prefill = searchParams.get('prefill') ?? '';
  const [draft, setDraft] = useState(prefill);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, isPending]);

  async function ensureConversation(): Promise<string> {
    if (conversationId) return conversationId;
    const res = await fetch('/api/coach/conversations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ agentRole }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message ?? 'No pude crear la conversación');
    }
    const json = (await res.json()) as { conversation: { id: string } };
    setConversationId(json.conversation.id);
    return json.conversation.id;
  }

  function send() {
    setError(null);
    const text = draft.trim();
    if (!text) return;
    const optimistic: ChatMessage = {
      id: `tmp-${Date.now()}`,
      turn: messages.length + 1,
      role: 'user',
      content: text,
    };
    setMessages((m) => [...m, optimistic]);
    setDraft('');
    startTransition(async () => {
      try {
        const convId = await ensureConversation();
        const res = await fetch('/api/coach/message', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            conversationId: convId,
            agentRole,
            message: text,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.message ?? data?.error ?? 'Error del coach');
        }
        const reply: ChatMessage = {
          id: `asst-${Date.now()}`,
          turn: optimistic.turn + 1,
          role: 'assistant',
          content: data.assistantText ?? '',
        };
        setMessages((m) => [...m, reply]);
        // Refresca el server component padre para traer las propuestas nuevas
        // que el coach haya creado en este turno.
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error desconocido';
        setError(message);
        setMessages((m) => m.filter((x) => x.id !== optimistic.id));
        setDraft(text);
      }
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto px-1 py-2"
        aria-live="polite"
      >
        {messages.length === 0 && !isPending && (
          <p className="text-center text-[length:var(--text-sm)] text-[color:var(--color-text-muted)]">
            Escribe lo que quieras al {ROLE_LABEL[agentRole]}. Lee tus datos antes de aconsejar.
          </p>
        )}
        {messages.map((m) => (
          <Bubble key={m.id} role={m.role} content={m.content} agentRole={agentRole} />
        ))}
        {initialProposals.length > 0 && (
          <div className="mt-2 space-y-2">
            {initialProposals
              .slice()
              .sort((a, b) => {
                // pending arriba, luego por fecha
                if (a.status === 'pending' && b.status !== 'pending') return -1;
                if (a.status !== 'pending' && b.status === 'pending') return 1;
                return a.created_at.localeCompare(b.created_at);
              })
              .map((p) => (
                <ProposalCard key={p.id} proposal={p} />
              ))}
          </div>
        )}
        {isPending && <Typing agentRole={agentRole} />}
      </div>
      {error && (
        <p
          className="mb-2 rounded-[var(--radius-md)] border px-3 py-2 text-[length:var(--text-sm)]"
          style={{
            borderColor: 'var(--color-status-red)',
            color: 'var(--color-status-red)',
            background: 'color-mix(in oklch, var(--color-status-red) 10%, transparent)',
          }}
        >
          {error}
        </p>
      )}
      <div className="mt-3 flex items-end gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
          placeholder={`Mensaje al ${ROLE_LABEL[agentRole]}…`}
          disabled={isPending}
          className="input-glass flex-1 resize-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={send}
          disabled={isPending || draft.trim().length === 0}
          aria-busy={isPending || undefined}
          className="btn-feedback inline-flex items-center gap-2 self-end rounded-[var(--radius-md)] px-4 py-2 text-[length:var(--text-sm)] font-medium text-[color:var(--color-text-on-accent)]"
          style={{
            background:
              'linear-gradient(135deg, oklch(58% 0.21 260), oklch(50% 0.22 260))',
            boxShadow:
              'inset 0 1px 0 oklch(100% 0 0 / 0.25), 0 2px 6px oklch(20% 0.05 260 / 0.18)',
          }}
        >
          {isPending && (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              aria-hidden
              className="animate-spin"
            >
              <path d="M21 12a9 9 0 1 1-6.2-8.55" />
            </svg>
          )}
          {isPending ? 'Enviando…' : 'Enviar'}
        </button>
      </div>
    </div>
  );
}

function Bubble({
  role,
  content,
  agentRole,
}: {
  role: 'user' | 'assistant';
  content: string;
  agentRole: AgentRole;
}) {
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[85%] whitespace-pre-wrap rounded-[var(--radius-lg)] px-4 py-2.5 text-[length:var(--text-base)] leading-relaxed text-[color:var(--color-text-on-accent)]"
          style={{
            background:
              'linear-gradient(135deg, oklch(58% 0.21 260), oklch(50% 0.22 260))',
            boxShadow:
              'inset 0 1px 0 oklch(100% 0 0 / 0.25), 0 2px 6px oklch(20% 0.05 260 / 0.18)',
          }}
        >
          {content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3">
      <span className={`agent-chip ${ROLE_CHIP_CLASS[agentRole]}`}>
        {ROLE_INITIAL[agentRole]}
      </span>
      <div className="message-bubble max-w-[85%] whitespace-pre-wrap text-[length:var(--text-base)] leading-relaxed text-[color:var(--color-text-primary)]">
        {content}
      </div>
    </div>
  );
}

function Typing({ agentRole }: { agentRole: AgentRole }) {
  return (
    <div className="flex items-start gap-3">
      <span className={`agent-chip ${ROLE_CHIP_CLASS[agentRole]}`}>
        {ROLE_INITIAL[agentRole]}
      </span>
      <div className="message-bubble flex items-center gap-1">
        <Dot delay={0} />
        <Dot delay={150} />
        <Dot delay={300} />
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-[color:var(--color-text-muted)]"
      style={{ animationDelay: `${delay}ms` }}
    />
  );
}
