"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTheme } from "next-themes";
import Sidebar from "@/components/Sidebar";
import { useLanguage } from "@/lib/i18n";
import { getBudgetThreshold, updateBudgetThreshold, getTeamsWebhook, updateTeamsWebhook } from "@/lib/api";

interface StoredUser {
  user_id: number;
  full_name: string;
  email: string;
  role: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { t, locale, setLocale } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [threshold, setThreshold] = useState<string>("");
  const [savingThreshold, setSavingThreshold] = useState(false);
  const [thresholdSaved, setThresholdSaved] = useState(false);
  const [thresholdError, setThresholdError] = useState("");
  const [webhookUrl, setWebhookUrl] = useState<string>("");
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [webhookSaved, setWebhookSaved] = useState(false);
  const [webhookError, setWebhookError] = useState("");

  useEffect(() => {
    setMounted(true);
    const raw = localStorage.getItem("costbot_user");
    const parsedUser = raw ? JSON.parse(raw) : null;
    if (parsedUser) {
      setUser(parsedUser);
      getBudgetThreshold(parsedUser.user_id)
        .then((res) => {
          if (res.threshold !== null) setThreshold(String(res.threshold));
        })
        .catch(() => {});
      getTeamsWebhook(parsedUser.user_id)
        .then((res) => {
          if (res.webhook_url) setWebhookUrl(res.webhook_url);
        })
        .catch(() => {});
    }
  }, []);

  function handleLogout() {
    localStorage.removeItem("costbot_user");
    router.push("/");
  }

  async function handleSaveThreshold() {
    if (!user) return;
    setThresholdError("");
    setThresholdSaved(false);
    setSavingThreshold(true);
    try {
      const numericValue = threshold.trim() === "" ? null : parseFloat(threshold);
      if (numericValue !== null && (isNaN(numericValue) || numericValue < 0)) {
        setThresholdError(t("settings.budgetThresholdInvalid"));
        return;
      }
      await updateBudgetThreshold(user.user_id, numericValue);
      setThresholdSaved(true);
      setTimeout(() => setThresholdSaved(false), 2500);
    } catch (err) {
      setThresholdError(err instanceof Error ? err.message : "Bir hata oluştu.");
    } finally {
      setSavingThreshold(false);
    }
  }

  async function handleSaveWebhook() {
    if (!user) return;
    setWebhookError("");
    setWebhookSaved(false);
    setSavingWebhook(true);
    try {
      const trimmed = webhookUrl.trim();
      if (trimmed !== "" && !trimmed.startsWith("https://")) {
        setWebhookError(t("settings.teamsWebhookInvalid"));
        return;
      }
      await updateTeamsWebhook(user.user_id, trimmed === "" ? null : trimmed);
      setWebhookSaved(true);
      setTimeout(() => setWebhookSaved(false), 2500);
    } catch (err) {
      setWebhookError(err instanceof Error ? err.message : "Bir hata oluştu.");
    } finally {
      setSavingWebhook(false);
    }
  }

  return (
    <div className="flex bg-gray-50 dark:bg-gray-950 min-h-screen">
      <Sidebar pendingCount={0} userName={user?.full_name} userRole={user?.role} />

      <div className="flex-1 min-w-0">
        <header className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-3.5">
          <div>
            <h1 className="font-semibold text-gray-900 dark:text-white text-sm">{t("settings.title")}</h1>
            <p className="text-xs text-gray-400 dark:text-gray-500">{t("settings.subtitle")}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 font-medium"
          >
            {t("common.logout")}
          </button>
        </header>

        <main className="p-6">
          <div className="max-w-2xl">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 mb-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">{t("settings.profile")}</h3>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-sm font-semibold flex items-center justify-center flex-shrink-0">
                {(user?.full_name || "?").slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">{user?.full_name}</div>
                <div className="text-xs text-gray-400 dark:text-gray-500">{user?.email}</div>
              </div>
            </div>
            <Link href="/forgot-password" className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline">
              {t("settings.changePassword")}
            </Link>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 mb-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">{t("settings.budgetThreshold")}</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">{t("settings.budgetThresholdDesc")}</p>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-gray-500">$</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  placeholder={t("settings.budgetThresholdPlaceholder")}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-xl pl-7 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
              <button
                onClick={handleSaveThreshold}
                disabled={savingThreshold}
                className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {savingThreshold ? t("common.loading") : t("settings.save")}
              </button>
            </div>

            {thresholdError && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-2">{thresholdError}</p>
            )}
            {thresholdSaved && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-2">✓ {t("settings.budgetThresholdSaved")}</p>
            )}
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 mb-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">{t("settings.teamsWebhook")}</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">{t("settings.teamsWebhookDesc")}</p>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder={t("settings.teamsWebhookPlaceholder")}
                className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
              <button
                onClick={handleSaveWebhook}
                disabled={savingWebhook}
                className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {savingWebhook ? t("common.loading") : t("settings.save")}
              </button>
            </div>

            {webhookError && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-2">{webhookError}</p>
            )}
            {webhookSaved && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-2">✓ {t("settings.teamsWebhookSaved")}</p>
            )}
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 mb-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">{t("settings.preferences")}</h3>

            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-600 dark:text-gray-300">{t("settings.theme")}</span>
              <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
                <button
                  onClick={() => setTheme("light")}
                  className={`text-xs px-3 py-1.5 rounded-md transition ${
                    mounted && theme === "light" ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-400 dark:text-gray-500"
                  }`}
                >
                  ☀️ {t("settings.light")}
                </button>
                <button
                  onClick={() => setTheme("dark")}
                  className={`text-xs px-3 py-1.5 rounded-md transition ${
                    mounted && theme === "dark" ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-400 dark:text-gray-500"
                  }`}
                >
                  🌙 {t("settings.dark")}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-600 dark:text-gray-300">{t("settings.language")}</span>
              <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
                <button
                  onClick={() => setLocale("tr")}
                  className={`text-xs px-3 py-1.5 rounded-md transition ${
                    locale === "tr" ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-400 dark:text-gray-500"
                  }`}
                >
                  TR
                </button>
                <button
                  onClick={() => setLocale("en")}
                  className={`text-xs px-3 py-1.5 rounded-md transition ${
                    locale === "en" ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-400 dark:text-gray-500"
                  }`}
                >
                  EN
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-red-100 dark:border-red-900/40 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-1">{t("settings.dangerZone")}</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">{t("settings.dangerDesc")}</p>
            <button
              onClick={handleLogout}
              className="text-xs font-medium bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg px-3.5 py-2 hover:bg-red-100 dark:hover:bg-red-500/20"
            >
              {t("common.logout")}
            </button>
          </div>
          </div>
        </main>
      </div>
    </div>
  );
}