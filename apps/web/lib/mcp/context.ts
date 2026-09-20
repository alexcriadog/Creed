import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente Supabase que actúa como el usuario dueño del JWT: RLS aplica en
 * todas las tools sin necesidad de service role.
 */
export function createUserClient(token: string): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    },
  );
}
