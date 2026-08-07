"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
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

export default function ReportsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { t, locale } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [history, setHistory] = useState<ReportHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [granularity, setGranularity] = useState<Granularity>(undefined);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [clearing, setClearing] = useState(false);

  // ---- Zamanlanmış raporlar (çoklu liste) ----
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

  function handleLogout() {
    localStorage.removeItem("costbot_user");
    router.push("/");
  }

  const GRANULARITY_OPTIONS: { value: Granularity; label: string }[] = [
    { value: "day", label: t("reports.periodDay") },
    { value: "week", label: t("reports.periodWeek") },
    { value: "this_month", label: t("reports.periodThisMonth") },
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
            <UserMenu userName={user?.full_name} userRole={user?.role} />
          </div>
        </header>

        <main className="p-6 max-w-4xl">
          {/* ---- Anlık rapor oluşturma ---- */}
          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-500/10 dark:to-cyan-500/10 border border-blue-100 dark:border-blue-500/20 rounded-2xl p-5 mb-6">
            <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white">{t("reports.newReportTitle")}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t("reports.newReportDesc")}</p>
              </div>
              <a
                href={getReportDownloadUrl(locale, user?.user_id, granularity)}
                className="flex items-center gap-1.5 text-sm font-medium bg-blue-100 hover:bg-blue-200 dark:bg-blue-500/20 dark:hover:bg-blue-500/30 text-blue-700 dark:text-blue-300 rounded-lg px-4 py-2.5 transition"
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

          {/* ---- Zamanlanmış raporlar (çoklu liste) ---- */}
          {schedulesLoaded && (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 mb-6">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg">⏰</span>
                  <h2 className="font-semibold text-gray-900 dark:text-white">Zamanlanmış Raporlar</h2>
                </div>
                {editingId === null && schedules.length < MAX_SCHEDULES && (
                  <button
                    onClick={startCreating}
                    className="text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3 py-1.5 transition"
                  >
                    + Yeni Ekle
                  </button>
                )}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Farklı sıklıklar için (ör. hem haftalık hem aylık), farklı alıcılara otomatik PDF rapor gönderin. En fazla {MAX_SCHEDULES} tane.
              </p>

              {/* Liste görünümü -- düzenleme modunda olmayan kayıtlar */}
              {schedules.length === 0 && editingId === null && (
                <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">
                  Henüz zamanlanmış bir rapor yok.
                </p>
              )}

              <div className="space-y-2">
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
                        className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 flex items-center justify-between flex-wrap gap-3"
                      >
                        <div className="text-sm text-gray-700 dark:text-gray-300">
                          <span className="font-medium text-gray-900 dark:text-white">
                            {s.Name || granularityLabel(s.Granularity)}
                          </span>
                          {!s.Enabled && (
                            <span className="ml-2 text-[10px] bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full px-2 py-0.5">
                              Pasif
                            </span>
                          )}
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {granularityLabel(s.Granularity)}
                            {s.Granularity === "week" && ` · ${WEEKDAYS.find((d) => d.value === s.DayOfWeek)?.label}`}
                            {(s.Granularity === "month" || s.Granularity === "this_month") && ` · Ayın ${s.DayOfMonth}'i`}
                            {` · Saat ${s.TimeOfDay}`}
                          </div>
                          <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                            {s.recipients.length} alıcı: {s.recipients.join(", ")}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEditing(s)}
                            className="text-xs font-medium bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                          >
                            ✎ Düzenle
                          </button>
                          <button
                            onClick={() => handleDeleteSchedule(s.ScheduleId)}
                            disabled={saving}
                            className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                          >
                            Sil
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
            </div>
          )}

          {/* ---- Geçmiş raporlar ---- */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t("reports.historyTitle")}</h3>
              {!loading && history.length > 0 && (
                <button
                  onClick={handleClearAll}
                  disabled={clearing}
                  className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                >
                  {clearing ? t("common.loading") : t("reports.clearAll")}
                </button>
              )}
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

// ---- Zamanlanmış rapor ekleme/düzenleme formu (tekrar kullanılabilir) ----
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
      {/* İsim */}
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

      {/* Aktif/pasif */}
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

      {/* Sıklık */}
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
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Saat</label>
        <input
          type="time"
          value={form.time_of_day}
          onChange={(e) => setForm((f) => ({ ...f, time_of_day: e.target.value }))}
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
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