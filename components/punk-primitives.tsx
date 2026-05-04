'use client'

export function SVGDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }}>
      <defs>
        <filter id="scribbleFilter">
          <feTurbulence type="fractalNoise" baseFrequency="0.04 0.9" numOctaves={2} seed={3} />
          <feDisplacementMap in="SourceGraphic" scale={6} />
        </filter>
        <filter id="roughInk">
          <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves={2} seed={1} />
          <feDisplacementMap in="SourceGraphic" scale={1.4} />
        </filter>
      </defs>
    </svg>
  )
}

export function RoleGlyph({
  role,
  size = 64,
  ink = 'var(--ink)',
  accent = 'var(--accent)',
}: {
  role: string
  size?: number
  ink?: string
  accent?: string
}) {
  if (role === 'rhythm') {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" style={{ display: 'block' }}>
        <rect x="6" y="20" width="52" height="28" fill={ink} />
        <rect x="6" y="20" width="52" height="6" fill={accent} />
        <circle cx="32" cy="34" r="9" fill="none" stroke="var(--paper)" strokeWidth="2.5" />
        <circle cx="32" cy="34" r="2.2" fill="var(--paper)" />
        <rect x="2" y="50" width="60" height="3" fill={ink} />
        <rect x="44" y="6" width="3" height="18" fill={ink} transform="rotate(20 45 14)" />
        <rect x="17" y="6" width="3" height="18" fill={ink} transform="rotate(-20 19 14)" />
      </svg>
    )
  }
  if (role === 'melody') {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" style={{ display: 'block' }}>
        <polygon points="6,46 22,30 32,40 18,56" fill={ink} />
        <rect x="22" y="30" width="36" height="5" fill={ink} transform="rotate(-25 22 30)" />
        <rect x="48" y="14" width="10" height="4" fill={accent} transform="rotate(-25 48 14)" />
        <circle cx="14" cy="50" r="3" fill={accent} />
        <line x1="22" y1="32" x2="50" y2="20" stroke="var(--paper)" strokeWidth="1" />
        <line x1="24" y1="34" x2="52" y2="22" stroke="var(--paper)" strokeWidth="1" />
      </svg>
    )
  }
  // vocals — microphone
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={{ display: 'block' }}>
      <rect x="22" y="6" width="20" height="28" fill={ink} rx="10" />
      <rect x="24" y="12" width="16" height="2" fill="var(--paper)" />
      <rect x="24" y="18" width="16" height="2" fill="var(--paper)" />
      <rect x="24" y="24" width="16" height="2" fill="var(--paper)" />
      <rect x="30" y="34" width="4" height="14" fill={ink} />
      <rect x="18" y="48" width="28" height="5" fill={ink} />
      <rect x="38" y="2" width="6" height="6" fill={accent} />
    </svg>
  )
}

export function PortraitPlaceholder({
  char,
  size = 'md',
}: {
  char: { num?: string; role: string; id: string }
  size?: 'sm' | 'md' | 'lg'
}) {
  const h = size === 'lg' ? 220 : size === 'sm' ? 60 : 160
  const num = char.num || char.id.split('-').pop()?.replace(/^0+/, '') || '000'

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: h,
        background: 'var(--paper-2)',
        border: '2px solid var(--ink)',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* scanlines */}
      <div className="scanlines" style={{ position: 'absolute', inset: 0, opacity: 0.5 }} />
      {/* halftone dots */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(rgba(0,0,0,.55) 1.2px, transparent 1.6px)',
          backgroundSize: '5px 5px',
          mixBlendMode: 'multiply',
          opacity: 0.35,
        }}
      />
      {/* role glyph */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <RoleGlyph role={char.role} size={size === 'sm' ? 36 : 96} />
      </div>
      {/* corner ID stamp */}
      <div
        className="font-mono"
        style={{
          position: 'absolute',
          top: 6,
          left: 6,
          fontSize: size === 'sm' ? 8 : 10,
          background: 'var(--ink)',
          color: 'var(--paper)',
          padding: '2px 6px',
          letterSpacing: '.1em',
        }}
      >
        ID/{num.padStart(3, '0')}
      </div>
      {/* placeholder text */}
      {size !== 'sm' && (
        <div
          className="font-mono"
          style={{
            position: 'absolute',
            bottom: 6,
            right: 6,
            fontSize: 9,
            color: 'var(--ink)',
            opacity: 0.55,
            letterSpacing: '.15em',
          }}
        >
          [PORTRAIT]
        </div>
      )}
      {/* accent corner */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 0,
          height: 0,
          borderTop: '18px solid var(--accent)',
          borderLeft: '18px solid transparent',
        }}
      />
    </div>
  )
}

export function Tape({
  style = {},
  rotate = -3,
  text,
  variant = 'yellow',
}: {
  style?: React.CSSProperties
  rotate?: number
  text?: string
  variant?: 'yellow' | 'green'
}) {
  const bg = variant === 'green' ? 'var(--tape-2)' : 'var(--tape)'
  return (
    <div
      className="tape-strip"
      style={{
        ...style,
        background: bg,
        transform: `rotate(${rotate}deg)`,
      }}
    >
      {text && (
        <span
          className="font-mono"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            letterSpacing: '.2em',
            color: 'var(--ink)',
            opacity: 0.7,
          }}
        >
          {text}
        </span>
      )}
    </div>
  )
}

export function Scribble({
  variant = 0,
  color = 'var(--accent)',
  width = '100%',
  height = 14,
}: {
  variant?: number
  color?: string
  width?: string | number
  height?: number
}) {
  const paths = [
    'M2 10 Q 20 2, 40 9 T 80 7 T 120 10 T 160 6 T 200 8',
    'M3 8 C 30 2, 60 14, 90 6 S 150 12, 200 7',
    'M2 12 L 30 4 L 50 11 L 80 3 L 120 10 L 160 5 L 200 9',
  ]
  return (
    <svg
      viewBox="0 0 200 14"
      preserveAspectRatio="none"
      width={width}
      height={height}
      style={{ display: 'block' }}
    >
      <path
        d={paths[variant % paths.length]}
        stroke={color}
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        filter="url(#roughInk)"
      />
    </svg>
  )
}
