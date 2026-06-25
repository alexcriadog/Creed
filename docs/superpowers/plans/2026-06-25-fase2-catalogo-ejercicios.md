# Fase 2 — Catálogo de ejercicios · Plan de implementación

> **Para agentes ejecutores:** SUB-SKILL REQUERIDA: usa `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans`. Pasos en checkbox (`- [ ]`).

**Goal:** Importar un catálogo grande de ejercicios (free-exercise-db, ~800) a Supabase y dar una pantalla de navegar/buscar en la app Expo, filtrando por músculo/equipo y con detalle (imagen + instrucciones).

**Architecture:** Tabla `exercises` (catálogo global + ejercicios custom por usuario) con RLS. Un script one-shot siembra los ~800 globales vía service role. La app móvil consulta con el cliente Supabase (anon key + RLS) y los renderiza con las primitivas de `@creed/ui-native`. Imágenes referenciadas desde el CDN del dataset (jsDelivr). Traducción a ES **diferida** (se guarda `name_en`; `name_es` queda null y la UI cae a EN).

**Tech Stack:** Supabase (Postgres + RLS) · migraciones SQL · `tsx` para el script de import · Expo/React Native + expo-router · NativeWind · jest-expo + RNTL v14.

## Global Constraints

- **pnpm** `>=9` · **Node** `>=20`. Local Supabase por Docker: `pnpm db:start` (arranca), `pnpm db:reset` (reaplica migraciones), `pnpm db:gen:types` (regenera tipos). Migración nueva: `pnpm db:migration:new <nombre>` (crea `supabase/migrations/YYYYMMDDHHMM_<nombre>.sql`).
- **Patrón RLS del repo:** políticas `for <action>` con `auth.uid()`; nombres `<tabla>_<action>`. Enums = **`text check (col in (...))`** (NO tipos enum nativos).
- **`exercises` RLS:** globales (`is_custom=false`) legibles por cualquier `authenticated`; custom (`is_custom=true`) solo del `created_by`. INSERT/UPDATE/DELETE solo sobre custom propios. Los globales se siembran con **service role** (`SUPABASE_SECRET_KEY`), que bypassa RLS.
- **Dataset:** `yuhonas/free-exercise-db`. JSON: `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json`. Imágenes vía CDN: `https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/<path>`. **Traducción diferida**: `name_es=null`, `instructions` en EN; UI muestra `name_es ?? name_en`.
- **Móvil:** cliente Supabase plano (`apps/mobile/src/lib/supabase.ts`) + `useState`/`useEffect` (NO hay React Query). RNTL v14 → `render()` es **async** (`await render(...)`). Rutas bajo `src/app/(app)/`. Primitivas: `Screen`, `Surface`, `AppText` (variant title/body/muted), `Button` (variant primary/ghost). Tokens: `bg-canvas`, `bg-surface`, `text-text-primary/secondary/muted`, `accent`, `border-border`.
- **Commits** `<type>: <desc>`, sin trailer de atribución.

## Prerrequisitos (entorno)

- **Docker corriendo** + `pnpm db:start` operativo (Tareas 1 y 2 tocan la BD local). Si Docker está caído, esas tareas se bloquean hasta arrancarlo.
- Root `.env.local` con `NEXT_PUBLIC_SUPABASE_URL` (o `SUPABASE_URL`) + `SUPABASE_SECRET_KEY` (service role del Supabase local) para el script de seed.

## Estructura de archivos

```
supabase/migrations/<ts>_exercises_catalog.sql   ← tabla exercises + RLS + índices
scripts/import-exercises.ts                       ← fetch dataset → mapear → upsert globales (service role)
package.json                                      ← + script db:seed:exercises ; + devDeps tsx, dotenv
apps/mobile/src/lib/exercises.ts                  ← tipo Exercise + listExercises/getExercise + displayName
apps/mobile/src/lib/exercises.test.ts             ← tests del query builder (supabase mockeado)
apps/mobile/src/app/(app)/exercises/index.tsx     ← lista + buscador + filtros músculo/equipo
apps/mobile/src/app/(app)/exercises/[id].tsx      ← detalle: imagen + instrucciones
apps/mobile/src/app/(app)/exercises/exercises-list.test.tsx ← test de render/filtrado
apps/mobile/src/app/(app)/index.tsx               ← (modificar) botón "Ver ejercicios"
```

