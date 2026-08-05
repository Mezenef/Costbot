"use client";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/lib/i18n";

// Sadece ikon kutusu Dashboard paletiyle renkli -- kart gövdesi HAFİF
// renkli bir zemine sahip (önceki sürümde opaklık çok düşüktü, "beyaz
// gibi" görünüyordu -- bu yüzden zemin/kenarlık tonu belirginleştirildi).
// Turuncu HİÇBİR yerde kullanılmıyor.
const FEATURES_META = [
  { icon: "💬", bg: "bg-blue-100 dark:bg-blue-500/20 dark:ring-1 dark:ring-blue-500/30", card: "bg-blue-50 dark:bg-blue-500/[0.08] border-blue-200 dark:border-blue-500/25" },
  { icon: "📊", bg: "bg-cyan-100 dark:bg-cyan-500/20 dark:ring-1 dark:ring-cyan-500/30", card: "bg-cyan-50 dark:bg-cyan-500/[0.08] border-cyan-200 dark:border-cyan-500/25" },
  { icon: "💡", bg: "bg-emerald-100 dark:bg-emerald-500/20 dark:ring-1 dark:ring-emerald-500/30", card: "bg-emerald-50 dark:bg-emerald-500/[0.08] border-emerald-200 dark:border-emerald-500/25" },
  { icon: "🛡️", bg: "bg-purple-100 dark:bg-purple-500/20 dark:ring-1 dark:ring-purple-500/30", card: "bg-purple-50 dark:bg-purple-500/[0.08] border-purple-200 dark:border-purple-500/25" },
];

const STATS_META = [
  { icon: "⚡", bg: "bg-rose-50 dark:bg-rose-500/10 dark:ring-1 dark:ring-rose-500/30" },
  { icon: "🗄️", bg: "bg-indigo-50 dark:bg-indigo-500/10 dark:ring-1 dark:ring-indigo-500/30" },
  { icon: "🎯", bg: "bg-pink-50 dark:bg-pink-500/10 dark:ring-1 dark:ring-pink-500/30" },
];

const STAGGER_MS = 120;

export default function Features() {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  // Kartlar bölüm, ekranda göründüğünde (scroll ile) SIRAYLA belirir --
  // sayfa açılışında değil, kullanıcı bu bölüme kaydırdığında tetiklenir.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const features = FEATURES_META.map((meta, i) => ({
    ...meta,
    title: t(`features.f${i + 1}.title`),
    desc: t(`features.f${i + 1}.desc`),
  }));
  const stats = STATS_META.map((meta, i) => ({
    ...meta,
    title: t(`features.stat${i + 1}.title`),
    desc: t(`features.stat${i + 1}.desc`),
  }));

  return (
    <section id="ozellikler" ref={sectionRef} className="px-6 md:px-12 py-24 max-w-6xl mx-auto">
      <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-16 text-center">{t("features.title")}</h2>

      <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6 mb-20">
        {features.map((f, i) => (
          <div
            key={i}
            className={`border rounded-2xl p-7 hover:shadow-md transition-shadow ${f.card}`}
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? "translateY(0)" : "translateY(16px)",
              transition: "opacity 500ms ease-out, transform 500ms ease-out",
              transitionDelay: `${i * STAGGER_MS}ms`,
            }}
          >
            <div className={`w-16 h-16 rounded-2xl ${f.bg} flex items-center justify-center text-3xl mb-5`}>
              {f.icon}
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white text-base mb-2">{f.title}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>

      <div className="grid sm:grid-cols-3 gap-8 border-t border-gray-100 dark:border-gray-800 pt-14">
        {stats.map((s, i) => (
          <div
            key={i}
            className="flex items-center gap-4"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? "translateY(0)" : "translateY(16px)",
              transition: "opacity 500ms ease-out, transform 500ms ease-out",
              transitionDelay: `${(features.length + i) * STAGGER_MS}ms`,
            }}
          >
            <div className={`w-14 h-14 rounded-2xl ${s.bg} flex items-center justify-center text-2xl flex-shrink-0`}>
              {s.icon}
            </div>
            <div>
              <div className="font-semibold text-gray-900 dark:text-white">{s.title}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{s.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}