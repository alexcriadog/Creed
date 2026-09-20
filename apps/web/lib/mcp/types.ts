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

export interface ToolDef<S extends AnyObjectSchema = AnyObjectSchema> {
  name: string;
  /** En español: cuándo usarla, unidades y un ejemplo. */
  description: string;
  inputSchema: S;
  handler: (ctx: McpContext, input: z.infer<S>) => Promise<unknown>;
}

export function defineTool<S extends AnyObjectSchema>(def: ToolDef<S>): ToolDef<S> {
  return def;
}
