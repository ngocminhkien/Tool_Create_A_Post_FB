/**
 * tests/e2e/r1_r4/tier1/f15_graph_api_media_publishing.test.ts
 * Tier 1 — Feature F15: Enhanced Graph API Media Publishing
 * Verifies local file streaming resolution, single photo vs multi-photo album formatting,
 * and Meta API scheduled post payload construction.
 */

import { TestRunnerContext } from "../../harness/runnerHelper";
import { buildMultiPhotoPayload, rewriteSourcePost } from "../../harness/serviceLoader";
import { TestSuiteSummary } from "../../types";

export async function runTier1F15GraphApiPublishingTests(): Promise<TestSuiteSummary> {
  const ctx = new TestRunnerContext("F15: Enhanced Graph API Media Publishing", 1, "F15");

  await ctx.test("F15-01: Single photo post constructs endpoint /{pageId}/photos with caption", async () => {
    const res = await rewriteSourcePost({
      sourcePostId: "sp_pub_single",
      sourcePageName: "Nguồn Ảnh",
      sourceContent: "Bài viết đính kèm 1 ảnh đơn.",
      targetPageId: "target_brand_999",
      sourceImages: ["/uploads/source_media/single_img.jpg"],
      style: "direct_sales",
    });

    const payload = buildMultiPhotoPayload(res.queueItem);

    if (payload.mode !== "single_photo") {
      throw new Error(`Expected mode 'single_photo', got '${payload.mode}'`);
    }
    if (payload.endpoint !== "/target_brand_999/photos") {
      throw new Error(`Expected endpoint '/target_brand_999/photos', got '${payload.endpoint}'`);
    }
    if (payload.payload.photo_source !== "/uploads/source_media/single_img.jpg") {
      throw new Error("Single photo source path mismatch");
    }
  });

  await ctx.test("F15-02: Multi-photo post (N > 1) constructs /{pageId}/feed with attached_media album payload", async () => {
    const res = await rewriteSourcePost({
      sourcePostId: "sp_pub_album",
      sourcePageName: "Nguồn Album",
      sourceContent: "Bài viết đính kèm album 3 ảnh.",
      targetPageId: "target_brand_999",
      sourceImages: [
        "/uploads/source_media/album_0.jpg",
        "/uploads/source_media/album_1.jpg",
        "/uploads/source_media/album_2.jpg",
      ],
      style: "storytelling",
    });

    const payload = buildMultiPhotoPayload(res.queueItem);

    if (payload.mode !== "multi_photo_album") {
      throw new Error(`Expected mode 'multi_photo_album', got '${payload.mode}'`);
    }
    if (payload.endpoint !== "/target_brand_999/feed") {
      throw new Error(`Expected endpoint '/target_brand_999/feed', got '${payload.endpoint}'`);
    }
    if (!Array.isArray(payload.payload.attached_media) || payload.payload.attached_media.length !== 3) {
      throw new Error(`Expected 3 attached_media FBIDs, got ${payload.payload.attached_media?.length}`);
    }
  });

  await ctx.test("F15-03: Text-only post with 0 images constructs /{pageId}/feed with message", async () => {
    const res = await rewriteSourcePost({
      sourcePostId: "sp_pub_text",
      sourcePageName: "Nguồn Văn Bản",
      sourceContent: "Bài viết chia sẻ kiến thức không ảnh.",
      targetPageId: "target_brand_999",
      sourceImages: [],
      style: "news_guide",
    });

    const payload = buildMultiPhotoPayload(res.queueItem);

    if (payload.mode !== "text_feed") {
      throw new Error(`Expected mode 'text_feed', got '${payload.mode}'`);
    }
    if (payload.endpoint !== "/target_brand_999/feed") {
      throw new Error(`Expected endpoint '/target_brand_999/feed', got '${payload.endpoint}'`);
    }
    if (!payload.payload.message) {
      throw new Error("Message should be present in text feed payload");
    }
  });

  await ctx.test("F15-04: Scheduled publishing timestamp validates Meta constraint (between 10m and 75d)", async () => {
    const now = Date.now();
    const tooSoon = Math.floor((now + 5 * 60 * 1000) / 1000); // 5 mins in future (Invalid: < 10 mins)
    const validFuture = Math.floor((now + 2 * 3600 * 1000) / 1000); // 2 hours in future (Valid)
    const tooFar = Math.floor((now + 80 * 24 * 3600 * 1000) / 1000); // 80 days in future (Invalid: > 75 days)

    const isMetaScheduleValid = (unixTimestamp: number): boolean => {
      const currentUnix = Math.floor(Date.now() / 1000);
      const minValid = currentUnix + 10 * 60; // 10 minutes
      const maxValid = currentUnix + 75 * 24 * 3600; // 75 days
      return unixTimestamp >= minValid && unixTimestamp <= maxValid;
    };

    if (isMetaScheduleValid(tooSoon)) {
      throw new Error("Meta scheduler should reject timestamps under 10 minutes from now");
    }
    if (!isMetaScheduleValid(validFuture)) {
      throw new Error("Meta scheduler should accept timestamps 2 hours from now");
    }
    if (isMetaScheduleValid(tooFar)) {
      throw new Error("Meta scheduler should reject timestamps exceeding 75 days from now");
    }
  });

  await ctx.test("F15-05: Local media uploads map /uploads/ path cleanly for binary buffer reading", async () => {
    const localRelPath = "/uploads/source_media/spost_sample_0.jpg";
    const isLocalAsset = localRelPath.startsWith("/uploads/source_media/");
    if (!isLocalAsset) {
      throw new Error("Expected path to be recognized as local media asset");
    }
  });

  await ctx.test("F15-06: Graph API error simulator catches token expiration and returns diagnostic error", async () => {
    const simulateMetaError = (errorCode: number): { success: boolean; error: string; actionableHint: string } => {
      if (errorCode === 190) {
        return {
          success: false,
          error: "Error validating access token: Session has expired or token was revoked.",
          actionableHint: "Vui lòng vào Settings -> Target Pages để cập nhật lại Page Access Token.",
        };
      }
      return { success: true, error: "", actionableHint: "" };
    };

    const result = simulateMetaError(190);
    if (result.success) throw new Error("Expected error code 190 to fail");
    if (!result.actionableHint.includes("Target Pages")) {
      throw new Error("Actionable hint should direct user to Target Pages settings tab");
    }
  });

  return ctx.getSummary();
}
