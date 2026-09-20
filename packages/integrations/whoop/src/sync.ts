import { WhoopClient } from './client';
import { encryptToken } from './encryption';
import { resolveSyncWindow } from './sync-window';
import {
  bodyMeasurementToRow,
  bodyMeasurementChanged,
  cycleToRow,
  mapWhoopSportToType,
  recoveryToRow,
  sleepToRow,
  workoutToRow,
} from './mappers';

export interface SyncOptions {
  /**
   * Cliente Supabase con service_role para bypass RLS.
   * Tipado como `any` para no acoplar a un cliente concreto en el package.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  userId: string;
  whoopClientId: string;
  whoopClientSecret: string;
  /** ISO 8601. Default: 90 días atrás (o todo el historial si `full`). */
  since?: string;
  /** ISO 8601. Default: now. */
  until?: string;
  /** Primera sync: trae todo el historial disponible en Whoop. */
  full?: boolean;
  /** Si false, salta paginación (solo primera página). */
  paginate?: boolean;
}

export interface SyncResult {
  cycles: number;
  recovery: number;
  sleep: number;
  workouts: number;
  /** 1 si se guardó una fila nueva de medidas corporales (cambió algo), 0 si no. */
  body: number;
  errors: string[];
}

/**
 * Sincroniza datos de Whoop para un usuario:
 * 1. Lee whoop_connections del usuario (decrypta tokens)
 * 2. Llama Whoop API v2 paginado para cycles, recovery, sleep, workouts
 * 3. Upserts idempotentes en las 4 tablas
 * 4. Actualiza last_synced_at
 *
 * Idempotente por (user_id, whoop_id).
 */
