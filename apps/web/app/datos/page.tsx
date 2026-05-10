import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AppHeader } from '@/components/app-header';
import { BottomNav } from '@/components/bottom-nav';
import { WhoopStatusBanner } from '@/components/whoop-status-banner';
import { TodayStats } from '@/components/today-stats';
import { TrainingRecent } from '@/components/training-recent';
import { SubmitButton } from '@/components/submit-button';

export default async function DatosPage({
  searchParams,
}: {
  searchParams: Promise<{
    whoop_connected?: string;
    whoop_synced?: string;
    whoop_error?: string;
    whoop_msg?: string;
  }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: whoop } = await supabase
    .from('whoop_connections')
    .select('whoop_user_id, status, last_synced_at, connected_at, last_error')
    .eq('user_id', user.id)
    .maybeSingle();

  const params = await searchParams;
  const successFlash = params.whoop_connected === '1';
  const errorFlash = params.whoop_error
    ? `Error: ${params.whoop_error}` +
      (params.whoop_msg ? ` — ${decodeURIComponent(params.whoop_msg)}` : '')
    : null;

  return (
    <>
      <main className="mx-auto max-w-md px-4 pb-32 pt-6 sm:max-w-lg sm:px-6 sm:pt-10">
        <AppHeader />

        <h1 className="mb-6 text-verdict text-[color:var(--color-text-primary)]">
          Datos.
        </h1>

        {successFlash && (
          <Flash kind="green">Whoop conectado. Backfill 90 días en background.</Flash>
        )}
        {errorFlash && <Flash kind="red">{errorFlash}</Flash>}

        <section className="surface-glass mb-4 p-5">
          <h2 className="text-label mb-3">WHOOP · ESTADO</h2>
          {whoop ? (
            <>
              <WhoopStatusBanner
                status={whoop.status}
                lastSyncedAt={whoop.last_synced_at}
                lastError={whoop.last_error}
                hasConnection={true}
              />
              <div className="mt-4 flex flex-wrap gap-2">
                <form action="/api/whoop/sync" method="post">
                  <SubmitButton size="sm" pendingLabel="Sincronizando…">
                    Sincronizar
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
                Conecta tu Whoop. El primer sync trae 90 días automáticamente.
              </p>
              <a
                href="/api/whoop/authorize"
                className="tap-feedback inline-block rounded-[var(--radius-md)] px-4 py-1.5 text-[length:var(--text-sm)] font-medium text-[color:var(--color-text-on-accent)]"
                style={{
                  background:
                    'linear-gradient(135deg, oklch(58% 0.21 260), oklch(50% 0.22 260))',
                  boxShadow:
                    'inset 0 1px 0 oklch(100% 0 0 / 0.25), 0 2px 6px oklch(20% 0.05 260 / 0.18)',
                }}
              >
                Conectar Whoop →
              </a>
            </div>
          )}
        </section>

        <TodayStats />

        <TrainingRecent />
      </main>
      <BottomNav />
    </>
  );
}

function Flash({
  children,
  kind,
}: {
  children: React.ReactNode;
  kind: 'green' | 'red';
}) {
  const color =
    kind === 'green' ? 'var(--color-status-green)' : 'var(--color-status-red)';
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
