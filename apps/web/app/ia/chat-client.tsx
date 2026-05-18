'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ProposalCard } from '@/components/proposal-card';
import type { ProposalRow } from '@/lib/actions/proposals';
import { uploadChatAttachment } from '@/lib/actions/chat-attachments';
import {
  startNewConversation,
  type ConversationListItem,
} from '@/lib/actions/conversations';

export type AgentRole = 'nutrition' | 'training' | 'general';

export interface ChatAttachment {
  id: string;
  kind: 'image' | 'document';
  filename: string;
}

export interface ChatMessage {
  id: string;
  turn: number;
  role: 'user' | 'assistant';
  content: string;
  attachments?: ChatAttachment[];
}

interface Props {
  agentRole: AgentRole;
  initialConversationId: string | null;
  initialMessages: ChatMessage[];
  initialProposals: ProposalRow[];
  conversationList?: ConversationListItem[];
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
  conversationList = [],
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [conversationId, setConversationId] = useState<string | null>(
    initialConversationId,
  );
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const prefill = searchParams.get('prefill') ?? '';
  const mode = searchParams.get('mode') === 'onboarding' ? 'onboarding' : 'normal';
  const [draft, setDraft] = useState(prefill);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [pendingAttachments, setPendingAttachments] = useState<
    Array<{ id: string; kind: 'image' | 'document'; name: string }>
  >([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, isPending]);

