"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  FileSpreadsheet,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Save,
  X,
  Upload,
} from "lucide-react";
import { SheetSyncConfig, TopicRow } from "@/types/sheet.types";

export default function SheetsManagerPage() {
  const [rows, setRows] = useState<TopicRow[]>([]);
  const [config, setConfig] = useState<SheetSyncConfig | null>(null);
  const [sheetUrlInput, setSheetUrlInput] = useState<string>("");
  const [syncing, setSyncing] = useState<boolean>(false);
  const [editingRow, setEditingRow] = useState<TopicRow | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadData = async () => {
    try {
      const res = await fetch("/api/sheets");
      if (res.ok) {
        const data = await res.json();
        setRows(data.rows || []);
        setConfig(data.config || null);
        if (data.config?.sheetUrl && !data.config.sheetUrl.startsWith("laptop://")) {
          setSheetUrlInput(data.config.sheetUrl);
        }
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSyncSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sheetUrlInput.trim()) return;
    setSyncing(true);
    setMessage(null);
    try {
      const res = await fetch("/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync",
          sheetUrl: sheetUrlInput.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi đồng bộ Sheet");
      setRows(data.rows || []);
      setConfig(data.config || null);
      setMessage({
        type: "success",
        text: `Đồng bộ thành công ${
          (data.rows || []).length
        } dòng chủ đề từ Google Sheet!`,
      });
    } catch (err: unknown) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Lỗi đồng bộ",
      });
    } finally {
      setSyncing(false);
    }
  };

  const processUploadedFile = (file: File) => {
    const validExtensions = [".xlsx", ".xls", ".csv"];
    const fileExt = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    const isSpreadsheet =
      validExtensions.includes(fileExt) ||
      file.type.includes("sheet") ||
      file.type.includes("csv") ||
      file.type.includes("excel");

    if (!isSpreadsheet && fileExt !== "") {
      setMessage({
        type: "error",
        text: `Tệp "${file.name}" không đúng định dạng. Vui lòng kéo thả hoặc chọn file Excel (.xlsx, .xls) hoặc CSV (.csv).`,
      });
      return;
    }

    setSyncing(true);
    setMessage(null);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = typeof reader.result === "string" ? reader.result : "";
        const res = await fetch("/api/sheets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "upload_file",
            fileName: file.name,
            fileBase64: base64,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Lỗi tải tệp lên");
        setRows(data.rows || []);
        setConfig(data.config || null);
        setMessage({
          type: "success",
          text: `Đã nạp thành công ${(data.rows || []).length} dòng chủ đề từ file "${file.name}" trên laptop!`,
        });
      } catch (innerErr: unknown) {
        setMessage({
          type: "error",
          text:
            innerErr instanceof Error
              ? innerErr.message
              : "Lỗi xử lý file từ laptop",
        });
      } finally {
        setSyncing(false);
      }
    };
    reader.onerror = () => {
      setMessage({
        type: "error",
        text: "Lỗi trong quá trình đọc file từ thiết bị của bạn.",
      });
      setSyncing(false);
    };
    reader.readAsDataURL(file);
  };

  const handleLaptopSheetUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processUploadedFile(file);
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDraggingFile) setIsDraggingFile(true);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDraggingFile(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processUploadedFile(files[0]);
    }
  };

  const handleClearAll = async () => {
    setSyncing(true);
    setMessage(null);
    try {
      const res = await fetch("/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear_all" }),
      });
      const data = await res.json();
      if (res.ok) {
        setRows(data.rows || []);
        setConfig(data.config || null);
        setSheetUrlInput("");
        setMessage({
          type: "success",
          text: "Đã xóa toàn bộ dữ liệu trang Sheet khỏi bộ nhớ.",
        });
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteRow = async (id: string) => {
    const res = await fetch("/api/sheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    if (res.ok) {
      const data = await res.json();
      setRows(data.rows || []);
    }
  };

  const handleSaveRow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRow || !editingRow.title.trim()) return;
    const res = await fetch("/api/sheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "upsert",
        row: editingRow,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setRows(data.rows || []);
      setEditingRow(null);
      setMessage({
        type: "success",
        text: `Đã lưu chủ đề "${editingRow.title}" thành công!`,
      });
    }
  };

  const handleStartAddNew = () => {
    setEditingRow({
      id: `row-${Date.now()}`,
      rowIndex: rows.length + 2,
      title: "",
      entity: "",
      info1: "",
      info2: "",
      info3: "",
      info4: "",
      prompt1: "",
      prompt2: "",
      prompt3: "",
      prompt4: "",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
            <span>
              Quản Lý Dữ Liệu Google Sheets (Tiêu đề • Thông tin 1–4 • Prompt 1–4)
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Chọn file Excel / CSV trực tiếp từ laptop, dán link Google Sheet thật hoặc tự thêm dòng chủ đề trên web.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {rows.length > 0 && (
            <button
              onClick={handleClearAll}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa Hết Dữ Liệu</span>
            </button>
          )}

          <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition cursor-pointer">
            <Upload className="w-4 h-4" />
            <span>Chọn File Từ Laptop (.xlsx, .csv)</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleLaptopSheetUpload}
              className="hidden"
            />
          </label>

          <button
            onClick={handleStartAddNew}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm Dòng Chủ Đề Mới</span>
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-2.5 text-sm ${
            message.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-red-50 border-red-200 text-red-900"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Sync from Laptop File or Google Sheet URL Box */}
      <form
        onSubmit={handleSyncSheet}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`p-5 rounded-2xl border transition-all duration-200 shadow-xs space-y-3 ${
          isDraggingFile
            ? "bg-blue-50/80 border-blue-500 ring-4 ring-blue-500/20"
            : "bg-white border-slate-200"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Nạp dữ liệu từ File trên Laptop hoặc Link Google Sheets
          </label>
          {config?.lastSyncedAt && (
            <span className="text-[11px] text-slate-400">
              Nguồn: <strong className="text-slate-600">{config.sheetName || "Sheet"}</strong> • Cập nhật:{" "}
              {new Date(config.lastSyncedAt).toLocaleString("vi-VN")}
            </span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <label className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition cursor-pointer shrink-0">
            <Upload className="w-4 h-4" />
            <span>Tải File Excel / CSV Từ Máy Tính</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleLaptopSheetUpload}
              className="hidden"
            />
          </label>

          <input
            type="url"
            value={sheetUrlInput}
            onChange={(e) => setSheetUrlInput(e.target.value)}
            placeholder="Hoặc dán link Google Sheet (VD: https://docs.google.com/spreadsheets/d/.../edit#gid=0)"
            className="flex-1 px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-600"
          />
          <button
            type="submit"
            disabled={syncing || !sheetUrlInput.trim()}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white transition cursor-pointer shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
            <span>Đồng Bộ Link</span>
          </button>
        </div>

        <p className="text-[11px] text-slate-500">
          <strong>Hỗ trợ cả File Excel (.xlsx, .xls), CSV (.csv) từ laptop lẫn Link Google Sheet:</strong> Hệ thống tự động nhận diện theo tên cột (<code>Tiêu đề</code>, <code>Thực thể / Entity</code>, <code>Thông tin 1–4</code>, <code>Prompt 1–4</code>) hoặc theo thứ tự Cột A–I. Bạn có thể chèn <code>&#123;entity&#125;</code> hoặc <code>&#123;tieude&#125;</code> trong các prompt.
        </p>
      </form>

      {/* Inline Form for Adding or Editing a Row */}
      {editingRow && (
        <form
          onSubmit={handleSaveRow}
          className="bg-white p-6 rounded-2xl border-2 border-blue-500 shadow-lg space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-base text-slate-900">
              Nhập dòng Chủ đề (Tiêu đề, Thực thể Entity, Thông tin 1–4, Prompt 1–4)
            </h3>
            <button
              type="button"
              onClick={() => setEditingRow(null)}
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tiêu đề / Chủ đề:
              </label>
              <input
                type="text"
                required
                value={editingRow.title}
                onChange={(e) =>
                  setEditingRow({ ...editingRow, title: e.target.value })
                }
                placeholder="VD: Xã Hải Bối, Đông Anh..."
                className="w-full px-3.5 py-2 text-sm font-semibold rounded-xl border border-slate-300 focus:outline-none focus:border-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-purple-700 mb-1 flex items-center justify-between">
                <span>Thực thể chính (Entity / SEO Brand / Địa danh):</span>
                <span className="text-[10px] font-normal text-purple-500 font-mono">Biến &#123;entity&#125;</span>
              </label>
              <input
                type="text"
                value={editingRow.entity || ""}
                onChange={(e) =>
                  setEditingRow({ ...editingRow, entity: e.target.value })
                }
                placeholder="VD: Xã Hải Bối, Cầu Nhật Tân, BRG Smart City..."
                className="w-full px-3.5 py-2 text-sm font-semibold rounded-xl border border-purple-300 focus:outline-none focus:border-purple-600 placeholder:text-purple-300 text-purple-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {([1, 2, 3, 4] as const).map((n) => (
              <div
                key={n}
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2"
              >
                <div className="text-xs font-bold text-slate-800">
                  Cặp Thông tin {n} &amp; Prompt {n}
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-0.5">
                    Thông tin {n}:
                  </label>
                  <textarea
                    rows={2}
                    value={editingRow[`info${n}`]}
                    onChange={(e) =>
                      setEditingRow({
                        ...editingRow,
                        [`info${n}`]: e.target.value,
                      })
                    }
                    className="w-full p-2 text-xs rounded-lg border border-slate-200 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-indigo-600 mb-0.5">
                    Prompt {n}:
                  </label>
                  <textarea
                    rows={2}
                    value={editingRow[`prompt${n}`]}
                    onChange={(e) =>
                      setEditingRow({
                        ...editingRow,
                        [`prompt${n}`]: e.target.value,
                      })
                    }
                    className="w-full p-2 text-xs rounded-lg border border-indigo-200 bg-white"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setEditingRow(null)}
              className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Lưu Dòng Chủ Đề</span>
            </button>
          </div>
        </form>
      )}

      {/* List of Rows */}
      {rows.length === 0 ? (
        <div
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`group relative p-10 text-center rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer ${
            isDraggingFile
              ? "border-blue-500 bg-blue-50/80 ring-4 ring-blue-500/20 scale-[1.01]"
              : "border-slate-300 hover:border-blue-400 bg-white hover:bg-blue-50/20"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleLaptopSheetUpload}
            className="hidden"
          />

          <div className="flex flex-col items-center justify-center space-y-3.5 max-w-md mx-auto">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-200 ${
                isDraggingFile
                  ? "bg-blue-600 text-white scale-110 shadow-lg shadow-blue-500/30"
                  : "bg-emerald-50 text-emerald-600 group-hover:scale-105 group-hover:bg-emerald-600 group-hover:text-white"
              }`}
            >
              {syncing ? (
                <RefreshCw className="w-7 h-7 animate-spin" />
              ) : isDraggingFile ? (
                <Upload className="w-7 h-7 animate-bounce" />
              ) : (
                <FileSpreadsheet className="w-7 h-7" />
              )}
            </div>

            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-800">
                {isDraggingFile
                  ? "Thả file Excel / CSV vào đây ngay để tải dữ liệu..."
                  : syncing
                  ? "Đang nạp và phân tích file bảng tính..."
                  : "Kéo & Thả file Excel hoặc CSV vào đây"}
              </p>
              <p className="text-xs text-slate-500">
                {isDraggingFile
                  ? "Thả chuột ra để hệ thống nạp toàn bộ danh sách chủ đề"
                  : "hoặc click chuột vào khung này để duyệt file từ máy tính của bạn"}
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <span className="px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                .xlsx
              </span>
              <span className="px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                .xls
              </span>
              <span className="px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                .csv
              </span>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Chọn File Từ Laptop</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {rows.map((r) => (
            <div
              key={r.id}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-mono text-xs font-bold">
                    Dòng #{r.rowIndex}
                  </span>
                  <h3 className="font-bold text-base text-slate-900">
                    {r.title}
                  </h3>
                  {r.entity && (
                    <span className="px-2.5 py-0.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 text-xs font-semibold">
                      Entity: {r.entity}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditingRow({ ...r })}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 hover:bg-slate-50 text-slate-700 transition cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Sửa</span>
                  </button>
                  <button
                    onClick={() => handleDeleteRow(r.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                    title="Xóa dòng này"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {([1, 2, 3, 4] as const).map((n) => (
                  <div
                    key={n}
                    className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 text-xs space-y-1.5"
                  >
                    <div className="font-bold text-slate-700">Phần #{n}</div>
                    <div className="text-slate-600 line-clamp-3">
                      <strong>TT {n}:</strong> {r[`info${n}`] || "(Trống)"}
                    </div>
                    <div className="text-indigo-700 bg-indigo-50/60 p-2 rounded border border-indigo-100 line-clamp-3">
                      <strong>Prompt {n}:</strong>{" "}
                      {r[`prompt${n}`] || "(Trống)"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
