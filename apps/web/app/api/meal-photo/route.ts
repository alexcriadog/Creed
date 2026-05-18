/**
 * GET /api/meal-photo?path=<storage-path>
 * Devuelve el binario de una foto del bucket privado meal-photos.
 * Auth obligatoria. RLS sobre storage.objects asegura que solo el dueño puede
 * descargar (la primera carpeta del path debe ser su auth.uid()).
 */
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.searchParams.get('path');
  if (!path) {
    return NextResponse.json({ error: 'missing_path' }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase.storage.from('meal-photos').download(path);
  if (error || !data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const headers = new Headers();
  headers.set('content-type', data.type || 'image/jpeg');
  headers.set('cache-control', 'private, max-age=300');
  const buf = Buffer.from(await data.arrayBuffer());
  return new Response(buf, { headers });
}
