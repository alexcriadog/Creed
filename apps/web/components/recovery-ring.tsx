/**
 * RecoveryRing — anillo SVG que muestra el último Recovery score.
 * Color según rangos Whoop (≥67 verde, 34-66 ámbar, ≤33 rojo).
 * Usa los tokens de design.md vía currentColor.
 */
export function RecoveryRing({
  score,
  size = 180,
}: {
  score: number | null;
  size?: number;
}) {
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = score !== null ? Math.max(0, Math.min(100, score)) / 100 : 0;
  const dashOffset = circumference * (1 - pct);

  let color = 'var(--color-text-muted)';
  if (score !== null) {
    if (score >= 67) color = 'var(--color-status-green)';
    else if (score >= 34) color = 'var(--color-status-amber)';
    else color = 'var(--color-status-red)';
  }

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-border-default)"
          strokeWidth={stroke}
        />
        {/* Progress */}
        {score !== null && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset var(--duration-slow) var(--ease-out-expo)' }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-mono text-[length:var(--text-display)] font-bold leading-none tabular-nums"
          style={{ color }}
        >
          {score !== null ? score : '—'}
        </span>
        <span className="mt-1 text-[length:var(--text-xs)] uppercase tracking-wider text-[color:var(--color-text-muted)]">
          Recovery
        </span>
      </div>
    </div>
  );
}
