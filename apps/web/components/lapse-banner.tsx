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
    <div
      role="alert"
      className="mb-6 flex items-start gap-3 rounded-[var(--radius-md)] border px-4 py-3 text-[length:var(--text-sm)]"
      style={{
        borderColor: 'var(--color-status-amber)',
        color: 'var(--color-status-amber)',
        background: 'color-mix(in oklch, var(--color-status-amber) 10%, transparent)',
      }}
    >
      <span
        className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full"
        style={{ background: 'var(--color-status-amber)' }}
        aria-hidden
      />
      <div className="flex-1">
        <strong className="font-semibold">Llevas {daysSince} días sin actividad.</strong>{' '}
        Sin juicio: pasa. Pídele al preparador o nutricionista que te ponga al día — lee tu
        contexto y te dice por dónde retomar sin dramas.
        <div className="mt-2 flex flex-wrap gap-2">
          <Link
            href="/chat?role=training"
            className="rounded-[var(--radius-md)] bg-[color:var(--color-status-amber)] px-3 py-1 text-[length:var(--text-xs)] font-medium text-[color:var(--color-text-on-accent)] transition hover:opacity-90"
          >
            Ponme al día — preparador →
          </Link>
          <Link
            href="/chat?role=nutrition"
            className="rounded-[var(--radius-md)] border border-[color:var(--color-status-amber)] px-3 py-1 text-[length:var(--text-xs)] transition hover:bg-[color:color-mix(in_oklch,var(--color-status-amber)_10%,transparent)]"
          >
            Ponme al día — nutri →
          </Link>
        </div>
      </div>
    </div>
  );
}
