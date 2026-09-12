import { ImageResponse } from 'next/og';

export const alt = 'Prospectly';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#20252a',
          color: '#f4f5f6',
          padding: '72px 80px',
        }}
      >
        <div style={{ display: 'flex', fontSize: 36, fontWeight: 600, letterSpacing: '-0.04em' }}>
          Prospectly
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              fontSize: 64,
              fontWeight: 700,
              letterSpacing: '-0.06em',
              lineHeight: 1.05,
              maxWidth: 920,
            }}
          >
            Encontre empresas para prospectar no Brasil
          </div>
          <div style={{ display: 'flex', marginTop: 24, fontSize: 28, color: '#697178' }}>
            Listas segmentadas para prospecção B2B
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
