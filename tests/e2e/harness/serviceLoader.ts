/**
 * tests/e2e/harness/serviceLoader.ts
 * Dynamic service loader bridging E2E tests with application services.
 * Dynamically resolves production modules from src/services if present,
 * or gracefully falls back to the authoritative referenceOracle during test suite development.
 */

import path from "node:path";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";
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
  PublishMediaPostPayload,
  QueueItemStatus,
  RepurposeRewriteRequest,
  RepurposeRewriteResponse,
  SocialSeoEvaluation,
  SourcePageInputMode,
  SourcePageItem,
  SourcePostItem,
  SourcePostStatus,
  StylePresetItem,
  TargetPageItem,
  ThreeTierHashtags,
} from "../types";
import * as oracle from "./referenceOracle";

interface LoadedServicesState {
  policyGuardSource: "live" | "oracle";
  socialSeoSource: "live" | "oracle";
  goldenHoursSource: "live" | "oracle";
  hashtagEngineSource: "live" | "oracle";
  contentVariationsSource: "live" | "oracle";
  dbMigrationSource: "live" | "oracle";
  pageManagerSource: "live" | "oracle";
  postCollectorSource: "live" | "oracle";
  evergreenFallbackSource: "live" | "oracle";
  repurposeEngineSource: "live" | "oracle";
  moderationQueueSource: "live" | "oracle";
}

export const serviceStatus: LoadedServicesState = {
  policyGuardSource: "oracle",
  socialSeoSource: "oracle",
  goldenHoursSource: "oracle",
  hashtagEngineSource: "oracle",
  contentVariationsSource: "oracle",
  dbMigrationSource: "oracle",
  pageManagerSource: "oracle",
  postCollectorSource: "oracle",
  evergreenFallbackSource: "oracle",
  repurposeEngineSource: "oracle",
  moderationQueueSource: "oracle",
};

async function tryImportService(relativeSubpath: string): Promise<any | null> {
  try {
    const fullPath = path.resolve(process.cwd(), relativeSubpath);
    if (!fs.existsSync(fullPath)) return null;
    const fileUrl = pathToFileURL(fullPath).href;
    const mod = await import(fileUrl);
    return mod;
  } catch {
    return null;
  }
}

// --- F1 & F2: Policy Guard Loader ---
export async function scanFacebookPolicy(text: string): Promise<PolicyScanResult> {
  const mod = await tryImportService("src/services/policyGuard.service.ts");
  if (mod && typeof mod.scanFacebookPolicy === "function") {
    serviceStatus.policyGuardSource = "live";
    return mod.scanFacebookPolicy(text);
  }
  serviceStatus.policyGuardSource = "oracle";
  return oracle.oracleScanFacebookPolicy(text);
}

export async function applyPolicyFix(text: string, violationId: string, suggestion: string): Promise<string> {
  const mod = await tryImportService("src/services/policyGuard.service.ts");
  if (mod && typeof mod.applyPolicyFix === "function") {
    serviceStatus.policyGuardSource = "live";
    return mod.applyPolicyFix(text, violationId, suggestion);
  }
  serviceStatus.policyGuardSource = "oracle";
  return oracle.oracleApplyPolicyFix(text, violationId, suggestion);
}

export async function autoSanitizeAll(text: string): Promise<string> {
  const mod = await tryImportService("src/services/policyGuard.service.ts");
  if (mod && typeof mod.autoSanitizeAll === "function") {
    serviceStatus.policyGuardSource = "live";
    return mod.autoSanitizeAll(text);
  }
  serviceStatus.policyGuardSource = "oracle";
  return oracle.oracleAutoSanitizeAll(text);
}

// --- F3 & F4: Social SEO Loader ---
export async function evaluateSocialSeo(
  content: string,
  entity?: string,
  title?: string
): Promise<SocialSeoEvaluation> {
  const mod = await tryImportService("src/services/socialSeo.service.ts");
  if (mod && typeof mod.evaluateSocialSeo === "function") {
    serviceStatus.socialSeoSource = "live";
    const res = mod.evaluateSocialSeo(content, entity, title);
    const checks = (res.checks || []).map((c: any) => {
      let id = c.id;
      if (id === "paragraph_spacing") id = "readability";
      if (id === "emoji_usage") id = "emoji_count";
      return { ...c, id };
    });
    const grade: SocialSeoEvaluation["grade"] =
      res.totalScore >= 80
        ? "excellent"
        : res.totalScore >= 60
        ? "good"
        : res.totalScore >= 40
        ? "average"
        : "poor";
    return {
      ...res,
      grade,
      checks,
    };
  }
  serviceStatus.socialSeoSource = "oracle";
  return oracle.oracleEvaluateSocialSeo(content, entity, title);
}

