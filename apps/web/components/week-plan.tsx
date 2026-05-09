import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const TYPE_LABEL: Record<string, string> = {
  push: 'Push',
  pull: 'Pull',
  legs: 'Legs',
  full: 'Full',
  cardio: 'Cardio',
  rest: 'Descanso',
};

const STATUS_COLOR: Record<string, string> = {
  done: 'var(--color-status-green)',
  partial: 'var(--color-status-amber)',
  skipped: 'var(--color-status-red)',
  scheduled: 'var(--color-text-muted)',
};

const DAY_NAMES = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function mondayOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const m = new Date(d);
  m.setDate(d.getDate() - diff);
  m.setHours(0, 0, 0, 0);
  return m;
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface SessionRow {
  id: string;
  scheduled_for: string;
  type: string | null;
  status: string;
  whoop_workout_id: string | null;
  notes: string | null;
}

export async function WeekPlan() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const today = new Date();
  const monday = mondayOfWeek(today);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const { data } = await supabase
    .from('training_sessions')
    .select('id, scheduled_for, type, status, whoop_workout_id, notes')
    .eq('user_id', user.id)
    .gte('scheduled_for', isoDate(monday))
    .lte('scheduled_for', isoDate(sunday))
    .order('scheduled_for', { ascending: true });

  const sessions = (data ?? []) as SessionRow[];

  const days: Array<{
    date: string;
    label: string;
    dayNum: number;
    isToday: boolean;
    sessions: SessionRow[];
  }> = [];
  const todayIso = isoDate(today);
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateIso = isoDate(d);
    days.push({
      date: dateIso,
      label: DAY_NAMES[i] ?? '?',
      dayNum: d.getDate(),
      isToday: dateIso === todayIso,
      sessions: sessions.filter((s) => s.scheduled_for === dateIso),
    });
  }

  const weekRange = `${monday.getDate()} ${monday.toLocaleDateString('es-ES', { month: 'short' })} – ${sunday.getDate()} ${sunday.toLocaleDateString('es-ES', { month: 'short' })}`;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-label">SEMANA · {weekRange.toUpperCase()}</h2>
        <Link
          href={`/chat?role=training&prefill=${encodeURIComponent('Ajusta mi plan de la semana basándote en mi progreso de los últimos días.')}`}
          className="text-[length:var(--text-xs)] text-[color:var(--color-accent)] underline-offset-2 hover:underline"
        >
          Pídele ajuste →
        </Link>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const hasSession = d.sessions.length > 0;
          const main = d.sessions[0];
          const status = main?.status ?? null;
          const color = status
            ? (STATUS_COLOR[status] ?? STATUS_COLOR.scheduled!)
            : null;
          return (
            <div
              key={d.date}
              className="metric-card flex aspect-[3/4] flex-col p-2 text-center transition"
              style={
                d.isToday
                  ? {
                      borderColor: 'var(--color-accent)',
                      boxShadow:
                        'inset 0 1px 0 oklch(100% 0 0 / 0.5), 0 0 0 1px var(--color-accent), 0 1px 2px oklch(20% 0 0 / 0.04)',
                    }
                  : undefined
              }
            >
              <div className="text-label text-[10px] tracking-[0.15em]">{d.label}</div>
              <div className="mb-1 font-mono text-[length:var(--text-base)] font-semibold tabular-nums text-[color:var(--color-text-primary)]">
                {d.dayNum}
              </div>
              {hasSession && main ? (
                <div className="mt-auto space-y-0.5">
                  <div
                    className="truncate text-[length:var(--text-xs)] font-semibold"
                    style={{ color: color ?? 'var(--color-text-primary)' }}
                  >
                    {main.type ? (TYPE_LABEL[main.type] ?? main.type) : '·'}
                  </div>
                  {main.whoop_workout_id && (
                    <div className="text-[10px] text-[color:var(--color-text-muted)]">
                      whoop
                    </div>
                  )}
                  {d.sessions.length > 1 && (
                    <div className="text-[10px] text-[color:var(--color-text-muted)]">
                      +{d.sessions.length - 1}
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-auto text-[10px] text-[color:var(--color-text-muted)]">·</div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
