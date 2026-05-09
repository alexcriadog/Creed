import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function AdminPromptsPage() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('prompt_versions')
    .select('id, agent, version, active, created_at')
    .order('agent', { ascending: true })
    .order('version', { ascending: false });

  if (error) {
    return (
      <p className="text-[length:var(--text-sm)] text-[color:var(--color-status-red)]">
        Error: {error.message}
      </p>
    );
  }

  const versions = data ?? [];

  return (
    <div className="space-y-4">
      <p className="text-[length:var(--text-sm)] text-[color:var(--color-text-secondary)]">
        Versionado de prompts por agente. Activación y rollback se añaden en fase 7 — por ahora
        los prompts viven hardcoded en <code>packages/agents/src/runner</code>.
      </p>
      {versions.length === 0 ? (
        <p className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-border-default)] p-4 text-center text-[length:var(--text-sm)] text-[color:var(--color-text-muted)]">
          Sin versiones registradas aún.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[color:var(--color-border-default)]">
          <table className="w-full text-[length:var(--text-sm)]">
            <thead>
              <tr className="border-b border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] text-left text-[length:var(--text-xs)] uppercase tracking-wider text-[color:var(--color-text-muted)]">
                <th className="px-3 py-2">Agente</th>
                <th className="px-3 py-2 text-right">Versión</th>
                <th className="px-3 py-2">Activa</th>
                <th className="px-3 py-2">Creada</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr
                  key={v.id}
                  className="border-b border-[color:var(--color-border-default)] last:border-0"
                >
                  <td className="px-3 py-2 font-mono text-[length:var(--text-xs)]">{v.agent}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{v.version}</td>
                  <td className="px-3 py-2">{v.active ? '✓' : '—'}</td>
                  <td className="px-3 py-2 text-[length:var(--text-xs)] text-[color:var(--color-text-muted)]">
                    {new Date(v.created_at).toLocaleString('es-ES')}
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
