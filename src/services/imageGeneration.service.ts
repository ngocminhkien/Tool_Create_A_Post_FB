import {
  GeneratedImageItem,
  ImageGenerationRequest,
  ImageGenerationResponse,
  ImageStylePreset,
} from "@/types/ai.types";
import { generateTextWithKeyRotation } from "./geminiKeyPool.service";

const STYLE_DESCRIPTIONS: Record<ImageStylePreset, string> = {
  photorealistic:
    "Authentic Vietnamese documentary photography, sharp drone aerial shot, vibrant natural daylight, high detail, 8k resolution, crisp textures, realistic atmosphere",
  urban_planning:
    "Modern architectural concept, smart city urban planning rendering, sleek glass towers, green parks, wide boulevards, dusk lighting, photorealistic futuristic masterplan",
  cinematic_landscape:
    "Cinematic panoramic landscape, Red River waterway, dramatic sunset with golden and purple hues, mist, reflective water, emotional lighting, anamorphic 35mm film look",
  facebook_editorial:
    "Professional editorial magazine style photo, clean aesthetic, vivid colors, engaging focal point, high contrast, perfect for viral social media engagement",
};

export const ANGLE_VARIATIONS = [
  {
    label: "Toàn cảnh Flycam",
    description: "Panoramic aerial drone perspective capturing the broad overview of the location, expansive horizon, vibrant morning light",
  },
  {
    label: "Công trình & Thực thể trọng tâm",
    description: "Medium eye-level shot focusing sharply on the primary landmark and local architectural center, vibrant community presence",
  },
  {
    label: "Phong cảnh sông nước & Hoàng hôn",
    description: "Cinematic atmospheric composition by the riverside or nature during golden hour sunset, reflective water, emotional mood",
  },
  {
    label: "Đại lộ & Nhịp sống hiện đại",
    description: "Bustling streetscape, modern avenue with green parks and local civic vibrancy, bright crisp lighting, active life",
  },
];

/**
 * Uses Gemini (rotating key pool) to transform a Vietnamese topic/entity/post
 * into an optimized, photography-grade visual prompt in English for Flux / image generators.
 */
export async function buildOptimizedImagePrompt(
  req: ImageGenerationRequest,
  angleIndex = 0
): Promise<string> {
  if (req.customPrompt && req.customPrompt.trim().length > 10 && angleIndex === 0) {
    return req.customPrompt.trim();
  }

  const {
    topicTitle,
    entity,
    summaryText = "",
    style = "photorealistic",
  } = req;

  const styleGuide = STYLE_DESCRIPTIONS[style] || STYLE_DESCRIPTIONS.photorealistic;
  const angle = ANGLE_VARIATIONS[angleIndex % ANGLE_VARIATIONS.length];

  const systemInstruction = `You are a world-class AI Image Prompt Engineer for Midjourney and Flux.
Your job is to transform a Vietnamese topic and local context into a descriptive, evocative English prompt.
Do NOT include any text, letters, signage, or watermarks in the image. Focus purely on realistic visuals, lighting, camera angle, and environment.
Return ONLY the final English prompt text, no explanations, no quotation marks.`;

  const userPrompt = `Create an image generation prompt for:
- Main Topic / Vietnamese Location: "${topicTitle}"
- Core Entity / Landmark / Focus: "${entity || topicTitle}"
- Context / Highlights: "${summaryText.slice(0, 300)}"
- Visual Style Preset: ${styleGuide}
- Specific Camera Angle / Perspective: ${angle.description}

Instructions:
1. Describe the key visual scene matching this perspective (${angle.label}).
2. Specify cinematic photography attributes: camera angle, lighting, atmosphere, 8k ultra-sharp detail.
3. Keep it under 60 words, strictly in English.
4. Return ONLY the prompt text.`;

  try {
    const result = await generateTextWithKeyRotation({
      prompt: userPrompt,
      systemInstruction,
      temperature: 0.7,
    });
    return result.text.replace(/^["']|["']$/g, "").trim();
  } catch {
    // Robust fallback if Gemini is temporarily unreachable
    const entityPart = entity ? `${entity}, ` : "";
    return `Stunning ${angle.label.toLowerCase()} of ${entityPart}${topicTitle} in Vietnam, aerial drone perspective, golden hour lighting, ultra realistic, highly detailed, 8k resolution, cinematic atmosphere, no text`;
  }
}

/**
 * Generates AI images using Flux.1 engine via Pollinations.
 * Supports batch generation of 1 to 4 images with distinct angles and seeds.
 */
export async function generateAiImage(
  req: ImageGenerationRequest
): Promise<ImageGenerationResponse> {
  const count = Math.min(Math.max(req.count || 1, 1), 6);
  const style = req.style || "photorealistic";
  const aspectRatio = req.aspectRatio || "16:9";

  // Determine dimensions based on aspect ratio
  let width = 1024;
  let height = 768; // Default horizontal 4:3 (ideal for Facebook feed)

  if (aspectRatio === "1:1") {
    width = 1024;
    height = 1024;
  } else if (aspectRatio === "16:9") {
    width = 1280;
    height = 720;
  } else if (aspectRatio === "4:5") {
    width = 896;
    height = 1120;
  }

  const tokensUsedEstimated = count * 450;
  const generatedItems: GeneratedImageItem[] = [];

  for (let i = 0; i < count; i++) {
    const angle = ANGLE_VARIATIONS[i % ANGLE_VARIATIONS.length];
    const optimizedPrompt = await buildOptimizedImagePrompt(req, i);
    const seed = Math.floor(Math.random() * 10000000) + i * 17;
    const encodedPrompt = encodeURIComponent(optimizedPrompt);
    const targetUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&model=flux&seed=${seed}&nologo=true`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000);

    try {
      const response = await fetch(targetUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Tool/1.0",
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Lỗi từ AI Image Generator (HTTP ${response.status})`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const contentType = response.headers.get("content-type") || "image/jpeg";
      const imageBase64 = `data:${contentType};base64,${buffer.toString("base64")}`;

      generatedItems.push({
        id: `img-${Date.now()}-${i}`,
        imageUrl: targetUrl,
        imageBase64,
        optimizedPrompt,
        style,
        aspectRatio,
        label: `Ảnh ${i + 1}: ${angle.label}`,
        angleDescription: angle.description,
      });
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      // If some images succeeded, keep what we have
      if (generatedItems.length === 0 && i === count - 1) {
        if (err instanceof Error && err.name === "AbortError") {
          throw new Error("Quá thời gian chờ khi tạo ảnh AI. Vui lòng bấm thử lại.");
        }
        throw err;
      }
    }
  }

  if (generatedItems.length === 0) {
    throw new Error("Không thể tạo ảnh nào từ AI. Vui lòng kiểm tra kết nối mạng và thử lại.");
  }

  return {
    imageUrl: generatedItems[0].imageUrl,
    imageBase64: generatedItems[0].imageBase64,
    optimizedPrompt: generatedItems[0].optimizedPrompt,
    style,
    provider: "Flux.1 AI Engine",
    images: generatedItems,
    tokensUsedEstimated,
  };
}
