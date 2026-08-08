"use client";

import { useEffect, useState, useCallback } from "react";
import { useTheme } from "next-themes";
import Sidebar from "@/components/Sidebar";
import {
  getReportHistory,
  getReportDownloadUrl,
  deleteReportHistoryItem,
  clearReportHistory,
  listScheduledReports,
  createScheduledReport,
  updateScheduledReport,
  deleteScheduledReport,
  ReportHistoryItem,
  ScheduledReport,
  ScheduledReportInput,
} from "@/lib/api";
import { useLanguage } from "@/lib/i18n";
import UserMenu from "@/components/UserMenu";

interface StoredUser {
  user_id: number;
  full_name: string;
  email: string;
  role: string;
}

type Granularity = "day" | "week" | "month" | "this_month" | undefined;

const WEEKDAYS = [
  { value: 1, label: "Pazartesi" },
  { value: 2, label: "Salı" },
  { value: 3, label: "Çarşamba" },
  { value: 4, label: "Perşembe" },
  { value: 5, label: "Cuma" },
  { value: 6, label: "Cumartesi" },
  { value: 7, label: "Pazar" },
];

const MAX_SCHEDULES = 5;

function granularityLabel(g: string) {
  return g === "day" ? "Günlük" : g === "week" ? "Haftalık" : g === "this_month" ? "Bu Ay" : "Aylık";
}

function emptyFormState(userEmail: string): ScheduledReportInput {
  return {
    name: null,
    enabled: true,
    granularity: "week",
    day_of_week: 1,
    day_of_month: null,
    time_of_day: "09:00",
    recipients: [userEmail],
    language: "tr",
  };
}

