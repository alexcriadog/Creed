import { NextResponse } from 'next/server';
import { syncWhoop } from '@creed/whoop';
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

function homeRedirect(error?: string, msg?: string, payload?: string): NextResponse {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? '';
  if (payload) {
    return NextResponse.redirect(`${base}/?whoop_synced=${encodeURIComponent(payload)}`);
  }
  if (!error) return NextResponse.redirect(`${base}/`);
  const params = new URLSearchParams({ whoop_error: error });
  if (msg) params.set('whoop_msg', msg.slice(0, 300));
  return NextResponse.redirect(`${base}/?${params.toString()}`);
}

export async function GET(): Promise<NextResponse> {
  return homeRedirect();
}

export async function POST(): Promise<NextResponse> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return homeRedirect('unauthorized');

    let admin;
    try {
      admin = createSupabaseServiceRoleClient();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown';
      console.error('[whoop.sync] service_role_client', msg);
      return homeRedirect('config_missing', msg);
    }

    const clientId = process.env.WHOOP_CLIENT_ID;
    const clientSecret = process.env.WHOOP_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return homeRedirect('config_missing', 'WHOOP_CLIENT_ID/SECRET no configurados');
    }

    const result = await syncWhoop({
      supabase: admin,
      userId: user.id,
      whoopClientId: clientId,
      whoopClientSecret: clientSecret,
    });

    try {
      await admin.from('audit_log').insert({
        user_id: user.id,
        action: 'whoop_sync_manual',
        metadata: result as unknown as Record<string, unknown>,
      });
    } catch (e) {
      console.error('[whoop.sync] audit', e instanceof Error ? e.message : e);
    }

    console.info('[whoop.sync] result', JSON.stringify(result));
    return homeRedirect(undefined, undefined, JSON.stringify(result));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[whoop.sync] threw', msg);
    return homeRedirect('sync_threw', msg);
  }
}
