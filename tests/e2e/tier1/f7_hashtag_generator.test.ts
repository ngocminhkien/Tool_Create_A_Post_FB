/**
 * tests/e2e/tier1/f7_hashtag_generator.test.ts
 * Feature F7: 3-Tier Hashtag Generator
 * Validates 3-tier algorithm, Vietnamese diacritic normalization, and formatting.
 */

import assert from "node:assert/strict";
import { generateThreeTierHashtags } from "../harness/serviceLoader";
import { TestRunnerContext } from "../harness/runnerHelper";
import { TestSuiteSummary } from "../types";

export async function runTier1F7Tests(): Promise<TestSuiteSummary> {
  const runner = new TestRunnerContext("3-Tier Hashtag Generator", 1, "F7");

  await runner.test("F7.1: Organizes hashtags into 3 distinct hierarchical tiers", async () => {
    const result = await generateThreeTierHashtags("Xe điện tương lai", "VinFast");

    assert.ok(Array.isArray(result.tier1Entity), "Tier 1 must be an array");
    assert.ok(Array.isArray(result.tier2Topic), "Tier 2 must be an array");
    assert.ok(Array.isArray(result.tier3Trend), "Tier 3 must be an array");

    assert.ok(result.tier1Entity.length > 0, "Tier 1 must not be empty");
    assert.ok(result.tier2Topic.length > 0, "Tier 2 must not be empty");
    assert.ok(result.tier3Trend.length > 0, "Tier 3 must not be empty");
  });

  await runner.test("F7.2: Normalizes Vietnamese diacritics into ASCII CamelCase hashtags", async () => {
    const result = await generateThreeTierHashtags("Bí quyết trị mụn tại nhà", "Thảo Mộc Xanh");

    const entityTag = result.tier1Entity[0];
    assert.ok(entityTag.startsWith("#"), "Hashtag must begin with #");
    assert.match(entityTag, /^#[a-zA-Z0-9]+$/, "Hashtag must not contain diacritics, spaces, or accents");
    assert.ok(entityTag.toLowerCase().includes("thaomocxanh"));
  });

  await runner.test("F7.3: Strips punctuation, special characters, and extraneous symbols", async () => {
    const result = await generateThreeTierHashtags("Ưu đãi 50% & Mua 1 Tặng 1! (Cực hot)", "Shop 123 @HCM");

    for (const tag of result.allCombined) {
      assert.doesNotMatch(tag.slice(1), /[!@#$%^&*()_+=\-[\]{};':"\\|,.<>/?]/, "Tag must not contain special symbols except leading #");
    }
  });

  await runner.test("F7.4: allCombined array is fully deduplicated", async () => {
    const result = await generateThreeTierHashtags("Xu hướng thời trang", "Zara");

    const uniqueTags = new Set(result.allCombined);
    assert.equal(result.allCombined.length, uniqueTags.size, "allCombined list must contain no duplicate hashtags");
  });

  await runner.test("F7.5: Produces single formattedBlock string with space delimiters", async () => {
    const result = await generateThreeTierHashtags("Đánh giá công nghệ", "Apple");

    assert.equal(typeof result.formattedBlock, "string");
    assert.ok(result.formattedBlock.startsWith("#"));
    assert.equal(result.formattedBlock, result.allCombined.join(" "));
  });

  await runner.test("F7.6: Provides safe default brand hashtags when entity is not specified", async () => {
    const result = await generateThreeTierHashtags("Cẩm nang nấu ăn ngon");

    assert.ok(result.tier1Entity.length > 0, "Tier 1 must have fallback tags when entity is empty");
    assert.ok(result.allCombined.length >= 5, "Total combined tags must meet minimum count");
  });

  return runner.getSummary();
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  runTier1F7Tests().then((s) => {
    new TestRunnerContext(s.suiteName, s.tier, "F7").printSummary();
  });
}
