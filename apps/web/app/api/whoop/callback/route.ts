import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { encryptToken, exchangeCode, getWhoopUserProfile, syncWhoop, whoopScopes } from '@creed/whoop';
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from '@/lib/supabase/server';

export const runtime = 'nodejs';

function redirectHome(error?: string, msg?: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? '';
  if (!error) return NextResponse.redirect(`${base}/?whoop_connected=1`);
  const params = new URLSearchParams({ whoop_error: error });
  if (msg) params.set('whoop_msg', msg.slice(0, 300));
  return NextResponse.redirect(`${base}/?${params.toString()}`);
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const errorParam = searchParams.get('error');

  if (errorParam) {
    return redirectHome(errorParam);
  }
  if (!code || !state) {
    return redirectHome('missing_params');
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get('whoop_oauth_state')?.value;
  const codeVerifier = cookieStore.get('whoop_oauth_pkce')?.value;

  if (!expectedState || expectedState !== state) {
    return redirectHome('state_mismatch');
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL!));
  }

  let tokens;
  try {
    tokens = await exchangeCode({
      clientId: process.env.WHOOP_CLIENT_ID!,
      clientSecret: process.env.WHOOP_CLIENT_SECRET!,
      code,
      redirectUri: process.env.WHOOP_REDIRECT_URI!,
      ...(codeVerifier !== undefined && { codeVerifier }),
    });
  } catch (e) {
    console.error('[whoop.callback] exchange', e instanceof Error ? e.message : e);
    return redirectHome('exchange_failed');
  }

  let whoopUserId: string;
  try {
    const profile = await getWhoopUserProfile(tokens.access_token);
    whoopUserId = profile.whoopUserId;
  } catch (e) {
    console.error('[whoop.callback] profile', e instanceof Error ? e.message : e);
    return redirectHome('profile_failed');
  }

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  const scopes = tokens.scope ? tokens.scope.split(/\s+/) : [...whoopScopes];

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    console.error('[whoop.callback] service_role_client', msg);
    return redirectHome('config_missing', msg);
  }

  let accessEnc: string;
  let refreshEnc: string;
  try {
    accessEnc = encryptToken(tokens.access_token);
    refreshEnc = encryptToken(tokens.refresh_token);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    console.error('[whoop.callback] encrypt', msg);
    return redirectHome('encrypt_failed', msg);
  }

  const { error: upsertError } = await admin.from('whoop_connections').upsert({
    user_id: user.id,
    whoop_user_id: whoopUserId,
    access_token_encrypted: accessEnc,
    refresh_token_encrypted: refreshEnc,
    expires_at: expiresAt,
    scopes,
    status: 'connected',
    last_synced_at: null,
    last_error: null,
  });

  if (upsertError) {
    console.error('[whoop.callback] upsert', upsertError.code, upsertError.message);
    return redirectHome('save_failed', upsertError.message);
  }

  // Audit (no bloqueante si falla)
  try {
    await admin.from('audit_log').insert({
      user_id: user.id,
      action: 'whoop_connect',
      metadata: { whoop_user_id: whoopUserId },
    });
  } catch (e) {
    console.error('[whoop.callback] audit', e instanceof Error ? e.message : e);
  }

  cookieStore.delete('whoop_oauth_state');
  cookieStore.delete('whoop_oauth_pkce');

  // Trigger initial backfill (90 días) en background — no bloqueamos el redirect.
  // Si falla, el usuario puede hacer "Sincronizar ahora" desde el home.
  syncWhoop({
    supabase: admin,
    userId: user.id,
    whoopClientId: process.env.WHOOP_CLIENT_ID!,
    whoopClientSecret: process.env.WHOOP_CLIENT_SECRET!,
  })
    .then(async (result) => {
      await admin.from('audit_log').insert({
        user_id: user.id,
        action: 'whoop_backfill_initial',
        metadata: result as unknown as Record<string, unknown>,
      });
    })
    .catch((e) => {
      console.error('[whoop.callback] initial backfill', e instanceof Error ? e.message : e);
    });

  return redirectHome();
}
