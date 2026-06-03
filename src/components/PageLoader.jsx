// Shared brand icon + full-screen page loader

export function BrandIcon({ size = 48 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#C4633A" />
          <stop offset="100%" stopColor="#9E4E22" />
        </linearGradient>
        <linearGradient id="inner" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#D97B4F" />
          <stop offset="100%" stopColor="#C4633A" />
        </linearGradient>
      </defs>

      {/* Outer circle — badge shape */}
      <circle cx="24" cy="24" r="23" fill="url(#bg)" />

      {/* Subtle inner ring for depth */}
      <circle cx="24" cy="24" r="20" stroke="white" strokeOpacity="0.1" strokeWidth="1" fill="none" />

      {/* Bold upward chevron */}
      <polyline
        points="13,31 24,17 35,31"
        stroke="white"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Small dot above chevron — the goal/star */}
      <circle cx="24" cy="11" r="2.8" fill="white" fillOpacity="0.9" />
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
        <BrandIcon size={64} />
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