  // Elapsed time mientras el coach piensa. Para que el usuario sepa cuánto
  // lleva esperando, especialmente en programas largos.
  const [waitSeconds, setWaitSeconds] = useState(0);
  useEffect(() => {
    if (!isPending) {
      setWaitSeconds(0);
      return;
    }
    const startedAt = Date.now();
    const id = setInterval(() => {
      setWaitSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [isPending]);

  async function ensureConversation(): Promise<string> {
    if (conversationId) return conversationId;
    const res = await fetch('/api/coach/conversations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ agentRole, mode }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message ?? 'No pude crear la conversación');
    }
    const json = (await res.json()) as { conversation: { id: string } };
    setConversationId(json.conversation.id);
    return json.conversation.id;
  }

  // Reescala imágenes en cliente al lado largo máximo (Anthropic/Groq vision
  // recomiendan ~1568px). Devuelve un File JPEG comprimido.
  async function resizeImage(file: File): Promise<File> {
    if (!file.type.startsWith('image/')) return file;
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('image_load_failed'));
        el.src = url;
      });
      const MAX = 1568;
      const long = Math.max(img.width, img.height);
      if (long <= MAX) return file;
      const scale = MAX / long;
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return file;
      ctx.drawImage(img, 0, 0, w, h);
      const blob: Blob | null = await new Promise((r) =>
        canvas.toBlob(r, 'image/jpeg', 0.85),
      );
      if (!blob) return file;
      const baseName = file.name.replace(/\.[a-z0-9]+$/i, '');
      return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function attachFile(rawFile: File) {
    if (pendingAttachments.length >= 3) {
      setError('Máximo 3 adjuntos por mensaje.');
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const convId = await ensureConversation();
      const file = rawFile.type.startsWith('image/')
        ? await resizeImage(rawFile)
        : rawFile;
      const result = await uploadChatAttachment(convId, file);
      if (!result.ok || !result.data) {
        setError(humanError(result.error ?? 'upload_failed'));
        return;
      }
      setPendingAttachments((p) => [
        ...p,
        {
          id: result.data!.attachmentId,
          kind: result.data!.kind,
          name: file.name,
        },
      ]);
      if (result.data.warnings.length > 0) {
        setError(result.data.warnings.join(' · '));
      }
    } finally {
      setUploading(false);
    }
  }

  function removePending(id: string) {
    setPendingAttachments((p) => p.filter((a) => a.id !== id));
  }

  function send() {
    setError(null);
    const text = draft.trim();
    if (!text && pendingAttachments.length === 0) return;
    const optimistic: ChatMessage = {
      id: `tmp-${Date.now()}`,
      turn: messages.length + 1,
      role: 'user',
      content: text,
      attachments:
        pendingAttachments.length > 0
          ? pendingAttachments.map((a) => ({
              id: a.id,
              kind: a.kind,
              filename: a.name,
            }))
          : undefined,
    };
    setMessages((m) => [...m, optimistic]);
    setDraft('');
    const attachmentIds = pendingAttachments.map((a) => a.id);
    setPendingAttachments([]);
    const wasNewConversation = !conversationId;
    startTransition(async () => {
      try {
        const convId = await ensureConversation();
        const res = await fetch('/api/coach/message', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            conversationId: convId,
            agentRole,
            message: text || 'Te dejo este adjunto.',
            attachmentIds: attachmentIds.length > 0 ? attachmentIds : undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 429 || data?.error === 'rate_limit') {
            const retry = data?.retryAfter
              ? ` (reintenta en ~${data.retryAfter})`
              : '';
            throw new Error(
              `Servicio momentáneamente saturado${retry}. Mensaje no enviado.`,
            );
          }
          throw new Error(data?.message ?? data?.error ?? 'Error del coach');
        }
        const reply: ChatMessage = {
          id: `asst-${Date.now()}`,
          turn: optimistic.turn + 1,
          role: 'assistant',
          content: data.assistantText ?? '',
        };
        setMessages((m) => [...m, reply]);
        // Si veníamos de la vista landing (sin conv), saltamos al chat con
        // ?conv=<id> para que el server pase a renderizar la vista chat con
        // los mensajes ya persistidos. Si no, solo refresh para traer
        // propuestas nuevas que el coach haya creado en este turno.
        if (wasNewConversation) {
          router.push(`/ia?role=${agentRole}&conv=${convId}`);
        } else {
          router.refresh();
        }
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

  function startFresh() {
    if (isPending || uploading) return;
    if (!confirm('¿Empezar una conversación nueva? La actual se archiva.')) return;
    startTransition(async () => {
      const result = await startNewConversation(agentRole, 'normal');
      if (!result.ok || !result.data) {
        setError(result.error ?? 'No pude crear la conversación');
        return;
      }
      router.push(`/ia?role=${agentRole}&conv=${result.data.id}`);
    });
  }

  const isLanding = !conversationId;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {!isLanding && (
        <div className="mb-2 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => router.push(`/ia?role=${agentRole}`)}
            className="tap-feedback inline-flex items-center gap-1.5 rounded-[var(--radius-md)] px-2 py-1 text-[length:var(--text-xs)] text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]"
          >
            <span aria-hidden>‹</span> Ver historial
          </button>
        </div>
      )}

      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto px-1 py-2"
        aria-live="polite"
      >
        {isLanding && messages.length === 0 && !isPending && (
          <ConversationLanding
            agentRole={agentRole}
            conversationList={conversationList}
            roleLabel={ROLE_LABEL[agentRole]}
            onPickConversation={(id) =>
              router.push(`/ia?role=${agentRole}&conv=${id}`)
            }
          />
        )}
        {!isLanding && messages.length === 0 && !isPending && (
          <p className="text-center text-[length:var(--text-sm)] text-[color:var(--color-text-muted)]">
            Conversación vacía. Escribe abajo para empezar.
          </p>
        )}
        {messages.map((m) => (
          <Bubble
            key={m.id}
            role={m.role}
            content={m.content}
            attachments={m.attachments}
            agentRole={agentRole}
          />
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
        {isPending && (
          <Typing agentRole={agentRole} waitSeconds={waitSeconds} />
        )}
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
      {pendingAttachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {pendingAttachments.map((a) => (
            <span
              key={a.id}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] py-1 pl-1 pr-2 text-[length:var(--text-xs)] text-[color:var(--color-text-secondary)]"
            >
              {a.kind === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/chat-attachment/${a.id}`}
                  alt=""
                  className="h-6 w-6 rounded-[var(--radius-sm)] object-cover"
                />
              ) : (
                <span aria-hidden className="px-1">📄</span>
              )}
              <span className="max-w-[10rem] truncate">{a.name}</span>
              <button
                type="button"
                onClick={() => removePending(a.id)}
                aria-label="Quitar adjunto"
                className="ml-1 text-[color:var(--color-text-muted)] hover:text-[color:var(--color-status-red)]"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf,text/plain"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void attachFile(file);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }}
      />
      <div className="mt-3 flex items-end gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isPending || uploading || pendingAttachments.length >= 3}
          aria-label="Adjuntar imagen o documento"
          title="Adjuntar"
          className="btn-feedback flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] text-[color:var(--color-text-secondary)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? (
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
          ) : (
            <span aria-hidden>📎</span>
          )}
        </button>
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
          disabled={
            isPending ||
            (draft.trim().length === 0 && pendingAttachments.length === 0)
          }
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

function ConversationLanding({
  agentRole,
  conversationList,
  roleLabel,
  onPickConversation,
}: {
  agentRole: AgentRole;
  conversationList: ConversationListItem[];
  roleLabel: string;
  onPickConversation: (id: string) => void;
}) {
  const empty = conversationList.length === 0;
  return (
    <div className="space-y-3 px-1">
      <div className="px-1">
        <h2 className="text-label">CONVERSACIONES CON EL {roleLabel.toUpperCase()}</h2>
      </div>
      {empty ? (
        <div className="surface-glass px-5 py-6 text-center">
          <p className="mb-1 text-[length:var(--text-sm)] text-[color:var(--color-text-secondary)]">
            Aún no tienes ninguna conversación con tu {roleLabel}.
          </p>
          <p className="text-[length:var(--text-xs)] text-[color:var(--color-text-muted)]">
            Escribe en el cuadro de abajo para empezar.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {conversationList.map((c) => {
            const date = new Date(
              c.last_message_at ?? c.created_at,
            ).toLocaleDateString('es-ES', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            });
            const preview =
              c.first_user_message ?? c.title ?? 'Conversación sin título';
            const isArchived = c.status === 'archived';
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onPickConversation(c.id)}
                  className="tap-feedback surface-glass flex w-full items-start gap-3 px-4 py-3 text-left"
                >
                  <span
                    aria-hidden
                    className={`agent-chip ${agentRole === 'nutrition' ? 'agent-chip-nutrition' : 'agent-chip-coach'}`}
                  >
                    {agentRole === 'nutrition' ? 'N' : 'C'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-[length:var(--text-sm)] text-[color:var(--color-text-primary)]">
                      {preview}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-[color:var(--color-text-muted)]">
                      <span>{date}</span>
                      {isArchived && (
                        <span className="rounded bg-[color:var(--color-surface-raised)] px-1.5 py-0.5">
                          archivada
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    aria-hidden
                    className="text-[color:var(--color-text-muted)]"
                  >
                    ›
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="px-1 pt-1 text-[length:var(--text-xs)] text-[color:var(--color-text-muted)]">
        Escribe abajo para empezar una nueva conversación.
      </p>
    </div>
  );
}

function Bubble({
  role,
  content,
  attachments,
  agentRole,
}: {
  role: 'user' | 'assistant';
  content: string;
  attachments?: ChatAttachment[];
  agentRole: AgentRole;
}) {
  const hasAtts = attachments && attachments.length > 0;
  if (role === 'user') {
    return (
      <div className="flex flex-col items-end gap-1.5">
        {hasAtts && <AttachmentBadges attachments={attachments!} variant="user" />}
        {content && (
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
        )}
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3">
      <span className={`agent-chip ${ROLE_CHIP_CLASS[agentRole]}`}>
        {ROLE_INITIAL[agentRole]}
      </span>
      <div className="flex max-w-[85%] flex-col gap-1.5">
        {hasAtts && <AttachmentBadges attachments={attachments!} variant="assistant" />}
        {content && (
          <div className="message-bubble whitespace-pre-wrap text-[length:var(--text-base)] leading-relaxed text-[color:var(--color-text-primary)]">
            {content}
          </div>
        )}
      </div>
    </div>
  );
}

function AttachmentBadges({
  attachments,
  variant,
}: {
  attachments: ChatAttachment[];
  variant: 'user' | 'assistant';
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {attachments.map((a) => (
        <span
          key={a.id}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-2.5 py-1 text-[length:var(--text-xs)] font-medium"
          style={{
            background:
              variant === 'user'
                ? 'color-mix(in oklch, var(--color-accent) 20%, transparent)'
                : 'var(--color-surface-raised)',
            color:
              variant === 'user'
                ? 'var(--color-text-on-accent)'
                : 'var(--color-text-secondary)',
            border:
              variant === 'user'
                ? '1px solid color-mix(in oklch, var(--color-accent) 35%, transparent)'
                : '1px solid var(--color-border-default)',
          }}
          title={a.filename}
        >
          <span aria-hidden>{a.kind === 'image' ? '🖼️' : '📄'}</span>
          <span className="max-w-[180px] truncate">{a.filename}</span>
        </span>
      ))}
    </div>
  );
}

function Typing({
  agentRole,
  waitSeconds,
}: {
  agentRole: AgentRole;
  waitSeconds: number;
}) {
  let statusText: string;
  if (waitSeconds < 10) statusText = 'Preparando respuesta…';
  else if (waitSeconds < 30) statusText = 'Pensando…';
  else if (waitSeconds < 60)
    statusText = 'Sigo trabajando — programas largos llevan un poco.';
  else statusText = 'Casi listo, dame un segundo más…';

  return (
    <div className="flex items-start gap-3">
      <span
        className={`agent-chip ${ROLE_CHIP_CLASS[agentRole]} animate-pulse`}
      >
        {ROLE_INITIAL[agentRole]}
      </span>
      <div className="message-bubble flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Dot delay={0} />
          <Dot delay={150} />
          <Dot delay={300} />
          <span className="text-[length:var(--text-sm)] text-[color:var(--color-text-secondary)]">
            {statusText}
          </span>
          {waitSeconds >= 3 && (
            <span className="font-mono text-[length:var(--text-xs)] tabular-nums text-[color:var(--color-text-muted)]">
              {waitSeconds}s
            </span>
          )}
        </div>
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

function humanError(code: string): string {
  if (code.startsWith('image_too_large')) {
    return 'La imagen supera los 5 MB. Redúcela o súbela en menor calidad.';
  }
  if (code.startsWith('doc_too_large')) {
    return 'El documento supera los 8 MB.';
  }
  if (code === 'unsupported_mime') {
    return 'Formato no soportado. Usa JPG/PNG/WebP o PDF/TXT.';
  }
  if (code === 'rate_limit_24h') {
    return 'Has alcanzado el máximo de 30 adjuntos en 24 h.';
  }
  if (code === 'conversation_image_cap') {
    return 'Esta conversación ya tiene 20 imágenes — el máximo.';
  }
  if (code === 'conversation_doc_cap') {
    return 'Esta conversación ya tiene 5 documentos — el máximo.';
  }
  if (code === 'conversation_total_size_cap') {
    return 'Esta conversación llega a 50 MB de adjuntos — el máximo.';
  }
  return code;
}
