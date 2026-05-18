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

  const weekEndDate = (() => {
    const d = new Date(weekStart + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + 6);
    return d.toISOString().slice(0, 10);
  })();
  const weekStartIso = new Date(weekStart + 'T00:00:00Z').toISOString();
  const weekEndIsoEnd = new Date(
    weekEndDate + 'T23:59:59.999Z',
  ).toISOString();

  const STANDARD_TYPES = new Set([
    'push',
    'pull',
    'legs',
    'full',
    'cardio',
    'rest',
    'strength',
  ]);

  for (const profile of profiles ?? []) {
    try {
      const [recoveries, weights, meals, trainings, moods, weekTrainings] =
        await Promise.all([
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
            .select('consumed_at, total_protein_g')
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
          supabase
            .from('training_sessions')
            .select('id, scheduled_for, type, status, rpe, whoop_workout_id')
            .eq('user_id', profile.id)
            .gte('scheduled_for', weekStart)
            .lte('scheduled_for', weekEndDate),
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

      // ---- Bloques enriquecidos para el resumen visual de la semana ----
      const sessionsWeek = (weekTrainings.data ?? []) as Array<{
        id: string;
        type: string | null;
        status: string;
        rpe: number | null;
        whoop_workout_id: string | null;
      }>;
      const sessionIds = sessionsWeek.map((s) => s.id);
      const linkedWhoopIds = sessionsWeek
        .map((s) => s.whoop_workout_id)
        .filter((x): x is string => !!x);

      const [setsResp, allWhoopResp] = await Promise.all([
        sessionIds.length > 0
          ? supabase
              .from('training_sets')
              .select('weight_kg, reps')
              .in('session_id', sessionIds)
          : Promise.resolve({ data: [] }),
        supabase
          .from('whoop_workouts')
          .select('whoop_id, sport, strain')
          .eq('user_id', profile.id)
          .gte('start_at', weekStartIso)
          .lte('start_at', weekEndIsoEnd),
      ]);

      const sets = (setsResp.data ?? []) as Array<{
        weight_kg: number | null;
        reps: number | null;
      }>;
      const totalVolume = sets.reduce(
        (acc, s) =>
          acc + (s.weight_kg && s.reps ? Number(s.weight_kg) * s.reps : 0),
        0,
      );
      const rpes = sessionsWeek
        .map((s) => s.rpe)
        .filter((r): r is number => typeof r === 'number');
      const avgRpe =
        rpes.length > 0 ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;

      const planTypes = sessionsWeek.filter((s) =>
        STANDARD_TYPES.has(s.type ?? ''),
      );
      const sessionsDone = planTypes.filter((s) => s.status === 'done').length;
      const sessionsPrescribed = planTypes.length;
      const adherence =
        sessionsPrescribed > 0
          ? Math.round((sessionsDone / sessionsPrescribed) * 100)
          : null;

      const parallelSessions = sessionsWeek.filter(
        (s) => !STANDARD_TYPES.has(s.type ?? ''),
      );
      const allWhoop = (allWhoopResp.data ?? []) as Array<{
        whoop_id: string;
        sport: string | null;
        strain: number | null;
      }>;
      const whoopById = new Map<string, { sport: string | null; strain: number | null }>();
      for (const w of allWhoop) {
        whoopById.set(w.whoop_id, { sport: w.sport, strain: w.strain });
      }
      const parallelBySport = new Map<
        string,
        { sessions: number; strain_sum: number; strain_n: number }
      >();
      for (const p of parallelSessions) {
        const sport = p.type ?? 'otro';
        const cur =
          parallelBySport.get(sport) ?? { sessions: 0, strain_sum: 0, strain_n: 0 };
        cur.sessions++;
        const whoop = p.whoop_workout_id ? whoopById.get(p.whoop_workout_id) : null;
        if (whoop && typeof whoop.strain === 'number') {
          cur.strain_sum += whoop.strain;
          cur.strain_n++;
        }
        parallelBySport.set(sport, cur);
      }

      const allStrains = allWhoop
        .map((w) => w.strain)
        .filter((s): s is number => typeof s === 'number');
      const avgStrain =
        allStrains.length > 0
          ? Number((allStrains.reduce((a, b) => a + b, 0) / allStrains.length).toFixed(1))
          : null;
      const allRecoveryScores = (recoveries.data ?? [])
        .map((r) => r.score)
        .filter((s): s is number => typeof s === 'number');
      const avgRecovery =
        allRecoveryScores.length > 0
          ? Math.round(
              allRecoveryScores.reduce((a, b) => a + b, 0) /
                allRecoveryScores.length,
            )
          : null;

      const mealsWeek = (meals.data ?? []).filter((m) => {
        const d = new Date(m.consumed_at);
        return d >= new Date(weekStartIso) && d <= new Date(weekEndIsoEnd);
      });
      const daysWithProtein = new Set(
        mealsWeek
          .filter((m) => typeof m.total_protein_g === 'number')
          .map((m) => isoDate(m.consumed_at)),
      ).size;

      const weightsWeek = (weights.data ?? []).filter((w) => {
        const d = new Date(w.measured_at);
        return d >= new Date(weekStartIso) && d <= new Date(weekEndIsoEnd);
      });
      const firstWeight = weightsWeek[0]?.weight_kg
        ? Number(weightsWeek[0].weight_kg)
        : null;
      const lastWeight = weightsWeek[weightsWeek.length - 1]?.weight_kg
        ? Number(weightsWeek[weightsWeek.length - 1]!.weight_kg)
        : null;
      const weightDelta =
        firstWeight !== null && lastWeight !== null && firstWeight !== lastWeight
          ? Number((lastWeight - firstWeight).toFixed(2))
          : null;

      // Componentes finales: verdict base + bloques nuevos (solo si tienen
      // datos suficientes para evitar mostrar ceros).
      const enrichedComponents: Record<string, unknown> = {
        ...((verdict.components as unknown as Record<string, unknown>) ?? {}),
      };
      if (sessionsPrescribed >= 1) {
        enrichedComponents.training = {
          adherence_pct: adherence,
          sessions_done: sessionsDone,
          sessions_prescribed: sessionsPrescribed,
          total_volume_kg: Math.round(totalVolume),
          avg_rpe: avgRpe !== null ? Number(avgRpe.toFixed(1)) : null,
          whoop_workouts_linked: linkedWhoopIds.length,
        };
      }
      if (parallelBySport.size > 0) {
        enrichedComponents.parallel_sports = Array.from(
          parallelBySport.entries(),
        ).map(([sport, v]) => ({
          sport,
          sessions: v.sessions,
          avg_strain:
            v.strain_n > 0 ? Number((v.strain_sum / v.strain_n).toFixed(1)) : null,
        }));
      }
      if (avgStrain !== null || avgRecovery !== null) {
        enrichedComponents.whoop = { avg_strain: avgStrain, avg_recovery: avgRecovery };
      }
      if (mealsWeek.length > 0) {
        enrichedComponents.nutrition = {
          meals_logged: mealsWeek.length,
          days_with_macros: daysWithProtein,
        };
      }
      if (lastWeight !== null) {
        enrichedComponents.weight = {
          latest_kg: lastWeight,
          delta_kg: weightDelta,
        };
      }

      const { error: upsertErr } = await supabase
        .from('weekly_verdicts')
        .upsert(
          {
            user_id: profile.id,
            week_start: weekStart,
            status: verdict.status,
            components: enrichedComponents,
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
