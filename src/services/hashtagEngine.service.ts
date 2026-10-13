import { ThreeTierHashtags } from "@/types/socialSeo.types";

/**
 * Normalizes Vietnamese diacritics to basic Latin characters (NFD decomposition).
 */
export function removeVietnameseDiacritics(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

/**
 * Converts a Vietnamese phrase into a valid PascalCase hashtag string.
 * Example: "Xã Bình Yên" -> "#XaBinhYen"
 */
export function sanitizeToHashtag(input: string): string {
  if (!input || typeof input !== "string") return "";
  const clean = removeVietnameseDiacritics(input);
  const alphanumeric = clean.replace(/[^a-zA-Z0-9\s]/g, " ");
  const words = alphanumeric.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const pascal = words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
  if (pascal.length < 2) return "";
  return `#${pascal}`;
}

interface TopicRule {
  keywords: string[];
  hashtags: string[];
}

const TOPIC_RULES: TopicRule[] = [
  {
    keywords: [
      "bất động sản",
      "bđs",
      "nhà đất",
      "đất nền",
      "quy hoạch",
      "dự án",
      "chung cư",
      "biệt thự",
      "sổ đỏ",
      "thổ cư",
      "đầu tư đất",
    ],
    hashtags: [
      "#BatDongSan",
      "#NhaDat",
      "#DauTuBatDongSan",
      "#QuyHoach",
      "#BatDongSanVenDo",
    ],
  },
  {
    keywords: [
      "du lịch",
      "nghỉ dưỡng",
      "check in",
      "check-in",
      "homestay",
      "resort",
      "khám phá",
      "phượt",
      "điểm đến",
      "trải nghiệm",
    ],
    hashtags: [
      "#DuLich",
      "#DuLichVietNam",
      "#KhamPha",
      "#CheckIn",
      "#TraiNghiem",
    ],
  },
  {
    keywords: [
      "ẩm thực",
      "món ngon",
      "đặc sản",
      "quán ăn",
      "nhà hàng",
      "ăn uống",
      "hương vị",
      "nấu ăn",
    ],
    hashtags: [
      "#AmThuc",
      "#MonNgonMoiNgay",
      "#DacSan",
      "#ReviewAmThuc",
      "#AmThucVietNam",
    ],
  },
  {
    keywords: [
      "kinh doanh",
      "bán hàng",
      "khởi nghiệp",
      "marketing",
      "doanh thu",
      "chiết khấu",
      "khuyến mãi",
      "ưu đãi",
      "giá tốt",
      "sản phẩm",
    ],
    hashtags: [
      "#KinhDoanh",
      "#BanHang",
      "#KhoiNghiep",
      "#KinhDoanhOnline",
      "#UuDaiMoiNgay",
    ],
  },
  {
    keywords: [
      "công nghệ",
      "ai",
      "chuyển đổi số",
      "phần mềm",
      "ứng dụng",
      "thiết bị",
      "thông minh",
      "tự động hóa",
      "dữ liệu",
    ],
    hashtags: [
      "#CongNghe",
      "#ChuyenDoiSo",
      "#AI",
      "#CongNgheMoi",
      "#GiaiPhapSo",
    ],
  },
  {
    keywords: [
      "sức khỏe",
      "làm đẹp",
      "dinh dưỡng",
      "thể thao",
      "chăm sóc",
      "yoga",
      "gym",
      "y tế",
      "sống khỏe",
    ],
    hashtags: [
      "#SucKhoe",
      "#SongKhoe",
      "#LamDep",
      "#DinhDuong",
      "#SucKhoeMoiNgay",
    ],
  },
  {
    keywords: [
      "giáo dục",
      "học tập",
      "kỹ năng",
      "phát triển",
      "đọc sách",
      "tri thức",
      "đào tạo",
      "chia sẻ",
    ],
    hashtags: [
      "#KienThuc",
      "#PhatTrienBanThan",
      "#HocHoiMoiNgay",
      "#KyNang",
      "#GiaoDuc",
    ],
  },
  {
    keywords: [
      "tin tức",
      "đời sống",
      "thời sự",
      "thông báo",
      "dân sinh",
      "nông thôn",
      "phát triển",
      "xã hội",
    ],
    hashtags: [
      "#TinTuc",
      "#DoiSong",
      "#TinNong",
      "#ThoiSu",
      "#CapNhatMoiNhat",
    ],
  },
];

const VIRAL_TREND_HASHTAGS = [
  "#Trending",
  "#Viral",
  "#FacebookReels",
  "#KhamPha",
  "#GocNhin",
  "#ChiaSeGiaTri",
  "#CongDong",
  "#Review",
  "#HotNews",
  "#LanToaYeuThuong",
];

const VIETNAMESE_ADMIN_PREFIXES = /^(xã|phường|thị trấn|quận|huyện|thị xã|tỉnh|thành phố|tp)\s+/i;

function extractEntityTier(title: string, entity?: string): string[] {
  const result: string[] = [];

  if (entity && entity.trim().length > 0) {
    const rawEntity = entity.trim();
    const fullTag = sanitizeToHashtag(rawEntity);
    if (fullTag) result.push(fullTag);

    const stripped = rawEntity.replace(VIETNAMESE_ADMIN_PREFIXES, "").trim();
    if (stripped && stripped !== rawEntity) {
      const strippedTag = sanitizeToHashtag(stripped);
      if (strippedTag && !result.includes(strippedTag)) {
        result.push(strippedTag);
      }
    }

    const parts = rawEntity.split(/[,-]/).map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      for (const part of parts) {
        const partTag = sanitizeToHashtag(part.replace(VIETNAMESE_ADMIN_PREFIXES, "").trim());
        if (partTag && !result.includes(partTag)) {
          result.push(partTag);
        }
      }
    }
  } else {
    const words = title.split(/\s+/).filter(Boolean);
    const capitalizedWords = words.filter((w) =>
      /^[A-ZÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬĐÈÉẺẼẸÊẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸỴ]/.test(w)
    );
    if (capitalizedWords.length >= 2) {
      const titleEntity = sanitizeToHashtag(capitalizedWords.slice(0, 3).join(" "));
      if (titleEntity) result.push(titleEntity);
    }
    if (result.length === 0) {
      const fallbackTag = sanitizeToHashtag(title.slice(0, 30));
      if (fallbackTag) result.push(fallbackTag);
    }
  }

  return Array.from(new Set(result)).slice(0, 4);
}

