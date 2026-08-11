"use client";
import { useLanguage } from "@/lib/i18n";

const BANDS = [
  { bg: "#B8A9EA", textColor: "#3B1D82", valueKey: "band1", labelKey: "band1", numberFirst: true },
  { bg: "#CBC0F0", textColor: "#4C1D95", valueKey: "band2", labelKey: "band2", numberFirst: false },
  { bg: "#DDD5F5", textColor: "#5B21B6", valueKey: "band3", labelKey: "band3", numberFirst: true },
  { bg: "#EEE9FB", textColor: "#6D28D9", valueKey: "band4", labelKey: "band4", numberFirst: false },
];

export default function AutomateEfficiency() {
  const { t } = useLanguage();

  return (
    <section className="px-6 md:px-12 py-24 bg-[#F5F5F7] dark:bg-gray-950">
      <div className="max-w-6xl mx-auto grid md:grid-cols-5 gap-10 items-center">
        {/* Sol: baslik + aciklama */}
        <div className="md:col-span-2">
          <h2 className="text-3xl md:text-4xl font-medium text-gray-900 dark:text-white leading-tight mb-6">
            {t("efficiency.title")}
          </h2>
          <p className="text-[#6B6B76] dark:text-gray-400 leading-relaxed">
            {t("efficiency.subtitle")}
          </p>
        </div>

        {/* Sag: 5 banttan olusan dikey istatistik seridi */}
        <div className="md:col-span-3 rounded-3xl overflow-hidden">
          {BANDS.map((b, i) => (
            <div
              key={i}
              className="flex flex-col sm:flex-row items-center sm:justify-between gap-2 px-8 py-6 text-center sm:text-left"
              style={{ background: b.bg }}
            >
              {b.numberFirst ? (
                <>
                  <span className="text-6xl md:text-7xl font-black leading-none" style={{ color: b.textColor }}>
                    {t(`efficiency.${b.valueKey}.value`)}
                  </span>
                  <p className="text-sm leading-snug text-center sm:text-right max-w-[180px]" style={{ color: b.textColor, opacity: 0.8 }}>
                    {t(`efficiency.${b.labelKey}.label`)}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm leading-snug text-center sm:text-left max-w-[180px]" style={{ color: b.textColor, opacity: 0.8 }}>
                    {t(`efficiency.${b.labelKey}.label`)}
                  </p>
                  <span className="text-6xl md:text-7xl font-black leading-none" style={{ color: b.textColor }}>
                    {t(`efficiency.${b.valueKey}.value`)}
                  </span>
                </>
              )}
            </div>
          ))}

          {/* Son bant: canli gradient, vurgulu kapanis -- diger bantlarla
              AYNI koyu mor renk tonu (#3B1D82) kullaniliyor, beyaz DEGIL */}
          <div
            className="flex flex-col sm:flex-row items-center sm:justify-between gap-2 px-8 py-8 text-center sm:text-left"
            style={{ background: "linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)" }}
          >
            <div className="flex items-start gap-1">
              <span className="text-6xl md:text-7xl font-black leading-none" style={{ color: "#3B1D82" }}>
                {t("efficiency.band5.value")}
              </span>
            </div>
            <p className="text-sm leading-snug text-center sm:text-right max-w-[180px]" style={{ color: "#3B1D82", opacity: 0.8 }}>
              {t("efficiency.band5.label")}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}