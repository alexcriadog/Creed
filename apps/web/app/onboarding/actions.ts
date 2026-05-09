'use server';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function saveOnboarding(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const display_name = String(formData.get('display_name') ?? '').trim();
  const sex = String(formData.get('sex') ?? '');
  const date_of_birth = String(formData.get('date_of_birth') ?? '');
  const height_cm = Number(formData.get('height_cm'));
  const primary_objective = String(formData.get('primary_objective') ?? '');
  const baseline_weight_kg = Number(formData.get('baseline_weight_kg'));
  const target_weight_kg = formData.get('target_weight_kg')
    ? Number(formData.get('target_weight_kg'))
    : null;
  const target_date = (formData.get('target_date') as string) || null;

  // Update profiles
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      display_name,
      sex,
      date_of_birth,
      height_cm,
    })
    .eq('id', user.id);

  if (profileError) {
    console.error('[onboarding.saveOnboarding] profile', { code: profileError.code });
    throw new Error('No se pudo guardar el perfil');
  }

  // Update athlete_folder (sin tocar restrictions/equipment/schedule en MVP fase 2)
  const { error: folderError } = await supabase
    .from('athlete_folder')
    .update({
      primary_objective,
      baseline_weight_kg,
      target_weight_kg,
      target_date,
      initialized_at: new Date().toISOString(),
    })
    .eq('user_id', user.id);

  if (folderError) {
    console.error('[onboarding.saveOnboarding] folder', { code: folderError.code });
    throw new Error('No se pudo guardar la carpeta del atleta');
  }

  redirect('/onboarding/nutrition');
}
