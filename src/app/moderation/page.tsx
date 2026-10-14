"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Sparkles,
  RefreshCw,
  CheckCircle2,
  Clock,
  Send,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  Trash2,
  Edit3,
  Layers,
  ShieldAlert,
  Flame,
  FileText,
  Eye,
  Check,
  X,
  Radio,
  Sliders,
  ChevronDown,
} from "lucide-react";
import {
  ModerationQueueItem,
  ModerationStatus,
  SourcePostItem,
} from "@/types/sourcePost.types";
import { TargetPageItem, SourcePageItem } from "@/types/sourcePage.types";

export default function ModerationQueuePage() {
  const [items, setItems] = useState<ModerationQueueItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<ModerationStatus | "all">("pending");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // Stats
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    published: 0,
    scheduled: 0,
    rejected: 0,
    total: 0,
  });

  // Source & Target pages
  const [sourcePages, setSourcePages] = useState<SourcePageItem[]>([]);
  const [targetPages, setTargetPages] = useState<TargetPageItem[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string>("");
  const [scanLimit, setScanLimit] = useState<number>(5);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanNotification, setScanNotification] = useState<{
    type: "info" | "success" | "warning";
    text: string;
  } | null>(null);

  // Active item editing state
  const [editingItem, setEditingItem] = useState<ModerationQueueItem | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [isRewriting, setIsRewriting] = useState<boolean>(false);
  const [rewriteStyle, setRewriteStyle] = useState<string>("storytelling");
  const [actionFeedback, setActionFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Load Queue Items
  const fetchQueue = useCallback(async () => {
    try {
      setLoading(true);
      const url =
        statusFilter === "all"
          ? "/api/moderation-queue"
          : `/api/moderation-queue?status=${statusFilter}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        if (data.stats) setStats(data.stats);

        // Select first item if none selected
        if (data.items && data.items.length > 0 && !selectedItemId) {
          setSelectedItemId(data.items[0].id);
          setEditingItem(data.items[0]);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [statusFilter, selectedItemId]);

  // Load Pages
  const fetchPages = async () => {
    try {
      const [srcRes, tgtRes] = await Promise.all([
        fetch("/api/pages/source"),
        fetch("/api/pages/target"),
      ]);
      if (srcRes.ok) {
        const data = await srcRes.json();
        setSourcePages(data.pages || []);
        if (data.pages && data.pages.length > 0 && !selectedSourceId) {
          setSelectedSourceId(data.pages[0].id);
        }
      }
      if (tgtRes.ok) {
        const data = await tgtRes.json();
        setTargetPages(data.pages || []);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchQueue();
    fetchPages();
  }, [fetchQueue]);

  // Select item to view/edit
  const handleSelectItem = (item: ModerationQueueItem) => {
    setSelectedItemId(item.id);
    setEditingItem({ ...item });
    setActionFeedback(null);
  };

  // Trigger Scanning posts from a source page
  const handleScanSource = async () => {
    if (!selectedSourceId) {
      setScanNotification({
        type: "warning",
        text: "Vui lòng chọn một Fanpage nguồn để quét bài.",
      });
      return;
    }

    setIsScanning(true);
    setScanNotification(null);
    try {
      const res = await fetch("/api/source-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourcePageId: selectedSourceId,
          limit: scanLimit,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setScanNotification({
          type: data.result?.allAlreadyCollected ? "warning" : "success",
          text: data.message || "Thu thập bài viết hoàn tất.",
        });

        // Automatically trigger AI repurpose for the newest or evergreen candidate post
        const postToRepurpose: SourcePostItem | null =
          data.result?.evergreenSuggestion ||
          (data.posts && data.posts.length > 0 ? data.posts[0] : null);

        if (postToRepurpose) {
          await triggerRepurposeForPost(postToRepurpose.id);
        }
      } else {
        setScanNotification({
          type: "warning",
          text: data.error || "Không thể thu thập bài viết.",
        });
      }
    } catch (err: unknown) {
      setScanNotification({
        type: "warning",
        text: `Lỗi quét bài: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setIsScanning(false);
    }
  };

  // Trigger AI Repurpose for a specific source post
  const triggerRepurposeForPost = async (sourcePostId: string) => {
    setIsRewriting(true);
    try {
      const res = await fetch("/api/moderation-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "repurpose",
          sourcePostId,
          preferredStyle: rewriteStyle,
        }),
      });
      const data = await res.json();
      if (data.success && data.item) {
        await fetchQueue();
        setSelectedItemId(data.item.id);
        setEditingItem(data.item);
        setActionFeedback({
          type: "success",
          text: data.message || "AI đã bóc tách ý chính và xào lại bài viết thành công!",
        });
      }
    } catch {
      // ignore
    } finally {
      setIsRewriting(false);
    }
  };

  // Save edits
  const handleSaveEdit = async () => {
    if (!editingItem) return;
    setIsSavingEdit(true);
    setActionFeedback(null);

    // Reconstruct full post from components if edited
    const fullPost = [
      editingItem.aiHeadline,
      editingItem.aiHook,
      editingItem.aiBody,
      editingItem.aiConclusion,
      editingItem.hashtags && editingItem.hashtags.length > 0
        ? editingItem.hashtags.join(" ")
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    try {
      const res = await fetch("/api/moderation-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          id: editingItem.id,
          updates: {
            ...editingItem,
            aiFullPost: fullPost,
          },
        }),
      });
      const data = await res.json();
      if (data.success && data.item) {
        setEditingItem(data.item);
        await fetchQueue();
        setActionFeedback({
          type: "success",
          text: "Đã lưu nội dung chỉnh sửa thành công!",
        });
      }
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Publish Now
  const handlePublishNow = async () => {
    if (!editingItem) return;
    if (
      !window.confirm(
        `Bạn có chắc chắn muốn đăng bài viết này lên Fanpage "${
          editingItem.targetPageName || "mặc định"
        }"?`
      )
    )
      return;

    setIsPublishing(true);
    setActionFeedback(null);
    try {
      const res = await fetch("/api/moderation-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "publish_now",
          id: editingItem.id,
        }),
      });
      const data = await res.json();
      if (data.success && data.item) {
        setEditingItem(data.item);
        await fetchQueue();
        setActionFeedback({
          type: "success",
          text: data.message || "Đã đăng bài thành công lên Facebook!",
        });
      } else {
        setActionFeedback({
          type: "error",
          text: data.error || "Không thể đăng bài lên Facebook.",
        });
      }
    } finally {
      setIsPublishing(false);
    }
  };

  // Rewrite with different style
  const handleRewriteAgain = async () => {
    if (!editingItem || !editingItem.sourcePostId) return;
    await triggerRepurposeForPost(editingItem.sourcePostId);
  };

  // Reject / Delete
  const handleDeleteItem = async (id: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa bài viết này khỏi hàng đợi duyệt?"))
      return;

    try {
      const res = await fetch(`/api/moderation-queue?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        if (selectedItemId === id) {
          setSelectedItemId(null);
          setEditingItem(null);
        }
        await fetchQueue();
      }
    } catch {
      // ignore
    }
  };

  // Golden hours 1-click helper
  const applyGoldenHour = (timeStr: string) => {
    if (!editingItem) return;
    const now = new Date();
    const [hours, minutes] = timeStr.split(":").map(Number);
    const target = new Date(now);
    target.setHours(hours, minutes, 0, 0);

    // If time has passed today, schedule for tomorrow
    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
    }

    setEditingItem({
      ...editingItem,
      scheduledAt: target.toISOString(),
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Header with Title & Live Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">
                Hàng Đợi Duyệt Bài (Moderation Review Queue)
              </h1>
              <p className="text-xs text-slate-500">
                AI bóc tách ý chính, xào lại độc bản &amp; tinh gọn 30-50% • Người dùng duyệt trước khi đăng
              </p>
            </div>
          </div>
        </div>

        {/* Stats Badges */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <button
            onClick={() => setStatusFilter("pending")}
            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
              statusFilter === "pending"
                ? "bg-amber-500 text-white shadow-xs"
                : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Chờ duyệt: {stats.pending}</span>
          </button>

          <button
            onClick={() => setStatusFilter("published")}
            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
              statusFilter === "published"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Đã đăng: {stats.published}</span>
          </button>

          <button
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
              statusFilter === "all"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <span>Tất cả: {stats.total}</span>
          </button>
        </div>
      </div>

      {/* 2. Top Harvester Control Box (Quét bài từ Page Nguồn) */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 rounded-2xl shadow-md border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-sm font-bold">Thu Thập Bài Mới Từ Fanpage Nguồn</h2>
              <p className="text-[11px] text-slate-300">
                Tự động kiểm tra bài mới, tải ảnh gốc &amp; kích hoạt cơ chế xào lại bài cũ nếu hết bài mới
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={selectedSourceId}
              onChange={(e) => setSelectedSourceId(e.target.value)}
              className="bg-slate-800/90 text-white border border-slate-700 rounded-xl px-3 py-1.5 text-xs focus:outline-none"
            >
              {sourcePages.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.name} ({sp.inputMode === "url_scrape" ? "URL" : "Graph API"})
                </option>
              ))}
            </select>

            <select
              value={scanLimit}
              onChange={(e) => setScanLimit(Number(e.target.value))}
              className="bg-slate-800/90 text-white border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none"
            >
              <option value={3}>3 bài mới nhất</option>
              <option value={5}>5 bài mới nhất</option>
              <option value={10}>10 bài mới nhất</option>
            </select>

            <button
              onClick={handleScanSource}
              disabled={isScanning || isRewriting}
              className="px-4 py-1.5 bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-indigo-600/30 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? "animate-spin" : ""}`} />
              <span>{isScanning ? "Đang quét..." : "Quét &amp; Xào Bài Ngay"}</span>
            </button>
          </div>
        </div>

        {scanNotification && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              scanNotification.type === "warning"
                ? "bg-amber-500/20 text-amber-200 border border-amber-500/30"
                : "bg-emerald-500/20 text-emerald-200 border border-emerald-500/30"
            }`}
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{scanNotification.text}</span>
          </div>
        )}
      </div>

      {/* 3. Main Workspace: Side-by-Side Review Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Queue Items List (lg:col-span-4) */}
        <div className="lg:col-span-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3 max-h-[85vh] overflow-y-auto">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-700">
              Danh sách bài chờ duyệt ({items.length})
            </span>
            <button
              onClick={fetchQueue}
              className="p-1 rounded text-slate-400 hover:text-slate-700"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Đang tải danh sách bài viết...
            </div>
          ) : items.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 space-y-1">
              <p>Chưa có bài viết nào trong hàng đợi.</p>
              <p className="text-slate-500">
                Hãy bấm nút &quot;Quét &amp; Xào Bài Ngay&quot; ở trên để bắt đầu!
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {items.map((item) => {
                const isSelected = item.id === selectedItemId;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectItem(item)}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer space-y-2 ${
                      isSelected
                        ? "border-indigo-600 bg-indigo-50/60 shadow-xs"
                        : "border-slate-200 bg-slate-50/50 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-indigo-700 truncate max-w-[160px]">
                        {item.sourcePageName}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          item.status === "pending"
                            ? "bg-amber-100 text-amber-800"
                            : item.status === "published"
                            ? "bg-emerald-100 text-emerald-800"
                            : item.status === "scheduled"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {item.status === "pending"
                          ? "Chờ duyệt"
                          : item.status === "published"
                          ? "Đã đăng"
                          : item.status === "scheduled"
                          ? "Hẹn giờ"
                          : "Đã từ chối"}
                      </span>
                    </div>

                    <h3 className="text-xs font-bold text-slate-900 line-clamp-2">
                      {item.aiHeadline || "Bài viết chưa có tiêu đề"}
                    </h3>

                    <p className="text-[11px] text-slate-500 line-clamp-2">
                      {item.aiHook || item.sourceContent}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-200/60">
                      <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                        <Flame className="w-3 h-3 text-emerald-600" />
                        <span>SEO: {item.seoScore}/100</span>
                      </span>

                      {item.compressionRate ? (
                        <span className="text-indigo-600 font-bold">
                          Giảm {item.compressionRate}% từ
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Area: Side-by-Side Review & Editing Station (lg:col-span-8) */}
        <div className="lg:col-span-8 space-y-4">
          {!editingItem ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
              Chọn một bài viết ở danh sách bên trái để xem so sánh và duyệt bài.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Feedback Alert */}
              {actionFeedback && (
                <div
                  className={`p-3.5 rounded-2xl text-xs flex items-center justify-between shadow-xs ${
                    actionFeedback.type === "success"
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-red-50 text-red-800 border border-red-200"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{actionFeedback.text}</span>
                  </div>
                  <button
                    onClick={() => setActionFeedback(null)}
                    className="p-1 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Side-by-Side Comparison Container */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Left Sub-column: BÀI GỐC (Source Post) */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <div className="flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-slate-600" />
                      <span className="text-xs font-bold text-slate-800">
                        Bài Gốc Từ: {editingItem.sourcePageName}
                      </span>
                    </div>
                    {editingItem.sourceUrl && (
                      <a
                        href={editingItem.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-blue-600 hover:underline flex items-center gap-0.5"
                      >
                        <span>Link FB</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  {/* Word count tag */}
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span>
                      Độ dài bài gốc:{" "}
                      <strong>{editingItem.originalWordCount || 0} từ</strong>
                    </span>
                  </div>

                  {/* Original Content Text */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed max-h-72 overflow-y-auto whitespace-pre-wrap font-sans">
                    {editingItem.sourceContent}
                  </div>

                  {/* Original Media Thumbnails */}
                  {editingItem.sourceImages && editingItem.sourceImages.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[11px] font-bold text-slate-600">
                        Hình ảnh đính kèm ({editingItem.sourceImages.length}):
                      </span>
                      <div className="flex items-center gap-2 overflow-x-auto pb-1">
                        {editingItem.sourceImages.map((img, i) => (
                          <a
                            key={i}
                            href={img}
                            target="_blank"
                            rel="noreferrer"
                            className="w-16 h-16 rounded-lg overflow-hidden border border-slate-200 shrink-0 block bg-slate-100"
                          >
                            <img
                              src={img}
                              alt="media"
                              className="w-full h-full object-cover"
                            />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Extracted Core Points Box */}
                  {editingItem.extractedPoints &&
                    editingItem.extractedPoints.length > 0 && (
                      <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-1.5 text-xs text-indigo-950">
                        <span className="font-bold text-[11px] text-indigo-900 flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                          <span>AI Phẫu Thuật Ý Chính:</span>
                        </span>
                        <ul className="list-disc list-inside space-y-1 text-[11px] text-indigo-900">
                          {editingItem.extractedPoints.map((pt, i) => (
                            <li key={i}>{pt}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                </div>

                {/* 2. Right Sub-column: BÀI AI XÀO LẠI (Editable Repurposed Post) */}
                <div className="bg-white p-4 rounded-2xl border border-indigo-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-bold text-indigo-950">
                        Bản AI Xào Lại (Micro-Content)
                      </span>
                    </div>

                    {/* Compression Pill */}
                    {editingItem.compressionRate ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        Ngắn hơn {editingItem.compressionRate}% bài cũ
                      </span>
                    ) : null}
                  </div>

                  {/* Headline Input */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Tiêu đề (Headline):
                    </label>
                    <input
                      type="text"
                      value={editingItem.aiHeadline}
                      onChange={(e) =>
                        setEditingItem({ ...editingItem, aiHeadline: e.target.value })
                      }
                      className="w-full px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-600"
                    />
                  </div>

                  {/* Hook Input (< 120 chars) */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-slate-700">
                        Hook giữ chân (Trước nút Xem thêm):
                      </label>
                      <span
                        className={`text-[10px] font-mono ${
                          editingItem.aiHook.length <= 120
                            ? "text-emerald-600 font-bold"
                            : "text-amber-600 font-bold"
                        }`}
                      >
                        {editingItem.aiHook.length}/120 ký tự
                      </span>
                    </div>
                    <textarea
                      rows={2}
                      value={editingItem.aiHook}
                      onChange={(e) =>
                        setEditingItem({ ...editingItem, aiHook: e.target.value })
                      }
                      className="w-full p-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-600"
                    />
                  </div>

                  {/* Body Input (Bullet points) */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Thân bài tinh gọn (Bullet points):
                    </label>
                    <textarea
                      rows={5}
                      value={editingItem.aiBody}
                      onChange={(e) =>
                        setEditingItem({ ...editingItem, aiBody: e.target.value })
                      }
                      className="w-full p-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-600 font-sans leading-relaxed"
                    />
                  </div>

                  {/* Conclusion & CTA */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Kết luận &amp; Lời kêu gọi hành động (CTA):
                    </label>
                    <input
                      type="text"
                      value={editingItem.aiConclusion || ""}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          aiConclusion: e.target.value,
                        })
                      }
                      className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-600"
                    />
                  </div>

                  {/* Social SEO Scorecard & Policy Guard Status */}
                  <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                      <span className="text-[11px] text-slate-600">Điểm Social SEO:</span>
                      <span className="font-bold text-emerald-600">
                        {editingItem.seoScore}/100
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                      <span className="text-[11px] text-slate-600">Policy Guard:</span>
                      <span
                        className={`font-bold text-[10px] px-2 py-0.5 rounded-full ${
                          editingItem.policyStatus === "clean"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {editingItem.policyStatus === "clean" ? "An toàn 100%" : "Có cảnh báo"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Bottom Configuration & Action Panel */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Target Page Selector */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Đăng Lên Fanpage Đích:
                    </label>
                    <select
                      value={editingItem.targetPageId || ""}
                      onChange={(e) => {
                        const tgt = targetPages.find((p) => p.pageId === e.target.value);
                        setEditingItem({
                          ...editingItem,
                          targetPageId: e.target.value,
                          targetPageName: tgt ? tgt.pageName : "",
                        });
                      }}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-600 bg-white"
                    >
                      {targetPages.map((tp) => (
                        <option key={tp.id} value={tp.pageId}>
                          {tp.pageName} ({tp.pageId}) {tp.isDefault ? "• [Mặc định]" : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Golden Hours 1-Click Picker */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Hẹn Giờ Vàng Đăng Bài:
                    </label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => applyGoldenHour("07:30")}
                        className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                      >
                        Sáng 07:30
                      </button>
                      <button
                        type="button"
                        onClick={() => applyGoldenHour("11:30")}
                        className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                      >
                        Trưa 11:30
                      </button>
                      <button
                        type="button"
                        onClick={() => applyGoldenHour("19:30")}
                        className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                      >
                        Tối 19:30
                      </button>
                      <button
                        type="button"
                        onClick={() => applyGoldenHour("22:00")}
                        className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                      >
                        Đêm 22:00
                      </button>
                    </div>
                  </div>
                </div>

                {/* Final Action Buttons Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      disabled={isSavingEdit}
                      className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 inline mr-1" />
                      <span>{isSavingEdit ? "Đang lưu..." : "Lưu Bản Sửa"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleRewriteAgain}
                      disabled={isRewriting}
                      className="px-3.5 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 inline mr-1" />
                      <span>{isRewriting ? "AI đang xào..." : "Xào Lại Bản Khác"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteItem(editingItem.id)}
                      className="p-2 text-slate-400 hover:text-red-600 rounded-xl hover:bg-red-50 transition cursor-pointer"
                      title="Xóa bài viết này khỏi hàng đợi"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handlePublishNow}
                      disabled={isPublishing}
                      className="px-5 py-2.5 text-xs font-bold text-white bg-[#1877F2] hover:bg-[#166fe5] shadow-md shadow-blue-500/20 rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                      <span>{isPublishing ? "Đang đăng..." : "Duyệt &amp; Đăng Ngay Lên Fanpage"}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
