/**
 * Meal parser — POST /api/meal-parser
 *
 * Body: { mealId: uuid }
 * Lee meals.raw_text del usuario logueado (RLS), llama Groq Llama 3.3 70B,
 * actualiza la fila con macros + parsed json + parser_confidence.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseMeal } from '@creed/agents';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

const requestSchema = z.object({ mealId: z.string().uuid() });

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'parser_not_configured' }, { status: 503 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data: meal, error: readErr } = await supabase
    .from('meals')
    .select('id, raw_text, user_corrected, photo_path')
    .eq('id', parsed.data.mealId)
    .single();

  if (readErr || !meal) {
    return NextResponse.json({ error: 'meal_not_found' }, { status: 404 });
  }

  if (meal.user_corrected) {
    return NextResponse.json({ ok: true, skipped: 'user_corrected' });
  }

  // Si hay foto, la descargamos del bucket (privado, RLS por user) y la
  // convertimos a base64 para Groq vision. Si la descarga falla, fallback a
  // texto.
  let imageBase64: string | undefined;
  let imageMimeType: string | undefined;
  if (meal.photo_path) {
    const { data: blob, error: dlErr } = await supabase.storage
      .from('meal-photos')
      .download(meal.photo_path);
    if (dlErr) {
      console.warn('[meal-parser] photo_download_failed', dlErr.message);
    } else if (blob) {
      const buf = Buffer.from(await blob.arrayBuffer());
      imageBase64 = buf.toString('base64');
      imageMimeType = blob.type || 'image/jpeg';
    }
  }

  let result: Awaited<ReturnType<typeof parseMeal>>;
  try {
    result = await parseMeal({
      apiKey,
      rawText: meal.raw_text,
      ...(imageBase64 ? { imageBase64, imageMimeType } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    console.error('[meal-parser] groq failed', message);
    return NextResponse.json({ error: 'parser_failed', message }, { status: 502 });
  }

  const { error: updateErr } = await supabase
    .from('meals')
    .update({
      parsed: result.parsed,
      total_calories: result.total_calories,
      total_protein_g: result.total_protein_g,
      total_carbs_g: result.total_carbs_g,
      total_fat_g: result.total_fat_g,
      parser_confidence: result.parser_confidence,
      parser_version: result.parser_version,
    })
    .eq('id', meal.id);

  if (updateErr) {
    return NextResponse.json(
      { error: 'db_update_failed', message: updateErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    total_calories: result.total_calories,
    total_protein_g: result.total_protein_g,
    parser_confidence: result.parser_confidence,
  });
}
