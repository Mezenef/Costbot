"use client";
import { useId } from "react";

// Bulutlar artık KENARLARA yakın konumlanıyor (sol/sağ ~%20 dışına)
// -- merkezdeki içerik (başlık, demo kutusu) hiçbir zaman görsel
// bulutlarla çakışmıyor.
const DEFAULT_CLOUDS = [
  { top: "15%", left: "3%", size: 100, opacity: 0.5, duration: 8, delay: 0 },
  { top: "55%", left: "5%", size: 90, opacity: 0.45, duration: 8.5, delay: 0.6 },
  { top: "10%", right: "5%", size: 75, opacity: 0.4, duration: 10, delay: 1 },
  { bottom: "22%", left: "8%", size: 65, opacity: 0.35, duration: 7, delay: 2 },
  { bottom: "14%", right: "10%", size: 90, opacity: 0.45, duration: 9, delay: 0.5 },
  { top: "42%", right: "4%", size: 55, opacity: 0.3, duration: 11, delay: 1.5 },
];
const DENSE_CLOUDS = [
  ...DEFAULT_CLOUDS,
  { top: "5%", left: "18%", size: 60, opacity: 0.3, duration: 9.5, delay: 0.8 },
  { top: "30%", right: "16%", size: 70, opacity: 0.35, duration: 8.5, delay: 2.5 },
  { bottom: "8%", left: "20%", size: 50, opacity: 0.28, duration: 10.5, delay: 1.2 },
  { top: "60%", left: "6%", size: 45, opacity: 0.22, duration: 7.5, delay: 1.8 },
  { top: "5%", right: "18%", size: 55, opacity: 0.3, duration: 11.5, delay: 0.3 },
];
const SPARSE_CLOUDS = [
  { top: "20%", left: "6%", size: 55, opacity: 0.4, duration: 9, delay: 0 },
  { top: "45%", right: "6%", size: 45, opacity: 0.3, duration: 11, delay: 1.5 },
];

// Kurumsal "bulut bilişim / ağ" temalı ikon -- klasik tek-path bulut
// şeklinin yerine, içinde bağlantı düğümleri (node) ve hatları olan
// bir "cloud infrastructure" görseli. Ana bulut hattı ince bir dış
// çizgiyle, içindeki düğümler ve bağlantılar noktalı/ince çizgilerle
// çizilir -- daha teknik/profesyonel bir izlenim verir.
// Klasik, tanınabilir bir "bulut" siluetini (üst üste binen yuvarlak
// loblardan oluşan) DOLGULU şekilde çizer -- kurumsal derinlik için
// hafif bir gradyan ve ince bir dış kontur eklenir.
// Azure'un TESCİLLİ logosu BİREBİR kopyalanmadı -- bunun yerine Azure'un
// resmi marka mavisine (#0078D4 civarı) yakın bir gradyan ve klasik,
// tanınabilir bir bulut siluetiyle KENDİ özgün illüstrasyonumuz çizildi.
function CloudIcon({ size }: { size: number }) {
  const gradId = `cloudGrad${useId()}`;
  return (
    <svg width={size} height={size * 0.62} viewBox="0 0 100 62" fill="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#50b0f0" />
          <stop offset="55%" stopColor="#0f8ce8" />
          <stop offset="100%" stopColor="#0063b8" />
        </linearGradient>
      </defs>
      <g fill={`url(#${gradId})`}>
        <ellipse cx="38" cy="42" rx="27" ry="16" />
        <circle cx="27" cy="30" r="15" />
        <circle cx="45" cy="22" r="18" />
        <circle cx="63" cy="30" r="14" />
        <ellipse cx="60" cy="42" rx="22" ry="14" />
      </g>
      <g stroke="#ffffff" strokeWidth="1" fill="none" opacity="0.35">
        <path d="M13 44 Q11 30 27 28 Q29 12 47 12 Q63 12 65 26 Q80 24 82 38 Q84 48 74 50 L20 50 Q11 50 13 44 Z" />
      </g>
      {/* Bulutun içine küçük bir devre/baglanti noktasi sembolü --
          "cloud computing" hissini güçlendirir, gökyüzü bulutu
          izlenimini azaltır. */}
      <g stroke="#ffffff" strokeWidth="1.3" opacity="0.85">
        <line x1="32" y1="38" x2="47" y2="32" />
        <line x1="47" y1="32" x2="62" y2="38" />
        <line x1="47" y1="32" x2="47" y2="44" />
      </g>
      <g fill="#ffffff">
        <circle cx="32" cy="38" r="2.6" />
        <circle cx="47" cy="32" r="3" />
        <circle cx="62" cy="38" r="2.6" />
        <circle cx="47" cy="44" r="2.2" />
      </g>
    </svg>
  );
}

export default function AnimatedBackground({ variant = "default" }: { variant?: "default" | "dense" | "sparse" }) {
  const clouds = variant === "dense" ? DENSE_CLOUDS : variant === "sparse" ? SPARSE_CLOUDS : DEFAULT_CLOUDS;
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10 text-blue-300 dark:text-blue-500">
      {clouds.map((c, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            top: c.top,
            left: "left" in c ? c.left : undefined,
            right: "right" in c ? c.right : undefined,
            bottom: "bottom" in c ? c.bottom : undefined,
            opacity: c.opacity,
            animation: `cloud-drift ${c.duration}s ease-in-out ${c.delay}s infinite`,
          }}
        >
          <CloudIcon size={c.size} />
        </div>
      ))}
    </div>
  );
}