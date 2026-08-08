"use client";
import CloudVisibilityIcon from "./icons/CloudVisibilityIcon";
import SavingsFinderIcon from "./icons/SavingsFinderIcon";
import SpendAnomaliesIcon from "./icons/SpendAnomaliesIcon";
import OptimizationEngineIcon from "./icons/OptimizationEngineIcon";
import FeatureCard from "./FeatureCard";
import { useLanguage } from "@/lib/i18n";

const CARDS = [
  { icon: CloudVisibilityIcon, accent: "#2563EB", key: "cloudVisibility" },
  { icon: SavingsFinderIcon, accent: "#EC4899", key: "savingsFinder" },
  { icon: SpendAnomaliesIcon, accent: "#2563EB", key: "spendAnomalies" },
  { icon: OptimizationEngineIcon, accent: "#A855F7", key: "optimizationEngine" },
];

export default function Features() {
  const { t } = useLanguage();

  return (
    <section
      id="ozellikler"
      className="px-6 md:px-12 py-24"
      style={{ background: "#06070A" }}
    >
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-4 tracking-tight">
          {t("features.premium.title")}
        </h2>
        <p className="text-center max-w-2xl mx-auto mb-16" style={{ color: "rgba(255,255,255,0.55)" }}>
          {t("features.premium.subtitle")}
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {CARDS.map((c) => (
            <FeatureCard
              key={c.key}
              icon={c.icon}
              accent={c.accent}
              title={t(`features.premium.${c.key}.title`)}
              desc={t(`features.premium.${c.key}.desc`)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}