import type { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Contexto que recibe cada tool: cliente Supabase con el JWT del usuario (RLS), su id y "ahora". */
export interface McpContext {
  supabase: SupabaseClient;
  userId: string;
  now: Date;
}

/** Error esperado de negocio; se devuelve al modelo como { error, code } con isError. */
export class McpError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'McpError';
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyObjectSchema = z.ZodObject<any>;

export interface ToolDef<S extends AnyObjectSchema = AnyObjectSchema, O = unknown> {
  name: string;
  /** En español: cuándo usarla, unidades y un ejemplo. */
  description: string;
  inputSchema: S;
  handler: (ctx: McpContext, input: z.infer<S>) => Promise<O>;
}

export function defineTool<S extends AnyObjectSchema, O>(def: ToolDef<S, O>): ToolDef<S, O> {
  return def;
}
