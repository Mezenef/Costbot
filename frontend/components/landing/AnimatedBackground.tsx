"use client";

const DEFAULT_CLOUDS = [
  { top: "15%", left: "3%", size: 100, opacity: 0.5, duration: 8, delay: 0 },
  { top: "55%", left: "3%", size: 100, opacity: 0.5, duration: 8, delay: 0 },
  { top: "10%", right: "5%", size: 75, opacity: 0.4, duration: 10, delay: 1 },
  { bottom: "22%", left: "12%", size: 65, opacity: 0.35, duration: 7, delay: 2 },
  { bottom: "14%", right: "14%", size: 90, opacity: 0.45, duration: 9, delay: 0.5 },
  { top: "45%", left: "45%", size: 55, opacity: 0.25, duration: 11, delay: 1.5 },
];
const DENSE_CLOUDS = [
  ...DEFAULT_CLOUDS,
  { top: "5%", left: "35%", size: 60, opacity: 0.3, duration: 9.5, delay: 0.8 },
  { top: "30%", right: "35%", size: 70, opacity: 0.35, duration: 8.5, delay: 2.5 },
  { bottom: "8%", left: "40%", size: 50, opacity: 0.28, duration: 10.5, delay: 1.2 },
  { top: "60%", left: "8%", size: 45, opacity: 0.22, duration: 7.5, delay: 1.8 },
  { top: "5%", right: "45%", size: 55, opacity: 0.3, duration: 11.5, delay: 0.3 },
];
const SPARSE_CLOUDS = [
  { top: "20%", left: "8%", size: 55, opacity: 0.4, duration: 9, delay: 0 },
  { top: "45%", right: "10%", size: 45, opacity: 0.3, duration: 11, delay: 1.5 },
];

function CloudIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size * 0.6} viewBox="0 0 100 60" fill="none">
      <path
        d="M20 45 Q10 45 10 35 Q10 25 20 25 Q22 15 32 15 Q40 15 44 22 Q48 18 56 18 Q68 18 70 30 Q80 30 80 40 Q80 45 74 45 Z"
        fill="currentColor"
      />
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