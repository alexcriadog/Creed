'use server';

import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// ---- Límites (alineados con el plan) ----
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_DOC_BYTES = 8 * 1024 * 1024;
const MAX_PDF_PAGES = 30;
const MAX_PDF_TEXT_CHARS = 15_000;
const RATE_LIMIT_PER_DAY = 30;
const CONV_MAX_IMAGES = 20;
const CONV_MAX_DOCS = 5;
const CONV_MAX_TOTAL_BYTES = 50 * 1024 * 1024;

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const DOC_MIMES = new Set(['application/pdf', 'text/plain']);

export interface ActionResult<T = void> {
  ok: boolean;
  error?: string;
  data?: T;
}

export interface UploadedAttachment {
  attachmentId: string;
  kind: 'image' | 'document';
  pageCount: number | null;
  warnings: string[];
}

function slugifyName(name: string): string {
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  return base
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .slice(0, 40);
}

function extOf(mime: string, original: string): string {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'application/pdf') return 'pdf';
  if (mime === 'text/plain') return 'txt';
  const dot = original.lastIndexOf('.');
  if (dot > 0) {
    const e = original.slice(dot + 1).toLowerCase();
    if (/^[a-z0-9]{1,5}$/.test(e)) return e;
  }
  return 'bin';
}

export async function uploadChatAttachment(
  conversationId: string,
  file: File,
): Promise<ActionResult<UploadedAttachment>> {
  if (!z.string().uuid().safeParse(conversationId).success) {
    return { ok: false, error: 'invalid_conversation_id' };
  }
  if (file.size === 0) return { ok: false, error: 'empty_file' };

  const isImage = IMAGE_MIMES.has(file.type);
  const isDoc = DOC_MIMES.has(file.type);
  if (!isImage && !isDoc) return { ok: false, error: 'unsupported_mime' };

  if (isImage && file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: `image_too_large_max_${MAX_IMAGE_BYTES}` };
  }
  if (isDoc && file.size > MAX_DOC_BYTES) {
    return { ok: false, error: `doc_too_large_max_${MAX_DOC_BYTES}` };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  // La conversation debe pertenecer al usuario.
  const { data: conv, error: convErr } = await supabase
    .from('conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (convErr || !conv) {
    return { ok: false, error: 'conversation_not_found' };
  }

  // Rate-limit diario.
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const { count: dailyCount } = await supabase
    .from('message_attachments')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', since);
  if ((dailyCount ?? 0) >= RATE_LIMIT_PER_DAY) {
    return { ok: false, error: 'rate_limit_24h' };
  }

  // Caps de la conversation.
  const { data: convAttachments } = await supabase
    .from('message_attachments')
    .select('kind, size_bytes')
    .eq('conversation_id', conversationId);
  const list = convAttachments ?? [];
  const imageCount = list.filter((a) => a.kind === 'image').length;
  const docCount = list.filter((a) => a.kind === 'document').length;
  const totalBytes = list.reduce((s, a) => s + (a.size_bytes ?? 0), 0);
  if (isImage && imageCount >= CONV_MAX_IMAGES) {
    return { ok: false, error: 'conversation_image_cap' };
  }
  if (isDoc && docCount >= CONV_MAX_DOCS) {
    return { ok: false, error: 'conversation_doc_cap' };
  }
  if (totalBytes + file.size > CONV_MAX_TOTAL_BYTES) {
    return { ok: false, error: 'conversation_total_size_cap' };
  }

  // Path y subida.
  const ts = Date.now();
  const slug = slugifyName(file.name || 'file');
  const ext = extOf(file.type, file.name || '');
  const storagePath = `${user.id}/${conversationId}/${ts}-${slug}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error: uploadErr } = await supabase.storage
    .from('chat-attachments')
    .upload(storagePath, buf, { contentType: file.type, upsert: false });
  if (uploadErr) return { ok: false, error: uploadErr.message };

  // Parse de PDF / texto plano si aplica.
  const warnings: string[] = [];
  let extractedText: string | null = null;
  let pageCount: number | null = null;
  if (file.type === 'application/pdf') {
    try {
      const { extractText, getDocumentProxy } = await import('unpdf');
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      pageCount = pdf.numPages;
      if (pageCount > MAX_PDF_PAGES) {
        warnings.push(
          `Solo se han leído las primeras ${MAX_PDF_PAGES} páginas de ${pageCount}.`,
        );
      }
      const { text } = await extractText(pdf, { mergePages: true });
      let merged = Array.isArray(text) ? text.join('\n\n') : text;
      if (merged.length > MAX_PDF_TEXT_CHARS) {
        merged = merged.slice(0, MAX_PDF_TEXT_CHARS) + '\n[…texto recortado]';
        warnings.push(
          `Texto extraído recortado a ${MAX_PDF_TEXT_CHARS} caracteres.`,
        );
      }
      extractedText = merged.trim() || null;
      if (!extractedText) {
        warnings.push('No se ha podido extraer texto del PDF.');
      }
    } catch (err) {
      console.warn('[chat-attachments] pdf_parse_failed', err);
      warnings.push('No se ha podido leer el PDF.');
    }
  } else if (file.type === 'text/plain') {
    const text = buf.toString('utf8');
    extractedText =
      text.length > MAX_PDF_TEXT_CHARS
        ? text.slice(0, MAX_PDF_TEXT_CHARS) + '\n[…texto recortado]'
        : text;
  }

  // Insert metadata row.
  const { data: row, error: insertErr } = await supabase
    .from('message_attachments')
    .insert({
      user_id: user.id,
      conversation_id: conversationId,
      message_id: null,
      kind: isImage ? 'image' : 'document',
      storage_path: storagePath,
      mime_type: file.type,
      original_filename: file.name || null,
      size_bytes: file.size,
      page_count: pageCount,
      extracted_text: extractedText,
    })
    .select('id')
    .single();

  if (insertErr || !row) {
    await supabase.storage.from('chat-attachments').remove([storagePath]);
    return {
      ok: false,
      error: insertErr?.message ?? 'metadata_insert_failed',
    };
  }

  return {
    ok: true,
    data: {
      attachmentId: row.id,
      kind: isImage ? 'image' : 'document',
      pageCount,
      warnings,
    },
  };
}
