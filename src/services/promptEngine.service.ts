import {
  HookGenerationRequest,
  HookGenerationResponse,
  PostGenerationRequest,
  PostGenerationResponse,
  StepOutput,
  TopicRowInput,
} from "@/types/ai.types";
import {
  generateTextWithKeyRotation,
  getKeyPoolState,
} from "./geminiKeyPool.service";
import { ContentStyleVariation } from "@/types/socialSeo.types";
import {
  getStylePrompt,
  buildMultiStylePrompt,
} from "./contentVariations.service";

/**
 * Replaces template variables like {tieude}, {thongtin_1}..{thongtin_4} if present,
 * and ensures the prompt always has full context of the topic and corresponding information.
 */
function interpolatePrompt(
  rawPrompt: string,
  topic: TopicRowInput,
  stepIndex: 1 | 2 | 3 | 4
): string {
  const infoMap: Record<number, string> = {
    1: topic.info1,
    2: topic.info2,
    3: topic.info3,
    4: topic.info4,
  };

  const entityVal = topic.entity?.trim() || topic.title;
  let text = rawPrompt || "";
  text = text
    .replace(/\{entity\}|\{thucthe\}|\{thuc_the\}/gi, entityVal)
    .replace(/\{tieude\}|\{tieu_de\}|\{title\}/gi, topic.title)
    .replace(/\{thongtin_1\}|\{info_1\}|\{info1\}/gi, topic.info1)
    .replace(/\{thongtin_2\}|\{info_2\}|\{info2\}/gi, topic.info2)
    .replace(/\{thongtin_3\}|\{info_3\}|\{info3\}/gi, topic.info3)
    .replace(/\{thongtin_4\}|\{info_4\}|\{info4\}/gi, topic.info4);

  const entityNote = topic.entity ? `\nThực thể trọng tâm (Entity): ${topic.entity}` : "";
  const stepInfo = infoMap[stepIndex];
  if (stepInfo && !rawPrompt.toLowerCase().includes(`thongtin_${stepIndex}`)) {
    return `Chủ đề: ${topic.title}${entityNote}\nThông tin đầu vào (${stepIndex}): ${stepInfo}\nYêu cầu thực hiện (Prompt ${stepIndex}): ${text}`;
  }

  return `Chủ đề: ${topic.title}${entityNote}\n${text}`;
}

function cleanJsonBlock(raw: string): string {
  return raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

/**
 * Step 1: Generate engaging Facebook Hooks from the selected Topic (e.g., Commune) and Info 1-4.
 */
export async function generateHooksForTopic(
  req: HookGenerationRequest
): Promise<HookGenerationResponse> {
  const { topic, customInstruction, count = 3 } = req;

  const systemInstruction = `Bạn là chuyên gia sáng tạo nội dung Fanpage Facebook có tỷ lệ tương tác cao (Viral Content Creator).
Nhiệm vụ của bạn là viết các câu mở đầu (HOOK) cực kỳ thu hút, dừng ngón tay người lướt Facebook ngay lập tức cho chủ đề được cung cấp.
Trả về kết quả dưới dạng JSON mảng các chuỗi (string array) hợp lệ, KHÔNG bọc trong markdown giải thích dài dòng.`;

  const prompt = `Hãy tạo ${count} phương án HOOK (câu mở đầu bài đăng Facebook, độ dài 1-3 câu mỗi Hook, có sử dụng emoji tinh tế) cho chủ đề sau:

- CHỦ ĐỀ / ĐỊA PHƯƠNG: "${topic.title}"
${topic.entity ? `- THỰC THỂ CỐT LÕI (ENTITY / THƯƠNG HIỆU / ĐỊA DANH): "${topic.entity}"` : ""}
- Thông tin 1: ${topic.info1 || "(Trống)"}
- Thông tin 2: ${topic.info2 || "(Trống)"}
- Thông tin 3: ${topic.info3 || "(Trống)"}
- Thông tin 4: ${topic.info4 || "(Trống)"}
- Định hướng từ Prompt 1: ${topic.prompt1 || "(Tự do sáng tạo thu hút người đọc)"}
${customInstruction ? `- Yêu cầu bổ sung từ người dùng: ${customInstruction}` : ""}

Yêu cầu cho ${count} phương án Hook:
1. Phương án 1 (Gợi sự tò mò / Tin nóng địa phương): Đánh trúng tâm lý quan tâm của người dân/độc giả về ${topic.title}${topic.entity ? ` gắn liền thực thể ${topic.entity}` : ""}.
2. Phương án 2 (Cảm xúc / Tự hào / Gần gũi): Khơi gợi tình cảm, sự gắn kết hoặc nét đặc trưng nổi bật nhất của ${topic.title}${topic.entity ? ` và thực thể ${topic.entity}` : ""}.
3. Phương án 3 (Câu hỏi tương tác / Bắt trend): Đặt câu hỏi trực diện hoặc nêu con số/điểm nhấn ấn tượng khiến người đọc muốn dừng lại đọc hết bài.

CHỈ TRẢ VỀ ĐÚNG ĐỊNH DẠNG JSON ARRAY NHƯ VÍ DỤ SAU:
[
  "Nội dung Hook 1...",
  "Nội dung Hook 2...",
  "Nội dung Hook 3..."
]`;

  const result = await generateTextWithKeyRotation({
    prompt,
    systemInstruction,
    temperature: 0.85,
  });

  let hooks: string[] = [];
  try {
    const parsed = JSON.parse(cleanJsonBlock(result.text));
    if (Array.isArray(parsed)) {
      hooks = parsed.map((item) => String(item).trim()).filter(Boolean);
    }
  } catch {
    hooks = result.text
      .split(/\n\s*\n|\n(?=\d+[\.\)])/)
      .map((s) => s.replace(/^\d+[\.\)]\s*/, "").trim())
      .filter((s) => s.length > 15)
      .slice(0, count);
  }

  if (hooks.length === 0) {
    hooks = [result.text.trim()];
  }

  return {
    hooks,
    usedKeyMasked: result.usedKeyMasked,
    failoverAttempts: result.failoverAttempts,
    model: result.model,
  };
}

