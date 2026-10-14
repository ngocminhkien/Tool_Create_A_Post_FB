/**
 * tests/e2e/r1_r4/tier1/f10_anti_verbatim_rewriter.test.ts
 * Tier 1 — Feature F10: Unique Anti-Verbatim Content Rewriter
 * Verifies 4 style variations (Storytelling, Direct Sales, News/Guide, Humorous/Trend)
 * and asserts zero verbatim 10-word plagiarism matches against source text.
 */

import { TestRunnerContext } from "../../harness/runnerHelper";
import { rewriteSourcePost, checkAntiVerbatim } from "../../harness/serviceLoader";
import { TestSuiteSummary } from "../../types";

export async function runTier1F10AntiVerbatimRewriterTests(): Promise<TestSuiteSummary> {
  const ctx = new TestRunnerContext("F10: Unique Anti-Verbatim Content Rewriter", 1, "F10");

  const sampleSourceText =
    "Công ty cổ phần công nghệ khai trương trụ sở mới tại Hà Nội vào sáng ngày hôm nay với sự tham gia của đông đảo khách mời. " +
    "Đây là bước tiến quan trọng trong kế hoạch mở rộng thị trường miền Bắc và nâng cao chất lượng dịch vụ khách hàng trong năm 2026. " +
    "Doanh nghiệp đặt mục tiêu phát triển hệ sinh thái số toàn diện và tạo thêm 500 việc làm mới cho các kỹ sư trẻ tài năng.";

  await ctx.test("F10-01: Storytelling style rewrite produces emotional narrative and lessons learned", async () => {
    const res = await rewriteSourcePost({
      sourcePostId: "src_p_story",
      sourcePageName: "Tech News Daily",
      sourceContent: sampleSourceText,
      style: "storytelling",
    });

    const item = res.queueItem;
    if (item.contentStyle !== "storytelling") {
      throw new Error(`Expected contentStyle 'storytelling', got '${item.contentStyle}'`);
    }
    if (!item.aiHeadline || !item.aiHook || !item.aiBody) {
      throw new Error("Missing structured elements in storytelling rewrite");
    }
    if (item.aiHook.length > 150) {
      throw new Error(`Hook is too long (${item.aiHook.length} chars) - should hook reader before 120-150 chars`);
    }
  });

  await ctx.test("F10-02: Direct Sales style rewrite produces problem-solution-action (PAS) framing", async () => {
    const res = await rewriteSourcePost({
      sourcePostId: "src_p_sales",
      sourcePageName: "Tech News Daily",
      sourceContent: sampleSourceText,
      style: "direct_sales",
    });

    const item = res.queueItem;
    if (item.contentStyle !== "direct_sales") {
      throw new Error(`Expected contentStyle 'direct_sales', got '${item.contentStyle}'`);
    }
    const lowerPost = item.aiFullPost.toLowerCase();
    const hasSalesIntent =
      lowerPost.includes("giải pháp") ||
      lowerPost.includes("tư vấn") ||
      lowerPost.includes("nhắn tin") ||
      lowerPost.includes("bình luận");
    if (!hasSalesIntent) {
      throw new Error("Direct sales post lacks commercial problem-solution CTA");
    }
  });

  await ctx.test("F10-03: News Guide style rewrite produces structured actionable checklist/tips", async () => {
    const res = await rewriteSourcePost({
      sourcePostId: "src_p_news",
      sourcePageName: "Tech News Daily",
      sourceContent: sampleSourceText,
      style: "news_guide",
    });

    const item = res.queueItem;
    if (item.contentStyle !== "news_guide") {
      throw new Error(`Expected contentStyle 'news_guide', got '${item.contentStyle}'`);
    }
    if (!item.aiBody.includes("Bước") && !item.aiBody.includes("1") && !item.aiBody.includes("-")) {
      throw new Error("News guide format should contain structured points or steps");
    }
  });

  await ctx.test("F10-04: Humorous Trend style rewrite incorporates witty slang and friend-tagging CTA", async () => {
    const res = await rewriteSourcePost({
      sourcePostId: "src_p_humor",
      sourcePageName: "Tech News Daily",
      sourceContent: sampleSourceText,
      style: "humorous_trend",
    });

    const item = res.queueItem;
    if (item.contentStyle !== "humorous_trend") {
      throw new Error(`Expected contentStyle 'humorous_trend', got '${item.contentStyle}'`);
    }
    const lowerPost = item.aiFullPost.toLowerCase();
    const hasHumorCta = lowerPost.includes("tag") || lowerPost.includes("bạn") || lowerPost.includes("chill");
    if (!hasHumorCta) {
      throw new Error("Humorous trend post lacks community viral engagement trigger");
    }
  });

  await ctx.test("F10-05: Anti-verbatim invariant: zero 10-word identical spans between source and rewritten text", async () => {
    const res = await rewriteSourcePost({
      sourcePostId: "src_p_plag_check",
      sourcePageName: "Tech News Daily",
      sourceContent: sampleSourceText,
      style: "storytelling",
    });

    const antiVerbatim = checkAntiVerbatim(sampleSourceText, res.queueItem.aiFullPost);
    if (!antiVerbatim.isUnique) {
      throw new Error(`Anti-verbatim violation! Found identical 10-word span: "${antiVerbatim.sampleMatch}"`);
    }
    if (antiVerbatim.maxMatchedSpanWords >= 10) {
      throw new Error(`Maximum matched span exceeded threshold: ${antiVerbatim.maxMatchedSpanWords} words`);
    }
  });

  await ctx.test("F10-06: Assembled aiFullPost integrates headline, hook, body, and CTA cleanly", async () => {
    const res = await rewriteSourcePost({
      sourcePostId: "src_p_structure",
      sourcePageName: "Tech News Daily",
      sourceContent: sampleSourceText,
      style: "direct_sales",
    });

    const item = res.queueItem;
    if (!item.aiFullPost.includes(item.aiHeadline)) {
      throw new Error("aiFullPost must contain aiHeadline");
    }
    if (!item.aiFullPost.includes(item.aiHook)) {
      throw new Error("aiFullPost must contain aiHook");
    }
    if (!item.aiFullPost.includes(item.aiBody)) {
      throw new Error("aiFullPost must contain aiBody");
    }
  });

  return ctx.getSummary();
}