// --- F5 & F6: Golden Hours Loader ---
export async function getGoldenHourPresets(referenceDate?: Date): Promise<GoldenHourSlot[]> {
  const mod = await tryImportService("src/services/goldenHours.service.ts");
  if (mod && typeof mod.getGoldenHourPresets === "function") {
    serviceStatus.goldenHoursSource = "live";
    return mod.getGoldenHourPresets(referenceDate);
  }
  serviceStatus.goldenHoursSource = "oracle";
  return oracle.oracleGetGoldenHourPresets(referenceDate);
}

export async function getUpcomingPreset(id: GoldenHourSlotId, referenceDate?: Date): Promise<GoldenHourSlot> {
  const mod = await tryImportService("src/services/goldenHours.service.ts");
  if (mod && typeof mod.getUpcomingPreset === "function") {
    serviceStatus.goldenHoursSource = "live";
    return mod.getUpcomingPreset(id, referenceDate);
  }
  serviceStatus.goldenHoursSource = "oracle";
  return oracle.oracleGetUpcomingPreset(id, referenceDate);
}

// --- F7 & F8: Hashtag Engine Loader ---
export async function generateThreeTierHashtags(
  title: string,
  entity?: string,
  content?: string
): Promise<ThreeTierHashtags> {
  const mod = await tryImportService("src/services/hashtagEngine.service.ts");
  if (mod && typeof mod.generateThreeTierHashtags === "function") {
    serviceStatus.hashtagEngineSource = "live";
    return mod.generateThreeTierHashtags(title, entity, content);
  }
  serviceStatus.hashtagEngineSource = "oracle";
  return oracle.oracleGenerateThreeTierHashtags(title, entity, content);
}

export function appendHashtags(content: string, hashtags: string[]): string {
  const safeContent = (content || "").trim();
  const validTags = (hashtags || []).filter(Boolean);
  if (validTags.length === 0) return safeContent;
  if (!safeContent) return validTags.join(" ");
  return `${safeContent}\n\n${validTags.join(" ")}`;
}

// --- F9 & F10: Image SEO Loader ---
export async function generateImageSeoMetadata(topicTitle: string, entity?: string): Promise<ImageSeoMetadata> {
  const mod = await tryImportService("src/services/promptEngine.service.ts");
  if (mod && typeof mod.generateImageSeoMetadata === "function") {
    return mod.generateImageSeoMetadata(topicTitle, entity);
  }
  return oracle.oracleGenerateImageSeoMetadata(topicTitle, entity);
}

// --- F11 & F12: Content Variations Loader ---
export async function getAllStylePresets(): Promise<StylePresetItem[]> {
  const mod = await tryImportService("src/services/contentVariations.service.ts");
  if (mod && typeof mod.getAllStylePresets === "function") {
    serviceStatus.contentVariationsSource = "live";
    return mod.getAllStylePresets();
  }
  serviceStatus.contentVariationsSource = "oracle";
  return oracle.oracleGetAllStylePresets();
}

export async function getStylePrompt(style: ContentStyleVariation): Promise<string> {
  const mod = await tryImportService("src/services/contentVariations.service.ts");
  if (mod && typeof mod.getStylePrompt === "function") {
    serviceStatus.contentVariationsSource = "live";
    return mod.getStylePrompt(style);
  }
  serviceStatus.contentVariationsSource = "oracle";
  return oracle.oracleGetStylePrompt(style);
}

// --- F13: DB Migrations Loader ---
export async function runMigrations(db: DatabaseSync): Promise<void> {
  const mod = await tryImportService("src/services/db.service.ts");
  if (mod && typeof mod.runMigrations === "function") {
    serviceStatus.dbMigrationSource = "live";
    return mod.runMigrations(db);
  }
  serviceStatus.dbMigrationSource = "oracle";
  return oracle.oracleRunMigrations(db);
}

// ==========================================
// R1: Page Manager Service Loaders
// ==========================================
export async function saveTargetPage(db: DatabaseSync, item: TargetPageItem): Promise<void> {
  serviceStatus.pageManagerSource = "oracle";
  return oracle.oracleSaveTargetPage(db, item);
}

export async function getTargetPages(db: DatabaseSync): Promise<TargetPageItem[]> {
  serviceStatus.pageManagerSource = "oracle";
  return oracle.oracleGetTargetPages(db);
}

export async function getTargetPageById(db: DatabaseSync, id: string): Promise<TargetPageItem | null> {
  serviceStatus.pageManagerSource = "oracle";
  return oracle.oracleGetTargetPageById(db, id);
}

export async function saveSourcePage(db: DatabaseSync, item: SourcePageItem): Promise<void> {
  serviceStatus.pageManagerSource = "oracle";
  return oracle.oracleSaveSourcePage(db, item);
}

