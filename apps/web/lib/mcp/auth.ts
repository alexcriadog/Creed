import type { AuthInfo } from '@modelcontextprotocol/server';
import { createUserClient } from './context';

/**
 * Verifica el bearer que envía el cliente MCP (JWT emitido por Supabase Auth
 * tras el flujo OAuth 2.1) y lo convierte al AuthInfo que espera mcp-handler.
 * getClaims valida firma (JWKS si la clave es asimétrica; si no, vía /auth/v1/user).
 */
export async function verifyToken(_req: Request, bearer?: string): Promise<AuthInfo | undefined> {
  if (!bearer) return undefined;
  const supabase = createUserClient(bearer);
  const { data, error } = await supabase.auth.getClaims(bearer);
  if (error || !data?.claims?.sub) return undefined;

  const claims = data.claims as Record<string, unknown>;
  return {
    token: bearer,
    clientId: typeof claims.client_id === 'string' ? claims.client_id : 'unknown',
    scopes: [],
    expiresAt: typeof claims.exp === 'number' ? claims.exp : undefined,
    extra: { userId: String(claims.sub) },
  };
}
