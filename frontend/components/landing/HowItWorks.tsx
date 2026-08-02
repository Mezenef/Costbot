"use client";
import { useLanguage } from "@/lib/i18n";

const STEPS_META = [
  { icon: "💬", bg: "bg-blue-50 dark:bg-blue-500/10 dark:ring-1 dark:ring-blue-500/30 dark:shadow-[0_0_25px_rgba(59,130,246,0.25)]" },
  { icon: "🧠", bg: "bg-emerald-50 dark:bg-emerald-500/10 dark:ring-1 dark:ring-emerald-500/30 dark:shadow-[0_0_25px_rgba(16,185,129,0.25)]" },
  { icon: "📈", bg: "bg-violet-50 dark:bg-violet-500/10 dark:ring-1 dark:ring-violet-500/30 dark:shadow-[0_0_25px_rgba(139,92,246,0.25)]" },
];

export default function HowItWorks() {
  const { t } = useLanguage();
  const steps = STEPS_META.map((meta, i) => ({
    ...meta,
    title: t(`howItWorks.step${i + 1}.title`),
    desc: t(`howItWorks.step${i + 1}.desc`),
  }));

  return (
    <section id="nasil-calisir" className="px-6 md:px-12 py-24 max-w-6xl mx-auto text-center">
      <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-20">{t("howItWorks.title")}</h2>

      <div className="relative grid md:grid-cols-3 gap-16 md:gap-20">
        <div className="hidden md:block absolute top-[18px] left-[18%] right-[18%] border-t-2 border-dashed border-gray-200 dark:border-gray-700" />

        {steps.map((s, i) => (
          <div key={i} className="relative flex flex-col items-center px-2">
            <div className="w-9 h-9 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center mb-8 relative z-10 ring-4 ring-white dark:ring-gray-900 dark:shadow-[0_0_15px_rgba(59,130,246,0.5)]">
              {i + 1}
            </div>
            <div className={`w-28 h-28 rounded-3xl ${s.bg} flex items-center justify-center mb-6 shadow-sm text-5xl`}>
              {s.icon}
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white text-lg mb-3">{s.title}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-[260px] leading-relaxed">{s.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}