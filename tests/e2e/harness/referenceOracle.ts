/**
 * tests/e2e/harness/referenceOracle.ts
 * Authoritative specification oracle derived directly from ORIGINAL_REQUEST.md & PROJECT.md
 * Provides ground-truth expected output derivation and standalone fallback verification.
 */

import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import {
  AttachedMediaItem,
  CollectPostsOptions,
  CollectPostsResult,
  ContentStyleVariation,
  EvergreenCandidate,
  GoldenHourSlot,
  GoldenHourSlotId,
  ImageSeoMetadata,
  ModerationQueueItem,
  PageStatus,
  PolicyScanResult,
  PolicyViolationItem,
  PublishMediaPostPayload,
  QueueItemStatus,
  RepurposeRewriteRequest,
  RepurposeRewriteResponse,
  SeoCheckItem,
  SocialSeoEvaluation,
  SourcePageInputMode,
  SourcePageItem,
  SourcePostItem,
  SourcePostStatus,
  StylePresetItem,
  TargetPageItem,
  ThreeTierHashtags,
} from "../types";

// --- F1 & F2: Policy Guard & Anti-Shadowban Oracle ---

interface PolicyRule {
  id: string;
  category: PolicyViolationItem["category"];
  severity: PolicyViolationItem["severity"];
  label: string;
  pattern: RegExp;
  explanation: string;
  suggestions: string[];
}

const POLICY_RULES: PolicyRule[] = [
  {
    id: "abs_100_percent",
    category: "absolute_claim",
    severity: "high",
    label: "Cam kết tuyệt đối 100%",
    pattern: /(?:cam kết|cam đoan|bảo đảm|chắc chắn|hoàn tiền)\s+100%/gi,
    explanation: "Meta hạn chế bài viết cam kết kết quả 100% hoặc hoàn tiền vô điều kiện do vi phạm chính sách thương mại.",
    suggestions: ["cam kết chất lượng hàng đầu", "đồng hành tận tâm", "hỗ trợ đổi trả linh hoạt"],
  },
  {
    id: "med_curative",
    category: "medical_curative",
    severity: "high",
    label: "Tuyên bố y tế trị dứt điểm",
    pattern: /(?:trị dứt điểm|chữa khỏi hoàn toàn|thuốc đặc trị|chữa dứt điểm|trị tận gốc)/gi,
    explanation: "Thuật ngữ y tế khẳng định chữa khỏi dứt điểm bị Meta quét vi phạm chính sách dược phẩm & sức khỏe.",
    suggestions: ["hỗ trợ cải thiện", "giải pháp chăm sóc chuyên sâu", "đồng hành phục hồi"],
  },
  {
    id: "fin_hype",
    category: "financial_hype",
    severity: "high",
    label: "Hứa hẹn làm giàu / thu nhập quá mức",
    pattern: /(?:kiếm tiền tại nhà|nhân đôi tài sản|lãi suất khủng|đầu tư bao lời|kiếm\s+\d+\s+triệu\s+mỗi\s+ngày)/gi,
    explanation: "Nội dung hứa hẹn lợi nhuận bất thường hoặc cam kết sinh lời dễ bị gắn cờ lừa đảo tài chính.",
    suggestions: ["tối ưu nguồn thu nhập", "phát triển tài chính bền vững", "kế hoạch tích lũy hiệu quả"],
  },
  {
    id: "phone_spam",
    category: "phone_spam",
    severity: "medium",
    label: "Số điện thoại / Hotline lộ liễu",
    pattern: /(?:\+84|0)[235789](?:[\s.-]?\d){8,9}\b/g,
    explanation: "Chèn số điện thoại trực tiếp vào nội dung bài viết dễ bị thuật toán Facebook xếp vào dạng spam dẫn luồng.",
    suggestions: ["liên hệ qua nút Inbox", "nhắn tin trực tiếp Fanpage", "để lại lời nhắn bên dưới"],
  },
  {
    id: "ext_link_spam",
    category: "external_link",
    severity: "medium",
    label: "Liên kết rút gọn / Link ngoài spam",
    pattern: /(?:https?:\/\/)?(?:bit\.ly|tinyurl\.com|cutt\.ly|t\.co)\/[a-zA-Z0-9_-]+/gi,
    explanation: "Link rút gọn ngoài thường bị Facebook bóp reach hoặc nghi ngờ link độc hại, chuyển hướng spam.",
    suggestions: ["xem chi tiết tại phần bình luận", "nhấp vào nút Tìm hiểu thêm trên trang", "link cập nhật dưới comment"],
  },
  {
    id: "body_claim",
    category: "body_claim",
    severity: "medium",
    label: "So sánh cơ thể / Ảnh trước sau",
    pattern: /(?:trước và sau|ảnh trước và sau|giảm\s+\d+\s*kg\s+sau\s+\d+\s*ngày|lột xác hoàn toàn)/gi,
    explanation: "Chính sách Meta cấm các nội dung so sánh hình thể trước-sau gây ảo tưởng hoặc kỳ thị ngoại hình.",
    suggestions: ["hành trình kiên trì", "kết quả thay đổi tích cực", "tự tin với phong cách mới"],
  },
];

export function oracleScanFacebookPolicy(text: string): PolicyScanResult {
  if (!text || typeof text !== "string") {
    return { isSafe: true, riskScore: 0, riskLevel: "safe", violations: [] };
  }

  const violations: PolicyViolationItem[] = [];
  let totalScore = 0;

  for (const rule of POLICY_RULES) {
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const matchedText = match[0];
      const startIndex = match.index;
      const endIndex = startIndex + matchedText.length;

      const penalty = rule.severity === "high" ? 35 : rule.severity === "medium" ? 20 : 10;
      totalScore += penalty;

      violations.push({
        id: `${rule.id}_${startIndex}`,
        category: rule.category,
        severity: rule.severity,
        matchedText,
        startIndex,
        endIndex,
        label: rule.label,
        explanation: rule.explanation,
        suggestions: [...rule.suggestions],
      });
    }
  }

  const riskScore = Math.min(100, totalScore);
  const riskLevel = riskScore >= 50 ? "danger" : riskScore > 0 ? "warning" : "safe";
  const isSafe = violations.length === 0;

  return { isSafe, riskScore, riskLevel, violations };
}

export function oracleApplyPolicyFix(text: string, violationId: string, suggestion: string): string {
  if (!text) return "";
  const scan = oracleScanFacebookPolicy(text);
  const target = scan.violations.find((v) => v.id === violationId);
  if (!target) return text;

  return text.substring(0, target.startIndex) + suggestion + text.substring(target.endIndex);
}

export function oracleAutoSanitizeAll(text: string): string {
  if (!text) return "";
  let currentText = text;
  // Iterate repeatedly until clean or no more replacements
  for (let round = 0; round < 10; round++) {
    const scan = oracleScanFacebookPolicy(currentText);
    if (scan.violations.length === 0) break;
    // Sort descending by startIndex to preserve offset integrity
    const sorted = [...scan.violations].sort((a, b) => b.startIndex - a.startIndex);
    for (const v of sorted) {
      const replacement = v.suggestions[0] || "";
      currentText = currentText.substring(0, v.startIndex) + replacement + currentText.substring(v.endIndex);
    }
  }
  return currentText;
}

// --- F3 & F4: Social SEO Scorecard Oracle ---

const EMOJI_REGEX = /(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})/gu;

