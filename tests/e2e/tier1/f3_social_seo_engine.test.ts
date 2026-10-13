/**
 * tests/e2e/tier1/f3_social_seo_engine.test.ts
 * Feature F3: Social SEO & Readability Scorecard Engine (0-100)
 * Validates mathematical scoring across 6 key dimensions.
 */

import assert from "node:assert/strict";
import { evaluateSocialSeo } from "../harness/serviceLoader";
import { TestRunnerContext } from "../harness/runnerHelper";
import { TestSuiteSummary } from "../types";

export async function runTier1F3Tests(): Promise<TestSuiteSummary> {
  const runner = new TestRunnerContext("Social SEO Scorecard Engine", 1, "F3");

  await runner.test("F3.1: Awards 25 points when entity keyword is in first 120 characters", async () => {
    const content =
      "VinFast VF7 chính thức ra mắt mang lại trải nghiệm đột phá cho người yêu xe điện tại Việt Nam. Thiết kế tương lai với động cơ mạnh mẽ.";
    const evalResult = await evaluateSocialSeo(content, "VinFast VF7", "Ra mắt xe điện");

    const hookCheck = evalResult.checks.find((c) => c.id === "hook_entity");
    assert.ok(hookCheck, "Must have hook_entity check");
    assert.equal(hookCheck?.passed, true);
    assert.equal(hookCheck?.points, 25);
    assert.equal(evalResult.metrics.hookEntityPresent, true);
  });

  await runner.test("F3.2: Penalizes (0 points) when entity keyword is missing from first 120 characters", async () => {
    const content =
      "Chào mừng tất cả mọi người đến với bài viết hôm nay của chúng tôi trên mạng xã hội Facebook sau chuỗi ngày dài chờ đợi nội dung mới.";
    const evalResult = await evaluateSocialSeo(content, "VinFast VF7");

    const hookCheck = evalResult.checks.find((c) => c.id === "hook_entity");
    assert.equal(hookCheck?.passed, false);
    assert.equal(hookCheck?.points, 0);
  });

  await runner.test("F3.3: Awards 20 points for optimal keyword density (1.0% - 2.5%)", async () => {
    // Generate 300 words with keyword appearing ~5 times (~1.6% density)
    const fillerParagraph = "Đây là nội dung chia sẻ hữu ích về trải nghiệm sản phẩm và những giá trị thực tế mang lại cho cuộc sống hàng ngày. ";
    const body = `VinFast VF7 mang lại sự khác biệt. ${fillerParagraph.repeat(8)} VinFast VF7 thực sự ấn tượng. ${fillerParagraph.repeat(8)} VinFast VF7 là lựa chọn tốt.`;

    const evalResult = await evaluateSocialSeo(body, "VinFast VF7");
    const densityCheck = evalResult.checks.find((c) => c.id === "keyword_density");

    assert.ok(densityCheck);
    assert.equal(densityCheck?.passed, true);
    assert.equal(densityCheck?.points, 20);
    assert.ok(evalResult.metrics.keywordDensityPercent >= 1.0);
    assert.ok(evalResult.metrics.keywordDensityPercent <= 2.5);
  });

  await runner.test("F3.4: Awards 20 points for post length within 250 - 500 words", async () => {
    // Generate ~300 words post
    const sampleWords = new Array(300).fill("từ").join(" ");
    const evalResult = await evaluateSocialSeo(sampleWords);

    const lengthCheck = evalResult.checks.find((c) => c.id === "post_length");
    assert.ok(lengthCheck);
    assert.equal(lengthCheck?.passed, true);
    assert.equal(lengthCheck?.points, 20);
    assert.ok(evalResult.metrics.wordCount >= 250 && evalResult.metrics.wordCount <= 500);
  });

  await runner.test("F3.5: Awards 15 points for proper paragraph spacing (>=3 paragraphs, <=50 words/para)", async () => {
    const para1 = new Array(30).fill("nội-dung").join(" ");
    const para2 = new Array(35).fill("chi-tiết").join(" ");
    const para3 = new Array(25).fill("kết-luận").join(" ");
    const content = `${para1}\n\n${para2}\n\n${para3}`;

    const evalResult = await evaluateSocialSeo(content);
    const readCheck = evalResult.checks.find((c) => c.id === "readability");

    assert.ok(readCheck);
    assert.equal(readCheck?.passed, true);
    assert.equal(readCheck?.points, 15);
    assert.ok(evalResult.metrics.paragraphCount >= 3);
    assert.ok(evalResult.metrics.avgWordsPerParagraph <= 50);
  });

  await runner.test("F3.6: Awards 10 points for balanced emoji density (3 to 10 emojis)", async () => {
    const content = "Chào buổi sáng mọi người! 🌟 Chúc mọi người một ngày làm việc hiệu quả và tràn đầy năng lượng 🚀 Đừng quên mỉm cười nhé ❤️";
    const evalResult = await evaluateSocialSeo(content);

    const emojiCheck = evalResult.checks.find((c) => c.id === "emoji_count");
    assert.ok(emojiCheck);
    assert.equal(emojiCheck?.passed, true);
    assert.equal(emojiCheck?.points, 10);
    assert.equal(evalResult.metrics.emojiCount, 3);
  });

  await runner.test("F3.7: Awards 10 points for comment CTA phrase triggering engagement", async () => {
    const content = "Bạn nghĩ sao về xu hướng này? Hãy để lại bình luận hoặc chia sẻ cảm nghĩ của bạn bên dưới nhé!";
    const evalResult = await evaluateSocialSeo(content);

    const ctaCheck = evalResult.checks.find((c) => c.id === "comment_cta");
    assert.ok(ctaCheck);
    assert.equal(ctaCheck?.passed, true);
    assert.equal(ctaCheck?.points, 10);
    assert.equal(evalResult.metrics.hasCommentCta, true);
  });

  return runner.getSummary();
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  runTier1F3Tests().then((s) => {
    new TestRunnerContext(s.suiteName, s.tier, "F3").printSummary();
  });
}
