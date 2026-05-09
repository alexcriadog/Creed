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
        <h2 className="text-label mb-3">MES ACTUAL</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="ATLETAS" value={String(profilesCount.count ?? 0)} />
          <Stat label="CONVERSACIONES" value={String(conversationsCount.count ?? 0)} />
          <Stat label="COMIDAS" value={String(mealsCount.count ?? 0)} />
          <Stat label="SESIONES" value={String(trainingsCount.count ?? 0)} />
        </div>
      </section>

      <section>
        <h2 className="text-label mb-3">TOKENS · COSTE · MES ACTUAL</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="INPUT" value={totalIn.toLocaleString('es-ES')} />
          <Stat label="OUTPUT" value={totalOut.toLocaleString('es-ES')} />
          <Stat
            label="COSTE EST."
            value={`€${estCostEur.toFixed(2)}`}
            subtitle="aprox. Sonnet 4.6"
          />
        </div>
      </section>

      <section>
        <h2 className="text-label mb-3">HISTÓRICO</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
          <Stat label="VEREDICTOS TOTALES" value={String(verdictsCount.count ?? 0)} />
        </div>
      </section>

      <section>
        <h2 className="text-label mb-3">CAMBIOS RECIENTES</h2>
        {auditLog.length === 0 ? (
          <p className="surface-glass p-4 text-center text-[length:var(--text-sm)] text-[color:var(--color-text-muted)]">
            Sin cambios todavía.
          </p>
        ) : (
          <ul className="surface-glass divide-y divide-[color:var(--color-border-subtle)] overflow-hidden p-0">
            {auditLog.map((entry) => (
              <li key={entry.id} className="px-4 py-3">
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
    <div className="metric-card">
      <div className="text-label mb-2">{label}</div>
      <div className="font-mono text-[length:var(--text-xl)] font-semibold tabular-nums leading-tight text-[color:var(--color-text-primary)]">
        {value}
      </div>
      {subtitle && (
        <div className="mt-1 text-[length:var(--text-xs)] text-[color:var(--color-text-muted)]">
          {subtitle}
        </div>
      )}
    </div>
  );
}
