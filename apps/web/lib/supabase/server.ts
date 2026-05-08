import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components no pueden setear cookies — el middleware refresca
          }
        },
      },
    },
  );
}

/**
 * Service role client — bypassea RLS. Solo usar en Route Handlers donde
 * sea estrictamente necesario (admin, account-deletion, etc.). NUNCA exponer al cliente.
 */
export function createSupabaseServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const secret = process.env.SUPABASE_SECRET_KEY!;
  if (!secret) {
    throw new Error('SUPABASE_SECRET_KEY is required for service-role client');
  }
  return createServerClient(url, secret, {
    cookies: {
      getAll() {
        return [];
      },
      setAll() {
        // no-op — service role no usa cookies
      },
    },
  });
}
