/**
 * /whoop — única pantalla de atleta que se mantiene en la web: estado de la
 * conexión con Whoop, conteos sincronizados y acciones (conectar, sincronizar,
 * desconectar). El resto de la experiencia vive en claude.ai vía MCP.
 */
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AppHeader } from '@/components/app-header';
import { SubmitButton } from '@/components/submit-button';
import { WhoopStatusBanner } from '@/components/whoop-status-banner';

interface SearchParams {
  whoop_connected?: string;
  whoop_disconnected?: string;
  whoop_synced?: string;
  whoop_error?: string;
  whoop_msg?: string;
}

const COUNT_TABLES = [
  ['whoop_cycles', 'Ciclos'],
  ['whoop_recovery', 'Recovery'],
  ['whoop_sleep', 'Sueño'],
  ['whoop_workouts', 'Workouts'],
  ['whoop_body_measurements', 'Medidas'],
] as const;

export default async function WhoopPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=%2Fwhoop');

  const [{ data: whoop }, ...counts] = await Promise.all([
    supabase
      .from('whoop_connections')
      .select('status, last_synced_at, connected_at, last_error')
      .eq('user_id', user.id)
      .maybeSingle(),
    ...COUNT_TABLES.map(([table]) =>
      supabase.from(table).select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    ),
  ]);

  const synced = params.whoop_synced ? safeParse(params.whoop_synced) : null;
  const errorFlash = params.whoop_error
    ? `Error: ${params.whoop_error}${params.whoop_msg ? ` — ${decodeURIComponent(params.whoop_msg)}` : ''}`
    : null;

  return (
    <main className="mx-auto max-w-md px-4 pb-16 pt-6 sm:max-w-lg sm:px-6 sm:pt-10">
      <AppHeader />

      <h1 className="mb-1 text-verdict text-[color:var(--color-text-primary)]">Whoop.</h1>
      <p className="text-label mb-6">FUENTE DE RECOVERY, SUEÑO Y STRAIN PARA CLAUDE</p>

      {params.whoop_connected === '1' && (
        <Flash kind="green">Whoop conectado. Trayendo todo tu historial en segundo plano.</Flash>
      )}
      {params.whoop_disconnected === '1' && <Flash kind="green">Whoop desconectado.</Flash>}
      {synced && (
        <Flash kind="green">
          Sincronizado: {synced.cycles} ciclos · {synced.recovery} recovery · {synced.sleep} sueños ·{' '}
          {synced.workouts} workouts{synced.errors?.length ? ` · ${synced.errors.length} avisos` : ''}.
        </Flash>
      )}
      {errorFlash && <Flash kind="red">{errorFlash}</Flash>}

      <section className="surface-glass mb-4 p-5">
        <h2 className="text-label mb-3">ESTADO</h2>
        {whoop ? (
          <>
            <WhoopStatusBanner
              status={whoop.status}
              lastSyncedAt={whoop.last_synced_at}
              lastError={whoop.last_error}
              hasConnection={true}
            />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[length:var(--text-sm)]">
              <dt className="text-[color:var(--color-text-muted)]">Conectado desde</dt>
              <dd className="text-[color:var(--color-text-primary)]">{formatDate(whoop.connected_at)}</dd>
              <dt className="text-[color:var(--color-text-muted)]">Última sync</dt>
              <dd className="text-[color:var(--color-text-primary)]">
                {whoop.last_synced_at ? formatDate(whoop.last_synced_at) : 'en curso (backfill inicial)'}
              </dd>
              <dt className="text-[color:var(--color-text-muted)]">Estado</dt>
              <dd className="text-[color:var(--color-text-primary)]">{whoop.status}</dd>
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              <form action="/api/whoop/sync" method="post">
                <SubmitButton size="sm" pendingLabel="Sincronizando…">
                  Sincronizar ahora
                </SubmitButton>
              </form>
              <form action="/api/whoop/disconnect" method="post">
                <SubmitButton variant="secondary" size="sm" pendingLabel="Desconectando…">
                  Desconectar
                </SubmitButton>
              </form>
            </div>
          </>
        ) : (
          <div>
            <p className="mb-3 text-[length:var(--text-sm)] text-[color:var(--color-text-secondary)]">
              Conecta tu Whoop. La primera sincronización trae todo tu historial; después se actualiza solo
              (webhook + cada 3 h) y Claude lo consulta desde el MCP.
            </p>
            <a
              href="/api/whoop/authorize"
              className="tap-feedback inline-block rounded-[var(--radius-md)] px-4 py-1.5 text-[length:var(--text-sm)] font-medium text-[color:var(--color-text-on-accent)]"
              style={{
                background: 'linear-gradient(135deg, oklch(58% 0.21 260), oklch(50% 0.22 260))',
                boxShadow: 'inset 0 1px 0 oklch(100% 0 0 / 0.25), 0 2px 6px oklch(20% 0.05 260 / 0.18)',
              }}
            >
              Conectar Whoop →
            </a>
          </div>
        )}
      </section>

      <section className="surface-glass p-5">
        <h2 className="text-label mb-3">DATOS GUARDADOS</h2>
        <dl className="grid grid-cols-5 gap-2 text-center">
          {COUNT_TABLES.map(([table, label], i) => (
            <div key={table}>
              <dd className="font-[family-name:var(--font-display)] text-[length:var(--text-xl)] font-bold text-[color:var(--color-text-primary)]">
                {counts[i]?.count ?? 0}
              </dd>
              <dt className="text-[length:var(--text-xs)] text-[color:var(--color-text-muted)]">{label}</dt>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}

function safeParse(raw: string): { cycles: number; recovery: number; sleep: number; workouts: number; errors?: string[] } | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function Flash({ children, kind }: { children: React.ReactNode; kind: 'green' | 'red' }) {
  const color = kind === 'green' ? 'var(--color-status-green)' : 'var(--color-status-red)';
  return (
    <div
      role="alert"
      className="mb-4 rounded-[var(--radius-md)] px-4 py-3 text-[length:var(--text-sm)]"
      style={{
        borderColor: color,
        color,
        background: `color-mix(in oklch, ${color} 10%, transparent)`,
        borderWidth: '1px',
        borderStyle: 'solid',
      }}
    >
      {children}
    </div>
  );
}
