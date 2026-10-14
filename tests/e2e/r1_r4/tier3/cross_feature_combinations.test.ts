/**
 * tests/e2e/r1_r4/tier3/cross_feature_combinations.test.ts
 * Tier 3 — Cross-Feature Combinations (Requirements R1 - R4)
 * Verifies complex multi-feature workflows connecting Page Management, Collection,
 * Deduplication, Evergreen Fallback, AI Repurposing, Policy Guard, and Moderation Actions.
 */

import { TestRunnerContext } from "../../harness/runnerHelper";
import { createTestDatabase } from "../../harness/testDb";
import {
  saveTargetPage,
  saveSourcePage,
  collectPosts,
  findEvergreenCandidates,
  triggerEvergreenFallback,
  rewriteSourcePost,
  createQueueItem,
  getQueueItemById,
  updateQueueDraft,
  approveAndSchedule,
  approveAndPublish,
  requestRevision,
  getUpcomingPreset,
  buildMultiPhotoPayload,
} from "../../harness/serviceLoader";
import { TestSuiteSummary } from "../../types";

export async function runTier3R1R4CombinationTests(): Promise<TestSuiteSummary> {
  const ctx = new TestRunnerContext("Tier 3: R1-R4 Cross-Feature Combinations", 3, "COMBINATIONS");

  await ctx.test("C-01: Full Pipeline: Ingest -> Deduplicate -> Download Media -> AI Rewrite -> Auto-Sanitize -> Queue -> Schedule", async () => {
    const db = createTestDatabase();

    // 1. Setup Target Page & Source Page
    await saveTargetPage(db, {
      id: "tgt_pipeline",
      pageId: "fb_page_pipeline_1",
      pageName: "Fanpage Đích Pipeline",
      accessToken: "token_pipeline_secret",
      isDefault: true,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await saveSourcePage(db, {
      id: "src_pipeline",
      name: "Fanpage Nguồn Pipeline",
      url: "https://facebook.com/pipeline.source",
      inputMode: "url_scrape",
      scanPostLimit: 5,
      status: "active",
      totalPostsScanned: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 2. Ingest post with attached media
    const rawContent = "Khai trương chi nhánh mới cam kết 100% mang lại trải nghiệm đỉnh cao cho khách hàng.";
    const rawImages = ["https://example.com/store_front.jpg"];
    const collectRes = await collectPosts(db, { sourcePageId: "src_pipeline", limit: 1 }, [
      {
        facebookPostId: "p_pipeline_100",
        originalContent: rawContent,
        originalMediaUrls: rawImages,
        publishedTime: new Date().toISOString(),
      },
    ]);

    if (collectRes.newCollected !== 1) {
      throw new Error("Pipeline step 2 (ingestion) failed");
    }
    const collectedPost = collectRes.posts[0];

    // 3. AI Rewrite with auto-policy sanitize & hashtags
    const rewriteRes = await rewriteSourcePost({
      sourcePostId: collectedPost.id,
      sourcePageName: "Fanpage Nguồn Pipeline",
      sourceContent: collectedPost.originalContent,
      sourceImages: collectedPost.mediaUrls,
      targetPageId: "tgt_pipeline",
      targetPageName: "Fanpage Đích Pipeline",
      style: "direct_sales",
    });

    const queueItem = rewriteRes.queueItem;
    if (queueItem.aiFullPost.includes("cam kết 100%")) {
      throw new Error("Pipeline step 3 failed: absolute claim was not auto-sanitized");
    }
    if (queueItem.status !== "pending") {
      throw new Error("Pipeline step 3 failed: status must be pending");
    }

    // 4. Save to Moderation Queue in SQLite
    await createQueueItem(db, queueItem);

    // 5. Select Golden Hour Evening slot & Approve Schedule
    const eveningSlot = await getUpcomingPreset("evening");
    const scheduled = await approveAndSchedule(db, queueItem.id, eveningSlot.timestamp);

    if (scheduled.status !== "scheduled" || scheduled.scheduledAt !== eveningSlot.timestamp) {
      throw new Error("Pipeline step 5 (scheduling) failed");
    }

    // Verify database state
    const saved = await getQueueItemById(db, queueItem.id);
    if (saved?.status !== "scheduled") {
      throw new Error("Database state does not reflect scheduled status");
    }
  });

  await ctx.test("C-02: Evergreen Fallback Recycling -> AI Repurposing -> Moderation Queue", async () => {
    const db = createTestDatabase();
    const sourcePageId = "src_comb_eg";
    await saveSourcePage(db, {
      id: sourcePageId,
      name: "Nguồn Evergreen",
      url: "https://facebook.com/comb.eg",
      inputMode: "url_scrape",
      scanPostLimit: 1,
      status: "active",
      totalPostsScanned: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const now = Date.now();
    const DAY_MS = 24 * 3600 * 1000;

    // Seed post from 25 days ago with high engagement (likes: 1200)
    await collectPosts(db, { sourcePageId, limit: 1 }, [
      {
        id: "spost_viral_past",
        facebookPostId: "fb_viral_25d",
        originalContent: "Bí quyết quản trị tài chính cá nhân hiệu quả mùa lạm phát.",
        publishedTime: new Date(now - 25 * DAY_MS).toISOString(),
        likeCount: 1200,
        commentCount: 150,
        shareCount: 60,
      },
    ]);

    // Rescan: duplicate triggers verbatim notice and evergreen suggestion
    const rescan = await collectPosts(db, { sourcePageId, limit: 1 }, [
      {
        facebookPostId: "fb_viral_25d",
        originalContent: "Bí quyết quản trị tài chính cá nhân hiệu quả mùa lạm phát.",
        publishedTime: new Date(now - 25 * DAY_MS).toISOString(),
      },
    ]);

    if (!rescan.allAlreadyCollected || !rescan.evergreenSuggestion) {
      throw new Error("Evergreen fallback was not automatically suggested on duplicate collection");
    }

    // Trigger evergreen fallback
    const evergreenPost = await triggerEvergreenFallback(db, rescan.evergreenSuggestion.id);
    if (!evergreenPost || evergreenPost.status !== "evergreen_repurposed") {
      throw new Error("Failed to mark post as evergreen_repurposed");
    }

    // Repurpose using AI with evergreen angle
    const rewriteRes = await rewriteSourcePost({
      sourcePostId: evergreenPost.id,
      sourcePageName: "Nguồn Evergreen",
      sourceContent: evergreenPost.originalContent,
      style: "storytelling",
      isEvergreen: true,
      customInstruction: "Nhìn lại bài học quản trị tài chính dưới góc nhìn mới",
    });

    await createQueueItem(db, rewriteRes.queueItem);
    const queueSaved = await getQueueItemById(db, rewriteRes.queueItem.id);

    if (queueSaved?.status !== "pending") {
      throw new Error("Repurposed evergreen post must enter queue in 'pending' status");
    }
  });

  await ctx.test("C-03: Multi-Photo Album Ingestion -> Selection Subsetting -> Publishing Payload", async () => {
    const db = createTestDatabase();
    await saveSourcePage(db, {
      id: "src_comb_album",
      name: "Nguồn Album Ảnh",
      url: "https://facebook.com/comb.album",
      inputMode: "url_scrape",
      scanPostLimit: 1,
      status: "active",
      totalPostsScanned: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const albumImages = [
      "https://example.com/photo_1.jpg",
      "https://example.com/photo_2.jpg",
      "https://example.com/photo_3.jpg",
      "https://example.com/blurry_photo_4.jpg",
    ];

    const collectRes = await collectPosts(db, { sourcePageId: "src_comb_album", limit: 1 }, [
      {
        facebookPostId: "fb_album_4_imgs",
        originalContent: "Bộ ảnh sự kiện công ty",
        originalMediaUrls: albumImages,
        publishedTime: new Date().toISOString(),
      },
    ]);

    const post = collectRes.posts[0];
    const rewriteRes = await rewriteSourcePost({
      sourcePostId: post.id,
      sourcePageName: "Nguồn Album Ảnh",
      sourceContent: post.originalContent,
      sourceImages: post.mediaUrls,
      targetPageId: "tgt_album_dest",
      style: "news_guide",
    });

    await createQueueItem(db, rewriteRes.queueItem);

    // Reviewer in Moderation Queue deselects blurry 4th photo
    const selected3 = rewriteRes.queueItem.sourceImages.slice(0, 3);
    const updated = await updateQueueDraft(db, rewriteRes.queueItem.id, {
      selectedImages: selected3,
    });

    if (updated.selectedImages.length !== 3) {
      throw new Error(`Expected 3 selected images after curation, got ${updated.selectedImages.length}`);
    }

    const payload = buildMultiPhotoPayload(updated);
    if (payload.mode !== "multi_photo_album") {
      throw new Error(`Expected multi_photo_album mode, got ${payload.mode}`);
    }
    if (payload.payload.attached_media.length !== 3) {
      throw new Error(`Expected exactly 3 attached_media items in Graph API payload, got ${payload.payload.attached_media.length}`);
    }
  });

  await ctx.test("C-04: Revision Request Loop: Pending -> Revision Requested -> Count Increments -> Approved", async () => {
    const db = createTestDatabase();
    const res = await rewriteSourcePost({
      sourcePostId: "sp_comb_revision",
      sourcePageName: "Page Thử Thách",
      sourceContent: "Bài viết ban đầu có phần hơi dài dòng.",
      style: "storytelling",
    });

    await createQueueItem(db, res.queueItem);

    // Reviewer requests AI revision
    const rev1 = await requestRevision(db, res.queueItem.id, "viết ngắn gọn, súc tích hơn", "direct_sales");

    if (rev1.rewriteCount !== 2) {
      throw new Error(`Expected rewriteCount 2, got ${rev1.rewriteCount}`);
    }
    if (rev1.status !== "pending") {
      throw new Error(`Post must remain pending after revision request, got ${rev1.status}`);
    }

    // Now reviewer is satisfied and publishes
    const published = await approveAndPublish(db, res.queueItem.id, "tgt_brand_1");

    if (published.status !== "published") {
      throw new Error(`Expected published status after approval, got ${published.status}`);
    }
    if (published.rewriteCount !== 2) {
      throw new Error("rewriteCount history should be preserved after publishing");
    }
  });

  await ctx.test("C-05: Multi-Page Content Syndication across 2 Target Pages with independent scheduling", async () => {
    const db = createTestDatabase();
    await saveTargetPage(db, {
      id: "tgt_page_north",
      pageId: "fb_north",
      pageName: "Fanpage Miền Bắc",
      accessToken: "token_north",
      isDefault: true,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await saveTargetPage(db, {
      id: "tgt_page_south",
      pageId: "fb_south",
      pageName: "Fanpage Miền Nam",
      accessToken: "token_south",
      isDefault: false,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Ingest 1 post and create 2 distinct queue items destined for different Target Pages
    const resNorth = await rewriteSourcePost({
      sourcePostId: "sp_synd_1",
      sourcePageName: "Báo Tổng Hợp",
      sourceContent: "Tin tức nổi bật cho cả 2 miền.",
      targetPageId: "tgt_page_north",
      targetPageName: "Fanpage Miền Bắc",
      style: "news_guide",
    });

    const resSouth = await rewriteSourcePost({
      sourcePostId: "sp_synd_1",
      sourcePageName: "Báo Tổng Hợp",
      sourceContent: "Tin tức nổi bật cho cả 2 miền.",
      targetPageId: "tgt_page_south",
      targetPageName: "Fanpage Miền Nam",
      style: "humorous_trend",
    });

    await createQueueItem(db, resNorth.queueItem);
    await createQueueItem(db, resSouth.queueItem);

    // Schedule North for Morning 08:00, South for Evening 20:00
    const morningSlot = await getUpcomingPreset("morning");
    const eveningSlot = await getUpcomingPreset("evening");

    await approveAndSchedule(db, resNorth.queueItem.id, morningSlot.timestamp);
    await approveAndSchedule(db, resSouth.queueItem.id, eveningSlot.timestamp);

    const savedNorth = await getQueueItemById(db, resNorth.queueItem.id);
    const savedSouth = await getQueueItemById(db, resSouth.queueItem.id);

    if (savedNorth?.targetPageId !== "tgt_page_north" || savedNorth?.scheduledAt !== morningSlot.timestamp) {
      throw new Error("North syndication target or schedule corrupted");
    }
    if (savedSouth?.targetPageId !== "tgt_page_south" || savedSouth?.scheduledAt !== eveningSlot.timestamp) {
      throw new Error("South syndication target or schedule corrupted");
    }
  });

  return ctx.getSummary();
}
