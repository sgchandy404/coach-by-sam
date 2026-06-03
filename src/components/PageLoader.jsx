// Shared brand icon + full-screen page loader

export function BrandIcon({ size = 48 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 56" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="flame-grad" x1="24" y1="0" x2="24" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#C4633A" />
          <stop offset="100%" stopColor="#A8720A" />
        </linearGradient>
      </defs>
      {/* Outer flame */}
      <path
        d="M24 2C24 2 38 16 38 28C38 36.8 31.7 44 24 46C16.3 44 10 36.8 10 28C10 16 24 2 24 2Z"
        fill="url(#flame-grad)"
      />
      {/* Inner glow — lighter teardrop */}
      <path
        d="M24 46C24 46 31 37 31 30C31 26.1 28.2 23 24 22C19.8 23 17 26.1 17 30C17 37 24 46 24 46Z"
        fill="white"
        fillOpacity="0.22"
      />
      {/* Tiny core highlight */}
      <ellipse cx="21" cy="28" rx="2.5" ry="4" fill="white" fillOpacity="0.18" />
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
      zIndex: 500, gap: 18,
    }}>
      <div style={{ animation: 'loader-pulse 1.5s ease-in-out infinite' }}>
        <BrandIcon size={52} />
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-3)', letterSpacing: '0.5px', fontFamily: 'DM Sans, sans-serif' }}>
        {label}
      </p>
    </div>
  )
}
