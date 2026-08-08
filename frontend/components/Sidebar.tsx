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
  userEmail?: string;
}

const BG = "#150E30";
const BORDER = "#2A1F4D";
const ACTIVE_BG = "#3A2D66";
const HOVER_BG = "#211A3D";
const TEXT_MUTED = "#9891B0";
const TEXT_ACTIVE = "#FFFFFF";

// ---- Line-style ikonlar (Lucide/Feather tarzı, stroke tabanlı) ----
const iconProps = { width: 17, height: 17, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function IconDashboard() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}
function IconChat() {
  return (
    <svg {...iconProps}>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}
function IconLightbulb() {
  return (
    <svg {...iconProps}>
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M12 2a7 7 0 0 0-4 12.7V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.3A7 7 0 0 0 12 2Z" />
    </svg>
  );
}
function IconDatabase() {
  return (
    <svg {...iconProps}>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5" />
      <path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
    </svg>
  );
}
function IconSearch() {
  return (
    <svg {...iconProps}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
function IconFileText() {
  return (
    <svg {...iconProps}>
      <path d="M14.5 2H6a1 1 0 0 0-1 1v18a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8.5L14.5 2Z" />
      <path d="M14 2v6h6" />
      <path d="M9 13h6M9 17h6" />
    </svg>
  );
}
function IconBell() {
  return (
    <svg {...iconProps}>
      <path d="M6 8a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}
function IconSettings() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

export default function Sidebar({ pendingCount = 0, userName, userRole, userEmail }: SidebarProps) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const [collapsed, setCollapsed] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [indicator, setIndicator] = useState({ top: 0, height: 0, opacity: 0 });
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const navRef = useRef<HTMLElement>(null);

  const NAV_ITEMS = [
    { href: "/dashboard", Icon: IconDashboard, label: t("sidebar.dashboard") },
    { href: "/chat", Icon: IconChat, label: t("sidebar.aiAssistant") },
    { href: "/recommendations", Icon: IconLightbulb, label: t("sidebar.recommendations") },
    { href: "/resources", Icon: IconDatabase, label: t("sidebar.resources") },
    { href: "/cost-analyzer", Icon: IconSearch, label: t("sidebar.costAnalyzer") },
    { href: "/reports", Icon: IconFileText, label: t("sidebar.reports") },
    { href: "/alerts", Icon: IconBell, label: t("sidebar.alerts") },
    { href: "/settings", Icon: IconSettings, label: t("sidebar.settings") },
  ];

  const activeIndex = NAV_ITEMS.findIndex((item) => item.href === pathname);

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
      className={`${collapsed ? "w-16" : "w-52"} flex-shrink-0 flex flex-col h-screen sticky top-0 transition-all duration-200`}
      style={{ background: BG, borderRight: `1px solid ${BORDER}` }}
    >
      <div className={`flex ${collapsed ? "flex-col items-center" : "flex-col items-start"} gap-2 px-3 py-6 relative`}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Sidebar'ı genişlet" : "Sidebar'ı daralt"}
          className="absolute -right-3 top-8 w-6 h-6 rounded-full flex items-center justify-center text-xs shadow-sm z-10 transition"
          style={{ background: "#201640", border: `1px solid ${BORDER}`, color: TEXT_MUTED }}
        >
          {collapsed ? "›" : "‹"}
        </button>
        <div className={collapsed ? "" : "pl-2"}>
          <Logo size={collapsed ? 32 : 52} forceWhite />
        </div>
        {!collapsed && (
          <div className="pl-2">
            <div className="font-bold text-sm leading-tight" style={{ color: TEXT_ACTIVE }}>CostBot</div>
            <div className="text-[9px] leading-tight" style={{ color: TEXT_MUTED }}>Cloud Cost Intelligence</div>
          </div>
        )}
      </div>

      <nav
        ref={navRef}
        className="flex-1 px-3 py-2 space-y-1 relative"
        onMouseLeave={() => setHoveredIndex(null)}
      >
        <div
          className="absolute left-3 right-3 rounded-lg pointer-events-none transition-all duration-200 ease-out"
          style={{ top: indicator.top, height: indicator.height, opacity: indicator.opacity, background: HOVER_BG }}
        />

        {NAV_ITEMS.map((item, i) => {
          const active = i === activeIndex;
          const Icon = item.Icon;
          return (
            <Link
              key={item.href}
              ref={(el) => { itemRefs.current[i] = el; }}
              onMouseEnter={() => setHoveredIndex(i)}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`relative z-10 flex items-center ${collapsed ? "justify-center" : "justify-between"} gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors`}
              style={{
                background: active ? ACTIVE_BG : "transparent",
                color: active ? TEXT_ACTIVE : TEXT_MUTED,
                fontWeight: active ? 600 : 400,
                boxShadow: active ? "0 0 20px rgba(168,85,247,0.15)" : "none",
              }}
            >
              <span className={`flex items-center ${collapsed ? "" : "gap-3"}`}>
                <span style={{ opacity: active ? 1 : 0.85, display: "inline-flex" }}>
                  <Icon />
                </span>
                {!collapsed && item.label}
              </span>
              {!collapsed && item.href === "/recommendations" && pendingCount > 0 && (
                <span
                  className="text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center"
                  style={{ background: "rgba(236,72,153,0.2)", color: "#F0EDFF" }}
                >
                  {pendingCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-4">
        <div
          className={`flex items-center ${collapsed ? "justify-center" : "gap-2.5"} px-3 py-2.5 rounded-lg`}
          style={{ background: "#201640", borderTop: `1px solid ${BORDER}` }}
        >
          <div
            className="w-8 h-8 rounded-full text-xs font-semibold flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #A855F7, #6366F1)", color: "#FFFFFF" }}
          >
            {(() => {
              const parts = (userName || "").trim().split(/\s+/).filter(Boolean);
              if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
              if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
              return "?";
            })()}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-xs font-medium truncate" style={{ color: TEXT_ACTIVE }}>{userName || "..."}</div>
              {userEmail && (
                <div className="text-[10px] truncate" style={{ color: TEXT_MUTED }}>{userEmail}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}