export function oracleEvaluateSocialSeo(content: string, entity?: string, title?: string): SocialSeoEvaluation {
  const safeContent = content || "";
  const words = safeContent.trim() ? safeContent.trim().split(/\s+/).filter(Boolean) : [];
  const wordCount = words.length;

  // 1. Hook check (25 pts): first 120 chars contains entity or title
  const first120 = safeContent.slice(0, 120).toLowerCase();
  const searchTerms = [entity, title]
    .filter((t): t is string => Boolean(t && t.trim()))
    .map((t) => t.trim().toLowerCase());

  let hookEntityPresent = false;
  if (searchTerms.length > 0) {
    hookEntityPresent = searchTerms.some((term) => first120.includes(term));
  } else if (words.length > 0) {
    // If no explicit entity, check if first word is substantial
    hookEntityPresent = words[0].length >= 3;
  }
  const hookPoints = hookEntityPresent ? 25 : 0;

  // 2. Keyword density (20 pts): 1.0% to 2.5%
  let keywordDensityPercent = 0;
  if (wordCount > 0 && searchTerms.length > 0) {
    let matchCount = 0;
    const lowerContent = safeContent.toLowerCase();
    for (const term of searchTerms) {
      const termWords = term.split(/\s+/).filter(Boolean);
      const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
      const matches = lowerContent.match(regex);
      if (matches) {
        matchCount += matches.length * termWords.length;
      }
    }
    keywordDensityPercent = Number(((matchCount / wordCount) * 100).toFixed(2));
  } else if (wordCount >= 200 && wordCount <= 600) {
    keywordDensityPercent = 1.5; // Natural density estimate
  }
  const densityPassed = keywordDensityPercent >= 1.0 && keywordDensityPercent <= 2.5;
  const densityPoints = densityPassed ? 20 : 0;

  // 3. Post length (20 pts): 250 - 500 words
  const lengthPassed = wordCount >= 250 && wordCount <= 500;
  const lengthPoints = lengthPassed ? 20 : 0;

  // 4. Paragraph readability (15 pts): avg words per paragraph <= 50, paragraphCount >= 3
  const paragraphs = safeContent
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  const paragraphCount = paragraphs.length;
  const avgWordsPerParagraph = paragraphCount > 0 ? Math.round(wordCount / paragraphCount) : 0;
  const readabilityPassed = paragraphCount >= 3 && avgWordsPerParagraph <= 50;
  const readabilityPoints = readabilityPassed ? 15 : 0;

  // 5. Emoji count (10 pts): 3 - 10 emojis
  const emojiMatches = safeContent.match(EMOJI_REGEX) || [];
  const emojiCount = emojiMatches.length;
  const emojiPassed = emojiCount >= 3 && emojiCount <= 10;
  const emojiPoints = emojiPassed ? 10 : 0;

  // 6. Comment CTA (10 pts): calls to action stimulating discussion
  const ctaTriggers = [
    "bình luận",
    "comment",
    "ý kiến",
    "chia sẻ cảm nghĩ",
    "bạn nghĩ sao",
    "cho mình biết",
    "để lại comment",
    "bàn luận",
    "thảo luận",
    "?",
  ];
  const lowerContent = safeContent.toLowerCase();
  const hasCommentCta = ctaTriggers.some((trigger) => lowerContent.includes(trigger));
  const ctaPoints = hasCommentCta ? 10 : 0;

  const totalScore = hookPoints + densityPoints + lengthPoints + readabilityPoints + emojiPoints + ctaPoints;

  const grade: SocialSeoEvaluation["grade"] =
    totalScore >= 80 ? "excellent" : totalScore >= 60 ? "good" : totalScore >= 40 ? "average" : "poor";

  const checks: SeoCheckItem[] = [
    {
      id: "hook_entity",
      label: "Từ khóa chính trong 120 ký tự đầu",
      passed: hookEntityPresent,
      points: hookPoints,
      maxPoints: 25,
      feedback: hookEntityPresent
        ? "Từ khóa chính xuất hiện trước nút 'Xem thêm', tối ưu dwell time."
        : "Thiếu từ khóa chính trong 120 ký tự đầu tiên.",
    },
    {
      id: "keyword_density",
      label: "Mật độ từ khóa chuẩn (1.0% - 2.5%)",
      passed: densityPassed,
      points: densityPoints,
      maxPoints: 20,
      feedback: densityPassed
        ? `Mật độ đạt ${keywordDensityPercent}%, chuẩn Social SEO.`
        : `Mật độ hiện tại là ${keywordDensityPercent}% (chuẩn khuyến nghị: 1.0% - 2.5%).`,
    },
    {
      id: "post_length",
      label: "Độ dài bài viết tối ưu (250 - 500 từ)",
      passed: lengthPassed,
      points: lengthPoints,
      maxPoints: 20,
      feedback: lengthPassed
        ? `Độ dài ${wordCount} từ, tối ưu tương tác Facebook.`
        : `Độ dài ${wordCount} từ (tối ưu: 250 - 500 từ).`,
    },
    {
      id: "readability",
      label: "Độ thông thoáng & ngắt đoạn (<= 50 từ/đoạn, >= 3 đoạn)",
      passed: readabilityPassed,
      points: readabilityPoints,
      maxPoints: 15,
      feedback: readabilityPassed
        ? `Bố cục thoáng với ${paragraphCount} đoạn, TB ${avgWordsPerParagraph} từ/đoạn.`
        : `Bài viết cần ngắt tối thiểu 3 đoạn và dưới 50 từ/đoạn.`,
    },
    {
      id: "emoji_count",
      label: "Mật độ Emoji vừa phải (3 - 10 emoji)",
      passed: emojiPassed,
      points: emojiPoints,
      maxPoints: 10,
      feedback: emojiPassed
        ? `Sử dụng ${emojiCount} emoji, tạo điểm nhấn thị giác tốt.`
        : `Hiện có ${emojiCount} emoji (khuyến nghị: 3 - 10 emoji).`,
    },
    {
      id: "comment_cta",
      label: "Kêu gọi hành động bình luận (CTA)",
      passed: hasCommentCta,
      points: ctaPoints,
      maxPoints: 10,
      feedback: hasCommentCta
        ? "Có câu hỏi / CTA kích thích bình luận."
        : "Nên bổ sung câu hỏi hoặc CTA kích thích người đọc để lại ý kiến.",
    },
  ];

  return {
    totalScore,
    grade,
    metrics: {
      hookEntityPresent,
      hookCharacterCount: Math.min(120, safeContent.length),
      keywordDensityPercent,
      wordCount,
      paragraphCount,
      avgWordsPerParagraph,
      emojiCount,
      hasCommentCta,
    },
    checks,
  };
}

// --- F5 & F6: Golden Hours Calculator & Scheduling Oracle ---

interface SlotConfig {
  id: GoldenHourSlotId;
  label: string;
  timeRange: string;
  targetHour: number;
  targetMinute: number;
  endHour: number;
  endMinute: number;
  isRecommendedPrime: boolean;
}

const GOLDEN_SLOTS_CONFIG: SlotConfig[] = [
  {
    id: "morning",
    label: "Sáng sớm (Dân công sở & tin tức)",
    timeRange: "07:30 - 08:30",
    targetHour: 8,
    targetMinute: 0,
    endHour: 8,
    endMinute: 30,
    isRecommendedPrime: false,
  },
  {
    id: "noon",
    label: "Buổi trưa (Nghỉ trưa & mua sắm)",
    timeRange: "11:30 - 13:00",
    targetHour: 12,
    targetMinute: 0,
    endHour: 13,
    endMinute: 0,
    isRecommendedPrime: false,
  },
  {
    id: "evening",
    label: "Chiều tối (Khung Giờ Vàng Prime)",
    timeRange: "19:30 - 21:30",
    targetHour: 20,
    targetMinute: 0,
    endHour: 21,
    endMinute: 30,
    isRecommendedPrime: true,
  },
  {
    id: "night",
    label: "Đêm muộn (Tâm sự & đọc dài)",
    timeRange: "22:00 - 23:00",
    targetHour: 22,
    targetMinute: 30,
    endHour: 23,
    endMinute: 0,
    isRecommendedPrime: false,
  },
];

