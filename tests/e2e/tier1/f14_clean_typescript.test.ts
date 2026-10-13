/**
 * tests/e2e/tier1/f14_clean_typescript.test.ts
 * Feature F14: Clean TypeScript Verification
 * Validates strict TypeScript contract assignability, null safety, and return signatures.
 */

import assert from "node:assert/strict";
import {
  ContentStyleVariation,
  GoldenHourSlot,
  ImageSeoMetadata,
  PolicyScanResult,
  SocialSeoEvaluation,
  ThreeTierHashtags,
} from "../types";
import {
  generateImageSeoMetadata,
  generateThreeTierHashtags,
  getAllStylePresets,
  getUpcomingPreset,
  scanFacebookPolicy,
  evaluateSocialSeo,
} from "../harness/serviceLoader";
import { TestRunnerContext } from "../harness/runnerHelper";
import { TestSuiteSummary } from "../types";

export async function runTier1F14Tests(): Promise<TestSuiteSummary> {
  const runner = new TestRunnerContext("Clean TypeScript Verification", 1, "F14");

  await runner.test("F14.1: PolicyScanResult satisfies all required type properties strictly", async () => {
    const res: PolicyScanResult = await scanFacebookPolicy("Kiểm tra nội dung");

    assert.equal(typeof res.isSafe, "boolean");
    assert.equal(typeof res.riskScore, "number");
    assert.ok(["safe", "warning", "danger"].includes(res.riskLevel));
    assert.ok(Array.isArray(res.violations));
  });

  await runner.test("F14.2: SocialSeoEvaluation satisfies complete evaluation structure", async () => {
    const res: SocialSeoEvaluation = await evaluateSocialSeo("Nội dung bài viết mẫu");

    assert.equal(typeof res.totalScore, "number");
    assert.ok(["excellent", "good", "average", "poor"].includes(res.grade));
    assert.equal(typeof res.metrics.wordCount, "number");
    assert.equal(typeof res.metrics.hookEntityPresent, "boolean");
    assert.ok(Array.isArray(res.checks));
  });

  await runner.test("F14.3: GoldenHourSlot adheres strictly to slot contract", async () => {
    const res: GoldenHourSlot = await getUpcomingPreset("evening");

    assert.ok(["morning", "noon", "evening", "night"].includes(res.id));
    assert.equal(typeof res.label, "string");
    assert.equal(typeof res.timeRange, "string");
    assert.equal(typeof res.isToday, "boolean");
    assert.equal(typeof res.formattedTarget, "string");
    assert.equal(typeof res.timestamp, "string");
    assert.equal(typeof res.isRecommendedPrime, "boolean");
  });

  await runner.test("F14.4: ThreeTierHashtags satisfies 3 distinct array tiers and combined block", async () => {
    const res: ThreeTierHashtags = await generateThreeTierHashtags("Tiêu đề bài viết", "Thực thể");

    assert.ok(Array.isArray(res.tier1Entity));
    assert.ok(Array.isArray(res.tier2Topic));
    assert.ok(Array.isArray(res.tier3Trend));
    assert.ok(Array.isArray(res.allCombined));
    assert.equal(typeof res.formattedBlock, "string");
  });

  await runner.test("F14.5: ImageSeoMetadata and ContentStyleVariation types are fully assignable", async () => {
    const imgMeta: ImageSeoMetadata = await generateImageSeoMetadata("Chủ đề bài đăng", "Brand");
    assert.equal(typeof imgMeta.altText, "string");
    assert.equal(typeof imgMeta.caption, "string");

    const presets = await getAllStylePresets();
    const validStyles: ContentStyleVariation[] = ["storytelling", "direct_sales", "news_guide", "humorous_trend"];
    for (const p of presets) {
      assert.ok(validStyles.includes(p.id));
    }
  });

  return runner.getSummary();
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  runTier1F14Tests().then((s) => {
    new TestRunnerContext(s.suiteName, s.tier, "F14").printSummary();
  });
}
