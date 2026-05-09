import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 360,
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
          borderRadius: 96,
        }}
      >
        C
      </div>
    ),
    { ...size },
  );
}
