import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #0a1535 0%, #16213a 60%, #0c1730 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="135" height="135" viewBox="0 0 64 64" fill="none">
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#1e40af" />
              <stop offset="0.55" stopColor="#3b82f6" />
              <stop offset="1" stopColor="#7dd3fc" />
            </linearGradient>
            <linearGradient id="h" x1="0" y1="0" x2="0" y2="32" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
              <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M14 18 L30 32 L14 46"
            stroke="url(#g)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.55"
          />
          <path
            d="M26 18 L42 32 L26 46"
            stroke="url(#g)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.85"
          />
          <path
            d="M38 18 L54 32 L38 46"
            stroke="url(#g)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M38 18 L54 32 L50 32 L36 18 Z"
            fill="url(#h)"
            opacity="0.7"
          />
        </svg>
      </div>
    ),
    { ...size },
  );
}
