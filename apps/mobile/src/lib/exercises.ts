import { supabase } from './supabase';

export type Exercise = {
  id: string;
  slug: string;
  name_en: string;
  name_es: string | null;
  primary_muscle: string | null;
  secondary_muscles: string[];
  equipment: string | null;
  mechanic: string | null;
  force: string | null;
  level: string | null;
  category: string | null;
  instructions: string[];
  image_url: string | null;
};

const COLUMNS =
  'id,slug,name_en,name_es,primary_muscle,secondary_muscles,equipment,mechanic,force,level,category,instructions,image_url';

export const displayName = (e: Pick<Exercise, 'name_es' | 'name_en'>): string =>
  e.name_es ?? e.name_en;

export async function listExercises(opts?: {
  search?: string;
  muscle?: string;
  equipment?: string;
}): Promise<Exercise[]> {
  let q = supabase.from('exercises').select(COLUMNS);
  if (opts?.search) q = q.ilike('name_en', `%${opts.search}%`);
  if (opts?.muscle) q = q.eq('primary_muscle', opts.muscle);
  if (opts?.equipment) q = q.eq('equipment', opts.equipment);
  const { data, error } = await q.limit(200).order('name_en', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Exercise[];
}

export async function getExercise(id: string): Promise<Exercise | null> {
  const { data, error } = await supabase.from('exercises').select(COLUMNS).eq('id', id).single();
  if (error) return null;
  return data as Exercise;
}