---

### Task 1: Migración `exercises` (tabla + RLS + índices)

**Files:**
- Create: `supabase/migrations/<ts>_exercises_catalog.sql` (vía `pnpm db:migration:new exercises_catalog`)

**Interfaces:**
- Produces: tabla `public.exercises` con las columnas y RLS de abajo.

- [ ] **Step 1: Crear el archivo de migración**

Run:
```bash
pnpm db:migration:new exercises_catalog
```
Expected: crea `supabase/migrations/<timestamp>_exercises_catalog.sql` vacío.

- [ ] **Step 2: Escribir la migración**

Contenido completo del archivo creado:
```sql
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
```

- [ ] **Step 3: Aplicar y verificar**

Run:
```bash
pnpm db:start
pnpm db:reset
```
Expected: `db:reset` reaplica todas las migraciones sin error (incluida `exercises_catalog`). Si Docker no corre, `db:start` falla → reportar BLOCKED.

- [ ] **Step 4: Verificar tabla + RLS por SQL**

Run:
```bash
psql "$(.bin/supabase status --output env 2>/dev/null | grep DB_URL | cut -d= -f2- | tr -d '\"')" \
  -c "select count(*) from public.exercises;" \
  -c "select polname from pg_policies where tablename='exercises' order by polname;"
```
Expected: la tabla existe (count = 0) y aparecen las 4 políticas `exercises_select/insert/update/delete`.

- [ ] **Step 5: Regenerar tipos**

Run:
```bash
pnpm db:gen:types
```
Expected: `packages/db/src/database.types.ts` se actualiza e incluye la tabla `exercises`. (No es bloqueante para el móvil, que usa un tipo local; pero deja los tipos sincronizados.)

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations packages/db/src/database.types.ts
git commit -m "feat(db): tabla exercises (catálogo + RLS global/custom)"
```

---

### Task 2: Script de import + seed del catálogo

**Files:**
- Create: `scripts/import-exercises.ts`
- Modify: `package.json` (script `db:seed:exercises` + devDeps `tsx`, `dotenv`)

**Interfaces:**
- Consumes: tabla `exercises` (Task 1).
- Produces: ~800 filas globales sembradas en la BD local.

- [ ] **Step 1: Instalar runner + dotenv en la raíz**

Run:
```bash
pnpm add -w -D tsx dotenv @supabase/supabase-js
```
(`@supabase/supabase-js` en la raíz para el script; si ya está hoisteado, no añade peso real.)

- [ ] **Step 2: Escribir el script de import**

Crear `scripts/import-exercises.ts`:
```ts
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

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
```

- [ ] **Step 3: Añadir el script a package.json**

En el `package.json` raíz, dentro de `scripts`, añadir:
```json
"db:seed:exercises": "tsx scripts/import-exercises.ts"
```

- [ ] **Step 4: Ejecutar el seed contra la BD local**

Run (requiere `pnpm db:start` ya levantado de la Task 1):
```bash
pnpm db:seed:exercises
```
Expected: imprime `upserted …/…` por lotes y `total en BD: <~800>`. Si falla por env o BD caída, reportar BLOCKED con el mensaje.

- [ ] **Step 5: Verificar una fila de muestra**

Run:
```bash
psql "$(.bin/supabase status --output env 2>/dev/null | grep DB_URL | cut -d= -f2- | tr -d '\"')" \
  -c "select slug, name_en, primary_muscle, equipment, left(image_url,60) from public.exercises limit 3;"
