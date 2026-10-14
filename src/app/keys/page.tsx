"use client";

import React, { useEffect, useState } from "react";
import {
  KeyRound,
  RefreshCw,
  Zap,
  RotateCcw,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  XCircle,
  HelpCircle,
} from "lucide-react";
import { GeminiKeyItem, KeyPoolStats } from "@/types/ai.types";

interface BannerState {
  type: "success" | "error" | "info";
  message: string;
}

export default function GeminiKeysPoolPage() {
  const [keys, setKeys] = useState<Omit<GeminiKeyItem, "key">[]>([]);
  const [stats, setStats] = useState<KeyPoolStats | null>(null);
  const [preferredModel, setPreferredModel] = useState<string>("gemini-2.5-flash");
  const [bulkInput, setBulkInput] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [banner, setBanner] = useState<BannerState | null>(null);

  const loadPool = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/keys");
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys || []);
        setStats(data.stats || null);
        if (data.preferredModel) setPreferredModel(data.preferredModel);
      } else {
        const err = await res.json().catch(() => ({}));
        setBanner({
          type: "error",
          message: err.error || "Không thể tải danh sách Key từ máy chủ.",
        });
      }
    } catch {
      setBanner({
        type: "error",
        message: "Lỗi kết nối khi tải danh sách Key.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPool();
  }, []);

  const handleTestRotation = async () => {
    setLoading(true);
    setBanner(null);
    try {
      const res = await fetch("/api/ai/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test_rotation" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi thử nghiệm Key");
      setKeys(data.state?.keys || []);
      setStats(data.state?.stats || null);
      setBanner({
        type: "success",
        message: `Thử nghiệm thành công! Key đã dùng: ${data.testResult.usedKeyMasked} (Model: ${data.testResult.model}) -> Phản hồi: "${data.testResult.text}"`,
      });
    } catch (err: unknown) {
      setBanner({
        type: "error",
        message: err instanceof Error ? err.message : "Không thể gọi thử nghiệm",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetCooldowns = async () => {
    setLoading(true);
    setBanner(null);
    try {
      const res = await fetch("/api/ai/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_cooldowns" }),
      });
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys || []);
        setStats(data.stats || null);
        setBanner({
          type: "success",
          message: "Đã phục hồi tất cả Key đang nghỉ (Cooldown) về trạng thái sẵn sàng!",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveInvalidKeys = async () => {
    const invalidCount = stats?.invalid || 0;
    if (invalidCount === 0) {
      setBanner({ type: "info", message: "Hiện không có Key nào bị lỗi để xóa." });
      return;
    }

    if (
      !confirm(
        `Bạn có chắc chắn muốn xóa toàn bộ ${invalidCount} Key đang bị lỗi/khóa khỏi hệ thống?`
      )
    ) {
      return;
    }

    setLoading(true);
    setBanner(null);
    try {
      const res = await fetch("/api/ai/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove_invalid" }),
      });
      const data = await res.json();
      if (res.ok) {
        setKeys(data.state?.keys || []);
        setStats(data.state?.stats || null);
        setBanner({
          type: "success",
          message: `Đã dọn dẹp và xóa vĩnh viễn ${data.removedCount} Key lỗi khỏi hệ thống!`,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClearAllKeys = async () => {
    if (
      !confirm(
        "CẢNH BÁO NGUY HIỂM: Bạn có chắc chắn muốn XÓA TOÀN BỘ KEY trong Pool để nạp danh sách Key mới từ đầu?"
      )
    ) {
      return;
    }

    setLoading(true);
    setBanner(null);
    try {
      const res = await fetch("/api/ai/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear_all" }),
      });
      const data = await res.json();
      if (res.ok) {
        setKeys(data.state?.keys || []);
        setStats(data.state?.stats || null);
        setBanner({
          type: "success",
          message: `Đã xóa sạch ${data.clearedCount} Key. Bây giờ bạn có thể dán Key mới vào khung bên dưới để nạp!`,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleModelChange = async (model: string) => {
    setPreferredModel(model);
    const res = await fetch("/api/ai/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_model", model }),
    });
    if (res.ok) {
      const data = await res.json();
      setKeys(data.keys || []);
      setStats(data.stats || null);
    }
  };

  const handleBulkAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkInput.trim()) return;
    setLoading(true);
    setBanner(null);

    try {
      const res = await fetch("/api/ai/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_bulk", rawKeys: bulkInput }),
      });
      const data = await res.json();

      if (!res.ok) {
        setBanner({
          type: "error",
          message: data.error || "Không thể thêm Key. Vui lòng kiểm tra lại định dạng.",
        });
        return;
      }

      setKeys(data.state?.keys || []);
      setStats(data.state?.stats || null);
      setBulkInput("");

      const details: string[] = [];
      if (data.addedCount > 0) details.push(`thêm mới ${data.addedCount} Key`);
      if (data.reactivatedCount > 0)
        details.push(`kích hoạt lại ${data.reactivatedCount} Key`);

      const msg =
        details.length > 0
          ? `Đã ${details.join(" và ")} vào Pool thành công!`
          : `Tất cả ${data.totalFound || 0} Key vừa nhập đã có trong Pool và đang sẵn sàng.`;

      setBanner({ type: "success", message: msg });
    } catch (err: unknown) {
      setBanner({
        type: "error",
        message: err instanceof Error ? err.message : "Lỗi kết nối khi nạp Key",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveKey = async (keyId: string) => {
    const res = await fetch("/api/ai/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove", keyId }),
    });
    if (res.ok) {
      const data = await res.json();
      setKeys(data.keys || []);
      setStats(data.stats || null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <KeyRound className="w-6 h-6 text-indigo-600" />
            <span>Quản Lý Luân Phiên Key Google Gemini Free</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Cơ chế Round-Robin tự động xoay vòng qua từng Key sau mỗi bước gọi AI, tự động chuyển Key (Auto-Failover) nếu chạm giới hạn 429 và đồng bộ tức thời với Cloud Database.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={preferredModel}
            onChange={(e) => handleModelChange(e.target.value)}
            aria-label="Chọn Model Gemini"
            className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 bg-white text-slate-800 focus:outline-hidden"
          >
            <option value="gemini-2.5-flash">Tự động xoay vòng Đa Model (3.8 / 3.5 / 3.1 / 2.5 Flash)</option>
            <option value="gemini-3.8-flash">Ưu tiên: gemini-3.8-flash</option>
            <option value="gemini-3.5-flash-lite">Ưu tiên: gemini-3.5-flash-lite</option>
            <option value="gemini-3.1-flash-lite">Ưu tiên: gemini-3.1-flash-lite</option>
            <option value="gemini-2.5-flash-lite">Ưu tiên: gemini-2.5-flash-lite</option>
          </select>

          <button
            onClick={handleResetCooldowns}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Cooldown</span>
          </button>

          {stats && stats.invalid > 0 && (
            <button
              onClick={handleRemoveInvalidKeys}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-600" />
              <span>Xóa {stats.invalid} Key lỗi</span>
            </button>
          )}

          <button
            onClick={handleClearAllKeys}
            disabled={loading || keys.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 bg-white hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-slate-600 transition cursor-pointer"
            title="Xóa toàn bộ key để nạp danh sách mới"
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Xóa Hết Key</span>
          </button>

          <button
            onClick={handleTestRotation}
            disabled={loading || keys.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white shadow-xs transition cursor-pointer"
          >
            <Zap className="w-4 h-4" />
            <span>Test Xoay Vòng Key</span>
          </button>
        </div>
      </div>

      {/* Banner Notifications */}
      {banner && (
        <div
          className={`p-4 rounded-xl border text-xs font-medium flex items-center justify-between transition ${
            banner.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-950"
              : banner.type === "error"
              ? "bg-red-50 border-red-200 text-red-950"
              : "bg-blue-50 border-blue-200 text-blue-950"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {banner.type === "success" && (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            {banner.type === "error" && (
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            {banner.type === "info" && (
              <HelpCircle className="w-4 h-4 text-blue-600 shrink-0" />
            )}
            <span>{banner.message}</span>
          </div>
          <button
            onClick={() => setBanner(null)}
            className="text-slate-500 hover:text-slate-800 underline ml-4 cursor-pointer text-[11px]"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Stats Summary Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
          <div className="bg-white p-4 rounded-2xl border border-slate-200">
            <div className="text-xs text-slate-500">Tổng số Key</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {stats.total}
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-emerald-200">
            <div className="text-xs text-emerald-700">Đang sẵn sàng</div>
            <div className="text-2xl font-bold text-emerald-600 mt-1">
              {stats.active}
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-amber-200">
            <div className="text-xs text-amber-700">Đang nghỉ (Cooldown)</div>
            <div className="text-2xl font-bold text-amber-600 mt-1">
              {stats.cooldown}
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-red-200">
            <div className="text-xs text-red-700">Key lỗi / Khóa</div>
            <div className="text-2xl font-bold text-red-600 mt-1">
              {stats.invalid}
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-indigo-200">
            <div className="text-xs text-indigo-700">Key sẽ gọi kế tiếp</div>
            <div className="text-2xl font-bold font-mono text-indigo-600 mt-1">
              {stats.total > 0 ? `#${stats.currentIndex + 1}` : "0"}
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200">
            <div className="text-xs text-slate-500">Lượt thành công / Đổi key</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {stats.totalSuccessRequests}{" "}
              <span className="text-sm font-normal text-slate-400">
                / {stats.totalFailovers}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Add Keys Form */}
      <form
        onSubmit={handleBulkAdd}
        className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Nạp Thêm Danh Sách Gemini API Key (Tự động lọc trùng & bóc tách)</span>
          </div>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Hỗ trợ dán 1 key, nhiều key hoặc chuỗi cấu hình biến môi trường
          </span>
        </div>

        <div className="space-y-2">
          <textarea
            value={bulkInput}
            onChange={(e) => setBulkInput(e.target.value)}
            rows={2}
            placeholder="Dán 1 hoặc nhiều API Key tại đây (Ví dụ: AIzaSyBK4iM... hoặc dán danh sách ngăn cách bởi dấu phẩy, dấu cách, xuống dòng)"
            className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border border-slate-200 focus:border-indigo-500 focus:outline-hidden resize-y"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] text-slate-500">
              💡 <strong>Lưu ý:</strong> Key Google Gemini hợp lệ luôn bắt đầu bằng <code className="text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded font-mono">AIza</code> và dài 39 ký tự. Bạn có thể lấy key miễn phí tại Google AI Studio.
            </p>
            <button
              type="submit"
              disabled={loading || !bulkInput.trim()}
              className="inline-flex items-center justify-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white cursor-pointer transition shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>{loading ? "Đang xử lý..." : "Nạp Vào Pool"}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Keys Status Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Mã Gemini Key (Đã che bảo mật)</th>
                <th className="py-3 px-4">Trạng Thái</th>
                <th className="py-3 px-4">Lượt Thành Công</th>
                <th className="py-3 px-4">Chạm Quota (429)</th>
                <th className="py-3 px-4">Lần Dùng Cuối</th>
                <th className="py-3 px-4">Ghi Chú / Lỗi Gần Nhất</th>
                <th className="py-3 px-4 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {keys.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <KeyRound className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-sm font-medium text-slate-600">
                      Chưa có Key nào trong Pool
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Vui lòng dán 1 hoặc nhiều Gemini API Key ở khung phía trên và nhấn &quot;Nạp Vào Pool&quot;.
                    </p>
                  </td>
                </tr>
              ) : (
                keys.map((item, idx) => {
                  const isNext = stats?.currentIndex === idx;
                  return (
                    <tr
                      key={item.id}
                      className={`${
                        isNext ? "bg-indigo-50/50" : "hover:bg-slate-50/80"
                      } transition`}
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <span>#{idx + 1}</span>
                          {isNext && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-600 text-white font-sans">
                              Kế tiếp
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-800 font-semibold">
                        {item.maskedKey}
                      </td>
                      <td className="py-3 px-4">
                        {item.status === "active" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Sẵn sàng</span>
                          </span>
                        )}
                        {item.status === "cooldown" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
                            <Clock className="w-3 h-3" />
                            <span>Tạm nghỉ 60s</span>
                          </span>
                        )}
                        {item.status === "invalid" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 font-semibold">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Key lỗi</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-emerald-700">
                        {item.successCount}
                      </td>
                      <td className="py-3 px-4 font-mono text-amber-700">
                        {item.rateLimitCount}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {item.lastUsedAt
                          ? new Date(item.lastUsedAt).toLocaleTimeString("vi-VN")
                          : "Chưa gọi"}
                      </td>
                      <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                        {item.lastError || "Hoạt động tốt"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleRemoveKey(item.id)}
                          title="Xóa Key này khỏi Pool"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
