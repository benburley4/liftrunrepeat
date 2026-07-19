import { ImageResponse } from 'next/og'

export const alt = 'LiftRunRepeat — Train Both. Peak Together.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: 'linear-gradient(105deg, #0D1512 0%, #0D0D0D 45%, #0D0D0D 55%, #150D0E 100%)',
          color: '#F5F5F5',
        }}
      >
        <div style={{ display: 'flex', fontSize: 34, fontWeight: 700, letterSpacing: '0.06em', marginBottom: 40 }}>
          <span style={{ color: '#C8102E' }}>LIFT</span>
          <span style={{ color: '#00BFA5' }}>RUN</span>
          <span style={{ color: '#F5F5F5' }}>REPEAT</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', fontSize: 84, fontWeight: 800, lineHeight: 1.05, textTransform: 'uppercase' }}>
          <span>Strong enough to <span style={{ color: '#00BFA5', marginLeft: 18 }}>run far.</span></span>
          <span>Fast enough to <span style={{ color: '#C8102E', marginLeft: 18 }}>lift heavy.</span></span>
        </div>
        <div style={{ display: 'flex', fontSize: 30, color: '#A0A0A0', marginTop: 40 }}>
          The platform built for hybrid athletes. Log both. Track both. Peak at both.
        </div>
      </div>
    ),
    size
  )
}
