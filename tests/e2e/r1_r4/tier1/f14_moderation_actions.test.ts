/**
 * tests/e2e/r1_r4/tier1/f14_moderation_actions.test.ts
 * Tier 1 — Feature F14: Interactive Moderation Actions (4 Actions & State Machine)
 * Verifies the 4 moderation actions: Publish Now, Schedule, Request AI Revision, and Reject.
 */

import { TestRunnerContext } from "../../harness/runnerHelper";
import { createTestDatabase } from "../../harness/testDb";
import {
  createQueueItem,
  getQueueItemById,
  approveAndPublish,
  approveAndSchedule,
  requestRevision,
  rejectQueueItem,
  rewriteSourcePost,
  getUpcomingPreset,
} from "../../harness/serviceLoader";
import { TestSuiteSummary } from "../../types";

export async function runTier1F14ModerationActionsTests(): Promise<TestSuiteSummary> {
  const ctx = new TestRunnerContext("F14: Interactive Moderation Actions", 1, "F14");

  await ctx.test("F14-01: Action 'Publish Now' transitions from pending -> published and sets fb_post_id", async () => {
    const db = createTestDatabase();
    const res = await rewriteSourcePost({
      sourcePostId: "sp_act_pub",
      sourcePageName: "Page Nguồn",
      sourceContent: "Nội dung sẵn sàng duyệt đăng ngay.",
      style: "direct_sales",
    });

    await createQueueItem(db, res.queueItem);

    const published = await approveAndPublish(db, res.queueItem.id, "tgt_page_100");

    if (published.status !== "published") {
      throw new Error(`Expected status 'published', got '${published.status}'`);
    }
    if (!published.publishedAt) {
      throw new Error("Expected publishedAt timestamp to be set");
    }
    if (!published.fbPostId || !published.fbPostUrl) {
      throw new Error("Expected Facebook post ID and post URL to be recorded");
    }
  });

  await ctx.test("F14-02: Action 'Schedule' transitions from pending -> scheduled with future timestamp", async () => {
    const db = createTestDatabase();
    const res = await rewriteSourcePost({
      sourcePostId: "sp_act_sched",
      sourcePageName: "Page Nguồn",
      sourceContent: "Nội dung duyệt hẹn giờ đăng.",
      style: "storytelling",
    });

    await createQueueItem(db, res.queueItem);

    // Pick tomorrow morning 08:00
    const futureDate = new Date(Date.now() + 24 * 3600000).toISOString();
    const scheduled = await approveAndSchedule(db, res.queueItem.id, futureDate);

    if (scheduled.status !== "scheduled") {
      throw new Error(`Expected status 'scheduled', got '${scheduled.status}'`);
    }
    if (scheduled.scheduledAt !== futureDate) {
      throw new Error(`Expected scheduledAt '${futureDate}', got '${scheduled.scheduledAt}'`);
    }
  });

  await ctx.test("F14-03: Action 'Request Revision' increments rewriteCount and retains pending status", async () => {
    const db = createTestDatabase();
    const res = await rewriteSourcePost({
      sourcePostId: "sp_act_rev",
      sourcePageName: "Page Nguồn",
      sourceContent: "Nội dung cần yêu cầu viết lại ngắn hơn.",
      style: "storytelling",
    });

    await createQueueItem(db, res.queueItem);

    if (res.queueItem.rewriteCount !== 1) {
      throw new Error(`Expected initial rewriteCount 1, got ${res.queueItem.rewriteCount}`);
    }

    const revised = await requestRevision(db, res.queueItem.id, "viết ngắn gọn hơn và tập trung vào USP");

    if (revised.status !== "pending") {
      throw new Error(`Revised post must remain 'pending' for review, got '${revised.status}'`);
    }
    if (revised.rewriteCount !== 2) {
      throw new Error(`Expected rewriteCount 2, got ${revised.rewriteCount}`);
    }
    if (!revised.aiHeadline.includes("Bản sửa đổi 2")) {
      throw new Error(`Revised headline should indicate revision number: ${revised.aiHeadline}`);
    }
  });

  await ctx.test("F14-04: Action 'Reject / Delete' transitions from pending -> rejected", async () => {
    const db = createTestDatabase();
    const res = await rewriteSourcePost({
      sourcePostId: "sp_act_rej",
      sourcePageName: "Page Nguồn",
      sourceContent: "Nội dung không phù hợp bị từ chối.",
      style: "humorous_trend",
    });

    await createQueueItem(db, res.queueItem);

    const rejected = await rejectQueueItem(db, res.queueItem.id);

    if (rejected.status !== "rejected") {
      throw new Error(`Expected status 'rejected', got '${rejected.status}'`);
    }
  });

  await ctx.test("F14-05: State Machine Guard: Cannot publish or schedule an already rejected post", async () => {
    const db = createTestDatabase();
    const res = await rewriteSourcePost({
      sourcePostId: "sp_act_guard",
      sourcePageName: "Page Nguồn",
      sourceContent: "Nội dung vi phạm bị chặn đăng.",
      style: "storytelling",
    });

    await createQueueItem(db, res.queueItem);
    await rejectQueueItem(db, res.queueItem.id);

    let publishThrew = false;
    try {
      await approveAndPublish(db, res.queueItem.id);
    } catch {
      publishThrew = true;
    }

    if (!publishThrew) {
      throw new Error("State machine should prevent publishing an already rejected post");
    }

    let scheduleThrew = false;
    try {
      await approveAndSchedule(db, res.queueItem.id, new Date(Date.now() + 3600000).toISOString());
    } catch {
      scheduleThrew = true;
    }

    if (!scheduleThrew) {
      throw new Error("State machine should prevent scheduling an already rejected post");
    }
  });

  await ctx.test("F14-06: Golden Hours 1-Click preset integrates seamlessly with queue scheduling", async () => {
    const db = createTestDatabase();
    const res = await rewriteSourcePost({
      sourcePostId: "sp_act_gh",
      sourcePageName: "Page Nguồn",
      sourceContent: "Hẹn giờ theo khung giờ vàng tối Prime.",
      style: "news_guide",
    });

    await createQueueItem(db, res.queueItem);

    // Select Golden Hour Evening Prime (19:30 - 21:30)
    const eveningSlot = await getUpcomingPreset("evening");
    const scheduled = await approveAndSchedule(db, res.queueItem.id, eveningSlot.timestamp);

    if (scheduled.status !== "scheduled") {
      throw new Error("Scheduling with Golden Hour slot failed");
    }
    if (scheduled.scheduledAt !== eveningSlot.timestamp) {
      throw new Error(`Expected scheduled timestamp ${eveningSlot.timestamp}, got ${scheduled.scheduledAt}`);
    }
  });

  return ctx.getSummary();
}
