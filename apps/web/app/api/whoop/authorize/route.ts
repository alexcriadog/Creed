import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomBytes, createHash } from 'node:crypto';
import { buildAuthorizeUrl } from '@creed/whoop';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 600, // 10 min
};

function homeRedirect(error: string, msg?: string): NextResponse {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const params = new URLSearchParams({ whoop_error: error });
  if (msg) params.set('whoop_msg', msg.slice(0, 300));
  return NextResponse.redirect(`${base}/?${params.toString()}`);
}

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      const base = process.env.NEXT_PUBLIC_APP_URL ?? '';
      return NextResponse.redirect(`${base}/login`);
    }

    const clientId = process.env.WHOOP_CLIENT_ID;
    const redirectUri = process.env.WHOOP_REDIRECT_URI;
    if (!clientId || !redirectUri) {
      return homeRedirect(
        'config_missing',
        'WHOOP_CLIENT_ID o WHOOP_REDIRECT_URI no configurados',
      );
    }

    const state = randomBytes(32).toString('hex');
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

    const cookieStore = await cookies();
    cookieStore.set('whoop_oauth_state', state, COOKIE_OPTIONS);
    cookieStore.set('whoop_oauth_pkce', codeVerifier, COOKIE_OPTIONS);

    const url = buildAuthorizeUrl({
      clientId,
      redirectUri,
      state,
      codeChallenge,
    });

    return NextResponse.redirect(url);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    console.error('[whoop.authorize] threw', msg);
    return homeRedirect('authorize_threw', msg);
  }
}
