"use client";

import { useEffect, useState, useCallback } from "react";
import { useTheme } from "next-themes";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import Sidebar from "@/components/Sidebar";
import UserMenu from "@/components/UserMenu";
import { useLanguage } from "@/lib/i18n";
import { getCostAnalyzerData, formatChartDateLabel, CostAnalyzerData } from "@/lib/api";

interface StoredUser {
  user_id: number;
  full_name: string;
  email: string;
  role: string;
}

type GroupBy = "none" | "service" | "resource_group" | "region" | "category";
type Granularity = "day" | "week" | "month";

const STACK_COLORS = [
  "#7C3AED", "#8B5CF6", "#A78BFA", "#C4B5FD", "#DDD6FE",
  "#6D28D9", "#5B21B6", "#4C1D95", "#E9D5FF",
];

function formatMoney(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function CostAnalyzerPage() {
  const { theme, setTheme } = useTheme();
  const { t, locale } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [data, setData] = useState<CostAnalyzerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [groupBy, setGroupBy] = useState<GroupBy>("service");
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [duration, setDuration] = useState<"today" | "7d" | "30d" | "this_month" | "3m" | "all">("30d");
  const [chartView, setChartView] = useState<"bar" | "line" | "donut">("bar");
  const [filterService, setFilterService] = useState("");
  const [filterResourceGroup, setFilterResourceGroup] = useState("");
  const [filterRegion, setFilterRegion] = useState("");
  const [sortDesc, setSortDesc] = useState(true);

  useEffect(() => {
    setMounted(true);
    const raw = localStorage.getItem("costbot_user");
    if (raw) setUser(JSON.parse(raw));
  }, []);

  const loadData = useCallback(() => {
    setLoading(true);
    setError("");

    let startDate: string | undefined;
    if (duration === "today") {
      startDate = new Date().toISOString().slice(0, 10);
    } else if (duration === "this_month") {
      const d = new Date();
      startDate = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
    } else if (duration !== "all") {
      const days = duration === "7d" ? 7 : duration === "30d" ? 30 : 90;
      const d = new Date();
      d.setDate(d.getDate() - days);
      startDate = d.toISOString().slice(0, 10);
    }

    getCostAnalyzerData({
      groupBy,
      granularity,
      startDate,
      filterService: filterService || undefined,
      filterResourceGroup: filterResourceGroup || undefined,
      filterRegion: filterRegion || undefined,
      language: locale,
    })
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Bir hata oluştu."))
      .finally(() => setLoading(false));
  }, [groupBy, granularity, duration, filterService, filterResourceGroup, filterRegion, locale]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeFilters = [
    filterService && { key: "service", label: `${t("costAnalyzer.service")}: ${filterService}`, clear: () => setFilterService("") },
    filterResourceGroup && { key: "rg", label: `${t("costAnalyzer.resourceGroup")}: ${filterResourceGroup}`, clear: () => setFilterResourceGroup("") },
    filterRegion && { key: "region", label: `${t("costAnalyzer.region")}: ${filterRegion}`, clear: () => setFilterRegion("") },
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[];

  const sortedTableRows = data ? [...data.table_rows].sort((a, b) => (sortDesc ? b.total - a.total : a.total - b.total)) : [];

  const GROUP_BY_OPTIONS: { value: GroupBy; label: string }[] = [
    { value: "none", label: t("costAnalyzer.noGrouping") },
    { value: "service", label: t("costAnalyzer.byService") },
    { value: "resource_group", label: t("costAnalyzer.byResourceGroup") },
    { value: "region", label: t("costAnalyzer.byRegion") },
    { value: "category", label: t("costAnalyzer.byCategory") },
  ];

  const GRANULARITY_OPTIONS: { value: Granularity; label: string }[] = [
    { value: "day", label: t("dashboard.timeframeDaily") },
    { value: "week", label: t("reports.periodWeek") },
    { value: "month", label: t("reports.periodMonth") },
  ];

  const DURATION_OPTIONS = [
    { value: "today", label: t("dashboard.timeframeDaily") },
    { value: "7d", label: t("costAnalyzer.last7Days") },
    { value: "30d", label: t("costAnalyzer.last30Days") },
    { value: "this_month", label: t("dashboard.timeframeThisMonth") },
    { value: "3m", label: t("dashboard.timeframe3m") },
    { value: "all", label: t("dashboard.timeframeAll") },
  ] as const;

  return (
    <div className="flex bg-gray-50 dark:bg-gray-950 min-h-screen">
      <Sidebar pendingCount={0} userName={user?.full_name} userRole={user?.role} />

      <div className="flex-1 min-w-0">
        <header className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-3.5">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 flex items-center justify-center text-sm">🔍</span>
            <div>
              <h1 className="font-semibold text-gray-900 dark:text-white text-sm">{t("costAnalyzer.title")}</h1>
              <p className="text-xs text-gray-400 dark:text-gray-500">{t("costAnalyzer.subtitle")}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Tema değiştir"
              className="w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm"
            >
              {mounted && (theme === "dark" ? "☀️" : "🌙")}
            </button>
            <UserMenu userName={user?.full_name} userRole={user?.role} />
          </div>
        </header>

        <main className="p-6 grid lg:grid-cols-[1fr_280px] gap-5">
          {/* ---- Sol/orta: kontrol çubuğu + grafik + tablo ---- */}
          <div className="min-w-0 space-y-5">
            {/* Group By + Süre + Granularity çubuğu */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">{t("costAnalyzer.groupBy")}</span>
                <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
                  {GROUP_BY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setGroupBy(opt.value)}
                      className={`text-xs px-3 py-1.5 rounded-md transition ${
                        groupBy === opt.value
                          ? "bg-violet-600 text-white shadow-sm"
                          : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">{t("costAnalyzer.duration")}</span>
                <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
                  {DURATION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setDuration(opt.value)}
                      className={`text-xs px-3 py-1.5 rounded-md transition ${
                        duration === opt.value
                          ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                          : "text-gray-400 dark:text-gray-500"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">{t("costAnalyzer.granularity")}</span>
                <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
                  {GRANULARITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setGranularity(opt.value)}
                      className={`text-xs px-3 py-1.5 rounded-md transition ${
                        granularity === opt.value
                          ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                          : "text-gray-400 dark:text-gray-500"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Aktif filtre chip'leri */}
            {activeFilters.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {activeFilters.map((f) => (
                  <span
                    key={f.key}
                    className="inline-flex items-center gap-1.5 text-xs bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 rounded-full pl-3 pr-1.5 py-1.5 border border-violet-100 dark:border-violet-500/20"
                  >
                    {f.label}
                    <button
                      onClick={f.clear}
                      className="w-4 h-4 rounded-full hover:bg-violet-200 dark:hover:bg-violet-500/30 flex items-center justify-center"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}

            {error && (
              <div className="bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            {/* Özet + grafik */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
              {data && (
                <div className="flex items-start justify-between flex-wrap gap-4 mb-4">
                <div className="flex items-baseline gap-6 flex-wrap">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 font-medium">
                      {t("costAnalyzer.queryTotalCost")}
                    </div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{formatMoney(data.total_cost)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 font-medium">
                      {t("costAnalyzer.avgDailyCost")}
                    </div>
                    <div className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                      {formatMoney(data.chart_data.length ? data.total_cost / data.chart_data.length : 0)}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
                  <button
                    onClick={() => setChartView("bar")}
                    className={`text-xs px-2.5 py-1.5 rounded-md transition ${
                      chartView === "bar" ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-400 dark:text-gray-500"
                    }`}
                  >
                    📊
                  </button>
                  <button
                    onClick={() => setChartView("line")}
                    className={`text-xs px-2.5 py-1.5 rounded-md transition ${
                      chartView === "line" ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-400 dark:text-gray-500"
                    }`}
                  >
                    📈
                  </button>
                  <button
                    onClick={() => setChartView("donut")}
                    className={`text-xs px-2.5 py-1.5 rounded-md transition ${
                      chartView === "donut" ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-400 dark:text-gray-500"
                    }`}
                  >
                    ⭕
                  </button>
                </div>
                </div>
              )}

              {loading && <p className="text-sm text-gray-400 dark:text-gray-500 py-10 text-center">{t("common.loading")}</p>}

              {!loading && data && chartView === "bar" && (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.chart_data} barCategoryGap="10%">
                      <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-gray-200 dark:text-gray-800" opacity={0.6} />
                      <XAxis
                        dataKey="period"
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v) => formatChartDateLabel(String(v ?? ""))}
                        allowDuplicatedCategory={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v: number) => {
                          if (v >= 1000) return `$${(v / 1000).toFixed(1)}K`;
                          if (v >= 100) return `$${v.toFixed(0)}`;
                          return `$${v.toFixed(1)}`;
                        }}
                      />
                      <Tooltip
                        formatter={(v) => formatMoney(Number(v))}
                        labelFormatter={(label) => formatChartDateLabel(String(label ?? ""))}
                        contentStyle={{ fontSize: 11, borderRadius: 8 }}
                      />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      {data.groups.map((g, i) => (
                        <Bar
                          key={g}
                          dataKey={g}
                          stackId="a"
                          fill={STACK_COLORS[i % STACK_COLORS.length]}
                          isAnimationActive={true}
                          animationDuration={700}
                          radius={i === data.groups.length - 1 ? [4, 4, 0, 0] : undefined}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {!loading && data && chartView === "line" && (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.chart_data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-gray-200 dark:text-gray-800" opacity={0.6} />
                      <XAxis
                        dataKey="period"
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v) => formatChartDateLabel(String(v ?? ""))}
                        allowDuplicatedCategory={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v: number) => {
                          if (v >= 1000) return `$${(v / 1000).toFixed(1)}K`;
                          if (v >= 100) return `$${v.toFixed(0)}`;
                          return `$${v.toFixed(1)}`;
                        }}
                      />
                      <Tooltip
                        formatter={(v) => formatMoney(Number(v))}
                        labelFormatter={(label) => formatChartDateLabel(String(label ?? ""))}
                        contentStyle={{ fontSize: 11, borderRadius: 8 }}
                      />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      {data.groups.map((g, i) => (
                        <Line
                          key={g}
                          type="monotone"
                          dataKey={g}
                          stroke={STACK_COLORS[i % STACK_COLORS.length]}
                          strokeWidth={2}
                          dot={false}
                          isAnimationActive={true}
                          animationDuration={700}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {!loading && data && chartView === "donut" && (
                <div className="h-80 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.table_rows.slice(0, 8)}
                        dataKey="total"
                        nameKey="group"
                        innerRadius={70}
                        outerRadius={110}
                        paddingAngle={3}
                        cornerRadius={3}
                        stroke="none"
                        isAnimationActive={true}
                        animationDuration={700}
                      >
                        {data.table_rows.slice(0, 8).map((_, i) => (
                          <Cell key={i} fill={STACK_COLORS[i % STACK_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => formatMoney(Number(v))} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ paddingBottom: 40 }}>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">{t("costAnalyzer.queryTotalCost")}</span>
                    <span className="text-base font-bold text-gray-900 dark:text-white">{formatMoney(data.total_cost)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Tablo */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t("costAnalyzer.tabularData")}</h3>
                {data && (
                  <span className="text-[10px] font-bold bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-400 rounded-full px-2 py-0.5">
                    {data.table_rows.length}
                  </span>
                )}
              </div>
              {!loading && data && (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800">
                      <th className="text-left font-medium px-5 py-3">{t("costAnalyzer.group")}</th>
                      <th
                        className="text-right font-medium px-5 py-3 cursor-pointer select-none"
                        onClick={() => setSortDesc((v) => !v)}
                      >
                        {t("costAnalyzer.totalCost")} {sortDesc ? "↓" : "↑"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTableRows.map((row) => (
                      <tr key={row.group} className="border-b border-gray-50 dark:border-gray-800/50 last:border-0">
                        <td className="px-5 py-2.5 text-gray-700 dark:text-gray-300 truncate max-w-[240px]">{row.group || "—"}</td>
                        <td className="px-5 py-2.5 text-right text-gray-900 dark:text-white font-medium">{formatMoney(row.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* ---- Sağ: Kontrol paneli (filtreler) ---- */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 h-fit sticky top-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">{t("costAnalyzer.controls")}</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  {t("costAnalyzer.service")}
                </label>
                <select
                  value={filterService}
                  onChange={(e) => setFilterService(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="">{t("costAnalyzer.allValues")}</option>
                  {data?.filter_options.services.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  {t("costAnalyzer.resourceGroup")}
                </label>
                <select
                  value={filterResourceGroup}
                  onChange={(e) => setFilterResourceGroup(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="">{t("costAnalyzer.allValues")}</option>
                  {data?.filter_options.resource_groups.filter(Boolean).map((rg) => (
                    <option key={rg} value={rg}>{rg}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  {t("costAnalyzer.region")}
                </label>
                <select
                  value={filterRegion}
                  onChange={(e) => setFilterRegion(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="">{t("costAnalyzer.allValues")}</option>
                  {data?.filter_options.regions.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {activeFilters.length > 0 && (
                <button
                  onClick={() => { setFilterService(""); setFilterResourceGroup(""); setFilterRegion(""); }}
                  className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline"
                >
                  {t("costAnalyzer.clearFilters")}
                </button>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}