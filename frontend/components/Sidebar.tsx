"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/lib/i18n";
import Logo from "@/components/Logo";

interface SidebarProps {
  pendingCount?: number;
  userName?: string;
  userRole?: string;
}

export default function Sidebar({ pendingCount = 0, userName, userRole }: SidebarProps) {
  const pathname = usePathname();
  const { t } = useLanguage();

  const NAV_ITEMS = [
    { href: "/dashboard", icon: "📊", label: t("sidebar.dashboard") },
    { href: "/chat", icon: "💬", label: t("sidebar.aiAssistant") },
    { href: "/recommendations", icon: "💡", label: t("sidebar.recommendations") },
    { href: "/resources", icon: "🗄️", label: t("sidebar.resources") },
    { href: "/reports", icon: "📄", label: t("sidebar.reports") },
    { href: "/alerts", icon: "🔔", label: t("sidebar.alerts") },
    { href: "/settings", icon: "⚙️", label: t("sidebar.settings") },
  ];

  return (
    <aside className="w-52 flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col h-screen sticky top-0">
      <div className="flex flex-col items-start gap-2 px-5 py-6">
        <Logo size={30} />
        <div>
          <div className="font-bold text-gray-900 dark:text-white text-sm leading-tight">CostBot</div>
          <div className="text-[9px] text-gray-400 dark:text-gray-500 leading-tight">Cloud Cost Intelligence</div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-2 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                active
                  ? "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              <span className="flex items-center gap-3">
                <span>{item.icon}</span>
                {item.label}
              </span>
              {item.href === "/recommendations" && pendingCount > 0 && (
                <span className="text-[10px] font-bold bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 rounded-full w-5 h-5 flex items-center justify-center">
                  {pendingCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-4">
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800">
          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs font-semibold flex items-center justify-center flex-shrink-0">
            {(userName || "?").slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{userName || "..."}</div>
            <div className="text-[10px] text-gray-400 dark:text-gray-500">{userRole || t("sidebar.role")}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}