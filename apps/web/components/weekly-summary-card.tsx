import { createSupabaseServerClient } from '@/lib/supabase/server';

interface TrainingBlock {
  adherence_pct?: number | null;
  sessions_done?: number;
  sessions_prescribed?: number;
  total_volume_kg?: number;
  avg_rpe?: number | null;
  whoop_workouts_linked?: number;
}
interface WhoopBlock {
  avg_strain?: number | null;
  avg_recovery?: number | null;
}
interface NutritionBlock {
  meals_logged?: number;
  days_with_macros?: number;
}
interface WeightBlock {
  latest_kg?: number;
  delta_kg?: number | null;
}
interface ParallelSport {
  sport: string;
  sessions: number;
  avg_strain?: number | null;
}

const SPORT_ICON: Record<string, string> = {
  padel: '🎾',
  tennis: '🎾',
  football: '⚽',
  soccer: '⚽',
  basketball: '🏀',
  running: '🏃',
  cycling: '🚴',
  climb: '🧗',
  escalada: '🧗',
  swim: '🏊',
};

function sportIcon(sport: string): string {
  for (const key of Object.keys(SPORT_ICON)) {
    if (sport.toLowerCase().includes(key)) return SPORT_ICON[key]!;
  }
  return '🏅';
}

export async function WeeklySummaryCard() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: row } = await supabase
    .from('weekly_verdicts')
    .select('week_start, status, components')
    .eq('user_id', user.id)
    .order('week_start', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) return null;

  const components = (row.components as Record<string, unknown> | null) ?? {};
  const training = components.training as TrainingBlock | undefined;
  const whoop = components.whoop as WhoopBlock | undefined;
  const nutrition = components.nutrition as NutritionBlock | undefined;
  const weight = components.weight as WeightBlock | undefined;
  const parallels = (components.parallel_sports as ParallelSport[] | undefined) ?? [];

  // Si no hay ningún bloque rico, no renderizamos nada (mejor que mostrar ceros).
  const hasAny = !!(training || whoop || nutrition || weight || parallels.length > 0);
  if (!hasAny) return null;

  const weekLabel = formatWeekLabel(row.week_start as string);

  return (
    <section className="surface-glass mb-4 px-5 py-4">
      <header className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-label">SEMANA · {weekLabel.toUpperCase()}</h2>
      </header>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {training && (
          <Metric
            label="Adherencia"
            value={
              training.adherence_pct !== null && training.adherence_pct !== undefined
                ? `${training.adherence_pct}%`
                : '–'
            }
            sub={`${training.sessions_done ?? 0}/${training.sessions_prescribed ?? 0} sesiones`}
          />
        )}
        {training && (
          <Metric
            label="Volumen"
            value={
              training.total_volume_kg
                ? `${Math.round(training.total_volume_kg)} kg`
                : '–'
            }
            sub={
              training.avg_rpe !== null && training.avg_rpe !== undefined
                ? `RPE ${training.avg_rpe}`
                : 'sin RPE'
            }
          />
        )}
        {weight && (
          <Metric
            label="Peso"
            value={
              weight.latest_kg !== undefined ? `${weight.latest_kg} kg` : '–'
            }
            sub={
              weight.delta_kg !== null && weight.delta_kg !== undefined
                ? `${weight.delta_kg > 0 ? '+' : ''}${weight.delta_kg} kg`
                : 'sin cambio'
            }
          />
        )}
        {whoop && (
          <Metric
            label="Whoop"
            value={
              whoop.avg_recovery !== null && whoop.avg_recovery !== undefined
                ? `Rec ${whoop.avg_recovery}`
                : '–'
            }
            sub={
              whoop.avg_strain !== null && whoop.avg_strain !== undefined
                ? `Strain ${whoop.avg_strain}`
                : ''
            }
          />
        )}
      </div>
      {nutrition && (
        <div className="mt-3 flex items-center gap-2 text-[length:var(--text-xs)] text-[color:var(--color-text-muted)]">
          <span aria-hidden>🥗</span>
          {nutrition.meals_logged ?? 0} comidas registradas
          {nutrition.days_with_macros
            ? ` · ${nutrition.days_with_macros} días con macros`
            : ''}
        </div>
      )}
      {parallels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {parallels.map((p) => (
            <span
              key={p.sport}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] px-2.5 py-0.5 text-[length:var(--text-xs)] text-[color:var(--color-text-secondary)]"
            >
              <span aria-hidden>{sportIcon(p.sport)}</span>
              {p.sport} · {p.sessions} {p.sessions === 1 ? 'sesión' : 'sesiones'}
              {p.avg_strain !== null && p.avg_strain !== undefined
                ? ` · strain ${p.avg_strain}`
                : ''}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function formatWeekLabel(weekStart: string): string {
  const start = new Date(weekStart + 'T00:00:00');
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  return `${fmt(start)} – ${fmt(end)}`;
}

function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface)] px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--color-text-muted)]">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-[length:var(--text-base)] font-semibold tabular-nums text-[color:var(--color-text-primary)]">
        {value}
      </div>
      {sub && (
        <div className="text-[10px] text-[color:var(--color-text-muted)]">{sub}</div>
      )}
    </div>
  );
}
