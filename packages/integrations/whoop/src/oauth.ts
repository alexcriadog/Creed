import { z } from 'zod';

export const WHOOP_API_BASE = 'https://api.prod.whoop.com';

export const whoopScopes = [
  'read:profile',
  'read:cycles',
  'read:recovery',
  'read:sleep',
  'read:workout',
  'read:body_measurement',
  'offline',
] as const;

const tokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number(),
  scope: z.string(),
  token_type: z.string(),
});

export type WhoopTokens = z.infer<typeof tokenResponseSchema>;

export interface BuildAuthorizeUrlOptions {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge?: string;
}

export function buildAuthorizeUrl(opts: BuildAuthorizeUrlOptions): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    scope: whoopScopes.join(' '),
    state: opts.state,
  });
  if (opts.codeChallenge) {
    params.set('code_challenge', opts.codeChallenge);
    params.set('code_challenge_method', 'S256');
  }
  return `${WHOOP_API_BASE}/oauth/oauth2/auth?${params.toString()}`;
}

export interface ExchangeCodeOptions {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
  codeVerifier?: string;
}

export async function exchangeCode(
  opts: ExchangeCodeOptions,
): Promise<WhoopTokens> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: opts.code,
    redirect_uri: opts.redirectUri,
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
  });
  if (opts.codeVerifier) {
    body.set('code_verifier', opts.codeVerifier);
  }
  const res = await fetch(`${WHOOP_API_BASE}/oauth/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    throw new Error(`Whoop token exchange failed: ${res.status} ${res.statusText}`);
  }
  return tokenResponseSchema.parse(await res.json());
}

export interface RefreshTokensOptions {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

export async function refreshTokens(
  opts: RefreshTokensOptions,
): Promise<WhoopTokens> {
  // Whoop requires scope=offline on refresh, otherwise returns 400.
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: opts.refreshToken,
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    scope: 'offline',
  });
  const res = await fetch(`${WHOOP_API_BASE}/oauth/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `Whoop token refresh failed: ${res.status} ${res.statusText}${detail ? ` — ${detail.slice(0, 200)}` : ''}`,
    );
  }
  return tokenResponseSchema.parse(await res.json());
}

export interface RevokeTokenOptions {
  clientId: string;
  clientSecret: string;
  token: string;
}

export async function revokeToken(opts: RevokeTokenOptions): Promise<void> {
  const body = new URLSearchParams({
    token: opts.token,
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
  });
  // Best-effort: si falla no es crítico (ya borraremos la fila local).
  await fetch(`${WHOOP_API_BASE}/oauth/oauth2/revoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  }).catch(() => undefined);
}

const profileSchema = z.object({
  user_id: z.number(),
  email: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
});

export async function getWhoopUserProfile(
  accessToken: string,
): Promise<{ whoopUserId: string; email?: string }> {
  const res = await fetch(`${WHOOP_API_BASE}/developer/v2/user/profile/basic`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Whoop profile fetch failed: ${res.status} ${res.statusText}`);
  }
  const data = profileSchema.parse(await res.json());
  return {
    whoopUserId: String(data.user_id),
    ...(data.email !== undefined && { email: data.email }),
  };
}
