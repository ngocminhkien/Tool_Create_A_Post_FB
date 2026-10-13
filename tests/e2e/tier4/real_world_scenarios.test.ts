/**
 * tests/e2e/tier4/real_world_scenarios.test.ts
 * Tier 4: Real-World Editorial Marketing Scenarios
 * Covers 5 end-to-end Vietnamese marketing campaign workflows specified in TEST_INFRA.md § 4:
 * 1. Scenario 1: Spa & Skincare Post (Policy Heavy)
 * 2. Scenario 2: E-Commerce Gadget Flash Sale (Sales Hook)
 * 3. Scenario 3: Healthcare / Dental Clinic Awareness (Anti-Shadowban)
 * 4. Scenario 4: Educational Coding Academy Guide (Storytelling Angle)
 * 5. Scenario 5: Viral Food & Beverage Review (Humorous/Trend Angle)
 */

import assert from "node:assert/strict";
import {
  scanFacebookPolicy,
  applyPolicyFix,
  autoSanitizeAll,
  evaluateSocialSeo,
  getUpcomingPreset,
  generateThreeTierHashtags,
  appendHashtags,
  generateImageSeoMetadata,
  getStylePrompt,
  getAllStylePresets,
  runMigrations,
} from "../harness/serviceLoader";
import { createTestDatabase } from "../harness/testDb";
import { TestRunnerContext } from "../harness/runnerHelper";
import {
  TestSuiteSummary,
  VariationContentItem,
} from "../types";

