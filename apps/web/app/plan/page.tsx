import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AppHeader } from '@/components/app-header';
import { BottomNav } from '@/components/bottom-nav';
import { WeekStrip } from '@/components/plan/week-strip';
import { DayDetail } from '@/components/plan/day-detail';
import { QuickAddRow } from '@/components/plan/quick-add-row';
import { EmptyPlanCTA } from '@/components/plan/empty-plan-cta';
import { fetchWeekData } from '@/lib/plan/week-data';
import { isoDate, parseIsoDate, weekStartFromParams } from '@/lib/plan/dates';

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; day?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const params = await searchParams;
  const monday = weekStartFromParams(params.week);
  const today = new Date();
  const todayIso = isoDate(today);

  let selectedDate: string;
  const reqDay = parseIsoDate(params.day);
  if (reqDay) {
    selectedDate = isoDate(reqDay);
  } else {
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    selectedDate =
      today >= monday && today <= sunday ? todayIso : isoDate(monday);
  }

  const week = await fetchWeekData(monday);
  if (!week) redirect('/login');

  const activeDays = new Set<string>();
  for (const s of week.sessions) activeDays.add(s.scheduled_for);
  for (const m of week.meals) activeDays.add(m.consumed_at.slice(0, 10));
  for (const x of week.measurements) activeDays.add(x.measured_at.slice(0, 10));
  for (const x of week.moods) activeDays.add(x.logged_at.slice(0, 10));
  for (const x of week.hydration) activeDays.add(x.logged_at.slice(0, 10));

  const sessionsForDay = week.sessions.filter(
    (s) => s.scheduled_for === selectedDate,
  );
  const sessionIdsForDay = new Set(sessionsForDay.map((s) => s.id));
  const setsForDay = week.sets.filter((s) => sessionIdsForDay.has(s.session_id));
  const mealsForDay = week.meals.filter(
    (m) => m.consumed_at.slice(0, 10) === selectedDate,
  );
  const measurementsForDay = week.measurements.filter(
    (x) => x.measured_at.slice(0, 10) === selectedDate,
  );
  const moodsForDay = week.moods.filter(
    (x) => x.logged_at.slice(0, 10) === selectedDate,
  );
  const hydrationForDay = week.hydration.filter(
    (x) => x.logged_at.slice(0, 10) === selectedDate,
  );

  return (
    <>
      <main className="mx-auto max-w-md px-4 pb-32 pt-6 sm:max-w-lg sm:px-6 sm:pt-10">
        <AppHeader />

        <h1 className="mb-4 text-verdict text-[color:var(--color-text-primary)]">
          Plan.
        </h1>

        {!week.hasActivePlan && week.sessions.length === 0 ? (
          <EmptyPlanCTA />
        ) : (
          <>
            <QuickAddRow selectedDate={selectedDate} />

            <WeekStrip
              monday={monday}
              selectedDate={selectedDate}
              todayIso={todayIso}
              activeDays={activeDays}
            />

            <DayDetail
              selectedDate={selectedDate}
              sessions={sessionsForDay}
              sets={setsForDay}
              meals={mealsForDay}
              measurements={measurementsForDay}
              moods={moodsForDay}
              hydration={hydrationForDay}
            />
          </>
        )}
      </main>
      <BottomNav />
    </>
  );
}
