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
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ whoop_connected?: string; whoop_error?: string }>;
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
    .select('whoop_user_id, status, last_synced_at, connected_at')
    .eq('user_id', user.id)
    .maybeSingle();

  const params = await searchParams;
  const successFlash = params.whoop_connected === '1';
  const errorFlash = params.whoop_error
    ? WHOOP_ERRORS[params.whoop_error] ?? `Error: ${params.whoop_error}`
    : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
      <div className="surface-glass p-8 md:p-12">
        <p className="mb-4 text-sm font-medium uppercase tracking-wider text-[color:var(--color-text-muted)]">
          Fase 3 · Whoop OAuth
        </p>
        <h1 className="mb-6 font-[family-name:var(--font-display)] text-[length:var(--text-display)] font-bold leading-[1.05] tracking-tight text-[color:var(--color-text-primary)]">
          Hola, {profile?.display_name ?? 'atleta'}.
        </h1>

        {successFlash && (
          <div
            role="alert"
            className="mb-6 rounded-[var(--radius-md)] border border-[color:var(--color-status-green)] bg-[color:var(--color-status-green)]/10 px-4 py-3 text-[length:var(--text-sm)] text-[color:var(--color-status-green)]"
          >
            Whoop conectado. La sincronización de datos llega en la siguiente sub-fase.
          </div>
        )}

        {errorFlash && (
          <div
            role="alert"
            className="mb-6 rounded-[var(--radius-md)] border border-[color:var(--color-status-red)] bg-[color:var(--color-status-red)]/10 px-4 py-3 text-[length:var(--text-sm)] text-[color:var(--color-status-red)]"
          >
            {errorFlash}
          </div>
        )}

        <section className="mb-8">
          <h2 className="mb-3 text-[length:var(--text-lg)] font-semibold text-[color:var(--color-text-primary)]">
            Wearable
          </h2>
          {whoop ? (
            <WhoopConnected
              whoopUserId={whoop.whoop_user_id}
              status={whoop.status}
              lastSyncedAt={whoop.last_synced_at}
              connectedAt={whoop.connected_at}
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

function WhoopConnected({
  whoopUserId,
  status,
  lastSyncedAt,
  connectedAt,
}: {
  whoopUserId: string;
  status: string;
  lastSyncedAt: string | null;
  connectedAt: string;
}) {
  const statusColor =
    status === 'connected'
      ? 'var(--color-status-green)'
      : status === 'expired'
        ? 'var(--color-status-amber)'
        : 'var(--color-status-red)';

  return (
    <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] p-5">
      <div className="mb-3 flex items-center gap-2">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: statusColor }}
          aria-hidden
        />
        <span className="text-[length:var(--text-sm)] font-medium uppercase tracking-wider text-[color:var(--color-text-secondary)]">
          Whoop · {status}
        </span>
      </div>
      <dl className="mb-4 space-y-1 text-[length:var(--text-sm)]">
        <div className="flex justify-between">
          <dt className="text-[color:var(--color-text-muted)]">Whoop user ID</dt>
          <dd className="font-mono text-[color:var(--color-text-primary)]">{whoopUserId}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-[color:var(--color-text-muted)]">Conectado</dt>
          <dd className="text-[color:var(--color-text-primary)]">
            {new Date(connectedAt).toLocaleDateString('es-ES')}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-[color:var(--color-text-muted)]">Último sync</dt>
          <dd className="text-[color:var(--color-text-primary)]">
            {lastSyncedAt ? new Date(lastSyncedAt).toLocaleString('es-ES') : '—'}
          </dd>
        </div>
      </dl>
      <form action="/api/whoop/disconnect" method="post">
        <button
          type="submit"
          className="rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] px-3 py-1.5 text-[length:var(--text-xs)] text-[color:var(--color-text-secondary)] transition hover:border-[color:var(--color-status-red)] hover:text-[color:var(--color-status-red)]"
        >
          Desconectar
        </button>
      </form>
    </div>
  );
}

function WhoopDisconnected() {
  return (
    <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] p-5">
      <p className="mb-4 text-[length:var(--text-sm)] text-[color:var(--color-text-secondary)]">
        Conecta tu Whoop para que el coach lea tu recovery, sleep, strain y workouts. Puedes desconectarlo en cualquier momento.
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
