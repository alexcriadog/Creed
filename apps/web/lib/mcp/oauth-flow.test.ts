/**
 * Flujo OAuth 2.1 completo contra Supabase local: registro dinámico de cliente,
 * /authorize con PKCE, aprobación del usuario, canje del code y verificación
 * del access token por verifyToken (lo que hará /api/mcp con claude.ai).
 */
import { describe, it, expect } from 'vitest';
import { createHash, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createTestUser } from './test-utils';
import { verifyToken } from './auth';

const AUTH = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1`;
const REDIRECT = 'http://localhost:9999/cb';
const b64url = (b: Buffer) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

describe('OAuth 2.1 con Supabase (registro dinámico + PKCE)', () => {
  it('emite un access token que verifyToken acepta con el userId correcto', async () => {
    const u = await createTestUser();
    try {
      // 1. Registro dinámico (lo hace claude.ai solo)
      const reg = await fetch(`${AUTH}/oauth/clients/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          client_name: 'test-mcp-client',
          redirect_uris: [REDIRECT],
          grant_types: ['authorization_code', 'refresh_token'],
          response_types: ['code'],
          token_endpoint_auth_method: 'none',
        }),
      });
      expect(reg.status).toBe(201);
      const client = (await reg.json()) as { client_id: string };

      // 2. /authorize con PKCE → redirige a la página de consentimiento con authorization_id
      const verifier = b64url(randomBytes(32));
      const challenge = b64url(createHash('sha256').update(verifier).digest());
      const authz = new URL(`${AUTH}/oauth/authorize`);
      authz.search = new URLSearchParams({
        client_id: client.client_id,
        redirect_uri: REDIRECT,
        response_type: 'code',
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state: 'abc',
      }).toString();
      const res = await fetch(authz, { redirect: 'manual' });
      expect([302, 303]).toContain(res.status);
      const location = new URL(res.headers.get('location')!);
      expect(location.pathname).toBe('/oauth/consent');
      const authorizationId = location.searchParams.get('authorization_id')!;
      expect(authorizationId).toBeTruthy();

      // 3. El usuario (con sesión) aprueba — lo que hace /api/oauth/decision
      const sessionClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      await sessionClient.auth.setSession({ access_token: u.token, refresh_token: u.refreshToken });
      // En cloud, getAuthorizationDetails "reclama" la autorización para el usuario y el
      // consent posterior falla con 404 si se salta; la página /oauth/consent lo hace al renderizar.
      const details = await sessionClient.auth.oauth.getAuthorizationDetails(authorizationId);
      expect(details.error).toBeNull();
      expect(details.data).toMatchObject({ client: { name: 'test-mcp-client' }, redirect_uri: REDIRECT });

      const approved = await sessionClient.auth.oauth.approveAuthorization(authorizationId);
      expect(approved.error).toBeNull();
      const redirectUrl = new URL(approved.data!.redirect_url);
      expect(redirectUrl.origin + redirectUrl.pathname).toBe(REDIRECT);
      expect(redirectUrl.searchParams.get('state')).toBe('abc');
      const code = redirectUrl.searchParams.get('code')!;
      expect(code).toBeTruthy();

      // 4. Canje del code
      const tok = await fetch(`${AUTH}/oauth/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: REDIRECT,
          client_id: client.client_id,
          code_verifier: verifier,
        }),
      });
      expect(tok.status).toBe(200);
      const tokens = (await tok.json()) as { access_token: string; refresh_token?: string; token_type: string };
      expect(tokens.token_type.toLowerCase()).toBe('bearer');

      // 5. Lo que hace /api/mcp con cada petición
      const info = await verifyToken(new Request('http://localhost/api/mcp'), tokens.access_token);
      expect(info?.extra?.userId).toBe(u.id);
      expect(info?.clientId).toBe(client.client_id);
      expect(info?.expiresAt).toBeGreaterThan(Date.now() / 1000);

      // 6. Un token manipulado no pasa
      expect(await verifyToken(new Request('http://localhost/api/mcp'), tokens.access_token.slice(0, -2) + 'xx')).toBeUndefined();
      expect(await verifyToken(new Request('http://localhost/api/mcp'), undefined)).toBeUndefined();
    } finally {
      await u.cleanup();
    }
  });
});
