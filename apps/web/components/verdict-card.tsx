/**
 * VerdictCard — server component que computa el veredicto compuesto del usuario
 * en vivo (sin esperar al cron). Reusa `computeVerdict` de @creed/agents.
 */
import { computeVerdict, DEFAULT_GOALS, type VerdictInput } from '@creed/agents';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const STATUS_COLOR: Record<string, string> = {
  green: 'var(--color-status-green)',
  amber: 'var(--color-status-amber)',
  red: 'var(--color-status-red)',
};

const STATUS_LABEL: Record<string, string> = {
  green: 'Verde',
  amber: 'Ámbar',
  red: 'Rojo',
};

function isoDate(d: string | null | undefined): string {
  if (!d) return '';
  return d.slice(0, 10);
}

export async function VerdictCard() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const since14d = new Date(today.getTime() - 14 * 86_400_000).toISOString();
  const since7dDate = new Date(today.getTime() - 7 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const since14dDate = since14d.slice(0, 10);

  const [recoveries, weights, meals, trainings, moods] = await Promise.all([
    supabase
      .from('whoop_recovery')
      .select('date, score')
      .eq('user_id', user.id)
      .gte('date', since14dDate),
    supabase
      .from('body_measurements')
      .select('measured_at, weight_kg')
      .eq('user_id', user.id)
      .gte('measured_at', since14d)
      .order('measured_at', { ascending: true }),
    supabase
      .from('meals')
      .select('consumed_at')
      .eq('user_id', user.id)
      .gte('consumed_at', since14d),
    supabase
      .from('training_sessions')
      .select('scheduled_for, status')
      .eq('user_id', user.id)
      .gte('scheduled_for', since7dDate),
    supabase
      .from('mood_energy_log')
      .select('mood, energy')
      .eq('user_id', user.id)
      .gte('logged_at', since14d),
  ]);

  const input: VerdictInput = {
    today: todayIso,
    recoveries: (recoveries.data ?? []).map((r) => ({
      date: r.date,
      score: r.score,
    })),
    weights: (weights.data ?? [])
      .filter((w) => w.weight_kg !== null)
      .map((w) => ({
        date: isoDate(w.measured_at),
        weight_kg: Number(w.weight_kg),
      })),
    meals: (meals.data ?? []).map((m) => ({ date: isoDate(m.consumed_at) })),
    trainings: (trainings.data ?? []).map((t) => ({
      date: t.scheduled_for,
      status: t.status,
    })),
    moods: (moods.data ?? []).map((m) => ({ mood: m.mood, energy: m.energy })),
    goals: DEFAULT_GOALS,
  };

  const verdict = computeVerdict(input);
  const color = STATUS_COLOR[verdict.status] ?? 'var(--color-text-muted)';

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-[length:var(--text-sm)] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">
        Veredicto semanal
      </h2>
      <div
        className="flex items-start gap-4 rounded-[var(--radius-md)] border p-4"
        style={{
          borderColor: color,
          background: `color-mix(in oklch, ${color} 8%, transparent)`,
        }}
      >
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-mono text-[length:var(--text-sm)] font-bold uppercase"
          style={{ background: color, color: 'var(--color-text-on-accent)' }}
        >
          {STATUS_LABEL[verdict.status]?.charAt(0) ?? '?'}
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="mb-1 text-[length:var(--text-base)] font-semibold"
            style={{ color }}
          >
            {STATUS_LABEL[verdict.status] ?? verdict.status}
          </p>
          <p className="text-[length:var(--text-sm)] text-[color:var(--color-text-secondary)]">
            {verdict.text}
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[length:var(--text-xs)] text-[color:var(--color-text-muted)] sm:grid-cols-4">
            <Metric
              label="Comidas"
              value={`${verdict.components.adherence_meals_pct}%`}
            />
            <Metric
              label="Entrenos"
              value={`${verdict.components.adherence_training_pct}%`}
            />
            <Metric
              label="Recovery"
              value={
                verdict.components.recovery_avg_14d !== null
                  ? String(verdict.components.recovery_avg_14d)
                  : '—'
              }
            />
            <Metric
              label="Peso"
              value={
                verdict.components.weight_trend.ema7_kg !== null
                  ? `${verdict.components.weight_trend.ema7_kg.toFixed(1)} kg`
                  : '—'
              }
            />
          </dl>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="uppercase tracking-wider">{label}</dt>
      <dd className="font-mono text-[length:var(--text-sm)] font-semibold tabular-nums text-[color:var(--color-text-primary)]">
        {value}
      </dd>
    </div>
  );
}
