/**
 * GET /api/chat-attachment/[id]
 * Sirve el binario de un adjunto del chat. RLS garantiza que solo el dueño
 * puede leerlo. Usado por <img> tags en thumbnails del chat.
 */
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  if (!/^[0-9a-fA-F-]{36}$/.test(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data: row, error: rowErr } = await supabase
    .from('message_attachments')
    .select('storage_path, mime_type, kind')
    .eq('id', id)
    .maybeSingle();
  if (rowErr || !row) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const { data: blob, error: dlErr } = await supabase.storage
    .from('chat-attachments')
    .download(row.storage_path);
  if (dlErr || !blob) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const buf = Buffer.from(await blob.arrayBuffer());
  const headers = new Headers();
  headers.set('content-type', row.mime_type || 'application/octet-stream');
  headers.set('cache-control', 'private, max-age=300');
  return new Response(buf, { headers });
}