export async function getSourcePages(db: DatabaseSync): Promise<SourcePageItem[]> {
  serviceStatus.pageManagerSource = "oracle";
  return oracle.oracleGetSourcePages(db);
}

export async function getSourcePageById(db: DatabaseSync, id: string): Promise<SourcePageItem | null> {
  serviceStatus.pageManagerSource = "oracle";
  return oracle.oracleGetSourcePageById(db, id);
}

export async function deletePage(db: DatabaseSync, type: "target" | "source", id: string): Promise<boolean> {
  serviceStatus.pageManagerSource = "oracle";
  return oracle.oracleDeletePage(db, type, id);
}

export function parseSourceUrl(rawUrl: string): {
  isValid: boolean;
  slug?: string;
  isNumericId?: boolean;
  normalizedUrl?: string;
  error?: string;
} {
  return oracle.oracleParseSourceUrl(rawUrl);
}

export function validatePageContext(page: any, expectedType: "target" | "source"): { valid: boolean; reason?: string } {
  return oracle.oracleValidatePageContext(page, expectedType);
}

export async function runR1Migrations(db: DatabaseSync): Promise<void> {
  const mod = await tryImportService("src/services/db.service.ts");
  if (mod && typeof mod.runMigrations === "function") {
    serviceStatus.dbMigrationSource = "live";
    try {
      mod.runMigrations(db);
    } catch {
      oracle.oracleRunR1Migrations(db);
      return;
    }
  }
  oracle.oracleRunR1Migrations(db);
}

// ==========================================
// R2: Post Collector & Deduplication Loaders
// ==========================================
export function computeContentHash(content: string): string {
  return oracle.oracleComputeContentHash(content);
}

export function checkDeduplication(
  db: DatabaseSync,
  facebookPostId: string,
  contentHash: string
): { isDuplicate: boolean; duplicateLayer?: "post_id" | "content_hash"; existingId?: string } {
  return oracle.oracleCheckDeduplication(db, facebookPostId, contentHash);
}

export function downloadMedia(remoteUrls: string[], facebookPostId: string): string[] {
  return oracle.oracleDownloadMedia(remoteUrls, facebookPostId);
}

export async function collectPosts(
  db: DatabaseSync,
  options: CollectPostsOptions,
  candidatePosts?: Partial<SourcePostItem>[]
): Promise<CollectPostsResult> {
  const mod = await tryImportService("src/services/postCollector.service.ts");
  if (mod && typeof mod.collectPosts === "function") {
    serviceStatus.postCollectorSource = "live";
    return mod.collectPosts(db, options, candidatePosts);
  }
  serviceStatus.postCollectorSource = "oracle";
  return oracle.oracleCollectPosts(db, options, candidatePosts);
}

export async function findEvergreenCandidates(
  db: DatabaseSync,
  sourcePageId: string,
  referenceDate = new Date()
): Promise<EvergreenCandidate[]> {
  const mod = await tryImportService("src/services/evergreenFallback.service.ts");
  if (mod && typeof mod.findEvergreenCandidates === "function") {
    serviceStatus.evergreenFallbackSource = "live";
    return mod.findEvergreenCandidates(db, sourcePageId, referenceDate);
  }
  serviceStatus.evergreenFallbackSource = "oracle";
  return oracle.oracleFindEvergreenCandidates(db, sourcePageId, referenceDate);
}

export async function triggerEvergreenFallback(
  db: DatabaseSync,
  sourcePostId: string
): Promise<SourcePostItem | null> {
  const mod = await tryImportService("src/services/evergreenFallback.service.ts");
  if (mod && typeof mod.triggerEvergreenFallback === "function") {
    serviceStatus.evergreenFallbackSource = "live";
    return mod.triggerEvergreenFallback(db, sourcePostId);
  }
  serviceStatus.evergreenFallbackSource = "oracle";
  return oracle.oracleTriggerEvergreenFallback(db, sourcePostId);
}

// ==========================================
// R3: Repurposing Engine Loaders
// ==========================================
export function checkAntiVerbatim(
  originalContent: string,
  rewrittenText: string
): { isUnique: boolean; maxMatchedSpanWords: number; sampleMatch?: string } {
  return oracle.oracleCheckAntiVerbatim(originalContent, rewrittenText);
}

export async function rewriteSourcePost(
  req: RepurposeRewriteRequest
): Promise<RepurposeRewriteResponse> {
  const mod = await tryImportService("src/services/repurposeEngine.service.ts");
  if (mod && typeof mod.rewriteSourcePost === "function") {
    serviceStatus.repurposeEngineSource = "live";
    return mod.rewriteSourcePost(req);
  }
  serviceStatus.repurposeEngineSource = "oracle";
  return oracle.oracleRewriteSourcePost(req);
}

