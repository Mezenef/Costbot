"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n";

interface UserMenuProps {
  userName?: string;
  userRole?: string;
}

export default function UserMenu({ userName, userRole }: UserMenuProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  function handleLogout() {
    localStorage.removeItem("costbot_user");
    localStorage.removeItem("costbot_session_id");
    router.push("/");
  }

  const initials = (() => {
    const parts = (userName || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return "?";
  })();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-gray-50 dark:hover:bg-gray-800 transition"
      >
        <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[11px] font-semibold flex items-center justify-center flex-shrink-0">
          {initials}
        </div>
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300 max-w-[100px] truncate">
          {userName || "..."}
        </span>
        <span className="text-[9px] text-gray-400 dark:text-gray-500">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-44 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-lg py-1.5 z-20">
            <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800">
              <div className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{userName || "..."}</div>
            </div>
            <a
              href="/settings"
              className="block px-3 py-2 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              ⚙️ {t("sidebar.settings")}
            </a>
            <button
              onClick={handleLogout}
              className="w-full text-left px-3 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
            >
              🚪 {t("common.logout")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}