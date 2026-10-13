"use client";

import React, { useEffect, useState } from "react";
import {
  Settings,
  Save,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Facebook,
} from "lucide-react";

export default function SettingsPage() {
  const [pageId, setPageId] = useState<string>("");
  const [pageName, setPageName] = useState<string>("");
  const [pageAccessToken, setPageAccessToken] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);
  const [verifying, setVerifying] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    const loadConfig = async () => {
      const res = await fetch("/api/facebook/publish");
      if (res.ok) {
        const data = await res.json();
        if (data.config) {
          setPageId(data.config.pageId || "");
          setPageName(data.config.pageName || "");
          setPageAccessToken(data.config.pageAccessToken || "");
        }
      }
    };
    loadConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/facebook/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_config",
          pageId,
          pageName,
          pageAccessToken,
        }),
      });
      if (res.ok) {
        setFeedback({
          type: "success",
          text: "Đã lưu cấu hình Facebook Fanpage thành công!",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyToken = async () => {
    setVerifying(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/facebook/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify_token",
          pageId,
          pageAccessToken,
        }),
      });
      const data = await res.json();
      if (data.valid) {
        if (data.pageName) setPageName(data.pageName);
        setFeedback({
          type: "success",
          text: `Kết nối thành công tới Fanpage: "${data.pageName}" (ID: ${data.id})!`,
        });
      } else {
        setFeedback({
          type: "error",
          text: `Kiểm tra thất bại: ${data.error}`,
        });
      }
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Settings className="w-6 h-6 text-slate-700" />
          <span>Cấu Hình Kết Nối Facebook Fanpage (Graph API)</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Thiết lập Page ID và Page Access Token để đăng bài tự động từ Content Studio lên Fanpage của bạn.
        </p>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-2.5 text-sm ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-red-50 border-red-200 text-red-900"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      <form
        onSubmit={handleSave}
        className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4"
      >
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-[#1877F2] text-white flex items-center justify-center">
            <Facebook className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-slate-900">
              Thông Tin Xác Thực Facebook Page
            </h2>
            <p className="text-xs text-slate-500">
              Yêu cầu quyền <code>pages_manage_posts</code> và <code>pages_read_engagement</code> trên Page Access Token
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Facebook Page ID:
            </label>
            <input
              type="text"
              value={pageId}
              onChange={(e) => setPageId(e.target.value)}
              placeholder="VD: 104928374928374"
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Tên Hiển Thị Fanpage (dùng cho khung Preview):
            </label>
            <input
              type="text"
              value={pageName}
              onChange={(e) => setPageName(e.target.value)}
              placeholder="VD: Tin Tức Đông Anh 24h"
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-blue-600"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Page Access Token:
          </label>
          <textarea
            rows={4}
            value={pageAccessToken}
            onChange={(e) => setPageAccessToken(e.target.value)}
            placeholder="Dán mã Page Access Token (EAA...) lấy từ Meta for Developers / Graph API Explorer..."
            className="w-full p-3 text-xs font-mono rounded-xl border border-slate-200 focus:outline-none focus:border-blue-600"
          />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleVerifyToken}
            disabled={verifying}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 transition cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>
              {verifying ? "Đang kiểm tra..." : "Kiểm Tra Kết Nối Fanpage"}
            </span>
          </button>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#1877F2] hover:bg-[#166fe5] text-white shadow-xs transition cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? "Đang lưu..." : "Lưu Cấu Hình"}</span>
          </button>
        </div>
      </form>

      {/* Database Management & Health Card */}
      <DatabaseManagerCard />
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
              Quản lý Chủ đề, Pool Key, Lịch sử bài đăng Facebook và Cấu hình hệ thống
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
        <div>• <strong>Đặc tính:</strong> Tự động đồng bộ và bảo toàn toàn vẹn dữ liệu ngay cả khi khởi động lại máy hoặc tắt trình duyệt.</div>
      </div>
    </div>
  );
}
