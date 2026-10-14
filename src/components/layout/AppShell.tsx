"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sparkles,
  FileSpreadsheet,
  KeyRound,
  History,
  Settings,
  RefreshCw,
  Facebook,
  CheckCircle2,
  Zap,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { KeyPoolStats } from "@/types/ai.types";

const NAV_ITEMS = [
  {
    href: "/",
    label: "Content Studio",
    subtitle: "Chọn Xã • Hook • Bài Cuối",
    icon: Sparkles,
  },
  {
    href: "/sheets",
    label: "Dữ Liệu & Prompt Sheet",
    subtitle: "Tiêu đề • TT 1-4 • Prompt 1-4",
    icon: FileSpreadsheet,
  },
  {
    href: "/keys",
    label: "Pool 30 Key Gemini",
    subtitle: "Xoay vòng & Auto-Failover",
    icon: KeyRound,
  },
  {
    href: "/history",
    label: "Lịch Sử & Bản Nháp",
    subtitle: "Bài đã đăng & Drafts",
    icon: History,
  },
  {
    href: "/settings",
    label: "Cấu Hình Fanpage",
    subtitle: "Page ID & Access Token",
    icon: Settings,
  },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [poolStats, setPoolStats] = useState<KeyPoolStats | null>(null);
  const [preferredModel, setPreferredModel] = useState<string>("gemini-2.5-flash");
  const [loadingStats, setLoadingStats] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const fetchKeyStats = async () => {
    try {
      setLoadingStats(true);
      const res = await fetch("/api/ai/keys");
      if (res.ok) {
        const data = await res.json();
        setPoolStats(data.stats);
        if (data.preferredModel) setPreferredModel(data.preferredModel);
      }
    } catch {
      // ignore silent poll error
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchKeyStats();
    const timer = setInterval(fetchKeyStats, 15000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex min-h-screen flex-col lg:flex-row bg-slate-100/70">
      {/* 1. MOBILE TOPBAR (< lg) */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-[#0b1120] text-white border-b border-slate-800 sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-600/30">
            <Facebook className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight">FB Sheet Studio</span>
            <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              PRO
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {poolStats && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {poolStats.active}/{poolStats.total} Keys
            </span>
          )}
          <button
            type="button"
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
            aria-label="Toggle Navigation Menu"
          >
            {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* 2. MOBILE DRAWER OVERLAY */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs lg:hidden animate-in fade-in duration-200 flex"
          onClick={() => setIsMobileOpen(false)}
        >
          <div
            className="w-72 max-w-[85vw] h-full bg-[#0b1120] text-slate-100 flex flex-col shadow-2xl p-0 animate-in slide-in-from-left duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drawer Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                  <Facebook className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-sm text-white">FB Sheet Studio</h2>
                  <p className="text-[10px] text-slate-400">Tạo bài &amp; Đăng Fanpage</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile Nav Links */}
            <nav className="p-3 space-y-1.5 flex-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={true}
                    onClick={() => setIsMobileOpen(false)}
                    className={`flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all ${
                      isActive
                        ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md"
                        : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
                    }`}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <div>
                      <div className="text-sm font-semibold">{item.label}</div>
                      <div className="text-[11px] text-slate-400">{item.subtitle}</div>
                    </div>
                  </Link>
                );
              })}
            </nav>

            {/* Mobile Key Widget */}
            <div className="p-4 border-t border-slate-800">
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-2">
                <div className="flex items-center justify-between text-emerald-400 font-semibold">
                  <span className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" />
                    <span>Gemini Key Pool</span>
                  </span>
                  <span className="font-mono">
                    {poolStats ? `${poolStats.active}/${poolStats.total}` : "30"} Keys
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. DESKTOP FULL-HEIGHT SIDEBAR (Kéo hết trang, sticky top-0 h-screen, hỗ trợ thu gọn đa màn) */}
      <aside
        className={`hidden lg:flex flex-col bg-[#0b1120] text-slate-100 shrink-0 border-r border-slate-800 sticky top-0 h-screen transition-all duration-300 z-30 ${
          isCollapsed ? "w-20" : "w-72"
        }`}
      >
        {/* Brand Header */}
        <div
          className={`p-4 border-b border-slate-800/80 flex items-center justify-between ${
            isCollapsed ? "flex-col gap-2 p-3" : ""
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-600/25 shrink-0">
              <Facebook className="w-5 h-5 text-white" />
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h1 className="font-bold text-base tracking-tight text-white truncate">
                    FB Sheet Studio
                  </h1>
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
                    PRO
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                  Tạo bài &amp; Đăng Facebook
                </p>
              </div>
            )}
          </div>

          {/* Toggle Button for Split-screen / Multi-monitor (Đa màn hình) */}
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={
              isCollapsed
                ? "Mở rộng thanh menu (Đầy đủ)"
                : "Thu gọn menu (Tối ưu đa màn hình / chia đôi màn hình)"
            }
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition cursor-pointer"
          >
            {isCollapsed ? (
              <PanelLeftOpen className="w-4 h-4 text-indigo-400" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1.5 flex-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                title={item.label}
                className={`flex items-center gap-3 rounded-xl transition-all ${
                  isCollapsed ? "p-3 justify-center" : "px-3.5 py-3"
                } ${
                  isActive
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-950/50"
                    : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
                }`}
              >
                <Icon
                  className={`w-5 h-5 shrink-0 ${
                    isActive ? "text-white" : "text-slate-400"
                  }`}
                />
                {!isCollapsed && (
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold leading-tight truncate">
                      {item.label}
                    </div>
                    <div
                      className={`text-[11px] truncate mt-0.5 ${
                        isActive ? "text-blue-100" : "text-slate-400"
                      }`}
                    >
                      {item.subtitle}
                    </div>
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Live Key Rotation Status Widget at Bottom */}
        <div className="p-3 mt-auto border-t border-slate-800/80">
          {isCollapsed ? (
            <div
              title={`Gemini Key Pool: ${poolStats ? poolStats.active : 0}/${
                poolStats ? poolStats.total : 0
              } Keys sẵn sàng`}
              className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-slate-800/80 transition"
              onClick={() => setIsCollapsed(false)}
            >
              <Zap className="w-4 h-4 text-emerald-400" />
              <span className="text-[10px] font-mono font-bold text-emerald-400">
                {poolStats ? poolStats.active : "30"}
              </span>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Gemini Key Rotation</span>
                </div>
                <button
                  onClick={fetchKeyStats}
                  title="Làm mới trạng thái Key Pool"
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${loadingStats ? "animate-spin" : ""}`}
                  />
                </button>
              </div>

              {poolStats ? (
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Key sẵn sàng:</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {poolStats.active} / {poolStats.total} Keys
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{
                        width: `${
                          poolStats.total > 0
                            ? Math.round((poolStats.active / poolStats.total) * 100)
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px] text-slate-400">
                    <div className="bg-slate-950/60 px-2 py-1.5 rounded border border-slate-800/80">
                      <div>Key tiếp theo</div>
                      <div className="font-mono font-semibold text-indigo-300">
                        #{poolStats.currentIndex + 1}
                      </div>
                    </div>
                    <div className="bg-slate-950/60 px-2 py-1.5 rounded border border-slate-800/80">
                      <div>Đã gọi / Đổi</div>
                      <div className="font-mono font-semibold text-slate-200">
                        {poolStats.totalSuccessRequests} / {poolStats.totalFailovers}
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-400 flex items-center justify-between pt-0.5">
                    <span>Model:</span>
                    <span className="font-mono text-slate-300">{preferredModel}</span>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-400">Đang tải thông tin 30 Key...</div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* 4. MAIN CONTENT AREA (Hỗ trợ đa màn hình, mở rộng tối đa không gian) */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top Bar */}
        <header className="h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20 shadow-xs">
          <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600 truncate">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="truncate">
              Quy trình chuẩn:{" "}
              <strong className="text-slate-900">1. Chọn Chủ Đề</strong> &rarr;{" "}
              <strong className="text-slate-900">2. Tạo Hook</strong> &rarr;{" "}
              <strong className="text-slate-900">3. Prompt 1–4 &amp; Đăng</strong>
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link
              href="/keys"
              prefetch={true}
              className="hidden md:inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>
                Pool {poolStats ? `${poolStats.active}/${poolStats.total}` : "30"} Key
                Gemini
              </span>
            </Link>
            <Link
              href="/sheets"
              prefetch={true}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">Đồng bộ Sheet</span>
            </Link>
          </div>
        </header>

        <main className="flex-1 p-3 sm:p-5 lg:p-6 xl:p-8 w-full max-w-[1920px] mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
