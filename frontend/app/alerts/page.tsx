"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import Sidebar from "@/components/Sidebar";
import { getDashboardPeriodSummary, sendAlertEmail, sendTeamsAlert, getTeamsWebhook, CostSpike } from "@/lib/api";
import { useLanguage } from "@/lib/i18n";
import UserMenu from "@/components/UserMenu";

interface StoredUser {
  user_id: number;
  full_name: string;
  email: string;
  role: string;
}

function formatMoney(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ---- ikonlar ----
const ip = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
function IconMail() { return <svg {...ip}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>; }
function IconTeams() { return <svg {...ip}><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>; }
function IconCheckCircle() { return <svg {...ip} width="22" height="22" stroke="#16A34A"><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.5 2.5 5-5" /></svg>; }
function IconAzure() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M9.5 3h5.2l-6 15.5H3L9.5 3Z" fill="#0078D4" />
      <path d="M15 3 9.3 17 21 21l-9-13.5L15 3Z" fill="#50AAE9" />
    </svg>
  );
}

// Her satırdaki E-posta/Teams butonlarını TEK bir "Bildir" menüsünde
// birleştiren bileşen -- tıklanınca iki seçenek (E-posta / Teams) açılır.
function NotifyMenu({
  onEmail,
  onTeams,
  hasTeamsWebhook,
  sendingEmail,
  sendingTeams,
  label,
  emailLabel,
  teamsLabel,
  sendingLabel,
}: {
  onEmail: () => void;
  onTeams: () => void;
  hasTeamsWebhook: boolean;
  sendingEmail: boolean;
  sendingTeams: boolean;
  label: string;
  emailLabel: string;
  teamsLabel: string;
  sendingLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const busy = sendingEmail || sendingTeams;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        className="text-xs font-medium rounded-lg px-4 py-2 transition disabled:opacity-50 flex items-center gap-1.5"
        style={{ background: "#EAF1FE", border: "1px solid #D6E4FB", color: "#2563EB" }}
      >
        {busy ? sendingLabel : label}
        {!busy && <span className="text-[9px]">{open ? "▴" : "▾"}</span>}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full mt-1.5 w-44 bg-white dark:bg-gray-900 rounded-xl py-1.5 z-20"
            style={{ border: "1px solid #D6E4FB", boxShadow: "0 8px 24px rgba(0,0,0,0.1)" }}
          >
            <button
              onClick={() => {
                setOpen(false);
                onEmail();
              }}
              className="w-full text-left px-3.5 py-2.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2 border-b border-gray-100 dark:border-gray-800"
              style={{ color: "#2563EB" }}
            >
              <IconMail /> {emailLabel}
            </button>
            <button
              onClick={() => {
                if (!hasTeamsWebhook) return;
                setOpen(false);
                onTeams();
              }}
              disabled={!hasTeamsWebhook}
              className={`w-full text-left px-3.5 py-2.5 text-xs flex items-center gap-2 ${
                hasTeamsWebhook
                  ? "hover:bg-gray-50 dark:hover:bg-gray-800"
                  : "text-gray-300 dark:text-gray-600 cursor-not-allowed"
              }`}
              style={hasTeamsWebhook ? { color: "#5B5FC7" } : undefined}
            >
              <IconTeams /> {teamsLabel}
            </button>
          </div>
        </>
      )}
    </div>
  );
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
      getDashboardPeriodSummary("30d", locale, parsedUser.user_id)
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

  // ---- ozet metrikler ----
  const totalAlerts = spikes.length;
  const maxIncrease = spikes.length > 0 ? Math.max(...spikes.map((s) => s.change_pct)) : 0;
  const totalDelta = spikes.reduce((sum, s) => sum + (s.delta || 0), 0);

  return (
    <div className="flex bg-[#F7FFFF] dark:bg-gray-950 min-h-screen">
      <Sidebar pendingCount={0} userName={user?.full_name} userRole={user?.role} userEmail={user?.email} />

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
            <UserMenu userName={user?.full_name} userRole={user?.role} />
          </div>
        </header>

        <main className="p-6 space-y-5">
          {message && (
            <div className="bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 text-sm rounded-xl px-4 py-3">
              {message}
            </div>
          )}

          {!hasTeamsWebhook && (
            <div className="bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs rounded-xl px-4 py-3">
              {t("alerts.noTeamsWebhook")}
            </div>
          )}

          {loading && <p className="text-sm text-gray-400 dark:text-gray-500">{t("common.loading")}</p>}

          {!loading && (
            <>
              {/* ---- 1. Özet metrik kartları ---- */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Toplam Uyarı</div>
                  <div className="text-xl font-bold text-gray-900 dark:text-white">{totalAlerts}</div>
                </div>
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">En Yüksek Artış</div>
                  <div className="text-xl font-bold" style={{ color: "#DC2626" }}>
                    {totalAlerts > 0 ? `%${maxIncrease}` : "—"}
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Toplam Ek Maliyet</div>
                  <div className="text-xl font-bold text-gray-900 dark:text-white">{formatMoney(totalDelta)}</div>
                </div>
              </div>

              {spikes.length === 0 ? (
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-8 text-center">
                  <div className="flex justify-center mb-3"><IconCheckCircle /></div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Önemli bir değişiklik tespit edilmedi</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Yeni bir maliyet artışı olduğunda burada listelenecek.</p>
                </div>
              ) : (
                <>
                  {/* ---- 2. Filtre / toplu aksiyon çubuğu ---- */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t("alerts.description")}</p>
                    <NotifyMenu
                      onEmail={handleSendAll}
                      onTeams={handleSendAllTeams}
                      hasTeamsWebhook={hasTeamsWebhook}
                      sendingEmail={sendingAll}
                      sendingTeams={sendingAllTeams}
                      label={t("alerts.sendAll")}
                      emailLabel={t("alerts.emailOption")}
                      teamsLabel={t("alerts.sendAllTeams")}
                      sendingLabel={t("alerts.sending")}
                    />
                  </div>

                  {/* ---- 3. Uyarı kartları ---- */}
                  <div className="space-y-2.5">
                    {spikes.map((s) => (
                      <div
                        key={s.service_name}
                        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: "#F0F6FF" }}
                          >
                            <IconAzure />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-gray-900 dark:text-white truncate">{s.service_name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Geçen aya göre önemli bir maliyet artışı tespit edildi.</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-6 flex-shrink-0">
                          <div className="text-right">
                            <span
                              className="inline-flex items-center gap-1 text-xs font-semibold rounded-md px-2 py-1"
                              style={{ background: "#FCEBEB", color: "#B91C1C" }}
                            >
                              ↑ %{s.change_pct}
                            </span>
                            <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">+{formatMoney(s.delta)}</div>
                          </div>

                          <NotifyMenu
                            onEmail={() => handleSendOne(s.service_name)}
                            onTeams={() => handleSendOneTeams(s.service_name)}
                            hasTeamsWebhook={hasTeamsWebhook}
                            sendingEmail={sendingOne === s.service_name}
                            sendingTeams={sendingOneTeams === s.service_name}
                            label={t("alerts.notify")}
                            emailLabel={t("alerts.emailOption")}
                            teamsLabel={t("alerts.notifyTeams")}
                            sendingLabel={t("alerts.sending")}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* ---- 4. Boş alan doldurma / bilgilendirme kartı ---- */}
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 text-center">
                    <div className="flex justify-center mb-2"><IconCheckCircle /></div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Diğer servislerde önemli bir değişiklik tespit edilmedi</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">Yeni bir maliyet artışı olduğunda burada listelenecek.</p>
                  </div>
                </>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}