```
Expected: 3 filas con `name_en` real, `primary_muscle`/`equipment` mapeados y `image_url` apuntando al CDN de jsDelivr.

- [ ] **Step 6: Commit**

```bash
git add scripts/import-exercises.ts package.json pnpm-lock.yaml
git commit -m "feat(db): script de import del catálogo free-exercise-db"
```

---

### Task 3: Capa de datos del móvil (tipo + queries + tests)

**Files:**
- Create: `apps/mobile/src/lib/exercises.ts`, `apps/mobile/src/lib/exercises.test.ts`

**Interfaces:**
- Consumes: `supabase` de `apps/mobile/src/lib/supabase.ts`.
- Produces:
  - `type Exercise` (campos del catálogo).
  - `displayName(e: Exercise): string` → `e.name_es ?? e.name_en`.
  - `listExercises(opts?: { search?: string; muscle?: string; equipment?: string }): Promise<Exercise[]>`
  - `getExercise(id: string): Promise<Exercise | null>`

- [ ] **Step 1: Escribir los tests (deben fallar)**

Crear `apps/mobile/src/lib/exercises.test.ts`:
```ts
const order = jest.fn().mockResolvedValue({ data: [], error: null });
const limit = jest.fn(() => ({ order }));
const builder: any = {};
const ilike = jest.fn(() => builder);
const eq = jest.fn(() => builder);
const select = jest.fn(() => builder);
Object.assign(builder, { select, ilike, eq, limit, order });
const from = jest.fn(() => builder);

jest.mock('./supabase', () => ({ supabase: { from: (...a: unknown[]) => from(...a) } }));

import { listExercises, displayName } from './exercises';

beforeEach(() => jest.clearAllMocks());

test('displayName cae a name_en cuando name_es es null', () => {
  expect(displayName({ name_es: null, name_en: 'Bench Press' } as any)).toBe('Bench Press');
  expect(displayName({ name_es: 'Press banca', name_en: 'Bench Press' } as any)).toBe('Press banca');
});

test('listExercises sin filtros consulta exercises sin ilike/eq', async () => {
  await listExercises();
  expect(from).toHaveBeenCalledWith('exercises');
  expect(ilike).not.toHaveBeenCalled();
  expect(eq).not.toHaveBeenCalled();
});

test('listExercises aplica search (ilike) y filtros (eq) cuando se pasan', async () => {
  await listExercises({ search: 'press', muscle: 'chest', equipment: 'barbell' });
  expect(ilike).toHaveBeenCalledWith('name_en', '%press%');
  expect(eq).toHaveBeenCalledWith('primary_muscle', 'chest');
  expect(eq).toHaveBeenCalledWith('equipment', 'barbell');
});
```

- [ ] **Step 2: Ejecutar (debe fallar)**

Run:
```bash
pnpm --filter @creed/mobile exec jest src/lib/exercises.test.ts
```
Expected: FAIL — `Cannot find module './exercises'`.

- [ ] **Step 3: Implementar**

Crear `apps/mobile/src/lib/exercises.ts`:
```ts
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
```

- [ ] **Step 4: Ejecutar (deben pasar)**

Run:
```bash
pnpm --filter @creed/mobile exec jest src/lib/exercises.test.ts
```
Expected: PASS, 3 tests. (El mock encadena `.limit()` → `.order()`; si tu implementación invierte el orden, ajusta el mock para que ambos existan en el builder.)

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/lib/exercises.ts apps/mobile/src/lib/exercises.test.ts
git commit -m "feat(mobile): capa de datos del catálogo de ejercicios"
```

---

### Task 4: UI de navegar/buscar + detalle + entrada desde Home

**Files:**
- Create: `apps/mobile/src/app/(app)/exercises/index.tsx`, `apps/mobile/src/app/(app)/exercises/[id].tsx`, `apps/mobile/src/app/(app)/exercises/exercises-list.test.tsx`
- Modify: `apps/mobile/src/app/(app)/index.tsx` (botón "Ver ejercicios")

**Interfaces:**
- Consumes: `listExercises`, `getExercise`, `displayName`, `type Exercise` (Task 3); `Screen`, `Surface`, `AppText`, `Button` (`@creed/ui-native`).

- [ ] **Step 1: Escribir el test de la lista (debe fallar)**

