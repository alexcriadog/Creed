'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const localeSchema = z.enum(['es', 'en']);

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export async function setLocale(formData: FormData): Promise<ActionResult> {
  const parsed = localeSchema.safeParse(formData.get('locale'));
  if (!parsed.success) return { ok: false, error: 'invalid_locale' };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  const { error } = await supabase
    .from('profiles')
    .update({ locale: parsed.data })
    .eq('id', user.id);
  if (error) return { ok: false, error: error.message };

  const cookieStore = await cookies();
  cookieStore.set('NEXT_LOCALE', parsed.data, {
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath('/profile');
  revalidatePath('/');
  return { ok: true };
}
