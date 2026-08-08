"use client";

export default function OptimizationEngineIcon({ hovered }: { hovered: boolean }) {
  return (
    <svg viewBox="0 0 240 240" className="w-full h-full" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="oe-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#EC4899" />
          <stop offset="50%" stopColor="#A855F7" />
          <stop offset="100%" stopColor="#2563EB" />
        </linearGradient>
        <radialGradient id="oe-aura" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#A855F7" stopOpacity={hovered ? 0.32 : 0.1} />
          <stop offset="100%" stopColor="#A855F7" stopOpacity="0" />
        </radialGradient>
        <filter id="oe-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <circle cx="120" cy="120" r="110" fill="url(#oe-aura)" />

      <g stroke="#ffffff" strokeWidth="1" opacity={hovered ? 0.6 : 0.18} style={{ transition: "opacity 400ms ease" }}>
        <line x1="120" y1="15" x2="120" y2="225" strokeDasharray="2 6" />
        <circle cx="120" cy="120" r="90" fill="none" strokeDasharray="1 5" />
        <circle cx="120" cy="30" r="2" fill="#ffffff" />
        <circle cx="120" cy="210" r="2" fill="#ffffff" />
      </g>

      <g>
        {/* Donen halkalar */}
        <g
        style={{
            transform: hovered ? "rotate(50deg)" : "rotate(0deg)",
            transformOrigin: "120px 120px",
            transition: "transform 900ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <circle cx="120" cy="120" r="68" fill="none" stroke="url(#oe-grad)" strokeWidth="9" strokeLinecap="round" strokeDasharray="140 300" opacity="0.55" />
        </g>
        <g
        style={{
            transform: hovered ? "rotate(-65deg)" : "rotate(0deg)",
            transformOrigin: "120px 120px",
            transition: "transform 900ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <circle cx="120" cy="120" r="46" fill="none" stroke="url(#oe-grad)" strokeWidth="10" strokeLinecap="round" strokeDasharray="95 220" />
        </g>

        {/* Merkez cekirdek + yon oklari */}
        <g>
          <circle cx="120" cy="120" r="14" fill="none" stroke="url(#oe-grad)" strokeWidth="6" />
          <path d="M160 100 L172 96 L168 108" fill="none" stroke="url(#oe-grad)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M80 140 L68 144 L72 132" fill="none" stroke="url(#oe-grad)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </g>
    </svg>
  );
}