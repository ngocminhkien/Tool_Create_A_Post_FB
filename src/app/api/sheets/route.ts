import { NextRequest, NextResponse } from "next/server";
import {
  clearAllSheetData,
  deleteTopicRow,
  getSheetsData,
  importFromLaptopFile,
  syncFromGoogleSheetUrl,
  upsertTopicRow,
} from "@/services/googleSheets.service";

export async function GET() {
  try {
    const data = getSheetsData();
    return NextResponse.json(data);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Lỗi đọc dữ liệu Sheet" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, sheetUrl, row, id, fileBase64, fileName, filename } = body;

    if (action === "sync") {
      if (!sheetUrl || typeof sheetUrl !== "string") {
        return NextResponse.json(
          { error: "Vui lòng nhập đường dẫn Google Sheet." },
          { status: 400 }
        );
      }
      const synced = await syncFromGoogleSheetUrl(sheetUrl);
      return NextResponse.json(synced);
    }

    if (action === "upload_file") {
      if (!fileBase64 || typeof fileBase64 !== "string") {
        return NextResponse.json(
          { error: "Không tìm thấy nội dung file tải lên." },
          { status: 400 }
        );
      }
      const imported = importFromLaptopFile(
        fileBase64,
        fileName || filename || "data.xlsx"
      );
      return NextResponse.json(imported);
    }

    if (action === "upsert" && row) {
      const updated = upsertTopicRow(row);
      return NextResponse.json(updated);
    }

    if (action === "delete" && typeof id === "string") {
      const updated = deleteTopicRow(id);
      return NextResponse.json(updated);
    }

    if (action === "clear_all") {
      const cleared = clearAllSheetData();
      return NextResponse.json(cleared);
    }

    return NextResponse.json({ error: "Action không hợp lệ" }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Lỗi xử lý dữ liệu Sheet/File",
      },
      { status: 500 }
    );
  }
}
