"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Settings,
  Save,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Facebook,
  Globe,
  Radio,
  Trash2,
  Star,
  Plus,
  ExternalLink,
  Layers,
  Database,
  Info,
  RefreshCw,
  Check,
} from "lucide-react";
import {
  TargetPageItem,
  SourcePageItem,
  SourcePageInputMode,
} from "@/types/sourcePage.types";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<"target" | "source" | "database">("target");

  // Target Pages state
  const [targetPages, setTargetPages] = useState<TargetPageItem[]>([]);
  const [loadingTargets, setLoadingTargets] = useState<boolean>(true);
  const [newTargetPageId, setNewTargetPageId] = useState<string>("");
  const [newTargetPageName, setNewTargetPageName] = useState<string>("");
  const [newTargetToken, setNewTargetToken] = useState<string>("");
  const [newTargetIsDefault, setNewTargetIsDefault] = useState<boolean>(true);
  const [savingTarget, setSavingTarget] = useState<boolean>(false);
  const [verifyingTarget, setVerifyingTarget] = useState<boolean>(false);

  // Source Pages state
  const [sourcePages, setSourcePages] = useState<SourcePageItem[]>([]);
  const [loadingSources, setLoadingSources] = useState<boolean>(true);
  const [sourceInputMode, setSourceInputMode] = useState<SourcePageInputMode>("url_scrape");
  const [newSourceUrl, setNewSourceUrl] = useState<string>("");
  const [newSourceName, setNewSourceName] = useState<string>("");
  const [newSourcePageId, setNewSourcePageId] = useState<string>("");
  const [newSourceToken, setNewSourceToken] = useState<string>("");
  const [newSourceScanLimit, setNewSourceScanLimit] = useState<number>(5);
  const [savingSource, setSavingSource] = useState<boolean>(false);
  const [scanningSourceId, setScanningSourceId] = useState<string | null>(null);
  const [urlValidationMsg, setUrlValidationMsg] = useState<{
    valid: boolean;
    text: string;
  } | null>(null);

  // Global feedback notification
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Load Target Pages
  const fetchTargetPages = useCallback(async () => {
    try {
      setLoadingTargets(true);
      const res = await fetch("/api/pages/target");
      if (res.ok) {
        const data = await res.json();
        setTargetPages(data.pages || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingTargets(false);
    }
  }, []);

  // Load Source Pages
  const fetchSourcePages = useCallback(async () => {
    try {
      setLoadingSources(true);
      const res = await fetch("/api/pages/source");
      if (res.ok) {
        const data = await res.json();
        setSourcePages(data.pages || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingSources(false);
    }
  }, []);

  useEffect(() => {
    fetchTargetPages();
    fetchSourcePages();
  }, [fetchTargetPages, fetchSourcePages]);

  // Handle Target Page verification
  const handleVerifyTargetToken = async () => {
    if (!newTargetPageId.trim() || !newTargetToken.trim()) {
      setFeedback({
        type: "error",
        text: "Vui lòng nhập đầy đủ Facebook Page ID và Page Access Token trước khi kiểm tra.",
      });
      return;
    }
    setVerifyingTarget(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/pages/target", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify",
          pageId: newTargetPageId.trim(),
          accessToken: newTargetToken.trim(),
        }),
      });
      const data = await res.json();
      if (data.success && data.validation) {
        if (data.validation.pageName) {
          setNewTargetPageName(data.validation.pageName);
        }
        setFeedback({
          type: "success",
          text: `Xác thực thành công! Fanpage: "${data.validation.pageName}" (ID: ${data.validation.pageId})`,
        });
      } else {
        setFeedback({
          type: "error",
          text: `Kiểm tra thất bại: ${data.error || "Token không hợp lệ hoặc thiếu quyền"}`,
        });
      }
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        text: `Lỗi kết nối Graph API: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setVerifyingTarget(false);
    }
  };

  // Handle Save Target Page
  const handleSaveTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTargetPageId.trim() || !newTargetToken.trim()) {
      setFeedback({
        type: "error",
        text: "Page ID và Page Access Token không được để trống.",
      });
      return;
    }

    setSavingTarget(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/pages/target", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId: newTargetPageId.trim(),
          pageName: newTargetPageName.trim() || "Facebook Fanpage",
          accessToken: newTargetToken.trim(),
          isDefault: newTargetIsDefault,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({
          type: "success",
          text: `Đã lưu Fanpage đích "${data.page.pageName}" thành công!`,
        });
        setNewTargetPageId("");
        setNewTargetPageName("");
        setNewTargetToken("");
        await fetchTargetPages();
      } else {
        setFeedback({
          type: "error",
          text: data.error || "Không thể lưu Fanpage đích.",
        });
      }
    } finally {
      setSavingTarget(false);
    }
  };

  // Set default target page
  const handleSetDefaultTarget = async (id: string) => {
    try {
      const res = await fetch("/api/pages/target", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_default", id }),
      });
      if (res.ok) {
        setFeedback({
          type: "success",
          text: "Đã cập nhật Fanpage đăng mặc định thành công!",
        });
        await fetchTargetPages();
      }
    } catch {
      setFeedback({ type: "error", text: "Lỗi cập nhật Fanpage mặc định." });
    }
  };

  // Delete target page
  const handleDeleteTarget = async (id: string, name: string) => {
    if (!window.confirm(`Bạn có chắc muốn xóa Fanpage đích "${name}"?`)) return;
    try {
      const res = await fetch(`/api/pages/target?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setFeedback({
          type: "success",
          text: `Đã xóa Fanpage đích "${name}".`,
        });
        await fetchTargetPages();
      }
    } catch {
      setFeedback({ type: "error", text: "Lỗi khi xóa Fanpage đích." });
    }
  };

  // Validate Source URL on change / blur
  const handleValidateSourceUrl = async (url: string) => {
    if (!url.trim()) {
      setUrlValidationMsg(null);
      return;
    }
    try {
      const res = await fetch("/api/pages/source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "validate_url", url: url.trim() }),
      });
      const data = await res.json();
      if (data.success && data.parsedUrl?.isValid) {
        setUrlValidationMsg({
          valid: true,
          text: `URL hợp lệ (${data.parsedUrl.identifierType === "id" ? "ID Fanpage" : "Định danh Slug"}: ${data.parsedUrl.slugOrId})`,
        });
        if (!newSourceName.trim() && data.parsedUrl.slugOrId) {
          setNewSourceName(data.parsedUrl.slugOrId);
        }
      } else {
        setUrlValidationMsg({
          valid: false,
          text: data.error || "URL Facebook không hợp lệ",
        });
      }
    } catch {
      setUrlValidationMsg(null);
    }
  };

  // Handle Save Source Page
  const handleSaveSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sourceInputMode === "url_scrape" && !newSourceUrl.trim()) {
      setFeedback({
        type: "error",
        text: "Vui lòng nhập đường link Fanpage Facebook công khai.",
      });
      return;
    }
    if (sourceInputMode === "graph_api" && !newSourcePageId.trim() && !newSourceUrl.trim()) {
      setFeedback({
        type: "error",
        text: "Chế độ Graph API yêu cầu nhập Page ID hoặc URL của Fanpage.",
      });
      return;
    }

    setSavingSource(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/pages/source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newSourceName.trim(),
          url: newSourceUrl.trim(),
          pageId: newSourcePageId.trim(),
          inputMode: sourceInputMode,
          accessToken: newSourceToken.trim(),
          scanPostLimit: newSourceScanLimit,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({
          type: "success",
          text: `Đã thêm Fanpage nguồn "${data.page.name}" vào danh sách theo dõi!`,
        });
        setNewSourceUrl("");
        setNewSourceName("");
        setNewSourcePageId("");
        setNewSourceToken("");
        setUrlValidationMsg(null);
        await fetchSourcePages();
      } else {
        setFeedback({
          type: "error",
          text: data.error || "Không thể lưu Fanpage nguồn theo dõi.",
        });
      }
    } finally {
      setSavingSource(false);
    }
  };

  // Delete source page
  const handleDeleteSource = async (id: string, name: string) => {
    if (!window.confirm(`Bạn có chắc muốn ngừng theo dõi Fanpage nguồn "${name}"?`)) return;
    try {
      const res = await fetch(`/api/pages/source?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setFeedback({
          type: "success",
          text: `Đã xóa Fanpage nguồn "${name}".`,
        });
        await fetchSourcePages();
      }
    } catch {
      setFeedback({ type: "error", text: "Lỗi khi xóa Fanpage nguồn." });
    }
  };

  const handleScanSourcePage = async (page: SourcePageItem) => {
    setScanningSourceId(page.id);
    setFeedback(null);
    try {
      const res = await fetch("/api/source-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourcePageId: page.id,
          limit: page.scanPostLimit || 5,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({
          type: "success",
          text: `${data.message || "Đã thu thập bài viết thành công!"} Chuyển sang mục "Duyệt Bài & Xào Lại" để xem và duyệt bài.`,
        });
        await fetchSourcePages();
      } else {
        setFeedback({
          type: "error",
          text: data.error || "Không thể quét bài từ Fanpage này.",
        });
      }
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        text: `Lỗi quét bài: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setScanningSourceId(null);
    }
  };

  const maskToken = (token: string) => {
    if (!token) return "Chưa thiết lập";
    if (token.length <= 14) return "••••••••••••";
    return `${token.substring(0, 7)}...${token.substring(token.length - 6)}`;
  };

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Settings className="w-6 h-6 text-slate-700" />
          <span>Cấu Hình Hệ Thống &amp; Quản Lý Fanpage</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Phân định Bounded Context: Tách biệt Fanpage Đích (đăng bài) và Fanpage Nguồn (thu thập nội dung tham khảo).
        </p>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("target")}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition flex items-center gap-2 cursor-pointer border-b-2 ${
            activeTab === "target"
              ? "border-[#1877F2] text-[#1877F2] bg-blue-50/50"
              : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <Facebook className="w-4 h-4 text-[#1877F2]" />
          <span>Fanpage Đăng Bài (Target Pages)</span>
          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-800">
            {targetPages.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("source")}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition flex items-center gap-2 cursor-pointer border-b-2 ${
            activeTab === "source"
              ? "border-indigo-600 text-indigo-700 bg-indigo-50/50"
              : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <Radio className="w-4 h-4 text-indigo-600" />
          <span>Fanpage Nguồn Theo Dõi (Source Pages)</span>
          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-indigo-100 text-indigo-800">
            {sourcePages.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("database")}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition flex items-center gap-2 cursor-pointer border-b-2 ${
            activeTab === "database"
              ? "border-emerald-600 text-emerald-700 bg-emerald-50/50"
              : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <Database className="w-4 h-4 text-emerald-600" />
          <span>Cơ Sở Dữ Liệu SQLite &amp; Hệ Thống</span>
        </button>
      </div>

      {/* Global Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-sm transition animate-in fade-in duration-200 ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-red-50 border-red-200 text-red-900"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs opacity-60 hover:opacity-100 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: TARGET PAGES (FANPAGE ĐÍCH) */}
      {/* ========================================================================= */}
      {activeTab === "target" && (
        <div className="space-y-6">
          {/* Informational Banner */}
          <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 flex items-start gap-3 text-xs text-blue-900">
            <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-blue-950">
                Fanpage Đích (Target Pages) có toàn quyền phân phối &amp; đăng tải bài viết
              </p>
              <p className="text-blue-800 leading-relaxed">
                Yêu cầu Facebook Page ID và Page Access Token với các quyền:{" "}
                <code className="bg-white/80 px-1 py-0.5 rounded font-mono text-[11px]">pages_manage_posts</code>,{" "}
                <code className="bg-white/80 px-1 py-0.5 rounded font-mono text-[11px]">pages_read_engagement</code>. Hệ thống bảo vệ tuyệt đối không gửi nhầm bài viết sang các Fanpage nguồn.
              </p>
            </div>
          </div>

          {/* List of Configured Target Pages */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Facebook className="w-5 h-5 text-[#1877F2]" />
                <h2 className="font-bold text-sm text-slate-900">
                  Danh Sách Fanpage Đích Đã Kết Nối ({targetPages.length})
                </h2>
              </div>
              <button
                type="button"
                onClick={fetchTargetPages}
                className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Tải lại</span>
              </button>
            </div>

            {loadingTargets ? (
              <div className="py-6 text-center text-xs text-slate-400">
                Đang tải danh sách Fanpage đích...
              </div>
            ) : targetPages.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 space-y-1">
                <p>Chưa có Fanpage đích nào được cấu hình.</p>
                <p className="text-slate-500">Hãy thêm Fanpage đầu tiên bên dưới để bắt đầu đăng bài tự động.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {targetPages.map((page) => (
                  <div
                    key={page.id}
                    className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition ${
                      page.isDefault
                        ? "bg-blue-50/40 border-blue-200"
                        : "bg-slate-50/50 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {page.avatarUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={page.avatarUrl}
                          alt={page.pageName}
                          className="w-10 h-10 rounded-full border border-slate-200 object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-[#1877F2] text-white flex items-center justify-center font-bold">
                          <Facebook className="w-5 h-5" />
                        </div>
                      )}

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-slate-900">{page.pageName}</span>
                          {page.isDefault && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white">
                              <Star className="w-3 h-3 fill-current" />
                              <span>Mặc định</span>
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              page.status === "active"
                                ? "bg-emerald-100 text-emerald-800"
                                : page.status === "token_expired"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {page.status === "active" ? "Hoạt động" : page.status}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono">
                          <span>ID: {page.pageId}</span>
                          <span>•</span>
                          <span>Token: {maskToken(page.accessToken)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {!page.isDefault && (
                        <button
                          type="button"
                          onClick={() => handleSetDefaultTarget(page.id)}
                          className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-white text-slate-700 transition cursor-pointer"
                        >
                          Đặt mặc định
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDeleteTarget(page.id, page.pageName)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition cursor-pointer"
                        title="Xóa Fanpage này"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Target Page Form */}
          <form
            onSubmit={handleSaveTarget}
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4"
          >
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Plus className="w-4 h-4 text-[#1877F2]" />
              <h2 className="font-bold text-sm text-slate-900">
                Thêm Fanpage Đích Mới (Có Quyền Đăng Bài)
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Facebook Page ID: <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newTargetPageId}
                  onChange={(e) => setNewTargetPageId(e.target.value)}
                  placeholder="VD: 104928374928374"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-blue-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tên Hiển Thị Fanpage (Tùy chọn):
                </label>
                <input
                  type="text"
                  value={newTargetPageName}
                  onChange={(e) => setNewTargetPageName(e.target.value)}
                  placeholder="Tự động nhận diện khi kiểm tra Token..."
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Page Access Token (Graph API): <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                value={newTargetToken}
                onChange={(e) => setNewTargetToken(e.target.value)}
                placeholder="Dán mã Page Access Token (EAA...) lấy từ Meta Graph API Explorer..."
                className="w-full p-3 text-xs font-mono rounded-xl border border-slate-200 focus:outline-none focus:border-blue-600"
                required
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="targetDefaultCheckbox"
                checked={newTargetIsDefault}
                onChange={(e) => setNewTargetIsDefault(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="targetDefaultCheckbox" className="text-xs text-slate-700 font-medium cursor-pointer">
                Đặt làm Fanpage đăng bài mặc định của hệ thống
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleVerifyTargetToken}
                disabled={verifyingTarget}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 transition cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{verifyingTarget ? "Đang xác thực..." : "Kiểm Tra Token"}</span>
              </button>

              <button
                type="submit"
                disabled={savingTarget}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#1877F2] hover:bg-[#166fe5] text-white shadow-xs transition cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{savingTarget ? "Đang lưu..." : "Lưu Fanpage Đích"}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SOURCE PAGES (FANPAGE NGUỒN THEO DÕI) */}
      {/* ========================================================================= */}
      {activeTab === "source" && (
        <div className="space-y-6">
          {/* Informational Banner */}
          <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 flex items-start gap-3 text-xs text-indigo-950">
            <Radio className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-indigo-950">
                Fanpage Nguồn (Source Pages) là kênh tham khảo &amp; lấy cảm hứng nội dung
              </p>
              <p className="text-indigo-800 leading-relaxed">
                Hỗ trợ cả 2 chế độ: <strong>Nhập Link/URL công khai bất kỳ</strong> hoặc <strong>Facebook Graph API</strong>.
                Hệ thống cam kết <strong>tuyệt đối không có quyền đăng bài trực tiếp</strong> lên Fanpage nguồn để đảm bảo an toàn và bảo mật thương hiệu.
              </p>
            </div>
          </div>

          {/* List of Configured Source Pages */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-indigo-600" />
                <h2 className="font-bold text-sm text-slate-900">
                  Danh Sách Fanpage Nguồn Đang Theo Dõi ({sourcePages.length})
                </h2>
              </div>
              <button
                type="button"
                onClick={fetchSourcePages}
                className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Tải lại</span>
              </button>
            </div>

            {loadingSources ? (
              <div className="py-6 text-center text-xs text-slate-400">
                Đang tải danh sách Fanpage nguồn...
              </div>
            ) : sourcePages.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 space-y-1">
                <p>Chưa có Fanpage nguồn nào được thêm vào danh sách theo dõi.</p>
                <p className="text-slate-500">Hãy thêm link Fanpage đối thủ hoặc trang tin tức bên dưới để bắt đầu quét bài.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sourcePages.map((page) => (
                  <div
                    key={page.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:border-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900">{page.name}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            page.inputMode === "url_scrape"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-purple-100 text-purple-800"
                          }`}
                        >
                          {page.inputMode === "url_scrape" ? "URL công khai" : "Graph API"}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200/80 text-slate-700">
                          Quét {page.scanPostLimit} bài mới
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            page.status === "active"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {page.status === "active" ? "Đang theo dõi" : page.status}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-600">
                        <a
                          href={page.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:underline flex items-center gap-1 font-mono text-[11px]"
                        >
                          <span>{page.url}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>

                      <div className="text-[11px] text-slate-400">
                        {page.lastScannedAt ? (
                          <span>
                            Lần quét gần nhất: {new Date(page.lastScannedAt).toLocaleString("vi-VN")} • Đã thu thập: {page.totalPostsScanned} bài
                          </span>
                        ) : (
                          <span>Chưa thực hiện quét bài lần nào</span>
                        )}
                        {page.lastError && (
                          <span className="text-red-500 ml-2">({page.lastError})</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => handleScanSourcePage(page)}
                        disabled={scanningSourceId === page.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition cursor-pointer disabled:opacity-50"
                        title="Quét bài mới nhất từ Fanpage này"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${scanningSourceId === page.id ? "animate-spin" : ""}`} />
                        <span>{scanningSourceId === page.id ? "Đang quét..." : "Quét bài mới"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteSource(page.id, page.name)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition cursor-pointer"
                        title="Xóa Fanpage nguồn này"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Source Page Form */}
          <form
            onSubmit={handleSaveSource}
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-600" />
                <h2 className="font-bold text-sm text-slate-900">
                  Thêm Fanpage Nguồn Cần Theo Dõi
                </h2>
              </div>

              {/* Mode Toggle Pills */}
              <div className="flex p-0.5 rounded-lg bg-slate-100 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setSourceInputMode("url_scrape")}
                  className={`px-3 py-1 rounded-md transition cursor-pointer ${
                    sourceInputMode === "url_scrape"
                      ? "bg-white text-indigo-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Link / URL Công Khai
                </button>
                <button
                  type="button"
                  onClick={() => setSourceInputMode("graph_api")}
                  className={`px-3 py-1 rounded-md transition cursor-pointer ${
                    sourceInputMode === "graph_api"
                      ? "bg-white text-indigo-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Facebook Graph API
                </button>
              </div>
            </div>

            {/* Mode A: URL Scrape */}
            {sourceInputMode === "url_scrape" ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Đường Link Fanpage Facebook Công Khai: <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Globe className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      value={newSourceUrl}
                      onChange={(e) => {
                        setNewSourceUrl(e.target.value);
                        handleValidateSourceUrl(e.target.value);
                      }}
                      onBlur={() => handleValidateSourceUrl(newSourceUrl)}
                      placeholder="VD: https://www.facebook.com/thongtinchinhphu hoặc fb.com/baoquangninh"
                      className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-600"
                      required
                    />
                  </div>
                  {urlValidationMsg && (
                    <div
                      className={`text-xs mt-1.5 flex items-center gap-1 font-medium ${
                        urlValidationMsg.valid ? "text-emerald-600" : "text-amber-600"
                      }`}
                    >
                      {urlValidationMsg.valid ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5" />
                      )}
                      <span>{urlValidationMsg.text}</span>
                    </div>
                  )}
                  <p className="text-[11px] text-slate-400 mt-1">
                    Hỗ trợ định dạng: <code>facebook.com/slug</code>, <code>fb.com/slug</code>, <code>profile.php?id=123...</code>
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Tên Gợi Nhớ Fanpage:
                    </label>
                    <input
                      type="text"
                      value={newSourceName}
                      onChange={(e) => setNewSourceName(e.target.value)}
                      placeholder="VD: Thông Tin Chính Phủ (để trống sẽ tự trích xuất)"
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Số Lượng Bài Quét Mỗi Lần (1 - 10 bài):
                    </label>
                    <select
                      value={newSourceScanLimit}
                      onChange={(e) => setNewSourceScanLimit(Number(e.target.value))}
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-600 bg-white"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                        <option key={num} value={num}>
                          {num} bài viết mới nhất
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ) : (
              /* Mode B: Graph API */
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Facebook Page ID / Username: <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newSourcePageId}
                      onChange={(e) => setNewSourcePageId(e.target.value)}
                      placeholder="VD: 104928374928374"
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-600"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Tên Fanpage:
                    </label>
                    <input
                      type="text"
                      value={newSourceName}
                      onChange={(e) => setNewSourceName(e.target.value)}
                      placeholder="VD: Tin Tức Tổng Hợp"
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Access Token Đọc Dữ Liệu (Tùy chọn):
                  </label>
                  <input
                    type="text"
                    value={newSourceToken}
                    onChange={(e) => setNewSourceToken(e.target.value)}
                    placeholder="User Token hoặc App Token để đọc qua Graph API nếu trang bị giới hạn..."
                    className="w-full px-3.5 py-2 text-xs font-mono rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Số Lượng Bài Quét Mỗi Lần (1 - 10 bài):
                  </label>
                  <select
                    value={newSourceScanLimit}
                    onChange={(e) => setNewSourceScanLimit(Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-600 bg-white"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                      <option key={num} value={num}>
                        {num} bài viết mới nhất
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={savingSource}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition cursor-pointer"
              >
                <Radio className="w-4 h-4" />
                <span>{savingSource ? "Đang lưu..." : "Thêm Fanpage Nguồn Theo Dõi"}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: DATABASE & SYSTEM HEALTH */}
      {/* ========================================================================= */}
      {activeTab === "database" && <DatabaseManagerCard />}
    </div>
  );
}

function DatabaseManagerCard() {
  const [stats, setStats] = useState<{
    engine: string;
    dbPath: string;
    sizeBytes: number;
    totalTopics: number;
    totalKeys: number;
    totalPosts: number;
    totalImages: number;
    totalTargetPages?: number;
    totalSourcePages?: number;
    totalSourcePosts?: number;
    totalModerationQueue?: number;
    journalMode: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [dbMessage, setDbMessage] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/db");
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleVacuum = async () => {
    setLoading(true);
    setDbMessage(null);
    try {
      const res = await fetch("/api/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "vacuum" }),
      });
      const data = await res.json();
      if (res.ok) {
        setStats(data.stats);
        setDbMessage("Đã tối ưu hóa và nén cơ sở dữ liệu SQLite thành công (VACUUM)!");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold">
            DB
          </div>
          <div>
            <h2 className="font-bold text-sm text-slate-900">
              Cơ Sở Dữ Liệu SQLite (Lưu Trữ Dữ Liệu Bền Vững)
            </h2>
            <p className="text-xs text-slate-500">
              Quản lý Target Pages, Source Pages, Source Posts, Hàng đợi duyệt bài và Cấu hình hệ thống
            </p>
          </div>
        </div>

        <button
          onClick={handleVacuum}
          disabled={loading}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 transition cursor-pointer"
        >
          {loading ? "Đang xử lý..." : "Tối ưu hóa (VACUUM)"}
        </button>
      </div>

      {dbMessage && (
        <div className="p-3 text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl">
          {dbMessage}
        </div>
      )}

      {stats ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="text-[11px] text-slate-500 font-medium">Fanpage Đích (Target)</div>
            <div className="text-base font-bold text-[#1877F2] mt-0.5">
              {stats.totalTargetPages ?? 0}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="text-[11px] text-slate-500 font-medium">Fanpage Nguồn (Source)</div>
            <div className="text-base font-bold text-indigo-600 mt-0.5">
              {stats.totalSourcePages ?? 0}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="text-[11px] text-slate-500 font-medium">Bài Đã Thu Thập</div>
            <div className="text-base font-bold text-emerald-600 mt-0.5">
              {stats.totalSourcePosts ?? 0}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="text-[11px] text-slate-500 font-medium">Hàng Đợi Duyệt Bài</div>
            <div className="text-base font-bold text-amber-600 mt-0.5">
              {stats.totalModerationQueue ?? 0}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="text-[11px] text-slate-500 font-medium">Chủ đề trong DB</div>
            <div className="text-base font-bold text-slate-900 mt-0.5">{stats.totalTopics}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="text-[11px] text-slate-500 font-medium">Key Gemini</div>
            <div className="text-base font-bold text-indigo-600 mt-0.5">{stats.totalKeys}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="text-[11px] text-slate-500 font-medium">Bài viết &amp; Bản nháp</div>
            <div className="text-base font-bold text-emerald-600 mt-0.5">{stats.totalPosts}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="text-[11px] text-slate-500 font-medium">Dung lượng SQLite</div>
            <div className="text-base font-bold text-slate-900 mt-0.5">
              {(stats.sizeBytes / 1024).toFixed(1)} KB
            </div>
          </div>
        </div>
      ) : (
        <div className="text-xs text-slate-400">Đang tải trạng thái Database...</div>
      )}

      <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200 text-[11px] text-slate-600 space-y-1 font-mono">
        <div>• <strong>Engine:</strong> SQLite 3 (ACID, Chế độ WAL - Write-Ahead Logging)</div>
        <div>• <strong>Tệp cơ sở dữ liệu:</strong> {stats?.dbPath || "data/app.db"}</div>
        <div>• <strong>Đặc tính:</strong> Phân định Bounded Context độc lập, tự động đồng bộ và bảo toàn toàn vẹn dữ liệu.</div>
      </div>
    </div>
  );
}
