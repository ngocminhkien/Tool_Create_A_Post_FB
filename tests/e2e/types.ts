/**
 * tests/e2e/types.ts
 * Comprehensive interface contracts and test data types for Facebook Content & Media Studio
 * Matching PROJECT.md § Interface Contracts and ORIGINAL_REQUEST.md § R1-R5.
 */

export type ContentStyleVariation = "storytelling" | "direct_sales" | "news_guide" | "humorous_trend";

export type PolicyCategory =
  | "absolute_claim"
  | "medical_curative"
  | "financial_hype"
  | "phone_spam"
  | "external_link"
  | "body_claim";

export type PolicySeverity = "high" | "medium" | "low";

export interface PolicyViolationItem {
  id: string;
  category: PolicyCategory;
  severity: PolicySeverity;
  matchedText: string;
  startIndex: number;
  endIndex: number;
  label: string;
  explanation: string;
  suggestions: string[];
}

export interface PolicyScanResult {
  isSafe: boolean;
  riskScore: number;
  riskLevel: "safe" | "warning" | "danger";
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
  grade: "excellent" | "good" | "average" | "poor";
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

export interface StylePresetItem {
  id: ContentStyleVariation;
  name: string;
  desc: string;
  icon: string;
}

export interface VariationContentItem {
  style: ContentStyleVariation;
  title: string;
  content: string;
  hook: string;
  createdAt: string;
}

export interface TestResultItem {
  name: string;
  tier: number;
  feature: string;
  passed: boolean;
  durationMs: number;
  error?: string;
}

export interface TestSuiteSummary {
  suiteName: string;
  tier: number;
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
  results: TestResultItem[];
}
