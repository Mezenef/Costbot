"use client";
import { useState, useRef, useEffect } from "react";
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
  const [collapsed, setCollapsed] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [indicator, setIndicator] = useState({ top: 0, height: 0, opacity: 0 });
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const navRef = useRef<HTMLElement>(null);

  const NAV_ITEMS = [
    { href: "/dashboard", icon: "📊", label: t("sidebar.dashboard") },
    { href: "/chat", icon: "💬", label: t("sidebar.aiAssistant") },
    { href: "/recommendations", icon: "💡", label: t("sidebar.recommendations") },
    { href: "/resources", icon: "🗄️", label: t("sidebar.resources") },
    { href: "/cost-analyzer", icon: "🔍", label: t("sidebar.costAnalyzer") },
    { href: "/reports", icon: "📄", label: t("sidebar.reports") },
    { href: "/alerts", icon: "🔔", label: t("sidebar.alerts") },
    { href: "/settings", icon: "⚙️", label: t("sidebar.settings") },
  ];

  const activeIndex = NAV_ITEMS.findIndex((item) => item.href === pathname);

  // Fare hangi sekmenin üzerindeyse, "indicator" (kayan gradyan) o
  // sekmenin konumuna/boyutuna göre yumuşak bir şekilde taşınır.
  // Aktif (tıklanmış) sekmenin üzerine gelinince indicator GİZLENİR --
  // çünkü o sekme zaten kendi sabit mavi arka planını gösteriyor.
  useEffect(() => {
    if (hoveredIndex === null || hoveredIndex === activeIndex || !itemRefs.current[hoveredIndex] || !navRef.current) {
      setIndicator((s) => ({ ...s, opacity: 0 }));
      return;
    }
    const item = itemRefs.current[hoveredIndex]!;
    const navBox = navRef.current.getBoundingClientRect();
    const itemBox = item.getBoundingClientRect();
    setIndicator({
      top: itemBox.top - navBox.top,
      height: itemBox.height,
      opacity: 1,
    });
  }, [hoveredIndex, collapsed, activeIndex]);

  return (
    <aside
      className={`${collapsed ? "w-16" : "w-52"} flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col h-screen sticky top-0 transition-all duration-200`}
    >
      <div className={`flex ${collapsed ? "flex-col items-center" : "flex-col items-start"} gap-2 px-3 py-6 relative`}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Sidebar'ı genişlet" : "Sidebar'ı daralt"}
          className="absolute -right-3 top-8 w-6 h-6 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-600 transition text-xs shadow-sm z-10"
        >
          {collapsed ? "›" : "‹"}
        </button>
        <div className={collapsed ? "" : "pl-2"}>
          <Logo size={collapsed ? 28 : 42} />
        </div>
        {!collapsed && (
          <div className="pl-2">
            <div className="font-bold text-gray-900 dark:text-white text-sm leading-tight">CostBot</div>
            <div className="text-[9px] text-gray-400 dark:text-gray-500 leading-tight">Cloud Cost Intelligence</div>
          </div>
        )}
      </div>

      <nav
        ref={navRef}
        className="flex-1 px-3 py-2 space-y-1 relative"
        onMouseLeave={() => setHoveredIndex(null)}
      >
        {/* Kayan hover göstergesi -- koyu mavi, hafif gradyan */}
        <div
          className="absolute left-3 right-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 pointer-events-none transition-all duration-200 ease-out"
          style={{ top: indicator.top, height: indicator.height, opacity: indicator.opacity }}
        />

        {NAV_ITEMS.map((item, i) => {
          const active = i === activeIndex;
          return (
            <Link
              key={item.href}
              ref={(el) => { itemRefs.current[i] = el; }}
              onMouseEnter={() => setHoveredIndex(i)}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`relative z-10 flex items-center ${collapsed ? "justify-center" : "justify-between"} gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                active
                  ? "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400"
                  : "text-gray-600 dark:text-gray-400 hover:text-blue-700 dark:hover:text-blue-400"
              }`}
            >
              <span className={`flex items-center ${collapsed ? "" : "gap-3"}`}>
                <span>{item.icon}</span>
                {!collapsed && item.label}
              </span>
              {!collapsed && item.href === "/recommendations" && pendingCount > 0 && (
                <span className="text-[10px] font-bold bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 rounded-full w-5 h-5 flex items-center justify-center">
                  {pendingCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-4">
        <div className={`flex items-center ${collapsed ? "justify-center" : "gap-2"} px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800`}>
          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs font-semibold flex items-center justify-center flex-shrink-0">
            {(() => {
              const parts = (userName || "").trim().split(/\s+/).filter(Boolean);
              if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
              if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
              return "?";
            })()}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{userName || "..."}</div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}