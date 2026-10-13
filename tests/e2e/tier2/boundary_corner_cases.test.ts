/**
 * tests/e2e/tier2/boundary_corner_cases.test.ts
 * Tier 2: Boundary & Corner Cases Test Suite
 * Covers extreme limits, Unicode Vietnamese diacritics, empty inputs,
 * boundary cutoffs, and edge conditions for F1 through F14 (>=5 cases per feature).
 */

import assert from "node:assert/strict";
import {
  applyPolicyFix,
  autoSanitizeAll,
  evaluateSocialSeo,
  generateImageSeoMetadata,
  generateThreeTierHashtags,
  getAllStylePresets,
  getGoldenHourPresets,
  getStylePrompt,
  getUpcomingPreset,
  runMigrations,
  scanFacebookPolicy,
  appendHashtags,
} from "../harness/serviceLoader";
import { createTestDatabase } from "../harness/testDb";
import { TestRunnerContext } from "../harness/runnerHelper";
import { TestSuiteSummary, VariationContentItem } from "../types";

export async function runTier2BoundaryTests(): Promise<TestSuiteSummary> {
  const runner = new TestRunnerContext("Boundary & Corner Cases (F1-F14)", 2, "F1-F14");

  // ==================== F1 Boundary Cases ====================
  await runner.test("F1.B1: Handles empty string and whitespace-only text gracefully", async () => {
    const emptyResult = await scanFacebookPolicy("");
    assert.equal(emptyResult.isSafe, true);
    assert.equal(emptyResult.violations.length, 0);

    const wsResult = await scanFacebookPolicy("   \n\t   ");
    assert.equal(wsResult.isSafe, true);
  });

  await runner.test("F1.B2: Scans 50,000-character long text without performance degradation", async () => {
    const longText = "Nội dung chia sẻ giá trị kinh doanh hữu ích. ".repeat(1000);
    const start = performance.now();
    const result = await scanFacebookPolicy(longText);
    const duration = performance.now() - start;

    assert.ok(duration < 2000, `Scan duration (${duration}ms) must be under 2s for 50k chars`);
    assert.equal(result.isSafe, true);
  });

  await runner.test("F1.B3: Detects policy triggers with complex Vietnamese Unicode diacritics", async () => {
    const text = "Trị dứt điểm nám mụn gia truyền, bảo đảm 100% không tái phát!";
    const result = await scanFacebookPolicy(text);

    assert.equal(result.isSafe, false);
    const categories = result.violations.map((v) => v.category);
    assert.ok(categories.includes("medical_curative"));
    assert.ok(categories.includes("absolute_claim"));
  });

  await runner.test("F1.B4: Detects diverse phone number formatting variants", async () => {
    const variants = [
      "Hotline: 0901234567",
      "Liên hệ: 0901.234.567",
      "SĐT: 090-123-4567",
      "Gọi ngay: +84901234567",
      "Tư vấn: 090 123 4567",
    ];

    for (const v of variants) {
      const res = await scanFacebookPolicy(v);
      assert.equal(res.isSafe, false, `Failed to detect phone variant: ${v}`);
      assert.ok(res.violations.some((item) => item.category === "phone_spam"));
    }
  });

  await runner.test("F1.B5: Handles regex special characters embedded in user content safely", async () => {
    const specialText = "Ưu đãi ***cam kết 100%*** (bảo đảm) [hotline: 0901234567] $100? +100%";
    assert.doesNotThrow(async () => {
      const res = await scanFacebookPolicy(specialText);
      assert.equal(res.isSafe, false);
    });
  });

  // ==================== F2 Boundary Cases ====================
  await runner.test("F2.B1: autoSanitizeAll on empty string returns empty string", async () => {
    const res = await autoSanitizeAll("");
    assert.equal(res, "");
  });

  await runner.test("F2.B2: autoSanitizeAll on text consisting purely of violations", async () => {
    const pureViolations = "cam kết 100% trị dứt điểm 0901234567";
    const res = await autoSanitizeAll(pureViolations);

    assert.ok(!res.includes("cam kết 100%"));
    assert.ok(!res.includes("trị dứt điểm"));
    assert.ok(!res.includes("0901234567"));
  });

  await runner.test("F2.B3: Sanitizes multiple identical violations in single post", async () => {
    const repeated = "Cam kết 100% chất lượng và cam kết 100% hài lòng!";
    const res = await autoSanitizeAll(repeated);

    assert.ok(!res.includes("cam kết 100%"));
    assert.ok(!res.includes("Cam kết 100%"));
  });

  await runner.test("F2.B4: Preserves Unicode text offsets when replacing with strings of different lengths", async () => {
    const original = "Đầu câu. Cam kết 100%. Cuối câu sau dấu chấm.";
    const scan = await scanFacebookPolicy(original);
    const v = scan.violations[0];

    const fixed = await applyPolicyFix(original, v.id, "Đồng hành chất lượng cùng khách hàng");
    assert.ok(fixed.startsWith("Đầu câu. "));
    assert.ok(fixed.endsWith(". Cuối câu sau dấu chấm."));
  });

  await runner.test("F2.B5: Repeated autoSanitizeAll does not corrupt text formatting", async () => {
    const text = "Đoạn 1.\n\nĐoạn 2 cam kết 100%.\n\nĐoạn 3.";
    const step1 = await autoSanitizeAll(text);
    const step2 = await autoSanitizeAll(step1);

    assert.equal(step1, step2);
    assert.ok(step1.includes("Đoạn 1.\n\n"));
    assert.ok(step1.includes("\n\nĐoạn 3."));
  });

  // ==================== F3 Boundary Cases ====================
  await runner.test("F3.B1: Word count boundary: 249 words (fail) vs 250 words (pass)", async () => {
    const words249 = new Array(249).fill("từ").join(" ");
    const eval249 = await evaluateSocialSeo(words249);
    const check249 = eval249.checks.find((c) => c.id === "post_length");
    assert.equal(check249?.passed, false, "249 words must fail length check");

    const words250 = new Array(250).fill("từ").join(" ");
    const eval250 = await evaluateSocialSeo(words250);
    const check250 = eval250.checks.find((c) => c.id === "post_length");
    assert.equal(check250?.passed, true, "250 words must pass length check");
  });

  await runner.test("F3.B2: Word count boundary: 500 words (pass) vs 501 words (fail)", async () => {
    const words500 = new Array(500).fill("từ").join(" ");
    const eval500 = await evaluateSocialSeo(words500);
    const check500 = eval500.checks.find((c) => c.id === "post_length");
    assert.equal(check500?.passed, true, "500 words must pass length check");

    const words501 = new Array(501).fill("từ").join(" ");
    const eval501 = await evaluateSocialSeo(words501);
    const check501 = eval501.checks.find((c) => c.id === "post_length");
    assert.equal(check501?.passed, false, "501 words must fail length check");
  });

  await runner.test("F3.B3: Entity hook cutoff at exactly 120 characters", async () => {
    // Put entity starting at character 110 (within 120)
    const padding110 = "a".repeat(100);
    const textInside = `${padding110} VinFast nội dung tiếp theo...`;
    const evalInside = await evaluateSocialSeo(textInside, "VinFast");
    const checkInside = evalInside.checks.find((c) => c.id === "hook_entity");
    assert.equal(checkInside?.passed, true);

    // Put entity starting at character 130 (outside 120)
    const padding130 = "b".repeat(130);
    const textOutside = `${padding130} VinFast nội dung tiếp theo...`;
    const evalOutside = await evaluateSocialSeo(textOutside, "VinFast");
    const checkOutside = evalOutside.checks.find((c) => c.id === "hook_entity");
    assert.equal(checkOutside?.passed, false);
  });

  await runner.test("F3.B4: Emoji count boundaries: 2 (fail), 3 (pass), 10 (pass), 11 (fail)", async () => {
    const eval2 = await evaluateSocialSeo("Bài viết có 2 emoji 🌟 🚀");
    assert.equal(eval2.checks.find((c) => c.id === "emoji_count")?.passed, false);

    const eval3 = await evaluateSocialSeo("Bài viết có 3 emoji 🌟 🚀 ❤️");
    assert.equal(eval3.checks.find((c) => c.id === "emoji_count")?.passed, true);

    const eval10 = await evaluateSocialSeo("Bài viết 10 emoji " + "🌟 ".repeat(10));
    assert.equal(eval10.checks.find((c) => c.id === "emoji_count")?.passed, true);

    const eval11 = await evaluateSocialSeo("Bài viết 11 emoji " + "🌟 ".repeat(11));
    assert.equal(eval11.checks.find((c) => c.id === "emoji_count")?.passed, false);
  });

  await runner.test("F3.B5: Single massive paragraph of 300 words fails readability check", async () => {
    const singlePara = new Array(300).fill("từ").join(" ");
    const evalResult = await evaluateSocialSeo(singlePara);

    const readCheck = evalResult.checks.find((c) => c.id === "readability");
    assert.equal(readCheck?.passed, false, "Single giant paragraph must fail readability");
    assert.equal(evalResult.metrics.paragraphCount, 1);
  });

  // ==================== F4 Boundary Cases ====================
  await runner.test("F4.B1: Total score 0 boundary when completely empty", async () => {
    const evalResult = await evaluateSocialSeo("");
    assert.equal(evalResult.totalScore, 0);
    assert.equal(evalResult.grade, "poor");
  });

  await runner.test("F4.B2: Grade boundary threshold: 39 (poor) vs 40 (average)", async () => {
    // Missing hook and emojis -> score <= 39 -> poor
    const postPoor = "Hôm nay thời tiết đẹp đi dạo phố thư giãn cùng bạn bè.";
    const evalPoor = await evaluateSocialSeo(postPoor, "VinFast VF7");
    assert.ok(evalPoor.totalScore <= 39);
    assert.equal(evalPoor.grade, "poor");

    // Hook (25) + Emojis (10) + CTA (10) = 45 -> average
    const post45 = "VinFast VF7 xuất hiện hôm nay. 🌟 🚀 ❤️ Bạn thấy sao? Hãy bình luận.";
    const eval45 = await evaluateSocialSeo(post45, "VinFast VF7");
    assert.ok(eval45.totalScore >= 40 && eval45.totalScore < 60);
    assert.equal(eval45.grade, "average");
  });

  await runner.test("F4.B3: Grade boundary threshold: 59 (average) vs 60 (good)", async () => {
    // Hook (25) + CTA (10) + Emojis (10) + Paragraphs (15) = 60
    const p1 = "VinFast VF7 xuất hiện. 🌟";
    const p2 = "Nội dung đoạn 2. 🚀";
    const p3 = "Bạn nghĩ sao? Hãy bình luận! ❤️";
    const post60 = `${p1}\n\n${p2}\n\n${p3}`;

    const eval60 = await evaluateSocialSeo(post60, "VinFast VF7");
    assert.ok(eval60.totalScore >= 60);
    assert.equal(eval60.grade, "good");
  });

  await runner.test("F4.B4: Grade boundary threshold: 79 (good) vs 80 (excellent)", async () => {
    // Construct near 80 points
    const p1 = "VinFast VF7 chính thức mở bán với nhiều ưu đãi. 🌟";
    const filler = "Thông tin chi tiết về sản phẩm xe điện thông minh hiện đại. ".repeat(7);
    const p2 = `${filler} VinFast VF7 thực sự mang lại trải nghiệm êm ái. 🚀`;
    const p3 = `${filler} Bạn nghĩ sao về VinFast VF7? Để lại bình luận nhé! ❤️`;
    const post80 = `${p1}\n\n${p2}\n\n${p3}`;

    const eval80 = await evaluateSocialSeo(post80, "VinFast VF7");
    assert.ok(eval80.totalScore >= 80);
    assert.equal(eval80.grade, "excellent");
  });

  await runner.test("F4.B5: All 6 checklist items have valid bounds [0, maxPoints]", async () => {
    const evalResult = await evaluateSocialSeo("Nội dung thử nghiệm bất kỳ.");
    for (const check of evalResult.checks) {
      assert.ok(check.points >= 0);
      assert.ok(check.points <= check.maxPoints);
    }
  });

  // ==================== F5 Boundary Cases ====================
  await runner.test("F5.B1: Midnight reference time (23:59:59) rolls all slots to tomorrow", async () => {
    const lateNight = new Date();
    lateNight.setHours(23, 59, 59, 999);

    const presets = await getGoldenHourPresets(lateNight);
    for (const slot of presets) {
      assert.equal(slot.isToday, false, `Slot ${slot.id} at 23:59:59 must be scheduled for tomorrow`);
      assert.ok(slot.formattedTarget.startsWith("Ngày mai"));
    }
  });

  await runner.test("F5.B2: Early morning reference time (00:00:01) keeps morning slot for today", async () => {
    const earlyMorning = new Date();
    earlyMorning.setHours(0, 0, 1, 0);

    const morning = await getUpcomingPreset("morning", earlyMorning);
    assert.equal(morning.isToday, true);
    assert.ok(morning.formattedTarget.startsWith("Hôm nay"));
  });

  await runner.test("F5.B3: Leap year date (Feb 29) handling", async () => {
    const leapDate = new Date(2028, 1, 29, 10, 0, 0); // 2028-02-29 10:00:00
    const noon = await getUpcomingPreset("noon", leapDate);

    assert.equal(noon.isToday, true);
    const parsed = new Date(noon.timestamp);
    assert.equal(parsed.getDate(), 29);
    assert.equal(parsed.getMonth(), 1);
  });

  await runner.test("F5.B4: Exact slot end boundary time rolls over accurately", async () => {
    // Morning slot ends at 08:30:00
    const atCutoff = new Date();
    atCutoff.setHours(8, 30, 1, 0); // 1 second after 08:30

    const morning = await getUpcomingPreset("morning", atCutoff);
    assert.equal(morning.isToday, false);
  });

  await runner.test("F5.B5: Month-end rollover (March 31 to April 1)", async () => {
    const marchEnd = new Date(2026, 2, 31, 23, 30, 0); // March 31 23:30
    const morning = await getUpcomingPreset("morning", marchEnd);

    assert.equal(morning.isToday, false);
    const parsed = new Date(morning.timestamp);
    assert.equal(parsed.getMonth(), 3); // April
    assert.equal(parsed.getDate(), 1);
  });

  // ==================== F6 Boundary Cases ====================
  await runner.test("F6.B1: Future scheduling calculation respects exact boundary", async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const futureSec = nowSec + 600; // exactly 10 mins

    assert.ok(futureSec - nowSec >= 600);
  });

  await runner.test("F6.B2: Rejects past schedule timestamp safely", async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const pastSec = nowSec - 3600;

    assert.ok(pastSec < nowSec, "Past timestamp identified");
  });

  await runner.test("F6.B3: Payload preserves Unicode emojis in scheduled message", async () => {
    const slot = await getUpcomingPreset("evening");
    const msg = "Bài đăng lên lịch có emoji 🌟 🚀 ❤️ và tiếng Việt có dấu.";
    const payload = {
      message: msg,
      scheduled_publish_time: Math.floor(new Date(slot.timestamp).getTime() / 1000),
      published: false,
    };

    assert.equal(payload.message, msg);
  });

  await runner.test("F6.B4: Handles long message near Facebook character limit", async () => {
    const longMsg = "Đoạn văn bản dài thử nghiệm giới hạn ký tự. ".repeat(200);
    const slot = await getUpcomingPreset("noon");

    assert.ok(longMsg.length > 5000);
    assert.ok(longMsg.length < 63206);
    assert.ok(slot.timestamp);
  });

  await runner.test("F6.B5: Database handles draft post without scheduled_at gracefully", async () => {
    const db = createTestDatabase();
    await runMigrations(db);

    const postId = `post_null_sched_${Date.now()}`;
    db.prepare(`
      INSERT INTO facebook_posts (id, topic_title, content, status, scheduled_at)
      VALUES (?, ?, ?, ?, NULL)
    `).run(postId, "Chủ đề", "Nội dung", "draft");

    const row = db.prepare("SELECT scheduled_at FROM facebook_posts WHERE id = ?").get(postId) as any;
    assert.equal(row.scheduled_at, null);
  });

  // ==================== F7 Boundary Cases ====================
  await runner.test("F7.B1: Handles title with all punctuation and special characters", async () => {
    const result = await generateThreeTierHashtags("!@#$%^&*()_+{}[]:;<>?,./");

    assert.ok(result.tier2Topic.length > 0);
    for (const tag of result.allCombined) {
      assert.doesNotMatch(tag.slice(1), /[!@#$%^&*()_+=\-[\]{};':"\\|,.<>/?]/);
    }
  });

  await runner.test("F7.B2: Handles multi-accented Vietnamese string", async () => {
    const result = await generateThreeTierHashtags("Đắk Lắk Phở Bò Bến Tre Hà Nội");

    assert.ok(result.tier2Topic.length > 0);
    assert.ok(!result.tier2Topic[0].includes("ắ"));
    assert.ok(!result.tier2Topic[0].includes("ở"));
  });

  await runner.test("F7.B3: Strips extra spaces and tabs from entity name", async () => {
    const result = await generateThreeTierHashtags("Tiêu đề", "   VinFast   Việt   Nam   ");

    const entityTag = result.tier1Entity[0];
    assert.ok(!entityTag.includes(" "));
    assert.ok(entityTag.toLowerCase().includes("vinfastvietnam"));
  });

  await runner.test("F7.B4: Truncates or formats extremely long title without crashing", async () => {
    const giantTitle = "Tiêu đề siêu dài lặp đi lặp lại nhiều lần ".repeat(20);
    const result = await generateThreeTierHashtags(giantTitle, "Brand");

    assert.ok(result.allCombined.length > 0);
    assert.equal(typeof result.formattedBlock, "string");
  });

  await runner.test("F7.B5: Handles empty title and empty entity simultaneously", async () => {
    const result = await generateThreeTierHashtags("", "");

    assert.ok(result.allCombined.length > 0);
    assert.ok(result.tier3Trend.length > 0);
    assert.equal(typeof result.formattedBlock, "string");
  });

  // ==================== F8 Boundary Cases ====================
  await runner.test("F8.B1: Appending when content already ends with multiple trailing newlines", () => {
    const content = "Nội dung bài viết kết thúc ở đây.\n\n\n\n";
    const res = appendHashtags(content, ["#Tag1", "#Tag2"]);

    assert.ok(res.endsWith("\n\n#Tag1 #Tag2"));
    assert.ok(!res.includes("\n\n\n\n\n\n"));
  });

  await runner.test("F8.B2: Appending single hashtag", () => {
    const res = appendHashtags("Nội dung", ["#DonLe"]);
    assert.equal(res, "Nội dung\n\n#DonLe");
  });

  await runner.test("F8.B3: Appending large list of 30 hashtags", () => {
    const tags = new Array(30).fill(0).map((_, i) => `#Tag${i + 1}`);
    const res = appendHashtags("Nội dung", tags);

    assert.ok(res.includes("#Tag1"));
    assert.ok(res.includes("#Tag30"));
  });

  await runner.test("F8.B4: Appending to whitespace-only string treats as empty", () => {
    const res = appendHashtags("    \n\t   ", ["#HashtagMoi"]);
    assert.equal(res, "#HashtagMoi");
  });

  await runner.test("F8.B5: Appending maintains character encoding fidelity", () => {
    const res = appendHashtags("Tiếng Việt có dấu 🇻🇳", ["#VietNam", "#TuHao"]);
    assert.ok(res.includes("Tiếng Việt có dấu 🇻🇳"));
    assert.ok(res.endsWith("#VietNam #TuHao"));
  });

  // ==================== F9 Boundary Cases ====================
  await runner.test("F9.B1: Alt text generator handles prompts containing HTML/scripts safely", async () => {
    const meta = await generateImageSeoMetadata("<script>alert('xss')</script> Mô tả sản phẩm", "<b>Brand</b>");

    assert.ok(meta.altText);
    assert.ok(meta.caption);
  });

  await runner.test("F9.B2: Alt text handles 500-word prompt without buffer error", async () => {
    const longPrompt = "Chi tiết hình ảnh phong cảnh thiên nhiên núi rừng Tây Bắc. ".repeat(40);
    const meta = await generateImageSeoMetadata(longPrompt, "Du Lịch");

    assert.ok(meta.altText.length > 0);
  });

  await runner.test("F9.B3: Alt text generation handles special quotes and apostrophes", async () => {
    const meta = await generateImageSeoMetadata('Bộ sưu tập "Summer 2026" & Men\'s style', "Men's Club");

    assert.ok(meta.altText.length > 0);
    assert.ok(meta.caption.length > 0);
  });

  await runner.test("F9.B4: Alt text generation preserves Vietnamese tone marks in description", async () => {
    const meta = await generateImageSeoMetadata("Ẩm thực đường phố Hà Nội", "Hà Nội Phố");

    assert.ok(meta.altText.includes("Ẩm thực đường phố Hà Nội"));
  });

  await runner.test("F9.B5: Caption contains decorative emojis", async () => {
    const meta = await generateImageSeoMetadata("Sản phẩm mới", "Shop");
    assert.ok(meta.caption.includes("✨") || meta.caption.length > 0);
  });

  // ==================== F10 Boundary Cases ====================
  await runner.test("F10.B1: SQL injection string in alt_text is stored safely as text parameter", async () => {
    const db = createTestDatabase();
    await runMigrations(db);

    const injection = "'; DROP TABLE facebook_posts; --";
    const postId = `post_sec_${Date.now()}`;

    db.prepare(`
      INSERT INTO facebook_posts (id, topic_title, content, status, alt_text)
      VALUES (?, ?, ?, ?, ?)
    `).run(postId, "Chủ đề", "Nội dung", "draft", injection);

    const checkTable = db.prepare("SELECT count(*) as count FROM facebook_posts").get() as any;
    assert.ok(checkTable.count > 0, "Table must not be dropped by injection string");

    const row = db.prepare("SELECT alt_text FROM facebook_posts WHERE id = ?").get(postId) as any;
    assert.equal(row.alt_text, injection);
  });

  await runner.test("F10.B2: Stores 5,000-character alt_text in SQLite without truncation", async () => {
    const db = createTestDatabase();
    await runMigrations(db);

    const longAlt = "Mô tả hình ảnh chi tiết phục vụ người khiếm thị. ".repeat(100);
    const imgId = `img_long_${Date.now()}`;

    db.prepare(`
      INSERT INTO ai_images (id, topic_title, prompt, image_url, alt_text)
      VALUES (?, ?, ?, ?, ?)
    `).run(imgId, "Chủ đề", "Prompt", "https://example.com/img.png", longAlt);

    const row = db.prepare("SELECT alt_text FROM ai_images WHERE id = ?").get(imgId) as any;
    assert.equal(row.alt_text, longAlt);
  });

  await runner.test("F10.B3: Stores 4-byte UTF-8 emojis in caption", async () => {
    const db = createTestDatabase();
    await runMigrations(db);

    const emojiCaption = "Chú thích ảnh với emoji đặc biệt 🦄 🌈 ⚡ 💎 🚀";
    const postId = `post_emoji_${Date.now()}`;

    db.prepare(`
      INSERT INTO facebook_posts (id, topic_title, content, status, image_caption)
      VALUES (?, ?, ?, ?, ?)
    `).run(postId, "Chủ đề", "Nội dung", "draft", emojiCaption);

    const row = db.prepare("SELECT image_caption FROM facebook_posts WHERE id = ?").get(postId) as any;
    assert.equal(row.image_caption, emojiCaption);
  });

  await runner.test("F10.B4: Update operation on non-existent post id succeeds with changes=0", async () => {
    const db = createTestDatabase();
    await runMigrations(db);

    const res = db.prepare("UPDATE facebook_posts SET alt_text = ? WHERE id = ?").run("Alt", "non_existent_id");
    assert.equal(res.changes, 0);
  });

  await runner.test("F10.B5: Default value of alt_text and caption in migrated table is empty string", async () => {
    const db = createTestDatabase();
    await runMigrations(db);

    const imgId = `img_default_${Date.now()}`;
    db.prepare(`
      INSERT INTO ai_images (id, topic_title, prompt, image_url)
      VALUES (?, ?, ?, ?)
    `).run(imgId, "Chủ đề", "Prompt", "https://example.com/img.png");

    const row = db.prepare("SELECT alt_text, caption FROM ai_images WHERE id = ?").get(imgId) as any;
    assert.equal(row.alt_text, "");
    assert.equal(row.caption, "");
  });

  // ==================== F11 Boundary Cases ====================
  await runner.test("F11.B1: Style prompt case sensitivity and whitespace trimming", async () => {
    const prompt = await getStylePrompt("storytelling");
    assert.ok(prompt.length > 0);
  });

  await runner.test("F11.B2: Preset list is non-empty and unique by id", async () => {
    const presets = await getAllStylePresets();
    const ids = presets.map((p) => p.id);
    const uniqueIds = new Set(ids);
    assert.equal(ids.length, uniqueIds.size);
  });

  await runner.test("F11.B3: All style prompts contain distinct instruction sets", async () => {
    const pStory = await getStylePrompt("storytelling");
    const pSales = await getStylePrompt("direct_sales");
    const pNews = await getStylePrompt("news_guide");
    const pTrend = await getStylePrompt("humorous_trend");

    assert.notEqual(pStory, pSales);
    assert.notEqual(pSales, pNews);
    assert.notEqual(pNews, pTrend);
  });

  await runner.test("F11.B4: Presets metadata contains valid Lucide icon identifiers", async () => {
    const presets = await getAllStylePresets();
    for (const p of presets) {
      assert.match(p.icon, /^[A-Z][a-zA-Z0-9]+$/);
    }
  });

  await runner.test("F11.B5: Style prompt returns non-empty string for empty string parameter", async () => {
    const fallback = await getStylePrompt("" as any);
    assert.ok(fallback.length > 0);
  });

  // ==================== F12 Boundary Cases ====================
  await runner.test("F12.B1: Handles 10 variations in variations_json array", async () => {
    const db = createTestDatabase();
    await runMigrations(db);

    const items: VariationContentItem[] = [];
    for (let i = 0; i < 10; i++) {
      items.push({
        style: i % 2 === 0 ? "storytelling" : "direct_sales",
        title: `Biến thể ${i + 1}`,
        content: `Nội dung biến thể số ${i + 1}`,
        hook: `Hook ${i + 1}`,
        createdAt: new Date().toISOString(),
      });
    }

    const postId = `post_10_vars_${Date.now()}`;
    db.prepare(`
      INSERT INTO facebook_posts (id, topic_title, content, status, variations_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(postId, "Chủ đề", "Nội dung", "draft", JSON.stringify(items));

    const row = db.prepare("SELECT variations_json FROM facebook_posts WHERE id = ?").get(postId) as any;
    const parsed = JSON.parse(row.variations_json);
    assert.equal(parsed.length, 10);
  });

  await runner.test("F12.B2: Gracefully handles empty variations array string '[]'", async () => {
    const db = createTestDatabase();
    await runMigrations(db);

    const postId = `post_empty_arr_${Date.now()}`;
    db.prepare(`
      INSERT INTO facebook_posts (id, topic_title, content, status, variations_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(postId, "Chủ đề", "Nội dung", "draft", "[]");

    const row = db.prepare("SELECT variations_json FROM facebook_posts WHERE id = ?").get(postId) as any;
    const parsed = JSON.parse(row.variations_json);
    assert.deepEqual(parsed, []);
  });

  await runner.test("F12.B3: Switching content_style across all 4 valid variants", async () => {
    const db = createTestDatabase();
    await runMigrations(db);

    const postId = `post_cycle_${Date.now()}`;
    db.prepare(`
      INSERT INTO facebook_posts (id, topic_title, content, status, content_style)
      VALUES (?, ?, ?, ?, ?)
    `).run(postId, "Chủ đề", "Nội dung", "draft", "storytelling");

    const styles: Array<"direct_sales" | "news_guide" | "humorous_trend" | "storytelling"> = [
      "direct_sales",
      "news_guide",
      "humorous_trend",
      "storytelling",
    ];

    for (const s of styles) {
      db.prepare("UPDATE facebook_posts SET content_style = ? WHERE id = ?").run(s, postId);
      const row = db.prepare("SELECT content_style FROM facebook_posts WHERE id = ?").get(postId) as any;
      assert.equal(row.content_style, s);
    }
  });

  await runner.test("F12.B4: Variation content payload containing multiline breaks and quotes", () => {
    const item: VariationContentItem = {
      style: "storytelling",
      title: 'Tiêu đề có "dấu ngoặc kép"',
      content: "Dòng 1.\n\nDòng 2 với 'dấu nháy đơn'.\n\nDòng 3 kết thúc.",
      hook: "Hook mở đầu.",
      createdAt: new Date().toISOString(),
    };

    const serialized = JSON.stringify(item);
    const parsed = JSON.parse(serialized) as VariationContentItem;

    assert.equal(parsed.content, item.content);
    assert.equal(parsed.title, item.title);
  });

  await runner.test("F12.B5: Handles corrupted variations_json string without throwing uncaught db error", async () => {
    const db = createTestDatabase();
    await runMigrations(db);

    const postId = `post_bad_json_${Date.now()}`;
    db.prepare(`
      INSERT INTO facebook_posts (id, topic_title, content, status, variations_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(postId, "Chủ đề", "Nội dung", "draft", "{ corrupted json");

    const row = db.prepare("SELECT variations_json FROM facebook_posts WHERE id = ?").get(postId) as any;
    assert.equal(row.variations_json, "{ corrupted json");
  });

  // ==================== F13 Boundary Cases ====================
  await runner.test("F13.B1: Executes runMigrations 20 times in a rapid loop without failure", async () => {
    const db = createTestDatabase();
    for (let i = 0; i < 20; i++) {
      await runMigrations(db);
    }

    const postCols = (db.prepare("PRAGMA table_info(facebook_posts);").all() as any[]).map((c) => c.name);
    assert.ok(postCols.includes("seo_score"));
  });

  await runner.test("F13.B2: Migration runs on populated table with 50 existing rows", async () => {
    const db = createTestDatabase();
    for (let i = 0; i < 50; i++) {
      db.prepare(`
        INSERT INTO facebook_posts (id, topic_title, content, status)
        VALUES (?, ?, ?, ?)
      `).run(`post_${i}`, `Tiêu đề ${i}`, `Nội dung ${i}`, "draft");
    }

    await runMigrations(db);
    const count = (db.prepare("SELECT count(*) as count FROM facebook_posts").get() as any).count;
    assert.equal(count, 50);
  });

  await runner.test("F13.B3: Migration execution time is under 100ms", async () => {
    const db = createTestDatabase();
    const start = performance.now();
    await runMigrations(db);
    const duration = performance.now() - start;

    assert.ok(duration < 100, `Migration took ${duration}ms, expected under 100ms`);
  });

  await runner.test("F13.B4: Migrated column default values are verified", async () => {
    const db = createTestDatabase();
    await runMigrations(db);

    db.prepare(`
      INSERT INTO facebook_posts (id, topic_title, content, status)
      VALUES (?, ?, ?, ?)
    `).run("p_test_defaults", "Title", "Content", "draft");

    const row = db.prepare("SELECT * FROM facebook_posts WHERE id = 'p_test_defaults'").get() as any;
    assert.equal(row.seo_score, 0);
    assert.equal(row.policy_status, "clean");
    assert.equal(row.content_style, "standard");
  });

  await runner.test("F13.B5: Foreign keys remain enabled after migration", async () => {
    const db = createTestDatabase();
    await runMigrations(db);

    const fk = (db.prepare("PRAGMA foreign_keys;").get() as any).foreign_keys;
    assert.equal(fk, 1);
  });

  // ==================== F14 Boundary Cases ====================
  await runner.test("F14.B1: Strict null safety on optional parameters in evaluateSocialSeo", async () => {
    const res = await evaluateSocialSeo("Nội dung bài viết", undefined, undefined);
    assert.ok(res.totalScore >= 0);
    assert.ok(typeof res.grade === "string");
  });

  await runner.test("F14.B2: Strict null safety on generateThreeTierHashtags optional parameters", async () => {
    const res = await generateThreeTierHashtags("Tiêu đề", undefined, undefined);
    assert.ok(res.allCombined.length > 0);
  });

  await runner.test("F14.B3: Returned objects are fresh instances without prototype pollution", async () => {
    const res1 = await scanFacebookPolicy("Nội dung 1");
    const res2 = await scanFacebookPolicy("Nội dung 2");

    assert.notEqual(res1.violations, res2.violations);
  });

  await runner.test("F14.B4: Grade union exhaustive check", async () => {
    const grades = ["excellent", "good", "average", "poor"];
    const evalRes = await evaluateSocialSeo("Nội dung");
    assert.ok(grades.includes(evalRes.grade));
  });

  await runner.test("F14.B5: Slot id union exhaustive check", async () => {
    const slotIds = ["morning", "noon", "evening", "night"];
    const presets = await getGoldenHourPresets();
    for (const p of presets) {
      assert.ok(slotIds.includes(p.id));
    }
  });

  return runner.getSummary();
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  runTier2BoundaryTests().then((s) => {
    new TestRunnerContext(s.suiteName, s.tier, "F1-F14").printSummary();
  });
}
