import { createClient } from '@supabase/supabase-js';
import { syncWhoop } from '@creed/whoop';
import type { McpContext } from './types';

/** Si el último sync es más viejo que esto, refrescamos antes de responder. */
const STALE_MS = 2 * 60 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 8_000;

export interface RefreshResult {
  /** true si los datos de Whoop pueden no estar al día. */
  stale: boolean;
  refreshed: boolean;
}

/**
 * Refresco incremental de Whoop bajo demanda (lo llama get_daily_briefing).
 * Lee whoop_connections con el cliente del usuario (RLS permite select) y,
 * si toca, lanza syncWhoop con service role acotado a ese userId: las tablas
 * whoop_* son solo lectura para el usuario.
 */
export async function maybeRefreshWhoop(ctx: McpContext, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<RefreshResult> {
  const { data: conn } = await ctx.supabase
    .from('whoop_connections')
    .select('status, last_synced_at')
    .eq('user_id', ctx.userId)
    .maybeSingle();
  if (!conn || conn.status !== 'connected') return { stale: true, refreshed: false };

  const lastSynced = conn.last_synced_at ? Date.parse(conn.last_synced_at) : 0;
  if (ctx.now.getTime() - lastSynced < STALE_MS) return { stale: false, refreshed: false };

  const whoopClientId = process.env.WHOOP_CLIENT_ID;
  const whoopClientSecret = process.env.WHOOP_CLIENT_SECRET;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!whoopClientId || !whoopClientSecret || !url || !secret) {
    console.error('[mcp.whoop-refresh] configuración incompleta (WHOOP_* / SUPABASE_SECRET_KEY)');
    return { stale: true, refreshed: false };
  }

  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const since = new Date(lastSynced || ctx.now.getTime() - 3 * 86_400_000).toISOString();

  try {
    await Promise.race([
      syncWhoop({ supabase: admin, userId: ctx.userId, whoopClientId, whoopClientSecret, since }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
    ]);
    return { stale: false, refreshed: true };
  } catch (e) {
    console.error('[mcp.whoop-refresh]', e instanceof Error ? e.message : e);
    return { stale: true, refreshed: false };
  }
}
