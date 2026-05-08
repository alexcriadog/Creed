const STALE_HOURS = 25;

interface Props {
  status: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  hasConnection: boolean;
}

function hoursAgo(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 3_600_000;
}

export function WhoopStatusBanner({ status, lastSyncedAt, lastError, hasConnection }: Props) {
  if (!hasConnection) return null;
  if (status === 'connected' && lastSyncedAt && hoursAgo(lastSyncedAt) < STALE_HOURS) {
    return null; // todo OK, no banner
  }

  let kind: 'amber' | 'red' = 'amber';
  let title = '';
  let message = '';

  if (status === 'expired') {
    kind = 'amber';
    title = 'Whoop expirado';
    message = 'Tu conexión con Whoop ha caducado. Reconecta para volver a sincronizar.';
  } else if (status === 'revoked') {
    kind = 'red';
    title = 'Whoop revocado';
    message = 'Has revocado el acceso desde Whoop. Reconecta para sincronizar.';
  } else if (status === 'error') {
    kind = 'red';
    title = 'Whoop con error';
    message = lastError ?? 'Error desconocido. Inténtalo más tarde.';
  } else if (lastSyncedAt && hoursAgo(lastSyncedAt) >= STALE_HOURS) {
    kind = 'amber';
    title = 'Whoop atrasado';
    const h = Math.floor(hoursAgo(lastSyncedAt));
    message = `Sin sincronizar desde hace ${h} horas. Pulsa "Sincronizar ahora" o reconecta si persiste.`;
  } else {
    return null;
  }

  const color =
    kind === 'red' ? 'var(--color-status-red)' : 'var(--color-status-amber)';

  return (
    <div
      role="alert"
      className="mb-6 flex items-start gap-3 rounded-[var(--radius-md)] px-4 py-3 text-[length:var(--text-sm)]"
      style={{
        borderColor: color,
        color: color,
        background: `color-mix(in oklch, ${color} 10%, transparent)`,
        borderWidth: '1px',
        borderStyle: 'solid',
      }}
    >
      <span className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
      <div>
        <strong className="font-semibold">{title}.</strong> {message}
      </div>
    </div>
  );
}
