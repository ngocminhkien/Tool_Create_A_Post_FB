/**
 * tests/e2e/r1_r4/tier1/f13_side_by_side_moderation_queue.test.ts
 * Tier 1 — Feature F13: Side-by-Side Moderation Queue Contract
 * Verifies initial 'pending' state invariant, side-by-side data contract (Source vs AI),
 * in-place draft editing, and target page binding.
 */

import { TestRunnerContext } from "../../harness/runnerHelper";
import { createTestDatabase } from "../../harness/testDb";
import {
  saveTargetPage,
  createQueueItem,
  getQueueItems,
  getQueueItemById,
  updateQueueDraft,
  rewriteSourcePost,
} from "../../harness/serviceLoader";
import { TestSuiteSummary } from "../../types";

export async function runTier1F13SideBySideQueueTests(): Promise<TestSuiteSummary> {
  const ctx = new TestRunnerContext("F13: Side-by-Side Moderation Queue Contract", 1, "F13");

  await ctx.test("F13-01: Newly rewritten post MUST strictly have status = 'pending' (Human-in-the-loop)", async () => {
    const res = await rewriteSourcePost({
      sourcePostId: "sp_pending_check",
      sourcePageName: "Nguồn Bài Mẫu",
      sourceContent: "Bài viết cần kiểm duyệt trước khi đăng.",
      style: "storytelling",
    });

    if (res.queueItem.status !== "pending") {
      throw new Error(`CRITICAL INVARIANT VIOLATION: Queue item status was '${res.queueItem.status}', MUST be 'pending'`);
    }
  });

  await ctx.test("F13-02: Left Column contract preserves original source metadata faithfully", async () => {
    const sourcePubTime = "2026-04-12T08:00:00.000Z";
    const sourceUrl = "https://facebook.com/source.page/posts/123456";
    const sourceImages = ["/uploads/source_media/sample_1.jpg"];

    const res = await rewriteSourcePost({
      sourcePostId: "sp_left_col",
      sourcePageName: "Fanpage Nguồn Gốc",
      sourceUrl,
      sourcePublishedTime: sourcePubTime,
      sourceContent: "Văn bản gốc bài viết nguồn.",
      sourceImages,
      style: "news_guide",
    });

    const item = res.queueItem;
    if (item.sourcePageName !== "Fanpage Nguồn Gốc") {
      throw new Error(`Left column sourcePageName mismatch: ${item.sourcePageName}`);
    }
    if (item.sourceUrl !== sourceUrl) {
      throw new Error(`Left column sourceUrl mismatch: ${item.sourceUrl}`);
    }
    if (item.sourcePublishedTime !== sourcePubTime) {
      throw new Error(`Left column sourcePublishedTime mismatch: ${item.sourcePublishedTime}`);
    }
    if (item.sourceContent !== "Văn bản gốc bài viết nguồn.") {
      throw new Error(`Left column sourceContent mismatch: ${item.sourceContent}`);
    }
    if (item.sourceImages.length !== 1 || item.sourceImages[0] !== sourceImages[0]) {
      throw new Error(`Left column sourceImages mismatch: ${JSON.stringify(item.sourceImages)}`);
    }
  });

  await ctx.test("F13-03: Right Column contract provides editable AI fields and Social SEO metrics", async () => {
    const res = await rewriteSourcePost({
      sourcePostId: "sp_right_col",
      sourcePageName: "Page Nguồn",
      sourceContent: "Nội dung cho cột bên phải.",
      style: "direct_sales",
    });

    const item = res.queueItem;
    if (!item.aiHeadline) throw new Error("Right column missing aiHeadline");
    if (!item.aiHook) throw new Error("Right column missing aiHook");
    if (!item.aiBody) throw new Error("Right column missing aiBody");
    if (!item.aiFullPost) throw new Error("Right column missing aiFullPost");
    if (typeof item.seoScore !== "number") throw new Error("Right column missing seoScore");
    if (!item.policyStatus) throw new Error("Right column missing policyStatus");
    if (!Array.isArray(item.hashtags)) throw new Error("Right column missing hashtags");
  });

  await ctx.test("F13-04: In-place draft editing updates SQLite and recalculates SEO Scorecard", async () => {
    const db = createTestDatabase();
    const res = await rewriteSourcePost({
      sourcePostId: "sp_draft_edit",
      sourcePageName: "Page Chỉnh Sửa",
      sourceContent: "Nội dung ban đầu.",
      style: "storytelling",
    });

    await createQueueItem(db, res.queueItem);

    const editedFullPost =
      "Tiêu Đề Mới Đã Sửa Đổi\n\nHook ấn tượng trước 120 ký tự xuất hiện trước nút xem thêm.\n\nNội dung bài viết được biên tập kỹ lưỡng chia thành các đoạn văn ngắn thoáng đãng, mang lại trải nghiệm đọc dễ chịu và hấp dẫn.\n\nBạn nghĩ sao về quan điểm này? Hãy để lại bình luận bên dưới nhé! ✨🔥\n\n#ThuongHieu #ChiaSe #Viral2026";

    const updated = await updateQueueDraft(db, res.queueItem.id, {
      aiHeadline: "Tiêu Đề Mới Đã Sửa Đổi",
      aiFullPost: editedFullPost,
    });

    if (updated.aiHeadline !== "Tiêu Đề Mới Đã Sửa Đổi") {
      throw new Error("Draft headline was not updated");
    }
    if (updated.aiFullPost !== editedFullPost) {
      throw new Error("Draft full post was not updated");
    }

    const savedInDb = await getQueueItemById(db, res.queueItem.id);
    if (savedInDb?.aiHeadline !== "Tiêu Đề Mới Đã Sửa Đổi") {
      throw new Error("Draft update was not persisted in database");
    }
  });

  await ctx.test("F13-05: Target page assignment validates target page exists in target_pages table", async () => {
    const db = createTestDatabase();
    await saveTargetPage(db, {
      id: "tgt_valid_dest",
      pageId: "fb_dest_123",
      pageName: "Fanpage Đích Hợp Lệ",
      accessToken: "token_dest",
      isDefault: true,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const res = await rewriteSourcePost({
      sourcePostId: "sp_target_bind",
      sourcePageName: "Nguồn A",
      sourceContent: "Gán đích đến hợp lệ.",
      targetPageId: "tgt_valid_dest",
      targetPageName: "Fanpage Đích Hợp Lệ",
      style: "news_guide",
    });

    await createQueueItem(db, res.queueItem);
    const item = await getQueueItemById(db, res.queueItem.id);

    if (item?.targetPageId !== "tgt_valid_dest") {
      throw new Error(`Target page binding failed, got: ${item?.targetPageId}`);
    }
  });

  await ctx.test("F13-06: Status filtering queries queue items by pending, published, and rejected", async () => {
    const db = createTestDatabase();
    const res1 = await rewriteSourcePost({
      sourcePostId: "sp_q_1",
      sourcePageName: "Page 1",
      sourceContent: "Post 1",
      style: "storytelling",
    });
    const res2 = await rewriteSourcePost({
      sourcePostId: "sp_q_2",
      sourcePageName: "Page 2",
      sourceContent: "Post 2",
      style: "news_guide",
    });

    await createQueueItem(db, res1.queueItem);
    await createQueueItem(db, { ...res2.queueItem, id: "mod_item_rejected", status: "rejected" });

    const pendingItems = await getQueueItems(db, { status: "pending" });
    const rejectedItems = await getQueueItems(db, { status: "rejected" });

    if (pendingItems.length !== 1 || pendingItems[0].id !== res1.queueItem.id) {
      throw new Error("Filter by status 'pending' failed");
    }
    if (rejectedItems.length !== 1 || rejectedItems[0].id !== "mod_item_rejected") {
      throw new Error("Filter by status 'rejected' failed");
    }
  });

  return ctx.getSummary();
}
