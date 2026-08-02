"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { requestPasswordReset } from "@/lib/api";
import { useLanguage } from "@/lib/i18n";
import Logo from "@/components/Logo";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await requestPasswordReset(email);
      router.push(`/reset-password?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-32 -left-32 w-80 h-80 bg-blue-400/20 dark:bg-blue-500/10 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 w-80 h-80 bg-cyan-400/20 dark:bg-cyan-500/10 rounded-full blur-3xl" />

      <div className="relative w-full max-w-sm">
        <Link href="/" className="flex items-center justify-center gap-2 mb-8 text-gray-900 dark:text-white font-bold text-lg">
          <Logo size={48} />
          CostBot
        </Link>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl dark:shadow-[0_0_40px_rgba(59,130,246,0.06)] p-8">
          <div className="text-center mb-7">
            <div className="text-3xl mb-2">🔑</div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{t("forgotPassword.title")}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t("forgotPassword.subtitle")}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">{t("login.email")}</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                placeholder={t("register.emailPlaceholder")}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs rounded-lg px-3 py-2.5">
                <span>⚠️</span><span>{error}</span>
              </div>
            )}

            <button
              type="submit" disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed dark:shadow-[0_0_20px_rgba(59,130,246,0.35)]"
            >
              {loading ? t("forgotPassword.sending") : t("forgotPassword.submit")}
            </button>
          </form>

          <Link href="/login" className="block text-center text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline mt-6">
            {t("login.backHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}