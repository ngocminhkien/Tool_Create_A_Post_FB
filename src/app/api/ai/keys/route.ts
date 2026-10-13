import { NextRequest, NextResponse } from "next/server";
import {
  addBulkKeys,
  generateTextWithKeyRotation,
  getKeyPoolState,
  removeKeyById,
  resetAllKeyCooldowns,
  setPreferredGeminiModel,
} from "@/services/geminiKeyPool.service";

export async function GET() {
  try {
    const state = getKeyPoolState();
    return NextResponse.json(state);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Lỗi tải danh sách Key" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, rawKeys, keyId, model } = body;

    if (action === "reset_cooldowns") {
      const state = resetAllKeyCooldowns();
      return NextResponse.json(state);
    }

    if (action === "add_bulk" && typeof rawKeys === "string") {
      const res = addBulkKeys(rawKeys);
      return NextResponse.json(res);
    }

    if (action === "remove" && typeof keyId === "string") {
      const state = removeKeyById(keyId);
      return NextResponse.json(state);
    }

    if (action === "set_model" && typeof model === "string") {
      const state = setPreferredGeminiModel(model);
      return NextResponse.json(state);
    }

    if (action === "test_rotation") {
      const testRes = await generateTextWithKeyRotation({
        prompt: "Trả lời ngắn gọn đúng 1 câu tiếng Việt: Hệ thống luân phiên Key Gemini hoạt động tốt!",
        temperature: 0.3,
      });
      return NextResponse.json({
        testResult: testRes,
        state: getKeyPoolState(),
      });
    }

    return NextResponse.json({ error: "Action không hợp lệ" }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Lỗi thao tác Key Pool" },
      { status: 500 }
    );
  }
}
