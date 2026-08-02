"use client";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { useLanguage } from "@/lib/i18n";
import Link from "next/link";
import Logo from "@/components/Logo";

export default function Navbar() {
  const { theme, setTheme } = useTheme();
  const { locale, setLocale, t } = useLanguage();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <nav className="flex items-center justify-between px-6 md:px-12 py-5 max-w-7xl mx-auto">
      <div className="flex items-center gap-2 font-bold text-lg text-white">
        <Logo size={36} forceWhite />
        CostBot
      </div>
      <div className="hidden md:flex items-center gap-8 text-sm text-gray-300">
        <a href="#nasil-calisir" className="hover:text-white">{t("nav.howItWorks")}</a>
        <a href="#ozellikler" className="hover:text-white">{t("nav.features")}</a>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => setLocale(locale === "tr" ? "en" : "tr")}
          aria-label="Dili değiştir"
          className="text-xs font-semibold text-gray-300 border border-white/25 rounded-lg px-2.5 py-1.5 hover:bg-white/10"
        >
          {locale === "tr" ? "TR" : "EN"} <span className="opacity-40">|</span> {locale === "tr" ? "EN" : "TR"}
        </button>

        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Tema değiştir"
          className="w-9 h-9 rounded-lg border border-white/25 flex items-center justify-center text-gray-300 hover:bg-white/10"
        >
          {mounted && (theme === "dark" ? "☀️" : "🌙")}
        </button>

        <Link href="/login" className="text-sm font-medium text-gray-200 border border-white/25 rounded-lg px-4 py-2 hover:bg-white/10">
          {t("nav.login")}
        </Link>
        <Link href="/register" className="text-sm font-medium text-white bg-blue-600 rounded-lg px-4 py-2 hover:bg-blue-700">
          {t("nav.register")}
        </Link>
      </div>
    </nav>
  );
}