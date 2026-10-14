"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Users,
  Compass,
  Plus,
  Trash2,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Shield,
  Sparkles,
  Layers,
  ArrowRight,
  Filter,
  Check,
} from "lucide-react";
import {
  ObserverAccountItem,
  ObserverAuthMode,
  DiscoveredPageItem,
} from "@/types/observerAccount.types";

interface ObserverAccountsTabProps {
  onImportSuccess?: () => void;
  onSwitchToSourceTab?: () => void;
}

export default function ObserverAccountsTab({
  onImportSuccess,
  onSwitchToSourceTab,
}: ObserverAccountsTabProps) {
  // Accounts state
  const [accounts, setAccounts] = useState<ObserverAccountItem[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState<boolean>(true);

  // New account form state
  const [name, setName] = useState<string>("");
  const [identifier, setIdentifier] = useState<string>("");
  const [authMode, setAuthMode] = useState<ObserverAuthMode>("public_profile");
  const [userToken, setUserToken] = useState<string>("");
  const [savingAccount, setSavingAccount] = useState<boolean>(false);

  // Discovery state
  const [isDiscovering, setIsDiscovering] = useState<boolean>(false);
  const [discoveringAccountId, setDiscoveringAccountId] = useState<string | null>(null);
  const [discoveredPages, setDiscoveredPages] = useState<DiscoveredPageItem[]>([]);
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(new Set());

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterNewOnly, setFilterNewOnly] = useState<boolean>(false);

  // Import state
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Fetch observer accounts
  const fetchAccounts = useCallback(async () => {
    try {
      setLoadingAccounts(true);
      const res = await fetch("/api/observer-accounts");
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Handle Save Account
  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFeedback({ type: "error", text: "Vui lòng nhập tên gợi nhớ cho tài khoản." });
      return;
    }
    if (!identifier.trim()) {
      setFeedback({
        type: "error",
        text: authMode === "public_profile" ? "Vui lòng nhập Link Profile hoặc UID của tài khoản Facebook." : "Vui lòng nhập UID hoặc Username của tài khoản.",
      });
      return;
    }
    if (authMode === "user_token" && !userToken.trim()) {
      setFeedback({ type: "error", text: "Chế độ Access Token yêu cầu cung cấp User Access Token." });
      return;
    }

    try {
      setSavingAccount(true);
      const res = await fetch("/api/observer-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          identifier: identifier.trim(),
          authMode,
          userToken: userToken.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setFeedback({
          type: "success",
          text: `Đã kết nối tài khoản theo dõi "${data.account?.name}".`,
        });
        setName("");
        setIdentifier("");
        setUserToken("");
        await fetchAccounts();
      } else {
        setFeedback({ type: "error", text: data.error || "Không thể lưu tài khoản." });
      }
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        text: `Lỗi: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setSavingAccount(false);
    }
  };

  // Handle Delete Account
  const handleDeleteAccount = async (id: string, accName: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa tài khoản "${accName}" khỏi danh sách theo dõi?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/observer-accounts?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({ type: "success", text: `Đã xóa tài khoản "${accName}".` });
        await fetchAccounts();
      }
    } catch {
      setFeedback({ type: "error", text: "Lỗi khi xóa tài khoản." });
    }
  };

  // Run Discovery (Single account or All)
  const handleDiscover = async (accountId: string | "all") => {
    try {
      if (accountId === "all") {
        setIsDiscovering(true);
      } else {
        setDiscoveringAccountId(accountId);
      }
      setFeedback(null);

      const res = await fetch("/api/observer-accounts/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });

      const data = await res.json();
      if (data.success) {
        setDiscoveredPages(data.pages || []);
        // Pre-select all new pages
        const newIds = new Set<string>(
          (data.pages || []).filter((p: DiscoveredPageItem) => !p.isAlreadyAdded).map((p: DiscoveredPageItem) => p.id)
        );
        setSelectedPageIds(newIds);

        setFeedback({
          type: "success",
          text: `Quét thành công! Tìm thấy ${data.totalDiscovered} Fanpage (${data.newPagesCount} trang mới chưa thêm).`,
        });
        await fetchAccounts();
      } else {
        setFeedback({
          type: "error",
          text: data.error || "Không thể quét danh sách Fanpage từ tài khoản này.",
        });
      }
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        text: `Lỗi quét trang: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setIsDiscovering(false);
      setDiscoveringAccountId(null);
    }
  };

  // Filtered Discovered Pages
  const filteredPages = useMemo(() => {
    return discoveredPages.filter((page) => {
      if (filterNewOnly && page.isAlreadyAdded) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          page.name.toLowerCase().includes(q) ||
          page.url.toLowerCase().includes(q) ||
          (page.category && page.category.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [discoveredPages, filterNewOnly, searchQuery]);

  // Toggle Single Page Selection
  const togglePageSelection = (id: string) => {
    const next = new Set(selectedPageIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedPageIds(next);
  };

  // Select / Deselect All New Pages
  const toggleSelectAll = () => {
    const selectable = filteredPages.filter((p) => !p.isAlreadyAdded);
    const allSelected = selectable.every((p) => selectedPageIds.has(p.id));

    const next = new Set(selectedPageIds);
    if (allSelected) {
      selectable.forEach((p) => next.delete(p.id));
    } else {
      selectable.forEach((p) => next.add(p.id));
    }
    setSelectedPageIds(next);
  };

  // Handle Import Selected Pages
  const handleImportSelected = async () => {
    const toImport = discoveredPages.filter((p) => selectedPageIds.has(p.id) && !p.isAlreadyAdded);
    if (toImport.length === 0) {
      setFeedback({ type: "error", text: "Vui lòng chọn ít nhất một trang mới để nhập." });
      return;
    }

    try {
      setIsImporting(true);
      const res = await fetch("/api/observer-accounts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pages: toImport.map((p) => ({
            name: p.name,
            url: p.url,
            pageId: p.pageId,
            avatarUrl: p.avatarUrl,
            scanPostLimit: 5,
          })),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setFeedback({
          type: "success",
          text: `Đã nhập thành công ${data.importedCount} Fanpage vào danh sách Page Lấy Bài (bỏ qua ${data.skippedCount} trang trùng).`,
        });

        // Update local status of imported pages
        const importedUrls = new Set(data.importedPages?.map((ip: { url: string }) => ip.url.toLowerCase()) || []);
        setDiscoveredPages((prev) =>
          prev.map((p) =>
            importedUrls.has(p.url.toLowerCase()) ? { ...p, isAlreadyAdded: true } : p
          )
        );
        setSelectedPageIds(new Set());

        if (onImportSuccess) onImportSuccess();
      } else {
        setFeedback({ type: "error", text: data.error || "Lỗi khi nhập Fanpage." });
      }
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        text: `Lỗi: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Informative Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-violet-50 to-indigo-50 border border-indigo-200/80 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-indigo-600 text-white shrink-0 mt-0.5">
            <Compass className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>Khám Phá Fanpage Từ Tài Khoản Facebook (Observer Profiles)</span>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-100 text-indigo-700">
                Tự động hóa nguồn bài
              </span>
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Kết nối một hoặc nhiều tài khoản Facebook (nick cá nhân, nick phụ, via) để hệ thống tự động quét và phân tích 
              <strong> toàn bộ các Fanpage mà tài khoản đó đang Thích / Theo dõi</strong>. Sau đó bạn chỉ cần tick chọn để nhập 
              hàng loạt vào mục <strong>Page Lấy Bài (Source Pages)</strong>!
            </p>
          </div>
        </div>
      </div>

      {/* Global Feedback Banner */}
      {feedback && (
        <div
          className={`p-3 text-xs rounded-xl flex items-center justify-between gap-2 ${
            feedback.type === "success"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
              : "bg-rose-50 border border-rose-200 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs font-semibold hover:opacity-75 cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Add Account Form */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Users className="w-4 h-4 text-indigo-600" />
          <h2 className="text-sm font-bold text-slate-800">Kết Nối Thêm Tài Khoản Facebook Mới</h2>
        </div>

        <form onSubmit={handleSaveAccount} className="space-y-4">
          {/* Mode Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setAuthMode("public_profile")}
              className={`p-3 rounded-xl border text-left transition flex items-start gap-3 cursor-pointer ${
                authMode === "public_profile"
                  ? "border-indigo-600 bg-indigo-50/40 text-indigo-900"
                  : "border-slate-200 hover:border-slate-300 bg-slate-50/50 text-slate-700"
              }`}
            >
              <input
                type="radio"
                name="observerAuthMode"
                checked={authMode === "public_profile"}
                onChange={() => setAuthMode("public_profile")}
                className="mt-1 text-indigo-600"
              />
              <div className="space-y-0.5">
                <div className="text-xs font-bold">Quét qua Link / UID Công Khai</div>
                <div className="text-[11px] text-slate-500">
                  Không cần token hay mật khẩu. Quét các Trang công khai mà tài khoản theo dõi.
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setAuthMode("user_token")}
              className={`p-3 rounded-xl border text-left transition flex items-start gap-3 cursor-pointer ${
                authMode === "user_token"
                  ? "border-indigo-600 bg-indigo-50/40 text-indigo-900"
                  : "border-slate-200 hover:border-slate-300 bg-slate-50/50 text-slate-700"
              }`}
            >
              <input
                type="radio"
                name="observerAuthMode"
                checked={authMode === "user_token"}
                onChange={() => setAuthMode("user_token")}
                className="mt-1 text-indigo-600"
              />
              <div className="space-y-0.5">
                <div className="text-xs font-bold">Quét qua User Access Token</div>
                <div className="text-[11px] text-slate-500">
                  Dùng cho nick phụ/via. Lấy được 100% toàn bộ Page đã thích qua Graph API.
                </div>
              </div>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tên gợi nhớ tài khoản <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Nick Phụ Bán Hàng, Nick Marketing 01..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {authMode === "public_profile" ? "Link Profile FB hoặc UID" : "UID hoặc Link FB"}{" "}
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={
                  authMode === "public_profile"
                    ? "https://facebook.com/username hoặc 100012345678"
                    : "100012345678 hoặc username"
                }
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                required
              />
            </div>
          </div>

          {authMode === "user_token" && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                User Access Token (EAAB...) <span className="text-rose-500">*</span>
              </label>
              <input
                type="password"
                value={userToken}
                onChange={(e) => setUserToken(e.target.value)}
                placeholder="Dán mã User Access Token của tài khoản..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                required
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Token cá nhân chỉ được dùng để đọc danh sách Pages đã thích (`user_likes`). Hệ thống không lưu trữ mật khẩu hay quyền đăng bài của nick này.
              </p>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={savingAccount}
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {savingAccount ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              <span>Lưu Tài Khoản Theo Dõi</span>
            </button>
          </div>
        </form>
      </div>

      {/* Connected Accounts List */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-800">
              Danh Sách Tài Khoản Đang Kết Nối ({accounts.length})
            </h2>
          </div>

          {accounts.length > 0 && (
            <button
              type="button"
              onClick={() => handleDiscover("all")}
              disabled={isDiscovering}
              className="px-3 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 rounded-xl transition flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
            >
              {isDiscovering ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>Quét Toàn Bộ Fanpage Từ Mọi Nick</span>
            </button>
          )}
        </div>

        {loadingAccounts ? (
          <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
            <span>Đang tải danh sách tài khoản theo dõi...</span>
          </div>
        ) : accounts.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <Users className="w-5 h-5" />
            </div>
            <div className="text-xs font-medium text-slate-600">Chưa có tài khoản Facebook nào</div>
            <div className="text-[11px] text-slate-400 max-w-sm mx-auto">
              Hãy thêm ít nhất một link profile Facebook hoặc User Access Token ở form phía trên để bắt đầu tìm kiếm các Fanpage hay nhất.
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="p-3.5 rounded-xl border border-slate-200/90 hover:border-indigo-300 transition bg-slate-50/40 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                      {acc.name.slice(0, 2)}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">{acc.name}</div>
                      <div className="text-[11px] text-slate-500 truncate max-w-[180px] font-mono">
                        {acc.identifier}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                        acc.authMode === "user_token"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {acc.authMode === "user_token" ? "Token" : "Công khai"}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteAccount(acc.id, acc.name)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 transition rounded-lg hover:bg-white cursor-pointer"
                      title="Xóa tài khoản"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                  <div>
                    Đã phát hiện:{" "}
                    <strong className="text-indigo-600 font-bold">{acc.pagesDiscoveredCount}</strong> trang
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDiscover(acc.id)}
                    disabled={discoveringAccountId === acc.id || isDiscovering}
                    className="px-2.5 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-100/70 hover:bg-indigo-200/70 rounded-lg transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {discoveringAccountId === acc.id ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <Search className="w-3 h-3" />
                    )}
                    <span>Quét Fanpage</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Discovered Pages Section */}
      {discoveredPages.length > 0 && (
        <div className="p-5 rounded-2xl bg-white border border-indigo-200/90 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Fanpage Tìm Thấy ({discoveredPages.length})</span>
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Tick chọn các Fanpage bạn muốn theo dõi để hệ thống tự động cào bài viết về.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Chọn tất cả trang mới
              </button>

              <button
                type="button"
                onClick={handleImportSelected}
                disabled={isImporting || selectedPageIds.size === 0}
                className="px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isImporting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Nhập ({selectedPageIds.size}) Trang Đã Chọn</span>
              </button>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm theo tên Fanpage, danh mục hoặc link..."
                className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              type="button"
              onClick={() => setFilterNewOnly(!filterNewOnly)}
              className={`px-3 py-2 text-xs font-semibold rounded-xl border transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
                filterNewOnly
                  ? "bg-indigo-50 border-indigo-400 text-indigo-700 font-bold"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Chỉ hiện trang mới</span>
            </button>
          </div>

          {/* Pages Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[460px] overflow-y-auto pr-1">
            {filteredPages.map((page) => {
              const isSelected = selectedPageIds.has(page.id);
              return (
                <div
                  key={page.id}
                  onClick={() => !page.isAlreadyAdded && togglePageSelection(page.id)}
                  className={`p-3 rounded-xl border transition flex items-start gap-3 select-none ${
                    page.isAlreadyAdded
                      ? "border-slate-200 bg-slate-50/70 opacity-60 cursor-not-allowed"
                      : isSelected
                      ? "border-indigo-500 bg-indigo-50/40 cursor-pointer shadow-xs"
                      : "border-slate-200 hover:border-indigo-300 bg-white cursor-pointer"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected || page.isAlreadyAdded}
                    disabled={page.isAlreadyAdded}
                    onChange={() => !page.isAlreadyAdded && togglePageSelection(page.id)}
                    className="mt-1 text-indigo-600 rounded cursor-pointer"
                  />

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <div className="text-xs font-bold text-slate-800 truncate" title={page.name}>
                        {page.name}
                      </div>
                      {page.isAlreadyAdded ? (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-slate-200 text-slate-700 shrink-0">
                          Đã thêm
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-emerald-100 text-emerald-800 shrink-0">
                          Trang mới
                        </span>
                      )}
                    </div>

                    <a
                      href={page.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[11px] text-indigo-600 hover:underline flex items-center gap-1 truncate"
                    >
                      <span>{page.url}</span>
                      <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                    </a>

                    <div className="flex items-center gap-3 text-[10px] text-slate-500 pt-1">
                      {page.category && (
                        <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600">
                          {page.category}
                        </span>
                      )}
                      {page.fanCount ? (
                        <span>{page.fanCount.toLocaleString("vi-VN")} người theo dõi</span>
                      ) : null}
                      <span className="text-slate-400">Từ: {page.sourceAccountName}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Jump to Source Tab */}
          {onSwitchToSourceTab && (
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={onSwitchToSourceTab}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
              >
                <span>Xem danh sách Fanpage Nguồn đã lưu</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
