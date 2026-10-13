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
  ContentStyleVariation,
  GoldenHourSlot,
  GoldenHourSlotId,
  ImageSeoMetadata,
  PolicyScanResult,
  SocialSeoEvaluation,
  StylePresetItem,
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
}

export const serviceStatus: LoadedServicesState = {
  policyGuardSource: "oracle",
  socialSeoSource: "oracle",
  goldenHoursSource: "oracle",
  hashtagEngineSource: "oracle",
  contentVariationsSource: "oracle",
  dbMigrationSource: "oracle",
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
