/**
 * Resolución de nombres de ejercicio (español/inglés libre) contra el catálogo.
 * Orden: alias → match exacto de name_en → ILIKE → ejercicio custom del usuario.
 */
import { EXERCISE_ALIASES } from './aliases';
import { McpError, type McpContext } from '../types';

export interface ExerciseHit {
  id: string;
  slug: string;
  name_en: string;
  primary_muscle: string | null;
  equipment: string | null;
  is_custom: boolean;
}

export interface ResolvedExercise {
  id: string;
  /** slug del catálogo, o 'custom' si se creó uno nuevo para el usuario. */
  matched: string;
  /** Otras opciones plausibles cuando la búsqueda no fue exacta. */
  alternatives?: string[];
}

const SELECT = 'id, slug, name_en, primary_muscle, equipment, is_custom';

export function stripAccents(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Términos a probar, en orden: nombre canónico del alias (si hay) y el texto normalizado. */
export function normalizeQuery(q: string): string[] {
  const base = stripAccents(q);
  const alias = EXERCISE_ALIASES[base];
  if (alias && stripAccents(alias) !== base) return [stripAccents(alias), base];
  return [base];
}

function isExact(term: string, hit: ExerciseHit): boolean {
  return stripAccents(hit.name_en) === term;
}

export async function searchExercises(ctx: McpContext, query: string, limit = 10): Promise<ExerciseHit[]> {
  const terms = normalizeQuery(query);
  const seen = new Map<string, ExerciseHit>();

  for (const term of terms) {
    const pattern = `%${term.replace(/[%_]/g, '').replace(/\s+/g, '%')}%`;
    const { data, error } = await ctx.supabase
      .from('exercises')
      .select(SELECT)
      .ilike('name_en', pattern)
      .limit(50);
    if (error) throw new McpError('db_error', error.message);
    for (const row of (data ?? []) as ExerciseHit[]) {
      if (!seen.has(row.id)) seen.set(row.id, row);
    }
  }

  // Ranking: exacto (con cualquiera de los términos) > nombre más corto (más genérico).
  return [...seen.values()]
    .sort((a, b) => {
      const ea = terms.some((t) => isExact(t, a)) ? 1 : 0;
      const eb = terms.some((t) => isExact(t, b)) ? 1 : 0;
      if (ea !== eb) return eb - ea;
      return a.name_en.length - b.name_en.length || a.name_en.localeCompare(b.name_en);
    })
    .slice(0, limit);
}

function slugify(name: string): string {
  return stripAccents(name)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function resolveExercise(
  ctx: McpContext,
  input: { name: string; exercise_id?: string },
): Promise<ResolvedExercise> {
  if (input.exercise_id) {
    const { data, error } = await ctx.supabase
      .from('exercises')
      .select('id, slug')
      .eq('id', input.exercise_id)
      .maybeSingle();
    if (error) throw new McpError('db_error', error.message);
    if (!data) throw new McpError('exercise_not_found', `No existe el ejercicio ${input.exercise_id}.`);
    return { id: data.id, matched: data.slug };
  }

  const hits = await searchExercises(ctx, input.name, 4);
  const first = hits[0];
  if (first) {
    const terms = normalizeQuery(input.name);
    const exact = terms.some((t) => isExact(t, first));
    const alternatives = exact ? undefined : hits.slice(1).map((h) => h.slug);
    return { id: first.id, matched: first.slug, ...(alternatives?.length ? { alternatives } : {}) };
  }

  // Sin match: ejercicio personalizado del usuario (slug único por usuario).
  const slug = `custom-${ctx.userId.slice(0, 8)}-${slugify(input.name)}`;
  const { data: existing, error: exErr } = await ctx.supabase
    .from('exercises')
    .select('id')
    .eq('slug', slug)
    .eq('created_by', ctx.userId)
    .maybeSingle();
  if (exErr) throw new McpError('db_error', exErr.message);
  if (existing) return { id: existing.id, matched: 'custom' };

  const name = input.name.trim();
  const { data: created, error } = await ctx.supabase
    .from('exercises')
    .insert({ slug, name_en: name, name_es: name, is_custom: true, created_by: ctx.userId })
    .select('id')
    .single();
  if (error) throw new McpError('db_error', error.message);
  return { id: created.id, matched: 'custom' };
}
