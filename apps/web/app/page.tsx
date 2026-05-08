import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const WHOOP_ERRORS: Record<string, string> = {
  state_mismatch: 'La sesión de OAuth caducó. Inténtalo de nuevo.',
  exchange_failed: 'Whoop no aceptó el código. Inténtalo de nuevo.',
  profile_failed: 'No pudimos leer tu perfil de Whoop.',
  save_failed: 'No pudimos guardar la conexión.',
  missing_params: 'Whoop nos devolvió una respuesta incompleta.',
  access_denied: 'Cancelaste la autorización en Whoop.',
  sync_failed: 'No pudimos sincronizar con Whoop. Intenta más tarde.',
  sync_threw: 'El sync lanzó una excepción.',
};

interface SyncResult {
  cycles: number;
  recovery: number;
  sleep: number;
  workouts: number;
  errors: string[];
}

export default async function HomePage({
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, onboarding_status')
    .eq('id', user.id)
    .single();

  if (profile?.onboarding_status !== 'complete') redirect('/onboarding');

  const { data: whoop } = await supabase
    .from('whoop_connections')
    .select('whoop_user_id, status, last_synced_at, connected_at, last_error')
    .eq('user_id', user.id)
    .maybeSingle();

  const params = await searchParams;
  const successFlash = params.whoop_connected === '1';
  const errorFlash = params.whoop_error
    ? (WHOOP_ERRORS[params.whoop_error] ?? `Error: ${params.whoop_error}`) +
      (params.whoop_msg ? ` — ${decodeURIComponent(params.whoop_msg)}` : '')
    : null;

  let syncFlash: SyncResult | null = null;
  if (params.whoop_synced) {
    try {
      syncFlash = JSON.parse(params.whoop_synced) as SyncResult;
    } catch {
      // ignore
    }
  }

  // Stats summary if Whoop connected
  let stats: {
    cycles: number;
    recovery: number;
    sleep: number;
    workouts: number;
    latestRecoveryScore: number | null;
    latestRecoveryDate: string | null;
  } | null = null;

  if (whoop) {
    const [cyclesCount, recoveryCount, sleepCount, workoutsCount, latestRecovery] = await Promise.all([
      supabase.from('whoop_cycles').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('whoop_recovery').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('whoop_sleep').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('whoop_workouts').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase
        .from('whoop_recovery')
        .select('score, date')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    stats = {
      cycles: cyclesCount.count ?? 0,
      recovery: recoveryCount.count ?? 0,
      sleep: sleepCount.count ?? 0,
      workouts: workoutsCount.count ?? 0,
      latestRecoveryScore: latestRecovery.data?.score ?? null,
      latestRecoveryDate: latestRecovery.data?.date ?? null,
    };
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
      <div className="surface-glass p-8 md:p-12">
        <p className="mb-4 text-sm font-medium uppercase tracking-wider text-[color:var(--color-text-muted)]">
          Fase 3 · Whoop sync
        </p>
        <h1 className="mb-6 font-[family-name:var(--font-display)] text-[length:var(--text-display)] font-bold leading-[1.05] tracking-tight text-[color:var(--color-text-primary)]">
          Hola, {profile?.display_name ?? 'atleta'}.
        </h1>

        {successFlash && (
          <Flash kind="green">
            Whoop conectado. Backfill de 90 días en background — recarga en unos segundos para ver datos.
          </Flash>
        )}

        {syncFlash && (
          <Flash kind={syncFlash.errors.length > 0 ? 'amber' : 'green'}>
            Sync completo: {syncFlash.cycles} cycles · {syncFlash.recovery} recovery · {syncFlash.sleep} sleep · {syncFlash.workouts} workouts
            {syncFlash.errors.length > 0 && (
              <details className="mt-2 text-[length:var(--text-xs)] opacity-90">
                <summary className="cursor-pointer">{syncFlash.errors.length} error(es)</summary>
                <ul className="mt-1 list-disc pl-5">
                  {syncFlash.errors.map((e, i) => (
                    <li key={i} className="font-mono">{e}</li>
                  ))}
                </ul>
              </details>
            )}
          </Flash>
        )}

        {errorFlash && <Flash kind="red">{errorFlash}</Flash>}

        <section className="mb-8">
          <h2 className="mb-3 text-[length:var(--text-lg)] font-semibold text-[color:var(--color-text-primary)]">
            Wearable
          </h2>
          {whoop && stats ? (
            <WhoopConnected
              whoopUserId={whoop.whoop_user_id}
              status={whoop.status}
              lastSyncedAt={whoop.last_synced_at}
              connectedAt={whoop.connected_at}
              lastError={whoop.last_error}
              stats={stats}
            />
          ) : (
            <WhoopDisconnected />
          )}
        </section>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/profile"
            className="rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] px-4 py-2 text-[length:var(--text-sm)] text-[color:var(--color-text-primary)] transition hover:bg-[color:var(--color-surface-raised)]"
          >
            Ver perfil
          </Link>
        </div>
      </div>
    </main>
  );
}

function Flash({
  children,
  kind,
}: {
  children: React.ReactNode;
  kind: 'green' | 'amber' | 'red';
}) {
  const color =
    kind === 'green'
      ? 'var(--color-status-green)'
      : kind === 'amber'
        ? 'var(--color-status-amber)'
        : 'var(--color-status-red)';
  return (
    <div
      role="alert"
      className="mb-6 rounded-[var(--radius-md)] px-4 py-3 text-[length:var(--text-sm)]"
      style={{ borderColor: color, color, background: `color-mix(in oklch, ${color} 10%, transparent)`, borderWidth: '1px', borderStyle: 'solid' }}
    >
      {children}
    </div>
  );
}

function WhoopConnected({
  whoopUserId,
  status,
  lastSyncedAt,
  connectedAt,
  lastError,
  stats,
}: {
  whoopUserId: string;
  status: string;
  lastSyncedAt: string | null;
  connectedAt: string;
  lastError: string | null;
  stats: {
    cycles: number;
    recovery: number;
    sleep: number;
    workouts: number;
    latestRecoveryScore: number | null;
    latestRecoveryDate: string | null;
  };
}) {
  const statusColor =
    status === 'connected'
      ? 'var(--color-status-green)'
      : status === 'expired'
        ? 'var(--color-status-amber)'
        : 'var(--color-status-red)';

  return (
    <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: statusColor }} aria-hidden />
        <span className="text-[length:var(--text-sm)] font-medium uppercase tracking-wider text-[color:var(--color-text-secondary)]">
          Whoop · {status}
        </span>
        <span className="ml-auto font-mono text-[length:var(--text-xs)] text-[color:var(--color-text-muted)]">
          ID {whoopUserId}
        </span>
      </div>

      {/* Recovery destacado */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Recovery" value={stats.latestRecoveryScore !== null ? String(stats.latestRecoveryScore) : '—'} subtitle={stats.latestRecoveryDate ?? ''} />
        <Stat label="Cycles" value={String(stats.cycles)} />
        <Stat label="Sleep" value={String(stats.sleep)} />
        <Stat label="Workouts" value={String(stats.workouts)} />
      </div>

      <dl className="mb-4 space-y-1 text-[length:var(--text-xs)]">
        <div className="flex justify-between">
          <dt className="text-[color:var(--color-text-muted)]">Conectado</dt>
          <dd className="text-[color:var(--color-text-primary)]">
            {new Date(connectedAt).toLocaleDateString('es-ES')}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-[color:var(--color-text-muted)]">Último sync</dt>
          <dd className="text-[color:var(--color-text-primary)]">
            {lastSyncedAt ? new Date(lastSyncedAt).toLocaleString('es-ES') : 'pendiente'}
          </dd>
        </div>
        {lastError && (
          <div className="mt-2 rounded-[var(--radius-sm)] bg-[color:var(--color-status-red)]/10 p-2 text-[color:var(--color-status-red)]">
            {lastError}
          </div>
        )}
      </dl>

      <div className="flex flex-wrap gap-2">
        <form action="/api/whoop/sync" method="post">
          <button
            type="submit"
            className="rounded-[var(--radius-md)] bg-[color:var(--color-accent)] px-3 py-1.5 text-[length:var(--text-xs)] font-medium text-[color:var(--color-text-on-accent)] transition hover:bg-[color:var(--color-accent-strong)]"
          >
            Sincronizar ahora
          </button>
        </form>
        <form action="/api/whoop/disconnect" method="post">
          <button
            type="submit"
            className="rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] px-3 py-1.5 text-[length:var(--text-xs)] text-[color:var(--color-text-secondary)] transition hover:border-[color:var(--color-status-red)] hover:text-[color:var(--color-status-red)]"
          >
            Desconectar
          </button>
        </form>
      </div>
    </div>
  );
}

function Stat({ label, value, subtitle }: { label: string; value: string; subtitle?: string }) {
  return (
    <div className="rounded-[var(--radius-sm)] border border-[color:var(--color-border-default)] p-3">
      <dt className="mb-1 text-[length:var(--text-xs)] uppercase tracking-wider text-[color:var(--color-text-muted)]">
        {label}
      </dt>
      <dd className="font-mono text-[length:var(--text-xl)] font-semibold tabular-nums text-[color:var(--color-text-primary)]">
        {value}
      </dd>
      {subtitle && (
        <div className="mt-0.5 text-[length:var(--text-xs)] text-[color:var(--color-text-muted)]">
          {subtitle}
        </div>
      )}
    </div>
  );
}

function WhoopDisconnected() {
  return (
    <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] p-5">
      <p className="mb-4 text-[length:var(--text-sm)] text-[color:var(--color-text-secondary)]">
        Conecta tu Whoop. El primer sync trae los últimos 90 días automáticamente.
      </p>
      <a
        href="/api/whoop/authorize"
        className="inline-block rounded-[var(--radius-md)] bg-[color:var(--color-accent)] px-4 py-2 text-[length:var(--text-sm)] font-medium text-[color:var(--color-text-on-accent)] transition hover:bg-[color:var(--color-accent-strong)]"
      >
        Conectar Whoop
      </a>
    </div>
  );
}
