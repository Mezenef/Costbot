"use client";
import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { getServiceBreakdownByPeriod, formatChartDateLabel, ServiceBreakdownByPeriod } from "@/lib/api";
import { useLanguage } from "@/lib/i18n";

const STACK_COLORS = ["#0e2869", "#1e40af", "#2563eb", "#3b82f6", "#93c5fd", "#e0f2fe"];

function formatMoney(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function MonthlyServiceChart() {
  const { t, locale } = useLanguage();
  const [granularity, setGranularity] = useState<"month" | "week">("month");
  const [breakdown, setBreakdown] = useState<ServiceBreakdownByPeriod | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getServiceBreakdownByPeriod(granularity, locale)
      .then(setBreakdown)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [granularity, locale]);

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t("dashboard.periodByService")}</h3>
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
          <button
            onClick={() => setGranularity("month")}
            className={`text-xs px-2.5 py-1 rounded-md transition ${
              granularity === "month" ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-400 dark:text-gray-500"
            }`}
          >
            {t("dashboard.monthly")}
          </button>
          <button
            onClick={() => setGranularity("week")}
            className={`text-xs px-2.5 py-1 rounded-md transition ${
              granularity === "week" ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-400 dark:text-gray-500"
            }`}
          >
            {t("dashboard.weekly")}
          </button>
        </div>
      </div>
      {loading && <p className="text-sm text-gray-400">{t("common.loading")}</p>}
      {breakdown && (
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={breakdown.data} barCategoryGap="12%" margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-gray-300 dark:text-gray-700" opacity={0.6} />
              <XAxis dataKey="period" tick={{ fontSize: 12 }} tickFormatter={formatChartDateLabel} />
              <YAxis tick={{ fontSize: 12 }} tickCount={11} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`} />
              <Tooltip
                formatter={(v) => formatMoney(Number(v))}
                labelFormatter={formatChartDateLabel}
                contentStyle={{ fontSize: 11, padding: "6px 10px", borderRadius: 8 }}
                itemStyle={{ padding: "1px 0" }}
                labelStyle={{ fontSize: 10, marginBottom: 2 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {breakdown.services.map((svc, i) => (
                <Bar
                  key={svc}
                  dataKey={svc}
                  stackId="a"
                  fill={STACK_COLORS[i % STACK_COLORS.length]}
                  isAnimationActive={true}
                  animationDuration={900}
                  radius={i === breakdown.services.length - 1 ? [6, 6, 0, 0] : undefined}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}