/**
 * Step 2: Generate the Final Facebook Post based on the selected Hook, Info 1-4, and Prompt 1-4
 * supporting all 3 selectable execution modes:
 * - "modular": Run each (Info i + Prompt i) pair and assemble with Hook.
 * - "chaining": Sequential pipeline where Prompt 1 output feeds into Prompt 2 -> Prompt 3 -> Prompt 4.
 * - "synthesis": Single-pass synthesis combining Hook + Info 1-4 + Prompt 1-4 into the final post.
 */
export async function generateFinalPostFromPrompts(
  req: PostGenerationRequest
): Promise<PostGenerationResponse> {
  const {
    topic,
    selectedHook,
    mode,
    activePrompts = [true, true, true, true],
    toneInstruction,
    contentStyle,
  } = req;

  const rawPairs: Array<{
    stepNumber: 1 | 2 | 3 | 4;
    info: string;
    prompt: string;
    enabled: boolean;
  }> = [
    { stepNumber: 1, info: topic.info1, prompt: topic.prompt1, enabled: activePrompts[0] ?? true },
    { stepNumber: 2, info: topic.info2, prompt: topic.prompt2, enabled: activePrompts[1] ?? true },
    { stepNumber: 3, info: topic.info3, prompt: topic.prompt3, enabled: activePrompts[2] ?? true },
    { stepNumber: 4, info: topic.info4, prompt: topic.prompt4, enabled: activePrompts[3] ?? true },
  ];

  const enabledSteps = rawPairs.filter(
    (p) => p.enabled && (p.prompt.trim().length > 0 || p.info.trim().length > 0)
  );

  const stepsOutput: StepOutput[] = [];
  const keysUsed: string[] = [];
  let totalFailovers = 0;

  const styleInstruction = contentStyle ? getStylePrompt(contentStyle) : "";
  const fullTone = [toneInstruction, styleInstruction].filter(Boolean).join("\n\n");

  const baseSystemPrompt = `Bạn là biên tập viên nội dung Facebook Page chuyên nghiệp.
Hãy viết tiếng Việt tự nhiên, cuốn hút, phân tách đoạn rõ ràng, dễ đọc trên điện thoại, tuyệt đối không viết lời dẫn thừa của AI.
${topic.entity ? `Thực thể trọng tâm (Entity): "${topic.entity}" — Hãy nhắc đến và kết nối thực thể này một cách tự nhiên trong bài viết để tối ưu hóa nhận diện thực thể và ngữ nghĩa.` : ""}
${fullTone ? `Lưu ý phong cách:\n${fullTone}` : ""}`;

  // Check how many verified working keys are available in the pool
  const poolState = getKeyPoolState();
  const verifiedWorkingKeysCount = poolState.keys.filter(
    (k) => k.status === "active" && k.successCount > 0
  ).length;

  // ============================================================================
  // MODE 1: MODULAR (Ghép từng phần: Chạy từng cặp Thông tin i + Prompt i rồi ghép với Hook)
  // ============================================================================
  if (mode === "modular") {
    // If >= 4 verified working keys exist, distribute 4 separate HTTP calls across 4 keys.
    // Otherwise, execute all modular pairs in a single structured JSON batch to prevent 429 RPM exhaustion on a single free key!
    if (verifiedWorkingKeysCount >= 4) {
      for (const item of enabledSteps) {
        const stepPrompt = `${interpolatePrompt(item.prompt, topic, item.stepNumber)}

Bối cảnh bài viết:
- Chủ đề: "${topic.title}"
- Câu Hook mở đầu đã chọn: "${selectedHook}"
- Hãy viết phần nội dung tương ứng với Thông tin ${item.stepNumber} và Prompt ${item.stepNumber} (khoảng 1-2 đoạn ngắn gọn, súc tích, nối tiếp tự nhiên với mạch bài viết, không lặp lại câu Hook).`;

        const res = await generateTextWithKeyRotation({
          prompt: stepPrompt,
          systemInstruction: baseSystemPrompt,
          temperature: 0.75,
        });

        keysUsed.push(res.usedKeyMasked);
        totalFailovers += res.failoverAttempts;

        stepsOutput.push({
          stepNumber: item.stepNumber,
          label: `Phần ${item.stepNumber} (Prompt ${item.stepNumber} + Thông tin ${item.stepNumber})`,
          promptUsed: item.prompt,
          infoUsed: item.info,
          output: res.text.trim(),
          usedKeyMasked: res.usedKeyMasked,
        });
      }
    } else {
      const batchModularPrompt = `Bạn đang thực hiện chế độ GHÉP TỪNG PHẦN (Modular) cho chủ đề "${topic.title}".
Câu Hook mở đầu đã chốt là: "${selectedHook.trim()}"

Hãy viết riêng từng phần tương ứng với từng cặp (Thông tin + Prompt) dưới đây (không lặp lại câu Hook ở từng phần):
${enabledSteps
  .map(
    (item) =>
      `- PHẦN ${item.stepNumber}:
  + Thông tin ${item.stepNumber}: ${item.info || "(Trống)"}
  + Yêu cầu Prompt ${item.stepNumber}: ${interpolatePrompt(item.prompt, topic, item.stepNumber)}`
  )
  .join("\n\n")}

TRẢ VỀ ĐÚNG ĐỊNH DẠNG JSON OBJECT HỢP LỆ NHƯ SAU (không bọc giải thích thừa):
{
  "sections": [
    ${enabledSteps
      .map(
        (item) =>
          `{ "stepNumber": ${item.stepNumber}, "output": "Nội dung đã viết cho Phần ${item.stepNumber}..." }`
      )
      .join(",\n    ")}
  ]
}`;

      const res = await generateTextWithKeyRotation({
        prompt: batchModularPrompt,
        systemInstruction: baseSystemPrompt,
        temperature: 0.75,
      });

      keysUsed.push(res.usedKeyMasked);
      totalFailovers += res.failoverAttempts;

      let parsedSections: Array<{ stepNumber: number; output: string }> = [];
      try {
        const parsed = JSON.parse(cleanJsonBlock(res.text));
        if (Array.isArray(parsed?.sections)) {
          parsedSections = parsed.sections;
        }
      } catch {
        // Fallback: split by paragraphs if AI didn't return strict JSON
        const paragraphs = res.text.split(/\n\s*\n/).filter(Boolean);
        parsedSections = enabledSteps.map((item, i) => ({
          stepNumber: item.stepNumber,
          output: paragraphs[i] || res.text,
        }));
      }

      for (const item of enabledSteps) {
        const found = parsedSections.find((s) => Number(s.stepNumber) === item.stepNumber);
        stepsOutput.push({
          stepNumber: item.stepNumber,
          label: `Phần ${item.stepNumber} (Prompt ${item.stepNumber} + Thông tin ${item.stepNumber})`,
          promptUsed: item.prompt,
          infoUsed: item.info,
          output: (found?.output || "").trim(),
          usedKeyMasked: res.usedKeyMasked,
        });
      }
    }

    const finalPost = [
      selectedHook.trim(),
      ...stepsOutput.map((s) => s.output).filter(Boolean),
    ].join("\n\n");

    return {
      finalPost,
      steps: stepsOutput,
      mode,
      totalKeysUsed: keysUsed,
      totalFailovers,
    };
  }

  // ============================================================================
  // MODE 2: CHAINING (Chạy nối tiếp: Kết quả bước trước truyền làm đầu vào bước sau)
  // ============================================================================
  if (mode === "chaining") {
    if (verifiedWorkingKeysCount >= 4) {
      let accumulatedDraft = selectedHook.trim();

      for (let i = 0; i < enabledSteps.length; i++) {
        const item = enabledSteps[i];
        const isLast = i === enabledSteps.length - 1;

        const chainPrompt = `Bạn đang thực hiện BƯỚC ${item.stepNumber} trong chuỗi nâng cấp & mở rộng bài viết Facebook cho chủ đề "${topic.title}".

[NỘI DUNG BÀI VIẾT TÍNH ĐẾN HIỆN TẠI (TỪ BƯỚC TRƯỚC)]:
"""
${accumulatedDraft}
"""

[THÔNG TIN BỔ SUNG Ở BƯỚC ${item.stepNumber}]:
${item.info || "(Không có)"}

[CHỈ DẪN PROMPT ${item.stepNumber}]:
${interpolatePrompt(item.prompt, topic, item.stepNumber)}

YÊU CẦU:
- Giữ nguyên câu Hook mở đầu: "${selectedHook}"
- Tích hợp thêm Thông tin ${item.stepNumber} theo đúng yêu cầu của Prompt ${item.stepNumber} để nối tiếp và hoàn thiện bài viết hiện tại.
${
  isLast
    ? "- Đây là bước cuối cùng: Hãy biên tập lại toàn bộ bài viết cho thật mượt mà, có trình bày rõ ràng, biểu tượng cảm xúc hợp lý và lời kêu gọi tương tác + hashtag ở cuối bài."
    : "- Trả về toàn bộ văn bản bài viết tính đến hết bước này."
}`;

        const res = await generateTextWithKeyRotation({
          prompt: chainPrompt,
          systemInstruction: baseSystemPrompt,
          temperature: 0.75,
        });

        accumulatedDraft = res.text.trim();
        keysUsed.push(res.usedKeyMasked);
        totalFailovers += res.failoverAttempts;

        stepsOutput.push({
          stepNumber: item.stepNumber,
          label: `Chuỗi bước ${item.stepNumber} (Nối tiếp Prompt ${item.stepNumber})`,
          promptUsed: item.prompt,
          infoUsed: item.info,
          output: accumulatedDraft,
          usedKeyMasked: res.usedKeyMasked,
        });
      }

      return {
        finalPost: accumulatedDraft,
        steps: stepsOutput,
        mode,
        totalKeysUsed: keysUsed,
        totalFailovers,
      };
    } else {
      const batchChainPrompt = `Bạn đang thực hiện chế độ CHẠY NỐI TIẾP (Sequential Chaining 1 -> 4) cho bài đăng Facebook chủ đề "${topic.title}".
Bắt đầu từ câu Hook mở đầu đã duyệt:
"${selectedHook.trim()}"

Hãy thực hiện tuần tự từng bước nối tiếp nhau (kết quả của bước trước được mở rộng và tinh chỉnh thêm bởi Thông tin + Prompt của bước tiếp theo):
${enabledSteps
  .map(
    (item) =>
      `- BƯỚC ${item.stepNumber}:
  + Bổ sung Thông tin ${item.stepNumber}: ${item.info || "(Trống)"}
  + Thực thi Prompt ${item.stepNumber}: ${interpolatePrompt(item.prompt, topic, item.stepNumber)}`
  )
  .join("\n\n")}

TRẢ VỀ ĐÚNG ĐỊNH DẠNG JSON OBJECT HỢP LỆ NHƯ SAU:
{
  "chainSteps": [
    ${enabledSteps
      .map(
        (item) =>
          `{ "stepNumber": ${item.stepNumber}, "output": "Nội dung tích lũy/mở rộng tại Bước ${item.stepNumber}..." }`
      )
      .join(",\n    ")}
  ],
  "finalPost": "Toàn bộ bài viết Facebook hoàn chỉnh cuối cùng sau khi đi qua đủ chuỗi Prompt (bắt đầu bằng câu Hook đã chọn, thân bài mượt mà và kết bài kèm hashtag)..."
}`;

      const res = await generateTextWithKeyRotation({
        prompt: batchChainPrompt,
        systemInstruction: baseSystemPrompt,
        temperature: 0.75,
      });

      keysUsed.push(res.usedKeyMasked);
      totalFailovers += res.failoverAttempts;

      let finalDraft = res.text.trim();
      try {
        const parsed = JSON.parse(cleanJsonBlock(res.text));
        if (Array.isArray(parsed?.chainSteps)) {
          for (const item of enabledSteps) {
            const found = parsed.chainSteps.find(
              (s: { stepNumber?: number }) => Number(s.stepNumber) === item.stepNumber
            );
            stepsOutput.push({
              stepNumber: item.stepNumber,
              label: `Chuỗi bước ${item.stepNumber} (Nối tiếp Prompt ${item.stepNumber})`,
              promptUsed: item.prompt,
              infoUsed: item.info,
              output: String(found?.output || "").trim(),
              usedKeyMasked: res.usedKeyMasked,
            });
          }
        }
        if (parsed?.finalPost) {
          finalDraft = String(parsed.finalPost).trim();
        } else if (stepsOutput.length > 0) {
          finalDraft = stepsOutput[stepsOutput.length - 1].output;
        }
      } catch {
        stepsOutput.push({
          stepNumber: 1,
          label: "Chuỗi nối tiếp Prompt 1 -> 4",
          promptUsed: enabledSteps.map((s) => s.prompt).join(" -> "),
          infoUsed: enabledSteps.map((s) => s.info).join(" -> "),
          output: finalDraft,
          usedKeyMasked: res.usedKeyMasked,
        });
      }

      return {
        finalPost: finalDraft,
        steps: stepsOutput,
        mode,
        totalKeysUsed: keysUsed,
        totalFailovers,
      };
    }
  }

  // ============================================================================
  // MODE 3: SYNTHESIS (Tổng hợp nhanh: Gộp Hook + Thông tin 1-4 + Prompt 1-4 trong 1 lần biên tập)
  // ============================================================================
  const directivesBlock = enabledSteps
    .map(
      (item) =>
        `### Phần ${item.stepNumber}:
- Thông tin ${item.stepNumber}: ${item.info || "(Trống)"}
- Yêu cầu Prompt ${item.stepNumber}: ${interpolatePrompt(item.prompt, topic, item.stepNumber)}`
    )
    .join("\n\n");

  const synthesisPrompt = `Hãy viết một bài đăng Facebook Page hoàn chỉnh, chất lượng cao cho chủ đề "${topic.title}".

1. BẮT ĐẦU BÀI VIẾT BẰNG ĐÚNG CÂU HOOK ĐÃ DUYỆT SAU ĐÂY:
"${selectedHook.trim()}"

2. LẦN LƯỢT TRIỂN KHAI NỘI DUNG BÀI VIẾT THEO CÁC CẶP THÔNG TIN & PROMPT DƯỚI ĐÂY:
${directivesBlock}

YÊU CẦU ĐẦU RA:
- Bài viết hoàn chỉnh phải bắt đầu bằng câu Hook đã chọn, sau đó chuyển ý mượt mà qua các phần 1 -> 4 thành một bài đăng Facebook thống nhất, lôi cuốn.
- Chia đoạn thoáng mắt, dùng icon/emoji vừa phải, phù hợp thị hiếu người dùng Facebook Việt Nam.
- Chỉ trả về nội dung bài viết cuối cùng để đăng ngay lên Fanpage.`;

  const res = await generateTextWithKeyRotation({
    prompt: synthesisPrompt,
    systemInstruction: baseSystemPrompt,
    temperature: 0.75,
  });

  keysUsed.push(res.usedKeyMasked);
  totalFailovers += res.failoverAttempts;

  stepsOutput.push({
    stepNumber: 1,
    label: "Tổng hợp toàn bộ (Hook + Thông tin 1-4 + Prompt 1-4)",
    promptUsed: enabledSteps.map((s) => `P${s.stepNumber}: ${s.prompt}`).join(" | "),
    infoUsed: enabledSteps.map((s) => `TT${s.stepNumber}: ${s.info}`).join(" | "),
    output: res.text.trim(),
    usedKeyMasked: res.usedKeyMasked,
  });

  return {
    finalPost: res.text.trim(),
    steps: stepsOutput,
    mode,
    totalKeysUsed: keysUsed,
    totalFailovers,
  };
}

/**
 * Generate SEO Alt-Text and Image Caption for Facebook AI images
 */
export async function generateImageSeoMetadata(
  topicTitle: string,
  entity?: string
): Promise<{ altText: string; caption: string }> {
  const safeTitle = (topicTitle || "Nội dung Facebook").trim();
  const safeEntity = (entity || "Thương hiệu").trim();

  const altText = `Hình ảnh minh họa chuyên nghiệp cho chủ đề ${safeTitle} của ${safeEntity}, sắc nét, ánh sáng tự nhiên.`;
  const caption = `[Hình ảnh] ${safeTitle} - Khám phá góc nhìn chuyên sâu cùng ${safeEntity} ✨`;

  return { altText, caption };
}
