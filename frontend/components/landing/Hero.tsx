"use client";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Navbar from "./Navbar";
import AnimatedBackground from "./AnimatedBackground";
import { useLanguage } from "@/lib/i18n";
import Logo from "@/components/Logo";

// ── Demo senaryosu (gercek CostBot cevabina benzer, sabit) ──

const DEMO_BARS = [
  { label: "Virtual Machines", value: 72430, max: 80000 },
  { label: "Azure SQL Database", value: 38210, max: 80000 },
  { label: "Storage Accounts", value: 21450, max: 80000 },
  { label: "Azure Kubernetes Service", value: 14230, max: 80000 },
  { label: "Bandwidth", value: 7890, max: 80000 },
];

type Phase = "typingQuestion" | "pauseAfterQuestion" | "typingIntro" | "growingBars" | "typingSummary" | "holding" | "resetting";

const TYPE_SPEED_MS = 28;
const BAR_GROW_DURATION_MS = 700;
const BAR_STAGGER_MS = 120;
const HOLD_DURATION_MS = 3200;

/**
 * Karakter karakter "yaziliyor" hissi veren basit bir hook.
 * Referans: Bulutistan.ai'nin terminal demosundaki canli yazi akisi --
 * kod/marka kopyalanmadi, sadece teknik (typewriter) kendi icerigimizle
 * uygulandi.
 */
function useTypewriter(text: string, active: boolean, speed: number = TYPE_SPEED_MS) {
  const [shown, setShown] = useState("");

  useEffect(() => {
    if (!active) return;
    let i = 0;
    setShown("");
    const id = setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, active, speed]);

  return shown;
}

