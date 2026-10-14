/**
 * tests/e2e/r1_r4/tier1/f8_evergreen_fallback.test.ts
 * Tier 1 — Feature F8: Evergreen Content Fallback (> 15-30 days)
 * Verifies exact notice "Tất cả bài gần nhất đều đã được lấy", 15-day age threshold,
 * engagement ranking, and status transition to 'evergreen_repurposed'.
 */

import { TestRunnerContext } from "../../harness/runnerHelper";
import { createTestDatabase } from "../../harness/testDb";
import {
  saveSourcePage,
  collectPosts,
  findEvergreenCandidates,
  triggerEvergreenFallback,
} from "../../harness/serviceLoader";
import { TestSuiteSummary } from "../../types";

export async function runTier1F8EvergreenFallbackTests(): Promise<TestSuiteSummary> {
  const ctx = new TestRunnerContext("F8: Evergreen Content Fallback (>15-30 days)", 1, "F8");

  await ctx.test("F8-01: When all recent posts are duplicates, system flags allAlreadyCollected = true", async () => {
    const db = createTestDatabase();
    await saveSourcePage(db, {
      id: "src_eg_flag",
      name: "Evergreen Flag Test",
      url: "https://facebook.com/eg.flag",
      inputMode: "url_scrape",
      scanPostLimit: 2,
      status: "active",
      totalPostsScanned: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const posts = [
      { facebookPostId: "eg_p1", originalContent: "Bài đã lưu 1" },
      { facebookPostId: "eg_p2", originalContent: "Bài đã lưu 2" },
    ];

    // Seed posts first
    await collectPosts(db, { sourcePageId: "src_eg_flag", limit: 2 }, posts);

    // Re-collect identical posts
    const result = await collectPosts(db, { sourcePageId: "src_eg_flag", limit: 2 }, posts);

    if (!result.allAlreadyCollected) {
      throw new Error("Expected allAlreadyCollected to be true when 100% of posts are skipped");
    }
  });

  await ctx.test("F8-02: Verbatim notice check: 'Tất cả bài gần nhất đều đã được lấy'", async () => {
    const db = createTestDatabase();
    await saveSourcePage(db, {
      id: "src_eg_notice",
      name: "Evergreen Notice Test",
      url: "https://facebook.com/eg.notice",
      inputMode: "url_scrape",
      scanPostLimit: 1,
      status: "active",
      totalPostsScanned: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const post = [{ facebookPostId: "notice_post_1", originalContent: "Nội dung bài kiểm tra thông báo" }];
    await collectPosts(db, { sourcePageId: "src_eg_notice", limit: 1 }, post);

    const reResult = await collectPosts(db, { sourcePageId: "src_eg_notice", limit: 1 }, post);

    const expectedVerbatim = "Tất cả bài gần nhất đều đã được lấy";
    if (!reResult.message.includes(expectedVerbatim)) {
      throw new Error(`Expected message to contain verbatim '${expectedVerbatim}', got '${reResult.message}'`);
    }
  });

  await ctx.test("F8-03: Past post candidate selection strictly respects > 15 days age threshold", async () => {
    const db = createTestDatabase();
    const sourcePageId = "src_eg_age";
    await saveSourcePage(db, {
      id: sourcePageId,
      name: "Evergreen Age Test",
      url: "https://facebook.com/eg.age",
      inputMode: "url_scrape",
      scanPostLimit: 5,
      status: "active",
      totalPostsScanned: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;

    // Post 1: 5 days old (Too recent - should be excluded)
    // Post 2: 14 days old (Too recent - boundary test, should be excluded)
    // Post 3: 20 days old (Eligible! > 15 days)
    // Post 4: 45 days old (Eligible! > 15 days)
    await collectPosts(db, { sourcePageId, limit: 4 }, [
      {
        facebookPostId: "p_5_days",
        originalContent: "Bài mới đăng 5 ngày trước",
        publishedTime: new Date(now - 5 * DAY_MS).toISOString(),
        likeCount: 500,
      },
      {
        facebookPostId: "p_14_days",
        originalContent: "Bài mới đăng 14 ngày trước",
        publishedTime: new Date(now - 14 * DAY_MS).toISOString(),
        likeCount: 900,
      },
      {
        facebookPostId: "p_20_days",
        originalContent: "Bài đăng 20 ngày trước giá trị cao",
        publishedTime: new Date(now - 20 * DAY_MS).toISOString(),
        likeCount: 300,
      },
      {
        facebookPostId: "p_45_days",
        originalContent: "Bài đăng 45 ngày trước",
        publishedTime: new Date(now - 45 * DAY_MS).toISOString(),
        likeCount: 200,
      },
    ]);

    const candidates = await findEvergreenCandidates(db, sourcePageId, new Date(now));

    if (candidates.length !== 2) {
      throw new Error(`Expected exactly 2 eligible candidates (>15 days), got ${candidates.length}`);
    }

    const postIds = candidates.map((c) => c.post.facebookPostId);
    if (postIds.includes("p_5_days") || postIds.includes("p_14_days")) {
      throw new Error("Candidates younger than 15 days were illegally included!");
    }
    if (!postIds.includes("p_20_days") || !postIds.includes("p_45_days")) {
      throw new Error("Candidates older than 15 days were missing!");
    }
  });

  await ctx.test("F8-04: Engagement ranking sorts candidates by (likes + comments*2 + shares*3) DESC", async () => {
    const db = createTestDatabase();
    const sourcePageId = "src_eg_rank";
    await saveSourcePage(db, {
      id: sourcePageId,
      name: "Evergreen Rank Page",
      url: "https://facebook.com/eg.rank",
      inputMode: "url_scrape",
      scanPostLimit: 5,
      status: "active",
      totalPostsScanned: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;

    // Candidate A: 25 days old, 100 likes, 10 comments, 5 shares => Score = 100 + 20 + 15 = 135
    // Candidate B: 30 days old, 500 likes, 50 comments, 20 shares => Score = 500 + 100 + 60 = 660 (Top!)
    // Candidate C: 20 days old, 50 likes, 5 comments, 0 shares => Score = 50 + 10 = 60
    await collectPosts(db, { sourcePageId, limit: 3 }, [
      {
        facebookPostId: "p_cand_a",
        originalContent: "Candidate A",
        publishedTime: new Date(now - 25 * DAY_MS).toISOString(),
        likeCount: 100,
        commentCount: 10,
        shareCount: 5,
      },
      {
        facebookPostId: "p_cand_b",
        originalContent: "Candidate B (Top Engagement)",
        publishedTime: new Date(now - 30 * DAY_MS).toISOString(),
        likeCount: 500,
        commentCount: 50,
        shareCount: 20,
      },
      {
        facebookPostId: "p_cand_c",
        originalContent: "Candidate C",
        publishedTime: new Date(now - 20 * DAY_MS).toISOString(),
        likeCount: 50,
        commentCount: 5,
        shareCount: 0,
      },
    ]);

    const candidates = await findEvergreenCandidates(db, sourcePageId, new Date(now));

    if (candidates[0].post.facebookPostId !== "p_cand_b") {
      throw new Error(`Expected top candidate to be 'p_cand_b', got '${candidates[0].post.facebookPostId}'`);
    }
    if (candidates[0].engagementScore !== 660) {
      throw new Error(`Expected score 660, got ${candidates[0].engagementScore}`);
    }
  });

  await ctx.test("F8-05: Triggering evergreen fallback updates post status and sets evergreen_selected_at", async () => {
    const db = createTestDatabase();
    const sourcePageId = "src_eg_trigger";
    await saveSourcePage(db, {
      id: sourcePageId,
      name: "Evergreen Trigger Page",
      url: "https://facebook.com/eg.trigger",
      inputMode: "url_scrape",
      scanPostLimit: 5,
      status: "active",
      totalPostsScanned: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;

    await collectPosts(db, { sourcePageId, limit: 1 }, [
      {
        id: "spost_trigger_me",
        facebookPostId: "fb_trigger_1",
        originalContent: "Bài viết chuẩn bị xào lại theo góc nhìn mới",
        publishedTime: new Date(now - 22 * DAY_MS).toISOString(),
        likeCount: 800,
      },
    ]);

    const updatedPost = await triggerEvergreenFallback(db, "spost_trigger_me");

    if (!updatedPost) throw new Error("triggerEvergreenFallback returned null");
    if (updatedPost.status !== "evergreen_repurposed") {
      throw new Error(`Expected status 'evergreen_repurposed', got '${updatedPost.status}'`);
    }
    if (!updatedPost.evergreenSelectedAt) {
      throw new Error("Expected evergreenSelectedAt timestamp to be populated");
    }
  });

  await ctx.test("F8-06: Automatically suggests top evergreen candidate in collectPosts response", async () => {
    const db = createTestDatabase();
    const sourcePageId = "src_eg_auto_suggest";
    await saveSourcePage(db, {
      id: sourcePageId,
      name: "Evergreen Auto Suggest",
      url: "https://facebook.com/eg.auto",
      inputMode: "url_scrape",
      scanPostLimit: 1,
      status: "active",
      totalPostsScanned: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;

    // Pre-seed an older high-engagement post
    await collectPosts(db, { sourcePageId, limit: 1 }, [
      {
        facebookPostId: "old_viral_post",
        originalContent: "Kinh nghiệm du lịch Đà Lạt mùa mưa",
        publishedTime: new Date(now - 25 * DAY_MS).toISOString(),
        likeCount: 1500,
      },
    ]);

    // Now re-scan: duplicate triggers fallback
    const result = await collectPosts(db, { sourcePageId, limit: 1 }, [
      {
        facebookPostId: "old_viral_post",
        originalContent: "Kinh nghiệm du lịch Đà Lạt mùa mưa",
        publishedTime: new Date(now - 25 * DAY_MS).toISOString(),
        likeCount: 1500,
      },
    ]);

    if (!result.allAlreadyCollected) {
      throw new Error("Expected allAlreadyCollected = true");
    }
    if (!result.evergreenSuggestion) {
      throw new Error("Expected evergreenSuggestion to be attached to collect result");
    }
    if (result.evergreenSuggestion.facebookPostId !== "old_viral_post") {
      throw new Error(`Expected suggestion 'old_viral_post', got '${result.evergreenSuggestion.facebookPostId}'`);
    }
  });

  return ctx.getSummary();
}
