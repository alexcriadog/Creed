import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AppHeader } from '@/components/app-header';
import { VerdictHero } from '@/components/verdict-hero';
import { MetricGrid } from '@/components/metric-grid';
import { ConversationPreview } from '@/components/conversation-preview';
import { BottomNav } from '@/components/bottom-nav';
import { LapseBanner } from '@/components/lapse-banner';
import { PendingProposals } from '@/components/pending-proposals';
import { QuickCoachActions } from '@/components/quick-coach-actions';
import { WeekPlan } from '@/components/week-plan';
import { WhoopStatusBanner } from '@/components/whoop-status-banner';

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

  return (
    <>
      <main className="mx-auto max-w-md px-4 pb-32 pt-6 sm:max-w-lg sm:px-6 sm:pt-10">
        <AppHeader />

        <LapseBanner />

        {successFlash && (
          <Flash kind="green">Whoop conectado. Backfill 90 días en background.</Flash>
        )}

        {syncFlash && (
          <Flash kind={syncFlash.errors.length > 0 ? 'amber' : 'green'}>
            Sync: {syncFlash.cycles} cycles · {syncFlash.recovery} recovery ·{' '}
            {syncFlash.sleep} sleep · {syncFlash.workouts} workouts
          </Flash>
        )}

        {errorFlash && <Flash kind="red">{errorFlash}</Flash>}

        <VerdictHero />

        <MetricGrid />

        <PendingProposals />

        <ConversationPreview />

        <details className="mb-24 mt-8 rounded-[var(--radius-md)] border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-raised)] p-4">
          <summary className="cursor-pointer text-label">MÁS · ACCIONES Y PLAN</summary>
          <div className="mt-4 space-y-6">
            <QuickCoachActions />
            <WeekPlan />
            {whoop && (
              <WhoopStatusBanner
                status={whoop.status}
                lastSyncedAt={whoop.last_synced_at}
                lastError={whoop.last_error}
                hasConnection={true}
              />
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--color-border-default)] pt-4">
              <div className="flex gap-4">
                <Link
                  href="/chat"
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
              {whoop ? (
                <form action="/api/whoop/sync" method="post">
                  <button
                    type="submit"
                    className="rounded-[var(--radius-md)] bg-[color:var(--color-accent)] px-3 py-1.5 text-[length:var(--text-xs)] font-medium text-[color:var(--color-text-on-accent)]"
                  >
                    Sync
                  </button>
                </form>
              ) : (
                <a
                  href="/api/whoop/authorize"
                  className="rounded-[var(--radius-md)] bg-[color:var(--color-accent)] px-3 py-1.5 text-[length:var(--text-xs)] font-medium text-[color:var(--color-text-on-accent)]"
                >
                  Conectar Whoop
                </a>
              )}
            </div>
          </div>
        </details>
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
