"use client";
import { useState } from "react";

type AccentColor = "blue" | "purple" | "red" | "green" | "amber";

interface CollapsibleCardProps {
  title: string;
  badge?: string | number;
  defaultOpen?: boolean;
  accentColor?: AccentColor;
  children: React.ReactNode;
}

const ACCENT_STYLES: Record<AccentColor, { bar: string; badge: string }> = {
  blue: {
    bar: "bg-blue-500",
    badge: "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  purple: {
    bar: "bg-purple-500",
    badge: "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400",
  },
  red: {
    bar: "bg-red-500",
    badge: "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400",
  },
  green: {
    bar: "bg-emerald-500",
    badge: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  amber: {
    bar: "bg-amber-500",
    badge: "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
};

export default function CollapsibleCard({ title, badge, defaultOpen = false, accentColor, children }: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const accent = accentColor ? ACCENT_STYLES[accentColor] : null;

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden self-start">
      {accent && <div className={`h-1 ${accent.bar}`} />}
      <div className="w-full flex items-center justify-between p-5">
        <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 text-left flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
          {badge !== undefined && (
            <span
              className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${
                accent ? accent.badge : "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400"
              }`}
            >
              {badge}
            </span>
          )}
        </button>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Kapat" : "Aç"}
          className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
        >
          <span className={`inline-block transition-transform duration-200 text-xs ${open ? "rotate-180" : ""}`}>▾</span>
        </button>
      </div>
      <div className={`grid transition-all duration-200 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <div className="px-5 pb-5">{children}</div>
        </div>
      </div>
    </div>
  );
}