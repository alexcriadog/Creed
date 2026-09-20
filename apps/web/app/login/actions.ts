'use server';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { safeNext, withNext } from '@/lib/auth/safe-next';

export async function sendOtp(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const next = safeNext(String(formData.get('next') ?? ''));
  if (!email || !email.includes('@')) {
    redirect(withNext('/login?error=invalid_email', next));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
    },
  });

  if (error) {
    console.error('[login.sendOtp]', { code: error.code, name: error.name });
    redirect(withNext('/login?error=send_failed', next));
  }

  redirect(withNext(`/verify?email=${encodeURIComponent(email)}`, next));
}

export async function signInWithPassword(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const next = safeNext(String(formData.get('next') ?? ''));

  if (!email || !email.includes('@')) {
    redirect(withNext('/login?error=invalid_email', next));
  }
  if (!password) {
    redirect(withNext('/login?error=missing_password', next));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error('[login.signInWithPassword]', { code: error.code, name: error.name });
    redirect(withNext('/login?error=invalid_credentials', next));
  }

  redirect(next ?? '/');
}
