"use client";
import { useLanguage } from "@/lib/i18n";

const STEPS_META = [
  { bg: "#C9BFF0", textColor: "#3B1D82", icon: "💬" },
  { bg: "#DDD5F5", textColor: "#5B21B6", icon: "🧠" },
  { bg: "#EEE9FB", textColor: "#6D28D9", icon: "📈" },
];

export default function HowItWorks() {
  const { t } = useLanguage();
  const steps = STEPS_META.map((meta, i) => ({
    ...meta,
    title: t(`howItWorks.step${i + 1}.title`),
    desc: t(`howItWorks.step${i + 1}.desc`),
  }));

  return (
    <section id="nasil-calisir" className="px-6 md:px-12 py-24 bg-[#F5F5F7] dark:bg-gray-950">
      <div className="max-w-6xl mx-auto grid md:grid-cols-5 gap-10 items-center">
        {/* Sol: baslik */}
        <div className="md:col-span-2">
          <h2 className="text-3xl md:text-4xl font-medium text-gray-900 dark:text-white leading-tight mb-6">
            {t("howItWorks.title")}
          </h2>
          <p className="text-[#6B6B76] dark:text-gray-400 leading-relaxed">
            {t("howItWorks.subtitle")}
          </p>
        </div>

        {/* Sag: 3 adimdan olusan dikey bant */}
        <div className="md:col-span-3 rounded-3xl overflow-hidden">
          {steps.map((s, i) => (
            <div
              key={i}
              className="flex items-center gap-5 px-8 py-7"
              style={{ background: s.bg }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{ background: "rgba(255,255,255,0.55)" }}
              >
                {s.icon}
              </div>
              <div>
                <div className="mb-1">
                  <h3 className="font-semibold text-base" style={{ color: s.textColor }}>
                    {s.title}
                  </h3>
                </div>
                <p className="text-sm leading-snug" style={{ color: s.textColor, opacity: 0.75 }}>
                  {s.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}