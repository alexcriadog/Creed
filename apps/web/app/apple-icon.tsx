import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background:
            'radial-gradient(ellipse at 30% 25%, #2a3a6a 0%, #16213a 45%, #0a1535 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '40%',
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 100%)',
            display: 'flex',
          }}
        />
        <svg
          width="135"
          height="135"
          viewBox="0 0 64 64"
          fill="none"
          style={{ position: 'relative' }}
        >
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#1e3a8a" />
              <stop offset="0.5" stopColor="#3b82f6" />
              <stop offset="1" stopColor="#93c5fd" />
            </linearGradient>
            <linearGradient id="h" x1="0" y1="0" x2="0" y2="48" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M14 18 L30 32 L14 46"
            stroke="url(#g)"
            strokeWidth="6.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.5"
          />
          <path
            d="M26 18 L42 32 L26 46"
            stroke="url(#g)"
            strokeWidth="6.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.82"
          />
          <path
            d="M38 18 L54 32 L38 46"
            stroke="url(#g)"
            strokeWidth="6.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M38 18 L54 32 L48 32 L34 18 Z" fill="url(#h)" opacity="0.75" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
