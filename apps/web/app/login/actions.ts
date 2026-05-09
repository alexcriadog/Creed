'use server';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function sendOtp(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    redirect('/login?error=invalid_email');
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
    redirect('/login?error=send_failed');
  }

  redirect(`/verify?email=${encodeURIComponent(email)}`);
}

export async function signInWithPassword(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');

  if (!email || !email.includes('@')) {
    redirect('/login?error=invalid_email');
  }
  if (!password) {
    redirect('/login?error=missing_password');
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error('[login.signInWithPassword]', { code: error.code, name: error.name });
    redirect('/login?error=invalid_credentials');
  }

  redirect('/');
}
