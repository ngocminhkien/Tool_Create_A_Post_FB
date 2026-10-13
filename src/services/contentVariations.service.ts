import { ContentStyleVariation } from "@/types/socialSeo.types";

export interface StylePresetDetail {
  id: ContentStyleVariation;
  name: string;
  desc: string;
  icon: string;
  targetAudience: string;
  guidelines: string[];
}

export const CONTENT_STYLE_PRESETS: Record<ContentStyleVariation, StylePresetDetail> = {
  storytelling: {
    id: "storytelling",
    name: "Storytelling / Cảm xúc",
    desc: "Dẫn dắt bằng câu chuyện chạm cảm xúc, góc nhìn nhân vật hoặc kỷ niệm gắn liền địa phương, tạo sự đồng cảm sâu sắc trước khi truyền tải thông điệp.",
    icon: "Heart",
    targetAudience:
      "Độc giả thích đọc chậm, yêu thích văn hóa, hoài niệm, câu chuyện người thật việc thật.",
    guidelines: [
      "Mở đầu bằng khoảnh khắc đời thường, ký ức hoặc một góc nhìn nhân vật cụ thể.",
      "Giọng văn chân thành, ấm áp, sâu lắng, gợi cảm xúc và hình ảnh sống động.",
      "Lồng ghép thực thể (Entity) một cách tự nhiên vào mạch cảm xúc.",
      "Kết bài bằng lời suy ngẫm chân tình và câu hỏi mở kích thích độc giả chia sẻ trải nghiệm.",
    ],
  },
  direct_sales: {
    id: "direct_sales",
    name: "Bán hàng / Trực diện",
    desc: "Đánh thẳng vào nỗi đau khách hàng, nêu bật giải pháp vượt trội, cam kết uy tín và Call To Action (CTA) thúc đẩy inbox/chốt đơn nhanh chóng.",
    icon: "Target",
    targetAudience:
      "Khách hàng có nhu cầu mua sắm, nhà đầu tư tìm kiếm cơ hội rõ ràng, người thích thông tin thẳng thắn.",
    guidelines: [
      "Triển khai cấu trúc PAS (Problem - Agitate - Solution - Action) chuyển đổi cao.",
      "Nêu bật USP (Unique Selling Proposition), giá trị nhận được và lý do cần hành động ngay.",
      "Tuân thủ chính sách Meta: Tuyệt đối không cam kết 100%, không trị dứt điểm, không số điện thoại thô thiển.",
      "CTA dứt khoát: Kêu gọi bình luận hoặc nhắn tin Fanpage để nhận tư vấn chi tiết.",
    ],
  },
  news_guide: {
    id: "news_guide",
    name: "Tin tức / Cẩm nang chia sẻ",
    desc: "Định dạng tin tức thời sự khách quan hoặc cẩm nang bí quyết chia sẻ giá trị thực tế, số liệu rõ ràng, bullet points dễ theo dõi.",
    icon: "Newspaper",
    targetAudience:
      "Độc giả tìm kiếm kiến thức chuyên sâu, thông tin quy hoạch, bí quyết hữu ích.",
    guidelines: [
      "Giọng văn chuyên gia, chuẩn mực, khách quan, đáng tin cậy.",
      "Tối ưu Social SEO: Nêu bật Thực thể (Entity) ngay trong 120 ký tự đầu tiên.",
      "Trình bày dạng cẩm nang hoặc điểm tin với gạch đầu dòng và số liệu cụ thể.",
      "CTA kêu gọi độc giả lưu lại bài viết (Save post) hoặc chia sẻ cho người thân.",
    ],
  },
  humorous_trend: {
    id: "humorous_trend",
    name: "Hài hước / Bắt trend",
    desc: "Bắt trend mạng xã hội dí dỏm, phong cách trẻ trung năng động, nhiều meme vibe kích thích tag bạn bè và thảo luận sôi nổi.",
    icon: "Sparkles",
    targetAudience:
      "Giới trẻ, dân văn phòng, cộng đồng mạng thích nội dung giải trí viral.",
    guidelines: [
      "Mở đầu bằng cú twist bất ngờ hoặc câu nói bắt trend mạng xã hội hiện hành.",
      "Sử dụng emoji sinh động, biểu cảm, không khí vui tươi, hóm hỉnh.",
      "Vẫn giữ vững thông điệp cốt lõi và giá trị thực tế, không bị quá đà hay phản cảm.",
      "CTA kích thích người đọc tag hội bạn thân vào bình luận cùng bàn tán.",
    ],
  },
};

/**
 * Returns specialized system prompt instructions for a selected content style variation.
 */
export function getStylePrompt(style: ContentStyleVariation): string {
  const preset = CONTENT_STYLE_PRESETS[style] || CONTENT_STYLE_PRESETS.storytelling;
  return `[PHONG CÁCH VIẾT BÀI: ${preset.name.toUpperCase()}]
${preset.desc}

Nguyên tắc triển khai:
${preset.guidelines.map((g, i) => `${i + 1}. ${g}`).join("\n")}`;
}

/**
 * Returns all available content style presets for UI selection.
 */
export function getAllStylePresets(): Array<{
  id: ContentStyleVariation;
  name: string;
  desc: string;
  icon: string;
}> {
  return (Object.keys(CONTENT_STYLE_PRESETS) as ContentStyleVariation[]).map((key) => {
    const item = CONTENT_STYLE_PRESETS[key];
    return {
      id: item.id,
      name: item.name,
      desc: item.desc,
      icon: item.icon,
    };
  });
}

/**
 * Retrieves full details of a specific style preset.
 */
export function getStylePreset(style: ContentStyleVariation): StylePresetDetail {
  return CONTENT_STYLE_PRESETS[style] || CONTENT_STYLE_PRESETS.storytelling;
}

/**
 * Builds a prompt to rewrite an existing Facebook post into an alternative style variation.
 */
export function buildMultiStylePrompt(
  baseContent: string,
  targetStyle: ContentStyleVariation,
  topicTitle?: string,
  entity?: string
): string {
  const preset = getStylePreset(targetStyle);
  return `Bạn là chuyên gia chuyển đổi nội dung Facebook đa biến thể (A/B Content Variation Expert).
Hãy viết lại bài viết Facebook dưới đây sang phong cách "${preset.name}".

${topicTitle ? `Chủ đề bài viết: "${topicTitle}"` : ""}
${entity ? `Thực thể trọng tâm: "${entity}"` : ""}

[BÀI VIẾT GỐC]:
"""
${baseContent.trim()}
"""

[YÊU CẦU CHUYỂN ĐỔI SANG PHONG CÁCH ${preset.name.toUpperCase()}]:
${preset.guidelines.map((g, i) => `- ${g}`).join("\n")}

LƯU Ý QUAN TRỌNG:
- Giữ nguyên các thông tin thực tế, số liệu và câu chuyện chính.
- Thay đổi cấu trúc mở bài, giọng điệu, cách diễn đạt và lời kêu gọi hành động cho đúng với phong cách mới.
- Đảm bảo tuân thủ chính sách Facebook (không cam kết 100%, không số điện thoại thô).
- Chỉ trả về nội dung bài viết mới hoàn chỉnh, không kèm lời giải thích bên ngoài.`;
}
