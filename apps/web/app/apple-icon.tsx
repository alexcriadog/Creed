import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 130,
          background: 'linear-gradient(135deg, #1c1c1e 0%, #0f0f10 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#3b82f6',
          fontFamily: 'serif',
          fontWeight: 700,
          letterSpacing: '-0.05em',
          borderRadius: 30,
        }}
      >
        C
      </div>
    ),
    { ...size },
  );
}
