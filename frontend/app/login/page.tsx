"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loginUser } from "@/lib/api";
import { useLanguage } from "@/lib/i18n";
import Logo from "@/components/Logo";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await loginUser(email, password);
      localStorage.setItem("costbot_user", JSON.stringify(user));
      router.push("/dashboard");
    } catch (err) {
      const status = (err as Error & { status?: number }).status;
      if (status === 403) {
        router.push(`/verify?email=${encodeURIComponent(email)}`);
        return;
      }
      setError(err instanceof Error ? err.message : "Bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-32 -right-32 w-80 h-80 bg-blue-400/20 dark:bg-blue-500/10 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-32 w-80 h-80 bg-violet-400/20 dark:bg-violet-500/10 rounded-full blur-3xl" />

      <div className="relative w-full max-w-sm">
        <Link href="/" className="flex items-center justify-center gap-2 mb-8 text-gray-900 dark:text-white font-bold text-lg">
          <Logo size={48} />
          CostBot
        </Link>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl dark:shadow-[0_0_40px_rgba(59,130,246,0.06)] p-8">
          <div className="text-center mb-7">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{t("login.title")}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t("login.subtitle")}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">{t("login.email")}</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                placeholder={t("login.emailPlaceholder")}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">{t("login.password")}</label>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                placeholder={t("login.passwordPlaceholder")}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            <div className="text-right">
              <Link href="/forgot-password" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                {t("login.forgotPassword")}
              </Link>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs rounded-lg px-3 py-2.5">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit" disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed dark:shadow-[0_0_20px_rgba(59,130,246,0.35)]"
            >
              {loading ? t("login.submitting") : t("login.submit")}
            </button>
          </form>

          <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-6">
            {t("login.noAccount")}{" "}
            <Link href="/register" className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">
              {t("nav.register")}
            </Link>
          </p>
        </div>

        <Link href="/" className="block text-center text-xs text-gray-400 dark:text-gray-500 mt-6 hover:text-gray-600 dark:hover:text-gray-300">
          {t("login.backHome")}
        </Link>
      </div>
    </div>
  );
}