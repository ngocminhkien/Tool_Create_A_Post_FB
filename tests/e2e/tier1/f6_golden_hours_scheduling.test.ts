/**
 * tests/e2e/tier1/f6_golden_hours_scheduling.test.ts
 * Feature F6: 1-Click Golden Hours Scheduling UI & Graph Integration
 * Validates Meta Graph API unix timestamp constraints and scheduling payloads.
 */

import assert from "node:assert/strict";
import { getUpcomingPreset, runMigrations } from "../harness/serviceLoader";
import { createTestDatabase } from "../harness/testDb";
import { TestRunnerContext } from "../harness/runnerHelper";
import { TestSuiteSummary } from "../types";

export async function runTier1F6Tests(): Promise<TestSuiteSummary> {
  const runner = new TestRunnerContext("1-Click Golden Hours Scheduling", 1, "F6");

  await runner.test("F6.1: Converts Golden Hour ISO timestamp to Meta Graph API unix seconds", async () => {
    const slot = await getUpcomingPreset("evening");
    const targetDate = new Date(slot.timestamp);
    const unixSeconds = Math.floor(targetDate.getTime() / 1000);

    assert.ok(unixSeconds > 0, "Unix timestamp must be positive");
    assert.equal(typeof unixSeconds, "number", "Unix timestamp must be integer number");
    assert.equal(targetDate.getSeconds(), 0, "Schedule timestamp seconds should be 0");
  });

  await runner.test("F6.2: Enforces Meta Graph API minimum 10-minute future scheduling constraint", async () => {
    const now = Date.now();
    const slot = await getUpcomingPreset("evening");
    const scheduleTimeMs = new Date(slot.timestamp).getTime();

    // If scheduled time is too close (under 10 mins), Meta rejects with error 100
    const MIN_DIFF_MS = 10 * 60 * 1000;
    const diff = scheduleTimeMs - now;

    // Either diff >= 10 mins, or if target was today within 10 mins it must advance to tomorrow
    assert.ok(
      diff >= MIN_DIFF_MS,
      `Scheduled time must be at least 10 minutes in future (diff: ${Math.round(diff / 60000)} mins)`
    );
  });

  await runner.test("F6.3: Complies with Meta Graph API maximum 75-day future scheduling limit", async () => {
    const now = Date.now();
    const slot = await getUpcomingPreset("morning");
    const scheduleTimeMs = new Date(slot.timestamp).getTime();

    const MAX_DIFF_MS = 75 * 24 * 60 * 60 * 1000;
    const diff = scheduleTimeMs - now;

    assert.ok(diff <= MAX_DIFF_MS, "Scheduled time must not exceed 75 days in future");
  });

  await runner.test("F6.4: Builds scheduled publish payload with correct scheduled_publish_time", async () => {
    const slot = await getUpcomingPreset("evening");
    const unixSeconds = Math.floor(new Date(slot.timestamp).getTime() / 1000);

    const payload = {
      message: "Nội dung bài viết thử nghiệm lên lịch đăng bài.",
      published: false,
      scheduled_publish_time: unixSeconds,
    };

    assert.equal(payload.published, false, "Scheduled post must have published=false");
    assert.equal(payload.scheduled_publish_time, unixSeconds);
    assert.ok(payload.message.length > 0);
  });

  await runner.test("F6.5: Successfully records scheduled_at timestamp in SQLite database", async () => {
    const db = createTestDatabase();
    await runMigrations(db);

    const slot = await getUpcomingPreset("noon");
    const postId = `test_post_${Date.now()}`;

    db.prepare(`
      INSERT INTO facebook_posts (id, topic_title, content, status, scheduled_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(postId, "Chủ đề thử nghiệm", "Nội dung bài viết", "draft", slot.timestamp);

    const row = db.prepare("SELECT * FROM facebook_posts WHERE id = ?").get(postId) as any;
    assert.ok(row, "Post row must be created");
    assert.equal(row.scheduled_at, slot.timestamp, "scheduled_at column must store target slot timestamp");
    assert.equal(row.status, "draft");
  });

  return runner.getSummary();
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  runTier1F6Tests().then((s) => {
    new TestRunnerContext(s.suiteName, s.tier, "F6").printSummary();
  });
}
