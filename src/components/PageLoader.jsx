// Shared brand icon + full-screen page loader
//
// BrandIcon: a minimal abstract coaching mark —
//   a circle (head) above a bold V-spread (arms raised in victory/coaching pose),
//   grounded by a short vertical stroke. Clean, premium, scales from 24px to 96px.

export function BrandIcon({ size = 48 }) {
  // We draw on a 48×56 canvas so there's a little breathing room top/bottom
  const color1 = '#C4633A'  // terracotta
  const color2 = '#A8720A'  // amber
  const id = 'brand-grad'

  return (
    <svg
      width={size}
      height={Math.round(size * (56 / 48))}
      viewBox="0 0 48 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={id} x1="24" y1="4" x2="24" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor={color1} />
          <stop offset="100%" stopColor={color2} />
        </linearGradient>
      </defs>

      {/* Head — solid filled circle */}
      <circle cx="24" cy="10" r="5.5" fill={`url(#${id})`} />

      {/* Body — short vertical stroke below head */}
      <line
        x1="24" y1="16"
        x2="24" y2="28"
        stroke={`url(#${id})`}
        strokeWidth="3.5"
        strokeLinecap="round"
      />

      {/* Arms raised — wide V pointing upward */}
      <polyline
        points="8,12 24,24 40,12"
        stroke={`url(#${id})`}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Legs — slightly spread for stability */}
      <line
        x1="24" y1="28"
        x2="15" y2="44"
        stroke={`url(#${id})`}
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <line
        x1="24" y1="28"
        x2="33" y2="44"
        stroke={`url(#${id})`}
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function PageLoader({ label = 'Loading…' }) {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'linear-gradient(160deg, #FAF7F2 0%, #F3EDE3 50%, #EDE4D5 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      zIndex: 500, gap: 20,
    }}>
      <div style={{ animation: 'loader-pulse 1.5s ease-in-out infinite' }}>
        <BrandIcon size={56} />
      </div>
      <p style={{
        fontSize: 13, color: 'var(--text-3)',
        letterSpacing: '0.6px', fontFamily: 'DM Sans, sans-serif',
      }}>
        {label}
      </p>
    </div>
  )
}
