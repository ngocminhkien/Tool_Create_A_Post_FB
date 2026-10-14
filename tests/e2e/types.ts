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

// ==========================================
// R1: Bounded Context Page Models & Contracts
// ==========================================
export type SourcePageInputMode = "url_scrape" | "graph_api";
export type PageStatus = "active" | "paused" | "error" | "token_expired";

export interface TargetPageItem {
  id: string;
  pageId: string;
  pageName: string;
  accessToken: string;
  avatarUrl?: string;
  isDefault: boolean;
  status: PageStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SourcePageItem {
  id: string;
  name: string;
  url: string;
  pageId?: string;
  inputMode: SourcePageInputMode;
  accessToken?: string;
  avatarUrl?: string;
  scanPostLimit: number; // 1 to 10, default 5
  status: PageStatus;
  lastScannedAt?: string;
  lastError?: string;
  totalPostsScanned: number;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// R2: Post Collection & Deduplication Contracts
// ==========================================
export type SourcePostStatus = "collected" | "rewritten" | "ignored" | "evergreen_repurposed";

export interface SourcePostItem {
  id: string;
  sourcePageId: string;
  facebookPostId: string;
  contentHash: string; // SHA-256 of normalized content
  originalContent: string;
  mediaUrls: string[]; // local paths e.g. ["/uploads/source_media/spost_123_0.jpg"]
  originalMediaUrls?: string[];
  publishedTime: string; // ISO 8601
  likeCount: number;
  commentCount: number;
  shareCount: number;
  status: SourcePostStatus;
  collectedAt: string;
  evergreenSelectedAt?: string;
  rewrittenAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CollectPostsOptions {
  sourcePageId: string;
  limit?: number; // 1 to 10, default 5
  forceRefresh?: boolean;
}

export interface CollectPostsResult {
  success: boolean;
  sourcePageId: string;
  totalScanned: number;
  newCollected: number;
  duplicatesSkipped: number;
  allAlreadyCollected: boolean;
  message: string;
  posts: SourcePostItem[];
  evergreenSuggestion?: SourcePostItem | null;
}

export interface EvergreenCandidate {
  post: SourcePostItem;
  ageDays: number;
  engagementScore: number;
}

// ==========================================
// R3 & R4: Repurposing & Moderation Contracts
// ==========================================
export type QueueItemStatus = "pending" | "approved" | "scheduled" | "published" | "rejected";

export interface ModerationQueueItem {
  id: string;
  sourcePostId: string;
  sourcePageId: string;
  sourcePageName: string;
  sourceUrl?: string;
  sourcePublishedTime?: string;
  sourceContent: string;
  sourceImages: string[];
  targetPageId: string;
  targetPageName: string;
  aiHeadline: string;
  aiHook: string;
  aiBody: string;
  aiFullPost: string;
  contentStyle: ContentStyleVariation;
  selectedImages: string[];
  altText?: string;
  imageCaption?: string;
  seoScore: number;
  seoBreakdown?: SocialSeoEvaluation;
  policyStatus: "clean" | "warning" | "danger";
  policyWarnings: PolicyScanResult["violations"];
  hashtags: string[];
  status: QueueItemStatus;
  scheduledAt?: string;
  publishedAt?: string;
  fbPostId?: string;
  fbPostUrl?: string;
  errorMessage?: string;
  rewriteCount: number;
  lastRewritePrompt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RepurposeRewriteRequest {
  sourcePostId: string;
  sourcePageName: string;
  sourceContent: string;
  sourceImages?: string[];
  sourceUrl?: string;
  sourcePublishedTime?: string;
  targetPageId?: string;
  targetPageName?: string;
  style?: ContentStyleVariation;
  customInstruction?: string;
  isEvergreen?: boolean;
}

export interface RepurposeRewriteResponse {
  queueItem: ModerationQueueItem;
  usedKeyMasked: string;
  model: string;
}

export interface AttachedMediaItem {
  media_fbid: string;
}

export interface PublishMediaPostPayload {
  targetPageId: string;
  message: string;
  selectedImages: string[];
  scheduledPublishTime?: number;
}

