import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const AGENT_LABEL: Record<string, string> = {
  nutritionist: 'NUTRICIONISTA',
  trainer: 'COACH',
  orchestrator: 'ASISTENTE',
};

const AGENT_INITIAL: Record<string, string> = {
  nutritionist: 'N',
  trainer: 'C',
  orchestrator: 'A',
};

export async function ConversationPreview() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('messages')
    .select('id, agent, content, created_at')
    .eq('user_id', user.id)
    .eq('role', 'assistant')
    .not('content', 'is', null)
    .order('created_at', { ascending: false })
    .limit(2);

  const messages = (data ?? []).reverse();
  if (messages.length === 0) return null;

  return (
    <section className="mb-24">
      <h2 className="mb-3 text-label">HOY · CONVERSACIÓN</h2>
      <div className="flex flex-col gap-3">
        {messages.map((m) => {
          const agent = m.agent ?? 'orchestrator';
          return (
            <Link
              key={m.id}
              href="/chat"
              className="flex items-start gap-3 transition hover:opacity-90"
            >
              <span className={`agent-chip ${chipClass(m.agent)}`}>
                {AGENT_INITIAL[agent] ?? '·'}
              </span>
              <div className="message-bubble flex-1 min-w-0">
                <div className="text-label mb-1">{AGENT_LABEL[agent] ?? 'ASISTENTE'}</div>
                <p
                  className="text-[length:var(--text-sm)] leading-relaxed text-[color:var(--color-text-primary)]"
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {(m.content ?? '').trim()}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function chipClass(agent: string | null): string {
  if (agent === 'nutritionist') return 'agent-chip-nutrition';
  return 'agent-chip-coach';
}
