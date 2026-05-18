'use client';

import Link from 'next/link';
import { isoDate } from '@/lib/plan/dates';

const DAY_NAMES = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

interface WeekStripProps {
  monday: Date;
  selectedDate: string;
  todayIso: string;
  activeDays: Set<string>;
}

export function WeekStrip({ monday, selectedDate, todayIso, activeDays }: WeekStripProps) {
  const days: { date: string; dayNum: number; name: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push({
      date: isoDate(d),
      dayNum: d.getDate(),
      name: DAY_NAMES[i]!,
    });
  }

  const prevMonday = new Date(monday);
  prevMonday.setDate(monday.getDate() - 7);
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);

  const prevHref = `/plan?week=${isoDate(prevMonday)}&day=${isoDate(prevMonday)}`;
  const nextHref = `/plan?week=${isoDate(nextMonday)}&day=${isoDate(nextMonday)}`;

  const monthLabel = monday.toLocaleDateString('es-ES', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="surface-glass mb-4 px-4 py-4">
      <div className="mb-3 flex items-center justify-between">
        <Link
          href={prevHref}
          aria-label="Semana anterior"
          className="tap-feedback rounded-[var(--radius-md)] px-2 py-1 text-[length:var(--text-lg)] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-primary)]"
        >
          ‹
        </Link>
        <div className="text-label capitalize">{monthLabel}</div>
        <Link
          href={nextHref}
          aria-label="Semana siguiente"
          className="tap-feedback rounded-[var(--radius-md)] px-2 py-1 text-[length:var(--text-lg)] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-primary)]"
        >
          ›
        </Link>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          const isSelected = d.date === selectedDate;
          const isToday = d.date === todayIso;
          const hasActivity = activeDays.has(d.date);
          return (
            <Link
              key={d.date}
              href={`/plan?week=${isoDate(monday)}&day=${d.date}`}
              aria-current={isSelected ? 'date' : undefined}
              className="tap-feedback flex flex-col items-center gap-1 rounded-[var(--radius-md)] py-1"
            >
              <span
                className={
                  'text-[10px] font-medium tracking-[0.15em] ' +
                  (isSelected
                    ? 'text-[color:var(--color-text-primary)]'
                    : 'text-[color:var(--color-text-muted)]')
                }
              >
                {DAY_NAMES[i]}
              </span>
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full font-mono text-[length:var(--text-base)] font-semibold tabular-nums transition"
                style={
                  isSelected
                    ? {
                        background:
                          'linear-gradient(135deg, oklch(58% 0.21 260), oklch(50% 0.22 260))',
                        color: 'var(--color-text-on-accent)',
                        boxShadow:
                          'inset 0 1px 0 oklch(100% 0 0 / 0.3), 0 2px 6px oklch(20% 0.05 260 / 0.18)',
                      }
                    : isToday
                      ? {
                          color: 'var(--color-accent)',
                          border: '1px solid var(--color-accent)',
                        }
                      : { color: 'var(--color-text-primary)' }
                }
              >
                {d.dayNum}
              </span>
              <span
                className="h-1 w-1 rounded-full"
                style={{
                  background: hasActivity
                    ? isSelected
                      ? 'var(--color-text-on-accent)'
                      : 'var(--color-accent)'
                    : 'transparent',
                }}
                aria-hidden
              />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

