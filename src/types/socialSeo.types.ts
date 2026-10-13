export type ContentStyleVariation =
  | "storytelling"
  | "direct_sales"
  | "news_guide"
  | "humorous_trend";

export type PolicyViolationCategory =
  | "absolute_claim"
  | "medical_curative"
  | "financial_hype"
  | "phone_spam"
  | "external_link"
  | "body_claim";

export type PolicyViolationSeverity = "high" | "medium" | "low";

export interface PolicyViolationItem {
  id: string;
  category: PolicyViolationCategory;
  severity: PolicyViolationSeverity;
  matchedText: string;
  startIndex: number;
  endIndex: number;
  label: string;
  explanation: string;
  suggestions: string[];
}

export type PolicyRiskLevel = "safe" | "warning" | "danger";

export interface PolicyScanResult {
  isSafe: boolean;
  riskScore: number; // 0 - 100
  riskLevel: PolicyRiskLevel;
  violations: PolicyViolationItem[];
}

export interface SeoCheckItem {
  id: string;
  label: string;
  passed: boolean;
  points: number;
  maxPoints: number;
  feedback: string;
}

export type SocialSeoGrade = "excellent" | "good" | "average" | "poor";

export interface SocialSeoMetrics {
  hookEntityPresent: boolean;
  hookCharacterCount: number;
  keywordDensityPercent: number;
  wordCount: number;
  paragraphCount: number;
  avgWordsPerParagraph: number;
  emojiCount: number;
  hasCommentCta: boolean;
}

export interface SocialSeoEvaluation {
  totalScore: number; // 0 - 100
  grade: SocialSeoGrade;
  metrics: SocialSeoMetrics;
  checks: SeoCheckItem[];
}

export type GoldenHourSlotId = "morning" | "noon" | "evening" | "night";

export interface GoldenHourSlot {
  id: GoldenHourSlotId;
  label: string;
  timeRange: string;
  isToday: boolean;
  formattedTarget: string;
  timestamp: string;
  isRecommendedPrime: boolean;
}

export interface ThreeTierHashtags {
  tier1Entity: string[];
  tier2Topic: string[];
  tier3Trend: string[];
  allCombined: string[];
  formattedBlock: string;
}

export interface ImageSeoMetadata {
  altText: string;
  caption: string;
}

export interface ContentStylePreset {
  id: ContentStyleVariation;
  name: string;
  desc: string;
  icon: string;
  promptModifier?: string;
}

export interface ContentVariationItem {
  id: string;
  style: ContentStyleVariation;
  label: string;
  content: string;
  seoScore?: number;
  policySafe?: boolean;
}

export interface PolicyKeywordRule {
  id: string;
  category: PolicyViolationCategory;
  severity: PolicyViolationSeverity;
  pattern: RegExp;
  label: string;
  explanation: string;
  suggestions: string[];
}
