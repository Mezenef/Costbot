"use client";
import { useState } from "react";

interface FeatureCardProps {
  icon: (props: { hovered: boolean }) => React.ReactNode;
  title: string;
  desc: string;
  accent: string;
}

export default function FeatureCard({ icon: Icon, title, desc, accent }: FeatureCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="feature-card-root relative rounded-[32px] p-8 flex flex-col items-center text-center overflow-hidden"
      style={{
        minHeight: "460px",
        background: "#06070A",
        border: "1px solid rgba(255,255,255,0.08)",
        transform: hovered ? "translateY(-8px)" : "translateY(0)",
        transition: "transform 450ms cubic-bezier(0.22, 1, 0.36, 1), border-color 450ms ease",
        cursor: "default",
      }}
    >
      {/* KATMAN 1 (en arkada): sadece zemin rengi degisiyor -- ikonun
          UZERINE hicbir sey binmiyor, sadece kartin arkasinda oynuyor */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: hovered
            ? `radial-gradient(circle at 30% 25%, #EC489955 0%, transparent 45%),
               radial-gradient(circle at 72% 35%, #A855F755 0%, transparent 50%),
               radial-gradient(circle at 50% 80%, #2563EB55 0%, transparent 50%)`
            : "transparent",
          transition: "background 600ms ease",
          zIndex: 0,
        }}
      />

      {/* Gradient border */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[32px]"
        style={{
          padding: 1,
          background: "linear-gradient(135deg, #EC4899, #A855F7, #2563EB)",
          WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          opacity: hovered ? 0.9 : 0,
          transition: "opacity 450ms ease",
          zIndex: 1,
        }}
      />

      {/* KATMAN 2 (en onde): icon + metin -- her zaman net, hicbir filtre/golge YOK */}
      <div className="relative flex flex-col items-center h-full w-full" style={{ zIndex: 2 }}>
        <div className="w-full flex-1 flex items-center justify-center" style={{ maxWidth: "62%" }}>
          <Icon hovered={hovered} />
        </div>

        <h3 className="text-white font-semibold text-lg mt-6 mb-2 tracking-tight">{title}</h3>
        <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
          {desc}
        </p>
      </div>
    </div>
  );
}