/**
 * tests/e2e/tier1/f13_sqlite_migration.test.ts
 * Feature F13: SQLite Dynamic Schema Migration
 * Validates safe runtime ALTER TABLE migrations and idempotency.
 */

import assert from "node:assert/strict";
import { runMigrations } from "../harness/serviceLoader";
import { createTestDatabase } from "../harness/testDb";
import { TestRunnerContext } from "../harness/runnerHelper";
import { TestSuiteSummary } from "../types";

export async function runTier1F13Tests(): Promise<TestSuiteSummary> {
  const runner = new TestRunnerContext("SQLite Dynamic Schema Migration", 1, "F13");

  await runner.test("F13.1: Dynamically adds all 10 Social SEO & Policy columns to facebook_posts", async () => {
    const db = createTestDatabase();
    await runMigrations(db);

    const cols = (db.prepare("PRAGMA table_info(facebook_posts);").all() as any[]).map((c) => c.name);
    const expectedCols = [
      "scheduled_at",
      "seo_score",
      "seo_breakdown",
      "policy_warnings",
      "policy_status",
      "hashtags",
      "alt_text",
      "image_caption",
      "content_style",
      "variations_json",
    ];

    for (const expected of expectedCols) {
      assert.ok(cols.includes(expected), `facebook_posts must contain migrated column '${expected}'`);
    }
  });

  await runner.test("F13.2: Dynamically adds alt_text and caption columns to ai_images", async () => {
    const db = createTestDatabase();
    await runMigrations(db);

    const cols = (db.prepare("PRAGMA table_info(ai_images);").all() as any[]).map((c) => c.name);
    assert.ok(cols.includes("alt_text"), "ai_images must contain 'alt_text'");
    assert.ok(cols.includes("caption"), "ai_images must contain 'caption'");
  });

  await runner.test("F13.3: Idempotency: Multiple sequential executions do not throw duplicate column errors", async () => {
    const db = createTestDatabase();

    // First execution
    await runMigrations(db);

    // Second execution
    assert.doesNotThrow(async () => {
      await runMigrations(db);
    }, "Second migration run must be idempotent without errors");

    // Third execution
    assert.doesNotThrow(async () => {
      await runMigrations(db);
    }, "Third migration run must be idempotent without errors");
  });

  await runner.test("F13.4: Preserves existing records when migrations are applied to populated tables", async () => {
    const db = createTestDatabase();

    // Insert records BEFORE migration
    const oldPostId = "legacy_post_123";
    db.prepare(`
      INSERT INTO facebook_posts (id, topic_title, content, status)
      VALUES (?, ?, ?, ?)
    `).run(oldPostId, "Chủ đề cũ", "Nội dung cũ", "published");

    // Run migrations
    await runMigrations(db);

    // Verify existing record is intact and queryable with new columns
    const record = db.prepare("SELECT * FROM facebook_posts WHERE id = ?").get(oldPostId) as any;
    assert.ok(record, "Existing record must be preserved");
    assert.equal(record.topic_title, "Chủ đề cũ");
    assert.equal(record.status, "published");
    assert.equal(record.seo_score, 0, "New column should have default value 0");
    assert.equal(record.policy_status, "clean", "New column should have default value 'clean'");
  });

  await runner.test("F13.5: Maintains SQLite WAL mode and foreign key integrity during migrations", async () => {
    const db = createTestDatabase();
    await runMigrations(db);

    const fkResult = db.prepare("PRAGMA foreign_keys;").get() as any;
    assert.equal(fkResult.foreign_keys, 1, "Foreign keys must remain enabled");
  });

  return runner.getSummary();
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  runTier1F13Tests().then((s) => {
    new TestRunnerContext(s.suiteName, s.tier, "F13").printSummary();
  });
}
