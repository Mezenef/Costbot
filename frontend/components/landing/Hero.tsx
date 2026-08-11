"use client";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Navbar from "./Navbar";
import { useLanguage } from "@/lib/i18n";
import Logo from "@/components/Logo";

// ── Demo senaryosu (gercek CostBot cevabina benzer, sabit) ──

const DEMO_BARS = [
  { label: "Virtual Machines", Icon: IconVM, value: 72430, max: 80000 },
  { label: "SQL Database", Icon: IconDatabase, value: 38210, max: 80000 },
  { label: "Storage", Icon: IconStorage, value: 21450, max: 80000 },
  { label: "Kubernetes", Icon: IconKubernetes, value: 14230, max: 80000 },
  { label: "Bandwidth", Icon: IconBandwidth, value: 7890, max: 80000 },
];

type Phase = "idle" | "typingQuestion" | "pauseAfterQuestion" | "typingIntro" | "growingBars" | "typingSummary" | "holding" | "resetting";

const TYPE_SPEED_MS = 42;
const BAR_GROW_DURATION_MS = 1100;
const BAR_STAGGER_MS = 200;
const HOLD_DURATION_MS = 4000;

function IconBadge({ children }: { children: React.ReactNode; bg?: string }) {
  return (
    <div className="w-10 h-10 flex items-center justify-center">
      {children}
    </div>
  );
}

function IconVM() {
  return (
    <IconBadge>
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2.5" y="4" width="19" height="12" rx="2" />
        <line x1="9" y1="20" x2="15" y2="20" />
        <line x1="12" y1="16" x2="12" y2="20" />
        <line x1="6" y1="8" x2="10.5" y2="8" />
        <line x1="6" y1="10.5" x2="13" y2="10.5" />
      </svg>
    </IconBadge>
  );
}

function IconDatabase() {
  return (
    <IconBadge>
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#9333ea" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5.5" rx="8" ry="3" />
        <path d="M4 5.5v5.5c0 1.66 3.58 3 8 3s8-1.34 8-3V5.5" />
        <path d="M4 11v5.5c0 1.66 3.58 3 8 3s8-1.34 8-3V11" />
      </svg>
    </IconBadge>
  );
}

function IconStorage() {
  return (
    <IconBadge>
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
        <path d="M3.3 7 12 12l8.7-5" />
        <line x1="12" y1="22" x2="12" y2="12" />
      </svg>
    </IconBadge>
  );
}

function IconKubernetes() {
  return (
    <IconBadge>
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2 3 7v10l9 5 9-5V7Z" />
        <circle cx="12" cy="12" r="3.2" />
        <path d="M12 6v3.5M12 14.5V18M7 9.5l3 2M14 12.5l3 2M7 14.5l3-2M14 11.5l3-2" />
      </svg>
    </IconBadge>
  );
}

