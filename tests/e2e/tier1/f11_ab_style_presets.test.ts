/**
 * tests/e2e/tier1/f11_ab_style_presets.test.ts
 * Feature F11: A/B Content Style Presets
 * Validates prompt generation and preset metadata for 4 distinct conversion styles.
 */

import assert from "node:assert/strict";
import { getAllStylePresets, getStylePrompt } from "../harness/serviceLoader";
import { TestRunnerContext } from "../harness/runnerHelper";
import { TestSuiteSummary } from "../types";

export async function runTier1F11Tests(): Promise<TestSuiteSummary> {
  const runner = new TestRunnerContext("A/B Content Style Presets", 1, "F11");

  await runner.test("F11.1: Returns exactly 4 conversion style presets with complete metadata", async () => {
    const presets = await getAllStylePresets();
    assert.equal(presets.length, 4, "Must provide exactly 4 presets");

    const ids = presets.map((p) => p.id);
    assert.deepEqual(ids, ["storytelling", "direct_sales", "news_guide", "humorous_trend"]);

    for (const preset of presets) {
      assert.ok(preset.name.length > 0, `Name for ${preset.id} must not be empty`);
      assert.ok(preset.desc.length > 0, `Desc for ${preset.id} must not be empty`);
      assert.ok(preset.icon.length > 0, `Icon for ${preset.id} must not be empty`);
    }
  });

  await runner.test("F11.2: Generates dedicated prompt for 'storytelling' emphasizing emotional narrative", async () => {
    const prompt = await getStylePrompt("storytelling");
    assert.ok(prompt.toLowerCase().includes("storytelling") || prompt.toLowerCase().includes("cảm xúc") || prompt.toLowerCase().includes("kể chuyện"));
  });

  await runner.test("F11.3: Generates dedicated prompt for 'direct_sales' emphasizing PAS/AIDA conversion", async () => {
    const prompt = await getStylePrompt("direct_sales");
    assert.ok(prompt.toLowerCase().includes("bán hàng") || prompt.toLowerCase().includes("trực diện") || prompt.toLowerCase().includes("giải pháp"));
  });

  await runner.test("F11.4: Generates dedicated prompt for 'news_guide' emphasizing structured knowledge", async () => {
    const prompt = await getStylePrompt("news_guide");
    assert.ok(prompt.toLowerCase().includes("cẩm nang") || prompt.toLowerCase().includes("kiến thức") || prompt.toLowerCase().includes("hành động"));
  });

  await runner.test("F11.5: Generates dedicated prompt for 'humorous_trend' emphasizing humor & memes", async () => {
    const prompt = await getStylePrompt("humorous_trend");
    assert.ok(prompt.toLowerCase().includes("hài hước") || prompt.toLowerCase().includes("trend") || prompt.toLowerCase().includes("dí dỏm"));
  });

  await runner.test("F11.6: Returns safe fallback prompt when unknown style parameter passed", async () => {
    const prompt = await getStylePrompt("unknown_style" as any);
    assert.ok(prompt && prompt.length > 0, "Fallback prompt must be returned");
  });

  return runner.getSummary();
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  runTier1F11Tests().then((s) => {
    new TestRunnerContext(s.suiteName, s.tier, "F11").printSummary();
  });
}
