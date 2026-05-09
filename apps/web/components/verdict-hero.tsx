import {
  computeVerdict,
  DEFAULT_GOALS,
  type VerdictInput,
  type VerdictStatus,
} from '@creed/agents';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const STATUS_TITLE: Record<VerdictStatus, string> = {
  green: 'Verde.',
  amber: 'En curso.',
  red: 'En riesgo.',
};

const SHORT_MONTH_ES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

export async function VerdictHero() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const weekStart = startOfIsoWeek(today);
  const weekEnd = new Date(weekStart.getTime() + 6 * 86_400_000);

  const since14d = new Date(today.getTime() - 14 * 86_400_000).toISOString();
  const since14dDate = since14d.slice(0, 10);
  const since7dDate = new Date(today.getTime() - 7 * 86_400_000).toISOString().slice(0, 10);

  const [recoveries, weights, meals, trainings, moods, sevenDayRec] = await Promise.all([
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
    supabase
      .from('whoop_recovery')
      .select('date, score')
      .eq('user_id', user.id)
      .gte('date', since7dDate)
      .order('date', { ascending: true }),
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
        date: w.measured_at.slice(0, 10),
        weight_kg: Number(w.weight_kg),
      })),
    meals: (meals.data ?? []).map((m) => ({ date: m.consumed_at.slice(0, 10) })),
    trainings: (trainings.data ?? []).map((t) => ({
      date: t.scheduled_for,
      status: t.status,
    })),
    moods: (moods.data ?? []).map((m) => ({ mood: m.mood, energy: m.energy })),
    goals: DEFAULT_GOALS,
  };

  const verdict = computeVerdict(input);
  const greenCount = countGreenComponents(verdict.components);
  const subtitle = verdict.text || buildFallbackSubtitle(verdict.status);

  return (
    <section className="surface-glass mb-4 p-6">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <span className="text-label">VEREDICTO · {fmtRange(weekStart, weekEnd)}</span>
        <span className="text-label tabular-nums">
          {greenCount} / 4 <StatusGlyph status={verdict.status} />
        </span>
      </div>

      <h2 className="mb-3 text-verdict text-[color:var(--color-text-primary)]">
        {STATUS_TITLE[verdict.status]}
      </h2>

      <p className="mb-5 max-w-md text-[length:var(--text-sm)] leading-relaxed text-[color:var(--color-text-secondary)]">
        {subtitle}
      </p>

      <Sparkline data={sevenDayRec.data ?? []} />
    </section>
  );
}

function StatusGlyph({ status }: { status: VerdictStatus }) {
  if (status === 'green') return <span aria-hidden>✓</span>;
  if (status === 'amber') return <span aria-hidden>↗</span>;
  return <span aria-hidden>!</span>;
}

function countGreenComponents(c: {
  weight_trend: { direction: string };
  recovery_avg_14d: number | null;
  adherence_meals_pct: number;
  adherence_training_pct: number;
}): number {
  let n = 0;
  if (c.weight_trend.direction === 'down' || c.weight_trend.direction === 'flat') n++;
  if (c.recovery_avg_14d !== null && c.recovery_avg_14d >= 60) n++;
  if (c.adherence_meals_pct >= 70) n++;
  if (c.adherence_training_pct >= 70) n++;
  return n;
}

function buildFallbackSubtitle(status: VerdictStatus): string {
  if (status === 'green') return 'Cuatro pilares en verde. Mantén el ritmo.';
  if (status === 'amber') return 'Tres pilares en verde. Recovery exige ajuste esta semana.';
  return 'Dos o más pilares en rojo. Pide al coach un plan de recuperación.';
}

function startOfIsoWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay() || 7;
  if (day !== 1) d.setDate(d.getDate() - (day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function fmtRange(start: Date, end: Date): string {
  const sd = String(start.getDate()).padStart(2, '0');
  const ed = String(end.getDate()).padStart(2, '0');
  if (start.getMonth() === end.getMonth()) {
    return `${sd}–${ed} ${SHORT_MONTH_ES[start.getMonth()]!.toUpperCase()}`;
  }
  return `${sd} ${SHORT_MONTH_ES[start.getMonth()]!.toUpperCase()} – ${ed} ${SHORT_MONTH_ES[end.getMonth()]!.toUpperCase()}`;
}

function Sparkline({ data }: { data: Array<{ date: string; score: number | null }> }) {
  if (data.length < 2) {
    return (
      <div className="h-10 rounded-[var(--radius-sm)] bg-[color:var(--color-surface-raised)] opacity-50" />
    );
  }
  const w = 280;
  const h = 40;
  const pad = 6;
  const scores = data.map((d) => d.score ?? 50);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;
  const stepX = (w - pad * 2) / (data.length - 1);
  const points = scores
    .map((s, i) => {
      const x = pad + i * stepX;
      const y = h - pad - ((s - min) / range) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const lastX = pad + (data.length - 1) * stepX;
  const lastScore = scores[scores.length - 1]!;
  const lastY = h - pad - ((lastScore - min) / range) * (h - pad * 2);

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="h-10 w-full text-[color:var(--color-text-primary)]"
      aria-label="Recovery últimos 7 días"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r="3" className="fill-[color:var(--color-accent)]" />
    </svg>
  );
}