function extractTopicTier(title: string, content?: string): string[] {
  const fullText = `${title} ${content || ""}`.toLowerCase();
  const matchedTags: string[] = [];

  for (const rule of TOPIC_RULES) {
    const matchCount = rule.keywords.filter((kw) => fullText.includes(kw.toLowerCase())).length;
    if (matchCount > 0) {
      matchedTags.push(...rule.hashtags.slice(0, 3));
    }
  }

  const cleanTitleWords = removeVietnameseDiacritics(title)
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(
      (w) =>
        w.length >= 3 &&
        !["cho", "voi", "cua", "cac", "nhung", "mot", "trong"].includes(w.toLowerCase())
    );
  if (cleanTitleWords.length >= 2) {
    const customTitleTag = sanitizeToHashtag(cleanTitleWords.slice(0, 3).join(" "));
    if (customTitleTag) matchedTags.unshift(customTitleTag);
  }

  if (matchedTags.length === 0) {
    matchedTags.push("#TinTuc", "#DoiSong", "#ChiaSe");
  }

  return Array.from(new Set(matchedTags)).slice(0, 5);
}

function extractTrendTier(title: string, content?: string): string[] {
  const fullText = `${title} ${content || ""}`.toLowerCase();
  const trendTags: string[] = [];

  if (
    fullText.includes("bất động sản") ||
    fullText.includes("đất") ||
    fullText.includes("quy hoạch")
  ) {
    trendTags.push("#XuHuongDauTu", "#CoHoiDauTu");
  }
  if (fullText.includes("du lịch") || fullText.includes("check in")) {
    trendTags.push("#ThichDiChuyen", "#CheckInVietNam");
  }
  if (fullText.includes("kinh doanh") || fullText.includes("bán hàng")) {
    trendTags.push("#KienThucKinhDoanh", "#BaoGiaMoiNhat");
  }

  for (const tag of VIRAL_TREND_HASHTAGS) {
    if (!trendTags.includes(tag)) {
      trendTags.push(tag);
    }
    if (trendTags.length >= 5) break;
  }

  return trendTags.slice(0, 5);
}

/**
 * Generates structured 3-tier hashtags according to Facebook Social SEO model:
 * Tier 1: Entity / Brand (#Entity #BrandName)
 * Tier 2: Topic / Industry (#Topic #Industry)
 * Tier 3: Trend / Community (#Trend #Community)
 */
export function generateThreeTierHashtags(
  title: string,
  entity?: string,
  content?: string
): ThreeTierHashtags {
  const safeTitle = (title || "").trim();
  const tier1Entity = extractEntityTier(safeTitle, entity);
  const tier2Topic = extractTopicTier(safeTitle, content);
  const tier3Trend = extractTrendTier(safeTitle, content);

  const allSet = new Set<string>();
  for (const tag of [...tier1Entity, ...tier2Topic, ...tier3Trend]) {
    if (tag && tag.startsWith("#")) {
      allSet.add(tag);
    }
  }
  const allCombined = Array.from(allSet);
  const formattedBlock = allCombined.join(" ");

  return {
    tier1Entity,
    tier2Topic,
    tier3Trend,
    allCombined,
    formattedBlock,
  };
}

/**
 * Formats 3-tier hashtags into a categorized visual block for Facebook post footer.
 */
export function formatHashtagsCategorized(hashtags: ThreeTierHashtags): string {
  const lines: string[] = [];
  if (hashtags.tier1Entity.length > 0) {
    lines.push(`🏷️ ${hashtags.tier1Entity.join(" ")}`);
  }
  if (hashtags.tier2Topic.length > 0) {
    lines.push(`📌 ${hashtags.tier2Topic.join(" ")}`);
  }
  if (hashtags.tier3Trend.length > 0) {
    lines.push(`🔥 ${hashtags.tier3Trend.join(" ")}`);
  }
  return lines.join("\n");
}

/**
 * Appends hashtags to the end of post content separated by blank line
 */
export function appendHashtags(content: string, hashtags: string[]): string {
  const safeContent = (content || "").trim();
  const tagsStr = hashtags.join(" ");
  if (!safeContent) return tagsStr;
  return `${safeContent}\n\n${tagsStr}`;
}
