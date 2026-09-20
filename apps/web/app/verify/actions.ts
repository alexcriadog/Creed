'use server';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { safeNext, withNext } from '@/lib/auth/safe-next';

export async function verifyOtp(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const code = String(formData.get('code') ?? '').trim();
  const next = safeNext(String(formData.get('next') ?? ''));

  if (!email) {
    redirect(withNext('/login?error=missing_email', next));
  }
  if (!/^\d{6}$/.test(code)) {
    redirect(withNext(`/verify?email=${encodeURIComponent(email)}&error=invalid_code`, next));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token: code,
    type: 'email',
  });

  if (error) {
    console.error('[verify.verifyOtp]', { code: error.code, name: error.name });
    redirect(withNext(`/verify?email=${encodeURIComponent(email)}&error=invalid_code`, next));
  }

  // Un destino explícito (p. ej. el consentimiento OAuth) tiene prioridad sobre el onboarding.
  if (next) redirect(next);

  // Decidir destino: si onboarding pendiente → /onboarding, si no → /
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/verify?email=${encodeURIComponent(email)}&error=unexpected`);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_status')
    .eq('id', user.id)
    .single();

  if (profile?.onboarding_status !== 'complete') {
    redirect('/onboarding');
  }
  redirect('/');
}
