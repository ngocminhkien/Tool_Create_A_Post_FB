import {
  PolicyViolationItem,
  PolicyScanResult,
} from "@/types/socialSeo.types";

interface InternalRule {
  category: PolicyViolationItem["category"];
  severity: PolicyViolationItem["severity"];
  label: string;
  explanation: string;
  pattern: RegExp;
  suggestions: string[];
}

/**
 * Full dictionary of Facebook & Meta policy restrictions:
 * 1. absolute_claim: 100% guarantees, permanent promises, no side effects
 * 2. medical_curative: curative claims, miracle cures, specialized disease treatments
 * 3. financial_hype: get rich quick, double assets, guaranteed profit
 * 4. phone_spam: public phone numbers triggering spam classification
 * 5. external_link: off-platform links reducing reach / shadowban triggers
 * 6. body_claim: body shaming, rapid weight loss, before-and-after comparisons
 */
const POLICY_RULES: InternalRule[] = [
  // 1. absolute_claim (High / Medium)
  {
    category: "absolute_claim",
    severity: "high",
    label: "Cam kết 100% / Tuyên bố tuyệt đối",
    explanation:
      "Meta nghiêm cấm các tuyên bố cam kết 100%, bảo đảm hoàn tiền tuyệt đối không có căn cứ vì dễ bị xếp vào diện phóng đại, lừa dối người dùng.",
    pattern:
      /(?<![\p{L}\p{N}])(?:cam\s+kết\s+100%|bảo\s+đảm\s+100%|chắc\s+chắn\s+100%|hoàn\s+tiền\s+100%|hiệu\s+quả\s+100%|an\s+toàn\s+100%|thành\s+công\s+100%|100%\s+(?:hiệu\s+quả|an\s+toàn|thành\s+công|hài\s+lòng|tự\s+nhiên)|cam\s+kết\s+100|hoàn\s+tiền\s+100)(?![\p{L}\p{N}])/giu,
    suggestions: [
      "hỗ trợ tối ưu",
      "cam kết đồng hành",
      "an tâm trải nghiệm",
      "chính sách hỗ trợ chu đáo",
    ],
  },
  {
    category: "absolute_claim",
    severity: "medium",
    label: "Tuyên bố vĩnh viễn / Hiệu quả tức thì",
    explanation:
      "Từ ngữ khẳng định kết quả vĩnh viễn, lập tức sau 1 lần hoặc không tái phát dễ kích hoạt thuật toán hạn chế phân phối.",
    pattern:
      /(?<![\p{L}\p{N}])(?:vĩnh\s+viễn|tuyệt\s+đối|hiệu\s+quả\s+(?:ngay\s+tức\s+thì|tức\s+thì|sau\s+1\s+lần)|tác\s+dụng\s+ngay\s+lập\s+tức|không\s+(?:tái\s+phát|tác\s+dụng\s+phụ|đau\s+đớn)|số\s+1\s+(?:việt\s+nam|thế\s+giới|thị\s+trường)|độc\s+nhất\s+vô\s+nhị)(?![\p{L}\p{N}])/giu,
    suggestions: [
      "duy trì lâu dài",
      "kết quả cải thiện rõ rệt",
      "êm dịu lành tính",
      "thương hiệu uy tín được tin chọn",
    ],
  },

  // 2. medical_curative (High)
  {
    category: "medical_curative",
    severity: "high",
    label: "Từ ngữ y tế / Chữa dứt điểm",
    explanation:
      "Meta cấm các bài viết sử dụng từ ngữ khẳng định chữa khỏi hoàn toàn, trị dứt điểm, thần dược hoặc thuốc đặc trị khi không được cấp phép y tế.",
    pattern:
      /(?<![\p{L}\p{N}])(?:trị\s+dứt\s+điểm|chữa\s+dứt\s+điểm|khỏi\s+hẳn|chữa\s+khỏi|đặc\s+trị|thuốc\s+(?:trị|chữa|đặc\s+trị)|thần\s+dược|chữa\s+trị\s+tận\s+gốc|trị\s+tận\s+gốc|đánh\s+bay\s+(?:bệnh|mụn|nám|tàn\s+nhang)|tiêu\s+diệt\s+hoàn\s+toàn)(?![\p{L}\p{N}])/giu,
    suggestions: [
      "hỗ trợ cải thiện",
      "chăm sóc chuyên sâu",
      "giải pháp hỗ trợ phục hồi",
      "đồng hành thuyên giảm",
    ],
  },

  // 3. financial_hype (High)
  {
    category: "financial_hype",
    severity: "high",
    label: "Thổi phồng tài chính / Làm giàu nhanh",
    explanation:
      "Chính sách Facebook ngăn chặn nội dung hứa hẹn làm giàu nhanh chóng, thu nhập thụ động khủng, cam kết lợi nhuận để phòng ngừa gian lận tài chính.",
    pattern:
      /(?<![\p{L}\p{N}])(?:kiếm\s+tiền\s+tại\s+nhà|làm\s+giàu\s+nhanh|thu\s+nhập\s+thụ\s+động(?:\s+khủng|\s+\d+)?|lãi\s+suất\s+khủng|cam\s+kết\s+lợi\s+nhuận|nhân\s+đôi\s+tài\s+sản|x[2-9]\s+(?:tài\s+khoản|tài\s+sản|vốn)|x10\s+(?:tài\s+khoản|tài\s+sản|vốn)|đầu\s+tư\s+bao\s+lỗ|bao\s+lỗ|không\s+rủi\s+ro|việc\s+nhẹ\s+lương\s+cao|vốn\s+0\s+đồng)(?![\p{L}\p{N}])/giu,
    suggestions: [
      "cơ hội gia tăng thu nhập",
      "xây dựng tài chính bền vững",
      "kế hoạch đầu tư bài bản",
      "môi trường làm việc linh hoạt",
    ],
  },

  // 4. phone_spam (Medium)
  {
    category: "phone_spam",
    severity: "medium",
    label: "Số điện thoại trong bài viết",
    explanation:
      "Chèn số điện thoại trực tiếp vào nội dung bài viết khiến thuật toán Facebook nhận diện là bài bán hàng spam lộ liễu, làm giảm mạnh reach tự nhiên.",
    pattern:
      /(?:(?<![\p{L}\p{N}])(?:hotline|sđt|sdt|zalo|liên\s+hệ|lh|tel)\s*[:：\-\s]*)?(?<![\p{L}\p{N}])(?:\+?84[.\-\s]?|0)(?:3[2-9]|5[25689]|7[06-9]|8[1-9]|9\d)(?:[.\-\s]?\d){7}(?![\p{L}\p{N}])/giu,
    suggestions: [
      "inbox fanpage",
      "nhắn tin trực tiếp cho shop",
      "để lại tin nhắn tư vấn",
      "liên hệ qua tin nhắn",
    ],
  },

  // 5. external_link (Medium)
  {
    category: "external_link",
    severity: "medium",
    label: "Liên kết ngoài / Link rút gọn spam",
    explanation:
      "Thuật toán Facebook bóp tương tác nặng nề (40-70%) đối với bài viết chứa liên kết ngoài nhằm giữ chân người dùng ở lại trên ứng dụng.",
    pattern:
      /(?:https?:\/\/(?:www\.)?(?:bit\.ly|tinyurl\.com|t\.me|zalo\.me|shorturl\.at|cutt\.ly|goo\.gl|fb\.me)\/[^\s]+|(?<![\p{L}\p{N}])(?:bit\.ly|tinyurl\.com|t\.me|zalo\.me|shorturl\.at|cutt\.ly)\/[^\s]+|https?:\/\/[^\s]+)/giu,
    suggestions: [
      "xem link dưới phần bình luận",
      "nhắn tin để nhận link chi tiết",
      "truy cập liên kết trong bio",
    ],
  },

  // 6. body_claim (Medium)
  {
    category: "body_claim",
    severity: "medium",
    label: "Thuộc tính cơ thể / Before & After",
    explanation:
      "Chính sách Meta cấm các nội dung miêu tả khiếm khuyết cơ thể gây tự ti, phẫu thuật cấp tốc hoặc so sánh hình thể trước - sau.",
    pattern:
      /(?<![\p{L}\p{N}])(?:giảm\s+cân\s+cấp\s+tốc|hút\s+mỡ(?:\s+bụng|\s+thừa)?|tăng\s+vòng\s+1|tăng\s+kích\s+thước|lột\s+xác\s+sau\s+\d+\s+ngày|trước\s+và\s+sau(?:\s+khi)?|before\s*\/\s*after|béo\s+bụng|mỡ\s+thừa|thon\s+gọn\s+(?:ngay\s+sau\s+1\s+lần|cấp\s+tốc)|trắng\s+da\s+cấp\s+tốc)(?![\p{L}\p{N}])/giu,
    suggestions: [
      "lộ trình vóc dáng thon gọn an toàn",
      "chăm sóc vóc dáng chuyên sâu",
      "hành trình thay đổi tích cực",
      "cải thiện số đo vòng eo",
    ],
  },
];

