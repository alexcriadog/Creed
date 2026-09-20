// Variante con path (RFC 9728 §3.1): algunos clientes consultan
// /.well-known/oauth-protected-resource/api/mcp en vez de la raíz.
export const dynamic = 'force-dynamic';
export { GET, OPTIONS } from '../../route';
