"use client";
import { useState } from "react";

interface CollapsibleCardProps {
  title: string;
  badge?: string | number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export default function CollapsibleCard({ title, badge, defaultOpen = false, children }: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden self-start">
      <div className="w-full flex items-center justify-between p-5">
        <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 text-left flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
          {badge !== undefined && (
            <span className="text-[10px] font-bold bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full px-2 py-0.5">
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