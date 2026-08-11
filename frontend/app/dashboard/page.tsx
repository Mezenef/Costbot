"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import Sidebar from "@/components/Sidebar";
import {
  getDashboardSummary,
  getDashboardPeriodSummary,
  getRecommendations,
  getReportDownloadUrl,
  formatDateDMY,
  formatChartDateLabel,
  DashboardSummary,
  DashboardTimeframe,
  Recommendation,
} from "@/lib/api";

import UserMenu from "@/components/UserMenu";
import { useLanguage } from "@/lib/i18n";
import ResourceGroupPanel from "@/components/ResourceGroupPanel";
import CollapsibleCard from "@/components/CollapsibleCard";
import ForecastCard from "@/components/ForecastCard";
import FinOpsScoreCard from "@/components/FinOpsScoreCard";

interface StoredUser {
  user_id: number;
  full_name: string;
  email: string;
  role: string;
}

const PIE_COLORS = [
  "#7C3AED",
  "#A855F7",
  "#C4B5FD",
  "#DDD6FE",
  "#E9D5FF",
  "#F3E8FF",
];

function formatMoney(n: number) {
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// light=true -> gradyanli ozet kartlarinin icinde kullanilir; acik temada
// koyu (okunakli) renkler, koyu temada beyaz renkler otomatik uygulanir.
function ChangeBadge({ pct, light, dark }: { pct: number | null; light?: boolean; dark?: boolean }) {
  if (pct === null)
    return (
      <span className={`text-xs ${dark ? "text-black/60" : light ? "text-gray-500 dark:text-white/70" : "text-gray-400 dark:text-gray-500"}`}>
        —
      </span>
    );
  const displayPct = Math.abs(pct) < 1 ? Math.abs(pct).toFixed(2) : Math.abs(pct).toFixed(1);
  const up = pct >= 0;
  if (dark) {
    return (
      <span className="text-xs font-medium text-black">
        {up ? "↑" : "↓"} %{displayPct}
      </span>
    );
  }
  if (light) {
    return (
      <span
        className={`text-xs font-medium ${
          up ? "text-red-700 dark:text-white" : "text-emerald-700 dark:text-white"
        }`}
      >
        {up ? "↑" : "↓"} %{displayPct}
      </span>
    );
  }
  return (
    <span
      className={`text-xs font-medium ${
        up
          ? "text-red-600 dark:text-red-400"
          : "text-green-600 dark:text-green-400"
      }`}
    >
      {up ? "↑" : "↓"} %{displayPct}
    </span>
  );
}

function getComparisonLabel(
  timeframe: DashboardTimeframe,
  t: (key: string) => string
): string {
  const map: Record<DashboardTimeframe, string> = {
    daily: t("dashboard.vsPreviousDaily"),
    "30d": t("dashboard.vsPrevious30d"),
    this_month: t("dashboard.vsPreviousThisMonth"),
    "3m": t("dashboard.vsPrevious3m"),
    "6m": t("dashboard.vsPrevious6m"),
    "12m": t("dashboard.vsPrevious12m"),
    all: "",
  };
  return map[timeframe];
}

function getPeriodChangeText(
  data: DashboardSummary,
  timeframe: DashboardTimeframe,
  t: (key: string, vars?: Record<string, string>) => string
): string {
  if (data.cost_change_pct === null || timeframe === "all") {
    return t("dashboard.noComparisonData");
  }
  const comparisonLabel = getComparisonLabel(timeframe, t);
  const direction =
    data.cost_change_pct >= 0
      ? t("dashboard.increased")
      : t("dashboard.decreased");
  return t("dashboard.periodChangeGeneric", {
    pct: Math.abs(data.cost_change_pct).toFixed(1),
    direction,
    comparison: comparisonLabel,
  });
}

export default function DashboardPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { t, locale } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [trendChartType, setTrendChartType] = useState<"line" | "bar">("line");
  const [distributionChartType, setDistributionChartType] = useState<"donut" | "bar">("donut");
  const [timeframe, setTimeframe] = useState<DashboardTimeframe>("this_month");

  useEffect(() => {
    setMounted(true);
    const raw = localStorage.getItem("costbot_user");
    const parsedUser = raw ? JSON.parse(raw) : null;
    if (parsedUser) setUser(parsedUser);
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem("costbot_user");
    const parsedUser = raw ? JSON.parse(raw) : null;
    setLoading(true);

    Promise.all([
      getDashboardPeriodSummary(timeframe, locale, parsedUser?.user_id),
      getRecommendations(parsedUser?.user_id ?? 0, "Beklemede"),
    ])
      .then(([summary, pendingRecs]) => {
        setData(summary);
        setRecs(pendingRecs.slice(0, 3));
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Bir hata oluştu.")
      )
      .finally(() => setLoading(false));
  }, [locale, timeframe]);

  function handleLogout() {
    localStorage.removeItem("costbot_user");
    localStorage.removeItem("costbot_session_id");
    router.push("/");
  }

  const maxGroupCost = data
    ? Math.max(...data.top_resource_groups.map((g) => g.total), 1)
    : 1;

  return (
    <div className="flex bg-[#F0FAF9] dark:bg-gray-950 min-h-screen">
      <Sidebar
        pendingCount={data?.pending_recommendations ?? 0}
        userName={user?.full_name}
        userRole={user?.role}
        userEmail={user?.email}
      />

      <div className="flex-1 min-w-0">
        <header className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-3.5">
          <div>
            <h1 className="font-semibold text-gray-900 dark:text-white text-sm">
              {t("dashboard.title")}
            </h1>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {t("dashboard.subtitle")}
            </p>
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

        <main className="p-6">
          {loading && (
            <p className="text-sm text-gray-400 dark:text-gray-500">
              {t("common.loading")}
            </p>
          )}
          {error && (
            <div className="bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 text-sm rounded-xl px-4 py-3 mb-4">
              {error}
            </div>
          )}

          {data && (
            <>
              <div
                className="rounded-2xl p-5 mb-6 flex items-center justify-between flex-wrap gap-4 border dark:from-purple-500/10 dark:to-violet-500/10 dark:bg-gradient-to-r dark:border-purple-500/20"
                style={{ background: "linear-gradient(90deg, #F3EDFF, #F3EDFF)", borderColor: "rgba(168,85,247,0.2)" }}
              >
                <div>
                  <h2 className="font-semibold text-gray-900">
                    {t("dashboard.greeting", {
                      name: user?.full_name?.split(" ")[0] || "",
                    })}{" "}
                    👋
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {getPeriodChangeText(data, timeframe, t)}
                  </p>
                </div>
                {data.potential_savings > 0 && (
                  <div className="bg-white dark:bg-gray-900 rounded-xl px-4 py-3 border border-gray-100 dark:border-gray-800">
                    <div className="text-xs text-gray-400 dark:text-gray-500">
                      {t("dashboard.savingsOpportunity")}
                    </div>
                    <div className="text-lg font-bold text-green-600 dark:text-green-400">
                      {formatMoney(data.potential_savings)} /{" "}
                      {t("dashboard.trackedResources").includes("month")
                        ? "mo"
                        : "ay"}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {/* Güncel Aylık Maliyet -- mavi */}
                <div className="bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-500/80 dark:to-blue-700/80 rounded-2xl p-5 shadow-sm border border-blue-200/60 dark:border-blue-500/20">
                  <div className="text-xs text-black/70 mb-1">
                    {t("dashboard.currentMonthCost")}
                  </div>
                  <div className="text-xl font-bold text-black">
                    {formatMoney(data.total_cost)}
                  </div>
                  <div className="mt-1 flex items-center flex-wrap gap-x-1.5 gap-y-0.5">
                    <ChangeBadge pct={data.cost_change_pct} dark />
                    <span className="text-xs text-black/70">
                      {getComparisonLabel(timeframe, t)}
                    </span>
                  </div>
                </div>

                {/* Bugünkü Maliyet -- mor (soluk) */}
                <div
                  className="rounded-2xl p-5 shadow-sm border"
                  style={{
                    background: "linear-gradient(135deg, #8ab8f3, #8981f5)",
                    borderColor: "rgba(168,85,247,0.25)",
                  }}
                >
                  <div className="text-xs text-black/70 mb-1 flex items-center gap-1">
                    {t("dashboard.todayCost")}
                    {data.today_data_may_be_incomplete && (
                      <span
                        className="relative group cursor-help flex items-center"
                        style={{ color: "#ee3636" }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                          <line x1="12" y1="9" x2="12" y2="13" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block whitespace-nowrap bg-gray-900 text-white text-[11px] rounded-lg px-2.5 py-1.5 z-20 shadow-lg">
                          {formatDateDMY(data.today_date)} tarihli veri henüz güncelleniyor olabilir
                        </span>
                      </span>
                    )}
                  </div>
                  <div className="text-xl font-bold text-black">
                    {formatMoney(data.today_cost)}
                  </div>
                  <div className="text-xs text-black/70 mt-1">
                    {formatDateDMY(data.today_date)}
                  </div>
                  
                </div>

                {/* Potansiyel Tasarruf -- indigo, bekleyen öneri sayısı içinde */}
                <a
                  href="/recommendations"
                  className="block rounded-2xl p-5 shadow-sm border cursor-pointer hover:brightness-110 transition"
                  style={{
                    background: "linear-gradient(135deg, rgb(131, 150, 235), #63d0f1)",
                    borderColor: "rgba(99,102,241,0.3)",
                  }}
                >
                  <div className="text-xs text-black/70 mb-1">
                    {t("dashboard.potentialSavings")}
                  </div>
                  <div className="text-xl font-bold text-black">
                    {formatMoney(data.potential_savings)}
                  </div>
                  <div className="text-xs text-black/70 mt-1">
                    {data.pending_recommendations} {t("dashboard.pendingRecs")}
                  </div>
                </a>

                {/* Kaynaklar -- mor-mavi arası (violet) */}
                <a
                  href="/resources"
                  className="block rounded-2xl p-5 shadow-sm border cursor-pointer hover:brightness-110 transition"
                  style={{
                    background: "linear-gradient(135deg, #4fb3da, #198daa)",
                    borderColor: "rgba(139,92,246,0.3)",
                  }}
                >
                  <div className="text-xs text-black/70 mb-1">
                    {t("dashboard.resources")}
                  </div>
                  <div className="text-xl font-bold text-black">
                    {data.resource_count}
                  </div>
                  <div className="text-xs text-black/70 mt-1">
                    {data.service_count ?? 0} servis · {data.group_count ?? 0} grup
                  </div>
                </a>
              </div>
              <div className="grid lg:grid-cols-3 gap-4 mb-6">
                <div className="lg:col-span-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                      {t("dashboard.costTrend")}
                    </h3>
                    <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
                      <button
                        onClick={() => setTrendChartType("line")}
                        className={`text-xs px-2.5 py-1 rounded-md transition ${
                          trendChartType === "line"
                            ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                            : "text-gray-400 dark:text-gray-500"
                        }`}
                      >
                        📈
                      </button>
                      <button
                        onClick={() => setTrendChartType("bar")}
                        className={`text-xs px-2.5 py-1 rounded-md transition ${
                          trendChartType === "bar"
                            ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                            : "text-gray-400 dark:text-gray-500"
                        }`}
                      >
                        📊
                      </button>
                    </div>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      {trendChartType === "line" ? (
                        <LineChart data={data.trend}>
                          <defs>
                            <linearGradient
                              id="trendFill"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="0%"
                                stopColor="#3b82f6"
                                stopOpacity={0.3}
                              />
                              <stop
                                offset="100%"
                                stopColor="#3b82f6"
                                stopOpacity={0}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="currentColor"
                            className="text-gray-300 dark:text-gray-700"
                            opacity={0.6}
                          />
                          <XAxis
                            dataKey="month"
                            tick={{ fontSize: 11 }}
                            tickFormatter={formatChartDateLabel}
                            allowDuplicatedCategory={false}
                          />
                          <YAxis
                            tick={{ fontSize: 11 }}
                            tickFormatter={(v) => {
                              if (v >= 1000) return `$${(v / 1000).toFixed(1)}K`;
                              if (v >= 100) return `$${v.toFixed(0)}`;
                              if (v >= 1) return `$${v.toFixed(1)}`;
                              return `$${v.toFixed(2)}`;
                            }}
                          />
                          <Tooltip
                            formatter={(v) => formatMoney(Number(v))}
                            labelFormatter={(label) =>
                              formatChartDateLabel(String(label ?? ""))
                            }
                          />
                          <Line
                            type="monotone"
                            dataKey="total"
                            stroke="#3b82f6"
                            strokeWidth={2.5}
                            dot={{ r: 3, fill: "#3b82f6", strokeWidth: 0 }}
                            activeDot={{ r: 5, fill: "#3b82f6" }}
                            isAnimationActive={true}
                            animationDuration={900}
                            animationEasing="ease-in-out"
                            fill="url(#trendFill)"
                          />
                        </LineChart>
                      ) : (
                        <BarChart data={data.trend}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="currentColor"
                            className="text-gray-300 dark:text-gray-700"
                            opacity={0.6}
                          />
                          <XAxis
                            dataKey="month"
                            tick={{ fontSize: 11 }}
                            tickFormatter={formatChartDateLabel}
                            allowDuplicatedCategory={false}
                          />
                          <YAxis
                            tick={{ fontSize: 11 }}
                            tickFormatter={(v) => {
                              if (v >= 1000) return `$${(v / 1000).toFixed(1)}K`;
                              if (v >= 100) return `$${v.toFixed(0)}`;
                              if (v >= 1) return `$${v.toFixed(1)}`;
                              return `$${v.toFixed(2)}`;
                            }}
                          />
                          <Tooltip
                            formatter={(v) => formatMoney(Number(v))}
                            labelFormatter={(label) =>
                              formatChartDateLabel(String(label ?? ""))
                            }
                          />
                          <Bar
                            dataKey="total"
                            fill="#3b82f6"
                            radius={[6, 6, 0, 0]}
                            isAnimationActive={true}
                            animationDuration={900}
                          />
                        </BarChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                      {t("dashboard.serviceDistribution")}
                    </h3>
                    <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
                      <button
                        onClick={() => setDistributionChartType("donut")}
                        className={`text-xs px-2.5 py-1 rounded-md transition ${
                          distributionChartType === "donut"
                            ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                            : "text-gray-400 dark:text-gray-500"
                        }`}
                      >
                        ⭕
                      </button>
                      <button
                        onClick={() => setDistributionChartType("bar")}
                        className={`text-xs px-2.5 py-1 rounded-md transition ${
                          distributionChartType === "bar"
                            ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                            : "text-gray-400 dark:text-gray-500"
                        }`}
                      >
                        📊
                      </button>
                    </div>
                  </div>
                  <div className="h-40 mb-3 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      {distributionChartType === "donut" ? (
                        <PieChart>
                          <defs>
                            {PIE_COLORS.map((color, i) => (
                              <linearGradient
                                key={i}
                                id={`pieGrad${i}`}
                                x1="0"
                                y1="0"
                                x2="1"
                                y2="1"
                              >
                                <stop
                                  offset="0%"
                                  stopColor={color}
                                  stopOpacity={1}
                                />
                                <stop
                                  offset="100%"
                                  stopColor={color}
                                  stopOpacity={0.65}
                                />
                              </linearGradient>
                            ))}
                            <filter
                              id="pieShadow"
                              x="-20%"
                              y="-20%"
                              width="140%"
                              height="140%"
                            >
                              <feDropShadow
                                dx="0"
                                dy="2"
                                stdDeviation="3"
                                floodColor="#000"
                                floodOpacity="0.15"
                              />
                            </filter>
                          </defs>
                          <Pie
                            data={data.service_breakdown}
                            dataKey="total"
                            nameKey="name"
                            innerRadius={44}
                            outerRadius={68}
                            paddingAngle={4}
                            cornerRadius={3}
                            stroke="none"
                            filter="url(#pieShadow)"
                            isAnimationActive={true}
                            animationDuration={900}
                            animationEasing="ease-in-out"
                          >
                            {data.service_breakdown.map((_, i) => (
                              <Cell
                                key={i}
                                fill={`url(#pieGrad${i % PIE_COLORS.length})`}
                              />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v) => formatMoney(Number(v))} />
                        </PieChart>
                      ) : (
                        <BarChart
                          data={data.service_breakdown}
                          layout="vertical"
                          margin={{ left: 8 }}
                        >
                          <XAxis
                            type="number"
                            tick={{ fontSize: 10 }}
                            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
                          />
                          <YAxis
                            type="category"
                            dataKey="name"
                            tick={{ fontSize: 10 }}
                            width={90}
                          />
                          <Tooltip formatter={(v) => formatMoney(Number(v))} />
                          <Bar
                            dataKey="total"
                            radius={[0, 6, 6, 0]}
                            isAnimationActive={true}
                            animationDuration={900}
                          >
                            {data.service_breakdown.map((_, i) => (
                              <Cell
                                key={i}
                                fill={PIE_COLORS[i % PIE_COLORS.length]}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      )}
                    </ResponsiveContainer>
                    {distributionChartType === "donut" && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-[10px] text-gray-400 dark:text-gray-500">
                          {t("dashboard.totalCost")}
                        </span>
                        <span className="text-sm font-bold text-gray-900 dark:text-white">
                          {formatMoney(data.total_cost)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {data.service_breakdown.map((s, i) => (
                      <div
                        key={s.name}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="flex items-center gap-2 text-gray-600 dark:text-gray-300 truncate">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{
                              background: PIE_COLORS[i % PIE_COLORS.length],
                            }}
                          />
                          {s.name}
                        </span>
                        <span className="text-gray-400 dark:text-gray-500 flex-shrink-0">
                          %{s.pct}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid lg:grid-cols-3 gap-4 items-start">
                <CollapsibleCard title={t("dashboard.topResourceGroups")} accentColor="blue">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800">
                        <th className="text-left font-medium pb-2">
                          {t("dashboard.group")}
                        </th>
                        <th className="text-right font-medium pb-2">
                          {t("dashboard.cost")}
                        </th>
                        <th className="text-right font-medium pb-2">
                          {t("dashboard.change")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.top_resource_groups.map((g) => (
                        <tr
                          key={g.resource_group}
                          onClick={() => setSelectedGroup(g.resource_group)}
                          className="border-b border-gray-50 dark:border-gray-800/50 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors cursor-pointer"
                        >
                          <td className="py-2 text-gray-700 dark:text-gray-300 truncate max-w-[100px]">
                            {g.resource_group}
                          </td>
                          <td className="py-2 text-right relative overflow-hidden">
                            <div
                              className="absolute inset-y-0 right-0 bg-blue-100 dark:bg-blue-500/20 transition-all duration-700 ease-out"
                              style={{
                                width: `${(g.total / maxGroupCost) * 100}%`,
                              }}
                            />
                            <span className="relative text-gray-900 dark:text-white font-medium">
                              {formatMoney(g.total)}
                            </span>
                          </td>
                          <td className="py-2 text-right">
                            <ChangeBadge pct={g.change_pct} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CollapsibleCard>

                <CollapsibleCard
                  title={t("dashboard.aiInsights")}
                  badge={recs.length > 0 ? recs.length : undefined}
                  accentColor="purple"
                >
                  <a
                    href="/recommendations"
                    className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline block mb-3"
                  >
                    {t("dashboard.viewAll")}
                  </a>
                  {recs.length === 0 ? (
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {t("dashboard.noRecsYet")}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {recs.map((r) => (
                        <div
                          key={r.RecommendationId}
                          className="flex items-start justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                              {r.TargetResourceName}
                            </div>
                            <div className="text-[11px] text-gray-400 dark:text-gray-500 line-clamp-2">
                              {r.RecommendationText}
                            </div>
                          </div>
                          {r.PotentialSavings != null && (
                            <div className="text-xs font-semibold text-green-600 dark:text-green-400 flex-shrink-0">
                              {formatMoney(r.PotentialSavings)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CollapsibleCard>

                <CollapsibleCard
                  title={t("dashboard.costIncreases")}
                  badge={
                    data.cost_spikes.length > 0
                      ? data.cost_spikes.length
                      : undefined
                  }
                  accentColor="red"
                >
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-3">
                    {t("dashboard.topIncreasesDesc")}
                  </p>
                  {data.cost_spikes.length === 0 ? (
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {t("dashboard.noSpikes")}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {data.cost_spikes.map((s) => (
                        <div
                          key={s.service_name}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="text-gray-700 dark:text-gray-300 truncate">
                            {s.service_name}
                          </span>
                          <div className="text-right flex-shrink-0">
                            <div className="text-red-600 dark:text-red-400 font-semibold">
                              ↑ %{s.change_pct}
                            </div>
                            <div className="text-[10px] text-gray-400 dark:text-gray-500">
                              +{formatMoney(s.delta)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CollapsibleCard>
              </div>

              </>
          )}

          <div className="mt-6">
            <ForecastCard />
            <div className="mt-6">
              <FinOpsScoreCard />
            </div>
          </div>
        </main>
      </div>
      <ResourceGroupPanel
        groupName={selectedGroup}
        onClose={() => setSelectedGroup(null)}
      />
    </div>
  );
}