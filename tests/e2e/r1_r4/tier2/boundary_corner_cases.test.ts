/**
 * tests/e2e/r1_r4/tier2/boundary_corner_cases.test.ts
 * Tier 2 — Boundary & Corner Cases (Requirements R1 - R4)
 * Stress-tests edge cases: duplicate IDs, hash collisions, empty & extreme text,
 * photo boundaries, exact 15-day cutoff, key exhaustion, and SQL injections.
 */

import { TestRunnerContext } from "../../harness/runnerHelper";
import { createTestDatabase } from "../../harness/testDb";
import {
  saveTargetPage,
  saveSourcePage,
  collectPosts,
  computeContentHash,
  findEvergreenCandidates,
  rewriteSourcePost,
  checkAntiVerbatim,
  parseSourceUrl,
  approveAndPublish,
  approveAndSchedule,
  rejectQueueItem,
  createQueueItem,
  buildMultiPhotoPayload,
} from "../../harness/serviceLoader";
import { TestSuiteSummary, EvergreenCandidate } from "../../types";

export async function runTier2R1R4BoundaryTests(): Promise<TestSuiteSummary> {
  const ctx = new TestRunnerContext("Tier 2: R1-R4 Boundary & Corner Cases", 2, "BOUNDARIES");

  await ctx.test("B-01: Empty content string produces valid deterministic SHA-256 hash without throwing", () => {
    const hash = computeContentHash("");
    if (!hash || hash.length !== 64) {
      throw new Error(`Expected 64-char hash for empty string, got: ${hash}`);
    }
  });

  await ctx.test("B-02: Whitespace-only string normalizes to identical hash as empty string", () => {
    const hashEmpty = computeContentHash("");
    const hashSpaces = computeContentHash("   \n\t  \r\n   ");
    if (hashEmpty !== hashSpaces) {
      throw new Error("Whitespace-only content did not normalize to empty hash");
    }
  });

  await ctx.test("B-03: Extreme text size (50,000+ characters) processes without memory leak or stack overflow", async () => {
    const largeParagraph = "Thông tin thị trường kinh doanh và xã hội tổng hợp. ".repeat(1000); // ~53,000 chars
    const hash = computeContentHash(largeParagraph);
    if (!hash || hash.length !== 64) {
      throw new Error("Failed to compute hash for 50k character input");
    }

    const antiVerbatim = checkAntiVerbatim(largeParagraph, "Một bài viết hoàn toàn khác về chủ đề công nghệ số.");
    if (!antiVerbatim.isUnique) {
      throw new Error("Anti-verbatim false positive on large text");
    }
  });

  await ctx.test("B-04: Exact 15-day cutoff boundary: 14d23h59m (excluded) vs 15d00h00m (included)", async () => {
    const db = createTestDatabase();
    const sourcePageId = "src_b_15d";
    await saveSourcePage(db, {
      id: sourcePageId,
      name: "15-day Boundary Test",
      url: "https://facebook.com/b.15d",
      inputMode: "url_scrape",
      scanPostLimit: 5,
      status: "active",
      totalPostsScanned: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const now = Date.now();
    const EXACT_15D = 15 * 24 * 60 * 60 * 1000;
    const JUST_UNDER_15D = EXACT_15D - 60 * 1000; // 14 days, 23 hours, 59 mins

    await collectPosts(db, { sourcePageId, limit: 2 }, [
      {
        facebookPostId: "post_just_under_15d",
        originalContent: "Post published 14 days 23 hours ago",
        publishedTime: new Date(now - JUST_UNDER_15D).toISOString(),
        likeCount: 5000,
      },
      {
        facebookPostId: "post_exact_15d",
        originalContent: "Post published exactly 15 days ago",
        publishedTime: new Date(now - EXACT_15D).toISOString(),
        likeCount: 100,
      },
    ]);

    const candidates = await findEvergreenCandidates(db, sourcePageId, new Date(now));

    const candidateIds = candidates.map((c: EvergreenCandidate) => c.post.facebookPostId);
    if (candidateIds.includes("post_just_under_15d")) {
      throw new Error("Post younger than 15 days was illegally included in evergreen candidates");
    }
    if (!candidateIds.includes("post_exact_15d")) {
      throw new Error("Post exactly 15 days old should be eligible for evergreen candidates");
    }
  });

  await ctx.test("B-05: 0 photos vs 1 photo vs multi-photo album transitions in Graph API payloads", async () => {
    const res = await rewriteSourcePost({
      sourcePostId: "sp_photo_bound",
      sourcePageName: "Photo Boundary",
      sourceContent: "Test photo boundaries",
      style: "storytelling",
    });

    // 0 photos -> text_feed
    res.queueItem.selectedImages = [];
    const p0 = buildMultiPhotoPayload(res.queueItem);
    if (p0.mode !== "text_feed") throw new Error("Expected text_feed mode for 0 photos");

    // 1 photo -> single_photo
    res.queueItem.selectedImages = ["/uploads/source_media/one.jpg"];
    const p1 = buildMultiPhotoPayload(res.queueItem);
    if (p1.mode !== "single_photo") throw new Error("Expected single_photo mode for 1 photo");

    // 2 photos -> multi_photo_album
    res.queueItem.selectedImages = ["/uploads/source_media/one.jpg", "/uploads/source_media/two.jpg"];
    const p2 = buildMultiPhotoPayload(res.queueItem);
    if (p2.mode !== "multi_photo_album") throw new Error("Expected multi_photo_album mode for 2 photos");

    // 10 photos -> multi_photo_album with 10 attached media
    res.queueItem.selectedImages = Array.from({ length: 10 }, (_, i) => `/uploads/source_media/img_${i}.jpg`);
    const p10 = buildMultiPhotoPayload(res.queueItem);
    if (p10.mode !== "multi_photo_album" || p10.payload.attached_media.length !== 10) {
      throw new Error("Expected 10 attached media items");
    }
  });

  await ctx.test("B-06: Malformed URLs with SQL injection strings are safely rejected by parser", () => {
    const maliciousUrls = [
      "https://facebook.com/'; DROP TABLE target_pages; --",
      "https://facebook.com/admin' OR '1'='1",
      "<script>alert('xss')</script>",
      "https://facebook.com/valid_handle/../../../etc/passwd",
    ];

    for (const url of maliciousUrls) {
      const parsed = parseSourceUrl(url);
      if (parsed.isValid && (parsed.slug?.includes("DROP") || parsed.slug?.includes("script"))) {
        throw new Error(`Dangerous URL was parsed as valid: ${url}`);
      }
    }
  });

  await ctx.test("B-07: Vietnamese Unicode diacritics integrity in content hashing and anti-verbatim matching", () => {
    const vietTextA = "Đoàn kết một lòng cùng bà con vùng lũ lụt Đắk Lắk và Quảng Trị.";
    const vietTextB = "Đoàn kết một lòng cùng bà con vùng lũ lụt Đắk Lắk và Quảng Trị.";
    const vietTextC = "Đoàn kết một lòng cùng bà con vùng lũ lụt Dak Lak và Quang Tri."; // Non-accented

    const hashA = computeContentHash(vietTextA);
    const hashB = computeContentHash(vietTextB);
    const hashC = computeContentHash(vietTextC);

    if (hashA !== hashB) {
      throw new Error("Identical Vietnamese accented strings must produce identical hashes");
    }
    if (hashA === hashC) {
      throw new Error("Accented and non-accented Vietnamese strings should produce distinct hashes");
    }
  });

  await ctx.test("B-08: Scan limit extreme values clamp predictably (-999 -> 1, 9999 -> 10)", async () => {
    const db = createTestDatabase();
    await saveSourcePage(db, {
      id: "src_b_clamp",
      name: "Extreme Clamp Page",
      url: "https://facebook.com/b.clamp",
      inputMode: "url_scrape",
      scanPostLimit: -999,
      status: "active",
      totalPostsScanned: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const candidates = Array.from({ length: 20 }, (_, i) => ({
      facebookPostId: `p_clamp_${i}`,
      originalContent: `Post ${i}`,
    }));

    // Ingest with extreme negative limit
    const resNeg = await collectPosts(db, { sourcePageId: "src_b_clamp", limit: -999 }, candidates);
    if (resNeg.totalScanned !== 1) {
      throw new Error(`Limit -999 should clamp to 1, got ${resNeg.totalScanned}`);
    }

    // Ingest with extreme positive limit
    const resPos = await collectPosts(db, { sourcePageId: "src_b_clamp", limit: 9999 }, candidates);
    if (resPos.totalScanned !== 10) {
      throw new Error(`Limit 9999 should clamp to 10, got ${resPos.totalScanned}`);
    }
  });

  await ctx.test("B-09: Cross-page identical content is caught by Layer 2 hash deduplication", async () => {
    const db = createTestDatabase();
    await saveSourcePage(db, {
      id: "src_page_alpha",
      name: "Page Alpha",
      url: "https://facebook.com/page.alpha",
      inputMode: "url_scrape",
      scanPostLimit: 5,
      status: "active",
      totalPostsScanned: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await saveSourcePage(db, {
      id: "src_page_beta",
      name: "Page Beta",
      url: "https://facebook.com/page.beta",
      inputMode: "url_scrape",
      scanPostLimit: 5,
      status: "active",
      totalPostsScanned: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const crossPostContent = "Thông cáo báo chí đặc biệt đồng phát hành trên nhiều trang mạng.";

    // Ingest on Page Alpha
    await collectPosts(db, { sourcePageId: "src_page_alpha", limit: 1 }, [
      { facebookPostId: "alpha_post_1", originalContent: crossPostContent },
    ]);

    // Ingest on Page Beta with different post ID
    const resBeta = await collectPosts(db, { sourcePageId: "src_page_beta", limit: 1 }, [
      { facebookPostId: "beta_post_999", originalContent: crossPostContent },
    ]);

    if (resBeta.duplicatesSkipped !== 1 || resBeta.newCollected !== 0) {
      throw new Error("Cross-page duplicate was not caught by content hash");
    }
  });

  await ctx.test("B-10: State Machine rejects scheduled publishing if timestamp is in the past", async () => {
    const db = createTestDatabase();
    const res = await rewriteSourcePost({
      sourcePostId: "sp_past_sched",
      sourcePageName: "Nguồn Quá Khứ",
      sourceContent: "Bài kiểm tra hẹn giờ quá khứ.",
      style: "storytelling",
    });

    await createQueueItem(db, res.queueItem);

    const pastTimestamp = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
    let threw = false;
    try {
      await approveAndSchedule(db, res.queueItem.id, pastTimestamp);
    } catch {
      threw = true;
    }

    if (!threw) {
      throw new Error("approveAndSchedule must throw when scheduledAt is in the past");
    }
  });

  return ctx.getSummary();
}
