-- Catálogo de ejercicios: globales (is_custom=false, created_by=null) + custom por usuario.
create table public.exercises (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  name_en           text not null,
  name_es           text,                       -- null por ahora (traducción diferida); UI cae a name_en
  primary_muscle    text check (primary_muscle in (
                      'chest','back','lats','traps','shoulders','biceps','triceps',
                      'forearms','quads','hamstrings','glutes','calves','abs','neck',
                      'adductors','abductors')),
  secondary_muscles text[] not null default '{}',
  equipment         text check (equipment in (
                      'barbell','dumbbell','machine','cable','bodyweight','kettlebell',
                      'band','medicine_ball','exercise_ball','ez_bar','foam_roll','other')),
  movement_pattern  text check (movement_pattern in (
                      'push','pull','squat','hinge','lunge','carry','core','isolation')),
  mechanic          text check (mechanic in ('compound','isolation')),
  force             text check (force in ('push','pull','static')),
  level             text check (level in ('beginner','intermediate','expert')),
  category          text check (category in (
                      'strength','stretching','cardio','plyometrics','strongman',
                      'powerlifting','olympic_weightlifting')),
  instructions      text[] not null default '{}',  -- pasos en EN (fuente); pase de traducción añade instructions_es luego
  image_url         text,
  gif_url           text,
  is_custom         boolean not null default false,
  created_by        uuid references public.profiles(id) on delete cascade,
  created_at        timestamptz not null default now()
);

create index exercises_primary_muscle_idx on public.exercises (primary_muscle);
create index exercises_equipment_idx on public.exercises (equipment);
create index exercises_created_by_idx on public.exercises (created_by);

alter table public.exercises enable row level security;

-- Lectura: globales visibles para cualquier autenticado; custom solo del dueño.
create policy exercises_select on public.exercises
  for select to authenticated
  using (is_custom = false or created_by = auth.uid());

-- Crear: solo ejercicios custom propios (los globales se siembran con service role).
create policy exercises_insert on public.exercises
  for insert to authenticated
  with check (is_custom = true and created_by = auth.uid());

create policy exercises_update on public.exercises
  for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());

create policy exercises_delete on public.exercises
  for delete to authenticated
  using (created_by = auth.uid());
