/**
 * POST /api/oauth/decision — aprueba o deniega una autorización OAuth 2.1
 * pendiente (formulario de /oauth/consent). Requiere sesión (cookie).
 */
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<NextResponse> {
  const form = await request.formData();
  const decision = String(form.get('decision') ?? '');
  const authorizationId = String(form.get('authorization_id') ?? '');
  if (!authorizationId || (decision !== 'approve' && decision !== 'deny')) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const result =
    decision === 'approve'
      ? await supabase.auth.oauth.approveAuthorization(authorizationId)
      : await supabase.auth.oauth.denyAuthorization(authorizationId);

  if (result.error || !result.data?.redirect_url) {
    console.error('[oauth.decision]', { decision, code: result.error?.code, name: result.error?.name });
    return NextResponse.json({ error: 'authorization_failed', message: result.error?.message }, { status: 400 });
  }
  return NextResponse.redirect(result.data.redirect_url, { status: 303 });
}
