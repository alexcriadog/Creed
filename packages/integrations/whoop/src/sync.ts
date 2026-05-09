import { WhoopClient } from './client';
import { encryptToken } from './encryption';
import { cycleToRow, recoveryToRow, sleepToRow, workoutToRow } from './mappers';

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
  /** ISO 8601. Default: 90 días atrás. */
  since?: string;
  /** ISO 8601. Default: now. */
  until?: string;
  /** Si false, salta paginación (solo primera página). */
  paginate?: boolean;
}

export interface SyncResult {
  cycles: number;
  recovery: number;
  sleep: number;
  workouts: number;
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
  const since =
    opts.since ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const until = opts.until ?? new Date().toISOString();
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

  // --- Auto-import workouts como training_sessions
  // ignoreDuplicates: true → no sobreescribe notas/status que el usuario haya editado.
  try {
    const { data: workouts } = await opts.supabase
      .from('whoop_workouts')
      .select('whoop_id, start_at, end_at, sport')
      .eq('user_id', opts.userId)
      .gte('start_at', since);

    if (workouts && workouts.length > 0) {
      const sessionRows = workouts.map(
        (w: {
          whoop_id: string;
          start_at: string;
          end_at: string | null;
          sport: string | null;
        }) => ({
          user_id: opts.userId,
          whoop_workout_id: w.whoop_id,
          scheduled_for: w.start_at.slice(0, 10),
          type: w.sport ?? 'whoop',
          status: 'done',
          done_at: w.end_at,
        }),
      );
      const { error: tsErr } = await opts.supabase
        .from('training_sessions')
        .upsert(sessionRows, {
          onConflict: 'user_id,whoop_workout_id',
          ignoreDuplicates: true,
        });
      if (tsErr) {
        result.errors.push(`session_import: ${tsErr.message}`);
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
