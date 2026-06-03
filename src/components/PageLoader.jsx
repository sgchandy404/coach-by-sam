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
        <linearGradient id="brand-bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%"  stopColor="#C4633A" />
          <stop offset="100%" stopColor="#9E4E22" />
        </linearGradient>
      </defs>

      {/* Badge circle */}
      <circle cx="24" cy="24" r="23" fill="url(#brand-bg)" />
      <circle cx="24" cy="24" r="20" stroke="white" strokeOpacity="0.12" strokeWidth="1" fill="none" />

      {/* S in Playfair Display — elegant serif matching the app's headings */}
      <text
        x="24"
        y="32"
        textAnchor="middle"
        fontFamily="'Playfair Display', Georgia, serif"
        fontSize="26"
        fontWeight="600"
        fill="white"
        fillOpacity="0.95"
      >
        S
      </text>
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
