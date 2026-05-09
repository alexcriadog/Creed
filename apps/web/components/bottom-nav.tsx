'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  label: string;
  href: string;
  icon: 'home' | 'plan' | 'data' | 'team';
}

const ITEMS: NavItem[] = [
  { label: 'Hoy', href: '/', icon: 'home' },
  { label: 'Plan', href: '/chat', icon: 'plan' },
  { label: 'Datos', href: '/profile', icon: 'data' },
  { label: 'Equipo', href: '/profile?tab=equipo', icon: 'team' },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed bottom-4 left-1/2 z-40 w-[min(420px,calc(100vw-2rem))] -translate-x-1/2"
    >
      <div className="bottom-nav-pill flex items-center justify-around gap-1 px-3 py-2">
        {ITEMS.map((item) => {
          const targetPath = item.href.split('?')[0]!;
          const isActive =
            targetPath === '/' ? pathname === '/' : pathname.startsWith(targetPath);
          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className="group flex flex-col items-center gap-1 rounded-[var(--radius-md)] px-3 py-1.5 transition"
            >
              <span
                className={
                  'flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] transition ' +
                  (isActive
                    ? 'text-[color:var(--color-text-on-accent)] shadow-[inset_0_1px_0_oklch(100%_0_0/0.3)]'
                    : 'text-[color:var(--color-text-muted)]')
                }
                style={
                  isActive
                    ? {
                        background:
                          'linear-gradient(135deg, oklch(58% 0.21 260), oklch(50% 0.22 260))',
                      }
                    : undefined
                }
              >
                <NavIcon name={item.icon} />
              </span>
              <span
                className={
                  'text-[10px] font-medium transition ' +
                  (isActive
                    ? 'text-[color:var(--color-text-primary)]'
                    : 'text-[color:var(--color-text-muted)]')
                }
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function NavIcon({ name }: { name: NavItem['icon'] }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (name) {
    case 'home':
      return (
        <svg {...common}>
          <path d="M3 11.5 12 4l9 7.5" />
          <path d="M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9" />
        </svg>
      );
    case 'plan':
      return (
        <svg {...common}>
          <rect x="3.5" y="4.5" width="17" height="16" rx="2" />
          <path d="M8 3v3M16 3v3M3.5 9.5h17" />
          <path d="M8 14h3M8 17h6" />
        </svg>
      );
    case 'data':
      return (
        <svg {...common}>
          <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
        </svg>
      );
    case 'team':
      return (
        <svg {...common}>
          <circle cx="9" cy="9" r="3" />
          <path d="M3 19c0-3.3 2.7-6 6-6s6 2.7 6 6" />
          <circle cx="17" cy="10" r="2.5" />
          <path d="M14.5 19c0-2.5 1.5-4.5 4-4.5s3.5 2 3.5 4.5" />
        </svg>
      );
  }
}
