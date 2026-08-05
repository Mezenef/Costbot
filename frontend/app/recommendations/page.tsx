"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import Sidebar from "@/components/Sidebar";
import { getRecommendations, updateRecommendationStatus, deleteRecommendation, Recommendation } from "@/lib/api";
import { useLanguage } from "@/lib/i18n";

interface StoredUser {
  user_id: number;
  full_name: string;
  email: string;
  role: string;
}

function StatusPill({ status, t }: { status: Recommendation["Status"]; t: (k: string) => string }) {
  const styles = {
    Beklemede: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30",
    Uygulandı: "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/30",
    Reddedildi: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700",
  };
  const labels: Record<string, string> = {
    Beklemede: t("recs.tabPending"),
    Uygulandı: t("recs.tabApplied"),
    Reddedildi: t("recs.tabRejected"),
  };
  return (
    <span className={`text-[11px] font-medium border rounded-full px-2.5 py-0.5 ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function formatMoney(n: number | null) {
  if (n == null) return "—";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Etki analizi bölümü -- "bu öneriyi uygularsam ne olur" sorusuna kaba
// bir ön fikir verir. TAHMİNİDİR, gerçek Azure ölçümü DEĞİLDİR --
// bu yüzden her zaman küçük bir uyarı notuyla birlikte gösterilir.
function ImpactAnalysis({ rec, t }: { rec: Recommendation; t: (k: string) => string }) {
  const [open, setOpen] = useState(false);
  const hasImpactData = rec.SkuChange || rec.EstimatedDowntime || rec.ImpactSummary;
  if (!hasImpactData) return null;

  return (
    <div className="pl-6 mt-3">
      <button
        onClick={() => setOpen(!open)}
        className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
      >
        {open ? "▾" : "▸"} {t("recs.whatIf")}
      </button>
      {open && (
        <div className="mt-2 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl p-3 space-y-2">
          {rec.SkuChange && (
            <div className="text-[11px]">
              <span className="font-medium text-gray-500 dark:text-gray-400">{t("recs.skuChange")}: </span>
              <span className="text-gray-700 dark:text-gray-300">{rec.SkuChange}</span>
            </div>
          )}
          {rec.EstimatedDowntime && (
            <div className="text-[11px]">
              <span className="font-medium text-gray-500 dark:text-gray-400">{t("recs.estimatedDowntime")}: </span>
              <span className="text-gray-700 dark:text-gray-300">{rec.EstimatedDowntime}</span>
            </div>
          )}
          {rec.ImpactSummary && (
            <div className="text-[11px] text-gray-700 dark:text-gray-300 leading-relaxed space-y-1">
              {rec.ImpactSummary.split("\n").filter(Boolean).map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          )}
          <div className="text-[10px] text-gray-400 dark:text-gray-500 italic pt-1 border-t border-gray-200 dark:border-gray-700">
            {t("recs.impactDisclaimer")}
          </div>
        </div>
      )}
    </div>
  );
}

export default function RecommendationsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { t } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [activeTab, setActiveTab] = useState<string | undefined>(undefined);
  const [serviceFilter, setServiceFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const TABS: { label: string; value: string | undefined }[] = [
    { label: t("recs.tabAll"), value: undefined },
    { label: t("recs.tabPending"), value: "Beklemede" },
    { label: t("recs.tabApplied"), value: "Uygulandı" },
    { label: t("recs.tabRejected"), value: "Reddedildi" },
  ];

  const load = useCallback(() => {
    if (!user) return;
    setLoading(true);
    getRecommendations(user.user_id, activeTab).then(setRecs).finally(() => setLoading(false));
  }, [activeTab, user]);

  useEffect(() => {
    setMounted(true);
    const raw = localStorage.getItem("costbot_user");
    if (raw) setUser(JSON.parse(raw));
  }, []);

  useEffect(() => { load(); }, [load]);

  const serviceOptions = useMemo(() => {
    const set = new Set(recs.map((r) => r.TargetService).filter((s): s is string => !!s));
    return Array.from(set).sort();
  }, [recs]);

  const visibleRecs = useMemo(() => {
    if (!serviceFilter) return recs;
    return recs.filter((r) => r.TargetService === serviceFilter);
  }, [recs, serviceFilter]);

  // Filtre değişince, artık görünmeyen öğelerin seçimini temizle
  useEffect(() => {
    setSelectedIds((prev) => {
      const visibleIds = new Set(visibleRecs.map((r) => r.RecommendationId));
      const next = new Set([...prev].filter((id) => visibleIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [visibleRecs]);

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) =>
      prev.size === visibleRecs.length ? new Set() : new Set(visibleRecs.map((r) => r.RecommendationId))
    );
  }

  async function handleStatusChange(id: number, status: "Uygulandı" | "Reddedildi") {
    setUpdatingId(id);
    try {
      await updateRecommendationStatus(id, status, user?.user_id ?? 0);
      load();
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm(t("recs.deleteConfirm"))) return;
    setDeletingId(id);
    try {
      await deleteRecommendation(id, user?.user_id ?? 0);
      load();
    } finally {
      setDeletingId(null);
    }
  }

  async function handleBulkDelete() {
    const count = selectedIds.size;
    if (count === 0) return;
    if (!window.confirm(t("recs.bulkDeleteConfirm", { count: String(count) }))) return;
    setBulkDeleting(true);
    try {
      await Promise.all([...selectedIds].map((id) => deleteRecommendation(id, user?.user_id ?? 0)));
      setSelectedIds(new Set());
      load();
    } finally {
      setBulkDeleting(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("costbot_user");
    localStorage.removeItem("costbot_session_id");
    router.push("/");
  }

  const pendingCount = recs.filter((r) => r.Status === "Beklemede").length;
  const allVisibleSelected = visibleRecs.length > 0 && selectedIds.size === visibleRecs.length;

  return (
    <div className="flex bg-gray-50 dark:bg-gray-950 min-h-screen">
      <Sidebar pendingCount={pendingCount} userName={user?.full_name} userRole={user?.role} />

      <div className="flex-1 min-w-0">
        <header className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-3.5">
          <div>
            <h1 className="font-semibold text-gray-900 dark:text-white text-sm">{t("recs.title")}</h1>
            <p className="text-xs text-gray-400 dark:text-gray-500">{t("recs.subtitle")}</p>
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
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex gap-2">
              {TABS.map((tab) => (
                <button
                  key={tab.label}
                  onClick={() => setActiveTab(tab.value)}
                  className={`text-xs font-medium rounded-full px-4 py-2 transition ${
                    activeTab === tab.value
                      ? "bg-blue-600 text-white"
                      : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {serviceOptions.length > 1 && (
              <select
                value={serviceFilter}
                onChange={(e) => setServiceFilter(e.target.value)}
                aria-label={t("recs.filterByService")}
                className="text-xs font-medium bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-full px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t("recs.allServices")}</option>
                {serviceOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            )}

            {visibleRecs.length > 0 && (
              <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 cursor-pointer ml-auto">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                {t("recs.selectAll")}
              </label>
            )}
          </div>

          {/* Toplu islem cubugu -- sadece secim varken gorunur */}
          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-xl px-4 py-2.5 mb-4">
              <span className="text-xs font-medium text-blue-700 dark:text-blue-400">
                {t("recs.selected", { count: String(selectedIds.size) })}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="text-[11px] font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-2 py-1"
                >
                  {t("recs.clearSelection")}
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  className="text-[11px] font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg px-3 py-1.5 disabled:opacity-50"
                >
                  {t("recs.deleteSelected")}
                </button>
              </div>
            </div>
          )}

          {loading && <p className="text-sm text-gray-400 dark:text-gray-500">{t("common.loading")}</p>}

          {!loading && visibleRecs.length === 0 && (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-10 text-center">
              <div className="text-3xl mb-3">💡</div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t("recs.empty")}</p>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4 items-start">
            {visibleRecs.map((r) => (
              <div
                key={r.RecommendationId}
                className={`relative bg-white dark:bg-gray-900 border rounded-2xl p-5 transition ${
                  selectedIds.has(r.RecommendationId)
                    ? "border-blue-400 dark:border-blue-500 ring-1 ring-blue-400 dark:ring-blue-500"
                    : "border-gray-200 dark:border-gray-800"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(r.RecommendationId)}
                  onChange={() => toggleSelect(r.RecommendationId)}
                  className="absolute top-4 left-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                <button
                  onClick={() => handleDelete(r.RecommendationId)}
                  disabled={deletingId === r.RecommendationId}
                  aria-label="Sil"
                  className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center text-gray-300 dark:text-gray-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition disabled:opacity-40"
                >
                  ✕
                </button>

                <div className="flex items-start justify-between gap-2 mb-2 pl-6 pr-6">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">{r.TargetResourceName}</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">{r.TargetService}</div>
                  </div>
                  <StatusPill status={r.Status} t={t} />
                </div>

                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed mb-3 pl-6">{r.RecommendationText}</p>

                <ImpactAnalysis rec={r} t={t} />

                <div className="flex items-center justify-between pl-6 mt-3">
                  <div className="text-sm font-bold text-green-600 dark:text-green-400">
                    {formatMoney(r.PotentialSavings)} <span className="text-xs font-normal text-gray-400 dark:text-gray-500">{t("recs.savings")}</span>
                  </div>

                  {r.Status === "Beklemede" && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleStatusChange(r.RecommendationId, "Uygulandı")}
                        disabled={updatingId === r.RecommendationId}
                        className="text-[11px] font-medium bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 rounded-lg px-3 py-1.5 hover:bg-green-100 dark:hover:bg-green-500/20 disabled:opacity-50"
                      >
                        {t("recs.apply")}
                      </button>
                      <button
                        onClick={() => handleStatusChange(r.RecommendationId, "Reddedildi")}
                        disabled={updatingId === r.RecommendationId}
                        className="text-[11px] font-medium bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-lg px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                      >
                        {t("recs.reject")}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}