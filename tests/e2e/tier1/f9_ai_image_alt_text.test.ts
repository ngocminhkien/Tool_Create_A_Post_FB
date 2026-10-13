/**
 * tests/e2e/tier1/f9_ai_image_alt_text.test.ts
 * Feature F9: AI Image Alt Text & SEO Caption
 * Validates heuristic & AI generation of accessible Alt Text and photo captions.
 */

import assert from "node:assert/strict";
import { generateImageSeoMetadata } from "../harness/serviceLoader";
import { TestRunnerContext } from "../harness/runnerHelper";
import { TestSuiteSummary } from "../types";

export async function runTier1F9Tests(): Promise<TestSuiteSummary> {
  const runner = new TestRunnerContext("AI Image Alt Text & Caption Generator", 1, "F9");

  await runner.test("F9.1: Generates descriptive Alt Text containing visual context", async () => {
    const meta = await generateImageSeoMetadata("Thiết kế nội thất phòng khách hiện đại", "Nội Thất Xinh");

    assert.ok(meta.altText, "Alt text must not be empty");
    assert.ok(meta.altText.length >= 20, "Alt text must be sufficiently descriptive");
    assert.ok(meta.altText.includes("Nội Thất Xinh"), "Alt text should reference the entity");
  });

  await runner.test("F9.2: Generates SEO photo caption incorporating topic title and entity", async () => {
    const meta = await generateImageSeoMetadata("Ra mắt iPhone 16 Pro Max", "Apple Việt Nam");

    assert.ok(meta.caption, "Caption must not be empty");
    assert.ok(meta.caption.includes("iPhone 16 Pro Max"), "Caption should mention topic title");
    assert.ok(meta.caption.includes("Apple Việt Nam"), "Caption should mention brand entity");
  });

  await runner.test("F9.3: Produces concise Alt Text adhering to screen reader guidelines", async () => {
    const meta = await generateImageSeoMetadata("Món ngon Hà Nội: Phở bò gia truyền", "Ẩm Thực Phố");

    // Accessible Alt Text should typically not be an overwhelming essay
    const words = meta.altText.split(/\s+/);
    assert.ok(words.length <= 50, `Alt text word count (${words.length}) should remain concise`);
  });

  await runner.test("F9.4: Provides safe fallbacks when entity is not provided", async () => {
    const meta = await generateImageSeoMetadata("Chiến lược kinh doanh 2026");

    assert.ok(meta.altText && meta.altText.length > 0);
    assert.ok(meta.caption && meta.caption.length > 0);
  });

  await runner.test("F9.5: Provides safe fallbacks when both topic and entity are empty", async () => {
    const meta = await generateImageSeoMetadata("", "");

    assert.ok(meta.altText && meta.altText.length > 0, "Alt text must have default fallback");
    assert.ok(meta.caption && meta.caption.length > 0, "Caption must have default fallback");
  });

  return runner.getSummary();
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  runTier1F9Tests().then((s) => {
    new TestRunnerContext(s.suiteName, s.tier, "F9").printSummary();
  });
}
