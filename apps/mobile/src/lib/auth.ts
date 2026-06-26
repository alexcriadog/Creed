import { supabase } from './supabase';

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export async function sendOtp(email: string): Promise<{ error: string | null }> {
  const normalized = normalizeEmail(email);
  if (!normalized.includes('@')) return { error: 'invalid_email' };
  const { error } = await supabase.auth.signInWithOtp({
    email: normalized,
    options: { shouldCreateUser: true },
  });
  return { error: error ? 'send_failed' : null };
}

export type VerifyError = 'invalid_code' | 'expired';

export async function verifyOtp(
  email: string,
  code: string,
): Promise<{ error: VerifyError | null }> {
  const normalized = normalizeEmail(email);
  if (!/^\d{6}$/.test(code.trim())) return { error: 'invalid_code' };
  const { error } = await supabase.auth.verifyOtp({
    email: normalized,
    token: code.trim(),
    type: 'email',
  });
  if (!error) return { error: null };
  // Distinguir "caducado / ya usado" de "código incorrecto" para mejor UX.
  const expired =
    (error as { code?: string }).code === 'otp_expired' ||
    error.status === 403 ||
    /expired|invalid/i.test(error.message);
  return { error: expired ? 'expired' : 'invalid_code' };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}
