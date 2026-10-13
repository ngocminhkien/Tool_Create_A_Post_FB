import {
  SeoCheckItem,
  SocialSeoEvaluation,
} from "@/types/socialSeo.types";

/**
 * Real-time Social SEO & Readability Scorecard (0-100) engine.
 * Evaluates 6 core dimensions based on Facebook algorithmic distribution and search behavior:
 * 1. 120-char entity hook (25p)
 * 2. Keyword density 1.0% - 2.5% (20p)
 * 3. Post length 250 - 500 words (20p)
 * 4. Paragraph spacing & readability (15p)
 * 5. Emoji count 3 - 10 (10p)
 * 6. Comment CTA (10p)
 */
export function evaluateSocialSeo(
  content: string,
  entity?: string,
  title?: string
): SocialSeoEvaluation {
  const normalized = (content || "").normalize("NFC").trim();
  const words = normalized ? normalized.split(/\s+/).filter(Boolean) : [];
  const wordCount = words.length;

  const targetKey = (entity || title || "").normalize("NFC").trim();

  // Edge Case: Empty content
  if (wordCount === 0) {
    return {
      totalScore: 0,
      grade: "poor",
      metrics: {
        hookEntityPresent: false,
        hookCharacterCount: 0,
        keywordDensityPercent: 0,
        wordCount: 0,
        paragraphCount: 0,
        avgWordsPerParagraph: 0,
        emojiCount: 0,
        hasCommentCta: false,
      },
      checks: [
        {
          id: "hook_entity",
          label: "Thực thể / Từ khóa chính trong 120 ký tự đầu",
          passed: false,
          points: 0,
          maxPoints: 25,
          feedback: "Chưa có nội dung mở đầu bài viết.",
        },
        {
          id: "keyword_density",
          label: "Mật độ từ khóa chuẩn SEO (1.0% - 2.5%)",
          passed: false,
          points: 0,
          maxPoints: 20,
          feedback: "Chưa có nội dung để tính mật độ từ khóa.",
        },
        {
          id: "post_length",
          label: "Độ dài bài viết tối ưu (250 - 500 từ)",
          passed: false,
          points: 0,
          maxPoints: 20,
          feedback: "Bài viết chưa có nội dung (0 từ).",
        },
        {
          id: "readability",
          label: "Độ thông thoáng & ngắt đoạn (<= 50 từ/đoạn, >= 3 đoạn)",
          passed: false,
          points: 0,
          maxPoints: 15,
          feedback: "Chưa có đoạn văn để đánh giá độ thông thoáng.",
        },
        {
          id: "emoji_count",
          label: "Mật độ Emoji vừa phải (3 - 10 emoji)",
          passed: false,
          points: 0,
          maxPoints: 10,
          feedback: "Chưa có emoji nào trong bài viết.",
        },
        {
          id: "comment_cta",
          label: "Kêu gọi hành động kích thích bình luận (Comment CTA)",
          passed: false,
          points: 0,
          maxPoints: 10,
          feedback: "Chưa có câu hỏi hoặc kêu gọi tương tác ở cuối bài.",
        },
      ],
    };
  }

  // 1. Hook Entity in First 120 Characters (25 points)
  const first120 = normalized.slice(0, 120);
  let hookEntityPresent = false;
  let hookPoints = 0;
  let hookFeedback = "";

  if (targetKey) {
    if (first120.toLowerCase().includes(targetKey.toLowerCase())) {
      hookEntityPresent = true;
      hookPoints = 25;
      hookFeedback = `Xuất sắc: Từ khóa thực thể "${targetKey}" xuất hiện ngay trong 120 ký tự đầu tiên (trước nút 'Xem thêm').`;
    } else {
      hookEntityPresent = false;
      hookPoints = 0;
      hookFeedback = `Thiếu từ khóa chính trong 120 ký tự đầu tiên.`;
    }
  } else {
    if (first120.length >= 40 || (words.length > 0 && words[0].length >= 3)) {
      hookEntityPresent = true;
      hookPoints = 25;
      hookFeedback = `Mở đầu tốt: Đoạn mở đầu có độ dài ${first120.length} ký tự, thu hút người đọc trước nút 'Xem thêm'.`;
    } else {
      hookEntityPresent = false;
      hookPoints = 0;
      hookFeedback = `Câu mở đầu còn ngắn (${first120.length} ký tự), nên phát triển thêm ý thu hút.`;
    }
  }

  // 2. Keyword Density 1.0% - 2.5% (20 points)
  let density = 0;
  let densityPoints = 0;
  let densityFeedback = "";
  let densityPassed = false;

  if (targetKey) {
    const escaped = targetKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matches = normalized.match(new RegExp(escaped, "giu")) || [];
    const occurrences = matches.length;
    const keyWordLength = targetKey.split(/\s+/).filter(Boolean).length;
    density = Number(((occurrences * keyWordLength / wordCount) * 100).toFixed(2));

    if (density >= 1.0 && density <= 2.5) {
      densityPassed = true;
      densityPoints = 20;
      densityFeedback = `Mật độ đạt ${density}%, chuẩn Social SEO.`;
    } else if (density >= 0.8 && density <= 3.2) {
      densityPassed = false;
      densityPoints = 15;
      densityFeedback = `Mật độ hiện tại là ${density}% (chuẩn khuyến nghị: 1.0% - 2.5%).`;
    } else {
      densityPassed = false;
      densityPoints = 0;
      densityFeedback = `Mật độ hiện tại là ${density}% (chuẩn khuyến nghị: 1.0% - 2.5%).`;
    }
  } else {
    if (wordCount >= 200 && wordCount <= 600) {
      density = 1.5;
      densityPassed = true;
      densityPoints = 20;
      densityFeedback = `Mật độ đạt ${density}%, chuẩn Social SEO.`;
    } else {
      density = 0;
      densityPassed = false;
      densityPoints = 0;
      densityFeedback = "Chưa có từ khóa mục tiêu, độ dài chưa tối ưu tự nhiên.";
    }
  }

  // 3. Post Length 250 - 500 words (20 points)
  const lengthPassed = wordCount >= 250 && wordCount <= 500;
  let lengthPoints = 0;
  if (lengthPassed) {
    lengthPoints = 20;
  } else if ((wordCount >= 200 && wordCount < 250) || (wordCount > 500 && wordCount <= 600)) {
    lengthPoints = 15;
  } else if (wordCount >= 100 && wordCount < 200) {
    lengthPoints = 10;
  } else {
    lengthPoints = 0;
  }
  const lengthFeedback = lengthPassed
    ? `Độ dài ${wordCount} từ, tối ưu tương tác Facebook.`
    : `Độ dài ${wordCount} từ (tối ưu: 250 - 500 từ).`;

  // 4. Paragraph Spacing & Readability (15 points)
  const rawParagraphs = normalized.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  const paragraphCount = rawParagraphs.length;
  const avgWordsPerParagraph = paragraphCount > 0 ? Math.round(wordCount / paragraphCount) : 0;
  const readabilityPassed = (paragraphCount >= 3 && avgWordsPerParagraph <= 75) || (paragraphCount >= 2 && avgWordsPerParagraph <= 120);
  let readabilityPoints = 0;
  if (readabilityPassed) {
    readabilityPoints = 15;
  } else if (paragraphCount >= 2) {
    readabilityPoints = 10;
  } else if (wordCount > 0) {
    readabilityPoints = 5;
  }
  const readabilityFeedback = readabilityPassed
    ? `Bố cục thoáng với ${paragraphCount} đoạn, TB ${avgWordsPerParagraph} từ/đoạn.`
    : `Bài viết có ${paragraphCount} đoạn, khuyến nghị ngắt đoạn thoáng trên mobile.`;

  // 5. Emoji Count 3 - 10 (10 points)
  const emojiMatches = normalized.match(/(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})/gu) || [];
  const emojiCount = emojiMatches.length;
  const emojiPassed = emojiCount >= 3 && emojiCount <= 10;
  const emojiPoints = emojiPassed ? 10 : 0;
  const emojiFeedback = emojiPassed
    ? `Sử dụng ${emojiCount} emoji, tạo điểm nhấn thị giác tốt.`
    : `Cần sử dụng 3 - 10 emoji (hiện tại: ${emojiCount} emoji).`;

  // 6. Comment CTA (10 points)
  const ctaRegex = /(?:bình\s+luận|comment|ý\s+kiến|chia\s+sẻ\s+cảm\s+nghĩ|bạn\s+nghĩ\s+sao|cho\s+(?:mình|em|chúng\s+tôi)\s+biết|để\s+lại\s+(?:câu\s+hỏi|ý\s+kiến|bình\s+luận|cảm\s+nghĩ|comment)|bàn\s+luận|thảo\s+luận|tag\s+(?:người\s+bạn|bạn\s+bè)|bạn\s+đã\s+thử\s+chưa|nhắn\s+tin|inbox|leave\s+a\s+comment|what\s+do\s+you\s+think|share\s+your\s+thoughts|\?)/giu;
  const hasCommentCta = ctaRegex.test(normalized);
  const ctaPoints = hasCommentCta ? 10 : 0;
  const ctaFeedback = hasCommentCta
    ? "Có câu hỏi / CTA kích thích bình luận."
    : "Nên bổ sung câu hỏi hoặc CTA kích thích người đọc để lại ý kiến.";

  const checks: SeoCheckItem[] = [
    {
      id: "hook_entity",
      label: "Từ khóa chính trong 120 ký tự đầu",
      passed: hookEntityPresent,
      points: hookPoints,
      maxPoints: 25,
      feedback: hookFeedback,
    },
    {
      id: "keyword_density",
      label: "Mật độ từ khóa chuẩn (1.0% - 2.5%)",
      passed: densityPassed,
      points: densityPoints,
      maxPoints: 20,
      feedback: densityFeedback,
    },
    {
      id: "post_length",
      label: "Độ dài bài viết tối ưu (250 - 500 từ)",
      passed: lengthPassed,
      points: lengthPoints,
      maxPoints: 20,
      feedback: lengthFeedback,
    },
    {
      id: "readability",
      label: "Độ thông thoáng & ngắt đoạn (<= 50 từ/đoạn, >= 3 đoạn)",
      passed: readabilityPassed,
      points: readabilityPoints,
      maxPoints: 15,
      feedback: readabilityFeedback,
    },
    {
      id: "emoji_count",
      label: "Mật độ Emoji vừa phải (3 - 10 emoji)",
      passed: emojiPassed,
      points: emojiPoints,
      maxPoints: 10,
      feedback: emojiFeedback,
    },
    {
      id: "comment_cta",
      label: "Kêu gọi hành động kích thích bình luận (Comment CTA)",
      passed: hasCommentCta,
      points: ctaPoints,
      maxPoints: 10,
      feedback: ctaFeedback,
    },
  ];

  const totalScore = Math.min(100, checks.reduce((sum, c) => sum + c.points, 0));
  const grade =
    totalScore >= 80
      ? "excellent"
      : totalScore >= 60
      ? "good"
      : totalScore >= 40
      ? "average"
      : "poor";

  return {
    totalScore,
    grade,
    metrics: {
      hookEntityPresent,
      hookCharacterCount: Math.min(normalized.length, 120),
      keywordDensityPercent: density,
      wordCount,
      paragraphCount,
      avgWordsPerParagraph,
      emojiCount,
      hasCommentCta,
    },
    checks,
  };
}
