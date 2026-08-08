"use client";

export default function CloudVisibilityIcon({ hovered }: { hovered: boolean }) {
  return (
    <svg viewBox="0 0 240 240" className="w-full h-full" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="cv-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#EC4899" />
          <stop offset="50%" stopColor="#A855F7" />
          <stop offset="100%" stopColor="#2563EB" />
        </linearGradient>
        <radialGradient id="cv-aura" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#A855F7" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#A855F7" stopOpacity="0" />
        </radialGradient>
        <filter id="cv-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Arka enerji alani */}
      <circle cx="120" cy="120" r="110" fill="url(#cv-aura)" />

      {/* Construction lines: grid + olcu cizgileri */}
      <g stroke="#ffffff" strokeWidth="1" opacity="0.18">
        <line x1="20" y1="120" x2="220" y2="120" strokeDasharray="2 6" />
        <line x1="120" y1="20" x2="120" y2="220" strokeDasharray="2 6" />
        <circle cx="120" cy="120" r="95" fill="none" strokeDasharray="1 5" />
        <circle cx="120" cy="120" r="60" fill="none" strokeDasharray="1 5" />
        <circle cx="60" cy="60" r="2" fill="#ffffff" />
        <circle cx="180" cy="60" r="2" fill="#ffffff" />
        <circle cx="60" cy="180" r="2" fill="#ffffff" />
        <circle cx="180" cy="180" r="2" fill="#ffffff" />
      </g>

      {/* Katmanli bulut formu - 3 ust uste binen katman */}
      <g>
        <path
          d="M70 150 Q55 150 55 132 Q55 116 72 114 Q73 92 96 90 Q114 76 134 88 Q158 84 168 106 Q188 108 188 130 Q188 150 168 150 Z"
          fill="none"
          stroke="url(#cv-grad)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.45"
          transform="translate(-8, -14) scale(0.92)"
        />
        <path
          d="M75 155 Q58 155 58 136 Q58 119 76 117 Q77 94 101 92 Q120 77 141 90 Q166 86 177 109 Q198 111 198 134 Q198 155 177 155 Z"
          fill="none"
          stroke="url(#cv-grad)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.7"
          transform="translate(4, 6) scale(0.96)"
        />
        <path
          d="M72 152 Q54 152 54 132 Q54 114 73 112 Q74 88 99 86 Q119 70 141 84 Q167 80 178 104 Q200 106 200 130 Q200 152 178 152 Z"
          fill="none"
          stroke="url(#cv-grad)"
          strokeWidth="11"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Ic detay: baglanti noktalari (gorunurluk/izlenebilirlik hissi) */}
        <circle cx="99" cy="86" r="4" fill="url(#cv-grad)" />
        <circle cx="141" cy="84" r="4" fill="url(#cv-grad)" />
        <circle cx="178" cy="104" r="4" fill="url(#cv-grad)" />
        <circle cx="72" cy="152" r="4" fill="url(#cv-grad)" />
      </g>
    </svg>
  );
}