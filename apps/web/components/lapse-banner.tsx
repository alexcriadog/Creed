import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const LAPSE_THRESHOLD_DAYS = 4;

export async function LapseBanner() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [mealsResp, sessionsResp, messagesResp] = await Promise.all([
    supabase
      .from('meals')
      .select('consumed_at')
      .eq('user_id', user.id)
      .order('consumed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('training_sessions')
      .select('scheduled_for, done_at')
      .eq('user_id', user.id)
      .order('scheduled_for', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('messages')
      .select('created_at')
      .eq('user_id', user.id)
      .eq('role', 'user')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const candidates: number[] = [];
  if (mealsResp.data?.consumed_at) {
    candidates.push(new Date(mealsResp.data.consumed_at).getTime());
  }
  if (sessionsResp.data?.done_at) {
    candidates.push(new Date(sessionsResp.data.done_at).getTime());
  } else if (sessionsResp.data?.scheduled_for) {
    candidates.push(new Date(sessionsResp.data.scheduled_for + 'T00:00:00Z').getTime());
  }
  if (messagesResp.data?.created_at) {
    candidates.push(new Date(messagesResp.data.created_at).getTime());
  }

  if (candidates.length === 0) return null;

  const lastActivity = Math.max(...candidates);
  const daysSince = Math.floor((Date.now() - lastActivity) / 86_400_000);

  if (daysSince < LAPSE_THRESHOLD_DAYS) return null;

  return (
    <section
      role="alert"
      aria-live="polite"
      className="surface-glass mb-4 p-4"
      style={{ borderLeft: '3px solid var(--color-status-amber)' }}
    >
      <div className="mb-2 flex items-center gap-2">
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: 'var(--color-status-amber)' }}
          aria-hidden
        />
        <span
          className="text-label"
          style={{ color: 'var(--color-status-amber)' }}
        >
          PAUSA · {daysSince} DÍAS SIN ACTIVIDAD
        </span>
      </div>
      <p className="mb-3 text-[length:var(--text-sm)] leading-relaxed text-[color:var(--color-text-secondary)]">
        Sin juicio: pasa. Pídele al preparador o nutricionista que te ponga al día — lee
        tu contexto y te dice por dónde retomar sin dramas.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/chat?role=training"
          className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] px-3 py-1.5 text-[length:var(--text-xs)] font-medium text-[color:var(--color-text-primary)] transition hover:border-[color:var(--color-accent)]"
        >
          <span
            className="agent-chip agent-chip-coach"
            style={{ width: 22, height: 22, fontSize: 11 }}
          >
            C
          </span>
          Ponme al día — coach
        </Link>
        <Link
          href="/chat?role=nutrition"
          className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] px-3 py-1.5 text-[length:var(--text-xs)] font-medium text-[color:var(--color-text-primary)] transition hover:border-[color:var(--color-accent)]"
        >
          <span
            className="agent-chip agent-chip-nutrition"
            style={{ width: 22, height: 22, fontSize: 11 }}
          >
            N
          </span>
          Ponme al día — nutri
        </Link>
      </div>
    </section>
  );
}
