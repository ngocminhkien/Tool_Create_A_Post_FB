/**
 * AI Content Repurposer & Reverse Semantic Anatomy Service
 * Implements requirement R3:
 * - 2-step Reverse Semantic Anatomy: Deconstructs raw source post into Hook, Core Problem, Key Takeaways, Conclusion.
 * - Restructures into concise, scannable Micro-Content (30-50% shorter than original).
 * - Integrates Gemini Key Pool (30 keys auto-failover), Policy Guard, 3-tier Hashtags, and Social SEO Scorecard.
 * - Enqueues into moderation_queue for human-in-the-loop approval.
 */

import { SourcePostItem, ModerationQueueItem } from "@/types/sourcePost.types";
import { generateTextWithKeyRotation } from "./geminiKeyPool.service";
import { scanFacebookPolicy } from "./policyGuard.service";
import { generateThreeTierHashtags, appendHashtags } from "./hashtagEngine.service";
import { evaluateSocialSeo } from "./socialSeo.service";
import {
  getSourcePostById,
  updateSourcePostStatus,
  saveModerationItem,
  getDefaultTargetPage,
  getSourcePageById,
} from "./db.service";

export interface RepurposeOptions {
  sourcePostId: string;
  targetPageId?: string;
  preferredStyle?: "storytelling" | "direct" | "educational" | "news" | "humorous";
  customInstructions?: string;
}

export interface RepurposeResult {
  success: boolean;
  moderationItem: ModerationQueueItem;
  originalWordCount: number;
  repurposedWordCount: number;
  compressionRate: number; // e.g. 40% shorter
  modelUsed: string;
}

