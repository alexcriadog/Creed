import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

async function ensureAdmin(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (profile?.role !== 'admin') redirect('/');
}

interface PageProps {
  params: Promise<{ id: string }>;
}

const ROLE_BADGE: Record<string, { label: string; color: string }> = {
  user: { label: 'Atleta', color: 'var(--color-accent)' },
  assistant: { label: 'Coach', color: 'var(--color-status-green)' },
  tool: { label: 'Tool', color: 'var(--color-text-muted)' },
  system: { label: 'System', color: 'var(--color-text-muted)' },
};

export default async function AdminConversationDetailPage({ params }: PageProps) {
  await ensureAdmin();
  const { id } = await params;
  const admin = createSupabaseServiceRoleClient();

  const [convResp, msgsResp, toolsResp, profilesResp] = await Promise.all([
    admin
      .from('conversations')
      .select('id, user_id, agent_role, mode, status, last_message_at, created_at')
      .eq('id', id)
      .maybeSingle(),
    admin
      .from('messages')
      .select(
        'id, turn, role, agent, content, model, input_tokens, output_tokens, tool_call_id, created_at',
      )
      .eq('conversation_id', id)
      .order('turn', { ascending: true }),
    admin
      .from('tool_calls')
      .select('id, tool_name, arguments, result, error, duration_ms, created_at')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true }),
    admin.from('profiles').select('id, display_name'),
  ]);

  if (!convResp.data) notFound();
  const conv = convResp.data;
  const profile = (profilesResp.data ?? []).find((p) => p.id === conv.user_id);

  const messages = msgsResp.data ?? [];
  const tools = toolsResp.data ?? [];

  const totalIn = messages.reduce((s, m) => s + (m.input_tokens ?? 0), 0);
  const totalOut = messages.reduce((s, m) => s + (m.output_tokens ?? 0), 0);

  return (
    <div className="space-y-6">
      <Link
        href="/admin/conversations"
        className="text-[length:var(--text-sm)] text-[color:var(--color-text-muted)] underline-offset-2 hover:underline"
      >
        ← Volver al listado
      </Link>

      <header className="rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <dt className="text-[length:var(--text-xs)] uppercase tracking-wider text-[color:var(--color-text-muted)]">
              Atleta
            </dt>
            <dd className="text-[length:var(--text-sm)]">
              {profile?.display_name ?? conv.user_id.slice(0, 8)}
            </dd>
          </div>
          <div>
            <dt className="text-[length:var(--text-xs)] uppercase tracking-wider text-[color:var(--color-text-muted)]">
              Coach
            </dt>
            <dd className="text-[length:var(--text-sm)]">{conv.agent_role}</dd>
          </div>
          <div>
            <dt className="text-[length:var(--text-xs)] uppercase tracking-wider text-[color:var(--color-text-muted)]">
              Tokens
            </dt>
            <dd className="font-mono text-[length:var(--text-sm)] tabular-nums">
              {totalIn.toLocaleString('es-ES')} in · {totalOut.toLocaleString('es-ES')} out
            </dd>
          </div>
          <div>
            <dt className="text-[length:var(--text-xs)] uppercase tracking-wider text-[color:var(--color-text-muted)]">
              Tool calls
            </dt>
            <dd className="font-mono text-[length:var(--text-sm)] tabular-nums">
              {tools.length}
            </dd>
          </div>
        </div>
      </header>

      <section className="space-y-3">
        {messages.map((m) => {
          const badge = ROLE_BADGE[m.role] ?? ROLE_BADGE.system;
          return (
            <article
              key={m.id}
              className="rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] p-3"
            >
              <header className="mb-2 flex items-center justify-between gap-2">
                <span
                  className="rounded-full px-2 py-0.5 text-[length:var(--text-xs)] font-medium"
                  style={{
                    color: badge?.color ?? 'var(--color-text-muted)',
                    background: `color-mix(in oklch, ${badge?.color ?? 'var(--color-text-muted)'} 12%, transparent)`,
                  }}
                >
                  {badge?.label ?? m.role}
                </span>
                <span className="font-mono text-[length:var(--text-xs)] text-[color:var(--color-text-muted)]">
                  turn {m.turn}
                  {m.model ? ` · ${m.model}` : ''}
                  {m.input_tokens !== null &&
                    ` · ${m.input_tokens}/${m.output_tokens ?? 0} tok`}
                </span>
              </header>
              {m.content ? (
                <pre className="whitespace-pre-wrap text-[length:var(--text-sm)] text-[color:var(--color-text-primary)]">
                  {m.content}
                </pre>
              ) : (
                <p className="text-[length:var(--text-xs)] italic text-[color:var(--color-text-muted)]">
                  (sin texto — solo tool_use)
                </p>
              )}
            </article>
          );
        })}
      </section>

      {tools.length > 0 && (
        <section>
          <h2 className="mb-3 text-[length:var(--text-sm)] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">
            Tool calls de esta conversación
          </h2>
          <ul className="space-y-2">
            {tools.map((t) => (
              <li
                key={t.id}
                className="rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[length:var(--text-sm)] text-[color:var(--color-text-primary)]">
                    {t.tool_name}
                  </span>
                  <span className="text-[length:var(--text-xs)] text-[color:var(--color-text-muted)]">
                    {t.duration_ms}ms
                  </span>
                </div>
                {t.error && (
                  <p className="mt-1 text-[length:var(--text-xs)] text-[color:var(--color-status-red)]">
                    {t.error}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