export function oracleGetUpcomingPreset(id: GoldenHourSlotId, referenceDate = new Date()): GoldenHourSlot {
  const config = GOLDEN_SLOTS_CONFIG.find((c) => c.id === id) || GOLDEN_SLOTS_CONFIG[2];

  const now = new Date(referenceDate);
  const targetDate = new Date(now);

  targetDate.setHours(config.targetHour, config.targetMinute, 0, 0);

  const slotEndTime = new Date(now);
  slotEndTime.setHours(config.endHour, config.endMinute, 0, 0);

  let isToday = true;
  if (now.getTime() > slotEndTime.getTime()) {
    // Already passed today, push to tomorrow
    targetDate.setDate(targetDate.getDate() + 1);
    isToday = false;
  }

  const timeStr = `${String(config.targetHour).padStart(2, "0")}:${String(config.targetMinute).padStart(2, "0")}`;
  const formattedTarget = isToday ? `Hôm nay, ${timeStr}` : `Ngày mai, ${timeStr}`;

  return {
    id: config.id,
    label: config.label,
    timeRange: config.timeRange,
    isToday,
    formattedTarget,
    timestamp: targetDate.toISOString(),
    isRecommendedPrime: config.isRecommendedPrime,
  };
}

export function oracleGetGoldenHourPresets(referenceDate = new Date()): GoldenHourSlot[] {
  return GOLDEN_SLOTS_CONFIG.map((c) => oracleGetUpcomingPreset(c.id, referenceDate));
}

// --- F7 & F8: 3-Tier Hashtag Generator Oracle ---

