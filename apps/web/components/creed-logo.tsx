interface CreedLogoProps {
  size?: number;
  className?: string;
  variant?: 'mark' | 'monochrome';
}

export function CreedLogo({
  size = 32,
  className,
  variant = 'mark',
}: CreedLogoProps) {
  if (variant === 'monochrome') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        className={className}
        aria-label="Creed"
      >
        <path
          d="M14 18 L30 32 L14 46"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.55"
        />
        <path
          d="M26 18 L42 32 L26 46"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.8"
        />
        <path
          d="M38 18 L54 32 L38 46"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  const gradId = `creed-grad-${size}`;
  const highlightId = `creed-highlight-${size}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-label="Creed"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1e3a8a" />
          <stop offset="0.5" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#93c5fd" />
        </linearGradient>
        <linearGradient id={highlightId} x1="0" y1="0" x2="0" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M14 18 L30 32 L14 46"
        stroke={`url(#${gradId})`}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.55"
      />
      <path
        d="M26 18 L42 32 L26 46"
        stroke={`url(#${gradId})`}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />
      <path
        d="M38 18 L54 32 L38 46"
        stroke={`url(#${gradId})`}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M38 18 L54 32 L50 32 L36 18 Z"
        fill={`url(#${highlightId})`}
        opacity="0.6"
      />
    </svg>
  );
}
