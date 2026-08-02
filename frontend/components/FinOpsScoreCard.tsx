"use client";
import { useEffect, useState } from "react";
import { getFinOpsScore, FinOpsScore } from "@/lib/api";
import { useLanguage } from "@/lib/i18n";

function scoreColor(score: number) {
  if (score >= 70) return { text: "text-green-600 dark:text-green-400", bg: "bg-green-500", track: "bg-green-100 dark:bg-green-500/10" };
  if (score >= 40) return { text: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500", track: "bg-amber-100 dark:bg-amber-500/10" };
  return { text: "text-red-600 dark:text-red-400", bg: "bg-red-500", track: "bg-red-100 dark:bg-red-500/10" };
}

export default function FinOpsScoreCard() {
  const { t, locale } = useLanguage();
  const [data, setData] = useState<FinOpsScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ user_id: number } | null>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("costbot_user");
    if (raw) setUser(JSON.parse(raw));
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    getFinOpsScore(locale, user.user_id)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locale, user]);

  if (loading || !data) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
        <p className="text-sm text-gray-400 dark:text-gray-500">{t("common.loading")}</p>
      </div>
    );
  }

  const colors = scoreColor(data.score);

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t("finops.title")}</h3>
        <div className="flex items-baseline gap-1">
          <span className={`text-2xl font-bold ${colors.text}`}>{data.score}</span>
          <span className="text-xs text-gray-400 dark:text-gray-500">/100</span>
        </div>
      </div>

      <div className={`h-1.5 rounded-full ${colors.track} overflow-hidden mb-5`}>
        <div className={`h-full rounded-full ${colors.bg} transition-all duration-700`} style={{ width: `${data.score}%` }} />
      </div>

      <div className="space-y-1">
        {data.checks.map((c, i) => (
          <div key={i}>
            <button
              onClick={() => c.details.length > 0 && setOpenIndex(openIndex === i ? null : i)}
              className={`w-full flex items-center gap-2 py-1.5 text-left ${c.details.length > 0 ? "cursor-pointer" : "cursor-default"}`}
            >
              <span className={c.ok ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}>
                {c.ok ? "✓" : "⚠"}
              </span>
              <span className="text-xs text-gray-700 dark:text-gray-300 flex-1">{c.label}</span>
              {c.details.length > 0 && (
                <span className="text-[10px] text-gray-400 dark:text-gray-500">{openIndex === i ? "▾" : "▸"}</span>
              )}
            </button>
            {openIndex === i && c.details.length > 0 && (
              <div className="pl-6 pb-2 space-y-1">
                {c.details.map((d, j) => (
                  <div key={j} className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                    <span className="truncate">{d.name}</span>
                    <span className="flex-shrink-0 ml-2">${d.cost.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}