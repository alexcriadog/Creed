import { NextResponse } from 'next/server';
import { decryptToken, revokeToken } from '@creed/whoop';
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from '@/lib/supabase/server';

export const runtime = 'nodejs';

function homeRedirect(error?: string, msg?: string): NextResponse {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? '';
  if (!error) return NextResponse.redirect(`${base}/?whoop_disconnected=1`);
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
      console.error('[whoop.disconnect] service_role_client', msg);
      return homeRedirect('config_missing', msg);
    }

    const { data: conn } = await admin
      .from('whoop_connections')
      .select('refresh_token_encrypted, whoop_user_id')
      .eq('user_id', user.id)
      .single();

    if (conn?.refresh_token_encrypted) {
      try {
        const refreshToken = decryptToken(conn.refresh_token_encrypted as string);
        await revokeToken({
          clientId: process.env.WHOOP_CLIENT_ID ?? '',
          clientSecret: process.env.WHOOP_CLIENT_SECRET ?? '',
          token: refreshToken,
        });
      } catch (e) {
        console.error('[whoop.disconnect] revoke', e instanceof Error ? e.message : e);
      }
    }

    const { error } = await admin
      .from('whoop_connections')
      .delete()
      .eq('user_id', user.id);

    if (error) {
      console.error('[whoop.disconnect] delete', error.code, error.message);
      return homeRedirect('delete_failed', error.message);
    }

    try {
      await admin.from('audit_log').insert({
        user_id: user.id,
        action: 'whoop_disconnect',
        metadata: { reason: 'user_initiated', whoop_user_id: conn?.whoop_user_id },
      });
    } catch (e) {
      console.error('[whoop.disconnect] audit', e instanceof Error ? e.message : e);
    }

    return homeRedirect();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    console.error('[whoop.disconnect] threw', msg);
    return homeRedirect('disconnect_threw', msg);
  }
}
