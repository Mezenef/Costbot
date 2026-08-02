"use client";
import { useLanguage } from "@/lib/i18n";

const FEATURES_META = [
  { icon: "💬", bg: "bg-blue-50 dark:bg-blue-500/10 dark:ring-1 dark:ring-blue-500/30 dark:shadow-[0_0_20px_rgba(59,130,246,0.25)]" },
  { icon: "📊", bg: "bg-emerald-50 dark:bg-emerald-500/10 dark:ring-1 dark:ring-emerald-500/30 dark:shadow-[0_0_20px_rgba(16,185,129,0.25)]" },
  { icon: "💡", bg: "bg-amber-50 dark:bg-amber-500/10 dark:ring-1 dark:ring-amber-500/30 dark:shadow-[0_0_20px_rgba(245,158,11,0.25)]" },
  { icon: "🛡️", bg: "bg-violet-50 dark:bg-violet-500/10 dark:ring-1 dark:ring-violet-500/30 dark:shadow-[0_0_20px_rgba(139,92,246,0.25)]" },
];

const STATS_META = [
  { icon: "⚡", bg: "bg-orange-50 dark:bg-orange-500/10 dark:ring-1 dark:ring-orange-500/30" },
  { icon: "🗄️", bg: "bg-indigo-50 dark:bg-indigo-500/10 dark:ring-1 dark:ring-indigo-500/30" },
  { icon: "🎯", bg: "bg-pink-50 dark:bg-pink-500/10 dark:ring-1 dark:ring-pink-500/30" },
];

export default function Features() {
  const { t } = useLanguage();
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
    <section id="ozellikler" className="px-6 md:px-12 py-24 max-w-6xl mx-auto">
      <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-16 text-center">{t("features.title")}</h2>

      <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6 mb-20">
        {features.map((f, i) => (
          <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-2xl p-7 hover:shadow-md dark:hover:border-gray-600 transition-shadow">
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
          <div key={i} className="flex items-center gap-4">
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