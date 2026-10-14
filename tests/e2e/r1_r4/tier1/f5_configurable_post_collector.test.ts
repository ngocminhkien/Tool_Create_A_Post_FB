/**
 * tests/e2e/r1_r4/tier1/f5_configurable_post_collector.test.ts
 * Tier 1 — Feature F5: Configurable Post Collector (1-10 posts)
 * Verifies post collection limits, clamping behavior (1-10), engagement parsing, and timestamps.
 */

import { TestRunnerContext } from "../../harness/runnerHelper";
import { createTestDatabase } from "../../harness/testDb";
import {
  saveSourcePage,
  collectPosts,
} from "../../harness/serviceLoader";
import { TestSuiteSummary } from "../../types";

export async function runTier1F5ConfigurableCollectorTests(): Promise<TestSuiteSummary> {
  const ctx = new TestRunnerContext("F5: Configurable Post Collector (1-10)", 1, "F5");

  await ctx.test("F5-01: Ingest with limit = 1 extracts exactly 1 latest post", async () => {
    const db = createTestDatabase();
    await saveSourcePage(db, {
      id: "src_coll_1",
      name: "Collector Test 1",
      url: "https://facebook.com/coll.1",
      inputMode: "url_scrape",
      scanPostLimit: 1,
      status: "active",
      totalPostsScanned: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const candidates = [
      { facebookPostId: "post_1", originalContent: "Bài viết 1" },
      { facebookPostId: "post_2", originalContent: "Bài viết 2" },
      { facebookPostId: "post_3", originalContent: "Bài viết 3" },
    ];

    const result = await collectPosts(db, { sourcePageId: "src_coll_1", limit: 1 }, candidates);

    if (result.totalScanned !== 1) {
      throw new Error(`Expected exactly 1 post scanned, got ${result.totalScanned}`);
    }
    if (result.newCollected !== 1) {
      throw new Error(`Expected 1 post collected, got ${result.newCollected}`);
    }
    if (result.posts.length !== 1 || result.posts[0].facebookPostId !== "post_1") {
      throw new Error("First candidate was not collected properly");
    }
  });

  await ctx.test("F5-02: Ingest with limit = 5 extracts 5 posts in sequential order", async () => {
    const db = createTestDatabase();
    await saveSourcePage(db, {
      id: "src_coll_5",
      name: "Collector Test 5",
      url: "https://facebook.com/coll.5",
      inputMode: "url_scrape",
      scanPostLimit: 5,
      status: "active",
      totalPostsScanned: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const candidates = Array.from({ length: 7 }, (_, i) => ({
      facebookPostId: `post_5_${i + 1}`,
      originalContent: `Nội dung cập nhật bài ${i + 1}`,
      publishedTime: new Date(Date.now() - i * 3600000).toISOString(),
    }));

    const result = await collectPosts(db, { sourcePageId: "src_coll_5", limit: 5 }, candidates);

    if (result.totalScanned !== 5) {
      throw new Error(`Expected 5 posts scanned, got ${result.totalScanned}`);
    }
    if (result.posts.length !== 5) {
      throw new Error(`Expected 5 collected posts, got ${result.posts.length}`);
    }
  });

  await ctx.test("F5-03: Ingest with limit = 10 extracts maximum batch size of 10 posts", async () => {
    const db = createTestDatabase();
    await saveSourcePage(db, {
      id: "src_coll_10",
      name: "Collector Test 10",
      url: "https://facebook.com/coll.10",
      inputMode: "url_scrape",
      scanPostLimit: 10,
      status: "active",
      totalPostsScanned: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const candidates = Array.from({ length: 15 }, (_, i) => ({
      facebookPostId: `post_10_${i + 1}`,
      originalContent: `Nội dung cập nhật bài ${i + 1}`,
    }));

    const result = await collectPosts(db, { sourcePageId: "src_coll_10", limit: 10 }, candidates);

    if (result.totalScanned !== 10) {
      throw new Error(`Expected 10 posts scanned, got ${result.totalScanned}`);
    }
    if (result.posts.length !== 10) {
      throw new Error(`Expected 10 collected posts, got ${result.posts.length}`);
    }
  });

  await ctx.test("F5-04: Limit = 0 or negative is clamped to 1", async () => {
    const db = createTestDatabase();
    await saveSourcePage(db, {
      id: "src_coll_zero",
      name: "Collector Zero",
      url: "https://facebook.com/coll.zero",
      inputMode: "url_scrape",
      scanPostLimit: 5,
      status: "active",
      totalPostsScanned: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const candidates = [
      { facebookPostId: "p_zero_1", originalContent: "Test Zero 1" },
      { facebookPostId: "p_zero_2", originalContent: "Test Zero 2" },
    ];

    const result = await collectPosts(db, { sourcePageId: "src_coll_zero", limit: 0 }, candidates);
    if (result.totalScanned !== 1) {
      throw new Error(`Limit 0 should be clamped to 1, got ${result.totalScanned}`);
    }

    const resultNeg = await collectPosts(db, { sourcePageId: "src_coll_zero", limit: -4 }, [
      { facebookPostId: "p_neg_1", originalContent: "Test Neg 1" },
      { facebookPostId: "p_neg_2", originalContent: "Test Neg 2" },
    ]);
    if (resultNeg.totalScanned !== 1) {
      throw new Error(`Negative limit should be clamped to 1, got ${resultNeg.totalScanned}`);
    }
  });

  await ctx.test("F5-05: Limit exceeding 10 is clamped to 10", async () => {
    const db = createTestDatabase();
    await saveSourcePage(db, {
      id: "src_coll_over",
      name: "Collector Over",
      url: "https://facebook.com/coll.over",
      inputMode: "url_scrape",
      scanPostLimit: 5,
      status: "active",
      totalPostsScanned: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const candidates = Array.from({ length: 25 }, (_, i) => ({
      facebookPostId: `p_over_${i + 1}`,
      originalContent: `Test Over ${i + 1}`,
    }));

    const result = await collectPosts(db, { sourcePageId: "src_coll_over", limit: 25 }, candidates);
    if (result.totalScanned !== 10) {
      throw new Error(`Limit exceeding 10 must clamp to 10, got ${result.totalScanned}`);
    }
  });

  await ctx.test("F5-06: Extracted posts preserve engagement metrics and ISO published timestamp", async () => {
    const db = createTestDatabase();
    await saveSourcePage(db, {
      id: "src_coll_metrics",
      name: "Collector Metrics",
      url: "https://facebook.com/coll.metrics",
      inputMode: "url_scrape",
      scanPostLimit: 5,
      status: "active",
      totalPostsScanned: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const isoTime = "2026-04-10T14:30:00.000Z";
    const candidates = [
      {
        facebookPostId: "p_metric_1",
        originalContent: "Bài viết có chỉ số tương tác cao",
        publishedTime: isoTime,
        likeCount: 1250,
        commentCount: 340,
        shareCount: 88,
      },
    ];

    const result = await collectPosts(db, { sourcePageId: "src_coll_metrics", limit: 1 }, candidates);
    const post = result.posts[0];

    if (post.likeCount !== 1250) throw new Error(`Expected 1250 likes, got ${post.likeCount}`);
    if (post.commentCount !== 340) throw new Error(`Expected 340 comments, got ${post.commentCount}`);
    if (post.shareCount !== 88) throw new Error(`Expected 88 shares, got ${post.shareCount}`);
    if (post.publishedTime !== isoTime) throw new Error(`Expected ISO timestamp, got ${post.publishedTime}`);
  });

  return ctx.getSummary();
}
