'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const themeSchema = z.enum(['light', 'dark', 'auto']);

export async function setTheme(formData: FormData): Promise<void> {
  const parsed = themeSchema.safeParse(formData.get('theme'));
  if (!parsed.success) return;

  const cookieStore = await cookies();
  cookieStore.set('theme', parsed.data, {
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath('/', 'layout');
}
