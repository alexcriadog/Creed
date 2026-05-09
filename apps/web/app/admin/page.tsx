import { createSupabaseServerClient } from '@/lib/supabase/server';
import { listAdminAuditLog } from '@/lib/actions/admin';

export const dynamic = 'force-dynamic';

interface AuditMetadata {
  table?: string;
  key?: string;
  new?: { value?: unknown; model?: string };
  old?: { value?: unknown; model?: string };
}

function formatAuditChange(metadata: Record<string, unknown> | null): string {
  if (!metadata) return '—';
  const m = metadata as AuditMetadata;
  if (!m.table || !m.key) return '—';
  const newV =
    m.table === 'app_settings'
      ? JSON.stringify(m.new?.value)
      : m.table === 'model_assignments'
        ? m.new?.model
        : '—';
  const oldV =
    m.table === 'app_settings'
      ? JSON.stringify(m.old?.value)
      : m.table === 'model_assignments'
        ? m.old?.model
        : '—';
  return `${m.table}.${m.key}: ${oldV} → ${newV}`;
}

export default async function AdminHome() {
  const supabase = await createSupabaseServerClient();

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [
    profilesCount,
    conversationsCount,
    messagesAgg,
    mealsCount,
    trainingsCount,
    verdictsCount,
    auditLog,
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfMonth.toISOString()),
    supabase
      .from('messages')
      .select('input_tokens, output_tokens')
      .gte('created_at', startOfMonth.toISOString())
      .eq('role', 'assistant'),
    supabase
      .from('meals')
      .select('*', { count: 'exact', head: true })
      .gte('consumed_at', startOfMonth.toISOString()),
    supabase
      .from('training_sessions')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfMonth.toISOString()),
    supabase.from('weekly_verdicts').select('*', { count: 'exact', head: true }),
    listAdminAuditLog(10),
  ]);

  const totalIn = (messagesAgg.data ?? []).reduce(
    (s, m) => s + (m.input_tokens ?? 0),
    0,
  );
  const totalOut = (messagesAgg.data ?? []).reduce(
    (s, m) => s + (m.output_tokens ?? 0),
    0,
  );

  // Sonnet 4.6 approx: $3/M input, $15/M output → ~€2.8/M, €14/M
  const estCostEur =
    (totalIn * 2.8) / 1_000_000 + (totalOut * 14) / 1_000_000;

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-[length:var(--text-sm)] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">
          Mes actual
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Atletas" value={String(profilesCount.count ?? 0)} />
          <Stat label="Conversaciones" value={String(conversationsCount.count ?? 0)} />
          <Stat label="Comidas" value={String(mealsCount.count ?? 0)} />
          <Stat label="Sesiones" value={String(trainingsCount.count ?? 0)} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[length:var(--text-sm)] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">
          Tokens y coste estimado (Anthropic, mes actual)
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Input tokens" value={totalIn.toLocaleString('es-ES')} />
          <Stat label="Output tokens" value={totalOut.toLocaleString('es-ES')} />
          <Stat
            label="Coste estimado"
            value={`€${estCostEur.toFixed(2)}`}
            subtitle="aprox. Sonnet 4.6"
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[length:var(--text-sm)] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">
          Histórico
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
          <Stat label="Veredictos semanales totales" value={String(verdictsCount.count ?? 0)} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[length:var(--text-sm)] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">
          Cambios admin recientes
        </h2>
        {auditLog.length === 0 ? (
          <p className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-border-default)] p-4 text-center text-[length:var(--text-sm)] text-[color:var(--color-text-muted)]">
            Sin cambios todavía.
          </p>
        ) : (
          <ul className="divide-y divide-[color:var(--color-border-default)] rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)]">
            {auditLog.map((entry) => (
              <li key={entry.id} className="px-3 py-2">
                <div className="font-mono text-[length:var(--text-xs)] text-[color:var(--color-text-primary)]">
                  {formatAuditChange(entry.metadata)}
                </div>
                <div className="text-[length:var(--text-xs)] text-[color:var(--color-text-muted)]">
                  {new Date(entry.created_at).toLocaleString('es-ES')}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] p-3">
      <div className="text-[length:var(--text-xs)] uppercase tracking-wider text-[color:var(--color-text-muted)]">
        {label}
      </div>
      <div className="mt-1 font-mono text-[length:var(--text-xl)] font-semibold tabular-nums text-[color:var(--color-text-primary)]">
        {value}
      </div>
      {subtitle && (
        <div className="text-[length:var(--text-xs)] text-[color:var(--color-text-muted)]">
          {subtitle}
        </div>
      )}
    </div>
  );
}
