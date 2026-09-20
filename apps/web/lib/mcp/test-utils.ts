/**
 * Utilidades para tests de integración de lib/mcp contra Supabase local.
 * Cada test crea su propio usuario (admin API) y obtiene una sesión real,
 * de modo que las queries pasan por RLS igual que en producción.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta ${name} en apps/web/.env.local (tests de integración)`);
  return v;
}

export interface TestUser {
  id: string;
  email: string;
  token: string;
  refreshToken: string;
  /** Cliente anon + JWT del usuario: RLS real. */
  supabase: SupabaseClient;
  cleanup: () => Promise<void>;
}

const noPersist = { auth: { persistSession: false, autoRefreshToken: false } } as const;

/** Service role: bypassea RLS. Solo para sembrar datos que RLS no permite escribir (whoop_*). */
export function adminClient(): SupabaseClient {
  return createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SECRET_KEY'), noPersist);
}

export function userClient(token: string): SupabaseClient {
  return createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('NEXT_PUBLIC_SUPABASE_ANON_KEY'), {
    ...noPersist,
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

export async function createTestUser(): Promise<TestUser> {
  const admin = adminClient();
  const email = `mcp-test-${randomUUID()}@example.com`;
  const password = `pw-${randomUUID()}`;

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !created.user) throw new Error(`admin.createUser: ${error?.message ?? 'sin usuario'}`);
  const userId = created.user.id;

  const anon = createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('NEXT_PUBLIC_SUPABASE_ANON_KEY'), noPersist);
  const { data: signed, error: signErr } = await anon.auth.signInWithPassword({ email, password });
  if (signErr || !signed.session) throw new Error(`signInWithPassword: ${signErr?.message ?? 'sin sesión'}`);

  return {
    id: userId,
    email,
    token: signed.session.access_token,
    refreshToken: signed.session.refresh_token,
    supabase: userClient(signed.session.access_token),
    cleanup: async () => {
      const { error: delErr } = await admin.auth.admin.deleteUser(userId);
      if (delErr) console.error('[test-utils.cleanup]', delErr.message);
    },
  };
}
