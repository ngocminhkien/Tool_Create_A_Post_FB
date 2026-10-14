/**
 * tests/e2e/r1_r4/tier1/f11_auto_policy_hashtag_chaining.test.ts
 * Tier 1 — Feature F11: Auto-Policy Guard & 3-Tier Hashtags Chaining
 * Verifies automatic sanitization of sensitive claims, 3-tier hashtag generation,
 * footer appending, and Social SEO scorecard calculation.
 */

import { TestRunnerContext } from "../../harness/runnerHelper";
import { rewriteSourcePost } from "../../harness/serviceLoader";
import { TestSuiteSummary } from "../../types";

export async function runTier1F11AutoPolicyHashtagChainingTests(): Promise<TestSuiteSummary> {
  const ctx = new TestRunnerContext("F11: Auto-Policy Guard & 3-Tier Hashtags Chaining", 1, "F11");

  await ctx.test("F11-01: Auto-sanitizes absolute claims (e.g. 'cam kết 100%') into safe alternatives", async () => {
    const rawForbidden = "Sản phẩm cam kết 100% giải quyết vấn đề của bạn dứt điểm.";
    const res = await rewriteSourcePost({
      sourcePostId: "sp_policy_test",
      sourcePageName: "Nguồn Thẩm Mỹ",
      sourceContent: rawForbidden,
      style: "direct_sales",
    });

    const fullPost = res.queueItem.aiFullPost;
    if (fullPost.includes("cam kết 100%")) {
      throw new Error("Forbidden phrase 'cam kết 100%' was not auto-sanitized!");
    }
  });

  await ctx.test("F11-02: Policy status is cleanly recorded on queue item", async () => {
    const res = await rewriteSourcePost({
      sourcePostId: "sp_clean_test",
      sourcePageName: "Nguồn Tin Tức",
      sourceContent: "Khởi động chiến dịch mùa hè xanh 2026 với nhiều hoạt động thiết thực.",
      style: "news_guide",
    });

    const item = res.queueItem;
    if (!["clean", "warning", "danger"].includes(item.policyStatus)) {
      throw new Error(`Invalid policyStatus: ${item.policyStatus}`);
    }
    if (item.policyStatus === "danger") {
      throw new Error("Clean news guide should not have 'danger' policy status");
    }
  });

  await ctx.test("F11-03: 3-Tier hashtags are generated covering Entity, Topic, and Trend tiers", async () => {
    const res = await rewriteSourcePost({
      sourcePostId: "sp_hashtag_test",
      sourcePageName: "Công Nghệ Việt",
      sourceContent: "Ra mắt nền tảng chuyển đổi số mới cho doanh nghiệp vừa và nhỏ.",
      targetPageName: "VinFast Tech",
      style: "news_guide",
    });

    const tags = res.queueItem.hashtags;
    if (!Array.isArray(tags) || tags.length < 3) {
      throw new Error(`Expected at least 3 hashtags across tiers, got ${tags?.length}`);
    }

    const hasEntity = tags.some((t) => t.toLowerCase().includes("vinfast") || t.toLowerCase().includes("tech") || t.toLowerCase().includes("brand"));
    const hasTopic = tags.some((t) => t.toLowerCase().includes("chuyende") || t.toLowerCase().includes("chiase") || t.toLowerCase().includes("camnang") || t.toLowerCase().includes("gocnhin"));
    const hasTrend = tags.some((t) => t.toLowerCase().includes("viral") || t.toLowerCase().includes("xuhuong") || t.toLowerCase().includes("facebook") || t.toLowerCase().includes("congdong"));

    if (!hasEntity || !hasTopic || !hasTrend) {
      throw new Error(`Missing expected tiers in generated hashtags: ${JSON.stringify(tags)}`);
    }
  });

  await ctx.test("F11-04: Hashtags are appended cleanly at the bottom with double newline separation", async () => {
    const res = await rewriteSourcePost({
      sourcePostId: "sp_append_test",
      sourcePageName: "Page Nguồn",
      sourceContent: "Nội dung kiểm tra cách chèn hashtag vào cuối bài viết.",
      style: "storytelling",
    });

    const fullPost = res.queueItem.aiFullPost;
    const tags = res.queueItem.hashtags;

    if (tags.length > 0) {
      const firstTag = tags[0];
      if (!fullPost.includes(firstTag)) {
        throw new Error(`Expected fullPost to contain hashtag '${firstTag}'`);
      }
      // Check that hashtags are in the tail of the post
      const tagIndex = fullPost.lastIndexOf("#");
      if (tagIndex < fullPost.length / 2) {
        throw new Error("Hashtags should be placed towards the end of the post");
      }
    }
  });

  await ctx.test("F11-05: Real-time Social SEO Scorecard evaluation is attached to queue item", async () => {
    const res = await rewriteSourcePost({
      sourcePostId: "sp_seo_test",
      sourcePageName: "Marketing Hub",
      sourceContent: "Chia sẻ kinh nghiệm xây dựng thương hiệu cá nhân trên mạng xã hội.",
      style: "storytelling",
    });

    const item = res.queueItem;
    if (typeof item.seoScore !== "number" || item.seoScore < 0 || item.seoScore > 100) {
      throw new Error(`Expected seoScore between 0 and 100, got ${item.seoScore}`);
    }
    if (!item.seoBreakdown || !item.seoBreakdown.metrics) {
      throw new Error("Missing detailed seoBreakdown scorecard metrics");
    }
  });

  await ctx.test("F11-06: Sanitization and hashtag chaining preserve readability without syntax breakage", async () => {
    const rawText = "Chương trình cam kết 100% và liên hệ hotline 0912345678 để nhận quà khủng.";
    const res = await rewriteSourcePost({
      sourcePostId: "sp_chain_clean",
      sourcePageName: "Nguồn Khuyến Mãi",
      sourceContent: rawText,
      style: "direct_sales",
    });

    const post = res.queueItem.aiFullPost;
    if (post.includes("0912345678")) {
      throw new Error("Raw phone number should be sanitized by policy guard");
    }
    // Verify paragraphs are separated
    const paragraphs = post.split("\n\n").filter(Boolean);
    if (paragraphs.length < 2) {
      throw new Error("Post should have structured paragraph layout");
    }
  });

  return ctx.getSummary();
}
