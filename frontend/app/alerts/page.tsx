"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import Sidebar from "@/components/Sidebar";
import { getDashboardSummary, sendAlertEmail, sendTeamsAlert, getTeamsWebhook, CostSpike } from "@/lib/api";
import { useLanguage } from "@/lib/i18n";

interface StoredUser {
  user_id: number;
  full_name: string;
  email: string;
  role: string;
}

function formatMoney(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function AlertsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { t, locale } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [spikes, setSpikes] = useState<CostSpike[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingAll, setSendingAll] = useState(false);
  const [sendingOne, setSendingOne] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const [hasTeamsWebhook, setHasTeamsWebhook] = useState(false);
  const [sendingAllTeams, setSendingAllTeams] = useState(false);
  const [sendingOneTeams, setSendingOneTeams] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const raw = localStorage.getItem("costbot_user");
    const parsedUser: StoredUser | null = raw ? JSON.parse(raw) : null;
    if (parsedUser) setUser(parsedUser);
    if (parsedUser) {
      getDashboardSummary(locale, parsedUser.user_id)
        .then((d) => setSpikes(d.cost_spikes))
        .finally(() => setLoading(false));
      getTeamsWebhook(parsedUser.user_id)
        .then((res) => setHasTeamsWebhook(!!res.webhook_url))
        .catch(() => {});
    } else {
      setLoading(false);
    }
  }, [locale]);

  async function handleSendAll() {
    if (!user) return;
    setSendingAll(true);
    setMessage("");
    try {
      const res = await sendAlertEmail(user.user_id, locale);
      setMessage(t("alerts.sentCount", { count: String(res.sent) }));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Bir hata oluştu.");
    } finally {
      setSendingAll(false);
    }
  }

  async function handleSendOne(serviceName: string) {
    if (!user) return;
    setSendingOne(serviceName);
    setMessage("");
    try {
      await sendAlertEmail(user.user_id, locale, serviceName);
      setMessage(t("alerts.sentOne", { service: serviceName }));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Bir hata oluştu.");
    } finally {
      setSendingOne(null);
    }
  }

  async function handleSendAllTeams() {
    if (!user) return;
    setSendingAllTeams(true);
    setMessage("");
    try {
      const res = await sendTeamsAlert(user.user_id, locale);
      setMessage(t("alerts.teamsSentCount", { count: String(res.sent), recipient: "" }));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Bir hata oluştu.");
    } finally {
      setSendingAllTeams(false);
    }
  }

  async function handleSendOneTeams(serviceName: string) {
    if (!user) return;
    setSendingOneTeams(serviceName);
    setMessage("");
    try {
      await sendTeamsAlert(user.user_id, locale, serviceName);
      setMessage(t("alerts.teamsSentOne", { service: serviceName, recipient: "" }));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Bir hata oluştu.");
    } finally {
      setSendingOneTeams(null);
    }
  }

  function handleLogout() {
    localStorage.removeItem("costbot_user");
    router.push("/");
  }

  return (
    <div className="flex bg-gray-50 dark:bg-gray-950 min-h-screen">
      <Sidebar pendingCount={0} userName={user?.full_name} userRole={user?.role} />

      <div className="flex-1 min-w-0">
        <header className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-3.5">
          <div>
            <h1 className="font-semibold text-gray-900 dark:text-white text-sm">{t("alerts.title")}</h1>
            <p className="text-xs text-gray-400 dark:text-gray-500">{t("alerts.subtitle")}</p>
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
          {message && (
            <div className="bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 text-sm rounded-xl px-4 py-3 mb-4">
              {message}
            </div>
          )}

          {!hasTeamsWebhook && (
            <div className="bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs rounded-xl px-4 py-3 mb-4">
              {t("alerts.noTeamsWebhook")}
            </div>
          )}

          {loading && <p className="text-sm text-gray-400 dark:text-gray-500">{t("common.loading")}</p>}

          {!loading && spikes.length === 0 && (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-10 text-center">
              <div className="text-3xl mb-3">🔔</div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t("alerts.empty")}</p>
            </div>
          )}

          {!loading && spikes.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <p className="text-sm text-gray-500 dark:text-gray-400">{t("alerts.description")}</p>
                <div className="flex gap-2">
                  <button
                    onClick={handleSendAll}
                    disabled={sendingAll}
                    className="text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3.5 py-2 transition disabled:opacity-50"
                  >
                    {sendingAll ? t("alerts.sending") : t("alerts.sendAll")}
                  </button>
                  {hasTeamsWebhook && (
                    <button
                      onClick={handleSendAllTeams}
                      disabled={sendingAllTeams}
                      className="text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3.5 py-2 transition disabled:opacity-50"
                    >
                      {sendingAllTeams ? t("alerts.sending") : t("alerts.sendAllTeams")}
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {spikes.map((s) => (
                  <div key={s.service_name} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">{s.service_name}</div>
                      <div className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                        ↑ %{s.change_pct} · {formatMoney(s.current_total)}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSendOne(s.service_name)}
                        disabled={sendingOne === s.service_name}
                        className="text-xs font-medium bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                      >
                        {sendingOne === s.service_name ? t("alerts.sending") : t("alerts.notify")}
                      </button>
                      {hasTeamsWebhook && (
                        <button
                          onClick={() => handleSendOneTeams(s.service_name)}
                          disabled={sendingOneTeams === s.service_name}
                          className="text-xs font-medium bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 rounded-lg px-3 py-1.5 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 disabled:opacity-50"
                        >
                          {sendingOneTeams === s.service_name ? t("alerts.sending") : t("alerts.notifyTeams")}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}