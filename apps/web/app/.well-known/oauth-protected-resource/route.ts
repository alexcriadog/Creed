/**
 * OAuth 2.0 Protected Resource Metadata (RFC 9728) para el MCP de Creed.
 * Apunta al servidor OAuth 2.1 de Supabase Auth del proyecto.
 */
import { protectedResourceHandler, metadataCorsOptionsRequestHandler } from 'mcp-handler';

export const dynamic = 'force-dynamic';

const handler = protectedResourceHandler({
  authServerUrls: [`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1`],
  resourceUrl: process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/api/mcp` : undefined,
});
const cors = metadataCorsOptionsRequestHandler();

export { handler as GET, cors as OPTIONS };
