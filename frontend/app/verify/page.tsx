"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { verifyCode, resendCode } from "@/lib/api";
import { useLanguage } from "@/lib/i18n";
import Logo from "@/components/Logo";

function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const email = searchParams.get("email") || "";
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await verifyCode(email, code);
      localStorage.setItem("costbot_user", JSON.stringify(user));
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError("");
    setInfo("");
    setResending(true);
    try {
      await resendCode(email);
      setInfo(t("verify.resent"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu.");
    } finally {
      setResending(false);
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
            <div className="text-3xl mb-2">📧</div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{t("verify.title")}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t("verify.subtitle")} <span className="font-medium text-gray-700 dark:text-gray-300">{email}</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">{t("verify.codeLabel")}</label>
              <input
                type="text" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required maxLength={6} inputMode="numeric" placeholder="000000"
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-center text-2xl tracking-[0.5em] font-bold rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs rounded-lg px-3 py-2.5">
                <span>⚠️</span><span>{error}</span>
              </div>
            )}
            {info && (
              <div className="flex items-start gap-2 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-900 text-green-700 dark:text-green-300 text-xs rounded-lg px-3 py-2.5">
                <span>✓</span><span>{info}</span>
              </div>
            )}

            <button
              type="submit" disabled={loading || code.length !== 6}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed dark:shadow-[0_0_20px_rgba(59,130,246,0.35)]"
            >
              {loading ? t("verify.verifying") : t("verify.submit")}
            </button>
          </form>

          <button
            onClick={handleResend} disabled={resending}
            className="w-full text-center text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline mt-5 disabled:opacity-50"
          >
            {resending ? t("verify.resending") : t("verify.resend")}
          </button>
        </div>

        <Link href="/" className="block text-center text-xs text-gray-400 dark:text-gray-500 mt-6 hover:text-gray-600 dark:hover:text-gray-300">
          {t("login.backHome")}
        </Link>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyForm />
    </Suspense>
  );
}