function countWords(str: string): number {
  if (!str) return 0;
  return str.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Executes 2-step semantic deconstruction & concise rewriting on a Source Post.
 */
export async function repurposeSourcePost(
  options: RepurposeOptions
): Promise<RepurposeResult> {
  const sourcePost = getSourcePostById(options.sourcePostId);
  if (!sourcePost) {
    throw new Error(`Không tìm thấy bài viết nguồn với ID: ${options.sourcePostId}`);
  }

  const sourcePage = getSourcePageById(sourcePost.sourcePageId);
  const sourcePageName = sourcePage ? sourcePage.name : "Fanpage Nguồn";

  // Determine Target Page for publishing
  const defaultTarget = getDefaultTargetPage();
  const targetPageId = options.targetPageId || (defaultTarget ? defaultTarget.pageId : "");
  const targetPageName = defaultTarget ? defaultTarget.pageName : "";

  const style = options.preferredStyle || "storytelling";

  // System instruction for Reverse Semantic Anatomy and Micro-Content restructuring
  const systemInstruction = `Bạn là Giám Đốc Sáng Tạo Nội Dung và Chuyên Gia Tối Ưu Thuật Toán Facebook.
Nhiệm vụ của bạn là: PHẪU THUẬT BÀI VIẾT GỐC (Reverse Semantic Anatomy) và VIẾT LẠI THÀNH BÀI MỚI ĐỘC BẢN, TINH GỌN, DỄ HIỂU HƠN 30-50%.

QUY TRÌNH BẮT BUỘC:
1. BÓC TÁCH CẤU TRÚC:
   - Nhận diện ý chính, thông điệp cốt lõi và 2-3 luận điểm đắt giá nhất.
   - Loại bỏ toàn bộ từ ngữ thừa, văn phong lan man, cảm xúc dư thừa của bài cũ.

2. TÁI CẤU TRÚC THÀNH MICRO-CONTENT (Thoáng mắt, Dễ đọc, Ngắn gọn):
   - Headline: Giật tít ngắn dưới 15 chữ, có emoji thu hút.
   - Hook: Mở đầu trực diện, gây tò mò trong dưới 120 ký tự (trước nút "Xem thêm" của Facebook).
   - Thân bài: Trình bày dạng 2-3 gạch đầu dòng (bullet points) súc tích, ngắt dòng thoáng, dễ đọc lướt trong 5 giây.
   - Kết bài & CTA: 1 câu đúc kết giá trị + 1 câu hỏi mở kích thích người đọc để lại bình luận tự nhiên.

3. TUYỆT ĐỐI TUÂN THỦ:
   - KHÔNG sao chép nguyên văn để tránh bản quyền và thuật toán shadowban của Meta.
   - KHÔNG dùng từ ngữ cam kết 100%, bảo đảm vĩnh viễn, hay trị dứt điểm (tránh Policy violation).
   - Trả về đúng định dạng JSON hợp lệ (không kèm markdown ngoài block json).`;

  const prompt = `Bài viết gốc từ Fanpage "${sourcePageName}":
"""
${sourcePost.originalContent}
"""

${
  options.customInstructions
    ? `Yêu cầu bổ sung của người dùng: ${options.customInstructions}\n`
    : ""
}
Phong cách mong muốn: ${style}

Hãy phẫu thuật bài viết và trả về DUY NHẤT một đối tượng JSON có cấu trúc sau:
{
  "extractedSummary": "Tóm tắt 1 câu bài gốc nói về điều gì",
  "extractedPoints": [
    "Luận điểm cốt lõi 1 (tinh gọn)",
    "Luận điểm cốt lõi 2 (tinh gọn)",
    "Luận điểm cốt lõi 3 (tinh gọn)"
  ],
  "aiHeadline": "Tiêu đề ngắn thu hút có emoji",
  "aiHook": "Đoạn mở đầu giữ chân độc giả < 120 ký tự",
  "aiBody": "Thân bài dạng gạch đầu dòng ngắn gọn, thoáng mắt",
  "aiConclusion": "1 câu đúc kết giá trị đắt giá",
  "aiCta": "Câu hỏi mở kích thích người đọc comment thảo luận"
}`;

  const aiResponse = await generateTextWithKeyRotation({
    prompt,
    systemInstruction,
    temperature: 0.7,
  });

  // Parse JSON from Gemini output
  let parsedJson: {
    extractedSummary?: string;
    extractedPoints?: string[];
    aiHeadline?: string;
    aiHook?: string;
    aiBody?: string;
    aiConclusion?: string;
    aiCta?: string;
  } = {};

  try {
    const cleanedText = aiResponse.text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    parsedJson = JSON.parse(cleanedText);
  } catch (err) {
    console.warn("Lỗi parse JSON từ AI Repurposer, fallback sang phân tách đoạn văn:", err);
    // Fallback: Split by lines if JSON parsing failed
    const rawLines = aiResponse.text.split("\n").filter((l) => l.trim().length > 0);
    parsedJson = {
      aiHeadline: rawLines[0] || "Góc Nhìn Mới Đáng Chú Ý",
      aiHook: rawLines.slice(1, 3).join(" "),
      aiBody: rawLines.slice(3).join("\n"),
      aiConclusion: "Giá trị nằm ở hành động.",
      aiCta: "Bạn có suy nghĩ gì về vấn đề này? Để lại ý kiến bên dưới nhé!",
      extractedPoints: ["Đúc kết từ bài chia sẻ"],
    };
  }

  const headline = parsedJson.aiHeadline?.trim() || "Góc Nhìn Tinh Gọn";
  const hook = parsedJson.aiHook?.trim() || "";
  const body = parsedJson.aiBody?.trim() || "";
  const conclusion = parsedJson.aiConclusion?.trim() || "";
  const cta = parsedJson.aiCta?.trim() || "";

  // Combine full post text
  const postParts = [
    headline,
    hook,
    body,
    conclusion && cta ? `${conclusion}\n\n👉 ${cta}` : conclusion || cta,
  ].filter(Boolean);

  let rawFullPost = postParts.join("\n\n");

  // Generate 3-tier hashtags
  const hashtagsResult = generateThreeTierHashtags(
    sourcePageName,
    headline,
    rawFullPost
  );
  const fullPostWithHashtags = appendHashtags(
    rawFullPost,
    hashtagsResult.allCombined
  );

  // Policy scan
  const policyScan = scanFacebookPolicy(fullPostWithHashtags);
  const policyStatus: "clean" | "warning" | "violation" =
    policyScan.violations.length === 0
      ? "clean"
      : policyScan.violations.some((v) => v.severity === "high")
      ? "violation"
      : "warning";

  const policyWarnings = policyScan.violations.map(
    (v) => `[${v.severity.toUpperCase()}] ${v.label}: "${v.matchedText}" -> Gợi ý: ${v.suggestions.join(", ")}`
  );

  // Social SEO evaluation
  const seoEvaluation = evaluateSocialSeo(fullPostWithHashtags, sourcePageName, headline);

  // Calculate word counts & compression rate
  const originalWordCount = countWords(sourcePost.originalContent);
  const repurposedWordCount = countWords(fullPostWithHashtags);
  const compressionRate =
    originalWordCount > 0
      ? Math.max(0, Math.round(((originalWordCount - repurposedWordCount) / originalWordCount) * 100))
      : 0;

  // Enqueue into Moderation Queue
  const moderationItem = saveModerationItem({
    id: `mod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    sourcePostId: sourcePost.id,
    sourcePageId: sourcePost.sourcePageId,
    sourcePageName,
    sourceUrl: sourcePost.postUrl,
    sourcePublishedTime: sourcePost.publishedTime,
    sourceContent: sourcePost.originalContent,
    sourceImages: sourcePost.mediaUrls || [],
    targetPageId,
    targetPageName,
    aiHeadline: headline,
    aiHook: hook,
    aiBody: body,
    aiConclusion: conclusion ? `${conclusion}\n${cta}` : cta,
    aiFullPost: fullPostWithHashtags,
    contentStyle: style,
    selectedImages: sourcePost.mediaUrls || [],
    altText: `Hình ảnh minh họa cho bài viết: ${headline}`,
    imageCaption: headline,
    seoScore: seoEvaluation.totalScore,
    seoBreakdown: JSON.stringify(seoEvaluation.checks),
    policyStatus,
    policyWarnings,
    hashtags: hashtagsResult.allCombined,
    originalWordCount,
    repurposedWordCount,
    compressionRate,
    extractedPoints: parsedJson.extractedPoints || [],
    status: "pending",
    rewriteCount: 1,
    lastRewritePrompt: options.customInstructions || "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // Mark source post as rewritten
  updateSourcePostStatus(sourcePost.id, "rewritten", {
    rewrittenAt: new Date().toISOString(),
  });

  return {
    success: true,
    moderationItem,
    originalWordCount,
    repurposedWordCount,
    compressionRate,
    modelUsed: aiResponse.model,
  };
}
