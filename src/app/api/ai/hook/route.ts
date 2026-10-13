import { NextRequest, NextResponse } from "next/server";
import { generateHooksForTopic } from "@/services/promptEngine.service";
import { HookGenerationRequest } from "@/types/ai.types";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as HookGenerationRequest;
    if (!body?.topic?.title) {
      return NextResponse.json(
        { error: "Thiếu thông tin Chủ đề (Tiêu đề) để tạo Hook." },
        { status: 400 }
      );
    }

    const result = await generateHooksForTopic(body);
    return NextResponse.json(result);
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Không thể tạo Hook lúc này. Vui lòng thử lại.",
      },
      { status: 500 }
    );
  }
}