export async function runTier4ScenarioTests(): Promise<TestSuiteSummary> {
  const runner = new TestRunnerContext("Real-World Editorial Scenarios", 4, "T4-SCENARIOS");

  // =========================================================================
  // Scenario 1: Spa & Skincare Post (Policy Heavy)
  // =========================================================================
  await runner.test("Scenario 1: Spa & Skincare Post (Policy Heavy) — Full Sanitation, SEO & Prime Evening Schedule", async () => {
    const db = createTestDatabase();
    await runMigrations(db);

    const topicTitle = "Liệu Trình Chăm Sóc Da Chuyên Sâu Mùa Thu Đông";
    const entity = "An Nhiên Spa";

    // 1. Initial draft contains sensitive curative claims and absolute promises
    const rawPostDraft =
      "An Nhiên Spa cam kết 100% giúp bạn sở hữu làn da trắng sáng không tì vết chỉ sau 1 tuần trải nghiệm. " +
      "Liệu trình thảo mộc đặc trị mụn viêm, nám lâu năm và chữa dứt điểm tàn nhang tận gốc. " +
      "Công nghệ sinh học hiện đại cung cấp độ ẩm sâu, tái tạo lớp màng ẩm tự nhiên và se khít lỗ chân lông hoàn hảo. " +
      "Không gian thư giãn nhẹ nhàng ngập tràn hương hoa oải hương cùng tiếng nhạc thiền êm dịu giúp tái tạo năng lượng tích cực sau ngày dài. " +
      "Hãy để làn da được nâng niu và yêu thương đúng cách mỗi ngày cùng đội ngũ chuyên viên tận tâm. " +
      "Liên hệ ngay hotline 0988.765.432 hoặc click bit.ly/an-nhien-spa để đặt lịch hẹn sớm nhất! Bạn đã chăm sóc da hôm nay chưa? 🌿✨";

    // 2. Policy Scanner detects violations
    const initialScan = await scanFacebookPolicy(rawPostDraft);
    assert.equal(initialScan.isSafe, false, "Must detect unsafe marketing copy");
    assert.ok(initialScan.riskScore >= 40, "Risk score must be at least warning or danger level");
    assert.ok(initialScan.violations.length >= 2, "Must identify absolute claims, curative terms, or spam links");

    // 3. One-Click Auto Sanitation transforms to safe copy
    const sanitizedDraft = await autoSanitizeAll(rawPostDraft);
    assert.ok(!sanitizedDraft.includes("cam kết 100%"), "Must purge absolute claim");
    assert.ok(!sanitizedDraft.includes("0988.765.432"), "Must purge phone number spam");
    assert.ok(!sanitizedDraft.includes("bit.ly/an-nhien-spa"), "Must purge external spam link");

    const reScan = await scanFacebookPolicy(sanitizedDraft);
    assert.equal(reScan.isSafe, true, "Sanitized copy must pass policy scan with zero violations");
    assert.equal(reScan.riskScore, 0);

    // 4. Generate 3-Tier Hashtags
    const hashtags = await generateThreeTierHashtags(topicTitle, entity, sanitizedDraft);
    assert.ok(hashtags.tier1Entity.some((t) => t.toLowerCase().includes("annhienspa") || t.toLowerCase().includes("annhien")));
    assert.ok(hashtags.tier2Topic.length > 0, "Must include beauty/spa topic hashtags");
    assert.ok(hashtags.tier3Trend.length > 0, "Must include viral lifestyle hashtags");

    const finalPostContent = appendHashtags(sanitizedDraft, hashtags.allCombined);
    assert.ok(finalPostContent.includes(hashtags.formattedBlock));

    // 5. Evaluate Social SEO Scorecard
    const seoEval = await evaluateSocialSeo(finalPostContent, entity, topicTitle);
    assert.equal(seoEval.metrics.hookEntityPresent, true, "Entity 'An Nhiên Spa' must appear in first 120 characters");
    assert.ok(seoEval.totalScore >= 60, "Sanitized post should achieve a respectable SEO score");

    // 6. Generate AI Image Alt Text & Caption
    const imageSeo = await generateImageSeoMetadata(topicTitle, entity);
    assert.ok(imageSeo.altText.length > 0);
    assert.ok(imageSeo.caption.length > 0);

    // 7. Schedule for Evening Prime Time
    const eveningSlot = await getUpcomingPreset("evening");
    assert.equal(eveningSlot.id, "evening");
    assert.equal(eveningSlot.isRecommendedPrime, true);

    // 8. Persist into SQLite
    const postId = "scenario_1_spa_post";
    db.prepare(`
      INSERT INTO facebook_posts (
        id, topic_title, hook, content, status, scheduled_at,
        seo_score, seo_breakdown, policy_warnings, policy_status,
        hashtags, alt_text, image_caption, content_style
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      postId,
      topicTitle,
      sanitizedDraft.slice(0, 100),
      finalPostContent,
      "scheduled",
      eveningSlot.timestamp,
      seoEval.totalScore,
      JSON.stringify(seoEval.checks),
      JSON.stringify(initialScan.violations),
      "sanitized",
      hashtags.formattedBlock,
      imageSeo.altText,
      imageSeo.caption,
      "storytelling"
    );

    // 9. Verify database integrity
    const saved = db.prepare("SELECT * FROM facebook_posts WHERE id = ?").get(postId) as any;
    assert.ok(saved);
    assert.equal(saved.policy_status, "sanitized");
    assert.equal(saved.status, "scheduled");
    assert.equal(saved.scheduled_at, eveningSlot.timestamp);
    assert.equal(saved.content_style, "storytelling");
  });

  // =========================================================================
  // Scenario 2: E-Commerce Gadget Flash Sale (Sales Hook)
  // =========================================================================
  await runner.test("Scenario 2: E-Commerce Gadget Flash Sale (Sales Hook) — PAS Formula, Image SEO & Noon Schedule", async () => {
    const db = createTestDatabase();
    await runMigrations(db);

    const topicTitle = "Tai Nghe Chống Ồn Sony WH-1000XM5 Chính Hãng";
    const entity = "Sony WH-1000XM5";

    // 1. Content written with Direct Sales tone & PAS framework
    const salesPrompt = await getStylePrompt("direct_sales");
    assert.ok(salesPrompt.includes("BÁN HÀNG"));

    const salesDraft =
      "Sony WH-1000XM5 chính là giải pháp chống ồn đỉnh cao bạn đang tìm kiếm để tập trung làm việc hiệu quả. " +
      "Bạn cảm thấy mệt mỏi vì tiếng ồn văn phòng liên tục làm gián đoạn dòng suy nghĩ sáng tạo mỗi ngày? " +
      "Công nghệ chống ồn chủ động 8 micro kép lọc sạch mọi tạp âm giúp bạn chìm đắm trong không gian âm nhạc thuần khiết. " +
      "Thời lượng pin lên đến 30 giờ liên tục cùng tính năng sạc nhanh 3 phút nghe được 3 giờ sẵn sàng đồng hành trên mọi chặng đường. " +
      "Thiết kế công thái học siêu nhẹ êm ái, đệm tai da mềm mại ôm khít giúp bạn đeo suốt cả ngày dài mà không hề có cảm giác đau mỏi. " +
      "Chất âm Hi-Res chuẩn phòng thu tái hiện trọn vẹn từng dải bass trầm ấm và nốt cao trong trẻo tinh tế. " +
      "Ưu đãi đặc biệt giảm ngay 15% cho 50 khách hàng đầu tiên nhắn tin cho Fanpage trong khung giờ hôm nay. " +
      "Bạn thích nghe thể loại nhạc nào nhất khi làm việc? Hãy để lại bình luận để nhận mã voucher nhé! 🎧🔥";

    // 2. Policy check — verify no prohibited claims
    const scan = await scanFacebookPolicy(salesDraft);
    assert.equal(scan.isSafe, true, "Valid direct sales copy must remain clean under Meta policies");

    // 3. Social SEO Scorecard evaluation
    const seo = await evaluateSocialSeo(salesDraft, entity, topicTitle);
    assert.equal(seo.metrics.hookEntityPresent, true, "Entity 'Sony WH-1000XM5' is at the very beginning");
    assert.ok(seo.metrics.keywordDensityPercent >= 0.5, "Keyword density is tracked");
    assert.equal(seo.metrics.hasCommentCta, true, "Comment CTA is present");

    // 4. Generate 3-Tier Hashtags
    const hashtags = await generateThreeTierHashtags(topicTitle, entity, salesDraft);
    const postWithTags = appendHashtags(salesDraft, hashtags.allCombined);
    assert.ok(postWithTags.includes("#SonyWh1000xm5") || postWithTags.includes("#Sony"));

    // 5. Image Alt Text & SEO Caption
    const imageSeo = await generateImageSeoMetadata(topicTitle, entity);
    assert.ok(imageSeo.altText.toLowerCase().includes("sony") || imageSeo.altText.toLowerCase().includes("tai nghe"));

    // 6. Schedule for Noon Slot (11:30 Office Lunch Break)
    const noonSlot = await getUpcomingPreset("noon");
    assert.equal(noonSlot.id, "noon");

    // 7. Persist to DB
    const postId = "scenario_2_ecommerce_post";
    db.prepare(`
      INSERT INTO facebook_posts (
        id, topic_title, hook, content, status, scheduled_at,
        seo_score, policy_status, hashtags, alt_text, image_caption, content_style
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      postId,
      topicTitle,
      salesDraft.slice(0, 110),
      postWithTags,
      "scheduled",
      noonSlot.timestamp,
      seo.totalScore,
      "clean",
      hashtags.formattedBlock,
      imageSeo.altText,
      imageSeo.caption,
      "direct_sales"
    );

    const saved = db.prepare("SELECT * FROM facebook_posts WHERE id = ?").get(postId) as any;
    assert.equal(saved.status, "scheduled");
    assert.equal(saved.content_style, "direct_sales");
  });

  // =========================================================================
  // Scenario 3: Healthcare / Dental Clinic Awareness (Anti-Shadowban)
  // =========================================================================
  await runner.test("Scenario 3: Healthcare / Dental Clinic Awareness (Anti-Shadowban) — Curative & Phone Replacement", async () => {
    const db = createTestDatabase();
    await runMigrations(db);

    const topicTitle = "Chăm Sóc Răng Miệng Đúng Cách Cho Nụ Cười Rạng Rỡ";
    const entity = "Nha Khoa Peace Dentistry";

    // 1. Initial draft with severe shadowban triggers: phone number, curative promises, before-after claims
    const rawPost =
      "Nha Khoa Peace Dentistry là điểm đến uy tín với hơn 15 năm kinh nghiệm trong lĩnh vực nha khoa thẩm mỹ. " +
      "Chúng tôi cam kết trị dứt điểm viêm nha chu và bảo đảm 100% không đau nhức khi thực hiện dịch vụ. " +
      "Khám phá hình ảnh trước và sau khi bọc răng sứ để cảm nhận sự thay đổi ngoạn mục của nụ cười. " +
      "Hệ thống trang thiết bị hiện đại nhập khẩu trực tiếp từ Đức đảm bảo quy trình điều trị chuẩn y khoa vô trùng tuyệt đối. " +
      "Đội ngũ bác sĩ tu nghiệp chuyên sâu tại Pháp luôn đồng hành chu đáo mang đến cho bạn hàm răng chắc khỏe bền đẹp. " +
      "Gọi ngay hotline 0903.888.999 hoặc nhắn tin để nhận ưu đãi cạo vôi răng miễn phí tháng này! Bạn đã khám răng định kỳ chưa? 🦷✨";

    // 2. Detect multiple high-risk violations
    const initialScan = await scanFacebookPolicy(rawPost);
    assert.equal(initialScan.isSafe, false);
    assert.ok(initialScan.violations.length >= 3, "Should catch curative claim, phone spam, and body/before-after claim");

    // 3. Auto-sanitize all policy triggers
    const cleanPost = await autoSanitizeAll(rawPost);
    assert.ok(!cleanPost.includes("0903.888.999"));
    assert.ok(!cleanPost.includes("trị dứt điểm"));

    const verifyCleanScan = await scanFacebookPolicy(cleanPost);
    assert.equal(verifyCleanScan.isSafe, true, "Sanitized post must be safe from shadowban");

    // 4. Generate community hashtags
    const hashtags = await generateThreeTierHashtags(topicTitle, entity, cleanPost);
    const postWithTags = appendHashtags(cleanPost, hashtags.allCombined);

    // 5. Verify Readability & Social SEO
    const seo = await evaluateSocialSeo(postWithTags, entity, topicTitle);
    assert.equal(seo.metrics.hookEntityPresent, true);
    assert.ok(seo.checks.some((c) => c.id === "readability" && c.points > 0));

    // 6. Persist to DB with audit log of detected policy warnings
    const postId = "scenario_3_dental_post";
    db.prepare(`
      INSERT INTO facebook_posts (
        id, topic_title, content, status, seo_score,
        policy_warnings, policy_status, content_style
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      postId,
      topicTitle,
      postWithTags,
      "draft",
      seo.totalScore,
      JSON.stringify(initialScan.violations),
      "sanitized",
      "news_guide"
    );

    const saved = db.prepare("SELECT * FROM facebook_posts WHERE id = ?").get(postId) as any;
    assert.ok(saved);
    const warnings = JSON.parse(saved.policy_warnings);
    assert.ok(warnings.length >= 3, "Original violations must be preserved in audit log column");
  });

  // =========================================================================
  // Scenario 4: Educational Coding Academy Guide (Storytelling Angle)
  // =========================================================================
  await runner.test("Scenario 4: Educational Coding Academy Guide (Storytelling Angle) — Long-form Readability & Night Schedule", async () => {
    const db = createTestDatabase();
    await runMigrations(db);

    const topicTitle = "Hành Trình Chuyển Ngành Trở Thành Kỹ Sư Phần Mềm";
    const entity = "Học Viện MindX";

    // 1. Long-form educational storytelling copy structured in clear paragraphs
    const p1 =
      "Học Viện MindX tin rằng không bao giờ là quá muộn để bắt đầu theo đuổi đam mê công nghệ thông tin. " +
      "Ba năm trước, Nam là một nhân viên văn phòng mẫn cán nhưng luôn trăn trở về định hướng tương lai.";

    const p2 =
      "Những buổi tối miệt mài bên bàn phím học từng dòng code đầu tiên là khoảng thời gian đầy thử thách. " +
      "Có những đêm ngồi debug đến rạng sáng, nhưng niềm vui khi chương trình chạy thành công đã thắp sáng ngọn lửa nhiệt huyết.";

    const p3 =
      "Nhờ chương trình đào tạo thực chiến và sự dẫn dắt tận tâm của các mentor giàu kinh nghiệm tại MindX, " +
      "Nam đã từng bước làm chủ các công cụ lập trình hiện đại như React, Node.js và hệ thống cơ sở dữ liệu phân tán.";

    const p4 =
      "Giờ đây, Nam đã trở thành một kỹ sư phần mềm vững vàng tại một công ty công nghệ đa quốc gia. " +
      "Hành trình ấy chứng minh rằng chỉ cần bạn kiên trì và có người đồng hành đúng đắn, mọi ước mơ đều có thể chạm tới.";

    const p5 =
      "Bạn có đang ấp ủ giấc mơ bước chân vào thế giới công nghệ? " +
      "Hãy bình luận chia sẻ câu chuyện của bạn hoặc để lại dấu chấm để nhận lộ trình học tập miễn phí nhé! 💻🚀🌟";

    const storyDraft = `${p1}\n\n${p2}\n\n${p3}\n\n${p4}\n\n${p5}`;

    // 2. Policy Scanner verification
    const policy = await scanFacebookPolicy(storyDraft);
    assert.equal(policy.isSafe, true, "Educational storytelling content must be completely policy clean");

    // 3. Social SEO Scorecard evaluation
    const seo = await evaluateSocialSeo(storyDraft, entity, topicTitle);
    assert.equal(seo.metrics.hookEntityPresent, true);
    assert.ok(seo.metrics.paragraphCount >= 4, "Must have multi-paragraph structure");
    assert.ok(seo.metrics.avgWordsPerParagraph <= 60, "Paragraphs must be readable");
    assert.equal(seo.metrics.hasCommentCta, true, "Comment trigger must be recognized");

    // 4. Generate 3-Tier Hashtags
    const hashtags = await generateThreeTierHashtags(topicTitle, entity, storyDraft);
    const postWithTags = appendHashtags(storyDraft, hashtags.allCombined);

    // 5. Schedule for Night Slot (22:00 Reflective Reading Hour)
    const nightSlot = await getUpcomingPreset("night");
    assert.equal(nightSlot.id, "night");

    // 6. Image SEO metadata
    const imageSeo = await generateImageSeoMetadata(topicTitle, entity);

    // 7. Persist to DB
    const postId = "scenario_4_academy_post";
    db.prepare(`
      INSERT INTO facebook_posts (
        id, topic_title, hook, content, status, scheduled_at,
        seo_score, policy_status, hashtags, alt_text, image_caption, content_style
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      postId,
      topicTitle,
      storyDraft.slice(0, 115),
      postWithTags,
      "scheduled",
      nightSlot.timestamp,
      seo.totalScore,
      "clean",
      hashtags.formattedBlock,
      imageSeo.altText,
      imageSeo.caption,
      "storytelling"
    );

    const saved = db.prepare("SELECT * FROM facebook_posts WHERE id = ?").get(postId) as any;
    assert.equal(saved.status, "scheduled");
    assert.equal(saved.scheduled_at, nightSlot.timestamp);
    assert.equal(saved.content_style, "storytelling");
  });

  // =========================================================================
  // Scenario 5: Viral Food & Beverage Review (Humorous/Trend Angle)
  // =========================================================================
  await runner.test("Scenario 5: Viral Food & Beverage Review (Humorous/Trend Angle) — Emoji Rich, Trend Tags & Morning Schedule", async () => {
    const db = createTestDatabase();
    await runMigrations(db);

    const topicTitle = "Review Trà Sữa Đất Nung Phố Cổ Hà Nội";
    const entity = "Trà Sữa Đất Nung";

    // 1. Content written in Humorous / Trend style with rich emojis
    const trendPrompt = await getStylePrompt("humorous_trend");
    assert.ok(trendPrompt.includes("HÀI HƯỚC") || trendPrompt.includes("TREND"));

    const p1 =
      "Trà Sữa Đất Nung đang làm mưa làm gió khắp phố cổ Hà Nội có thực sự ngon đỉnh chóp như lời đồn không cả nhà ơi? 🍵🔥 " +
      "Hôm nay quyết định rủ hội cạ cứng xếp hàng 30 phút để kiểm chứng xem sao nè!";

    const p2 =
      "Cảm nhận đầu tiên là chiếc ấm đất nung nhìn siêu cưng xỉu, khói bốc nghi ngút thơm lừng mùi thảo mộc và cánh hoa hồng khô. " +
      "Vị trà đậm đà, béo ngậy ngọt thanh từ đường phèn tự nhiên kết hợp cùng táo đỏ, kỷ tử ăn vui miệng dã man luôn á! 😋✨";

    const p3 =
      "Trời lành lạnh mà cầm trên tay ly trà nóng hổi thơm phức thì bao nhiêu muộn phiền cũng tan biến hết trơn! " +
      "Điểm trừ nho nhỏ là quán hơi đông nên phải kiên nhẫn một xíu, nhưng bù lại được check-in sống ảo lung linh hết nấc nha! 📸🧋";

    const p4 =
      "Các đồng môn mê trà sữa đã thử món này chưa? " +
      "Tag ngay bạn bè hoặc để lại bình luận để rủ hội cạ cứng dắt đi uống ngay tối nay nào! 👇🎉❤️";

    const viralDraft = `${p1}\n\n${p2}\n\n${p3}\n\n${p4}`;

    // 2. Policy check
    const policy = await scanFacebookPolicy(viralDraft);
    assert.equal(policy.isSafe, true, "Viral F&B review should be clean and compliant");

    // 3. Social SEO Scorecard evaluation (verifying emoji density and CTA)
    const seo = await evaluateSocialSeo(viralDraft, entity, topicTitle);
    assert.equal(seo.metrics.hookEntityPresent, true);
    assert.ok(seo.metrics.emojiCount >= 5, "Must have vibrant emoji usage for viral tone");
    assert.equal(seo.metrics.hasCommentCta, true, "Must have interactive friend-tagging CTA");

    // 4. Generate 3-Tier Hashtags
    const hashtags = await generateThreeTierHashtags(topicTitle, entity, viralDraft);
    const postWithTags = appendHashtags(viralDraft, hashtags.allCombined);
    assert.ok(hashtags.tier3Trend.length > 0, "Must include trending hashtags");

    // 5. Image Alt Text & Caption
    const imageSeo = await generateImageSeoMetadata(topicTitle, entity);
    assert.ok(imageSeo.altText.toLowerCase().includes("trà sữa") || imageSeo.altText.toLowerCase().includes("đất nung"));

    // 6. Schedule for Morning Slot (07:30 Breakfast / Commute Browsing)
    const morningSlot = await getUpcomingPreset("morning");
    assert.equal(morningSlot.id, "morning");

    // 7. Store A/B Content Variations Payload
    const variations: VariationContentItem[] = [
      {
        style: "humorous_trend",
        title: topicTitle,
        content: postWithTags,
        hook: p1.slice(0, 100),
        createdAt: new Date().toISOString(),
      },
    ];

    // 8. Persist to DB
    const postId = "scenario_5_food_review_post";
    db.prepare(`
      INSERT INTO facebook_posts (
        id, topic_title, hook, content, status, scheduled_at,
        seo_score, policy_status, hashtags, alt_text, image_caption,
        content_style, variations_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      postId,
      topicTitle,
      p1.slice(0, 100),
      postWithTags,
      "scheduled",
      morningSlot.timestamp,
      seo.totalScore,
      "clean",
      hashtags.formattedBlock,
      imageSeo.altText,
      imageSeo.caption,
      "humorous_trend",
      JSON.stringify(variations)
    );

    const saved = db.prepare("SELECT * FROM facebook_posts WHERE id = ?").get(postId) as any;
    assert.ok(saved);
    assert.equal(saved.content_style, "humorous_trend");
    assert.equal(saved.status, "scheduled");
    assert.equal(saved.scheduled_at, morningSlot.timestamp);
    const savedVariations = JSON.parse(saved.variations_json);
    assert.equal(savedVariations[0].style, "humorous_trend");
  });

  return runner.getSummary();
}

if (
  import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}` ||
  process.argv[1]?.replace(/\\/g, "/").endsWith("tier4/real_world_scenarios.test.ts")
) {
  runTier4ScenarioTests().then((s) => {
    new TestRunnerContext(s.suiteName, s.tier, "T4-SCENARIOS").printSummary();
  });
}
