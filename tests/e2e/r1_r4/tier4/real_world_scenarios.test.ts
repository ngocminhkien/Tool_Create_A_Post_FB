/**
 * tests/e2e/r1_r4/tier4/real_world_scenarios.test.ts
 * Tier 4 — Real-World Editorial Scenarios (Requirements R1 - R4)
 * Simulates complete end-to-end user workflows: Tech monitoring, Policy-heavy beauty sanitization,
 * Evergreen travel recycling, E-commerce flash sale albums, and Brand safety crisis rejection.
 */

import { TestRunnerContext } from "../../harness/runnerHelper";
import { createTestDatabase } from "../../harness/testDb";
import {
  saveTargetPage,
  saveSourcePage,
  collectPosts,
  triggerEvergreenFallback,
  rewriteSourcePost,
  createQueueItem,
  getQueueItemById,
  updateQueueDraft,
  approveAndSchedule,
  approveAndPublish,
  rejectQueueItem,
  getUpcomingPreset,
  buildMultiPhotoPayload,
} from "../../harness/serviceLoader";
import { TestSuiteSummary } from "../../types";

export async function runTier4R1R4ScenarioTests(): Promise<TestSuiteSummary> {
  const ctx = new TestRunnerContext("Tier 4: R1-R4 Real-World Editorial Scenarios", 4, "SCENARIOS");

  await ctx.test("Scenario 1: Tech Agency Competitor Monitoring & Golden Hour Evening Scheduling", async () => {
    const db = createTestDatabase();

    // Setup Target Page
    await saveTargetPage(db, {
      id: "tgt_tech_corp",
      pageId: "fb_tech_corp",
      pageName: "Công Nghệ 24/7 Official",
      accessToken: "token_tech_secret",
      isDefault: true,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Add Source Page via public URL
    await saveSourcePage(db, {
      id: "src_tech_crunch_vn",
      name: "Tech News Vietnam",
      url: "https://www.facebook.com/technews.vietnam",
      inputMode: "url_scrape",
      scanPostLimit: 3,
      status: "active",
      totalPostsScanned: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Collect 3 posts
    const collectRes = await collectPosts(db, { sourcePageId: "src_tech_crunch_vn", limit: 3 }, [
      {
        facebookPostId: "post_tech_ai_1",
        originalContent: "Trí tuệ nhân tạo tạo sinh đang thay đổi toàn diện ngành lập trình và thiết kế phần mềm tại Việt Nam.",
        originalMediaUrls: ["https://example.com/ai_code.jpg"],
        publishedTime: new Date().toISOString(),
        likeCount: 450,
      },
      {
        facebookPostId: "post_tech_cloud_2",
        originalContent: "Hạ tầng đám mây tối ưu hóa chi phí cho các doanh nghiệp khởi nghiệp.",
        publishedTime: new Date().toISOString(),
        likeCount: 180,
      },
      {
        facebookPostId: "post_tech_security_3",
        originalContent: "Cảnh báo các thủ đoạn lừa đảo qua mạng xã hội mới nhất.",
        publishedTime: new Date().toISOString(),
        likeCount: 620,
      },
    ]);

    if (collectRes.newCollected !== 3) {
      throw new Error(`Expected 3 new collected posts, got ${collectRes.newCollected}`);
    }

    // AI Rewrite post 1 with Storytelling style
    const selectedPost = collectRes.posts[0];
    const rewriteRes = await rewriteSourcePost({
      sourcePostId: selectedPost.id,
      sourcePageName: "Tech News Vietnam",
      sourceContent: selectedPost.originalContent,
      sourceImages: selectedPost.mediaUrls,
      targetPageId: "tgt_tech_corp",
      targetPageName: "Công Nghệ 24/7 Official",
      style: "storytelling",
    });

    await createQueueItem(db, rewriteRes.queueItem);

    // Human Editor reviews in Moderation Queue and polishes hook
    const editedHook = "Bạn có tin một kỹ sư trẻ có thể hoàn thành dự án lớn chỉ trong 3 ngày nhờ AI?";
    await updateQueueDraft(db, rewriteRes.queueItem.id, {
      aiHook: editedHook,
    });

    // Schedule for Golden Hour Evening Prime (19:30 - 21:30)
    const eveningSlot = await getUpcomingPreset("evening");
    const scheduled = await approveAndSchedule(db, rewriteRes.queueItem.id, eveningSlot.timestamp);

    if (scheduled.status !== "scheduled") {
      throw new Error("Scenario 1 failed to reach scheduled status");
    }
    if (scheduled.aiHook !== editedHook) {
      throw new Error("Scenario 1 failed to retain editor's customized hook");
    }
  });

  await ctx.test("Scenario 2: Beauty & Skincare Ingestion with Severe Meta Policy Violations Sanitized", async () => {
    const db = createTestDatabase();

    await saveTargetPage(db, {
      id: "tgt_beauty_clinic",
      pageId: "fb_beauty_clinic",
      pageName: "Viện Thẩm Mỹ Chuẩn Y Khoa",
      accessToken: "token_beauty_secret",
      isDefault: true,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await saveSourcePage(db, {
      id: "src_beauty_competitor",
      name: "Thẩm Mỹ Viện Cạnh Tranh",
      url: "https://facebook.com/thammy.canhtranh",
      inputMode: "url_scrape",
      scanPostLimit: 1,
      status: "active",
      totalPostsScanned: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Toxic source post with forbidden Meta terms: "cam kết 100%", "trị dứt điểm", and phone spam
    const toxicContent =
      "Liệu trình cam kết 100% giúp bạn trị dứt điểm nám và tàn nhang chỉ sau 3 ngày! " +
      "Gọi ngay hotline 0987654321 để nhận ưu đãi hoàn tiền nếu không hiệu quả.";

    const collectRes = await collectPosts(db, { sourcePageId: "src_beauty_competitor", limit: 1 }, [
      {
        facebookPostId: "fb_toxic_beauty_post",
        originalContent: toxicContent,
        publishedTime: new Date().toISOString(),
      },
    ]);

    const post = collectRes.posts[0];
    const rewriteRes = await rewriteSourcePost({
      sourcePostId: post.id,
      sourcePageName: "Thẩm Mỹ Viện Cạnh Tranh",
      sourceContent: post.originalContent,
      targetPageId: "tgt_beauty_clinic",
      targetPageName: "Viện Thẩm Mỹ Chuẩn Y Khoa",
      style: "direct_sales",
    });

    const item = rewriteRes.queueItem;
    // Verify all policy violations were cleansed
    if (item.aiFullPost.includes("cam kết 100%")) throw new Error("Violates absolute claim policy");
    if (item.aiFullPost.includes("trị dứt điểm")) throw new Error("Violates curative medical policy");
    if (item.aiFullPost.includes("0987654321")) throw new Error("Violates phone spam policy");

    await createQueueItem(db, item);

    // Medical director approves and publishes immediately
    const published = await approveAndPublish(db, item.id);
    if (published.status !== "published") {
      throw new Error("Scenario 2 publication failed");
    }
  });

  await ctx.test("Scenario 3: Travel Agency Evergreen Recycling Campaign when No New Posts Found", async () => {
    const db = createTestDatabase();
    const sourcePageId = "src_travel_expert";

    await saveSourcePage(db, {
      id: sourcePageId,
      name: "Travel Review Vietnam",
      url: "https://facebook.com/travel.vietnam",
      inputMode: "url_scrape",
      scanPostLimit: 1,
      status: "active",
      totalPostsScanned: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const now = Date.now();
    const DAY_MS = 24 * 3600 * 1000;

    // Seed post from 28 days ago (1800 likes, Dalat trip)
    const dalatPost = {
      id: "spost_dalat_viral",
      facebookPostId: "fb_dalat_post",
      originalContent: "Lịch trình khám phá Đà Lạt 3 ngày 2 đêm săn mây và check-in các quán cà phê view thung lũng tuyệt đẹp.",
      originalMediaUrls: ["https://example.com/dalat_cloud.jpg"],
      publishedTime: new Date(now - 28 * DAY_MS).toISOString(),
      likeCount: 1800,
      commentCount: 220,
      shareCount: 95,
    };

    await collectPosts(db, { sourcePageId, limit: 1 }, [dalatPost]);

    // Rescan today: All recent posts are duplicates
    const rescan = await collectPosts(db, { sourcePageId, limit: 1 }, [dalatPost]);

    if (!rescan.allAlreadyCollected) {
      throw new Error("Evergreen trigger failed to detect duplicate exhaustion");
    }
    if (!rescan.message.includes("Tất cả bài gần nhất đều đã được lấy")) {
      throw new Error(`Verbatim notice missing: '${rescan.message}'`);
    }
    if (!rescan.evergreenSuggestion) {
      throw new Error("Expected Dalat post to be suggested as evergreen candidate");
    }

    // Trigger evergreen repurpose
    await triggerEvergreenFallback(db, rescan.evergreenSuggestion.id);

    const rewriteRes = await rewriteSourcePost({
      sourcePostId: rescan.evergreenSuggestion.id,
      sourcePageName: "Travel Review Vietnam",
      sourceContent: rescan.evergreenSuggestion.originalContent,
      sourceImages: rescan.evergreenSuggestion.mediaUrls,
      style: "storytelling",
      isEvergreen: true,
      customInstruction: "Tái hiện vẻ đẹp Đà Lạt mùa hoa nở với góc nhìn lãng mạn",
    });

    await createQueueItem(db, rewriteRes.queueItem);
    const itemInDb = await getQueueItemById(db, rewriteRes.queueItem.id);

    if (itemInDb?.status !== "pending") {
      throw new Error("Repurposed evergreen item must enter queue in pending status");
    }
  });

  await ctx.test("Scenario 4: E-Commerce 4-Photo Album Flash Sale Ingestion & Multi-Photo Publishing", async () => {
    const db = createTestDatabase();

    await saveTargetPage(db, {
      id: "tgt_ecommerce_store",
      pageId: "fb_ecom_store",
      pageName: "Cửa Hàng Gia Dụng Thông Minh",
      accessToken: "token_ecom_secret",
      isDefault: true,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await saveSourcePage(db, {
      id: "src_gadget_hub",
      name: "Gadget Hub Global",
      url: "https://facebook.com/gadget.hub",
      inputMode: "url_scrape",
      scanPostLimit: 1,
      status: "active",
      totalPostsScanned: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Ingest post with 4 high-res product photos
    const productPhotos = [
      "https://example.com/gadget_main.jpg",
      "https://example.com/gadget_side.jpg",
      "https://example.com/gadget_in_hand.jpg",
      "https://example.com/gadget_packaging.jpg",
    ];

    const collectRes = await collectPosts(db, { sourcePageId: "src_gadget_hub", limit: 1 }, [
      {
        facebookPostId: "fb_ecom_product_launch",
        originalContent: "Bộ sưu tập thiết bị gia dụng thông minh thế hệ mới tiết kiệm 40% điện năng.",
        originalMediaUrls: productPhotos,
        publishedTime: new Date().toISOString(),
      },
    ]);

    const post = collectRes.posts[0];
    const rewriteRes = await rewriteSourcePost({
      sourcePostId: post.id,
      sourcePageName: "Gadget Hub Global",
      sourceContent: post.originalContent,
      sourceImages: post.mediaUrls,
      targetPageId: "tgt_ecommerce_store",
      targetPageName: "Cửa Hàng Gia Dụng Thông Minh",
      style: "direct_sales",
    });

    await createQueueItem(db, rewriteRes.queueItem);

    // Verify all 4 photos are linked
    if (rewriteRes.queueItem.selectedImages.length !== 4) {
      throw new Error(`Expected 4 photos linked, got ${rewriteRes.queueItem.selectedImages.length}`);
    }

    // Verify Graph API album payload
    const albumPayload = buildMultiPhotoPayload(rewriteRes.queueItem);
    if (albumPayload.mode !== "multi_photo_album" || albumPayload.payload.attached_media.length !== 4) {
      throw new Error("Failed to construct 4-photo multi_photo_album payload");
    }

    // Approve & Publish
    const published = await approveAndPublish(db, rewriteRes.queueItem.id);
    if (published.status !== "published") {
      throw new Error("Flash sale album publishing failed");
    }
  });

  await ctx.test("Scenario 5: Editorial Governance Rejection & Brand Safety Protection Workflow", async () => {
    const db = createTestDatabase();

    await saveSourcePage(db, {
      id: "src_controversial_gossip",
      name: "Kênh Tin Tức Drama",
      url: "https://facebook.com/tin.drama",
      inputMode: "url_scrape",
      scanPostLimit: 1,
      status: "active",
      totalPostsScanned: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const collectRes = await collectPosts(db, { sourcePageId: "src_controversial_gossip", limit: 1 }, [
      {
        facebookPostId: "fb_drama_post_unverified",
        originalContent: "Tin đồn chưa xác thực về vụ tranh chấp tài sản của doanh nghiệp X.",
        publishedTime: new Date().toISOString(),
      },
    ]);

    const post = collectRes.posts[0];
    const rewriteRes = await rewriteSourcePost({
      sourcePostId: post.id,
      sourcePageName: "Kênh Tin Tức Drama",
      sourceContent: post.originalContent,
      style: "news_guide",
    });

    await createQueueItem(db, rewriteRes.queueItem);

    // Editorial Director assesses reputation risk and REJECTS the draft
    const rejected = await rejectQueueItem(db, rewriteRes.queueItem.id);

    if (rejected.status !== "rejected") {
      throw new Error("Rejection failed to set status 'rejected'");
    }

    // Confirm that rejected item cannot accidentally be published
    let publishThrew = false;
    try {
      await approveAndPublish(db, rewriteRes.queueItem.id);
    } catch {
      publishThrew = true;
    }

    if (!publishThrew) {
      throw new Error("Brand safety breach: System allowed publishing a rejected draft!");
    }
  });

  return ctx.getSummary();
}
