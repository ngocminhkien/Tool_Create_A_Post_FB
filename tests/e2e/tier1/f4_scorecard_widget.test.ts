/**
 * tests/e2e/tier1/f4_scorecard_widget.test.ts
 * Feature F4: Real-time Scorecard UI Widget Contract
 * Validates grading boundaries, checklist feedback items, and score gauge consistency.
 */

import assert from "node:assert/strict";
import { evaluateSocialSeo } from "../harness/serviceLoader";
import { TestRunnerContext } from "../harness/runnerHelper";
import { TestSuiteSummary } from "../types";

export async function runTier1F4Tests(): Promise<TestSuiteSummary> {
  const runner = new TestRunnerContext("Scorecard Widget Contract", 1, "F4");

  await runner.test("F4.1: Sum of check points exactly matches totalScore", async () => {
    const text = "Chia sẻ kiến thức kinh doanh online và bán hàng trên Facebook hiệu quả.";
    const evalResult = await evaluateSocialSeo(text);

    const calculatedSum = evalResult.checks.reduce((sum, item) => sum + item.points, 0);
    assert.equal(evalResult.totalScore, calculatedSum, "totalScore must equal the sum of check points");
  });

  await runner.test("F4.2: Maps score >= 80 to grade 'excellent'", async () => {
    // Construct content satisfying all 6 dimensions
    const p1 = "VinFast VF7 chính thức ra mắt mang lại giải pháp xe điện tuyệt vời tại Việt Nam. Thiết kế ấn tượng đón đầu xu hướng. 🌟 ";
    const filler = "Đây là dòng xe được trang bị công nghệ lái thông minh, hỗ trợ an toàn tối đa cho mọi hành trình của cả gia đình bạn trong từng chuyến đi. ";
    const p2 = `${filler.repeat(6)} VinFast VF7 đem lại cảm giác lái êm ái, tăng tốc nhanh chóng và tiết kiệm chi phí vận hành đáng kể mỗi ngày. 🚀 `;
    const p3 = `${filler.repeat(6)} Bạn nghĩ sao về mẫu xe VinFast VF7 này? Hãy để lại bình luận để cùng thảo luận nhé! ❤️`;
    const fullPost = `${p1}\n\n${p2}\n\n${p3}`;

    const evalResult = await evaluateSocialSeo(fullPost, "VinFast VF7");
    assert.ok(evalResult.totalScore >= 80, `Expected score >= 80, got ${evalResult.totalScore}`);
    assert.equal(evalResult.grade, "excellent");
  });

  await runner.test("F4.3: Maps score between 60 and 79 to grade 'good'", async () => {
    // Hook (25) + CTA (10) + Emojis (10) + Paragraphs (15) = 60
    const p1 = "VinFast VF7 xuất hiện hôm nay. 🌟";
    const p2 = "Thiết kế hiện đại và tinh tế. 🚀";
    const p3 = "Bạn thấy thế nào? Hãy để lại bình luận nhé! ❤️";
    const post = `${p1}\n\n${p2}\n\n${p3}`;

    const evalResult = await evaluateSocialSeo(post, "VinFast VF7");
    assert.ok(evalResult.totalScore >= 60 && evalResult.totalScore < 80);
    assert.equal(evalResult.grade, "good");
  });

  await runner.test("F4.4: Maps score between 40 and 59 to grade 'average'", async () => {
    // Hook (25) + Emojis (10) + CTA (10) = 45 (1 paragraph, under 250 words)
    const post = "VinFast VF7 đã về rồi mọi người ơi! 🌟 🚀 ❤️ Bạn có thích chiếc xe này không? Hãy bình luận.";
    const evalResult = await evaluateSocialSeo(post, "VinFast VF7");

    assert.ok(evalResult.totalScore >= 40 && evalResult.totalScore < 60);
    assert.equal(evalResult.grade, "average");
  });

  await runner.test("F4.5: Maps score below 40 to grade 'poor'", async () => {
    // Missing hook, short text, no emojis, no paragraphs, no CTA
    const post = "Hôm nay trời đẹp quá đi dạo phố.";
    const evalResult = await evaluateSocialSeo(post, "VinFast VF7");

    assert.ok(evalResult.totalScore < 40);
    assert.equal(evalResult.grade, "poor");
  });

  await runner.test("F4.6: Provides non-empty feedback string for all 6 checklist items", async () => {
    const post = "Nội dung bài viết mẫu thử nghiệm.";
    const evalResult = await evaluateSocialSeo(post);

    assert.equal(evalResult.checks.length, 6, "Must provide exactly 6 checklist items");
    for (const check of evalResult.checks) {
      assert.ok(check.feedback && check.feedback.trim().length > 0, `Feedback for ${check.id} must not be empty`);
      assert.ok(typeof check.passed === "boolean", `Passed flag for ${check.id} must be boolean`);
      assert.ok(check.maxPoints > 0, `Max points for ${check.id} must be positive`);
    }
  });

  return runner.getSummary();
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  runTier1F4Tests().then((s) => {
    new TestRunnerContext(s.suiteName, s.tier, "F4").printSummary();
  });
}
