import Link from 'next/link';
import { cookies } from 'next/headers';
import { CreedLogo } from '@/components/creed-logo';
import { setTheme } from '@/lib/actions/theme';

interface AppHeaderProps {
  hasUnread?: boolean;
}

export async function AppHeader({ hasUnread = false }: AppHeaderProps) {
  const now = new Date();
  const week = isoWeekNumber(now);
  const year = isoWeekYear(now);

  const cookieStore = await cookies();
  const currentTheme = cookieStore.get('theme')?.value ?? 'auto';
  const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';

  return (
    <header className="mb-6 flex items-center justify-between">
      <Link href="/" className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-gradient-to-br from-[oklch(18%_0.04_260)] to-[oklch(10%_0.05_260)] shadow-[inset_0_1px_0_oklch(100%_0_0/0.15),0_4px_12px_oklch(20%_0.05_260/0.3)]">
          <CreedLogo size={26} />
        </span>
        <span className="flex flex-col leading-tight">
          <span className="font-[family-name:var(--font-display)] text-[length:var(--text-base)] font-bold tracking-tight text-[color:var(--color-text-primary)]">
            creed
          </span>
          <span className="text-label">
            SEM {week} · {year}
          </span>
        </span>
      </Link>

      <div className="flex items-center gap-2">
        <form action={setTheme}>
          <input type="hidden" name="theme" value={nextTheme} />
          <button
            type="submit"
            aria-label={
              nextTheme === 'dark' ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro'
            }
            className="icon-chip"
          >
            {nextTheme === 'dark' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
              </svg>
            )}
          </button>
        </form>
        <button
          type="button"
          aria-label="Notificaciones"
          className="icon-chip relative"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          {hasUnread && <span className="badge-dot" aria-hidden />}
        </button>
      </div>
    </header>
  );
}

function isoWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

function isoWeekYear(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  return d.getUTCFullYear();
}