/**
 * Scans Facebook post text for policy violations and shadowban risks.
 * Uses Unicode NFC normalization for 100% Vietnamese character accuracy.
 */
export function scanFacebookPolicy(text: string): PolicyScanResult {
  const normalized = (text || "").normalize("NFC");
  const violations: PolicyViolationItem[] = [];
  let violationIndex = 0;

  for (const rule of POLICY_RULES) {
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(normalized)) !== null) {
      const matchedText = match[0];
      const startIndex = match.index;
      const endIndex = startIndex + matchedText.length;

      // Prevent overlapping with existing match spans
      const isOverlapping = violations.some(
        (v) =>
          (startIndex >= v.startIndex && startIndex < v.endIndex) ||
          (endIndex > v.startIndex && endIndex <= v.endIndex) ||
          (startIndex <= v.startIndex && endIndex >= v.endIndex)
      );

      if (!isOverlapping) {
        violationIndex++;
        violations.push({
          id: `violation_${violationIndex}_${rule.category}`,
          category: rule.category,
          severity: rule.severity,
          matchedText,
          startIndex,
          endIndex,
          label: rule.label,
          explanation: rule.explanation,
          suggestions: rule.suggestions,
        });
      }
    }
  }

  // Sort violations in order of appearance
  violations.sort((a, b) => a.startIndex - b.startIndex);

  // Calculate weighted risk score: High=40, Medium=20, Low=10
  let rawRisk = 0;
  for (const v of violations) {
    if (v.severity === "high") rawRisk += 40;
    else if (v.severity === "medium") rawRisk += 20;
    else rawRisk += 10;
  }

  const riskScore = Math.min(100, rawRisk);
  const isSafe = violations.length === 0;
  const riskLevel = isSafe ? "safe" : riskScore >= 40 ? "danger" : "warning";

  return {
    isSafe,
    riskScore,
    riskLevel,
    violations,
  };
}