function IconBandwidth() {
  return (
    <IconBadge>
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round">
        <path d="M4.5 12.8a10.5 10.5 0 0 1 15 0" opacity="0.6" />
        <path d="M7.3 15.6a6.5 6.5 0 0 1 9.4 0" opacity="0.85" />
        <circle cx="12" cy="18.2" r="1.6" fill="#10b981" stroke="none" />
      </svg>
    </IconBadge>
  );
}

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
  const [phase, setPhase] = useState<Phase>("idle");
  const [barsVisible, setBarsVisible] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const demoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = demoRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPhase("typingQuestion");
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const questionText = useTypewriter(DEMO_QUESTION, phase === "typingQuestion");
  const introText = useTypewriter(
    DEMO_INTRO,
    phase === "typingIntro" || phase === "growingBars" || phase === "typingSummary" || phase === "holding"
  );
  const summaryText = useTypewriter(DEMO_SUMMARY, phase === "typingSummary" || phase === "holding");

  const questionDone = phase !== "idle" && phase !== "typingQuestion";
  const introDone = phase === "growingBars" || phase === "typingSummary" || phase === "holding";

  useEffect(() => {
    const clearAll = () => timers.current.forEach(clearTimeout);
    clearAll();
    timers.current = [];

    if (phase === "idle") {
      // Görünür olana kadar bekle
    } else if (phase === "typingQuestion") {
      const tm = setTimeout(() => setPhase("pauseAfterQuestion"), DEMO_QUESTION.length * TYPE_SPEED_MS + 300);
      timers.current.push(tm);
    } else if (phase === "pauseAfterQuestion") {
      const tm = setTimeout(() => setPhase("typingIntro"), 450);
      timers.current.push(tm);
    } else if (phase === "typingIntro") {
      const tm = setTimeout(() => {
        setPhase("growingBars");
        setBarsVisible(true);
      }, DEMO_INTRO.length * TYPE_SPEED_MS + 250);
      timers.current.push(tm);
    } else if (phase === "growingBars") {
      const totalBarTime = BAR_GROW_DURATION_MS + DEMO_BARS.length * BAR_STAGGER_MS;
      const tm = setTimeout(() => setPhase("typingSummary"), totalBarTime + 200);
      timers.current.push(tm);
    } else if (phase === "typingSummary") {
      const tm = setTimeout(() => setPhase("holding"), DEMO_SUMMARY.length * TYPE_SPEED_MS + 300);
      timers.current.push(tm);
    } else if (phase === "holding") {
      const tm = setTimeout(() => setPhase("resetting"), HOLD_DURATION_MS);
      timers.current.push(tm);
    } else if (phase === "resetting") {
      setBarsVisible(false);
      const tm = setTimeout(() => setPhase("typingQuestion"), 500);
      timers.current.push(tm);
    }

    return clearAll;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  return (
    <section className="relative">
      <div className="relative isolate overflow-hidden mx-1 md:mx-0 mt-1 md:mt-2 rounded-b-[1.75rem] md:rounded-b-[2.25rem] min-h-[99vh] flex flex-col">
        <Image
          src="/images/hero-bg.jpg"
          alt=""
          fill
          priority
          className="object-cover -z-10"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/70 via-black/55 to-black/85" />

        <div className="relative z-10">
          <Navbar />
        </div>

        <div ref={demoRef} className="relative z-10 flex-1 flex items-center">
          <div className="w-full px-6 md:px-12 py-16 max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-[0.65fr_1.35fr] gap-10 lg:gap-24 items-center">
              {/* ── Sol: başlık + açıklama + butonlar ── */}
              <div className="text-left -mt-10 md:-mt-19">
                <span className="inline-block text-xs font-semibold tracking-wide text-cyan-300 bg-white/10 ring-1 ring-cyan-400/40 backdrop-blur rounded-full px-3 py-1 mb-6">
                  {t("hero.badge")}
                </span>
                <h1 className="text-4xl md:text-5xl font-extrabold text-white leading-tight mb-6">
                  {t("hero.title.part1")}{" "}
                  <span
                    className="bg-clip-text text-transparent"
                    style={{ backgroundImage: "linear-gradient(90deg, #EC4899, #A855F7)" }}
                  >
                    {t("hero.title.highlight")}
                  </span>{" "}
                  {t("hero.title.part2")}
                </h1>
                <p className="text-gray-300 text-lg max-w-md mb-8">
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

              {/* ── Sağ: animasyonlu AI Asistan demo kartı ── */}
              <div className="relative">
                <div
                  className="rounded-2xl text-left overflow-hidden"
                  style={{
                    background: "#12151F",
                    border: "1px solid #262B3B",
                    boxShadow: "0 0 40px rgba(0,0,0,0.35)",
                  }}
                >
                  <div
                    className="flex items-center justify-between px-5 py-3"
                    style={{ background: "#0E1119", borderBottom: "1px solid #262B3B" }}
                  >
                    <div className="flex items-center gap-2 font-semibold text-sm" style={{ color: "#E5E7EF" }}>
                      <Logo size={18} forceWhite /> CostBot
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-[10px]" style={{ color: "#8B90A0" }}>{t("hero.demo.badge")}</span>
                    </div>
                  </div>
                  <div className="p-5 min-h-[380px]">
                    <div className="flex justify-end mb-3">
                      <div className="bg-blue-600 text-white text-sm rounded-2xl px-4 py-2 max-w-[85%] min-h-[2.5rem]">
                        {questionText}
                        {phase === "typingQuestion" && <span className="inline-block w-[2px] h-[1em] bg-white/80 ml-0.5 align-middle animate-pulse" />}
                      </div>
                    </div>

                    <div
                      className="rounded-2xl p-4 mb-3 transition-opacity duration-300"
                      style={{ background: "#171B26", opacity: questionDone ? 1 : 0 }}
                    >
                      <p className="text-sm mb-3 min-h-[2.5rem]" style={{ color: "#C7CBD6" }}>
                        {introText}
                        {phase === "typingIntro" && <span className="inline-block w-[2px] h-[1em] bg-gray-400 ml-0.5 align-middle animate-pulse" />}
                      </p>

                      <div className="flex items-end gap-3 h-32">
                        {DEMO_BARS.map((b, i) => (
                          <div key={b.label} className="flex-1 flex flex-col items-center justify-end">
                            <span
                              className="text-[10px] font-semibold mb-1 transition-opacity duration-300"
                              style={{ color: "#C7CBD6", opacity: barsVisible ? 1 : 0, transitionDelay: `${i * BAR_STAGGER_MS + 250}ms` }}
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
                            <span
                              className="mt-1.5 transition-all ease-out"
                              style={{
                                opacity: barsVisible ? 1 : 0,
                                transform: barsVisible ? "translateY(0) scale(1)" : "translateY(8px) scale(0.85)",
                                transitionDuration: "700ms",
                                transitionDelay: `${i * BAR_STAGGER_MS + 500}ms`,
                              }}
                              aria-hidden="true"
                            >
                              <b.Icon />
                            </span>
                            <span className="text-[9px] mt-1 text-center leading-tight" style={{ color: "#6B7080" }}>{b.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div
                      className="text-sm rounded-xl px-4 py-3 min-h-[2.75rem] transition-opacity duration-300"
                      style={{
                        background: "#171B26",
                        borderTop: "1px solid #262B3B",
                        color: "#8FE3B0",
                        opacity: introDone ? 1 : 0,
                      }}
                    >
                      {summaryText}
                      {phase === "typingSummary" && <span className="inline-block w-[2px] h-[1em] ml-0.5 align-middle animate-pulse" style={{ background: "#8FE3B0" }} />}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}