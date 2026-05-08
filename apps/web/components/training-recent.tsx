import { listRecentSessions } from '@/lib/actions/training';
import { LogTrainingButton } from './log-training-sheet';

const TYPE_LABEL: Record<string, string> = {
  push: 'Push',
  pull: 'Pull',
  legs: 'Legs',
  full: 'Full body',
  cardio: 'Cardio',
  rest: 'Descanso',
  other: 'Otro',
};

interface Badge {
  label: string;
  color: string;
}
const STATUS_BADGE: Record<string, Badge> = {
  scheduled: { label: 'Programada', color: 'var(--color-text-muted)' },
  done: { label: 'Hecha', color: 'var(--color-status-green)' },
  partial: { label: 'Parcial', color: 'var(--color-status-amber)' },
  skipped: { label: 'Saltada', color: 'var(--color-status-red)' },
};
const FALLBACK_BADGE: Badge = { label: 'Programada', color: 'var(--color-text-muted)' };

export async function TrainingRecent() {
  const sessions = await listRecentSessions(5);

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[length:var(--text-sm)] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">
          Entrenamientos recientes
        </h2>
        <LogTrainingButton />
      </div>
      {sessions.length === 0 ? (
        <p className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-border-default)] p-4 text-center text-[length:var(--text-sm)] text-[color:var(--color-text-muted)]">
          Sin sesiones todavía. Crea la primera con &ldquo;+ Sesión&rdquo;.
        </p>
      ) : (
        <ul className="divide-y divide-[color:var(--color-border-default)] rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)]">
          {sessions.map((s) => {
            const badge = STATUS_BADGE[s.status] ?? FALLBACK_BADGE;
            const date = new Date(s.scheduled_for + 'T00:00:00').toLocaleDateString('es-ES', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            });
            return (
              <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <div className="text-[length:var(--text-sm)] text-[color:var(--color-text-primary)]">
                    {date}
                    {s.type ? ` · ${TYPE_LABEL[s.type] ?? s.type}` : ''}
                    {s.rpe ? ` · RPE ${s.rpe}` : ''}
                  </div>
                  {s.notes && (
                    <div className="truncate text-[length:var(--text-xs)] text-[color:var(--color-text-muted)]">
                      {s.notes}
                    </div>
                  )}
                </div>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[length:var(--text-xs)] font-medium"
                  style={{
                    color: badge.color,
                    background: `color-mix(in oklch, ${badge.color} 12%, transparent)`,
                  }}
                >
                  {badge.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
