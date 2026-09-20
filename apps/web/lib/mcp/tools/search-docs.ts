import { z } from 'zod';
import { defineTool, McpError } from '../types';
import { documentKind } from '../schemas';

export const searchDocsTool = defineTool({
  name: 'search_docs',
  description:
    'Busca en los documentos guardados (informes y pautas de la nutricionista, analíticas, notas médicas). ' +
    'Sin query devuelve los más recientes. Úsala cuando necesites saber qué dijo la nutricionista, qué pauta ' +
    'sigue el usuario o qué salió en una analítica; luego lee el texto completo con get_doc.',
  inputSchema: z.object({
    query: z.string().max(120).optional().describe('Palabras clave en español'),
    kind: documentKind.optional(),
    limit: z.number().int().min(1).max(10).default(5),
  }),
  handler: async (ctx, { query, kind, limit }) => {
    let q = ctx.supabase
      .from('documents')
      .select('id, kind, title, doc_date, text')
      .eq('user_id', ctx.userId)
      .order('doc_date', { ascending: false })
      .limit(limit);
    if (kind) q = q.eq('kind', kind);
    if (query) q = q.textSearch('search', query, { config: 'spanish', type: 'websearch' });
    const { data, error } = await q;
    if (error) throw new McpError('db_error', error.message);
    return {
      documents: (data ?? []).map((d) => ({
        id: d.id,
        kind: d.kind,
        title: d.title,
        doc_date: d.doc_date,
        excerpt: String(d.text).slice(0, 300),
      })),
    };
  },
});

export const getDocTool = defineTool({
  name: 'get_doc',
  description: 'Devuelve el texto completo de un documento guardado, por id (ver search_docs).',
  inputSchema: z.object({ id: z.string().uuid() }),
  handler: async (ctx, { id }) => {
    const { data, error } = await ctx.supabase
      .from('documents')
      .select('id, kind, title, doc_date, text')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new McpError('db_error', error.message);
    if (!data) throw new McpError('not_found', 'Documento no encontrado.');
    return data as { id: string; kind: string; title: string; doc_date: string; text: string };
  },
});
