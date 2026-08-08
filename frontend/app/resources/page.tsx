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

// Genişletilmiş renk paleti -- CostBot'taki tüm servisleri (30 civarı)
// kapsayacak şekilde, her biri kendi rengiyle. Listede olmayan
// servisler icin hash tabanli otomatik renk secimi devreye giriyor
// (asagida serviceColor()).
const SERVICE_COLORS: Record<string, { row: string; dot: string; bar: string }> = {
  "Virtual Machines": { row: "bg-blue-50 dark:bg-blue-500/[0.14]", dot: "bg-blue-500", bar: "bg-blue-500" },
  "Azure SQL Database": { row: "bg-purple-50 dark:bg-purple-500/[0.14]", dot: "bg-purple-500", bar: "bg-purple-500" },
  "Azure SQL Managed Instance": { row: "bg-purple-50 dark:bg-purple-500/[0.14]", dot: "bg-purple-500", bar: "bg-purple-500" },
  "Storage": { row: "bg-amber-50 dark:bg-amber-500/[0.14]", dot: "bg-amber-500", bar: "bg-amber-500" },
  "Application Gateway": { row: "bg-teal-50 dark:bg-teal-500/[0.14]", dot: "bg-teal-500", bar: "bg-teal-500" },
  "VPN Gateway": { row: "bg-cyan-50 dark:bg-cyan-500/[0.14]", dot: "bg-cyan-500", bar: "bg-cyan-500" },
  "Azure App Service": { row: "bg-green-50 dark:bg-green-500/[0.14]", dot: "bg-green-500", bar: "bg-green-500" },
  "Azure Site Recovery": { row: "bg-rose-50 dark:bg-rose-500/[0.14]", dot: "bg-rose-500", bar: "bg-rose-500" },
  "Log Analytics": { row: "bg-indigo-50 dark:bg-indigo-500/[0.14]", dot: "bg-indigo-500", bar: "bg-indigo-500" },
  "Azure Databricks": { row: "bg-orange-50 dark:bg-orange-500/[0.14]", dot: "bg-orange-500", bar: "bg-orange-500" },
  "Backup": { row: "bg-violet-50 dark:bg-violet-500/[0.14]", dot: "bg-violet-500", bar: "bg-violet-500" },
  "Microsoft Defender for Cloud": { row: "bg-red-50 dark:bg-red-500/[0.14]", dot: "bg-red-500", bar: "bg-red-500" },
  "Azure Cognitive Search": { row: "bg-fuchsia-50 dark:bg-fuchsia-500/[0.14]", dot: "bg-fuchsia-500", bar: "bg-fuchsia-500" },
  "Container Registry": { row: "bg-sky-50 dark:bg-sky-500/[0.14]", dot: "bg-sky-500", bar: "bg-sky-500" },
  "Azure Cosmos DB": { row: "bg-emerald-50 dark:bg-emerald-500/[0.14]", dot: "bg-emerald-500", bar: "bg-emerald-500" },
  "Redis Cache": { row: "bg-pink-50 dark:bg-pink-500/[0.14]", dot: "bg-pink-500", bar: "bg-pink-500" },
  "NAT Gateway": { row: "bg-lime-50 dark:bg-lime-500/[0.14]", dot: "bg-lime-500", bar: "bg-lime-500" },
  "Virtual Network": { row: "bg-blue-50 dark:bg-blue-500/[0.14]", dot: "bg-blue-400", bar: "bg-blue-400" },
  "Azure Database for PostgreSQL": { row: "bg-purple-50 dark:bg-purple-500/[0.14]", dot: "bg-purple-400", bar: "bg-purple-400" },
  "Azure Container Apps": { row: "bg-teal-50 dark:bg-teal-500/[0.14]", dot: "bg-teal-400", bar: "bg-teal-400" },
  "Foundry Models": { row: "bg-amber-50 dark:bg-amber-500/[0.14]", dot: "bg-amber-400", bar: "bg-amber-400" },
  "Azure Update Manager": { row: "bg-slate-50 dark:bg-slate-500/[0.14]", dot: "bg-slate-500", bar: "bg-slate-500" },
  "Azure Bastion": { row: "bg-cyan-50 dark:bg-cyan-500/[0.14]", dot: "bg-cyan-400", bar: "bg-cyan-400" },
  "Azure DNS": { row: "bg-green-50 dark:bg-green-500/[0.14]", dot: "bg-green-400", bar: "bg-green-400" },
  "Bandwidth": { row: "bg-indigo-50 dark:bg-indigo-500/[0.14]", dot: "bg-indigo-400", bar: "bg-indigo-400" },
  "SQL Database": { row: "bg-violet-50 dark:bg-violet-500/[0.14]", dot: "bg-violet-400", bar: "bg-violet-400" },
  "Azure Arc": { row: "bg-orange-50 dark:bg-orange-500/[0.14]", dot: "bg-orange-400", bar: "bg-orange-400" },
  "Azure Machine Learning": { row: "bg-fuchsia-50 dark:bg-fuchsia-500/[0.14]", dot: "bg-fuchsia-400", bar: "bg-fuchsia-400" },
  "Email": { row: "bg-red-50 dark:bg-red-500/[0.14]", dot: "bg-red-400", bar: "bg-red-400" },
  "Key Vault": { row: "bg-sky-50 dark:bg-sky-500/[0.14]", dot: "bg-sky-400", bar: "bg-sky-400" },
  "Azure Monitor": { row: "bg-emerald-50 dark:bg-emerald-500/[0.14]", dot: "bg-emerald-400", bar: "bg-emerald-400" },
  "SaaS": { row: "bg-pink-50 dark:bg-pink-500/[0.14]", dot: "bg-pink-400", bar: "bg-pink-400" },
  "Azure Arc Enabled Databases": { row: "bg-rose-50 dark:bg-rose-500/[0.14]", dot: "bg-rose-400", bar: "bg-rose-400" },
};

