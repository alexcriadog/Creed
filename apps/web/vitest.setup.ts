// Node 20 no trae WebSocket nativo y supabase-js lo exige al instanciar el cliente.
// En Vercel (Node 22) no hace falta; aquí lo polyfillamos solo para tests.
import ws from 'ws';

if (typeof globalThis.WebSocket === 'undefined') {
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = ws;
}