// ---- Basit line-style ikonlar ----
const ip = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
function IconFile() { return <svg {...ip}><path d="M14.5 2H6a1 1 0 0 0-1 1v18a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8.5L14.5 2Z"/><path d="M14 2v6h6"/></svg>; }
function IconClock() { return <svg {...ip}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>; }
function IconDownload() { return <svg {...ip}><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>; }
function IconPlus() { return <svg {...ip}><path d="M12 5v14M5 12h14"/></svg>; }
function IconTrash() { return <svg {...ip}><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6"/></svg>; }
function IconSearch() { return <svg {...ip}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>; }
function IconCalendarOff() { return <svg {...ip} width="24" height="24"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 10h18"/><path d="m9 15 6 5M15 15l-6 5"/></svg>; }

export default function ReportsPage() {
  const { theme, setTheme } = useTheme();
  const { t, locale } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [history, setHistory] = useState<ReportHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [clearing, setClearing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [schedules, setSchedules] = useState<ScheduledReport[]>([]);
  const [schedulesLoaded, setSchedulesLoaded] = useState(false);
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [form, setForm] = useState<ScheduledReportInput>(emptyFormState(""));
  const [newRecipient, setNewRecipient] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const loadHistory = useCallback((userId: number) => {
    setLoading(true);
    getReportHistory(userId)
      .then(setHistory)
      .finally(() => setLoading(false));
  }, []);

  const loadSchedules = useCallback((userId: number) => {
    listScheduledReports(userId)
      .then(setSchedules)
      .finally(() => setSchedulesLoaded(true));
  }, []);

  useEffect(() => {
    setMounted(true);
    const raw = localStorage.getItem("costbot_user");
    const parsedUser: StoredUser | null = raw ? JSON.parse(raw) : null;
    if (parsedUser) {
      setUser(parsedUser);
      loadHistory(parsedUser.user_id);
      loadSchedules(parsedUser.user_id);
    } else {
      setLoading(false);
      setSchedulesLoaded(true);
    }
  }, [loadHistory, loadSchedules]);

  async function handleDeleteOne(reportId: number) {
    if (!user) return;
    if (!window.confirm(t("reports.deleteConfirm"))) return;
    setDeletingId(reportId);
    try {
      await deleteReportHistoryItem(reportId, user.user_id);
      setHistory((prev) => prev.filter((h) => h.ReportId !== reportId));
    } finally {
      setDeletingId(null);
    }
  }

  async function handleClearAll() {
    if (!user) return;
    if (!window.confirm(t("reports.clearAllConfirm"))) return;
    setClearing(true);
    try {
      await clearReportHistory(user.user_id);
      setHistory([]);
    } finally {
      setClearing(false);
    }
  }

  function startCreating() {
    if (!user) return;
    setForm(emptyFormState(user.email));
    setEditingId("new");
    setMessage("");
  }

  function startEditing(s: ScheduledReport) {
    setForm({
      name: s.Name,
      enabled: s.Enabled,
      granularity: s.Granularity,
      day_of_week: s.DayOfWeek,
      day_of_month: s.DayOfMonth,
      time_of_day: s.TimeOfDay,
      recipients: s.recipients,
      language: s.Language,
    });
    setEditingId(s.ScheduleId);
    setMessage("");
  }

  function cancelEditing() {
    setEditingId(null);
    setNewRecipient("");
    setMessage("");
  }

  function addRecipient() {
    const email = newRecipient.trim();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMessage("Geçerli bir e-posta adresi girin.");
      return;
    }
    if (form.recipients.includes(email)) {
      setNewRecipient("");
      return;
    }
    setForm((f) => ({ ...f, recipients: [...f.recipients, email] }));
    setNewRecipient("");
    setMessage("");
  }

  function removeRecipient(email: string) {
    setForm((f) => ({ ...f, recipients: f.recipients.filter((r) => r !== email) }));
  }

  async function handleSave() {
    if (!user) return;
    setMessage("");
    setSaving(true);
    try {
      const body: ScheduledReportInput = {
        ...form,
        day_of_week: form.granularity === "week" ? form.day_of_week : null,
        day_of_month: (form.granularity === "month" || form.granularity === "this_month") ? form.day_of_month : null,
        language: locale,
      };
      if (editingId === "new") {
        await createScheduledReport(user.user_id, body);
      } else if (typeof editingId === "number") {
        await updateScheduledReport(user.user_id, editingId, body);
      }
      loadSchedules(user.user_id);
      setEditingId(null);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Bir hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSchedule(scheduleId: number) {
    if (!user) return;
    if (!window.confirm("Bu zamanlanmış raporu silmek istediğinize emin misiniz?")) return;
    setSaving(true);
    try {
      await deleteScheduledReport(user.user_id, scheduleId);
      setSchedules((prev) => prev.filter((s) => s.ScheduleId !== scheduleId));
    } finally {
      setSaving(false);
    }
  }

  const GRANULARITY_OPTIONS: { value: Granularity; label: string }[] = [
    { value: "day", label: t("reports.periodDay") },
    { value: "week", label: t("reports.periodWeek") },
    { value: "this_month", label: t("reports.periodThisMonth") },
    { value: "month", label: t("reports.periodMonth") },
  ];

  // ---- Ozet metrikler ----
  const now = new Date();
  const thisMonthCount = history.filter((h) => {
    const d = new Date(h.GeneratedDate);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;
  const lastReportDate = history[0]?.GeneratedDate
    ? new Date(history[0].GeneratedDate).toLocaleDateString("tr-TR")
    : "—";

  const filteredHistory = history.filter((h) =>
    h.Period.toLowerCase().includes(searchQuery.toLowerCase())
  );

  function periodBadgeStyle(period: string) {
    const isDaily = period.includes("day") || period.includes("daily");
    return isDaily
      ? { bg: "#F3F4F6", text: "#374151" }
      : { bg: "#EAF1FE", text: "#1D4ED8" };
  }

  return (
    <div className="flex bg-[#F0FAF9] dark:bg-gray-950 min-h-screen">
      <Sidebar pendingCount={0} userName={user?.full_name} userRole={user?.role} userEmail={user?.email} />

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
            <UserMenu userName={user?.full_name} userRole={user?.role} />
          </div>
        </header>

        <main className="p-6 space-y-5">
          {/* ---- 1. Özet metrik kartları ---- */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Toplam Rapor", value: String(history.length) },
              { label: "Bu Ay Oluşturulan", value: String(thisMonthCount) },
              { label: "Zamanlanmış Rapor", value: `${schedules.length} / ${MAX_SCHEDULES}` },
              { label: "Son Rapor", value: lastReportDate },
            ].map((m) => (
              <div key={m.label} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{m.label}</div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">{m.value}</div>
              </div>
            ))}
          </div>

          {/* ---- 2. Yeni rapor + Zamanlanmış raporlar (yan yana) ---- */}
          <div className="grid lg:grid-cols-[1.6fr_1fr] gap-4">
            {/* Sol: Yeni rapor oluştur */}
            <div className="rounded-xl p-6" style={{ background: "#EAF1FE", border: "1px solid #D6E4FB" }}>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white flex-shrink-0" style={{ background: "#2563EB" }}>
                  <IconFile />
                </div>
                <h2 className="font-bold text-gray-900 text-[15px]">{t("reports.newReportTitle")}</h2>
              </div>
              <p className="text-sm text-gray-600 mb-4">{t("reports.newReportDesc")}</p>

              <div className="mb-5">
                <div className="text-xs font-semibold text-gray-600 mb-2">{t("reports.periodLabel")}</div>
                <div className="flex flex-wrap gap-2">
                  {GRANULARITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => setGranularity(opt.value)}
                      className="text-xs font-medium px-3 py-1.5 rounded-full border transition"
                      style={
                        granularity === opt.value
                          ? { background: "#fff", borderColor: "#2563EB", color: "#2563EB" }
                          : { background: "transparent", borderColor: "#D1D5DB", color: "#6B7280" }
                      }
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <a
                href={getReportDownloadUrl(locale, user?.user_id, granularity)}
                className="inline-flex items-center gap-2 text-sm font-semibold text-white rounded-lg px-5 py-2.5 hover:brightness-110 transition"
                style={{ background: "#2563EB" }}
              >
                <IconDownload /> {t("reports.generate")}
              </a>
            </div>

            {/* Sağ: Zamanlanmış raporlar */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 flex flex-col">
              <div className="flex items-center gap-2 mb-2 text-gray-900 dark:text-white">
                <IconClock />
                <h2 className="font-bold text-[15px]">Zamanlanmış Raporlar</h2>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 leading-relaxed">
                Farklı sıklıklarda, farklı alıcılara otomatik PDF rapor gönderin. En fazla {MAX_SCHEDULES} tane.
              </p>

              {schedulesLoaded && (
                <div className="flex-1 flex flex-col">
                  {editingId === null && schedules.length === 0 && (
                    <div
                      className="flex-1 flex flex-col items-center justify-center gap-2 rounded-lg py-8 mb-4"
                      style={{ border: "1.5px dashed #D1D5DB" }}
                    >
                      <span className="text-gray-300 dark:text-gray-600"><IconCalendarOff /></span>
                      <p className="text-xs text-gray-400 dark:text-gray-500">Henüz zamanlanmış bir rapor yok.</p>
                    </div>
                  )}

                  <div className="space-y-2 mb-4">
                    {schedules.map((s) =>
                      editingId === s.ScheduleId ? (
                        <ScheduleForm
                          key={s.ScheduleId}
                          form={form}
                          setForm={setForm}
                          newRecipient={newRecipient}
                          setNewRecipient={setNewRecipient}
                          addRecipient={addRecipient}
                          removeRecipient={removeRecipient}
                          onSave={handleSave}
                          onCancel={cancelEditing}
                          saving={saving}
                          message={message}
                        />
                      ) : (
                        editingId === null && (
                          <div
                            key={s.ScheduleId}
                            className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 flex items-center justify-between gap-2"
                          >
                            <div className="text-xs text-gray-700 dark:text-gray-300 min-w-0">
                              <span className="font-medium text-gray-900 dark:text-white truncate block">
                                {s.Name || granularityLabel(s.Granularity)}
                              </span>
                              <span className="text-gray-400 dark:text-gray-500">
                                {granularityLabel(s.Granularity)} · {s.TimeOfDay}
                              </span>
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                              <button onClick={() => startEditing(s)} className="text-[11px] font-medium text-gray-600 dark:text-gray-300 hover:underline">✎</button>
                              <button onClick={() => handleDeleteSchedule(s.ScheduleId)} disabled={saving} className="text-[11px] font-medium text-red-600 dark:text-red-400 hover:underline disabled:opacity-50">
                                <IconTrash />
                              </button>
                            </div>
                          </div>
                        )
                      )
                    )}

                    {editingId === "new" && (
                      <ScheduleForm
                        form={form}
                        setForm={setForm}
                        newRecipient={newRecipient}
                        setNewRecipient={setNewRecipient}
                        addRecipient={addRecipient}
                        removeRecipient={removeRecipient}
                        onSave={handleSave}
                        onCancel={cancelEditing}
                        saving={saving}
                        message={message}
                      />
                    )}
                  </div>

                  {editingId === null && schedules.length < MAX_SCHEDULES && (
                    <button
                      onClick={startCreating}
                      className="w-full text-sm font-medium rounded-lg py-2.5 border transition hover:bg-blue-50 dark:hover:bg-blue-500/10 flex items-center justify-center gap-1.5"
                      style={{ borderColor: "#2563EB", color: "#2563EB" }}
                    >
                      <IconPlus /> Yeni Ekle
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ---- 3. Geçmiş raporlar ---- */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex-wrap gap-3">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">{t("reports.historyTitle")}</h3>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"><IconSearch /></span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Dönem ara..."
                    className="text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg pl-8 pr-3 py-1.5 w-40 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 dark:text-gray-300"
                  />
                </div>
                {!loading && history.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    disabled={clearing}
                    className="flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                  >
                    <IconTrash /> {clearing ? t("common.loading") : t("reports.clearAll")}
                  </button>
                )}
              </div>
            </div>

            {loading && <p className="text-sm text-gray-400 dark:text-gray-500 px-5 py-6">{t("common.loading")}</p>}

            {!loading && filteredHistory.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-10">{t("reports.empty")}</p>
            )}

            {!loading && filteredHistory.length > 0 && (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800">
                    <th className="text-left font-medium px-5 py-3 uppercase tracking-wide">{t("reports.period")}</th>
                    <th className="text-left font-medium px-5 py-3 uppercase tracking-wide">{t("reports.language")}</th>
                    <th className="text-left font-medium px-5 py-3 uppercase tracking-wide">{t("reports.date")}</th>
                    <th className="text-right font-medium px-5 py-3 uppercase tracking-wide">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((h) => {
                    const badge = periodBadgeStyle(h.Period);
                    return (
                      <tr key={h.ReportId} className="border-b border-gray-50 dark:border-gray-800/50 last:border-0">
                        <td className="px-5 py-3">
                          <span
                            className="inline-block text-[11px] font-medium rounded-full px-2.5 py-1"
                            style={{ background: badge.bg, color: badge.text }}
                          >
                            {h.Period}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-600 dark:text-gray-300 uppercase">{h.Language}</td>
                        <td className="px-5 py-3 text-gray-400 dark:text-gray-500">{h.GeneratedDate}</td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <a
                              href={getReportDownloadUrl(h.Language, user?.user_id)}
                              className="text-blue-600 dark:text-blue-400 font-medium hover:underline"
                            >
                              {t("reports.download")}
                            </a>
                            <button
                              onClick={() => handleDeleteOne(h.ReportId)}
                              disabled={deletingId === h.ReportId}
                              aria-label={t("reports.deleteOne")}
                              className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 disabled:opacity-40 transition"
                            >
                              ✕
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

// ---- Zamanlanmış rapor ekleme/düzenleme formu ----
function ScheduleForm({
  form, setForm, newRecipient, setNewRecipient, addRecipient, removeRecipient,
  onSave, onCancel, saving, message,
}: {
  form: ScheduledReportInput;
  setForm: React.Dispatch<React.SetStateAction<ScheduledReportInput>>;
  newRecipient: string;
  setNewRecipient: (v: string) => void;
  addRecipient: () => void;
  removeRecipient: (email: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  message: string;
}) {
  return (
    <div className="border border-blue-200 dark:border-blue-500/30 bg-blue-50/40 dark:bg-blue-500/[0.04] rounded-xl p-4 space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">İsim (opsiyonel)</label>
        <input
          type="text"
          value={form.name || ""}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value || null }))}
          placeholder="Örn. Yönetim Ekibi Haftalık"
          className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setForm((f) => ({ ...f, enabled: !f.enabled }))}
          className={`relative rounded-full transition ${form.enabled ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"}`}
          style={{ width: "36px", height: "20px" }}
        >
          <span
            className={`absolute top-0.5 left-0.5 bg-white rounded-full shadow transition-transform ${form.enabled ? "translate-x-4" : "translate-x-0"}`}
            style={{ width: "16px", height: "16px" }}
          />
        </button>
        <span className="text-xs text-gray-600 dark:text-gray-400">{form.enabled ? "Aktif" : "Pasif"}</span>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Sıklık</label>
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 w-fit">
          {(["day", "week", "this_month", "month"] as const).map((g) => (
            <button
              key={g}
              onClick={() => setForm((f) => ({ ...f, granularity: g }))}
              className={`text-xs px-3 py-1.5 rounded-md transition ${
                form.granularity === g
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-400 dark:text-gray-500"
              }`}
            >
              {granularityLabel(g)}
            </button>
          ))}
        </div>
      </div>

      {form.granularity === "week" && (
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Hangi gün</label>
          <select
            value={form.day_of_week ?? 1}
            onChange={(e) => setForm((f) => ({ ...f, day_of_week: Number(e.target.value) }))}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {WEEKDAYS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
      )}

      {(form.granularity === "month" || form.granularity === "this_month") && (
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Ayın kaçında</label>
          <select
            value={form.day_of_month ?? 1}
            onChange={(e) => setForm((f) => ({ ...f, day_of_month: Number(e.target.value) }))}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Saat (24 saat formatı)</label>
        <div className="flex items-center gap-2">
          <select
            value={form.time_of_day.split(":")[0] ?? "09"}
            onChange={(e) => {
              const minute = form.time_of_day.split(":")[1] ?? "00";
              setForm((f) => ({ ...f, time_of_day: `${e.target.value}:${minute}` }));
            }}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
          <span className="text-gray-400 dark:text-gray-500 font-medium">:</span>
          <select
            value={form.time_of_day.split(":")[1] ?? "00"}
            onChange={(e) => {
              const hour = form.time_of_day.split(":")[0] ?? "09";
              setForm((f) => ({ ...f, time_of_day: `${hour}:${e.target.value}` }));
            }}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")).map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Alıcılar</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {form.recipients.map((email) => (
            <span
              key={email}
              className="inline-flex items-center gap-1 text-xs bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 rounded-full pl-3 pr-1.5 py-1"
            >
              {email}
              <button
                onClick={() => removeRecipient(email)}
                className="w-4 h-4 rounded-full hover:bg-blue-200 dark:hover:bg-blue-500/30 flex items-center justify-center"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="email"
            value={newRecipient}
            onChange={(e) => setNewRecipient(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addRecipient(); } }}
            placeholder="ornek@sirket.com"
            className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={addRecipient}
            className="text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg px-4 py-2 hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            Ekle
          </button>
        </div>
      </div>

      {message && (
        <p className={`text-xs ${message.startsWith("✓") ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
          {message}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={onSave}
          disabled={saving}
          className="text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2.5 disabled:opacity-50 transition"
        >
          {saving ? "Kaydediliyor..." : "Kaydet"}
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:underline disabled:opacity-50"
        >
          İptal
        </button>
      </div>
    </div>
  );
}