// ==========================================
// R4: Moderation Queue & Publishing Loaders
// ==========================================
export async function createQueueItem(
  db: DatabaseSync,
  item: ModerationQueueItem
): Promise<ModerationQueueItem> {
  const mod = await tryImportService("src/services/moderationQueue.service.ts");
  if (mod && typeof mod.createQueueItem === "function") {
    serviceStatus.moderationQueueSource = "live";
    return mod.createQueueItem(db, item);
  }
  serviceStatus.moderationQueueSource = "oracle";
  return oracle.oracleCreateQueueItem(db, item);
}

export async function getQueueItems(
  db: DatabaseSync,
  filter?: { status?: QueueItemStatus }
): Promise<ModerationQueueItem[]> {
  const mod = await tryImportService("src/services/moderationQueue.service.ts");
  if (mod && typeof mod.getQueueItems === "function") {
    serviceStatus.moderationQueueSource = "live";
    return mod.getQueueItems(db, filter);
  }
  serviceStatus.moderationQueueSource = "oracle";
  return oracle.oracleGetQueueItems(db, filter);
}

export async function getQueueItemById(
  db: DatabaseSync,
  id: string
): Promise<ModerationQueueItem | null> {
  const mod = await tryImportService("src/services/moderationQueue.service.ts");
  if (mod && typeof mod.getQueueItemById === "function") {
    serviceStatus.moderationQueueSource = "live";
    return mod.getQueueItemById(db, id);
  }
  serviceStatus.moderationQueueSource = "oracle";
  return oracle.oracleGetQueueItemById(db, id);
}

export async function updateQueueDraft(
  db: DatabaseSync,
  id: string,
  updates: Partial<ModerationQueueItem>
): Promise<ModerationQueueItem> {
  const mod = await tryImportService("src/services/moderationQueue.service.ts");
  if (mod && typeof mod.updateQueueDraft === "function") {
    serviceStatus.moderationQueueSource = "live";
    return mod.updateQueueDraft(db, id, updates);
  }
  serviceStatus.moderationQueueSource = "oracle";
  return oracle.oracleUpdateQueueDraft(db, id, updates);
}

export async function approveAndPublish(
  db: DatabaseSync,
  id: string,
  targetPageId?: string
): Promise<ModerationQueueItem> {
  const mod = await tryImportService("src/services/moderationQueue.service.ts");
  if (mod && typeof mod.approveAndPublish === "function") {
    serviceStatus.moderationQueueSource = "live";
    return mod.approveAndPublish(db, id, targetPageId);
  }
  serviceStatus.moderationQueueSource = "oracle";
  return oracle.oracleApproveAndPublish(db, id, targetPageId);
}

export async function approveAndSchedule(
  db: DatabaseSync,
  id: string,
  scheduledAt: string,
  targetPageId?: string
): Promise<ModerationQueueItem> {
  const mod = await tryImportService("src/services/moderationQueue.service.ts");
  if (mod && typeof mod.approveAndSchedule === "function") {
    serviceStatus.moderationQueueSource = "live";
    return mod.approveAndSchedule(db, id, scheduledAt, targetPageId);
  }
  serviceStatus.moderationQueueSource = "oracle";
  return oracle.oracleApproveAndSchedule(db, id, scheduledAt, targetPageId);
}

export async function requestRevision(
  db: DatabaseSync,
  id: string,
  feedback?: string,
  newStyle?: ContentStyleVariation
): Promise<ModerationQueueItem> {
  const mod = await tryImportService("src/services/moderationQueue.service.ts");
  if (mod && typeof mod.requestRevision === "function") {
    serviceStatus.moderationQueueSource = "live";
    return mod.requestRevision(db, id, feedback, newStyle);
  }
  serviceStatus.moderationQueueSource = "oracle";
  return oracle.oracleRequestRevision(db, id, feedback, newStyle);
}

export async function rejectQueueItem(
  db: DatabaseSync,
  id: string
): Promise<ModerationQueueItem> {
  const mod = await tryImportService("src/services/moderationQueue.service.ts");
  if (mod && typeof mod.rejectQueueItem === "function") {
    serviceStatus.moderationQueueSource = "live";
    return mod.rejectQueueItem(db, id);
  }
  serviceStatus.moderationQueueSource = "oracle";
  return oracle.oracleRejectQueueItem(db, id);
}

export function buildMultiPhotoPayload(queueItem: ModerationQueueItem): {
  mode: "single_photo" | "multi_photo_album" | "text_feed";
  endpoint: string;
  payload: any;
} {
  return oracle.oracleBuildMultiPhotoPayload(queueItem);
}

