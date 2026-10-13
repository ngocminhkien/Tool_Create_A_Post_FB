import { NextRequest, NextResponse } from "next/server";
import {
  buildOptimizedImagePrompt,
  generateAiImage,
} from "@/services/imageGeneration.service";
import { ImageGenerationRequest } from "@/types/ai.types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action || "generate_image";

    const requestPayload: ImageGenerationRequest = {
      topicTitle: body.topicTitle || "Việt Nam",
      entity: body.entity,
      summaryText: body.summaryText,
      style: body.style || "photorealistic",
      customPrompt: body.customPrompt,
      aspectRatio: body.aspectRatio || "16:9",
      count: Math.min(Math.max(Number(body.count) || 1, 1), 6),
    };

    if (action === "generate_prompt") {
      const optimizedPrompt = await buildOptimizedImagePrompt(requestPayload);
      return NextResponse.json({
        success: true,
        optimizedPrompt,
      });
    }

    const result = await generateAiImage(requestPayload);
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Lỗi khi sinh ảnh AI";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
