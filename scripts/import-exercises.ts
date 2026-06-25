import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

config({ path: '.env.local' });

const DATASET_URL =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
const IMG_BASE = 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL o SUPABASE_SECRET_KEY en .env.local');
}

type Raw = {
  id: string;
  name: string;
  force: string | null;
  level: string | null;
  mechanic: string | null;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string;
  images: string[];
};

const MUSCLE: Record<string, string> = {
  chest: 'chest', 'middle back': 'back', 'lower back': 'back', lats: 'lats',
  traps: 'traps', shoulders: 'shoulders', biceps: 'biceps', triceps: 'triceps',
  forearms: 'forearms', quadriceps: 'quads', hamstrings: 'hamstrings',
  glutes: 'glutes', calves: 'calves', abdominals: 'abs', neck: 'neck',
  adductors: 'adductors', abductors: 'abductors',
};
const EQUIP: Record<string, string> = {
  barbell: 'barbell', dumbbell: 'dumbbell', cable: 'cable', machine: 'machine',
  'body only': 'bodyweight', kettlebells: 'kettlebell', bands: 'band',
  'medicine ball': 'medicine_ball', 'exercise ball': 'exercise_ball',
  'e-z curl bar': 'ez_bar', 'foam roll': 'foam_roll', other: 'other',
};
const CATEGORY: Record<string, string> = {
  strength: 'strength', stretching: 'stretching', cardio: 'cardio',
  plyometrics: 'plyometrics', strongman: 'strongman', powerlifting: 'powerlifting',
  'olympic weightlifting': 'olympic_weightlifting',
};
const mapMuscle = (m: string): string | null => MUSCLE[m] ?? null;

async function main() {
  const raw: Raw[] = await fetch(DATASET_URL).then((r) => r.json());
  const rows = raw.map((e) => ({
    slug: e.id,
    name_en: e.name,
    name_es: null,
    primary_muscle: e.primaryMuscles[0] ? mapMuscle(e.primaryMuscles[0]) : null,
    secondary_muscles: e.secondaryMuscles.map(mapMuscle).filter((m): m is string => Boolean(m)),
    equipment: e.equipment ? EQUIP[e.equipment] ?? 'other' : null,
    movement_pattern: null,
    mechanic: e.mechanic ?? null,
    force: e.force ?? null,
    level: e.level ?? null,
    category: CATEGORY[e.category] ?? null,
    instructions: e.instructions,
    image_url: e.images[0] ? IMG_BASE + e.images[0] : null,
    gif_url: null,
    is_custom: false,
    created_by: null,
  }));

  const supabase = createClient(SUPABASE_URL!, SERVICE_KEY!, {
    auth: { persistSession: false },
    realtime: { transport: ws as unknown as typeof WebSocket },
  });

  const BATCH = 200;
  let done = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await supabase.from('exercises').upsert(chunk, { onConflict: 'slug' });
    if (error) throw error;
    done += chunk.length;
    console.log(`upserted ${done}/${rows.length}`);
  }
  const { count } = await supabase
    .from('exercises')
    .select('*', { count: 'exact', head: true });
  console.log(`total en BD: ${count}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