Crear `apps/mobile/src/app/(app)/exercises/exercises-list.test.tsx`:
```tsx
jest.mock('../../../lib/exercises', () => ({
  __esModule: true,
  displayName: (e: any) => e.name_es ?? e.name_en,
  listExercises: jest.fn().mockResolvedValue([
    { id: '1', name_en: 'Bench Press', name_es: null, primary_muscle: 'chest', equipment: 'barbell', image_url: null, instructions: [] },
    { id: '2', name_en: 'Squat', name_es: null, primary_muscle: 'quads', equipment: 'barbell', image_url: null, instructions: [] },
  ]),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));

import { render, screen, waitFor } from '@testing-library/react-native';
import ExercisesScreen from './index';

test('renderiza los ejercicios devueltos por listExercises', async () => {
  await render(<ExercisesScreen />);
  await waitFor(() => expect(screen.getByText('Bench Press')).toBeOnTheScreen());
  expect(screen.getByText('Squat')).toBeOnTheScreen();
});
```

- [ ] **Step 2: Ejecutar (debe fallar)**

Run:
```bash
pnpm --filter @creed/mobile exec jest "src/app/(app)/exercises/exercises-list.test.tsx"
```
Expected: FAIL — `Cannot find module './index'`.

- [ ] **Step 3: Implementar la pantalla de lista**

Crear `apps/mobile/src/app/(app)/exercises/index.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { FlatList, TextInput, View, Image, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, AppText } from '@creed/ui-native';
import { listExercises, displayName, type Exercise } from '../../../lib/exercises';

const MUSCLES = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'abs'];

export default function ExercisesScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);
  const [items, setItems] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listExercises({ search: search || undefined, muscle: muscle || undefined })
      .then((r) => active && setItems(r))
      .catch(() => active && setItems([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [search, muscle]);

  return (
    <Screen className="gap-4">
      <AppText variant="title">Ejercicios</AppText>
      <TextInput
        testID="search-input"
        value={search}
        onChangeText={setSearch}
        placeholder="Buscar ejercicio…"
        className="h-12 rounded-lg border border-border px-4 text-text-primary"
      />
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={MUSCLES}
        keyExtractor={(m) => m}
        className="max-h-10"
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setMuscle(muscle === item ? null : item)}
            className={`mr-2 h-9 rounded-pill px-4 justify-center ${muscle === item ? 'bg-accent' : 'bg-surface border border-border'}`}
          >
            <AppText className={muscle === item ? 'text-text-on-accent' : 'text-text-secondary'}>{item}</AppText>
          </Pressable>
        )}
      />
      {loading ? (
        <ActivityIndicator color="#4F62E0" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(e) => e.id}
          contentContainerClassName="gap-2 pb-8"
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/(app)/exercises/${item.id}`)}
              className="flex-row items-center gap-3 bg-surface border border-border rounded-lg p-3 active:opacity-80"
            >
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} className="w-12 h-12 rounded-md" />
              ) : (
                <View className="w-12 h-12 rounded-md bg-canvas-tint" />
              )}
              <View className="flex-1">
                <AppText>{displayName(item)}</AppText>
                <AppText variant="muted">{item.primary_muscle ?? ''}</AppText>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={<AppText variant="muted">Sin resultados.</AppText>}
        />
      )}
    </Screen>
  );
}
```

- [ ] **Step 4: Implementar la pantalla de detalle**

Crear `apps/mobile/src/app/(app)/exercises/[id].tsx`:
```tsx
import { useEffect, useState } from 'react';
import { ScrollView, Image, View, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen, AppText } from '@creed/ui-native';
import { getExercise, displayName, type Exercise } from '../../../lib/exercises';

