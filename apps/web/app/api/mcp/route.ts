/**
 * Servidor MCP de Creed — POST/GET /api/mcp (Streamable HTTP, stateless).
 * Auth: bearer = JWT de Supabase emitido por el flujo OAuth 2.1 (ver lib/mcp/auth.ts).
 * Clientes sin token reciben 401 + WWW-Authenticate con la URL del metadata de recurso.
 */
import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { registerTools, SERVER_INSTRUCTIONS } from '@/lib/mcp/register';
import { verifyToken } from '@/lib/mcp/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const handler = createMcpHandler(
  (server) => {
    registerTools(server);
  },
  {
    serverInfo: { name: 'creed', version: '1.0.0' },
    instructions: SERVER_INSTRUCTIONS,
    verboseLogs: process.env.NODE_ENV !== 'production',
  },
);

const authHandler = withMcpAuth(handler, verifyToken, {
  required: true,
  resourceMetadataPath: '/.well-known/oauth-protected-resource',
  // Origen público (Vercel/proxy) desde el que se construye resource_metadata; sin path.
  resourceUrl: process.env.NEXT_PUBLIC_APP_URL || undefined,
});

export { authHandler as GET, authHandler as POST };
