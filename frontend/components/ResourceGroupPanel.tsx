"use client";
import { useEffect, useState } from "react";
import { getResourceGroupDetail, ResourceGroupDetail } from "@/lib/api";
import { useLanguage } from "@/lib/i18n";

function formatMoney(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function ChangeBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-xs text-gray-400 dark:text-gray-500">—</span>;
  const up = pct >= 0;
  return (
    <span className={`text-xs font-medium ${up ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
      {up ? "↑" : "↓"} %{Math.abs(pct).toFixed(1)}
    </span>
  );
}

interface ResourceGroupPanelProps {
  groupName: string | null;
  onClose: () => void;
}

export default function ResourceGroupPanel({ groupName, onClose }: ResourceGroupPanelProps) {
  const { t, locale } = useLanguage();
  const [detail, setDetail] = useState<ResourceGroupDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!groupName) {
      setDetail(null);
      return;
    }
    setLoading(true);
    setError("");
    getResourceGroupDetail(groupName, locale)
      .then(setDetail)
      .catch((err) => setError(err instanceof Error ? err.message : "Bir hata oluştu."))
      .finally(() => setLoading(false));
  }, [groupName, locale]);

  const isOpen = groupName !== null;
  const maxResourceCost = detail ? Math.max(...detail.resources.map((r) => r.total), 1) : 1;

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-200 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white dark:bg-gray-900 shadow-2xl z-50 transition-transform duration-300 ease-out overflow-y-auto ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {detail && (
          <div className="p-6">
            <div className="flex items-start justify-between mb-1">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">{detail.resource_group}</h2>
              <button
                onClick={onClose}
                aria-label="Kapat"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-6">{detail.current_month}</p>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-6">
              <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">{t("dashboard.totalCost")}</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{formatMoney(detail.total)}</div>
            </div>

            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3">
              {t("dashboard.resources")} ({detail.resources.length})
            </h3>

            <div className="space-y-1">
              {detail.resources.map((r) => (
                <div key={r.resource_name} className="flex items-center justify-between py-2.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{r.resource_name}</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">{r.service_name}</div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3 relative">
                    <div className="w-24 h-6 relative overflow-hidden rounded">
                      <div
                        className="absolute inset-y-0 right-0 bg-blue-50 dark:bg-blue-500/10"
                        style={{ width: `${(r.total / maxResourceCost) * 100}%` }}
                      />
                      <span className="relative text-sm font-semibold text-gray-900 dark:text-white flex items-center justify-end h-full pr-1">
                        {formatMoney(r.total)}
                      </span>
                    </div>
                    <ChangeBadge pct={r.change_pct} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading && <div className="p-6 text-sm text-gray-400">{t("common.loading")}</div>}
        {error && <div className="p-6 text-sm text-red-600">{error}</div>}
      </div>
    </>
  );
}