const FALLBACK_COLORS = [
  { row: "bg-blue-50 dark:bg-blue-500/[0.14]", dot: "bg-blue-500", bar: "bg-blue-500" },
  { row: "bg-purple-50 dark:bg-purple-500/[0.14]", dot: "bg-purple-500", bar: "bg-purple-500" },
  { row: "bg-teal-50 dark:bg-teal-500/[0.14]", dot: "bg-teal-500", bar: "bg-teal-500" },
  { row: "bg-amber-50 dark:bg-amber-500/[0.14]", dot: "bg-amber-500", bar: "bg-amber-500" },
  { row: "bg-rose-50 dark:bg-rose-500/[0.14]", dot: "bg-rose-500", bar: "bg-rose-500" },
];

function serviceColors(service: string) {
  if (SERVICE_COLORS[service]) return SERVICE_COLORS[service];
  // Listede olmayan (beklenmeyen) bir servis gelirse, isme göre
  // TUTARLI bir renk seçilsin diye basit bir hash kullanılıyor.
  let hash = 0;
  for (let i = 0; i < service.length; i++) hash = service.charCodeAt(i) + ((hash << 5) - hash);
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
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
    <div className="flex bg-[#F0FAF9] dark:bg-gray-950 min-h-screen">
      <Sidebar pendingCount={0} userName={user?.full_name} userRole={user?.role} userEmail={user?.email} />

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
                  <th className="w-1"></th>
                  <th className="text-left font-medium px-4 py-3">{t("resources.name")}</th>
                  <th className="text-left font-medium px-4 py-3">{t("resources.service")}</th>
                  <th className="text-left font-medium px-4 py-3">{t("resources.group")}</th>
                  <th className="text-right font-medium px-4 py-3">{t("resources.thisMonth")}</th>
                  <th className="text-right font-medium px-4 py-3">{t("resources.totalCost")}</th>
                </tr>
              </thead>
              <tbody>
                {resources.map((r) => {
                  const colors = serviceColors(r.service_name);
                  return (
                    <tr
                      key={`${r.resource_name}-${r.resource_group}-${r.service_name}`}
                      className={`border-b border-gray-100 dark:border-gray-800/50 last:border-0 hover:brightness-95 dark:hover:brightness-125 transition-all ${colors.row}`}
                    >
                      <td className={`p-0`}>
                        <div className={`w-1 h-full min-h-[38px] ${colors.bar}`} />
                      </td>
                      <td className="px-4 py-2.5 text-gray-900 dark:text-white font-medium truncate max-w-[180px]">{r.resource_name}</td>
                      <td className="px-4 py-2.5 text-gray-700 dark:text-gray-200">
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${colors.dot}`} />
                          {r.service_name}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">{r.resource_group}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300">{formatMoney(r.current_month_cost)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-900 dark:text-white font-semibold">{formatMoney(r.total_cost)}</td>
                    </tr>
                  );
                })}
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