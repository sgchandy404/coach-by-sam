// Shared brand wordmark + full-screen page loader

export function BrandMark({ size = 'md', dark = false }) {
  const sizes = { sm: 18, md: 24, lg: 32 }
  const fs = sizes[size] || size
  const color = dark ? '#FFFFFF' : '#1AAF96'
  const lineColor = dark ? 'rgba(255,255,255,0.5)' : '#1AAF96'
  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{
        fontFamily: "'Playfair Display', Georgia, serif",
        fontSize: fs,
        fontWeight: 700,
        color,
        letterSpacing: '-0.3px',
        lineHeight: 1.1,
      }}>
        Coach by Sam
      </p>
      <div style={{
        width: 28, height: 2,
        background: lineColor,
        borderRadius: 2,
        margin: '6px auto 0',
        opacity: 0.6,
      }} />
    </div>
  )
}

export default function PageLoader({ label = 'Loading…' }) {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#F0EDE7',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      zIndex: 500, gap: 20,
    }}>
      {/* Decorative teal arc — Comet-inspired */}
      <div style={{
        position: 'absolute',
        width: 320, height: 320,
        borderRadius: '50%',
        border: '1px solid rgba(26,175,150,0.15)',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        width: 200, height: 200,
        borderRadius: '50%',
        border: '1px solid rgba(26,175,150,0.10)',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
      }} />
      <div style={{ animation: 'loader-pulse 1.6s ease-in-out infinite', position: 'relative', zIndex: 1 }}>
        <BrandMark size={28} />
      </div>
      <p style={{
        fontSize: 11, color: '#9E9890',
        letterSpacing: '1px', fontFamily: 'DM Sans, sans-serif',
        textTransform: 'uppercase', position: 'relative', zIndex: 1,
      }}>
        {label}
      </p>
    </div>
  )
}
