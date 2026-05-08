import { NextResponse } from 'next/server';
import { decryptToken, revokeToken } from '@creed/whoop';
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const admin = createSupabaseServiceRoleClient();

  // Fetch encrypted refresh token to revoke (best effort)
  const { data: conn } = await admin
    .from('whoop_connections')
    .select('refresh_token_encrypted, whoop_user_id')
    .eq('user_id', user.id)
    .single();

  if (conn?.refresh_token_encrypted) {
    try {
      const refreshToken = decryptToken(Buffer.from(conn.refresh_token_encrypted));
      await revokeToken({
        clientId: process.env.WHOOP_CLIENT_ID!,
        clientSecret: process.env.WHOOP_CLIENT_SECRET!,
        token: refreshToken,
      });
    } catch (e) {
      // Non-blocking: continue even if revoke fails
      console.error('[whoop.disconnect] revoke', e instanceof Error ? e.message : e);
    }
  }

  // Delete the connection row (cascade does NOT remove whoop_* data — by design,
  // datos históricos del atleta se quedan).
  const { error } = await admin
    .from('whoop_connections')
    .delete()
    .eq('user_id', user.id);

  if (error) {
    console.error('[whoop.disconnect] delete', error.code);
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  }

  await admin.from('audit_log').insert({
    user_id: user.id,
    action: 'whoop_disconnect',
    metadata: { reason: 'user_initiated', whoop_user_id: conn?.whoop_user_id },
  });

  return NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_APP_URL!));
}
