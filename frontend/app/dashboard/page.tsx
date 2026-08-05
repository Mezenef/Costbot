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
import MonthlyServiceChart from "@/components/MonthlyServiceChart";
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
  "#00A8FF",
  "#9B5CFF",
  "#00E676",
  "#FF9500",
  "#FF3B5C",
  "#64748B",
];

function formatMoney(n: number) {
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function ChangeBadge({ pct }: { pct: number | null }) {
  if (pct === null)
    return <span className="text-xs text-gray-400 dark:text-gray-500">—</span>;
  const up = pct >= 0;
  return (
    <span
      className={`text-xs font-medium ${
        up
          ? "text-red-600 dark:text-red-400"
          : "text-green-600 dark:text-green-400"
      }`}
    >
      {up ? "↑" : "↓"} %{Math.abs(pct).toFixed(1)}
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
  const [distributionChartType, setDistributionChartType] = useState<
    "donut" | "bar"
  >("donut");
  const [timeframe, setTimeframe] = useState<DashboardTimeframe>("30d");

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
    <div className="flex bg-gray-50 dark:bg-gray-950 min-h-screen">
      <Sidebar
        pendingCount={data?.pending_recommendations ?? 0}
        userName={user?.full_name}
        userRole={user?.role}
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
            <select
              value={timeframe}
              onChange={(e) =>
                setTimeframe(e.target.value as DashboardTimeframe)
              }
              className="text-xs font-medium bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="daily">{t("dashboard.timeframeDaily")}</option>
              <option value="30d">{t("dashboard.timeframe30d")}</option>
              <option value="3m">{t("dashboard.timeframe3m")}</option>
              <option value="6m">{t("dashboard.timeframe6m")}</option>
              <option value="12m">{t("dashboard.timeframe12m")}</option>
              <option value="all">{t("dashboard.timeframeAll")}</option>
            </select>

            
      
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
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-500/10 dark:to-cyan-500/10 border border-blue-100 dark:border-blue-500/20 rounded-2xl p-5 mb-6 flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-white">
                    {t("dashboard.greeting", {
                      name: user?.full_name?.split(" ")[0] || "",
                    })}{" "}
                    👋
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
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

              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
                  <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">
                    {t("dashboard.totalCost")}
                  </div>
                  <div className="text-xl font-bold text-gray-900 dark:text-white">
                    {formatMoney(data.total_cost)}
                  </div>
                  <div className="mt-1">
                    <ChangeBadge pct={data.cost_change_pct} />{" "}
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {getComparisonLabel(timeframe, t)}
                    </span>
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
                  <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">
                    {t("dashboard.todayCost")}
                  </div>
                  <div className="text-xl font-bold text-gray-900 dark:text-white">
                    {formatMoney(data.today_cost)}
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {formatDateDMY(data.today_date)}
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
                  <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">
                    {t("dashboard.potentialSavings")}
                  </div>
                  <div className="text-xl font-bold text-green-600 dark:text-green-400">
                    {formatMoney(data.potential_savings)}
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {t("dashboard.fromPending")}
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
                  <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">
                    {t("dashboard.pendingRecs")}
                  </div>
                  <div className="text-xl font-bold text-gray-900 dark:text-white">
                    {data.pending_recommendations}
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {t("dashboard.awaitingReview")}
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
                  <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">
                    {t("dashboard.resources")}
                  </div>
                  <div className="text-xl font-bold text-gray-900 dark:text-white">
                    {data.resource_count}
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {t("dashboard.trackedResources")}
                  </div>
                </div>
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
                                stopColor="#2563eb"
                                stopOpacity={0.25}
                              />
                              <stop
                                offset="100%"
                                stopColor="#2563eb"
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
                          />
                          <YAxis
                            tick={{ fontSize: 11 }}
                            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
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
                            stroke="#2563eb"
                            strokeWidth={2.5}
                            dot={{ r: 3, fill: "#2563eb", strokeWidth: 0 }}
                            activeDot={{ r: 5 }}
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
                          />
                          <YAxis
                            tick={{ fontSize: 11 }}
                            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
                          />
                          <Tooltip
                            formatter={(v) => formatMoney(Number(v))}
                            labelFormatter={(label) =>
                              formatChartDateLabel(String(label ?? ""))
                            }
                          />
                          <Bar
                            dataKey="total"
                            fill="#2563eb"
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
                <CollapsibleCard title={t("dashboard.topResourceGroups")}>
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

              <div className="mt-6">
                <MonthlyServiceChart />
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