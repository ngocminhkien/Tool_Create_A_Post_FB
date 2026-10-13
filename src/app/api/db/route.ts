import { NextResponse } from "next/server";
import { getDbStats, getDb } from "@/services/db.service";

export async function GET() {
  try {
    const stats = getDbStats();
    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Lỗi đọc dữ liệu Database";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action = body.action;

    if (action === "vacuum") {
      const db = getDb();
      db.exec("VACUUM;");
      return NextResponse.json({
        success: true,
        message: "Đã tối ưu hóa và giải phóng dung lượng SQLite thành công (VACUUM).",
        stats: getDbStats(),
      });
    }

    if (action === "integrity_check") {
      const db = getDb();
      const result = db.prepare("PRAGMA integrity_check;").get() as Record<string, unknown>;
      return NextResponse.json({
        success: true,
        integrityCheck: result?.integrity_check || "ok",
        stats: getDbStats(),
      });
    }

    return NextResponse.json({ error: "Hành động không hợp lệ" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Lỗi xử lý Database";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
