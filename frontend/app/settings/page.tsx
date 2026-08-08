"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTheme } from "next-themes";
import Sidebar from "@/components/Sidebar";
import { useLanguage } from "@/lib/i18n";
import { getBudgetThreshold, updateBudgetThreshold, getTeamsWebhook, updateTeamsWebhook } from "@/lib/api";
import UserMenu from "@/components/UserMenu";

interface StoredUser {
  user_id: number;
  full_name: string;
  email: string;
  role: string;
}

// ---- ikonlar ----
const ip = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
function IconUser() { return <svg {...ip}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" /></svg>; }
function IconLock() { return <svg {...ip} width="13" height="13"><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>; }
function IconWallet() { return <svg {...ip}><path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v3" /><path d="M3 7v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-5a1 1 0 0 0-1-1h-4a2 2 0 0 0 0 4h5" /></svg>; }
function IconTeams() { return <svg {...ip}><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>; }
function IconSliders() { return <svg {...ip}><path d="M4 21V14M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" /><path d="M2 14h4M10 8h4M18 12h4" /></svg>; }
function IconShield() { return <svg {...ip}><path d="M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-4Z" /></svg>; }
function IconLogout() { return <svg {...ip}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>; }

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

  const hasTeamsWebhook = webhookUrl.trim() !== "";
  const initials = (() => {
    const parts = (user?.full_name || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return "?";
  })();

  return (
    <div className="flex bg-[#F0FAF9] dark:bg-gray-950 min-h-screen">
      <Sidebar pendingCount={0} userName={user?.full_name} userRole={user?.role} userEmail={user?.email} />

      <div className="flex-1 min-w-0">
        <header className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-3.5">
          <div>
            <h1 className="font-semibold text-gray-900 dark:text-white text-sm">{t("settings.title")}</h1>
            <p className="text-xs text-gray-400 dark:text-gray-500">{t("settings.subtitle")}</p>
          </div>
          <UserMenu userName={user?.full_name} userRole={user?.role} />
        </header>

        <main className="p-6">
          <div className="grid lg:grid-cols-[1.6fr_1fr] gap-4 items-stretch">
            {/* ---- SOL SÜTUN: Profil, Bütçe, Teams ---- */}
            <div className="space-y-4">
              {/* Profil */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4 text-gray-900 dark:text-white">
                  <IconUser />
                  <h3 className="text-sm font-bold">{t("settings.profile")}</h3>
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-11 h-11 rounded-full text-sm font-semibold flex items-center justify-center flex-shrink-0"
                    style={{ background: "#EAF1FE", color: "#1D4ED8" }}
                  >
                    {initials}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-900 dark:text-white">{user?.full_name}</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">{user?.email}</div>
                  </div>
                </div>
                <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
                  <Link
                    href="/forgot-password"
                    className="text-xs font-medium hover:underline flex items-center gap-1.5"
                    style={{ color: "#2563EB" }}
                  >
                    <IconLock /> {t("settings.changePassword")}
                  </Link>
                </div>
              </div>

              {/* Bütçe eşiği */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-1 text-gray-900 dark:text-white">
                  <IconWallet />
                  <h3 className="text-sm font-bold">{t("settings.budgetThreshold")}</h3>
                </div>
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
                      className="w-full border rounded-xl pl-7 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                      style={{ background: "#FAFAFB" }}
                    />
                  </div>
                  <button
                    onClick={handleSaveThreshold}
                    disabled={savingThreshold}
                    className="rounded-xl text-white px-5 py-2.5 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition hover:brightness-110"
                    style={{ background: "#2563EB" }}
                  >
                    {savingThreshold ? t("common.loading") : t("settings.save")}
                  </button>
                </div>

                {thresholdError && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{thresholdError}</p>}
                {thresholdSaved && <p className="text-xs text-green-600 dark:text-green-400 mt-2">✓ {t("settings.budgetThresholdSaved")}</p>}
              </div>

              {/* Teams webhook */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2" style={{ color: "#5B5FC7" }}>
                    <IconTeams />
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">{t("settings.teamsWebhook")}</h3>
                  </div>
                  {hasTeamsWebhook && (
                    <span
                      className="inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2.5 py-1"
                      style={{ background: "#EAF7EE", color: "#16A34A" }}
                    >
                      ✓ Bağlı
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">{t("settings.teamsWebhookDesc")}</p>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder={t("settings.teamsWebhookPlaceholder")}
                    className="flex-1 border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 font-mono truncate"
                    style={{ background: "#FAFAFB" }}
                  />
                  <button
                    onClick={handleSaveWebhook}
                    disabled={savingWebhook}
                    className="rounded-xl text-white px-5 py-2.5 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition hover:brightness-110 flex-shrink-0"
                    style={{ background: "#2563EB" }}
                  >
                    {savingWebhook ? t("common.loading") : t("settings.save")}
                  </button>
                </div>

                {webhookError && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{webhookError}</p>}
                {webhookSaved && <p className="text-xs text-green-600 dark:text-green-400 mt-2">✓ {t("settings.teamsWebhookSaved")}</p>}
              </div>
            </div>

            {/* ---- SAĞ SÜTUN: Tercihler + Oturum (tek birleşik kart) ---- */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 flex flex-col">
              <div className="flex items-center gap-2 mb-4 text-gray-900 dark:text-white">
                <IconSliders />
                <h3 className="text-sm font-bold">{t("settings.preferences")}</h3>
              </div>

              <div className="mb-4">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-2">{t("settings.theme")}</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setTheme("light")}
                    className="text-xs font-medium py-2 rounded-lg border transition flex items-center justify-center gap-1.5"
                    style={
                      mounted && theme === "light"
                        ? { background: "#EAF1FE", borderColor: "#2563EB", color: "#2563EB" }
                        : { background: "#fff", borderColor: "#E5E7EB", color: "#6B7280" }
                    }
                  >
                    ☀️ {t("settings.light")}
                  </button>
                  <button
                    onClick={() => setTheme("dark")}
                    className="text-xs font-medium py-2 rounded-lg border transition flex items-center justify-center gap-1.5"
                    style={
                      mounted && theme === "dark"
                        ? { background: "#EAF1FE", borderColor: "#2563EB", color: "#2563EB" }
                        : { background: "#fff", borderColor: "#E5E7EB", color: "#6B7280" }
                    }
                  >
                    🌙 {t("settings.dark")}
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-2">{t("settings.language")}</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setLocale("tr")}
                    className="text-xs font-medium py-2 rounded-lg border transition"
                    style={
                      locale === "tr"
                        ? { background: "#EAF1FE", borderColor: "#2563EB", color: "#2563EB" }
                        : { background: "#fff", borderColor: "#E5E7EB", color: "#6B7280" }
                    }
                  >
                    TR
                  </button>
                  <button
                    onClick={() => setLocale("en")}
                    className="text-xs font-medium py-2 rounded-lg border transition"
                    style={
                      locale === "en"
                        ? { background: "#EAF1FE", borderColor: "#2563EB", color: "#2563EB" }
                        : { background: "#fff", borderColor: "#E5E7EB", color: "#6B7280" }
                    }
                  >
                    EN
                  </button>
                </div>
              </div>

              {/* Oturum -- kartın en altına itilir */}
              <div className="mt-auto pt-4 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2 mb-1 text-gray-700 dark:text-gray-300">
                  <IconShield />
                  <span className="text-xs font-bold">{t("settings.dangerZone")}</span>
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">{t("settings.dangerDesc")}</p>
                <button
                  onClick={handleLogout}
                  className="w-full text-xs font-semibold rounded-lg py-2.5 transition flex items-center justify-center gap-1.5"
                  style={{ background: "#FCEBEB", border: "1px solid #F5C4C4", color: "#B91C1C" }}
                >
                  <IconLogout /> {t("common.logout")}
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}