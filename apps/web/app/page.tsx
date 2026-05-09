import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AppHeader } from '@/components/app-header';
import { VerdictHero } from '@/components/verdict-hero';
import { MetricGrid } from '@/components/metric-grid';
import { ConversationPreview } from '@/components/conversation-preview';
import { BottomNav } from '@/components/bottom-nav';
import { LapseBanner } from '@/components/lapse-banner';
import { PendingProposals } from '@/components/pending-proposals';
import { QuickCoachActions } from '@/components/quick-coach-actions';
import { WeekPlan } from '@/components/week-plan';

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, onboarding_status, role')
    .eq('id', user.id)
    .single();

  if (profile?.onboarding_status !== 'complete') redirect('/onboarding');

  return (
    <>
      <main className="mx-auto max-w-md px-4 pb-32 pt-6 sm:max-w-lg sm:px-6 sm:pt-10">
        <AppHeader />

        <LapseBanner />

        <VerdictHero />

        <MetricGrid />

        <PendingProposals />

        <ConversationPreview />

        <details className="mb-24 mt-8 rounded-[var(--radius-md)] border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-raised)] p-4">
          <summary className="cursor-pointer text-label">MÁS · ACCIONES Y PLAN</summary>
          <div className="mt-4 space-y-6">
            <QuickCoachActions />
            <WeekPlan />
            {profile?.role === 'admin' && (
              <div className="border-t border-[color:var(--color-border-default)] pt-4">
                <Link
                  href="/admin"
                  className="text-[length:var(--text-sm)] font-medium text-[color:var(--color-accent)] underline-offset-2 hover:underline"
                >
                  Admin →
                </Link>
              </div>
            )}
          </div>
        </details>
      </main>
      <BottomNav />
    </>
  );
}
