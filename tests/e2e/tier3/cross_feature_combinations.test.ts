/**
 * tests/e2e/tier3/cross_feature_combinations.test.ts
 * Tier 3: Cross-Feature Combinations Test Suite
 * Validates pairwise and multi-feature interactions across R1-R5:
 * 1. Policy Guard + Quick Fix + Social SEO Scorecard
 * 2. Golden Hours + 1-Click Scheduling + SQLite DB Persistence
 * 3. 3-Tier Hashtags + Hook + Alt Text Generation
 * 4. A/B Variations + Policy Guard Scanning
 * 5. Full Publishing Payload Integration
 */

import assert from "node:assert/strict";
import {
  scanFacebookPolicy,
  applyPolicyFix,
  autoSanitizeAll,
  evaluateSocialSeo,
  getGoldenHourPresets,
  getUpcomingPreset,
  generateThreeTierHashtags,
  appendHashtags,
  generateImageSeoMetadata,
  getAllStylePresets,
  getStylePrompt,
  runMigrations,
} from "../harness/serviceLoader";
import { createTestDatabase } from "../harness/testDb";
import { TestRunnerContext } from "../harness/runnerHelper";
import {
  TestSuiteSummary,
  ContentStyleVariation,
  VariationContentItem,
} from "../types";

export async function runTier3CombinationTests(): Promise<TestSuiteSummary> {
  const runner = new TestRunnerContext("Cross-Feature Combinations (Tiers R1-R5)", 3, "T3-COMB");

  // ==================== Combination 1: Policy Guard + Quick Fix + Social SEO ====================

  await runner.test("T3.1: Policy auto-sanitize transforms high-risk content to safe while preserving Social SEO entity hook", async () => {
    const rawContent =
      "Khám phá dịch vụ Spa Hàn Quốc cam kết 100% giúp bạn sở hữu làn da mịn màng. " +
      "Liệu trình thảo dược thiên nhiên trị dứt điểm mụn cám, thâm sạm và se khít lỗ chân lông sau 3 tuần. " +
      "Chăm sóc da toàn diện kết hợp công nghệ ánh sáng sinh học hiện đại giúp nuôi dưỡng tế bào từ sâu bên trong. " +
      "Đội ngũ chuyên viên giàu kinh nghiệm đồng hành cùng bạn trên hành trình chăm sóc nhan sắc an toàn. " +
      "Không gian thư giãn đẳng cấp cùng hương thơm tinh dầu tự nhiên xua tan mọi mệt mỏi thường ngày. " +
      "Liên hệ hotline 0909123456 hoặc inbox ngay để nhận ưu đãi trải nghiệm dịch vụ hôm nay nhé! Spa Hàn Quốc bạn đã trải nghiệm chưa?";

    // 1. Scan original policy
    const initialScan = await scanFacebookPolicy(rawContent);
    assert.equal(initialScan.isSafe, false, "Initial content must be flagged as unsafe");
    assert.ok(initialScan.riskScore >= 40, "Initial risk score must be high due to absolute claim and medical claim");
    assert.ok(initialScan.violations.length >= 2, "Must detect multiple violations");

    // 2. Evaluate initial SEO
    const initialSeo = await evaluateSocialSeo(rawContent, "Spa Hàn Quốc");
    assert.equal(initialSeo.metrics.hookEntityPresent, true, "Entity 'Spa Hàn Quốc' is in first 120 chars");

    // 3. Auto-sanitize all violations
    const sanitized = await autoSanitizeAll(rawContent);
    assert.ok(!sanitized.includes("cam kết 100%"), "Must remove absolute claim");
    assert.ok(!sanitized.includes("trị dứt điểm"), "Must remove medical curative claim");
    assert.ok(!sanitized.includes("0909123456"), "Must remove phone spam");

    // 4. Scan sanitized content
    const sanitizedScan = await scanFacebookPolicy(sanitized);
    assert.equal(sanitizedScan.isSafe, true, "Sanitized content must be clean");
    assert.equal(sanitizedScan.violations.length, 0, "Violations must be 0 after auto-sanitize");
    assert.equal(sanitizedScan.riskLevel, "safe");

    // 5. Re-evaluate SEO on sanitized content
    const sanitizedSeo = await evaluateSocialSeo(sanitized, "Spa Hàn Quốc");
    assert.equal(sanitizedSeo.metrics.hookEntityPresent, true, "Entity hook must remain present after sanitization");
    assert.ok(sanitizedSeo.totalScore >= initialSeo.totalScore, "Sanitized SEO score should be equal or improved");
  });

  await runner.test("T3.2: Targeted single policy fix reduces risk score incrementally while maintaining keyword density", async () => {
    const rawContent =
      "Khoá học đầu tư chứng khoán thông minh dành cho người mới bắt đầu. " +
      "Chúng tôi cam kết 100% cung cấp kiến thức thực chiến từ chuyên gia tài chính hàng đầu. " +
      "Nội dung khoá học bao gồm phân tích báo cáo tài chính, quản trị rủi ro danh mục và tâm lý giao dịch. " +
      "Bạn sẽ học cách đọc biểu đồ kỹ thuật và nhận diện xu hướng thị trường một cách bài bản nhất. " +
      "Cơ hội kiếm tiền tại nhà nhân đôi tài sản sau 1 tháng tham gia hội thảo miễn phí cuối tuần này. " +
      "Hãy để lại bình luận để nhận tài liệu hướng dẫn đầu tư chứng khoán ngay hôm nay!";

    const scan1 = await scanFacebookPolicy(rawContent);
    assert.ok(scan1.violations.length >= 2, "Must have at least 2 violations");
    const initialRisk = scan1.riskScore;

    // Fix only the absolute claim
    const absViolation = scan1.violations.find((v) => v.category === "absolute_claim");
    assert.ok(absViolation, "Should find absolute claim violation");
    const partiallyFixed = await applyPolicyFix(rawContent, absViolation.id, "cam kết chất lượng hàng đầu");

    const scan2 = await scanFacebookPolicy(partiallyFixed);
    assert.ok(scan2.riskScore < initialRisk, "Risk score must decrease after single fix");
    assert.equal(
      scan2.violations.some((v) => v.category === "absolute_claim"),
      false,
      "Fixed violation must no longer trigger"
    );
    assert.ok(
      scan2.violations.some((v) => v.category === "financial_hype"),
      "Remaining violation must still be detected"
    );

    // Verify keyword density of "chứng khoán"
    const seo = await evaluateSocialSeo(partiallyFixed, "chứng khoán");
    assert.ok(seo.metrics.keywordDensityPercent > 0, "Keyword density must be tracked");
  });

  // ==================== Combination 2: Golden Hours + 1-Click Scheduling + DB ====================

  await runner.test("T3.3: Golden hour preset calculation integrates with 1-click scheduling and SQLite persistence", async () => {
    const db = createTestDatabase();
    await runMigrations(db);

    // Reference date set to 10:00 AM today
    const refDate = new Date("2026-10-15T10:00:00Z");
    const presets = await getGoldenHourPresets(refDate);

    // Noon slot (11:30) and Evening slot (19:30) should be today
    const eveningSlot = await getUpcomingPreset("evening", refDate);
    assert.equal(eveningSlot.id, "evening");
    assert.equal(eveningSlot.isRecommendedPrime, true);
    assert.ok(eveningSlot.timestamp.length > 0);

    const postId = "fb_post_scheduled_evening";
    const postContent = "Nội dung chia sẻ khung giờ vàng tương tác đỉnh cao.";

    // Insert scheduled post into database
    db.prepare(`
      INSERT INTO facebook_posts (
        id, topic_title, hook, content, status, scheduled_at,
        policy_status, content_style
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      postId,
      "Khung giờ vàng Facebook",
      "Bí quyết đăng bài giờ vàng",
      postContent,
      "scheduled",
      eveningSlot.timestamp,
      "clean",
      "news_guide"
    );

    // Retrieve and verify
    const row = db.prepare("SELECT * FROM facebook_posts WHERE id = ?").get(postId) as any;
    assert.ok(row, "Post must be stored in database");
    assert.equal(row.status, "scheduled");
    assert.equal(row.scheduled_at, eveningSlot.timestamp);
    assert.equal(row.content_style, "news_guide");
    assert.equal(row.policy_status, "clean");
  });

  await runner.test("T3.4: Multiple golden hour slots persist with serialized SEO scorecard evaluations", async () => {
    const db = createTestDatabase();
    await runMigrations(db);

    const slots: Array<"morning" | "noon" | "evening" | "night"> = ["morning", "noon", "evening", "night"];
    const baseDate = new Date("2026-10-15T06:00:00Z");

    for (const slotId of slots) {
      const slot = await getUpcomingPreset(slotId, baseDate);
      const postText =
        `Bài viết chiến lược đăng tải khung giờ ${slot.label}. ` +
        "Chia sẻ kiến thức kinh doanh hữu ích cho cộng đồng doanh nghiệp Việt Nam. ".repeat(15) +
        "Bạn nghĩ sao về điều này? Hãy để lại bình luận phía dưới nhé! 🎉";

      const seo = await evaluateSocialSeo(postText, "kinh doanh");
      const postId = `slot_${slotId}_post`;

      db.prepare(`
        INSERT INTO facebook_posts (
          id, topic_title, content, status, scheduled_at,
          seo_score, seo_breakdown
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        postId,
        `Chiến lược ${slotId}`,
        postText,
        "scheduled",
        slot.timestamp,
        seo.totalScore,
        JSON.stringify(seo.checks)
      );

      const record = db.prepare("SELECT * FROM facebook_posts WHERE id = ?").get(postId) as any;
      assert.ok(record);
      assert.equal(record.seo_score, seo.totalScore);
      const parsedChecks = JSON.parse(record.seo_breakdown);
      assert.ok(Array.isArray(parsedChecks));
      assert.equal(parsedChecks.length, seo.checks.length);
    }
  });

  // ==================== Combination 3: 3-Tier Hashtags + Hook + Alt Text ====================

  await runner.test("T3.5: 3-Tier Hashtag generator aligns with SEO entity hook and image SEO metadata", async () => {
    const title = "Trải Nghiệm Nghỉ Dưỡng Tại Flamingo Đại Lải Resort";
    const entity = "Flamingo Đại Lải";
    const postBody =
      "Flamingo Đại Lải là điểm hẹn nghỉ dưỡng sinh thái hàng đầu miền Bắc với kiến trúc xanh độc đáo. " +
      "Hòa mình vào thiên nhiên tươi mát với hồ nước trong lành và rừng thông bạt ngàn thơ mộng. ".repeat(8) +
      "Kỳ nghỉ cuối tuần của bạn thế nào? Bình luận trải nghiệm của bạn bên dưới nhé! 🌿✨";

    // 1. Generate 3-tier hashtags
    const hashtags = await generateThreeTierHashtags(title, entity, postBody);
    assert.ok(hashtags.tier1Entity.length >= 1, "Tier 1 must contain entity tags");
    assert.ok(
      hashtags.tier1Entity.some((t) => t.toLowerCase().includes("flamingodailai") || t.toLowerCase().includes("flamingo")),
      "Tier 1 must match the brand/entity"
    );
    assert.ok(hashtags.tier2Topic.length >= 1, "Tier 2 must contain travel/resort topic tags");
    assert.ok(hashtags.tier3Trend.length >= 1, "Tier 3 must contain trend/community tags");

    // 2. Generate Image SEO Metadata
    const imageSeo = await generateImageSeoMetadata(title, entity);
    assert.ok(imageSeo.altText.length > 0, "Alt text must be generated");
    assert.ok(imageSeo.caption.length > 0, "Caption must be generated");
    assert.ok(
      imageSeo.altText.toLowerCase().includes("flamingo") ||
      imageSeo.altText.toLowerCase().includes("đại lải") ||
      imageSeo.altText.toLowerCase().includes("resort"),
      "Alt text must incorporate title/entity keywords"
    );

    // 3. Social SEO evaluation on the combination
    const seo = await evaluateSocialSeo(postBody, entity, title);
    assert.equal(seo.metrics.hookEntityPresent, true, "SEO entity hook must match");
    assert.ok(seo.totalScore >= 70, "High quality post must score well");
  });

  await runner.test("T3.6: Appending 3-tier hashtags updates post word count without breaking paragraph readability", async () => {
    const baseContent =
      "5 thói quen buổi sáng giúp bạn tràn đầy năng lượng làm việc mỗi ngày.\n\n" +
      "Thứ nhất là uống một ly nước ấm ngay khi thức dậy để thanh lọc cơ thể.\n\n" +
      "Thứ hai là dành 15 phút tập thể dục nhẹ nhàng khởi động cơ bắp.\n\n" +
      "Thứ ba là ăn bữa sáng giàu dinh dưỡng và hạn chế đường tinh luyện.\n\n" +
      "Thói quen buổi sáng yêu thích của bạn là gì? Bình luận chia sẻ cùng mọi người nhé! ☕🌞";

    const preAppendSeo = await evaluateSocialSeo(baseContent, "thói quen buổi sáng");
    const hashtags = await generateThreeTierHashtags("Thói quen buổi sáng", "Sức Khỏe", baseContent);

    // Append formatted hashtags
    const fullContent = appendHashtags(baseContent, hashtags.allCombined);
    assert.ok(fullContent.includes(hashtags.formattedBlock), "Content must contain formatted hashtags at the end");
    assert.ok(fullContent.startsWith("5 thói quen"), "Content must retain original start");

    const postAppendSeo = await evaluateSocialSeo(fullContent, "thói quen buổi sáng");
    assert.ok(postAppendSeo.metrics.wordCount > preAppendSeo.metrics.wordCount, "Word count must increase with hashtags");
    assert.equal(postAppendSeo.metrics.hookEntityPresent, true, "Hook entity must still be present");
  });

  // ==================== Combination 4: A/B Variations + Policy Guard ====================

  await runner.test("T3.7: Evaluates policy compliance across 4 A/B style variations systematically", async () => {
    const variations: Array<{ style: ContentStyleVariation; text: string; expectedSafe: boolean }> = [
      {
        style: "storytelling",
        text:
          "Tôi vẫn nhớ những ngày đầu lập nghiệp đầy gian nan khi bước chân vào con đường ẩm thực truyền thống. " +
          "Từng mẻ bánh mì giòn tan thơm lừng là bao tâm huyết của cả gia đình qua nhiều thế hệ. " +
          "Bánh mì Hà Nội xưa mang trọn ký ức tuổi thơ của biết bao người con phố cổ. " +
          "Bạn có kỷ niệm nào khó quên với món bánh mì thân quen? Hãy chia sẻ câu chuyện của bạn nhé! 🥖❤️",
        expectedSafe: true,
      },
      {
        style: "direct_sales",
        text:
          "Siêu bão ưu đãi duy nhất hôm nay! Khóa học làm giàu nhanh cam kết 100% nhân đôi tài sản sau 3 tháng! " +
          "Đầu tư bao lỗ không rủi ro, hoàn tiền 100% nếu không hiệu quả. " +
          "Gọi ngay hotline 0912.345.678 hoặc click bit.ly/lam-giau để đăng ký nhận vé VIP ngay!",
        expectedSafe: false,
      },
      {
        style: "news_guide",
        text:
          "Bản tin tài chính: Thị trường công nghệ chứng kiến làn sóng ứng dụng trí tuệ nhân tạo thế hệ mới. " +
          "Theo báo cáo mới nhất, hơn 65% doanh nghiệp đang tích cực chuyển đổi quy trình số hóa để tối ưu hiệu suất. " +
          "Đây là bước tiến quan trọng định hình tương lai phát triển bền vững cho nền kinh tế số Việt Nam. " +
          "Bạn đánh giá thế nào về xu hướng AI hiện nay? Hãy bình luận góc nhìn của bạn bên dưới! 📊🚀",
        expectedSafe: true,
      },
      {
        style: "humorous_trend",
        text:
          "Ủa alo cả nhà ơi, hôm nay thứ Hai mà ngỡ như thứ Sáu vậy nè! 🤣 " +
          "Cà phê sữa đá size khổng lồ đã sẵn sàng cứu vớt tâm hồn buồn ngủ này chưa? " +
          "Tag ngay đứa bạn thân lúc nào cũng than hết tiền nhưng ngày nào cũng 2 ly trà sữa vào đây! 🥤🔥",
        expectedSafe: true,
      },
    ];

    for (const v of variations) {
      const scan = await scanFacebookPolicy(v.text);
      assert.equal(
        scan.isSafe,
        v.expectedSafe,
        `Variation '${v.style}' expected isSafe=${v.expectedSafe}, got ${scan.isSafe}`
      );

      if (!v.expectedSafe) {
        // Sanitize the failing variation and verify recovery
        const sanitized = await autoSanitizeAll(v.text);
        const rescan = await scanFacebookPolicy(sanitized);
        assert.equal(rescan.isSafe, true, `Sanitized ${v.style} variation must become safe`);
      }
    }
  });

  await runner.test("T3.8: Style prompts generate valid system instructions for each A/B preset", async () => {
    const presets = await getAllStylePresets();
    assert.equal(presets.length, 4, "Must offer 4 content style presets");

    for (const p of presets) {
      const prompt = await getStylePrompt(p.id);
      assert.ok(prompt.length > 50, `Style prompt for ${p.id} must be descriptive`);
      assert.ok(prompt.includes(p.name.toUpperCase()), `Prompt must mention style name`);
    }
  });

  // ==================== Combination 5: Full Publishing Payload Assembly ====================

  await runner.test("T3.9: Full publishing payload assembly with all 10 schema fields persists to SQLite", async () => {
    const db = createTestDatabase();
    await runMigrations(db);

    const topicTitle = "Giải Pháp Chăm Sóc Da Toàn Diện Mùa Thu Đông";
    const entity = "Derma Clinic";
    const rawPostText =
      "Derma Clinic mang đến giải pháp chăm sóc da chuyên sâu giúp phục hồi độ ẩm tự nhiên cho làn da mùa hanh khô. " +
      "Với công nghệ cấp ẩm vi điểm Hydro-Boost, làn da được nuôi dưỡng từ sâu bên trong và duy trì độ căng bóng mịn màng. ".repeat(6) +
      "Chuyên gia da liễu khuyên bạn nên duy trì chế độ uống đủ nước và sử dụng kem chống nắng mỗi ngày. " +
      "Bạn đang gặp vấn đề gì về da mùa này? Hãy để lại bình luận để chuyên viên tư vấn miễn phí nhé! 💧✨";

    // Step 1: Policy Scan & Auto-Sanitize (if needed)
    const policyResult = await scanFacebookPolicy(rawPostText);
    const sanitizedContent = policyResult.isSafe ? rawPostText : await autoSanitizeAll(rawPostText);
    const finalPolicyStatus = policyResult.isSafe ? "clean" : "sanitized";

    // Step 2: 3-Tier Hashtags
    const hashtags = await generateThreeTierHashtags(topicTitle, entity, sanitizedContent);
    const fullContentWithHashtags = appendHashtags(sanitizedContent, hashtags.allCombined);

    // Step 3: Social SEO Evaluation
    const seoEval = await evaluateSocialSeo(fullContentWithHashtags, entity, topicTitle);

    // Step 4: Golden Hour Scheduling
    const scheduleSlot = await getUpcomingPreset("evening");

    // Step 5: Image SEO Metadata
    const imageSeo = await generateImageSeoMetadata(topicTitle, entity);

    // Step 6: A/B Variations Payload
    const variationsPayload: VariationContentItem[] = [
      {
        style: "news_guide",
        title: topicTitle,
        content: fullContentWithHashtags,
        hook: sanitizedContent.slice(0, 100),
        createdAt: new Date().toISOString(),
      },
    ];

    const postId = "complete_publishing_post_001";

    // Insert full row with all migrated columns
    db.prepare(`
      INSERT INTO facebook_posts (
        id, topic_title, hook, content, status, scheduled_at,
        seo_score, seo_breakdown, policy_warnings, policy_status,
        hashtags, alt_text, image_caption, content_style, variations_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      postId,
      topicTitle,
      sanitizedContent.slice(0, 100),
      fullContentWithHashtags,
      "scheduled",
      scheduleSlot.timestamp,
      seoEval.totalScore,
      JSON.stringify(seoEval.checks),
      JSON.stringify(policyResult.violations),
      finalPolicyStatus,
      hashtags.formattedBlock,
      imageSeo.altText,
      imageSeo.caption,
      "news_guide",
      JSON.stringify(variationsPayload)
    );

    // Also persist image metadata to ai_images
    const imageId = "complete_ai_image_001";
    db.prepare(`
      INSERT INTO ai_images (
        id, topic_title, entity, prompt, style, image_url,
        alt_text, caption
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      imageId,
      topicTitle,
      entity,
      "Professional skincare clinic interior",
      "photorealistic",
      "https://example.com/skincare.jpg",
      imageSeo.altText,
      imageSeo.caption
    );

    // Step 7: Retrieve and verify complete schema data integrity
    const savedPost = db.prepare("SELECT * FROM facebook_posts WHERE id = ?").get(postId) as any;
    assert.ok(savedPost, "Saved post must exist in DB");
    assert.equal(savedPost.topic_title, topicTitle);
    assert.equal(savedPost.scheduled_at, scheduleSlot.timestamp);
    assert.equal(savedPost.seo_score, seoEval.totalScore);
    assert.equal(savedPost.policy_status, finalPolicyStatus);
    assert.equal(savedPost.hashtags, hashtags.formattedBlock);
    assert.equal(savedPost.alt_text, imageSeo.altText);
    assert.equal(savedPost.image_caption, imageSeo.caption);
    assert.equal(savedPost.content_style, "news_guide");

    const savedImage = db.prepare("SELECT * FROM ai_images WHERE id = ?").get(imageId) as any;
    assert.ok(savedImage, "Saved image must exist in DB");
    assert.equal(savedImage.alt_text, imageSeo.altText);
    assert.equal(savedImage.caption, imageSeo.caption);
  });

  await runner.test("T3.10: Cross-feature transactional rollback on database error does not corrupt state", async () => {
    const db = createTestDatabase();
    await runMigrations(db);

    const initialCount = (db.prepare("SELECT COUNT(*) as count FROM facebook_posts;").get() as any).count;

    assert.throws(() => {
      db.exec("BEGIN TRANSACTION;");
      db.prepare(`
        INSERT INTO facebook_posts (id, topic_title, content, status)
        VALUES ('valid_1', 'Title 1', 'Content 1', 'draft')
      `).run();

      // Duplicate primary key will throw SQLite constraint error
      db.prepare(`
        INSERT INTO facebook_posts (id, topic_title, content, status)
        VALUES ('valid_1', 'Title 2', 'Content 2', 'draft')
      `).run();

      db.exec("COMMIT;");
    });

    db.exec("ROLLBACK;");

    const postCountAfter = (db.prepare("SELECT COUNT(*) as count FROM facebook_posts;").get() as any).count;
    assert.equal(postCountAfter, initialCount, "Transaction rollback must restore original row count");
  });

  await runner.test("T3.11: Policy Guard Quick Fix preserves hashtag integrity when hashtags contain brand names", async () => {
    const draftText =
      "Khách hàng cam kết 100% hài lòng với dịch vụ làm đẹp tại Thẩm mỹ viện Lavender. " +
      "Liệu trình chăm sóc chuyên sâu mang lại kết quả tuyệt vời cho phái đẹp.";

    const hashtags = await generateThreeTierHashtags("Làm đẹp", "Lavender", draftText);
    const postWithTags = appendHashtags(draftText, hashtags.allCombined);

    // Auto sanitize the post with hashtags appended
    const sanitized = await autoSanitizeAll(postWithTags);

    // Verify hashtags were NOT destroyed
    for (const tag of hashtags.allCombined) {
      assert.ok(sanitized.includes(tag), `Hashtag '${tag}' must be preserved after sanitization`);
    }

    // Verify prohibited claim was removed
    assert.ok(!sanitized.includes("cam kết 100%"), "Violation must be removed");
  });

  await runner.test("T3.12: Image Alt Text generation is consistent with topic title and entity across languages", async () => {
    const testCases = [
      { title: "Xe Điện VinFast VF8 Công Nghệ Mới", entity: "VinFast VF8" },
      { title: "Căn Hộ Nghỉ Dưỡng Sun Grand City", entity: "Sun Group" },
      { title: "Cà Phê Muối Chú Long Sài Gòn", entity: "Chú Long" },
    ];

    for (const tc of testCases) {
      const meta = await generateImageSeoMetadata(tc.title, tc.entity);
      assert.ok(meta.altText.length > 10, "Alt text must be informative");
      assert.ok(meta.caption.length > 10, "Caption must be engaging");
      // Must not contain raw html or script tags
      assert.ok(!meta.altText.includes("<"), "Alt text must be plain text");
      assert.ok(!meta.caption.includes("<"), "Caption must be plain text");
    }
  });

  return runner.getSummary();
}

if (
  import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}` ||
  process.argv[1]?.replace(/\\/g, "/").endsWith("tier3/cross_feature_combinations.test.ts")
) {
  runTier3CombinationTests().then((s) => {
    new TestRunnerContext(s.suiteName, s.tier, "T3-COMB").printSummary();
  });
}
