'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const localeSchema = z.enum(['es', 'en']);

export async function setLocale(formData: FormData): Promise<void> {
  const parsed = localeSchema.safeParse(formData.get('locale'));
  if (!parsed.success) return;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from('profiles')
    .update({ locale: parsed.data })
    .eq('id', user.id);
  if (error) {
    console.error('[setLocale]', error.message);
    return;
  }

  const cookieStore = await cookies();
  cookieStore.set('NEXT_LOCALE', parsed.data, {
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath('/profile');
  revalidatePath('/');
}
