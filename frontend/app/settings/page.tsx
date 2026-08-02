"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTheme } from "next-themes";
import Sidebar from "@/components/Sidebar";
import { useLanguage } from "@/lib/i18n";

interface StoredUser {
  user_id: number;
  full_name: string;
  email: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { t, locale, setLocale } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);

  useEffect(() => {
    setMounted(true);
    const raw = localStorage.getItem("costbot_user");
    if (raw) setUser(JSON.parse(raw));
  }, []);

  function handleLogout() {
    localStorage.removeItem("costbot_user");
    router.push("/");
  }

  return (
    <div className="flex bg-gray-50 dark:bg-gray-950 min-h-screen">
      <Sidebar pendingCount={0} userName={user?.full_name} />

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