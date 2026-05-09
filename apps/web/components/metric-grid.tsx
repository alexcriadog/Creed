import { createSupabaseServerClient } from '@/lib/supabase/server';

type Tone = 'green' | 'amber' | 'red' | 'neutral';

interface MetricCardProps {
  label: string;
  value: string;
  unit?: string | null;
  delta?: { text: string; tone: Tone } | null;
}

export async function MetricGrid() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const today = new Date();
  const weekStart = startOfIsoWeek(today);
  const weekStartIso = weekStart.toISOString().slice(0, 10);
  const weekEndIso = new Date(weekStart.getTime() + 6 * 86_400_000).toISOString().slice(0, 10);
  const since14d = new Date(today.getTime() - 14 * 86_400_000).toISOString();

  const [sessionsResp, weightsResp, recoveryResp, priorRecoveryResp, folderResp] = await Promise.all([
    supabase
      .from('training_sessions')
      .select('status')
      .eq('user_id', user.id)
      .gte('scheduled_for', weekStartIso)
      .lte('scheduled_for', weekEndIso),
    supabase
      .from('body_measurements')
      .select('measured_at, weight_kg')
      .eq('user_id', user.id)
      .gte('measured_at', since14d)
      .order('measured_at', { ascending: false })
      .limit(8),
    supabase
      .from('whoop_recovery')
      .select('score')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('whoop_recovery')
      .select('score')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .range(1, 8),
    supabase
      .from('athlete_folder')
      .select('target_weight_kg')
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  const sessions = sessionsResp.data ?? [];
  const total = sessions.length;
  const done = sessions.filter((s) => s.status === 'done').length;

  return (
    <section className="mb-4 grid grid-cols-2 gap-3">
      <MetricCard {...buildAdherence(done, total)} />
      <MetricCard
        {...buildWeight(weightsResp.data ?? [], folderResp.data?.target_weight_kg ?? null)}
      />
      <MetricCard
        {...buildRecovery(
          recoveryResp.data?.score ?? null,
          (priorRecoveryResp.data ?? []).map((r) => r.score),
        )}
      />
      <MetricCard {...buildSessions(done, total)} />
    </section>
  );
}

function MetricCard({ label, value, unit, delta }: MetricCardProps) {
  return (
    <div className="metric-card">
      <div className="mb-2 flex items-center gap-1.5">
        {delta && <span className={`h-1.5 w-1.5 rounded-full ${dotClass(delta.tone)}`} aria-hidden />}
        <span className="text-label">{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-numeric-display text-[color:var(--color-text-primary)]">{value}</span>
        {unit && (
          <span className="text-[length:var(--text-sm)] text-[color:var(--color-text-muted)]">
            {unit}
          </span>
        )}
        {delta && delta.text && (
          <span className={`text-[length:var(--text-xs)] tabular-nums ${textClass(delta.tone)}`}>
            {delta.text}
          </span>
        )}
      </div>
    </div>
  );
}

function dotClass(tone: Tone): string {
  if (tone === 'green') return 'bg-[color:var(--color-status-green)]';
  if (tone === 'amber') return 'bg-[color:var(--color-status-amber)]';
  if (tone === 'red') return 'bg-[color:var(--color-status-red)]';
  return 'bg-[color:var(--color-text-muted)]';
}

function textClass(tone: Tone): string {
  if (tone === 'green') return 'text-[color:var(--color-status-green)]';
  if (tone === 'amber') return 'text-[color:var(--color-status-amber)]';
  if (tone === 'red') return 'text-[color:var(--color-status-red)]';
  return 'text-[color:var(--color-text-muted)]';
}

function buildAdherence(done: number, total: number): MetricCardProps {
  if (total === 0) {
    return { label: 'ADHERENCIA', value: '—', delta: { text: 'sin plan', tone: 'neutral' } };
  }
  const pct = Math.round((done / total) * 100);
  const tone: Tone = pct >= 80 ? 'green' : pct >= 50 ? 'amber' : 'red';
  return { label: 'ADHERENCIA', value: `${pct}%`, delta: { text: `${done}/${total}`, tone } };
}

function buildWeight(
  weights: Array<{ measured_at: string; weight_kg: number | string | null }>,
  target: number | null,
): MetricCardProps {
  const valid = weights.filter((w) => w.weight_kg !== null);
  if (valid.length === 0) {
    return { label: 'PESO', value: '—', delta: null };
  }
  const latest = Number(valid[0]!.weight_kg);
  if (valid.length === 1) {
    return { label: 'PESO', value: latest.toFixed(1), unit: 'kg', delta: null };
  }
  const oldest = Number(valid[valid.length - 1]!.weight_kg);
  const delta = latest - oldest;
  const sign = delta >= 0 ? '+' : '';
  let tone: Tone = 'neutral';
  if (target !== null) {
    const closer = Math.abs(latest - target) <= Math.abs(oldest - target);
    tone = closer ? 'green' : 'amber';
  }
  return {
    label: 'PESO',
    value: `${sign}${delta.toFixed(1)}`,
    unit: 'kg',
    delta: { text: `${latest.toFixed(1)}kg`, tone },
  };
}

function buildRecovery(latest: number | null, prior: Array<number | null>): MetricCardProps {
  if (latest === null) {
    return { label: 'RECOVERY', value: '—', delta: { text: 'sin datos', tone: 'neutral' } };
  }
  const validPrior = prior.filter((s): s is number => s !== null);
  const avg =
    validPrior.length > 0
      ? Math.round(validPrior.reduce((a, b) => a + b, 0) / validPrior.length)
      : null;
  const delta = avg !== null ? latest - avg : null;
  const tone: Tone = latest >= 67 ? 'green' : latest >= 34 ? 'amber' : 'red';
  return {
    label: 'RECOVERY',
    value: String(latest),
    delta: delta !== null ? { text: `${delta >= 0 ? '+' : ''}${delta}`, tone } : null,
  };
}

function buildSessions(done: number, total: number): MetricCardProps {
  if (total === 0) {
    return { label: 'SESIONES', value: '0', delta: { text: 'sin plan', tone: 'neutral' } };
  }
  const tone: Tone = done === total ? 'green' : done >= Math.ceil(total / 2) ? 'amber' : 'red';
  return {
    label: 'SESIONES',
    value: `${done}/${total}`,
    delta: { text: done === total ? '✓' : `${total - done} pdt`, tone },
  };
}

function startOfIsoWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay() || 7;
  if (day !== 1) d.setDate(d.getDate() - (day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}
