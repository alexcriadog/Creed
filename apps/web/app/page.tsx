import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AppHeader } from '@/components/app-header';
import { VerdictHero } from '@/components/verdict-hero';
import { MetricGrid } from '@/components/metric-grid';
import { BottomNav } from '@/components/bottom-nav';
import { LapseBanner } from '@/components/lapse-banner';
import { PendingProposalsBanner } from '@/components/pending-proposals-banner';
import { listPendingProposals } from '@/lib/actions/proposals';
import { LogMealButton } from '@/components/log-meal-sheet';
import { LogWeightButton } from '@/components/log-weight-sheet';
import { QuickHydration } from '@/components/quick-hydration';
import { QuickMood } from '@/components/quick-mood';

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: profile }, { data: folder }, pendingProposals] = await Promise.all([
    supabase
      .from('profiles')
      .select('display_name, onboarding_status, role')
      .eq('id', user.id)
      .single(),
    supabase
      .from('athlete_folder')
      .select('nutrition')
      .eq('user_id', user.id)
      .maybeSingle(),
    listPendingProposals(10),
  ]);

  if (profile?.onboarding_status !== 'complete') redirect('/onboarding');

  const nutritionTargets =
    (folder?.nutrition as { targets?: { daily_calories?: number } } | null)
      ?.targets;
  const hasNutritionTargets =
    !!nutritionTargets && typeof nutritionTargets.daily_calories === 'number';
  const nutriPrefill = encodeURIComponent(
    'Quiero que me hagas la dieta. Empieza con la entrevista y propónmelo al final.',
  );
  const nutriHref = `/ia?role=nutrition&mode=onboarding&prefill=${nutriPrefill}`;

  return (
    <>
      <main className="mx-auto max-w-md px-4 pb-32 pt-6 sm:max-w-lg sm:px-6 sm:pt-10">
        <AppHeader />

        <div className="mb-4 flex items-center justify-between gap-3">
          <h1 className="text-verdict text-[color:var(--color-text-primary)]">
            Hoy.
          </h1>
          <PendingProposalsBanner proposals={pendingProposals} />
        </div>

        <div
          role="toolbar"
          aria-label="Registrar"
          className="mb-4 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <LogMealButton />
          <LogWeightButton />
          <QuickHydration />
          <QuickMood initialMood={null} initialEnergy={null} />
        </div>

        {!hasNutritionTargets && (
          <Link
            href={nutriHref}
            className="tap-feedback surface-glass mb-4 flex items-center gap-3 px-4 py-3"
          >
            <span aria-hidden className="text-[length:var(--text-xl)]">🥗</span>
            <div className="flex-1">
              <div className="font-[family-name:var(--font-display)] text-[length:var(--text-sm)] font-semibold text-[color:var(--color-text-primary)]">
                Conoce a tu nutricionista
              </div>
              <div className="text-[length:var(--text-xs)] text-[color:var(--color-text-muted)]">
                Habla con ella para fijar tus targets de macros e hidratación.
              </div>
            </div>
            <span className="text-[color:var(--color-text-muted)]" aria-hidden>
              ›
            </span>
          </Link>
        )}

        <LapseBanner />

        <VerdictHero />

        <MetricGrid />

        {profile?.role === 'admin' && (
          <div className="mt-6">
            <Link
              href="/admin"
              className="text-[length:var(--text-sm)] font-medium text-[color:var(--color-accent)] underline-offset-2 hover:underline"
            >
              Admin →
            </Link>
          </div>
        )}
      </main>
      <BottomNav />
    </>
  );
}
