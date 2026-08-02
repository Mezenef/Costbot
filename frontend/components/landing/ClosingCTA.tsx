"use client";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n";
import Logo from "../Logo";

export default function ClosingCTA() {
  const { t } = useLanguage();

  return (
    <>
      <section className="px-6 md:px-12 py-16 max-w-5xl mx-auto">
        <div className="bg-gray-50 dark:bg-gray-900 rounded-3xl p-10 md:flex items-center justify-between gap-8">
          <div className="mb-6 md:mb-0"><Logo size={40} /></div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t("closingCTA.title")}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              {t("closingCTA.desc")}
            </p>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 bg-blue-600 text-white font-semibold rounded-xl px-5 py-3 hover:bg-blue-700"
            >
              {t("closingCTA.cta")}
            </Link>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">{t("closingCTA.disclaimer")}</p>
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-100 dark:border-gray-800 px-6 md:px-12 py-8 max-w-5xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 text-sm">
        <div>
          <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-2"><Logo size={20} /> CostBot</div>
          <p className="text-xs text-gray-400 dark:text-gray-500 max-w-xs">{t("closingCTA.footerDesc")}</p>
        </div>
        <div className="flex gap-6 text-gray-500 dark:text-gray-400 text-xs">
          <Link href="/login" className="hover:text-gray-900 dark:hover:text-white">{t("nav.login")}</Link>
          <Link href="/register" className="hover:text-gray-900 dark:hover:text-white">{t("nav.register")}</Link>
        </div>
      </footer>
      <p className="text-center text-xs text-gray-300 dark:text-gray-600 pb-6">{t("closingCTA.rights")}</p>
    </>
  );
}