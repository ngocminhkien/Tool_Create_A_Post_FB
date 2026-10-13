import { NextRequest, NextResponse } from "next/server";
import { generateFinalPostFromPrompts } from "@/services/promptEngine.service";
import { PostGenerationRequest } from "@/types/ai.types";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as PostGenerationRequest;
    if (!body?.topic?.title) {
      return NextResponse.json(
        { error: "Vui lòng chọn Chủ đề trước khi tạo bài viết cuối cùng." },
        { status: 400 }
      );
    }
    if (!body?.selectedHook?.trim()) {
      return NextResponse.json(
        { error: "Vui lòng chọn hoặc nhập câu Hook trước khi chạy chuỗi Prompt 1-4." },
        { status: 400 }
      );
    }

    const result = await generateFinalPostFromPrompts(body);
    return NextResponse.json(result);
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Lỗi trong quá trình chạy Prompt 1-4 tạo bài viết cuối cùng.",
      },
      { status: 500 }
    );
  }
}