export async function syncWhoop(opts: SyncOptions): Promise<SyncResult> {
  const { since, until } = resolveSyncWindow(opts, new Date());
  const paginate = opts.paginate !== false;

  // Load connection
  const { data: conn, error: connErr } = await opts.supabase
    .from('whoop_connections')
    .select('access_token_encrypted, refresh_token_encrypted, expires_at')
    .eq('user_id', opts.userId)
    .single();

  if (connErr || !conn) {
    throw new Error(`Whoop connection not found for user ${opts.userId}`);
  }

  // Decrypt tokens
  const { decryptToken } = await import('./encryption');
  const accessToken = decryptToken(conn.access_token_encrypted as string);
  const refreshToken = decryptToken(conn.refresh_token_encrypted as string);

  const client = new WhoopClient({
    accessToken,
    refreshToken,
    expiresAt: new Date(conn.expires_at),
    clientId: opts.whoopClientId,
    clientSecret: opts.whoopClientSecret,
    onTokensRefreshed: async (tokens) => {
      await opts.supabase
        .from('whoop_connections')
        .update({
          access_token_encrypted: encryptToken(tokens.access_token),
          refresh_token_encrypted: encryptToken(tokens.refresh_token),
          expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        })
        .eq('user_id', opts.userId);
    },
  });

  const result: SyncResult = {
    cycles: 0,
    recovery: 0,
    sleep: 0,
    workouts: 0,
    body: 0,
    errors: [],
  };

  // --- Cycles
  try {
    const pages = paginate
      ? client.paginate((p) => client.listCycles(p), { start: since, end: until, limit: 25 })
      : (async function* () {
          const page = await client.listCycles({ start: since, end: until, limit: 25 });
          yield page.records;
        })();
    for await (const records of pages) {
      if (records.length === 0) continue;
      const rows = records.map((r) => ({ user_id: opts.userId, ...cycleToRow(r) }));
      const { error } = await opts.supabase
        .from('whoop_cycles')
        .upsert(rows, { onConflict: 'user_id,whoop_id' });
      if (error) {
        result.errors.push(`cycles: ${error.message}`);
      } else {
        result.cycles += rows.length;
      }
    }
  } catch (e) {
    result.errors.push(`cycles fetch: ${e instanceof Error ? e.message : String(e)}`);
  }

  // --- Recovery
  try {
    const pages = paginate
      ? client.paginate((p) => client.listRecovery(p), { start: since, end: until, limit: 25 })
      : (async function* () {
          const page = await client.listRecovery({ start: since, end: until, limit: 25 });
          yield page.records;
        })();
    for await (const records of pages) {
      if (records.length === 0) continue;
      const rows = records.map((r) => ({ user_id: opts.userId, ...recoveryToRow(r) }));
      const { error } = await opts.supabase
        .from('whoop_recovery')
        .upsert(rows, { onConflict: 'user_id,cycle_whoop_id' });
      if (error) {
        result.errors.push(`recovery: ${error.message}`);
      } else {
        result.recovery += rows.length;
      }
    }
  } catch (e) {
    result.errors.push(`recovery fetch: ${e instanceof Error ? e.message : String(e)}`);
  }

  // --- Sleep
  try {
    const pages = paginate
      ? client.paginate((p) => client.listSleep(p), { start: since, end: until, limit: 25 })
      : (async function* () {
          const page = await client.listSleep({ start: since, end: until, limit: 25 });
          yield page.records;
        })();
    for await (const records of pages) {
      if (records.length === 0) continue;
      const rows = records.map((r) => ({ user_id: opts.userId, ...sleepToRow(r) }));
      const { error } = await opts.supabase
        .from('whoop_sleep')
        .upsert(rows, { onConflict: 'user_id,whoop_id' });
      if (error) {
        result.errors.push(`sleep: ${error.message}`);
      } else {
        result.sleep += rows.length;
      }
    }
  } catch (e) {
    result.errors.push(`sleep fetch: ${e instanceof Error ? e.message : String(e)}`);
  }

  // --- Workouts
  try {
    const pages = paginate
      ? client.paginate((p) => client.listWorkouts(p), { start: since, end: until, limit: 25 })
      : (async function* () {
          const page = await client.listWorkouts({ start: since, end: until, limit: 25 });
          yield page.records;
        })();
    for await (const records of pages) {
      if (records.length === 0) continue;
      const rows = records.map((r) => ({ user_id: opts.userId, ...workoutToRow(r) }));
      const { error } = await opts.supabase
        .from('whoop_workouts')
        .upsert(rows, { onConflict: 'user_id,whoop_id' });
      if (error) {
        result.errors.push(`workouts: ${error.message}`);
      } else {
        result.workouts += rows.length;
      }
    }
  } catch (e) {
    result.errors.push(`workouts fetch: ${e instanceof Error ? e.message : String(e)}`);
  }

  // --- Body measurement (altura/peso/FC máx): una fila nueva solo si cambia
  try {
    const body = await client.getBodyMeasurement();
    const row = bodyMeasurementToRow(opts.userId, body);
    const { data: last } = await opts.supabase
      .from('whoop_body_measurements')
      .select('height_m, weight_kg, max_hr')
      .eq('user_id', opts.userId)
      .order('synced_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (bodyMeasurementChanged(last, row)) {
      const { error } = await opts.supabase.from('whoop_body_measurements').insert(row);
      if (error) throw new Error(error.message);
      result.body = 1;
    }
  } catch (e) {
    result.errors.push(`body fetch: ${e instanceof Error ? e.message : String(e)}`);
  }

  // --- Match workouts → training_sessions
  // Lógica: (1) si ya existe sesión con ese whoop_workout_id → skip.
  //         (2) Si el sport es deporte paralelo (padel, fútbol…) → INSERT
  //             standalone con status='done' y type=normalizedType. No matchea.
  //         (3) Si no, match exacto por fecha+tipo. Si falla, drift dentro de
  //             la semana: mueve la sesión prescrita más cercana al día real
  //             actualizando scheduled_for. Si no hay candidata → INSERT.
  try {
    const { data: workouts } = await opts.supabase
      .from('whoop_workouts')
      .select('whoop_id, start_at, end_at, sport')
      .eq('user_id', opts.userId)
      .gte('start_at', since);

    if (workouts && workouts.length > 0) {
      for (const w of workouts as Array<{
        whoop_id: string;
        start_at: string;
        end_at: string | null;
        sport: string | null;
      }>) {
        // 1. Skip si ya hay sesión con este whoop_workout_id.
        const { data: existing } = await opts.supabase
          .from('training_sessions')
          .select('id')
          .eq('user_id', opts.userId)
          .eq('whoop_workout_id', w.whoop_id)
          .maybeSingle();
        if (existing?.id) {
          continue;
        }

        const workoutDate = w.start_at.slice(0, 10);
        const map = mapWhoopSportToType(w.sport);

        // 2. Deporte paralelo → INSERT standalone, no toca plan.
        if (map.isParallelSport) {
          const { error: insErr } = await opts.supabase
            .from('training_sessions')
            .insert({
              user_id: opts.userId,
              whoop_workout_id: w.whoop_id,
              scheduled_for: workoutDate,
              type: map.normalizedType,
              status: 'done',
              done_at: w.end_at,
            });
          if (insErr) {
            result.errors.push(`session_import_parallel: ${insErr.message}`);
          }
          continue;
        }

        // 3a. Match exacto: misma fecha, tipo compatible.
        let candidatesQuery = opts.supabase
          .from('training_sessions')
          .select('id, scheduled_for, created_at')
          .eq('user_id', opts.userId)
          .eq('scheduled_for', workoutDate)
          .is('whoop_workout_id', null)
          .in('status', ['scheduled', 'partial'])
          .order('created_at', { ascending: true });
        if (map.matchableTypes.length > 0) {
          candidatesQuery = candidatesQuery.in('type', map.matchableTypes);
        }
        const { data: exactCands } = await candidatesQuery;

        let target: { id: string; scheduled_for: string } | null = null;
        if (exactCands && exactCands.length > 0) {
          target = exactCands[0] as { id: string; scheduled_for: string };
        } else if (map.matchableTypes.length > 0) {
          // 3b. Drift: misma semana (Mon..Sun), tipo compatible, scheduled.
          const wd = new Date(workoutDate + 'T00:00:00');
          const day = wd.getDay();
          const diffToMon = day === 0 ? 6 : day - 1;
          const mon = new Date(wd);
          mon.setDate(wd.getDate() - diffToMon);
          const sun = new Date(mon);
          sun.setDate(mon.getDate() + 6);
          const weekStart = mon.toISOString().slice(0, 10);
          const weekEnd = sun.toISOString().slice(0, 10);
          const { data: weekCands } = await opts.supabase
            .from('training_sessions')
            .select('id, scheduled_for')
            .eq('user_id', opts.userId)
            .gte('scheduled_for', weekStart)
            .lte('scheduled_for', weekEnd)
            .is('whoop_workout_id', null)
            .eq('status', 'scheduled')
            .in('type', map.matchableTypes);
          if (weekCands && weekCands.length > 0) {
            const list = weekCands as Array<{
              id: string;
              scheduled_for: string;
            }>;
            list.sort((a, b) => {
              const da = Math.abs(
                new Date(a.scheduled_for + 'T00:00:00').getTime() - wd.getTime(),
              );
              const db = Math.abs(
                new Date(b.scheduled_for + 'T00:00:00').getTime() - wd.getTime(),
              );
              return da - db;
            });
            target = list[0]!;
          }
        }

        if (target) {
          const { error: upErr } = await opts.supabase
            .from('training_sessions')
            .update({
              whoop_workout_id: w.whoop_id,
              status: 'done',
              done_at: w.end_at,
              scheduled_for: workoutDate,
            })
            .eq('id', target.id);
          if (upErr) {
            result.errors.push(`session_match: ${upErr.message}`);
          } else {
            console.info(
              '[whoop.match]',
              JSON.stringify({
                workout_id: w.whoop_id,
                matched_session_id: target.id,
                reason:
                  target.scheduled_for === workoutDate
                    ? 'matched_exact'
                    : 'matched_drift',
                rescheduled_from: target.scheduled_for,
              }),
            );
          }
        } else {
          // 3c. Sin candidata: INSERT standalone.
          const { error: insErr } = await opts.supabase
            .from('training_sessions')
            .insert({
              user_id: opts.userId,
              whoop_workout_id: w.whoop_id,
              scheduled_for: workoutDate,
              type: map.normalizedType,
              status: 'done',
              done_at: w.end_at,
            });
          if (insErr) {
            result.errors.push(`session_insert: ${insErr.message}`);
          } else {
            console.info(
              '[whoop.match]',
              JSON.stringify({
                workout_id: w.whoop_id,
                reason: 'inserted_standalone',
              }),
            );
          }
        }
      }
    }
  } catch (e) {
    result.errors.push(
      `session_import: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  // Update last_synced_at + status
  const newStatus = result.errors.length > 0 ? 'error' : 'connected';
  await opts.supabase
    .from('whoop_connections')
    .update({
      last_synced_at: new Date().toISOString(),
      last_error: result.errors.length > 0 ? result.errors.slice(0, 3).join(' | ').slice(0, 500) : null,
      status: newStatus,
    })
    .eq('user_id', opts.userId);

  return result;
}
