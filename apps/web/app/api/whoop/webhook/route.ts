/**
 * Whoop webhook — POST /api/whoop/webhook
 *
 * Whoop envía POST con cabecera X-WHOOP-Signature (HMAC-SHA256 base64 del body
 * usando WHOOP_WEBHOOK_SECRET, valor compartido al registrar la app).
 *
 * Eventos v2: workout.updated, sleep.updated, recovery.updated, *.deleted.
 * En MVP disparamos sync incremental (idempotente). Por evento concreto:
 * mejora futura.
 */
import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { syncWhoop } from '@creed/whoop';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface WebhookPayload {
  id?: string;
  user_id?: number;
  type?: string;
  trace_id?: string;
}

function verifySignature(body: string, signature: string, secret: string): boolean {
  const computed = createHmac('sha256', secret).update(body).digest('base64');
  const a = Buffer.from(computed);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env.WHOOP_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'webhook_not_configured' }, { status: 503 });
  }

  const signature = request.headers.get('x-whoop-signature');
  if (!signature) {
    return NextResponse.json({ error: 'missing_signature' }, { status: 401 });
  }

  const body = await request.text();
  if (!verifySignature(body, signature, secret)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(body) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const whoopUserId = payload.user_id;
  if (typeof whoopUserId !== 'number') {
    return NextResponse.json({ error: 'missing_user_id' }, { status: 400 });
  }

  const clientId = process.env.WHOOP_CLIENT_ID;
  const clientSecret = process.env.WHOOP_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'whoop_not_configured' }, { status: 503 });
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data: conn, error: connErr } = await supabase
    .from('whoop_connections')
    .select('user_id, last_synced_at')
    .eq('whoop_user_id', whoopUserId)
    .maybeSingle();

  if (connErr) {
    return NextResponse.json(
      { error: 'db_error', message: connErr.message },
      { status: 500 },
    );
  }
  if (!conn) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    // Sync corto: ventana de 24h hacia atrás (basta para captar el evento + algo
    // de margen). syncWhoop hace upsert idempotente por (user_id, whoop_id).
    const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
    const result = await syncWhoop({
      userId: conn.user_id,
      supabase,
      whoopClientId: clientId,
      whoopClientSecret: clientSecret,
      since,
    });
    return NextResponse.json({
      ok: result.errors.length === 0,
      event: payload.type,
      cycles: result.cycles,
      recovery: result.recovery,
      sleep: result.sleep,
      workouts: result.workouts,
      ...(result.errors.length > 0 ? { errors: result.errors } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