export default function ExerciseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getExercise(String(id))
      .then((e) => active && setExercise(e))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <Screen className="justify-center">
        <ActivityIndicator color="#4F62E0" />
      </Screen>
    );
  }
  if (!exercise) {
    return (
      <Screen className="justify-center">
        <AppText variant="muted">Ejercicio no encontrado.</AppText>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerClassName="gap-4 pb-8">
        <AppText variant="title">{displayName(exercise)}</AppText>
        <AppText variant="muted">
          {[exercise.primary_muscle, exercise.equipment].filter(Boolean).join(' · ')}
        </AppText>
        {exercise.image_url ? (
          <Image source={{ uri: exercise.image_url }} className="w-full h-56 rounded-lg" resizeMode="cover" />
        ) : null}
        <View className="gap-2">
          {exercise.instructions.map((step, i) => (
            <AppText key={i}>
              {i + 1}. {step}
            </AppText>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}
```

- [ ] **Step 5: Añadir la entrada desde Home**

Editar `apps/mobile/src/app/(app)/index.tsx` — añadir un botón que navegue a la lista. El archivo actual tiene la pantalla "Hoy" con `Screen`/`AppText`/`Button` y `signOut`. Importar `useRouter` de `expo-router`, declarar `const router = useRouter();` dentro del componente, y añadir, antes del botón de cerrar sesión:
```tsx
<Button label="Ver ejercicios" onPress={() => router.push('/(app)/exercises')} />
```
(Mantén el resto del archivo igual; solo añade el import de `useRouter`, la constante `router` y el `Button`.)

- [ ] **Step 6: Ejecutar el test de la lista (debe pasar)**

Run:
```bash
pnpm --filter @creed/mobile exec jest "src/app/(app)/exercises/exercises-list.test.tsx"
```
Expected: PASS, 1 test.

- [ ] **Step 7: Typecheck + bundle (no bloqueante)**

Run:
```bash
pnpm --filter @creed/mobile exec tsc --noEmit
cd apps/mobile && npx expo export --platform ios && rm -rf dist && cd ../..
```
Expected: `tsc` exit 0; `expo export` bundea sin errores. (La verificación visual con datos reales — ver el catálogo en el simulador — queda como paso humano: requiere `pnpm db:start` + seed + `expo start`.)

- [ ] **Step 8: Commit**

```bash
git add "apps/mobile/src/app/(app)/exercises" "apps/mobile/src/app/(app)/index.tsx"
git commit -m "feat(mobile): pantalla de catálogo de ejercicios (lista + detalle)"
```

---

## Criterio de salida de la Fase 2

- [ ] La migración `exercises` aplica limpia (`pnpm db:reset`) con sus 4 políticas RLS.
- [ ] `pnpm db:seed:exercises` siembra ~800 ejercicios globales con `image_url` al CDN.
- [ ] `pnpm --filter @creed/mobile test` verde (incluye exercises.test + exercises-list.test).
- [ ] `pnpm --filter @creed/mobile exec tsc --noEmit` verde y `expo export` bundea.
- [ ] (Humano) En el simulador con la BD sembrada: navegas/buscas/filtras el catálogo y abres el detalle con imagen + instrucciones.

## Self-review (hecho al escribir el plan)

- **Cobertura del spec (Fase 2):** tabla `exercises` (T1) ✓ · import free-exercise-db + CDN (T2) ✓ · navegar/buscar por músculo/equipo + detalle (T4) ✓ · capa de datos (T3) ✓. Desviaciones del spec, todas por decisión del usuario y documentadas: traducción **diferida** (`name_es` null, `instructions` EN, UI cae a EN) y `movement_pattern` nullable (clasificación manual diferida); imágenes por **CDN** (sin Storage). `force`/`level` añadidos porque el dataset los da y son útiles.
- **Placeholders:** ninguno — todas las migraciones, el script y los componentes llevan código real.
- **Consistencia de tipos:** `Exercise`, `listExercises`, `getExercise`, `displayName` (T3) consumidos con esas firmas exactas en T4. Columnas del SELECT (`COLUMNS`) coinciden con la tabla de T1. Los enums del check (T1) coinciden con los mapeos del script (T2).
- **Riesgos conocidos:** Tareas 1-2 requieren Docker + Supabase local (si está caído → BLOCKED, el usuario arranca Docker). El mock de Supabase en T3 encadena `.limit().order()` — el plan lo nota. La verificación visual con datos reales es paso humano.
