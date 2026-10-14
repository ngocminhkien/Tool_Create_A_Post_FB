/**
 * tests/e2e/r1_r4/tier1/f7_smart_deduplication.test.ts
 * Tier 1 — Feature F7: 2-Layer Smart Deduplication (facebook_post_id & SHA-256 content_hash)
 * Verifies Layer 1 (post ID) and Layer 2 (content hash) deduplication, whitespace normalization, and metrics.
 */

import { TestRunnerContext } from "../../harness/runnerHelper";
import { createTestDatabase } from "../../harness/testDb";
import {
  saveSourcePage,
  collectPosts,
  computeContentHash,
  checkDeduplication,
} from "../../harness/serviceLoader";
import { TestSuiteSummary } from "../../types";

export async function runTier1F7SmartDeduplicationTests(): Promise<TestSuiteSummary> {
  const ctx = new TestRunnerContext("F7: 2-Layer Smart Deduplication", 1, "F7");

  await ctx.test("F7-01: Ingesting novel post saves to DB with newCollected = 1 and duplicatesSkipped = 0", async () => {
    const db = createTestDatabase();
    await saveSourcePage(db, {
      id: "src_dedup_1",
      name: "Dedup Page 1",
      url: "https://facebook.com/dedup.1",
      inputMode: "url_scrape",
      scanPostLimit: 5,
      status: "active",
      totalPostsScanned: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const result = await collectPosts(db, { sourcePageId: "src_dedup_1", limit: 1 }, [
      {
        facebookPostId: "fb_unique_101",
        originalContent: "Khám phá vẻ đẹp kỳ vĩ của mùa vàng Mù Cang Chải.",
        publishedTime: new Date().toISOString(),
      },
    ]);

    if (result.newCollected !== 1 || result.duplicatesSkipped !== 0) {
      throw new Error(`Expected 1 collected and 0 skipped, got ${result.newCollected} / ${result.duplicatesSkipped}`);
    }

    const row = db.prepare("SELECT * FROM source_posts WHERE facebook_post_id = 'fb_unique_101';").get() as any;
    if (!row) throw new Error("Post was not saved to SQLite source_posts table");
    if (!row.content_hash || row.content_hash.length !== 64) {
      throw new Error("Expected valid 64-character SHA-256 content hash in DB");
    }
  });

  await ctx.test("F7-02: Layer 1 (facebook_post_id) skips duplicate and increments duplicatesSkipped", async () => {
    const db = createTestDatabase();
    await saveSourcePage(db, {
      id: "src_dedup_layer1",
      name: "Dedup Layer 1 Page",
      url: "https://facebook.com/dedup.layer1",
      inputMode: "url_scrape",
      scanPostLimit: 5,
      status: "active",
      totalPostsScanned: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Ingest first time
    await collectPosts(db, { sourcePageId: "src_dedup_layer1", limit: 1 }, [
      {
        facebookPostId: "fb_repeat_id",
        originalContent: "Thông tin thị trường bất động sản tuần qua.",
      },
    ]);

    // Ingest second time with same facebook_post_id
    const secondResult = await collectPosts(db, { sourcePageId: "src_dedup_layer1", limit: 1 }, [
      {
        facebookPostId: "fb_repeat_id",
        originalContent: "Nội dung cập nhật mới hơn nhưng cùng ID.",
      },
    ]);

    if (secondResult.duplicatesSkipped !== 1 || secondResult.newCollected !== 0) {
      throw new Error(`Layer 1 failed: expected 1 skipped, got ${secondResult.duplicatesSkipped}`);
    }

    const count = (db.prepare("SELECT COUNT(*) as c FROM source_posts WHERE facebook_post_id = 'fb_repeat_id';").get() as any).c;
    if (count !== 1) {
      throw new Error(`Expected exactly 1 DB record, found ${count}`);
    }
  });

  await ctx.test("F7-03: Layer 2 (content_hash) catches identical text under different facebook_post_id", async () => {
    const db = createTestDatabase();
    await saveSourcePage(db, {
      id: "src_dedup_layer2",
      name: "Dedup Layer 2 Page",
      url: "https://facebook.com/dedup.layer2",
      inputMode: "url_scrape",
      scanPostLimit: 5,
      status: "active",
      totalPostsScanned: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const identicalText = "Cẩm nang hướng dẫn sử dụng sản phẩm từ chuyên gia.";

    // First post
    await collectPosts(db, { sourcePageId: "src_dedup_layer2", limit: 1 }, [
      {
        facebookPostId: "fb_id_alpha",
        originalContent: identicalText,
      },
    ]);

    // Second post with DIFFERENT ID but IDENTICAL text
    const result2 = await collectPosts(db, { sourcePageId: "src_dedup_layer2", limit: 1 }, [
      {
        facebookPostId: "fb_id_beta_repost",
        originalContent: identicalText,
      },
    ]);

    if (result2.duplicatesSkipped !== 1 || result2.newCollected !== 0) {
      throw new Error(`Layer 2 failed: expected identical content to be skipped, got ${result2.newCollected} collected`);
    }

    const check = checkDeduplication(db, "fb_id_beta_repost", computeContentHash(identicalText));
    if (!check.isDuplicate || check.duplicateLayer !== "content_hash") {
      throw new Error(`Expected duplicateLayer 'content_hash', got: ${check.duplicateLayer}`);
    }
  });

  await ctx.test("F7-04: Normalization strips whitespace, newlines, and carriage returns before hashing", async () => {
    const textA = "  Xu hướng trí tuệ nhân tạo \n năm 2026.  ";
    const textB = "Xu hướng trí tuệ nhân tạo\r\n\r\n năm 2026.";

    const hashA = computeContentHash(textA);
    const hashB = computeContentHash(textB);

    if (hashA !== hashB) {
      throw new Error(`Content hashes should match after normalization: ${hashA} vs ${hashB}`);
    }
    if (hashA.length !== 64) {
      throw new Error(`Expected 64-char hex string, got ${hashA.length}`);
    }
  });

  await ctx.test("F7-05: Genuinely distinct content passes deduplication successfully", async () => {
    const db = createTestDatabase();
    await saveSourcePage(db, {
      id: "src_dedup_diff",
      name: "Dedup Diff Page",
      url: "https://facebook.com/dedup.diff",
      inputMode: "url_scrape",
      scanPostLimit: 5,
      status: "active",
      totalPostsScanned: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await collectPosts(db, { sourcePageId: "src_dedup_diff", limit: 1 }, [
      { facebookPostId: "p_diff_1", originalContent: "Bài viết chủ đề Du lịch Tây Bắc" },
    ]);

    const result2 = await collectPosts(db, { sourcePageId: "src_dedup_diff", limit: 1 }, [
      { facebookPostId: "p_diff_2", originalContent: "Bài viết chủ đề Ẩm thực miền Trung đậm đà" },
    ]);

    if (result2.newCollected !== 1 || result2.duplicatesSkipped !== 0) {
      throw new Error(`Distinct post was unexpectedly marked as duplicate`);
    }
  });

  await ctx.test("F7-06: Batch collection with mix of new and duplicate posts reports accurate metrics", async () => {
    const db = createTestDatabase();
    await saveSourcePage(db, {
      id: "src_dedup_batch",
      name: "Dedup Batch Page",
      url: "https://facebook.com/dedup.batch",
      inputMode: "url_scrape",
      scanPostLimit: 5,
      status: "active",
      totalPostsScanned: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Seed post A
    await collectPosts(db, { sourcePageId: "src_dedup_batch", limit: 1 }, [
      { facebookPostId: "batch_existing_1", originalContent: "Đã tồn tại từ trước" },
    ]);

    // Batch with 1 existing post + 2 new posts
    const batchResult = await collectPosts(db, { sourcePageId: "src_dedup_batch", limit: 3 }, [
      { facebookPostId: "batch_existing_1", originalContent: "Đã tồn tại từ trước" },
      { facebookPostId: "batch_new_1", originalContent: "Bài viết hoàn toàn mới 1" },
      { facebookPostId: "batch_new_2", originalContent: "Bài viết hoàn toàn mới 2" },
    ]);

    if (batchResult.totalScanned !== 3) {
      throw new Error(`Expected totalScanned 3, got ${batchResult.totalScanned}`);
    }
    if (batchResult.newCollected !== 2) {
      throw new Error(`Expected newCollected 2, got ${batchResult.newCollected}`);
    }
    if (batchResult.duplicatesSkipped !== 1) {
      throw new Error(`Expected duplicatesSkipped 1, got ${batchResult.duplicatesSkipped}`);
    }
    if (batchResult.allAlreadyCollected) {
      throw new Error("allAlreadyCollected should be false when new posts are collected");
    }
  });

  return ctx.getSummary();
}
