import { listRecentMeals, countMealsToday } from '@/lib/actions/meals';
import { listRecentMeasurements } from '@/lib/actions/body-measurements';
import { sumHydrationToday } from '@/lib/actions/hydration';
import { getLatestMoodEnergy } from '@/lib/actions/mood-energy';
import { LogMealButton } from './log-meal-sheet';
import { LogWeightButton } from './log-weight-sheet';
import { QuickHydration } from './quick-hydration';
import { QuickMood } from './quick-mood';

export async function TodayStats() {
  const [mealsCount, hydrationMl, measurements, latestMood, recentMeals] = await Promise.all([
    countMealsToday(),
    sumHydrationToday(),
    listRecentMeasurements(2),
    getLatestMoodEnergy(),
    listRecentMeals(3),
  ]);

  const latestWeight = measurements[0]?.weight_kg ?? null;
  const previousWeight = measurements[1]?.weight_kg ?? null;
  const weightDelta =
    latestWeight !== null && previousWeight !== null
      ? Number((latestWeight - previousWeight).toFixed(1))
      : null;

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-[length:var(--text-sm)] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">
        Hoy
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card title="Comidas hoy" value={String(mealsCount)} action={<LogMealButton />}>
          {recentMeals.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-[length:var(--text-xs)] text-[color:var(--color-text-muted)]">
              {recentMeals.map((m) => (
                <li key={m.id} className="truncate">
                  · {m.raw_text}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card
          title="Hidratación"
          value={`${hydrationMl} ml`}
          action={<QuickHydration />}
        >
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[color:var(--color-border-default)]">
            <div
              className="h-full bg-[color:var(--color-accent)]"
              style={{ width: `${Math.min(100, (hydrationMl / 2500) * 100)}%` }}
              aria-label={`${hydrationMl} ml de 2500 ml objetivo`}
            />
          </div>
        </Card>
        <Card
          title="Peso último"
          value={latestWeight !== null ? `${latestWeight.toFixed(1)} kg` : '—'}
          action={<LogWeightButton />}
        >
          {weightDelta !== null && (
            <p
              className="mt-1 text-[length:var(--text-xs)]"
              style={{
                color:
                  weightDelta === 0
                    ? 'var(--color-text-muted)'
                    : weightDelta < 0
                      ? 'var(--color-status-green)'
                      : 'var(--color-status-amber)',
              }}
            >
              {weightDelta > 0 ? '+' : ''}
              {weightDelta} kg vs medición anterior
            </p>
          )}
        </Card>
        <Card title="Mood / Energía" value="">
          <QuickMood
            initialMood={latestMood?.mood ?? null}
            initialEnergy={latestMood?.energy ?? null}
          />
        </Card>
      </div>
    </section>
  );
}

function Card({
  title,
  value,
  action,
  children,
}: {
  title: string;
  value: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[length:var(--text-xs)] uppercase tracking-wider text-[color:var(--color-text-muted)]">
            {title}
          </div>
          {value && (
            <div className="mt-1 font-mono text-[length:var(--text-xl)] font-semibold tabular-nums text-[color:var(--color-text-primary)]">
              {value}
            </div>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </div>
  );
}
