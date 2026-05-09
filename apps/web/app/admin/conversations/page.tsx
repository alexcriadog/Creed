import Link from 'next/link';
import { redirect } from 'next/navigation';
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

const ROLE_LABEL: Record<string, string> = {
  nutrition: 'Nutricionista',
  training: 'Preparador',
  general: 'General',
  mixed: 'Mixto',
};

export default async function AdminConversationsPage() {
  await ensureAdmin();
  const admin = createSupabaseServiceRoleClient();

  const [convsResp, profilesResp] = await Promise.all([
    admin
      .from('conversations')
      .select('id, user_id, agent_role, mode, status, last_message_at, created_at')
      .order('last_message_at', { ascending: false })
      .limit(50),
    admin.from('profiles').select('id, display_name'),
  ]);

  const profilesById = new Map<string, string>();
  for (const p of profilesResp.data ?? []) {
    profilesById.set(p.id, p.display_name);
  }

  const conversations = convsResp.data ?? [];

  return (
    <div className="space-y-4">
      <p className="text-[length:var(--text-sm)] text-[color:var(--color-text-secondary)]">
        Lectura solo: visor de conversaciones de todos los atletas. Sujeto al consentimiento
        documentado en <code>profiles.consents</code>.
      </p>
      {conversations.length === 0 ? (
        <p className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-border-default)] p-4 text-center text-[length:var(--text-sm)] text-[color:var(--color-text-muted)]">
          Sin conversaciones aún.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[color:var(--color-border-default)]">
          <table className="w-full text-[length:var(--text-sm)]">
            <thead>
              <tr className="border-b border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] text-left text-[length:var(--text-xs)] uppercase tracking-wider text-[color:var(--color-text-muted)]">
                <th className="px-3 py-2">Atleta</th>
                <th className="px-3 py-2">Coach</th>
                <th className="px-3 py-2">Modo</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Último mensaje</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {conversations.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-[color:var(--color-border-default)] last:border-0 hover:bg-[color:var(--color-surface-raised)]"
                >
                  <td className="px-3 py-2 text-[color:var(--color-text-primary)]">
                    {profilesById.get(c.user_id) ?? c.user_id.slice(0, 8)}
                  </td>
                  <td className="px-3 py-2">
                    {ROLE_LABEL[c.agent_role ?? ''] ?? c.agent_role ?? '—'}
                  </td>
                  <td className="px-3 py-2 font-mono text-[length:var(--text-xs)]">{c.mode}</td>
                  <td className="px-3 py-2 font-mono text-[length:var(--text-xs)]">{c.status}</td>
                  <td className="px-3 py-2 text-[length:var(--text-xs)] text-[color:var(--color-text-muted)]">
                    {new Date(c.last_message_at).toLocaleString('es-ES')}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/conversations/${c.id}`}
                      className="text-[length:var(--text-xs)] text-[color:var(--color-accent)] underline-offset-2 hover:underline"
                    >
                      Abrir →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