function removeVietnameseTones(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

function toHashtag(str: string): string {
  const clean = removeVietnameseTones(str)
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .trim();
  if (!clean) return "";
  const parts = clean.split(/\s+/).map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
  return `#${parts.join("")}`;
}

export function oracleGenerateThreeTierHashtags(title: string, entity?: string, content?: string): ThreeTierHashtags {
  const tier1Entity: string[] = [];
  const tier2Topic: string[] = [];
  const tier3Trend: string[] = [];

  // Tier 1: Entity & Brand
  if (entity && entity.trim()) {
    const mainTag = toHashtag(entity);
    if (mainTag) tier1Entity.push(mainTag);
    tier1Entity.push(`${mainTag}Official`);
  } else {
    tier1Entity.push("#BrandName", "#OfficialStore");
  }

  // Tier 2: Topic & Industry
  if (title && title.trim()) {
    const titleTag = toHashtag(title);
    if (titleTag) tier2Topic.push(titleTag);
  }
  tier2Topic.push("#ChiaSeKienThuc", "#GocNhinChuyenGia");

  // Tier 3: Trend & Community
  tier3Trend.push("#ViralFacebook", "#XuHuong2026", "#CongDongContent");

  const allCombined = Array.from(new Set([...tier1Entity, ...tier2Topic, ...tier3Trend]));
  const formattedBlock = allCombined.join(" ");

  return {
    tier1Entity,
    tier2Topic,
    tier3Trend,
    allCombined,
    formattedBlock,
  };
}

export function oracleAppendHashtags(content: string, hashtags: string[]): string {
  const safeContent = (content || "").trim();
  const tagsStr = hashtags.join(" ");
  if (!safeContent) return tagsStr;
  return `${safeContent}\n\n${tagsStr}`;
}

// --- F9 & F10: AI Image Alt Text & SEO Caption Oracle ---

export function oracleGenerateImageSeoMetadata(topicTitle: string, entity?: string): ImageSeoMetadata {
  const safeTitle = topicTitle || "Nội dung Facebook";
  const safeEntity = entity || "Thương hiệu";

  const altText = `Hình ảnh minh họa chuyên nghiệp cho chủ đề ${safeTitle} của ${safeEntity}, sắc nét, ánh sáng tự nhiên.`;
  const caption = `[Hình ảnh] ${safeTitle} - Khám phá góc nhìn chuyên sâu cùng ${safeEntity} ✨`;

  return { altText, caption };
}

// --- F11 & F12: Content Variations & A/B Presets Oracle ---

const STYLE_PRESETS: StylePresetItem[] = [
  {
    id: "storytelling",
    name: "Storytelling / Cảm xúc",
    desc: "Kể chuyện dẫn dắt cảm xúc, chạm nỗi đau độc giả và chia sẻ bài học truyền cảm hứng.",
    icon: "BookOpen",
  },
  {
    id: "direct_sales",
    name: "Bán hàng / Trực diện",
    desc: "Tập trung giải quyết vấn đề, nêu bật USP sản phẩm, bằng chứng xã hội và CTA chốt đơn mạnh mẽ.",
    icon: "Target",
  },
  {
    id: "news_guide",
    name: "Tin tức / Cẩm nang chia sẻ",
    desc: "Cung cấp giá trị kiến thức thực tiễn, định dạng checklist hoặc cẩm nang chi tiết từng bước.",
    icon: "Newspaper",
  },
  {
    id: "humorous_trend",
    name: "Hài hước / Bắt trend",
    desc: "Giọng văn hóm hỉnh, bắt kịp từ khóa đang thịnh hành trên mạng xã hội, kích thích chia sẻ viral.",
    icon: "Sparkles",
  },
];

export function oracleGetAllStylePresets(): StylePresetItem[] {
  return [...STYLE_PRESETS];
}

export function oracleGetStylePrompt(style: ContentStyleVariation): string {
  switch (style) {
    case "storytelling":
      return "Viết bài theo phong cách Storytelling cảm xúc: Mở đầu bằng một tình huống thực tế hoặc bước ngoặt, khắc họa nội tâm nhân vật, sau đó đúc kết bài học giá trị.";
    case "direct_sales":
      return "Viết bài theo phong cách Bán hàng trực diện (PAS/AIDA): Nêu vấn đề cấp bách, đào sâu hậu quả, giới thiệu giải pháp độc quyền và đưa ra lời kêu gọi mua hàng dứt khoát.";
    case "news_guide":
      return "Viết bài theo phong cách Cẩm nang chia sẻ kiến thức: Trình bày logic, khách quan, phân mục rõ ràng với các gạch đầu dòng hành động cụ thể cho độc giả áp dụng ngay.";
    case "humorous_trend":
      return "Viết bài theo phong cách Hài hước & Bắt trend: Dùng ngôn ngữ dí dỏm, chêm các meme hoặc cụm từ thịnh hành tự nhiên, tạo tiếng cười sảng khoái và kích thích tag bạn bè.";
    default:
      return "Viết bài chia sẻ giá trị chuẩn Social SEO.";
  }
}

// --- F13: Dynamic SQLite Migration Oracle ---

export function oracleRunMigrations(db: DatabaseSync): void {
  // Add columns to facebook_posts
  const postCols = [
    { name: "scheduled_at", type: "TEXT" },
    { name: "seo_score", type: "INTEGER DEFAULT 0" },
    { name: "seo_breakdown", type: "TEXT DEFAULT ''" },
    { name: "policy_warnings", type: "TEXT DEFAULT ''" },
    { name: "policy_status", type: "TEXT DEFAULT 'clean'" },
    { name: "hashtags", type: "TEXT DEFAULT ''" },
    { name: "alt_text", type: "TEXT DEFAULT ''" },
    { name: "image_caption", type: "TEXT DEFAULT ''" },
    { name: "content_style", type: "TEXT DEFAULT 'standard'" },
    { name: "variations_json", type: "TEXT DEFAULT ''" },
  ];

  const postTableInfo = (db.prepare("PRAGMA table_info(facebook_posts);").all() as Array<{ name: string }>).map(
    (c) => c.name
  );

  for (const col of postCols) {
    if (!postTableInfo.includes(col.name)) {
      db.exec(`ALTER TABLE facebook_posts ADD COLUMN ${col.name} ${col.type};`);
    }
  }

  // Add columns to ai_images
  const imgCols = [
    { name: "alt_text", type: "TEXT DEFAULT ''" },
    { name: "caption", type: "TEXT DEFAULT ''" },
  ];

  const imgTableInfo = (db.prepare("PRAGMA table_info(ai_images);").all() as Array<{ name: string }>).map(
    (c) => c.name
  );

  for (const col of imgCols) {
    if (!imgTableInfo.includes(col.name)) {
      db.exec(`ALTER TABLE ai_images ADD COLUMN ${col.name} ${col.type};`);
    }
  }
}

// =========================================================================
// R1: Bounded Context: Target Pages vs Source Pages Oracle
// =========================================================================

export function oracleSaveTargetPage(db: DatabaseSync, item: TargetPageItem): void {
  if (!item.pageId || !item.pageId.trim()) {
    throw new Error("Target Page requires a non-empty pageId.");
  }
  if (!item.accessToken || !item.accessToken.trim()) {
    throw new Error("Target Page requires a valid accessToken.");
  }

  if (item.isDefault) {
    db.exec(`UPDATE target_pages SET is_default = 0;`);
  }

  const stmt = db.prepare(`
    INSERT INTO target_pages (id, page_id, page_name, access_token, avatar_url, is_default, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      page_id = excluded.page_id,
      page_name = excluded.page_name,
      access_token = excluded.access_token,
      avatar_url = excluded.avatar_url,
      is_default = excluded.is_default,
      status = excluded.status,
      updated_at = excluded.updated_at;
  `);

  stmt.run(
    item.id,
    item.pageId,
    item.pageName,
    item.accessToken,
    item.avatarUrl || "",
    item.isDefault ? 1 : 0,
    item.status || "active",
    item.createdAt || new Date().toISOString(),
    item.updatedAt || new Date().toISOString()
  );
}

export function oracleGetTargetPages(db: DatabaseSync): TargetPageItem[] {
  const rows = db.prepare(`SELECT * FROM target_pages ORDER BY is_default DESC, created_at DESC;`).all() as any[];
  return rows.map((r) => ({
    id: r.id,
    pageId: r.page_id,
    pageName: r.page_name,
    accessToken: r.access_token,
    avatarUrl: r.avatar_url,
    isDefault: Boolean(r.is_default),
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export function oracleGetTargetPageById(db: DatabaseSync, id: string): TargetPageItem | null {
  const row = db.prepare(`SELECT * FROM target_pages WHERE id = ? OR page_id = ? LIMIT 1;`).get(id, id) as any;
  if (!row) return null;
  return {
    id: row.id,
    pageId: row.page_id,
    pageName: row.page_name,
    accessToken: row.access_token,
    avatarUrl: row.avatar_url,
    isDefault: Boolean(row.is_default),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function oracleSaveSourcePage(db: DatabaseSync, item: SourcePageItem): void {
  if (!item.name || !item.name.trim()) {
    throw new Error("Source Page requires a non-empty name.");
  }
  if (!item.url || !item.url.trim()) {
    throw new Error("Source Page requires a valid URL.");
  }

  const rawItemLimit =
    item.scanPostLimit !== undefined && !Number.isNaN(Number(item.scanPostLimit))
      ? Number(item.scanPostLimit)
      : 5;
  const clampedLimit = Math.max(1, Math.min(10, rawItemLimit));

  const stmt = db.prepare(`
    INSERT INTO source_pages (id, name, url, page_id, input_mode, access_token, avatar_url, scan_post_limit, status, last_scanned_at, last_error, total_posts_scanned, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      url = excluded.url,
      page_id = excluded.page_id,
      input_mode = excluded.input_mode,
      access_token = excluded.access_token,
      avatar_url = excluded.avatar_url,
      scan_post_limit = excluded.scan_post_limit,
      status = excluded.status,
      last_scanned_at = excluded.last_scanned_at,
      last_error = excluded.last_error,
      total_posts_scanned = excluded.total_posts_scanned,
      updated_at = excluded.updated_at;
  `);

  stmt.run(
    item.id,
    item.name,
    item.url,
    item.pageId || "",
    item.inputMode || "url_scrape",
    item.accessToken || "",
    item.avatarUrl || "",
    clampedLimit,
    item.status || "active",
    item.lastScannedAt || null,
    item.lastError || "",
    item.totalPostsScanned || 0,
    item.createdAt || new Date().toISOString(),
    item.updatedAt || new Date().toISOString()
  );
}

export function oracleGetSourcePages(db: DatabaseSync): SourcePageItem[] {
  const rows = db.prepare(`SELECT * FROM source_pages ORDER BY created_at DESC;`).all() as any[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    url: r.url,
    pageId: r.page_id,
    inputMode: r.input_mode as SourcePageInputMode,
    accessToken: r.access_token,
    avatarUrl: r.avatar_url,
    scanPostLimit: Number(r.scan_post_limit) || 5,
    status: r.status,
    lastScannedAt: r.last_scanned_at,
    lastError: r.last_error,
    totalPostsScanned: Number(r.total_posts_scanned) || 0,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export function oracleGetSourcePageById(db: DatabaseSync, id: string): SourcePageItem | null {
  const row = db.prepare(`SELECT * FROM source_pages WHERE id = ? LIMIT 1;`).get(id) as any;
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    pageId: row.page_id,
    inputMode: row.input_mode as SourcePageInputMode,
    accessToken: row.access_token,
    avatarUrl: row.avatar_url,
    scanPostLimit: Number(r_limit(row.scan_post_limit)),
    status: row.status,
    lastScannedAt: row.last_scanned_at,
    lastError: row.last_error,
    totalPostsScanned: Number(row.total_posts_scanned) || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function r_limit(v: any): number {
  return Number(v) || 5;
}

export function oracleDeletePage(db: DatabaseSync, type: "target" | "source", id: string): boolean {
  if (type === "target") {
    const res = db.prepare(`DELETE FROM target_pages WHERE id = ?;`).run(id);
    return res.changes > 0;
  } else {
    db.prepare(`DELETE FROM source_posts WHERE source_page_id = ?;`).run(id);
    const res = db.prepare(`DELETE FROM source_pages WHERE id = ?;`).run(id);
    return res.changes > 0;
  }
}

export function oracleParseSourceUrl(rawUrl: string): {
  isValid: boolean;
  slug?: string;
  isNumericId?: boolean;
  normalizedUrl?: string;
  error?: string;
} {
  if (!rawUrl || typeof rawUrl !== "string") {
    return { isValid: false, error: "Empty URL provided" };
  }

  const trimmed = rawUrl.trim();
  const fbRegex = /^(?:https?:\/\/)?(?:www\.|m\.|mbasic\.)?(?:facebook\.com|fb\.com)\/(?:profile\.php\?id=(\d+)|pages\/category\/[^/]+\/([a-zA-Z0-9.-]+)|([a-zA-Z0-9._-]+))\/?/i;
  const match = trimmed.match(fbRegex);

  if (!match) {
    return { isValid: false, error: "URL is not a recognized Facebook Page format" };
  }

  const numericId = match[1];
  const categorySlug = match[2];
  const handleSlug = match[3];

  const slug = numericId || categorySlug || handleSlug;
  const isNumericId = Boolean(numericId);
  const normalizedUrl = isNumericId
    ? `https://www.facebook.com/profile.php?id=${numericId}`
    : `https://www.facebook.com/${slug}`;

  return {
    isValid: true,
    slug,
    isNumericId,
    normalizedUrl,
  };
}

export function oracleValidatePageContext(
  page: any,
  expectedType: "target" | "source"
): { valid: boolean; reason?: string } {
  if (expectedType === "target") {
    if (!page.pageId || !page.accessToken) {
      return { valid: false, reason: "Target Page must possess valid pageId and accessToken credentials." };
    }
    return { valid: true };
  } else {
    if (page.canPublish === true) {
      return { valid: false, reason: "Source Page must strictly have zero write/publishing capabilities." };
    }
    if (!page.url && !page.pageId) {
      return { valid: false, reason: "Source Page requires a valid public URL or reference pageId." };
    }
    return { valid: true };
  }
}

export function oracleRunR1Migrations(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS target_pages (
      id TEXT PRIMARY KEY,
      page_id TEXT NOT NULL UNIQUE,
      page_name TEXT NOT NULL,
      access_token TEXT NOT NULL,
      avatar_url TEXT DEFAULT '',
      is_default INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS source_pages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      page_id TEXT DEFAULT '',
      input_mode TEXT NOT NULL DEFAULT 'url_scrape',
      access_token TEXT DEFAULT '',
      avatar_url TEXT DEFAULT '',
      scan_post_limit INTEGER DEFAULT 5,
      status TEXT NOT NULL DEFAULT 'active',
      last_scanned_at TEXT,
      last_error TEXT DEFAULT '',
      total_posts_scanned INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS source_posts (
      id TEXT PRIMARY KEY,
      source_page_id TEXT NOT NULL,
      facebook_post_id TEXT NOT NULL UNIQUE,
      content_hash TEXT NOT NULL,
      original_content TEXT NOT NULL,
      media_urls TEXT DEFAULT '[]',
      original_media_urls TEXT DEFAULT '[]',
      published_time TEXT NOT NULL,
      like_count INTEGER DEFAULT 0,
      comment_count INTEGER DEFAULT 0,
      share_count INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'collected',
      collected_at TEXT DEFAULT (datetime('now')),
      evergreen_selected_at TEXT,
      rewritten_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_source_posts_fb_id ON source_posts(facebook_post_id);
    CREATE INDEX IF NOT EXISTS idx_source_posts_content_hash ON source_posts(content_hash);
    CREATE INDEX IF NOT EXISTS idx_source_posts_page_pub ON source_posts(source_page_id, published_time DESC);

    CREATE TABLE IF NOT EXISTS moderation_queue (
      id TEXT PRIMARY KEY,
      source_post_id TEXT,
      source_page_id TEXT,
      source_page_name TEXT DEFAULT '',
      source_url TEXT DEFAULT '',
      source_published_time TEXT,
      source_content TEXT NOT NULL,
      source_images_json TEXT DEFAULT '[]',
      target_page_id TEXT DEFAULT '',
      target_page_name TEXT DEFAULT '',
      ai_headline TEXT DEFAULT '',
      ai_hook TEXT DEFAULT '',
      ai_body TEXT DEFAULT '',
      ai_full_post TEXT NOT NULL,
      content_style TEXT DEFAULT 'storytelling',
      selected_images_json TEXT DEFAULT '[]',
      alt_text TEXT DEFAULT '',
      image_caption TEXT DEFAULT '',
      seo_score INTEGER DEFAULT 0,
      seo_breakdown_json TEXT DEFAULT '{}',
      policy_status TEXT DEFAULT 'clean',
      policy_warnings_json TEXT DEFAULT '[]',
      hashtags_json TEXT DEFAULT '[]',
      status TEXT DEFAULT 'pending',
      scheduled_at TEXT,
      published_at TEXT,
      fb_post_id TEXT,
      fb_post_url TEXT,
      error_message TEXT,
      rewrite_count INTEGER DEFAULT 1,
      last_rewrite_prompt TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_mod_queue_status ON moderation_queue(status);
    CREATE INDEX IF NOT EXISTS idx_mod_queue_source_post ON moderation_queue(source_post_id);
  `);
}

// =========================================================================
// R2: Post Collection, Deduplication & Evergreen Oracle
// =========================================================================

export function oracleComputeContentHash(content: string): string {
  const normalized = (content || "")
    .replace(/\r\n/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

export function oracleCheckDeduplication(
  db: DatabaseSync,
  facebookPostId: string,
  contentHash: string
): { isDuplicate: boolean; duplicateLayer?: "post_id" | "content_hash"; existingId?: string } {
  const rowId = db.prepare(`SELECT id FROM source_posts WHERE facebook_post_id = ? LIMIT 1;`).get(facebookPostId) as any;
  if (rowId) {
    return { isDuplicate: true, duplicateLayer: "post_id", existingId: rowId.id };
  }

  const rowHash = db.prepare(`SELECT id FROM source_posts WHERE content_hash = ? LIMIT 1;`).get(contentHash) as any;
  if (rowHash) {
    return { isDuplicate: true, duplicateLayer: "content_hash", existingId: rowHash.id };
  }

  return { isDuplicate: false };
}

export function oracleDownloadMedia(remoteUrls: string[], facebookPostId: string): string[] {
  if (!remoteUrls || remoteUrls.length === 0) return [];
  const cleanId = (facebookPostId || "post").replace(/[^a-zA-Z0-9_-]/g, "_");

  return remoteUrls.map((url, index) => {
    const extMatch = url.match(/\.(jpg|jpeg|png|webp)/i);
    const ext = extMatch ? extMatch[1].toLowerCase() : "jpg";
    const shortHash = createHash("md5").update(url).digest("hex").slice(0, 6);
    return `/uploads/source_media/spost_${cleanId}_${index}_${shortHash}.${ext}`;
  });
}

export function oracleCollectPosts(
  db: DatabaseSync,
  options: CollectPostsOptions,
  candidatePosts?: Partial<SourcePostItem>[]
): CollectPostsResult {
  const rawLimit =
    options.limit !== undefined && !Number.isNaN(Number(options.limit))
      ? Number(options.limit)
      : 5;
  const limit = Math.max(1, Math.min(10, rawLimit));
  const candidates: Partial<SourcePostItem>[] =
    candidatePosts && candidatePosts.length > 0
      ? candidatePosts.slice(0, limit)
      : [
          {
            facebookPostId: `post_gen_1`,
            originalContent: "Bài viết mẫu số 1 cập nhật tin tức kinh doanh và công nghệ mới nhất.",
            publishedTime: new Date().toISOString(),
            mediaUrls: ["https://example.com/photo1.jpg"],
            likeCount: 150,
            commentCount: 25,
            shareCount: 10,
          },
        ];

  let newCollected = 0;
  let duplicatesSkipped = 0;
  const savedPosts: SourcePostItem[] = [];

  for (const c of candidates) {
    const fbId = c.facebookPostId || `fb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const content = c.originalContent || "";
    const hash = c.contentHash || oracleComputeContentHash(content);

    const dedup = oracleCheckDeduplication(db, fbId, hash);
    if (dedup.isDuplicate) {
      duplicatesSkipped++;
      continue;
    }

    const localMedia = oracleDownloadMedia(c.originalMediaUrls || c.mediaUrls || [], fbId);
    const postItem: SourcePostItem = {
      id: c.id || `spost_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      sourcePageId: options.sourcePageId,
      facebookPostId: fbId,
      contentHash: hash,
      originalContent: content,
      mediaUrls: localMedia,
      originalMediaUrls: c.originalMediaUrls || c.mediaUrls || [],
      publishedTime: c.publishedTime || new Date().toISOString(),
      likeCount: Number(c.likeCount) || 0,
      commentCount: Number(c.commentCount) || 0,
      shareCount: Number(c.shareCount) || 0,
      status: "collected",
      collectedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.prepare(`
      INSERT INTO source_posts (id, source_page_id, facebook_post_id, content_hash, original_content, media_urls, original_media_urls, published_time, like_count, comment_count, share_count, status, collected_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `).run(
      postItem.id,
      postItem.sourcePageId,
      postItem.facebookPostId,
      postItem.contentHash,
      postItem.originalContent,
      JSON.stringify(postItem.mediaUrls),
      JSON.stringify(postItem.originalMediaUrls),
      postItem.publishedTime,
      postItem.likeCount,
      postItem.commentCount,
      postItem.shareCount,
      postItem.status,
      postItem.collectedAt,
      postItem.createdAt,
      postItem.updatedAt
    );

    newCollected++;
    savedPosts.push(postItem);
  }

  // Update total posts count on source page if it exists
  db.prepare(`
    UPDATE source_pages
    SET total_posts_scanned = total_posts_scanned + ?,
        last_scanned_at = datetime('now')
    WHERE id = ?;
  `).run(candidates.length, options.sourcePageId);

  const allAlreadyCollected = candidates.length > 0 && newCollected === 0 && duplicatesSkipped === candidates.length;

  let message = "";
  let evergreenSuggestion: SourcePostItem | null = null;

  if (allAlreadyCollected) {
    message = "Tất cả bài gần nhất đều đã được lấy";
    const candidatesOlder = oracleFindEvergreenCandidates(db, options.sourcePageId);
    if (candidatesOlder.length > 0) {
      evergreenSuggestion = candidatesOlder[0].post;
    }
  } else {
    message = `Đã quét ${candidates.length} bài: Thu thập mới ${newCollected} bài, bỏ qua ${duplicatesSkipped} bài trùng lặp.`;
  }

  return {
    success: true,
    sourcePageId: options.sourcePageId,
    totalScanned: candidates.length,
    newCollected,
    duplicatesSkipped,
    allAlreadyCollected,
    message,
    posts: savedPosts,
    evergreenSuggestion,
  };
}

export function oracleFindEvergreenCandidates(
  db: DatabaseSync,
  sourcePageId: string,
  referenceDate = new Date()
): EvergreenCandidate[] {
  const rows = db.prepare(`
    SELECT * FROM source_posts
    WHERE source_page_id = ?
      AND status IN ('collected', 'ignored', 'evergreen_repurposed')
    ORDER BY published_time ASC;
  `).all(sourcePageId) as any[];

  const refTime = referenceDate.getTime();
  const eligible: EvergreenCandidate[] = [];

  for (const r of rows) {
    const pubTime = new Date(r.published_time).getTime();
    const ageDays = (refTime - pubTime) / (1000 * 60 * 60 * 24);

    if (ageDays >= 15) {
      const score = (r.like_count || 0) + (r.comment_count || 0) * 2 + (r.share_count || 0) * 3;
      let mediaUrls: string[] = [];
      try {
        mediaUrls = JSON.parse(r.media_urls || "[]");
      } catch {
        mediaUrls = [];
      }

      eligible.push({
        post: {
          id: r.id,
          sourcePageId: r.source_page_id,
          facebookPostId: r.facebook_post_id,
          contentHash: r.content_hash,
          originalContent: r.original_content,
          mediaUrls,
          publishedTime: r.published_time,
          likeCount: r.like_count,
          commentCount: r.comment_count,
          shareCount: r.share_count,
          status: r.status,
          collectedAt: r.collected_at,
          evergreenSelectedAt: r.evergreen_selected_at,
          rewrittenAt: r.rewritten_at,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        },
        ageDays: Math.floor(ageDays),
        engagementScore: score,
      });
    }
  }

  eligible.sort((a, b) => {
    if (b.engagementScore !== a.engagementScore) {
      return b.engagementScore - a.engagementScore;
    }
    return new Date(a.post.publishedTime).getTime() - new Date(b.post.publishedTime).getTime();
  });

  return eligible;
}

export function oracleTriggerEvergreenFallback(db: DatabaseSync, sourcePostId: string): SourcePostItem | null {
  const nowStr = new Date().toISOString();
  db.prepare(`
    UPDATE source_posts
    SET status = 'evergreen_repurposed',
        evergreen_selected_at = ?
    WHERE id = ?;
  `).run(nowStr, sourcePostId);

  const row = db.prepare(`SELECT * FROM source_posts WHERE id = ? LIMIT 1;`).get(sourcePostId) as any;
  if (!row) return null;
  let mediaUrls: string[] = [];
  try {
    mediaUrls = JSON.parse(row.media_urls || "[]");
  } catch {
    mediaUrls = [];
  }

  return {
    id: row.id,
    sourcePageId: row.source_page_id,
    facebookPostId: row.facebook_post_id,
    contentHash: row.content_hash,
    originalContent: row.original_content,
    mediaUrls,
    publishedTime: row.published_time,
    likeCount: row.like_count,
    commentCount: row.comment_count,
    shareCount: row.share_count,
    status: row.status,
    collectedAt: row.collected_at,
    evergreenSelectedAt: row.evergreen_selected_at,
    rewrittenAt: row.rewritten_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// =========================================================================
// R3: AI Repurposing & Multi-Style Rewriter Oracle
// =========================================================================

export function oracleCheckAntiVerbatim(
  originalContent: string,
  rewrittenText: string
): { isUnique: boolean; maxMatchedSpanWords: number; sampleMatch?: string } {
  if (!originalContent || !rewrittenText) {
    return { isUnique: true, maxMatchedSpanWords: 0 };
  }

  const origWords = originalContent.toLowerCase().split(/\s+/).filter(Boolean);
  const rewWords = rewrittenText.toLowerCase().split(/\s+/).filter(Boolean);

  let maxSpan = 0;
  let sampleMatch: string | undefined;

  for (let i = 0; i <= origWords.length - 10; i++) {
    const window = origWords.slice(i, i + 10).join(" ");
    if (rewrittenText.toLowerCase().includes(window)) {
      maxSpan = 10;
      sampleMatch = window;
      return { isUnique: false, maxMatchedSpanWords: maxSpan, sampleMatch };
    }
  }

  return { isUnique: true, maxMatchedSpanWords: maxSpan };
}

export function oracleRewriteSourcePost(req: RepurposeRewriteRequest): RepurposeRewriteResponse {
  const style = req.style || "storytelling";

  let headline = "";
  let hook = "";
  let body = "";
  let cta = "";

  if (style === "storytelling") {
    headline = "Góc Suy Ngẫm: Hành Trình Bứt Phá & Trải Nghiệm Giá Trị";
    hook = "Có những thời điểm, một quyết định nhỏ lại thay đổi hoàn toàn cách chúng ta tư duy.";
    body = `Chúng tôi từng chứng kiến nhiều đối tác bắt đầu từ con số không, đối mặt vô vàn thử thách trước khi gặt hái kết quả.\n\nNhìn lại câu chuyện từ ${req.sourcePageName}, thông điệp cốt lõi không chỉ là thành tích nhất thời mà là sự kiên định qua từng giai đoạn.\n\nBài học quý giá nhất chính là việc tập trung vào giá trị thực, duy trì tinh thần cải tiến không ngừng để đạt tới thành công bền vững.`;
    cta = "Bạn đã từng trải qua khoảnh khắc bước ngoặt tương tự chưa? Hãy chia sẻ cảm nghĩ bên dưới nhé!";
  } else if (style === "direct_sales") {
    headline = "Giải Pháp Toàn Diện Tối Ưu Hiệu Quả Dành Riêng Cho Bạn";
    hook = "Bạn đang tìm kiếm giải pháp đột phá để tiết kiệm thời gian và nhân đôi hiệu suất?";
    body = `Vấn đề phổ biến hiện nay là nguồn lực bị phân tán, khiến tiến độ chậm và chi phí tăng cao.\n\nGiải pháp chuyên sâu được đúc kết từ thực tiễn mang lại quy trình khép kín, minh bạch và tối ưu triệt để.\n\nĐã có hàng trăm khách hàng ứng dụng thành công và đạt kết quả vượt mong đợi ngay trong tháng đầu tiên.`;
    cta = "Để lại bình luận hoặc nhắn tin ngay để nhận tư vấn lộ trình chi tiết!";
  } else if (style === "news_guide") {
    headline = "Cẩm Nang Tổng Hợp: 3 Bước Thực Chiến Nâng Cao Hiệu Quả";
    hook = "Cập nhật mới nhất thông tin quan trọng mà bạn không nên bỏ lỡ hôm nay.";
    body = `Bước 1: Khảo sát hiện trạng và xác định mục tiêu trọng tâm.\n\nBước 2: Chuẩn hóa quy trình vận hành theo checklist thực tiễn.\n\nBước 3: Đánh giá định kỳ và tối ưu hóa liên tục dựa trên số liệu thực tế.`;
    cta = "Bạn ấn tượng nhất với bước nào? Cùng thảo luận góc nhìn của bạn nhé!";
  } else {
    headline = "Cực Chill: Khi Mọi Thứ Diễn Ra Theo Cách Không Ngờ";
    hook = "Tưởng không vui mà vui không tưởng với tình huống có 1-0-2 này!";
    body = `Cứ ngỡ mọi chuyện đơn giản cho đến khi thực tế chứng minh điều ngược lại.\n\nNhững pha xử lý đi vào lòng người khiến ai chứng kiến cũng phải bật cười thích thú.\n\nĐúng là chỉ cần giữ tinh thần tích cực thì mọi áp lực đều trở nên nhẹ nhàng hơn rất nhiều.`;
    cta = "Tag ngay đứa bạn thân cùng chia sẻ khoảnh khắc thú vị này nào!";
  }

  const fullPostRaw = `${headline}\n\n${hook}\n\n${body}\n\n${cta}`;

  // Chain Policy Guard auto-sanitization
  const sanitizedPost = oracleAutoSanitizeAll(fullPostRaw);
  const policyScan = oracleScanFacebookPolicy(sanitizedPost);

  // Chain 3-Tier Hashtags
  const hashtagsResult = oracleGenerateThreeTierHashtags(headline, req.targetPageName || "Fanpage", sanitizedPost);
  const fullPost = oracleAppendHashtags(sanitizedPost, hashtagsResult.allCombined);

  // SEO Scorecard
  const seoEvaluation = oracleEvaluateSocialSeo(fullPost, req.targetPageName || "Fanpage", headline);

  // Media Linking
  const sourceImages = req.sourceImages || [];
  const selectedImages = [...sourceImages];
  const { altText, caption } = oracleGenerateImageSeoMetadata(headline, req.targetPageName || "Fanpage");

  const queueItem: ModerationQueueItem = {
    id: `mod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    sourcePostId: req.sourcePostId,
    sourcePageId: "spage_1",
    sourcePageName: req.sourcePageName,
    sourceUrl: req.sourceUrl,
    sourcePublishedTime: req.sourcePublishedTime,
    sourceContent: req.sourceContent,
    sourceImages,
    targetPageId: req.targetPageId || "target_default",
    targetPageName: req.targetPageName || "Target Fanpage",
    aiHeadline: headline,
    aiHook: hook,
    aiBody: body,
    aiFullPost: fullPost,
    contentStyle: style,
    selectedImages,
    altText,
    imageCaption: caption,
    seoScore: seoEvaluation.totalScore,
    seoBreakdown: seoEvaluation,
    policyStatus: policyScan.riskLevel === "danger" ? "danger" : policyScan.riskLevel === "warning" ? "warning" : "clean",
    policyWarnings: policyScan.violations,
    hashtags: hashtagsResult.allCombined,
    status: "pending", // Mandated: Must start as pending
    rewriteCount: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return {
    queueItem,
    usedKeyMasked: "AIzaSy...7x9k",
    model: "gemini-3.8-flash",
  };
}

// =========================================================================
// R4: Human-in-the-Loop Moderation Queue & Publishing Oracle
// =========================================================================

export function oracleCreateQueueItem(db: DatabaseSync, item: ModerationQueueItem): ModerationQueueItem {
  const stmt = db.prepare(`
    INSERT INTO moderation_queue (
      id, source_post_id, source_page_id, source_page_name, source_url, source_published_time,
      source_content, source_images_json, target_page_id, target_page_name,
      ai_headline, ai_hook, ai_body, ai_full_post, content_style,
      selected_images_json, alt_text, image_caption, seo_score, seo_breakdown_json,
      policy_status, policy_warnings_json, hashtags_json, status,
      scheduled_at, published_at, fb_post_id, fb_post_url, error_message,
      rewrite_count, last_rewrite_prompt, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?
    );
  `);

  stmt.run(
    item.id,
    item.sourcePostId,
    item.sourcePageId,
    item.sourcePageName,
    item.sourceUrl || "",
    item.sourcePublishedTime || "",
    item.sourceContent,
    JSON.stringify(item.sourceImages || []),
    item.targetPageId,
    item.targetPageName,
    item.aiHeadline,
    item.aiHook,
    item.aiBody,
    item.aiFullPost,
    item.contentStyle,
    JSON.stringify(item.selectedImages || []),
    item.altText || "",
    item.imageCaption || "",
    item.seoScore,
    JSON.stringify(item.seoBreakdown || {}),
    item.policyStatus,
    JSON.stringify(item.policyWarnings || []),
    JSON.stringify(item.hashtags || []),
    item.status || "pending",
    item.scheduledAt || null,
    item.publishedAt || null,
    item.fbPostId || null,
    item.fbPostUrl || null,
    item.errorMessage || null,
    item.rewriteCount || 1,
    item.lastRewritePrompt || null,
    item.createdAt || new Date().toISOString(),
    item.updatedAt || new Date().toISOString()
  );

  return item;
}

export function oracleGetQueueItems(db: DatabaseSync, filter?: { status?: QueueItemStatus }): ModerationQueueItem[] {
  let query = `SELECT * FROM moderation_queue`;
  const params: any[] = [];
  if (filter?.status) {
    query += ` WHERE status = ?`;
    params.push(filter.status);
  }
  query += ` ORDER BY created_at DESC;`;

  const rows = db.prepare(query).all(...params) as any[];
  return rows.map((r) => ({
    id: r.id,
    sourcePostId: r.source_post_id,
    sourcePageId: r.source_page_id,
    sourcePageName: r.source_page_name,
    sourceUrl: r.source_url,
    sourcePublishedTime: r.source_published_time,
    sourceContent: r.source_content,
    sourceImages: JSON.parse(r.source_images_json || "[]"),
    targetPageId: r.target_page_id,
    targetPageName: r.target_page_name,
    aiHeadline: r.ai_headline,
    aiHook: r.ai_hook,
    aiBody: r.ai_body,
    aiFullPost: r.ai_full_post,
    contentStyle: r.content_style as ContentStyleVariation,
    selectedImages: JSON.parse(r.selected_images_json || "[]"),
    altText: r.alt_text,
    imageCaption: r.image_caption,
    seoScore: Number(r.seo_score) || 0,
    seoBreakdown: JSON.parse(r.seo_breakdown_json || "{}"),
    policyStatus: r.policy_status,
    policyWarnings: JSON.parse(r.policy_warnings_json || "[]"),
    hashtags: JSON.parse(r.hashtags_json || "[]"),
    status: r.status as QueueItemStatus,
    scheduledAt: r.scheduled_at,
    publishedAt: r.published_at,
    fbPostId: r.fb_post_id,
    fbPostUrl: r.fb_post_url,
    errorMessage: r.error_message,
    rewriteCount: Number(r.rewrite_count) || 1,
    lastRewritePrompt: r.last_rewrite_prompt,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export function oracleGetQueueItemById(db: DatabaseSync, id: string): ModerationQueueItem | null {
  const r = db.prepare(`SELECT * FROM moderation_queue WHERE id = ? LIMIT 1;`).get(id) as any;
  if (!r) return null;
  return {
    id: r.id,
    sourcePostId: r.source_post_id,
    sourcePageId: r.source_page_id,
    sourcePageName: r.source_page_name,
    sourceUrl: r.source_url,
    sourcePublishedTime: r.source_published_time,
    sourceContent: r.source_content,
    sourceImages: JSON.parse(r.source_images_json || "[]"),
    targetPageId: r.target_page_id,
    targetPageName: r.target_page_name,
    aiHeadline: r.ai_headline,
    aiHook: r.ai_hook,
    aiBody: r.ai_body,
    aiFullPost: r.ai_full_post,
    contentStyle: r.content_style as ContentStyleVariation,
    selectedImages: JSON.parse(r.selected_images_json || "[]"),
    altText: r.alt_text,
    imageCaption: r.image_caption,
    seoScore: Number(r.seo_score) || 0,
    seoBreakdown: JSON.parse(r.seo_breakdown_json || "{}"),
    policyStatus: r.policy_status,
    policyWarnings: JSON.parse(r.policy_warnings_json || "[]"),
    hashtags: JSON.parse(r.hashtags_json || "[]"),
    status: r.status as QueueItemStatus,
    scheduledAt: r.scheduled_at,
    publishedAt: r.published_at,
    fbPostId: r.fb_post_id,
    fbPostUrl: r.fb_post_url,
    errorMessage: r.error_message,
    rewriteCount: Number(r.rewrite_count) || 1,
    lastRewritePrompt: r.last_rewrite_prompt,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function oracleUpdateQueueDraft(
  db: DatabaseSync,
  id: string,
  updates: Partial<ModerationQueueItem>
): ModerationQueueItem {
  const current = oracleGetQueueItemById(db, id);
  if (!current) throw new Error(`Queue item ${id} not found.`);

  const updated: ModerationQueueItem = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  if (updates.aiFullPost && updates.aiFullPost !== current.aiFullPost) {
    const seo = oracleEvaluateSocialSeo(updated.aiFullPost, updated.targetPageName, updated.aiHeadline);
    updated.seoScore = seo.totalScore;
    updated.seoBreakdown = seo;
  }

  db.prepare(`
    UPDATE moderation_queue
    SET ai_headline = ?,
        ai_hook = ?,
        ai_body = ?,
        ai_full_post = ?,
        content_style = ?,
        selected_images_json = ?,
        target_page_id = ?,
        target_page_name = ?,
        seo_score = ?,
        seo_breakdown_json = ?,
        updated_at = ?
    WHERE id = ?;
  `).run(
    updated.aiHeadline,
    updated.aiHook,
    updated.aiBody,
    updated.aiFullPost,
    updated.contentStyle,
    JSON.stringify(updated.selectedImages),
    updated.targetPageId,
    updated.targetPageName,
    updated.seoScore,
    JSON.stringify(updated.seoBreakdown || {}),
    updated.updatedAt,
    id
  );

  return updated;
}

export function oracleApproveAndPublish(
  db: DatabaseSync,
  id: string,
  targetPageId?: string
): ModerationQueueItem {
  const current = oracleGetQueueItemById(db, id);
  if (!current) throw new Error(`Queue item ${id} not found.`);
  if (current.status === "rejected") {
    throw new Error("Cannot publish a rejected post.");
  }

  const nowStr = new Date().toISOString();
  const mockFbPostId = `fb_pub_${Date.now()}`;
  const mockFbUrl = `https://www.facebook.com/posts/${mockFbPostId}`;

  db.prepare(`
    UPDATE moderation_queue
    SET status = 'published',
        published_at = ?,
        fb_post_id = ?,
        fb_post_url = ?,
        target_page_id = COALESCE(?, target_page_id),
        updated_at = ?
    WHERE id = ?;
  `).run(nowStr, mockFbPostId, mockFbUrl, targetPageId || null, nowStr, id);

  return oracleGetQueueItemById(db, id)!;
}

export function oracleApproveAndSchedule(
  db: DatabaseSync,
  id: string,
  scheduledAt: string,
  targetPageId?: string
): ModerationQueueItem {
  const current = oracleGetQueueItemById(db, id);
  if (!current) throw new Error(`Queue item ${id} not found.`);
  if (current.status === "rejected") {
    throw new Error("Cannot schedule a rejected post.");
  }

  const schedTime = new Date(scheduledAt).getTime();
  if (isNaN(schedTime) || schedTime <= Date.now()) {
    throw new Error("Scheduled time must be a valid future ISO timestamp.");
  }

  const nowStr = new Date().toISOString();
  db.prepare(`
    UPDATE moderation_queue
    SET status = 'scheduled',
        scheduled_at = ?,
        target_page_id = COALESCE(?, target_page_id),
        updated_at = ?
    WHERE id = ?;
  `).run(scheduledAt, targetPageId || null, nowStr, id);

  return oracleGetQueueItemById(db, id)!;
}

export function oracleRequestRevision(
  db: DatabaseSync,
  id: string,
  feedback?: string,
  newStyle?: ContentStyleVariation
): ModerationQueueItem {
  const current = oracleGetQueueItemById(db, id);
  if (!current) throw new Error(`Queue item ${id} not found.`);

  const nextRewriteCount = (current.rewriteCount || 1) + 1;
  const targetStyle = newStyle || current.contentStyle;

  const revisedHeadline = `[Bản sửa đổi ${nextRewriteCount}] ${current.aiHeadline}`;
  const revisedBody = `${current.aiBody}\n\n[Cập nhật theo yêu cầu: ${feedback || "Tối ưu góc nhìn mới"}]`;
  const revisedFullPost = `${revisedHeadline}\n\n${current.aiHook}\n\n${revisedBody}`;

  const nowStr = new Date().toISOString();
  db.prepare(`
    UPDATE moderation_queue
    SET ai_headline = ?,
        ai_body = ?,
        ai_full_post = ?,
        content_style = ?,
        rewrite_count = ?,
        last_rewrite_prompt = ?,
        status = 'pending',
        updated_at = ?
    WHERE id = ?;
  `).run(revisedHeadline, revisedBody, revisedFullPost, targetStyle, nextRewriteCount, feedback || null, nowStr, id);

  return oracleGetQueueItemById(db, id)!;
}

export function oracleRejectQueueItem(db: DatabaseSync, id: string): ModerationQueueItem {
  const current = oracleGetQueueItemById(db, id);
  if (!current) throw new Error(`Queue item ${id} not found.`);

  const nowStr = new Date().toISOString();
  db.prepare(`
    UPDATE moderation_queue
    SET status = 'rejected',
        updated_at = ?
    WHERE id = ?;
  `).run(nowStr, id);

  return oracleGetQueueItemById(db, id)!;
}

export function oracleBuildMultiPhotoPayload(queueItem: ModerationQueueItem): {
  mode: "single_photo" | "multi_photo_album" | "text_feed";
  endpoint: string;
  payload: any;
} {
  const images = queueItem.selectedImages || [];
  if (images.length === 0) {
    return {
      mode: "text_feed",
      endpoint: `/${queueItem.targetPageId}/feed`,
      payload: {
        message: queueItem.aiFullPost,
      },
    };
  }

  if (images.length === 1) {
    return {
      mode: "single_photo",
      endpoint: `/${queueItem.targetPageId}/photos`,
      payload: {
        caption: queueItem.aiFullPost,
        photo_source: images[0],
      },
    };
  }

  return {
    mode: "multi_photo_album",
    endpoint: `/${queueItem.targetPageId}/feed`,
    payload: {
      message: queueItem.aiFullPost,
      attached_media: images.map((_, i) => ({
        media_fbid: `mock_media_fbid_${i + 1}`,
      })),
    },
  };
}