/**
 * Replaces a specific policy violation with a safe suggested keyword.
 */
export function applyPolicyFix(
  text: string,
  violationId: string,
  suggestion: string
): string {
  if (!text) return text;
  const scan = scanFacebookPolicy(text);
  const violation = scan.violations.find(
    (v) =>
      v.id === violationId ||
      v.matchedText.toLowerCase() === violationId.toLowerCase()
  );

  if (!violation) {
    return text;
  }

  const normalized = text.normalize("NFC");
  return (
    normalized.slice(0, violation.startIndex) +
    suggestion +
    normalized.slice(violation.endIndex)
  );
}

/**
 * 1-Click auto-sanitizes all detected violations using the primary safe suggestion.
 * Replaces in descending order of startIndex to preserve exact string offsets.
 */
export function autoSanitizeAll(text: string): string {
  if (!text) return text;
  const scan = scanFacebookPolicy(text);
  if (scan.violations.length === 0) return text;

  // Sort descending by startIndex to maintain valid slice indices
  const sorted = [...scan.violations].sort((a, b) => b.startIndex - a.startIndex);
  let result = text.normalize("NFC");

  for (const v of sorted) {
    const replacement = v.suggestions[0] || "";
    result =
      result.slice(0, v.startIndex) +
      replacement +
      result.slice(v.endIndex);
  }

  return result;
}
