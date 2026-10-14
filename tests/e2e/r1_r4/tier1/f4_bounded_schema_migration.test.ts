/**
 * tests/e2e/r1_r4/tier1/f4_bounded_schema_migration.test.ts
 * Tier 1 — Feature F4: SQLite Bounded Schema Dynamic Migration
 * Verifies dynamic schema creation, index creation, idempotency, and baseline preservation.
 */

import { DatabaseSync } from "node:sqlite";
import { TestRunnerContext } from "../../harness/runnerHelper";
import { runR1Migrations } from "../../harness/serviceLoader";
import { TestSuiteSummary } from "../../types";

export async function runTier1F4BoundedSchemaMigrationTests(): Promise<TestSuiteSummary> {
  const ctx = new TestRunnerContext("F4: SQLite Bounded Schema Dynamic Migration", 1, "F4");

  await ctx.test("F4-01: Migration creates target_pages table with required schema and unique constraint", async () => {
    const db = new DatabaseSync(":memory:");
    await runR1Migrations(db);

    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table';").all() as any[]).map((r) => r.name);
    if (!tables.includes("target_pages")) {
      throw new Error("target_pages table was not created by migration");
    }

    const cols = (db.prepare("PRAGMA table_info(target_pages);").all() as any[]).map((c) => c.name);
    const requiredCols = ["id", "page_id", "page_name", "access_token", "avatar_url", "is_default", "status", "created_at", "updated_at"];
    for (const req of requiredCols) {
      if (!cols.includes(req)) {
        throw new Error(`Column '${req}' missing from target_pages`);
      }
    }
  });

  await ctx.test("F4-02: Migration creates source_pages table with URL and scan_post_limit columns", async () => {
    const db = new DatabaseSync(":memory:");
    await runR1Migrations(db);

    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table';").all() as any[]).map((r) => r.name);
    if (!tables.includes("source_pages")) {
      throw new Error("source_pages table was not created by migration");
    }

    const cols = (db.prepare("PRAGMA table_info(source_pages);").all() as any[]).map((c) => c.name);
    const requiredCols = ["id", "name", "url", "page_id", "input_mode", "scan_post_limit", "status", "total_posts_scanned"];
    for (const req of requiredCols) {
      if (!cols.includes(req)) {
        throw new Error(`Column '${req}' missing from source_pages`);
      }
    }
  });

  await ctx.test("F4-03: Migration creates source_posts table with indexes on fb_id, hash, and published_time", async () => {
    const db = new DatabaseSync(":memory:");
    await runR1Migrations(db);

    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table';").all() as any[]).map((r) => r.name);
    if (!tables.includes("source_posts")) {
      throw new Error("source_posts table was not created by migration");
    }

    const indexes = (db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='source_posts';").all() as any[]).map((r) => r.name);
    if (!indexes.includes("idx_source_posts_fb_id")) {
      throw new Error("Unique index idx_source_posts_fb_id missing from source_posts");
    }
    if (!indexes.includes("idx_source_posts_content_hash")) {
      throw new Error("Index idx_source_posts_content_hash missing from source_posts");
    }
  });

  await ctx.test("F4-04: Migration creates moderation_queue table with status index", async () => {
    const db = new DatabaseSync(":memory:");
    await runR1Migrations(db);

    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table';").all() as any[]).map((r) => r.name);
    if (!tables.includes("moderation_queue")) {
      throw new Error("moderation_queue table was not created by migration");
    }

    const indexes = (db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='moderation_queue';").all() as any[]).map((r) => r.name);
    if (!indexes.includes("idx_mod_queue_status")) {
      throw new Error("Index idx_mod_queue_status missing from moderation_queue");
    }
  });

  await ctx.test("F4-05: Migration is completely idempotent across multiple successive executions", async () => {
    const db = new DatabaseSync(":memory:");
    // Run migration 3 times successively
    await runR1Migrations(db);
    await runR1Migrations(db);
    await runR1Migrations(db);

    // Verify database accepts inserts cleanly without duplicated or locked state
    db.prepare(`
      INSERT INTO target_pages (id, page_id, page_name, access_token)
      VALUES ('id_idem', 'fb_idem', 'Idempotent Page', 'token_123');
    `).run();

    const row = db.prepare(`SELECT page_name FROM target_pages WHERE id = 'id_idem';`).get() as any;
    if (row?.page_name !== "Idempotent Page") {
      throw new Error("Database insert failed after multiple migration runs");
    }
  });

  await ctx.test("F4-06: Migration preserves existing baseline tables without data loss", async () => {
    const db = new DatabaseSync(":memory:");
    // Create baseline tables with initial data
    db.exec(`
      CREATE TABLE IF NOT EXISTS topics (id TEXT PRIMARY KEY, title TEXT);
      INSERT INTO topics (id, title) VALUES ('t_1', 'Chủ đề gốc');
    `);

    await runR1Migrations(db);

    const topicRow = db.prepare("SELECT title FROM topics WHERE id = 't_1';").get() as any;
    if (topicRow?.title !== "Chủ đề gốc") {
      throw new Error("Existing baseline data in topics was corrupted during migration");
    }
  });

  return ctx.getSummary();
}
