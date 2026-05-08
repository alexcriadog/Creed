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
