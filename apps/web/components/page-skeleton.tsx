interface PageSkeletonProps {
  hero?: boolean;
  metrics?: boolean;
  list?: boolean;
  bottomNav?: boolean;
}

export function PageSkeleton({
  hero = true,
  metrics = true,
  list = true,
  bottomNav = true,
}: PageSkeletonProps) {
  return (
    <main className="mx-auto max-w-md px-4 pb-32 pt-6 sm:max-w-lg sm:px-6 sm:pt-10">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="skeleton-block h-11 w-11 rounded-[var(--radius-md)]" />
          <div className="flex flex-col gap-1">
            <div className="skeleton-block h-3 w-16 rounded-[var(--radius-sm)]" />
            <div className="skeleton-block h-2 w-20 rounded-[var(--radius-sm)]" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="skeleton-block h-9 w-9 rounded-full" />
          <div className="skeleton-block h-9 w-9 rounded-full" />
        </div>
      </div>

      {hero && (
        <div className="surface-glass mb-4 p-6">
          <div className="skeleton-block mb-3 h-3 w-32 rounded-[var(--radius-sm)]" />
          <div className="skeleton-block mb-3 h-12 w-48 rounded-[var(--radius-sm)]" />
          <div className="skeleton-block mb-2 h-3 w-full rounded-[var(--radius-sm)]" />
          <div className="skeleton-block mb-5 h-3 w-3/4 rounded-[var(--radius-sm)]" />
          <div className="skeleton-block h-10 w-full rounded-[var(--radius-sm)]" />
        </div>
      )}

      {metrics && (
        <div className="mb-4 grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="metric-card">
              <div className="skeleton-block mb-3 h-2.5 w-20 rounded-[var(--radius-sm)]" />
              <div className="skeleton-block h-7 w-16 rounded-[var(--radius-sm)]" />
            </div>
          ))}
        </div>
      )}

      {list && (
        <div className="mb-6">
          <div className="skeleton-block mb-3 h-2.5 w-32 rounded-[var(--radius-sm)]" />
          <div className="flex flex-col gap-3">
            {[0, 1].map((i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="skeleton-block h-8 w-8 rounded-full" />
                <div className="surface-glass flex-1 p-4">
                  <div className="skeleton-block mb-2 h-2.5 w-24 rounded-[var(--radius-sm)]" />
                  <div className="skeleton-block mb-1 h-3 w-full rounded-[var(--radius-sm)]" />
                  <div className="skeleton-block h-3 w-4/5 rounded-[var(--radius-sm)]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {bottomNav && (
        <nav
          aria-hidden
          className="fixed bottom-4 left-1/2 z-40 w-[min(420px,calc(100vw-2rem))] -translate-x-1/2"
        >
          <div className="bottom-nav-pill flex items-center justify-around gap-1 px-3 py-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col items-center gap-1 px-3 py-1.5">
                <div className="skeleton-block h-9 w-9 rounded-[var(--radius-md)]" />
                <div className="skeleton-block h-2 w-8 rounded-[var(--radius-sm)]" />
              </div>
            ))}
          </div>
        </nav>
      )}
    </main>
  );
}
