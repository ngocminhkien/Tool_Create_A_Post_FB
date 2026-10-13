/**
 * tests/e2e/harness/referenceOracle.ts
 * Authoritative specification oracle derived directly from ORIGINAL_REQUEST.md & PROJECT.md
 * Provides ground-truth expected output derivation and standalone fallback verification.
 */

import { DatabaseSync } from "node:sqlite";
import {
  ContentStyleVariation,
  GoldenHourSlot,
  GoldenHourSlotId,
  ImageSeoMetadata,
  PolicyScanResult,
  PolicyViolationItem,
  SeoCheckItem,
  SocialSeoEvaluation,
  StylePresetItem,
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
