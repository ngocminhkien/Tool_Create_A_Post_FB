"use client";

import React, { useEffect, useState } from "react";
import {
  History,
  ExternalLink,
  Copy,
  Trash2,
  Check,
  CheckCircle2,
  FileEdit,
  AlertCircle,
} from "lucide-react";
import { PostHistoryItem } from "@/types/facebook.types";

export default function PostHistoryPage() {
  const [items, setItems] = useState<PostHistoryItem[]>([]);
  const [copiedId, setCopiedId] = useState<string>("");

  const loadHistory = async () => {
    const res = await fetch("/api/facebook/publish");
    if (res.ok) {
      const data = await res.json();
      setItems(data.history || []);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleDelete = async (id: string) => {
    const res = await fetch("/api/facebook/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_history", id }),
    });
    if (res.ok) {
      const data = await res.json();
      setItems(data.history || []);
    }
  };

  const handleCopy = (item: PostHistoryItem) => {
    navigator.clipboard.writeText(item.finalPost);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(""), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <History className="w-6 h-6 text-blue-600" />
          <span>Lịch Sử Bài Đã Đăng &amp; Bản Nháp</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Lưu trữ toàn bộ các bài viết đã sinh ra từ chuỗi Prompt 1–4 và trạng thái đăng lên Facebook Page.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-sm text-slate-500">
          Chưa có bài viết nào trong lịch sử. Hãy tạo bài viết tại mục Content Studio!
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  {item.status === "published" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Đã đăng lên Page</span>
                    </span>
                  )}
                  {item.status === "draft" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                      <FileEdit className="w-3.5 h-3.5" />
                      <span>Bản nháp</span>
                    </span>
                  )}
                  {item.status === "failed" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Lỗi đăng bài</span>
                    </span>
                  )}
                  <h3 className="font-bold text-slate-900 text-base">
                    {item.topicTitle}
                  </h3>
                  <span className="text-xs text-slate-400">
                    • {new Date(item.createdAt).toLocaleString("vi-VN")}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {item.fbPostUrl && (
                    <a
                      href={item.fbPostUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 transition"
                    >
                      <span>Mở bài trên Facebook</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  <button
                    onClick={() => handleCopy(item)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 hover:bg-slate-50 text-slate-700"
                  >
                    {copiedId === item.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Đã Copy</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy nội dung</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {item.errorMessage && (
                <div className="text-xs text-red-700 bg-red-50 p-2.5 rounded-lg border border-red-200">
                  Chi tiết lỗi: {item.errorMessage}
                </div>
              )}

              <div className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200/70">
                {item.finalPost}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
