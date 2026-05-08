/**
 * Weekly close — POST /api/weekly-close
 *
 * Vercel Cron lo invoca lunes 06:00 UTC con Authorization: Bearer $CRON_SECRET.
 * Para cada user con onboarding completo:
 *  1. Recolecta datos últimos 14 días (recovery, weights, meals, trainings, moods).
 *  2. Computa veredicto via @creed/agents (determinista, sin LLM).
 *  3. Upsert en weekly_verdicts por (user_id, week_start = lunes pasado).
 */
import { NextResponse } from 'next/server';
import { computeVerdict, DEFAULT_GOALS } from '@creed/agents';
import type { VerdictInput } from '@creed/agents';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface UserVerdictResult {
  user_id: string;
  ok: boolean;
  status?: string;
  error?: string;
}

function lastMondayUTC(today: Date): string {
  const d = new Date(today);
  const day = d.getUTCDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff - 7);
  return d.toISOString().slice(0, 10);
}

function isoDate(d: string | Date): string {
  if (typeof d === 'string') {
    return d.slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

export async function POST(request: Request): Promise<NextResponse> {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: 'cron_not_configured' }, { status: 500 });
  }
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = createSupabaseServiceRoleClient();
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const weekStart = lastMondayUTC(today);
  const since14d = new Date(today.getTime() - 14 * 86_400_000).toISOString();
  const since7dDate = isoDate(new Date(today.getTime() - 7 * 86_400_000));
  const since14dDate = isoDate(new Date(today.getTime() - 14 * 86_400_000));

  const { data: profiles, error: profilesErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('onboarding_status', 'complete');

  if (profilesErr) {
    return NextResponse.json(
      { error: 'db_error', message: profilesErr.message },
      { status: 500 },
    );
  }

  const results: UserVerdictResult[] = [];

  for (const profile of profiles ?? []) {
    try {
      const [recoveries, weights, meals, trainings, moods] = await Promise.all([
        supabase
          .from('whoop_recovery')
          .select('date, score')
          .eq('user_id', profile.id)
          .gte('date', since14dDate),
        supabase
          .from('body_measurements')
          .select('measured_at, weight_kg')
          .eq('user_id', profile.id)
          .gte('measured_at', since14d)
          .order('measured_at', { ascending: true }),
        supabase
          .from('meals')
          .select('consumed_at')
          .eq('user_id', profile.id)
          .gte('consumed_at', since14d),
        supabase
          .from('training_sessions')
          .select('scheduled_for, status')
          .eq('user_id', profile.id)
          .gte('scheduled_for', since7dDate),
        supabase
          .from('mood_energy_log')
          .select('mood, energy')
          .eq('user_id', profile.id)
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
        moods: (moods.data ?? []).map((m) => ({
          mood: m.mood,
          energy: m.energy,
        })),
        goals: DEFAULT_GOALS,
      };

      const verdict = computeVerdict(input);

      const { error: upsertErr } = await supabase
        .from('weekly_verdicts')
        .upsert(
          {
            user_id: profile.id,
            week_start: weekStart,
            status: verdict.status,
            components: verdict.components,
            coach_message: verdict.text,
          },
          { onConflict: 'user_id,week_start' },
        );

      if (upsertErr) throw new Error(upsertErr.message);

      results.push({
        user_id: profile.id,
        ok: true,
        status: verdict.status,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      results.push({ user_id: profile.id, ok: false, error: message });
    }
  }

  return NextResponse.json({
    week_start: weekStart,
    ran: results.length,
    ok: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}
