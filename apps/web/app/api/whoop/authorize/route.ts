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

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL!));
  }

  const state = randomBytes(32).toString('hex');
  const codeVerifier = randomBytes(32).toString('base64url');
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

  const cookieStore = await cookies();
  cookieStore.set('whoop_oauth_state', state, COOKIE_OPTIONS);
  cookieStore.set('whoop_oauth_pkce', codeVerifier, COOKIE_OPTIONS);

  const url = buildAuthorizeUrl({
    clientId: process.env.WHOOP_CLIENT_ID!,
    redirectUri: process.env.WHOOP_REDIRECT_URI!,
    state,
    codeChallenge,
  });

  return NextResponse.redirect(url);
}
