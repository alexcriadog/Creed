import { z } from 'zod';
import { defineTool, McpError } from '../types';
import { isoDay, documentKind } from '../schemas';

export const saveDocumentTool = defineTool({
  name: 'save_document',
  description:
    'Guarda el texto completo de un documento relevante: informe o pauta de la nutricionista, analítica, notas ' +
    'del médico o fisio. Úsala cuando el usuario comparta un PDF, foto o texto de ese tipo: transcribe el ' +
    'contenido íntegro (tablas incluidas, en texto plano) y guárdalo con una fecha y un título claros. Los valores ' +
    'numéricos (peso, % grasa, masa muscular) guárdalos ADEMÁS con log_measurement. Después se recupera con ' +
    'search_docs / get_doc.',
  inputSchema: z.object({
    kind: documentKind,
    title: z.string().min(2).max(120),
    doc_date: isoDay,
    text: z.string().min(1).max(50_000),
  }),
  handler: async (ctx, input) => {
    const { data, error } = await ctx.supabase
      .from('documents')
      .insert({ user_id: ctx.userId, ...input })
      .select('id')
      .single();
    if (error) throw new McpError('db_error', error.message);
    return { document_id: data.id, kind: input.kind, title: input.title, doc_date: input.doc_date, chars: input.text.length };
  },
});