export default function Hero() {
  const { t } = useLanguage();
  const DEMO_QUESTION = t("hero.demo.question");
  const DEMO_INTRO = t("hero.demo.intro");
  const DEMO_SUMMARY = t("hero.demo.summary");
  const [phase, setPhase] = useState<Phase>("typingQuestion");
  const [barsVisible, setBarsVisible] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const questionText = useTypewriter(DEMO_QUESTION, phase === "typingQuestion");
  const introText = useTypewriter(
    DEMO_INTRO,
    phase === "typingIntro" || phase === "growingBars" || phase === "typingSummary" || phase === "holding"
  );
  const summaryText = useTypewriter(DEMO_SUMMARY, phase === "typingSummary" || phase === "holding");

  const questionDone = phase !== "typingQuestion";
  const introDone = phase === "growingBars" || phase === "typingSummary" || phase === "holding";

  useEffect(() => {
    const clearAll = () => timers.current.forEach(clearTimeout);
    clearAll();
    timers.current = [];

    if (phase === "typingQuestion") {
      const t = setTimeout(() => setPhase("pauseAfterQuestion"), DEMO_QUESTION.length * TYPE_SPEED_MS + 300);
      timers.current.push(t);
    } else if (phase === "pauseAfterQuestion") {
      const t = setTimeout(() => setPhase("typingIntro"), 450);
      timers.current.push(t);
    } else if (phase === "typingIntro") {
      const t = setTimeout(() => {
        setPhase("growingBars");
        setBarsVisible(true);
      }, DEMO_INTRO.length * TYPE_SPEED_MS + 250);
      timers.current.push(t);
    } else if (phase === "growingBars") {
      const totalBarTime = BAR_GROW_DURATION_MS + DEMO_BARS.length * BAR_STAGGER_MS;
      const t = setTimeout(() => setPhase("typingSummary"), totalBarTime + 200);
      timers.current.push(t);
    } else if (phase === "typingSummary") {
      const t = setTimeout(() => setPhase("holding"), DEMO_SUMMARY.length * TYPE_SPEED_MS + 300);
      timers.current.push(t);
    } else if (phase === "holding") {
      const t = setTimeout(() => setPhase("resetting"), HOLD_DURATION_MS);
      timers.current.push(t);
    } else if (phase === "resetting") {
      setBarsVisible(false);
      const t = setTimeout(() => setPhase("typingQuestion"), 500);
      timers.current.push(t);
    }

    return clearAll;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  return (
    <section className="relative">
      {/* ── Görsel arka planlı blok: kenarlarda boşluk + yuvarlak köşeler ── */}
      <div className="relative isolate overflow-hidden mx-1 md:mx-0 mt-1 md:mt-2 rounded-b-[1.75rem] md:rounded-b-[2.25rem] min-h-[99vh] flex flex-col">
        <Image
          src="/images/hero-bg.jpg"
          alt=""
          fill
          priority
          className="object-cover -z-10"
        />
        {/* Metnin okunabilmesi için koyu overlay */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/70 via-black/55 to-black/85" />

        <div className="relative z-10">
          <Navbar />
        </div>

        <div className="relative z-10 flex-1 flex items-center">
          <div className="w-full px-6 md:px-12 py-16 max-w-5xl mx-auto text-center">
            <span className="inline-block text-xs font-semibold tracking-wide text-cyan-300 bg-white/10 ring-1 ring-cyan-400/40 backdrop-blur rounded-full px-3 py-1 mb-6">
              {t("hero.badge")}
            </span>
            <h1 className="text-4xl md:text-6xl font-extrabold text-white leading-tight mb-6">
              {t("hero.title.part1")}{" "}
              <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-500 bg-clip-text text-transparent">
                {t("hero.title.highlight")}
              </span>{" "}
              {t("hero.title.part2")}
            </h1>
            <p className="text-gray-300 text-lg max-w-2xl mx-auto mb-8">
              {t("hero.subtitle")}
            </p>
            <a
            
              href="/register"
              className="inline-flex items-center gap-2 bg-blue-600 text-white font-semibold rounded-xl px-6 py-3.5 hover:bg-blue-700 shadow-[0_0_30px_rgba(59,130,246,0.45)]"
            >
              {t("hero.cta")}
            </a>
            <p className="text-xs text-gray-400 mt-4">{t("hero.disclaimer")}</p>
          </div>
        </div>
      </div>

      {/* ── Canlı demo kartı: görselin ALTINDA, ayrı bir sayfa bölümü olarak ── */}
      {/* ── Canlı demo kartı: görselin ALTINDA, ayrı bir sayfa bölümü olarak ── */}
      <div className="relative isolate px-6 md:px-12 py-20 max-w-5xl mx-auto text-center">
        <AnimatedBackground variant="dense" />
        <div className="bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 dark:shadow-[0_0_40px_rgba(59,130,246,0.08)] rounded-2xl shadow-xl text-left overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2 font-semibold text-gray-800 dark:text-gray-100"><Logo size={18} /> CostBot</div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] text-gray-400 dark:text-gray-500">{t("hero.demo.badge")}</span>
            </div>
          </div>
          <div className="p-6 min-h-[280px]">
            <div className="flex justify-end mb-3">
              <div className="bg-blue-600 text-white text-sm rounded-2xl px-4 py-2 max-w-sm min-h-[2.5rem]">
                {questionText}
                {phase === "typingQuestion" && <span className="inline-block w-[2px] h-[1em] bg-white/80 ml-0.5 align-middle animate-pulse" />}
              </div>
            </div>

            <div
              className={`bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 mb-3 transition-opacity duration-300 ${
                questionDone ? "opacity-100" : "opacity-0"
              }`}
            >
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 min-h-[2.5rem]">
                {introText}
                {phase === "typingIntro" && <span className="inline-block w-[2px] h-[1em] bg-gray-500 ml-0.5 align-middle animate-pulse" />}
              </p>

              <div className="flex items-end gap-4 h-40">
                {DEMO_BARS.map((b, i) => (
                  <div key={b.label} className="flex-1 flex flex-col items-center justify-end">
                    <span
                      className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 transition-opacity duration-300"
                      style={{ opacity: barsVisible ? 1 : 0, transitionDelay: `${i * BAR_STAGGER_MS + 250}ms` }}
                    >
                      ${(b.value / 1000).toFixed(0)}K
                    </span>
                    <div
                      className="w-full bg-blue-600 dark:bg-cyan-400 rounded-t-md dark:shadow-[0_0_12px_rgba(34,211,238,0.5)] transition-all ease-out"
                      style={{
                        height: barsVisible ? `${(b.value / b.max) * 100}%` : "0%",
                        transitionDuration: `${BAR_GROW_DURATION_MS}ms`,
                        transitionDelay: `${i * BAR_STAGGER_MS}ms`,
                      }}
                    />
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 text-center">{b.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div
              className={`bg-green-50 dark:bg-green-950 dark:ring-1 dark:ring-green-500/30 text-green-800 dark:text-green-300 text-sm rounded-xl px-4 py-3 min-h-[2.75rem] transition-opacity duration-300 ${
                introDone ? "opacity-100" : "opacity-0"
              }`}
            >
              {summaryText}
              {phase === "typingSummary" && <span className="inline-block w-[2px] h-[1em] bg-green-700 ml-0.5 align-middle animate-pulse" />}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}