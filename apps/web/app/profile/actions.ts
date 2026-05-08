'use server';
import { redirect } from 'next/navigation';
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from '@/lib/supabase/server';

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function deleteAccount() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Audit before deletion (user_id will be set null after cascade)
  const admin = createSupabaseServiceRoleClient();
  await admin.from('audit_log').insert({
    user_id: user.id,
    action: 'account_deletion_requested',
    metadata: { source: 'profile_page' },
  });

  // Delete auth.users — cascade vacía profiles, athlete_folder, audit_log.user_id (set null)
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error('[profile.deleteAccount]', { code: error.code });
    throw new Error('No se pudo borrar la cuenta');
  }

  // Sign out current session locally
  await supabase.auth.signOut();
  redirect('/login?deleted=1');
}
