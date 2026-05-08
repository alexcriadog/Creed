/**
 * Vercel Cron — POST /api/whoop/cron-sync
 *
 * Llamado cada 6 horas por Vercel Cron (config en apps/web/vercel.json).
 * Auth via Authorization: Bearer <CRON_SECRET>.
 * Itera todas las conexiones Whoop con status='connected' y lanza sync incremental
 * por usuario. Errores por usuario no abortan el lote.
 */
import { NextResponse } from 'next/server';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { syncWhoop } from '@creed/whoop';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface UserSyncResult {
  user_id: string;
  ok: boolean;
  cycles?: number;
  recovery?: number;
  sleep?: number;
  workouts?: number;
  errors?: string[];
  error?: string;
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
  const { data: connections, error: connErr } = await supabase
    .from('whoop_connections')
    .select('user_id, last_synced_at')
    .eq('status', 'connected');

  if (connErr) {
    return NextResponse.json(
      { error: 'db_error', message: connErr.message },
      { status: 500 },
    );
  }

  const clientId = process.env.WHOOP_CLIENT_ID;
  const clientSecret = process.env.WHOOP_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'whoop_not_configured' },
      { status: 500 },
    );
  }

  const results: UserSyncResult[] = [];
  for (const conn of connections ?? []) {
    try {
      // Incremental: ventana desde el último sync menos 1h de solapamiento
      // (Whoop puede actualizar registros recientes). Si nunca hubo sync,
      // dejamos que syncWhoop use su default de 90 días.
      const since = conn.last_synced_at
        ? new Date(new Date(conn.last_synced_at).getTime() - 3_600_000).toISOString()
        : undefined;

      const result = await syncWhoop({
        userId: conn.user_id,
        supabase,
        whoopClientId: clientId,
        whoopClientSecret: clientSecret,
        ...(since ? { since } : {}),
      });
      results.push({
        user_id: conn.user_id,
        ok: result.errors.length === 0,
        cycles: result.cycles,
        recovery: result.recovery,
        sleep: result.sleep,
        workouts: result.workouts,
        ...(result.errors.length > 0 ? { errors: result.errors } : {}),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      results.push({ user_id: conn.user_id, ok: false, error: message });
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  return NextResponse.json({
    ran: results.length,
    ok: okCount,
    failed: results.length - okCount,
    results,
  });
}
