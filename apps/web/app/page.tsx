import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { RecoveryRing } from '@/components/recovery-ring';
import { WhoopStatusBanner } from '@/components/whoop-status-banner';
import { TodayStats } from '@/components/today-stats';
import { TrainingRecent } from '@/components/training-recent';
import { VerdictCard } from '@/components/verdict-card';
import { LapseBanner } from '@/components/lapse-banner';
import { QuickCoachActions } from '@/components/quick-coach-actions';

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
    .select('display_name, onboarding_status, role')
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

  // Fetch dashboard data only if Whoop connected
  let dashData: {
    todayRecovery: { score: number | null; date: string | null };
    todayCycle: { strain: number | null; avgHr: number | null; maxHr: number | null };
    lastSleep: { sleepMinutes: number | null; efficiencyPct: number | null; date: string | null };
    last7DaysRecovery: Array<{ date: string; score: number | null }>;
    counts: { cycles: number; recovery: number; sleep: number; workouts: number };
  } | null = null;

  if (whoop) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3_600_000).toISOString().slice(0, 10);

    const [
      cyclesCount,
      recoveryCount,
      sleepCount,
      workoutsCount,
      latestRecovery,
      latestCycle,
      latestSleep,
      recovery7d,
    ] = await Promise.all([
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
      supabase
        .from('whoop_cycles')
        .select('strain, avg_hr, max_hr, start_at')
        .eq('user_id', user.id)
        .order('start_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('whoop_sleep')
        .select('sleep_minutes, efficiency_pct, start_at')
        .eq('user_id', user.id)
        .order('start_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('whoop_recovery')
        .select('date, score')
        .eq('user_id', user.id)
        .gte('date', sevenDaysAgo)
        .order('date', { ascending: true }),
    ]);

    dashData = {
      todayRecovery: {
        score: latestRecovery.data?.score ?? null,
        date: latestRecovery.data?.date ?? null,
      },
      todayCycle: {
        strain: latestCycle.data?.strain ?? null,
        avgHr: latestCycle.data?.avg_hr ?? null,
        maxHr: latestCycle.data?.max_hr ?? null,
      },
      lastSleep: {
        sleepMinutes: latestSleep.data?.sleep_minutes ?? null,
        efficiencyPct: latestSleep.data?.efficiency_pct ?? null,
        date: latestSleep.data?.start_at?.slice(0, 10) ?? null,
      },
      last7DaysRecovery: (recovery7d.data ?? []).map((r) => ({
        date: r.date,
        score: r.score,
      })),
      counts: {
        cycles: cyclesCount.count ?? 0,
        recovery: recoveryCount.count ?? 0,
        sleep: sleepCount.count ?? 0,
        workouts: workoutsCount.count ?? 0,
      },
    };
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="surface-glass p-8 md:p-10">
        <p className="mb-3 text-sm font-medium uppercase tracking-wider text-[color:var(--color-text-muted)]">
          Fase 3 · Whoop
        </p>
        <h1 className="mb-6 font-[family-name:var(--font-display)] text-[length:var(--text-2xl)] font-bold leading-tight tracking-tight text-[color:var(--color-text-primary)]">
          Hola, {profile?.display_name ?? 'atleta'}.
        </h1>

        <LapseBanner />

        {whoop && (
          <WhoopStatusBanner
            status={whoop.status}
            lastSyncedAt={whoop.last_synced_at}
            lastError={whoop.last_error}
            hasConnection={true}
          />
        )}

        {successFlash && (
          <Flash kind="green">Whoop conectado. Backfill 90 días en background.</Flash>
        )}

        {syncFlash && (
          <Flash kind={syncFlash.errors.length > 0 ? 'amber' : 'green'}>
            Sync: {syncFlash.cycles} cycles · {syncFlash.recovery} recovery ·{' '}
            {syncFlash.sleep} sleep · {syncFlash.workouts} workouts
            {syncFlash.errors.length > 0 && (
              <details className="mt-2 text-[length:var(--text-xs)] opacity-90">
                <summary className="cursor-pointer">{syncFlash.errors.length} error(es)</summary>
                <ul className="mt-1 list-disc pl-5">
                  {syncFlash.errors.map((e, i) => (
                    <li key={i} className="font-mono">
                      {e}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </Flash>
        )}

        {errorFlash && <Flash kind="red">{errorFlash}</Flash>}

        {whoop && dashData ? (
          <Dashboard data={dashData} />
        ) : (
          <WhoopDisconnected />
        )}

        <div className="my-8 border-t border-[color:var(--color-border-default)]" />

        <VerdictCard />

        <QuickCoachActions />

        <TodayStats />

        <TrainingRecent />

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--color-border-default)] pt-6">
          <div className="flex gap-4">
            <Link
              href="/chat?role=nutrition"
              className="text-[length:var(--text-sm)] text-[color:var(--color-text-muted)] underline-offset-2 hover:underline"
            >
              Chat
            </Link>
            <Link
              href="/profile"
              className="text-[length:var(--text-sm)] text-[color:var(--color-text-muted)] underline-offset-2 hover:underline"
            >
              Perfil
            </Link>
            {profile?.role === 'admin' && (
              <Link
                href="/admin"
                className="text-[length:var(--text-sm)] font-medium text-[color:var(--color-accent)] underline-offset-2 hover:underline"
              >
                Admin
              </Link>
            )}
          </div>
          {whoop && (
            <div className="flex gap-2">
              <form action="/api/whoop/sync" method="post">
                <button
                  type="submit"
                  className="rounded-[var(--radius-md)] bg-[color:var(--color-accent)] px-4 py-2 text-[length:var(--text-sm)] font-medium text-[color:var(--color-text-on-accent)] transition hover:bg-[color:var(--color-accent-strong)]"
                >
                  Sincronizar ahora
                </button>
              </form>
              <form action="/api/whoop/disconnect" method="post">
                <button
                  type="submit"
                  className="rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] px-4 py-2 text-[length:var(--text-sm)] text-[color:var(--color-text-secondary)] transition hover:border-[color:var(--color-status-red)] hover:text-[color:var(--color-status-red)]"
                >
                  Desconectar
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function Dashboard({
  data,
}: {
  data: {
    todayRecovery: { score: number | null; date: string | null };
    todayCycle: { strain: number | null; avgHr: number | null; maxHr: number | null };
    lastSleep: { sleepMinutes: number | null; efficiencyPct: number | null; date: string | null };
    last7DaysRecovery: Array<{ date: string; score: number | null }>;
    counts: { cycles: number; recovery: number; sleep: number; workouts: number };
  };
}) {
  return (
    <>
      <section className="mb-8 flex flex-col items-center">
        <RecoveryRing score={data.todayRecovery.score} />
        {data.todayRecovery.date && (
          <p className="mt-3 text-[length:var(--text-xs)] uppercase tracking-wider text-[color:var(--color-text-muted)]">
            {new Date(data.todayRecovery.date).toLocaleDateString('es-ES', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
        )}
      </section>

      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat
          label="Strain"
          value={data.todayCycle.strain !== null ? data.todayCycle.strain.toFixed(1) : '—'}
          subtitle="hoy"
        />
        <Stat
          label="Sleep"
          value={
            data.lastSleep.sleepMinutes !== null
              ? formatMinutes(data.lastSleep.sleepMinutes)
              : '—'
          }
          subtitle={
            data.lastSleep.efficiencyPct !== null
              ? `${data.lastSleep.efficiencyPct.toFixed(0)}% efic.`
              : ''
          }
        />
        <Stat
          label="HR medio"
          value={data.todayCycle.avgHr !== null ? String(data.todayCycle.avgHr) : '—'}
          subtitle={data.todayCycle.maxHr !== null ? `máx ${data.todayCycle.maxHr}` : ''}
        />
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-[length:var(--text-sm)] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">
          Recovery últimos 7 días
        </h2>
        <Recovery7DayChart data={data.last7DaysRecovery} />
      </section>

      <section>
        <p className="text-[length:var(--text-xs)] text-[color:var(--color-text-muted)]">
          {data.counts.cycles} cycles · {data.counts.recovery} recovery · {data.counts.sleep} sleep ·{' '}
          {data.counts.workouts} workouts en total.
        </p>
      </section>
    </>
  );
}

function formatMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${h}h ${min.toString().padStart(2, '0')}m`;
}

function Stat({ label, value, subtitle }: { label: string; value: string; subtitle?: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] p-3">
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

function Recovery7DayChart({ data }: { data: Array<{ date: string; score: number | null }> }) {
  // Simple bar chart with bars colored by recovery zones.
  if (data.length === 0) {
    return (
      <p className="text-[length:var(--text-sm)] text-[color:var(--color-text-muted)]">
        Sin datos de recovery aún.
      </p>
    );
  }
  return (
    <div className="flex items-end justify-between gap-2 rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] p-4">
      {data.map((d) => {
        const score = d.score;
        const heightPct = score !== null ? Math.max(8, score) : 8;
        let color = 'var(--color-text-muted)';
        if (score !== null) {
          if (score >= 67) color = 'var(--color-status-green)';
          else if (score >= 34) color = 'var(--color-status-amber)';
          else color = 'var(--color-status-red)';
        }
        const day = new Date(d.date).toLocaleDateString('es-ES', { weekday: 'narrow' });
        return (
          <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-24 w-full items-end">
              <div
                className="w-full rounded-t-[var(--radius-sm)]"
                style={{
                  height: `${heightPct}%`,
                  background: color,
                  opacity: score !== null ? 1 : 0.2,
                }}
                aria-label={score !== null ? `Recovery ${score}` : 'Sin datos'}
              />
            </div>
            <div className="text-[length:var(--text-xs)] font-mono tabular-nums text-[color:var(--color-text-secondary)]">
              {score ?? '—'}
            </div>
            <div className="text-[length:var(--text-xs)] uppercase text-[color:var(--color-text-muted)]">
              {day}
            </div>
          </div>
        );
      })}
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
