"use client";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n";
import Logo from "../Logo";

export default function ClosingCTA() {
  const { t } = useLanguage();

  return (
    <div style={{ background: "#06070A" }}>
      <section className="px-6 md:px-12 py-16 max-w-5xl mx-auto">
        <div className="md:flex items-center justify-between gap-8">
          <div className="mb-6 md:mb-0"><Logo size={60} forceWhite /></div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-white mb-2">{t("closingCTA.title")}</h2>
            <p className="text-sm mb-5" style={{ color: "#B8B8C0" }}>
              {t("closingCTA.desc")}
            </p>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 text-white font-semibold rounded-xl px-5 py-3 hover:brightness-110 transition"
              style={{ background: "#7C3AED" }}
            >
              {t("closingCTA.cta")}
            </Link>
            <p className="text-xs mt-3" style={{ color: "#8B8B93" }}>{t("closingCTA.disclaimer")}</p>
          </div>
        </div>
      </section>

      <footer className="border-t px-6 md:px-12 py-8 max-w-5xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 text-sm" style={{ borderColor: "#222226" }}>
        <div>
          <div className="font-semibold text-white flex items-center gap-2"><Logo size={20} forceWhite /> CostBot</div>
          <p className="text-xs max-w-xs" style={{ color: "#8B8B93" }}>{t("closingCTA.footerDesc")}</p>
        </div>
        <div className="flex gap-6 text-xs" style={{ color: "#9B9BA3" }}>
          <Link href="/login" className="hover:text-white transition">{t("nav.login")}</Link>
          <Link href="/register" className="hover:text-white transition">{t("nav.register")}</Link>
        </div>
      </footer>
      <p className="text-center text-xs pb-6" style={{ color: "#4B4B52" }}>{t("closingCTA.rights")}</p>
    </div>
  );
}