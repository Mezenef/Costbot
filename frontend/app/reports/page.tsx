"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import Sidebar from "@/components/Sidebar";
import { getReportHistory, getReportDownloadUrl, ReportHistoryItem } from "@/lib/api";
import { useLanguage } from "@/lib/i18n";

interface StoredUser {
  user_id: number;
  full_name: string;
  email: string;
  role: string;
}

type Granularity = "day" | "week" | "month" | undefined;

export default function ReportsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { t, locale } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [history, setHistory] = useState<ReportHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [granularity, setGranularity] = useState<Granularity>(undefined);

  useEffect(() => {
    setMounted(true);
    const raw = localStorage.getItem("costbot_user");
    const parsedUser: StoredUser | null = raw ? JSON.parse(raw) : null;
    if (parsedUser) setUser(parsedUser);
    if (parsedUser) {
      getReportHistory(parsedUser.user_id)
        .then(setHistory)
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  function handleLogout() {
    localStorage.removeItem("costbot_user");
    router.push("/");
  }

  const GRANULARITY_OPTIONS: { value: Granularity; label: string }[] = [
    { value: "day", label: t("reports.periodDay") },
    { value: "week", label: t("reports.periodWeek") },
    { value: "month", label: t("reports.periodMonth") },
  ];

  return (
    <div className="flex bg-gray-50 dark:bg-gray-950 min-h-screen">
      <Sidebar pendingCount={0} userName={user?.full_name} userRole={user?.role} />

      <div className="flex-1 min-w-0">
        <header className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-3.5">
          <div>
            <h1 className="font-semibold text-gray-900 dark:text-white text-sm">{t("reports.title")}</h1>
            <p className="text-xs text-gray-400 dark:text-gray-500">{t("reports.subtitle")}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Tema değiştir"
              className="w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm"
            >
              {mounted && (theme === "dark" ? "☀️" : "🌙")}
            </button>
            <button
              onClick={handleLogout}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 font-medium"
            >
              {t("common.logout")}
            </button>
          </div>
        </header>

        <main className="p-6">
          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-500/10 dark:to-cyan-500/10 border border-blue-100 dark:border-blue-500/20 rounded-2xl p-5 mb-6">
            <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white">{t("reports.newReportTitle")}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t("reports.newReportDesc")}</p>
              </div>
              <a
                href={getReportDownloadUrl(locale, user?.user_id, granularity)}
              
                className="flex items-center gap-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2.5 transition dark:shadow-[0_0_15px_rgba(59,130,246,0.3)]"
              >
                📄 {t("reports.generate")}
              </a>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">{t("reports.periodLabel")}</span>
              <div className="flex gap-1 bg-white dark:bg-gray-800 rounded-lg p-0.5 border border-gray-200 dark:border-gray-700">
                {GRANULARITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => setGranularity(opt.value)}
                    className={`text-xs px-3 py-1.5 rounded-md transition ${
                      granularity === opt.value
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t("reports.historyTitle")}</h3>
            </div>

            {loading && <p className="text-sm text-gray-400 dark:text-gray-500 px-5 py-6">{t("common.loading")}</p>}

            {!loading && history.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-10">{t("reports.empty")}</p>
            )}

            {!loading && history.length > 0 && (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800">
                    <th className="text-left font-medium px-5 py-3">{t("reports.period")}</th>
                    <th className="text-left font-medium px-5 py-3">{t("reports.language")}</th>
                    <th className="text-left font-medium px-5 py-3">{t("reports.date")}</th>
                    <th className="text-right font-medium px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.ReportId} className="border-b border-gray-50 dark:border-gray-800/50 last:border-0">
                      <td className="px-5 py-3 text-gray-900 dark:text-white font-medium">{h.Period}</td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-300 uppercase">{h.Language}</td>
                      <td className="px-5 py-3 text-gray-400 dark:text-gray-500">{h.GeneratedDate}</td>
                      <td className="px-5 py-3 text-right">
                        <a
                          href={getReportDownloadUrl(h.Language, user?.user_id)}
                          
                          className="text-blue-600 dark:text-blue-400 font-medium hover:underline"
                        >
                          {t("reports.download")}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}