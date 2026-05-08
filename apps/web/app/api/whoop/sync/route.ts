import { NextResponse } from 'next/server';
import { syncWhoop } from '@creed/whoop';
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const admin = createSupabaseServiceRoleClient();

  try {
    const result = await syncWhoop({
      supabase: admin,
      userId: user.id,
      whoopClientId: process.env.WHOOP_CLIENT_ID!,
      whoopClientSecret: process.env.WHOOP_CLIENT_SECRET!,
    });

    await admin.from('audit_log').insert({
      user_id: user.id,
      action: 'whoop_sync_manual',
      metadata: result as unknown as Record<string, unknown>,
    });

    return NextResponse.redirect(
      new URL(`/?whoop_synced=${encodeURIComponent(JSON.stringify(result))}`, process.env.NEXT_PUBLIC_APP_URL!),
    );
  } catch (e) {
    console.error('[whoop.sync]', e instanceof Error ? e.message : e);
    return NextResponse.redirect(
      new URL(`/?whoop_error=sync_failed`, process.env.NEXT_PUBLIC_APP_URL!),
    );
  }
}
