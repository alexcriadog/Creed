import type { CallToolResult, McpServer, ServerContext, TextContent } from '@modelcontextprotocol/server';
import { ZodError } from 'zod';
import { tools } from './tools';
import { McpError, type McpContext } from './types';
import { createUserClient } from './context';

/** CallToolResult restringido a contenido de texto (JSON serializado). */
export interface ToolResult extends CallToolResult {
  content: TextContent[];
}

export const SERVER_INSTRUCTIONS =
  'Creed es la memoria de entrenamiento del usuario: Whoop (recovery, sueño, strain), entrenos de fuerza, ' +
  'comidas, medidas corporales y documentos de su nutricionista. Empieza cualquier conversación sobre entrenar ' +
  'o sobre su estado físico con get_daily_briefing. Cuando el usuario cuente qué ha entrenado o comido, ' +
  'guárdalo con log_workout / log_meal, confirmando antes cualquier dato ambiguo. Cuando acordéis un plan, ' +
  'guárdalo con set_program. Responde en español. Unidades: kg, minutos, kcal. Zona horaria: Europe/Madrid.';

export function toToolResult(value: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(value) }] };
}

function errorResult(error: string, code: string): ToolResult {
  return { isError: true, ...toToolResult({ error, code }) };
}

/** Ejecuta una tool traduciendo errores a un resultado que el modelo pueda leer. */
export async function runTool(fn: () => Promise<unknown>): Promise<ToolResult> {
  try {
    return toToolResult(await fn());
  } catch (e) {
    if (e instanceof McpError) return errorResult(e.message, e.code);
    if (e instanceof ZodError) {
      const detail = e.issues.map((i) => `${i.path.join('.') || '(raíz)'}: ${i.message}`).join('; ');
      return errorResult(`Entrada inválida — ${detail}`, 'invalid_input');
    }
    console.error('[mcp.tool]', e);
    return errorResult('Error interno al ejecutar la herramienta.', 'internal');
  }
}

function contextFrom(ctx: ServerContext): McpContext | null {
  const auth = ctx.http?.authInfo;
  const userId = auth?.extra?.userId;
  if (!auth?.token || typeof userId !== 'string') return null;
  return { supabase: createUserClient(auth.token), userId, now: new Date() };
}

export function registerTools(server: McpServer): void {
  for (const tool of tools) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.inputSchema },
      async (input: unknown, ctx: ServerContext) => {
        const mcpCtx = contextFrom(ctx);
        if (!mcpCtx) return errorResult('No autenticado.', 'unauthorized');
        return runTool(() => tool.handler(mcpCtx, tool.inputSchema.parse(input)));
      },
    );
  }
}
