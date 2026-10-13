import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { SheetSyncConfig, TopicRow } from "@/types/sheet.types";
import {
  getAllTopics,
  saveTopics,
  getSheetConfig,
  saveSheetConfig,
  upsertTopic as dbUpsertTopic,
  deleteTopic as dbDeleteTopic,
  clearTopics as dbClearTopics,
} from "./db.service";

const DATA_DIR = path.join(process.cwd(), "data");
const SHEET_CACHE_FILE = path.join(DATA_DIR, "sheets-cache.json");

export interface PersistedSheetData {
  config: SheetSyncConfig;
  rows: TopicRow[];
}

function ensureSheetCache(): PersistedSheetData {
  const rows = getAllTopics();
  const config = getSheetConfig();
  return { config, rows };
}

function saveSheetCache(data: PersistedSheetData) {
  saveTopics(data.rows);
  if (data.config) {
    saveSheetConfig(data.config);
  }
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(SHEET_CACHE_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch {
    // mirror sync
  }
}

export function getSheetsData(): PersistedSheetData {
  return ensureSheetCache();
}

/**
 * Simple CSV parser that properly handles quoted fields containing commas and newlines.
 */
function parseCSVRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        currentRow.push(currentField.trim());
        currentField = "";
      } else if (char === "\n" || (char === "\r" && nextChar === "\n")) {
        if (char === "\r") i++;
        currentRow.push(currentField.trim());
        if (currentRow.some((cell) => cell.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = "";
      } else {
        currentField += char;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((cell) => cell.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Maps a 2D array of string cells (from Google Sheet CSV or Laptop Excel/CSV file)
 * into TopicRow items (Tiêu đề, Thông tin 1-4, Prompt 1-4).
 */
function mapTableToTopicRows(parsedTable: string[][]): TopicRow[] {
  if (parsedTable.length === 0) {
    throw new Error("File hoặc trang Sheet trống, chưa có dữ liệu.");
  }

  const firstRowLower = parsedTable[0].map((h) => String(h || "").toLowerCase().trim());

  // Check if the first row looks like a header row
  const hasHeader = firstRowLower.some((cell) =>
    [
      "tiêu đề",
      "tieu de",
      "chủ đề",
      "chu de",
      "thông tin",
      "thong tin",
      "prompt",
      "promt",
      "title",
      "info",
    ].some((kw) => cell.includes(kw))
  );

  const findCol = (keywords: string[], fallbackIndex: number): number => {
    if (!hasHeader) return fallbackIndex;
    const idx = firstRowLower.findIndex((h) => keywords.some((kw) => h.includes(kw)));
    return idx !== -1 ? idx : fallbackIndex;
  };

  const titleIdx = findCol(["tiêu đề", "tieu de", "chủ đề", "chu de", "xã", "tên", "title"], 0);
  const entityIdx = findCol(["thực thể", "thuc the", "entity", "đối tượng", "doi tuong", "từ khóa thực thể", "tu khoa entity", "nhãn thực thể", "brand"], -1);
  const info1Idx = findCol(["thông tin 1", "thong tin 1", "info 1", "info1", "tt1", "tt 1"], 1);
  const info2Idx = findCol(["thông tin 2", "thong tin 2", "info 2", "info2", "tt2", "tt 2"], 2);
  const info3Idx = findCol(["thông tin 3", "thong tin 3", "info 3", "info3", "tt3", "tt 3"], 3);
  const info4Idx = findCol(["thông tin 4", "thong tin 4", "info 4", "info4", "tt4", "tt 4"], 4);
  const prompt1Idx = findCol(["prompt 1", "prompt1", "promt 1", "promt1", "p1"], 5);
  const prompt2Idx = findCol(["prompt 2", "prompt2", "promt 2", "promt2", "p2"], 6);
  const prompt3Idx = findCol(["prompt 3", "prompt3", "promt 3", "promt3", "p3"], 7);
  const prompt4Idx = findCol(["prompt 4", "prompt4", "promt 4", "promt4", "p4"], 8);

  const rawDataRows = hasHeader ? parsedTable.slice(1) : parsedTable;
  const startRowNumber = hasHeader ? 2 : 1;

  const dataRows: TopicRow[] = rawDataRows
    .map((cols, idx) => ({
      id: `sheet-row-${idx + startRowNumber}-${Date.now().toString().slice(-4)}`,
      rowIndex: idx + startRowNumber,
      title: String(cols[titleIdx] ?? "").trim(),
      entity: entityIdx !== -1 && cols[entityIdx] ? String(cols[entityIdx]).trim() : undefined,
      info1: String(cols[info1Idx] ?? "").trim(),
      info2: String(cols[info2Idx] ?? "").trim(),
      info3: String(cols[info3Idx] ?? "").trim(),
      info4: String(cols[info4Idx] ?? "").trim(),
      prompt1: String(cols[prompt1Idx] ?? "").trim(),
      prompt2: String(cols[prompt2Idx] ?? "").trim(),
      prompt3: String(cols[prompt3Idx] ?? "").trim(),
      prompt4: String(cols[prompt4Idx] ?? "").trim(),
    }))
    .filter((r) => r.title.length > 0);

  if (dataRows.length === 0) {
    throw new Error(
      "Không tìm thấy dòng chủ đề hợp lệ nào. Hãy kiểm tra lại cột Tiêu đề (Cột A), Thông tin 1-4 (Cột B-E) và Prompt 1-4 (Cột F-I)."
    );
  }

  return dataRows;
}

/**
 * Extracts Google Sheet ID and GID from any standard Google Sheets URL
 * and converts it into a direct CSV export link.
 */
export function buildGoogleSheetCsvUrl(inputUrl: string): string {
  const trimmed = inputUrl.trim();
  if (trimmed.includes("/export?format=csv") || trimmed.includes("output=csv")) {
    return trimmed;
  }
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) {
    throw new Error(
      "Link Google Sheet không hợp lệ. Vui lòng dán link có dạng https://docs.google.com/spreadsheets/d/..."
    );
  }
  const spreadsheetId = match[1];
  const gidMatch = trimmed.match(/[#&?]gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : "0";
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
}

/**
 * Syncs rows from a public Google Sheet link (Title, Info 1-4, Prompt 1-4).
 */
export async function syncFromGoogleSheetUrl(sheetUrl: string): Promise<PersistedSheetData> {
  const csvUrl = buildGoogleSheetCsvUrl(sheetUrl);
  const res = await fetch(csvUrl, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(
      `Không thể đọc dữ liệu từ Google Sheet (HTTP ${res.status}). Hãy đảm bảo bạn đã bật quyền chia sẻ "Bất kỳ ai có đường liên kết đều có thể xem".`
    );
  }

  const csvText = await res.text();
  const parsedTable = parseCSVRows(csvText);
  const dataRows = mapTableToTopicRows(parsedTable);

  const updated: PersistedSheetData = {
    config: {
      sheetUrl,
      lastSyncedAt: new Date().toISOString(),
      useSampleData: false,
    },
    rows: dataRows,
  };

  saveSheetCache(updated);
  return updated;
}

/**
 * Imports TopicRows from a file uploaded from the user's laptop (.xlsx, .xls, .csv).
 */
export function importFromLaptopFile(
  fileBase64: string,
  fileName: string
): PersistedSheetData {
  const cleanBase64 = fileBase64.includes(",")
    ? fileBase64.split(",")[1]
    : fileBase64;
  const buffer = Buffer.from(cleanBase64, "base64");

  let workbook: XLSX.WorkBook;
  if (fileName.toLowerCase().endsWith(".csv")) {
    const utf8Text = buffer.toString("utf-8");
    workbook = XLSX.read(utf8Text, { type: "string" });
  } else {
    workbook = XLSX.read(buffer, { type: "buffer", codepage: 65001 });
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error("Không tìm thấy trang tính (Sheet) nào trong file tải lên.");
  }

  // Read across all sheets in the workbook if multiple tabs exist, or the first non-empty sheet
  let allTopicRows: TopicRow[] = [];
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const table = XLSX.utils.sheet_to_json<string[]>(worksheet, {
      header: 1,
      defval: "",
      blankrows: false,
    });
    if (table && table.length > 0) {
      try {
        const mapped = mapTableToTopicRows(table);
        allTopicRows = [...allTopicRows, ...mapped];
      } catch {
        // Ignore empty auxiliary sheets if another sheet has valid rows
      }
    }
  }

  if (allTopicRows.length === 0) {
    throw new Error(
      `Không tìm thấy dòng chủ đề hợp lệ trong file "${fileName}". Hãy đảm bảo file có các cột: Tiêu đề, Thông tin 1-4, Prompt 1-4.`
    );
  }

  const updated: PersistedSheetData = {
    config: {
      sheetUrl: `File từ máy: ${fileName}`,
      sheetName: fileName,
      lastSyncedAt: new Date().toISOString(),
      useSampleData: false,
    },
    rows: allTopicRows,
  };

  saveSheetCache(updated);
  return updated;
}

/**
 * Allows adding or updating a TopicRow directly on the web UI.
 */
export function upsertTopicRow(row: TopicRow): PersistedSheetData {
  const targetId = row.id || `row-${Date.now()}`;
  const rowToSave: TopicRow = {
    ...row,
    id: targetId,
    rowIndex: row.rowIndex || 1,
  };
  dbUpsertTopic(rowToSave);
  const data = ensureSheetCache();
  saveSheetCache(data);
  return data;
}

export function deleteTopicRow(id: string): PersistedSheetData {
  dbDeleteTopic(id);
  const data = ensureSheetCache();
  saveSheetCache(data);
  return data;
}

export function clearAllSheetData(): PersistedSheetData {
  dbClearTopics();
  saveSheetConfig({
    sheetUrl: "",
    lastSyncedAt: undefined,
    useSampleData: false,
  });
  const data = ensureSheetCache();
  saveSheetCache(data);
  return data;
}
