"use client";
import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { getCostForecast, formatChartDateLabel, CostForecast } from "@/lib/api";
import { useLanguage } from "@/lib/i18n";

function formatMoney(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function ChangeBadge({ pct }: { pct: number | null | undefined }) {
  if (pct === null || pct === undefined) return <span className="text-xs text-gray-400 dark:text-gray-500">—</span>;
  const up = pct >= 0;
  return (
    <span className={`text-xs font-medium ${up ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
      {up ? "↑" : "↓"} %{Math.abs(pct).toFixed(1)}
    </span>
  );
}

export default function ForecastCard() {
  const { t, locale } = useLanguage();
  const [forecast, setForecast] = useState<CostForecast | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getCostForecast(locale)
      .then(setForecast)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locale]);

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">{t("forecast.title")}</h3>

      {loading && <p className="text-sm text-gray-400 dark:text-gray-500">{t("common.loading")}</p>}

      {!loading && forecast && !forecast.available && (
        <p className="text-sm text-gray-400 dark:text-gray-500">{t("forecast.unavailable")}</p>
      )}

      {!loading && forecast && forecast.available && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">{t("forecast.estimatedMonthEnd")}</div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">{formatMoney(forecast.estimated_month_end ?? 0)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">{t("forecast.trend")}</div>
              <div className="text-lg font-bold"><ChangeBadge pct={forecast.trend_pct} /></div>
            </div>
            <div>
              <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">{t("forecast.confidence")}</div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">%{forecast.confidence_score?.toFixed(0)}</div>
            </div>
          </div>

          {forecast.chart_data && forecast.chart_data.length > 0 && (
            <div className="h-56 mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={forecast.chart_data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-gray-300 dark:text-gray-700" opacity={0.6} />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(v) => formatChartDateLabel(String(v ?? ""))} allowDuplicatedCategory={false} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => {
                    if (v >= 1000) return `$${(v / 1000).toFixed(1)}K`;
                    if (v >= 100) return `$${v.toFixed(0)}`;
                    if (v >= 1) return `$${v.toFixed(1)}`;
                    return `$${v.toFixed(2)}`;
                  }} />
                  <Tooltip formatter={(v) => (v == null ? "-" : formatMoney(Number(v)))} labelFormatter={(label) => formatChartDateLabel(String(label ?? ""))} />
                  <Line type="monotone" dataKey="actual" stroke="#2563eb" strokeWidth={2.5} dot={false} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {forecast.ai_insight && (
            <div className="bg-blue-50 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300 text-xs rounded-xl px-4 py-3 mb-4 leading-relaxed">
              {forecast.ai_insight}
            </div>
          )}

          {(forecast.top_increasing_services?.length ?? 0) > 0 && (
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">{t("forecast.topIncreasing")}</div>
                <div className="space-y-1.5">
                  {forecast.top_increasing_services!.slice(0, 3).map((s) => (
                    <div key={s.service_name} className="flex items-center justify-between text-xs">
                      <span className="text-gray-700 dark:text-gray-300 truncate">{s.service_name}</span>
                      <ChangeBadge pct={s.change_pct} />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">{t("forecast.topDecreasing")}</div>
                <div className="space-y-1.5">
                  {forecast.top_decreasing_services!.slice(0, 3).map((s) => (
                    <div key={s.service_name} className="flex items-center justify-between text-xs">
                      <span className="text-gray-700 dark:text-gray-300 truncate">{s.service_name}</span>
                      <ChangeBadge pct={s.change_pct} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}