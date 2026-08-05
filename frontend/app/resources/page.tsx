"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import Sidebar from "@/components/Sidebar";
import { getResources, ResourceItem } from "@/lib/api";
import UserMenu from "@/components/UserMenu";
import { useLanguage } from "@/lib/i18n";

interface StoredUser {
  user_id: number;
  full_name: string;
  email: string;
  role: string;
}

const PAGE_SIZE = 20;

function formatMoney(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
const SERVICE_ROW_COLORS: Record<string, string> = {
  "Virtual Machines": "bg-blue-50/70 dark:bg-blue-500/[0.16]",
  "Azure SQL Database": "bg-purple-50/70 dark:bg-purple-500/[0.16]",
  "Azure SQL Managed Instance": "bg-purple-50/70 dark:bg-purple-500/[0.16]",
  "Storage": "bg-amber-50/70 dark:bg-amber-500/[0.16]",
  "Application Gateway": "bg-teal-50/70 dark:bg-teal-500/[0.16]",
  "VPN Gateway": "bg-teal-50/70 dark:bg-teal-500/[0.16]",
  "Azure App Service": "bg-green-50/70 dark:bg-green-500/[0.16]",
  "Azure Site Recovery": "bg-rose-50/70 dark:bg-rose-500/[0.16]",
  "Log Analytics": "bg-indigo-50/70 dark:bg-indigo-500/[0.16]",
  "Azure Databricks": "bg-orange-50/70 dark:bg-orange-500/[0.16]",
};

function serviceRowColor(service: string): string {
  return SERVICE_ROW_COLORS[service] || "bg-gray-50/70 dark:bg-gray-800/20";
}

export default function ResourcesPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { t } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
    const raw = localStorage.getItem("costbot_user");
    if (raw) setUser(JSON.parse(raw));
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(id);
  }, [search]);

  const load = useCallback(() => {
    setLoading(true);
    getResources(debouncedSearch, PAGE_SIZE, page * PAGE_SIZE)
      .then((res) => {
        setResources(res.resources);
        setTotalCount(res.total_count);
      })
      .finally(() => setLoading(false));
  }, [debouncedSearch, page]);

  useEffect(() => { load(); }, [load]);

  function handleLogout() {
    localStorage.removeItem("costbot_user");
    router.push("/");
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="flex bg-gray-50 dark:bg-gray-950 min-h-screen">
      <Sidebar pendingCount={0} userName={user?.full_name} userRole={user?.role} />

      <div className="flex-1 min-w-0">
        <header className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-3.5">
          <div>
            <h1 className="font-semibold text-gray-900 dark:text-white text-sm">{t("resources.title")}</h1>
            <p className="text-xs text-gray-400 dark:text-gray-500">{t("resources.subtitle")}</p>
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
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("resources.searchPlaceholder")}
            className="w-full max-w-sm mb-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40">
                  <th className="text-left font-medium px-4 py-3">{t("resources.name")}</th>
                  <th className="text-left font-medium px-4 py-3">{t("resources.service")}</th>
                  <th className="text-left font-medium px-4 py-3">{t("resources.group")}</th>
                  <th className="text-right font-medium px-4 py-3">{t("resources.thisMonth")}</th>
                  <th className="text-right font-medium px-4 py-3">{t("resources.totalCost")}</th>
                </tr>
              </thead>
              <tbody>
                {resources.map((r) => (
                  <tr
                    key={`${r.resource_name}-${r.resource_group}-${r.service_name}`}
                    className={`border-b border-gray-100 dark:border-gray-800/50 last:border-0 hover:brightness-95 dark:hover:brightness-125 transition-all ${serviceRowColor(r.service_name)}`}
                  >
                    <td className="px-4 py-2.5 text-gray-900 dark:text-white font-medium truncate max-w-[180px]">{r.resource_name}</td>
                    <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">{r.service_name}</td>
                    <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">{r.resource_group}</td>
                    <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300">{formatMoney(r.current_month_cost)}</td>
                    <td className="px-4 py-2.5 text-right text-gray-900 dark:text-white font-semibold">{formatMoney(r.total_cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!loading && resources.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-10">{t("resources.empty")}</p>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-xs text-gray-500 dark:text-gray-400">
              <span>{t("resources.pageInfo", { current: String(page + 1), total: String(totalPages) })}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40"
                >
                  {t("resources.prev")}
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40"
                >
                  {t("resources.next")}
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}