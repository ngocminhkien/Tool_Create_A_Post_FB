/**
 * src/types/sourcePost.types.ts
 * Type definitions for Requirement R2: Source Posts, Deduplication & Evergreen Fallback.
 */

export type SourcePostStatus =
  | "collected"
  | "rewritten"
  | "ignored"
  | "evergreen_repurposed";

export interface SourcePostItem {
  id: string;
  sourcePageId: string;
  facebookPostId: string;
  contentHash: string; // SHA-256 of normalized content
  originalContent: string;
  mediaUrls: string[]; // local web paths e.g. ["/uploads/source_media/spost_123_0_ab12cd.jpg"]
  originalMediaUrls?: string[];
  postUrl?: string;
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

export interface DeduplicationCheckResult {
  isDuplicate: boolean;
  duplicateLayer?: "post_id" | "content_hash";
  existingId?: string;
}

export interface SourcePostsApiResponse {
  success: boolean;
  posts?: SourcePostItem[];
  result?: CollectPostsResult;
  candidates?: EvergreenCandidate[];
  post?: SourcePostItem | null;
  error?: string;
  message?: string;
}

export type ModerationStatus =
  | "pending"
  | "approved"
  | "published"
  | "scheduled"
  | "rejected";

export interface ModerationQueueItem {
  id: string;
  sourcePostId?: string;
  sourcePageId?: string;
  sourcePageName: string;
  sourceUrl?: string;
  sourcePublishedTime?: string;
  sourceContent: string;
  sourceImages: string[];
  targetPageId?: string;
  targetPageName?: string;
  aiHeadline: string;
  aiHook: string;
  aiBody: string;
  aiConclusion?: string;
  aiFullPost: string;
  contentStyle: string;
  selectedImages: string[];
  altText?: string;
  imageCaption?: string;
  seoScore: number;
  seoBreakdown?: string;
  policyStatus: "clean" | "warning" | "violation";
  policyWarnings: string[];
  hashtags: string[];
  originalWordCount?: number;
  repurposedWordCount?: number;
  compressionRate?: number;
  extractedPoints?: string[];
  status: ModerationStatus;
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

export interface ModerationApiResponse {
  success: boolean;
  items?: ModerationQueueItem[];
  item?: ModerationQueueItem;
  stats?: {
    pending: number;
    approved: number;
    published: number;
    scheduled: number;
    rejected: number;
    total: number;
  };
  error?: string;
  message?: string;
}

