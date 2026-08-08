"use client";

export default function SpendAnomaliesIcon({ hovered }: { hovered: boolean }) {
  return (
    <svg viewBox="0 0 240 240" className="w-full h-full" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="sa-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#EC4899" />
          <stop offset="50%" stopColor="#A855F7" />
          <stop offset="100%" stopColor="#2563EB" />
        </linearGradient>
        <radialGradient id="sa-aura" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#2563EB" stopOpacity={hovered ? 0.32 : 0.1} />
          <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
        </radialGradient>
        <filter id="sa-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <circle cx="120" cy="120" r="110" fill="url(#sa-aura)" />

      <g stroke="#ffffff" strokeWidth="1" opacity={hovered ? 0.6 : 0.18} style={{ transition: "opacity 400ms ease" }}>
        <line x1="30" y1="60" x2="30" y2="190" strokeDasharray="2 6" />
        <line x1="30" y1="190" x2="210" y2="190" strokeDasharray="2 6" />
        <circle cx="168" cy="78" r="2" fill="#ffffff" />
        <circle cx="60" cy="150" r="2" fill="#ffffff" />
      </g>

      <g>
        {/* Dalgali veri akisi, ani sivri tepe */}
        <path
          d="M34 150 Q60 150 70 130 Q80 110 92 140 Q100 158 110 120 Q120 78 132 96 Q145 116 160 108 Q178 98 198 104"
          fill="none"
          stroke="url(#sa-grad)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Tepe noktasindaki uyari odagi */}
        <circle cx="132" cy="96" r="9" fill="none" stroke="url(#sa-grad)" strokeWidth="4" opacity={hovered ? 1 : 0.7} />
        <circle cx="132" cy="96" r="3.5" fill="url(#sa-grad)" />
        <line x1="132" y1="70" x2="132" y2="82" stroke="url(#sa-grad)" strokeWidth="4" strokeLinecap="round" />
        <line x1="132" y1="112" x2="132" y2="80" stroke="url(#sa-grad)" strokeWidth="1" opacity="0.4" strokeDasharray="2 4" />
      </g>
    </svg>
  );
}