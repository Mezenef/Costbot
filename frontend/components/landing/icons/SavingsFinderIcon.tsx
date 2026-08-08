"use client";

export default function SavingsFinderIcon({ hovered }: { hovered: boolean }) {
  return (
    <svg viewBox="0 0 240 240" className="w-full h-full" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="sf-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#EC4899" />
          <stop offset="50%" stopColor="#A855F7" />
          <stop offset="100%" stopColor="#2563EB" />
        </linearGradient>
        <radialGradient id="sf-aura" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#EC4899" stopOpacity={hovered ? 0.32 : 0.1} />
          <stop offset="100%" stopColor="#EC4899" stopOpacity="0" />
        </radialGradient>
        <filter id="sf-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <circle cx="120" cy="120" r="110" fill="url(#sf-aura)" />

      <g stroke="#ffffff" strokeWidth="1" opacity={hovered ? 0.6 : 0.18} style={{ transition: "opacity 400ms ease" }}>
        <line x1="120" y1="10" x2="120" y2="230" strokeDasharray="2 6" />
        <line x1="10" y1="120" x2="230" y2="120" strokeDasharray="2 6" />
        <circle cx="120" cy="120" r="100" fill="none" strokeDasharray="1 5" />
        <circle cx="120" cy="30" r="2" fill="#ffffff" />
        <circle cx="120" cy="210" r="2" fill="#ffffff" />
      </g>

      <g>
        {/* Konsantrik halkalar */}
        <circle cx="110" cy="110" r="62" fill="none" stroke="url(#sf-grad)" strokeWidth="10" strokeLinecap="round" opacity="0.35" />
        <circle cx="110" cy="110" r="46" fill="none" stroke="url(#sf-grad)" strokeWidth="10" strokeLinecap="round" opacity="0.65" />
        <circle cx="110" cy="110" r="30" fill="none" stroke="url(#sf-grad)" strokeWidth="11" strokeLinecap="round" />

        {/* Merkez odak noktasi - dolar motifi */}
        <line x1="110" y1="97" x2="110" y2="123" stroke="url(#sf-grad)" strokeWidth="4" strokeLinecap="round" />
        <path
          d="M118 101 Q100 101 100 108 Q100 114 112 115 Q122 116 122 122 Q122 129 104 129"
          fill="none"
          stroke="url(#sf-grad)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Analiz kolu (buyutec yerine teknik referans cizgisi) */}
        <line x1="154" y1="154" x2="192" y2="192" stroke="url(#sf-grad)" strokeWidth="10" strokeLinecap="round" />
        <circle cx="192" cy="192" r="6" fill="url(#sf-grad)" />
      </g>
    </svg>
  );
}