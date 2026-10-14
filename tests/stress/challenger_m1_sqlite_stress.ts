/**
 * tests/stress/challenger_m1_sqlite_stress.ts
 *
 * EMPIRICAL CHALLENGER TEST SUITE — MILESTONE 1 (R1 Bounded Context & Page Management)
 *
 * Verifies:
 * 1. runMigrations() idempotency on both fresh and existing SQLite databases.
 * 2. Index existence (idx_source_posts_fb_id, idx_source_posts_content_hash, idx_source_posts_published, idx_moderation_queue_status) and query plans.
 * 3. Default Target Page election and deletion failover (including next active page selection).
 * 4. Cascade deletion of associated records when a source page is deleted.
 * 5. Two-way synchronization between target_pages and facebook_config (id = 'active').
 */

import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

// Production services
import {
  runMigrations,
  getDb,
  getTargetPages,
  getTargetPageById,
  getTargetPageByPageId,
  getDefaultTargetPage,
  saveTargetPage,
  deleteTargetPage,
  getSourcePages,
  getSourcePageById,
  getSourcePageByUrl,
  saveSourcePage,
  deleteSourcePage,
  getFbConfig,
  saveFbConfig,
  getDbStats,
} from "../../src/services/db.service";

import {
  parseFacebookUrl,
  canPublishToPage,
} from "../../src/services/pageManager.service";

interface TestReport {
  name: string;
  category: string;
  passed: boolean;
  error?: string;
  details?: Record<string, unknown>;
}

const reports: TestReport[] = [];

function runTest(category: string, name: string, fn: () => void | Promise<void>) {
  try {
    const res = fn();
    if (res instanceof Promise) {
      throw new Error(`Sync test wrapper received Promise in ${name}`);
    }
    reports.push({ category, name, passed: true });
    console.log(`  [PASS] [${category}] ${name}`);
  } catch (err: any) {
    reports.push({
      category,
      name,
      passed: false,
      error: err?.message || String(err),
      details: { stack: err?.stack },
    });
    console.error(`  [FAIL] [${category}] ${name}: ${err?.message}`);
  }
}

async function runAsyncTest(category: string, name: string, fn: () => Promise<void>) {
  try {
    await fn();
    reports.push({ category, name, passed: true });
    console.log(`  [PASS] [${category}] ${name}`);
  } catch (err: any) {
    reports.push({
      category,
      name,
      passed: false,
      error: err?.message || String(err),
      details: { stack: err?.stack },
    });
    console.error(`  [FAIL] [${category}] ${name}: ${err?.message}`);
  }
}

// ============================================================================
// HELPER: Baseline DB Table Initializer
// ============================================================================
function initBaselineTables(db: DatabaseSync): void {
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS topics (
      id TEXT PRIMARY KEY,
      row_index INTEGER NOT NULL,
      title TEXT NOT NULL,
      entity TEXT,
      info1 TEXT DEFAULT '',
      info2 TEXT DEFAULT '',
      info3 TEXT DEFAULT '',
      info4 TEXT DEFAULT '',
      prompt1 TEXT DEFAULT '',
      prompt2 TEXT DEFAULT '',
      prompt3 TEXT DEFAULT '',
      prompt4 TEXT DEFAULT '',
      image_url TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sheet_config (
      id TEXT PRIMARY KEY DEFAULT 'active',
      sheet_url TEXT DEFAULT '',
      sheet_name TEXT DEFAULT '',
      last_synced_at TEXT,
      use_sample_data INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS gemini_keys (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      masked_key TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      success_count INTEGER DEFAULT 0,
      error_count INTEGER DEFAULT 0,
      rate_limit_count INTEGER DEFAULT 0,
      last_used_at TEXT,
      cooldown_until TEXT,
      last_error TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS facebook_config (
      id TEXT PRIMARY KEY DEFAULT 'active',
      page_id TEXT DEFAULT '',
      page_name TEXT DEFAULT '',
      access_token TEXT DEFAULT '',
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS facebook_posts (
      id TEXT PRIMARY KEY,
      topic_title TEXT NOT NULL,
      hook TEXT DEFAULT '',
      content TEXT NOT NULL,
      image_url TEXT,
      image_base64 TEXT,
      status TEXT NOT NULL,
      fb_post_id TEXT,
      fb_post_url TEXT,
      error_message TEXT,
      mode_used TEXT,
      published_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ai_images (
      id TEXT PRIMARY KEY,
      topic_title TEXT,
      entity TEXT,
      prompt TEXT NOT NULL,
      style TEXT,
      image_url TEXT NOT NULL,
      image_base64 TEXT,
      provider TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

// ============================================================================
// SUITE 1: runMigrations() IDEMPOTENCY ON FRESH & EXISTING DATABASES
// ============================================================================
console.log("\n=== SUITE 1: runMigrations() IDEMPOTENCY ON FRESH & EXISTING DATABASES ===");

runTest("1. Migrations", "1.1 runMigrations() on completely fresh empty DB (no tables)", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");

  // Running migrations on raw empty DB should not throw unhandled exception
  assert.doesNotThrow(() => {
    runMigrations(db);
  }, "runMigrations must handle absence of baseline tables gracefully");

  const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table';").all() as any[]).map((r) => r.name);
  assert.ok(tables.includes("target_pages"), "target_pages table must be created on fresh DB");
  assert.ok(tables.includes("source_pages"), "source_pages table must be created on fresh DB");
  assert.ok(tables.includes("source_posts"), "source_posts table must be created on fresh DB");
  assert.ok(tables.includes("moderation_queue"), "moderation_queue table must be created on fresh DB");
});

runTest("1. Migrations", "1.2 runMigrations() on baseline DB alters tables and creates bounded context tables", () => {
  const db = new DatabaseSync(":memory:");
  initBaselineTables(db);
  runMigrations(db);

  // Verify facebook_posts new columns
  const postCols = (db.prepare("PRAGMA table_info(facebook_posts);").all() as any[]).map((c) => c.name);
  const expectedPostCols = [
    "scheduled_at", "seo_score", "seo_breakdown", "policy_warnings", "policy_status",
    "hashtags", "alt_text", "image_caption", "content_style", "variations_json"
  ];
  for (const col of expectedPostCols) {
    assert.ok(postCols.includes(col), `facebook_posts must contain migrated column '${col}'`);
  }

  // Verify ai_images new columns
  const imgCols = (db.prepare("PRAGMA table_info(ai_images);").all() as any[]).map((c) => c.name);
  assert.ok(imgCols.includes("alt_text"), "ai_images must contain 'alt_text'");
  assert.ok(imgCols.includes("caption"), "ai_images must contain 'caption'");

  // Verify bounded context tables exist
  const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table';").all() as any[]).map((r) => r.name);
  assert.ok(tables.includes("target_pages"), "target_pages table must exist");
  assert.ok(tables.includes("source_pages"), "source_pages table must exist");
  assert.ok(tables.includes("source_posts"), "source_posts table must exist");
  assert.ok(tables.includes("moderation_queue"), "moderation_queue table must exist");
});

runTest("1. Migrations", "1.3 runMigrations() sequential idempotency (5 consecutive runs)", () => {
  const db = new DatabaseSync(":memory:");
  initBaselineTables(db);

  for (let i = 1; i <= 5; i++) {
    assert.doesNotThrow(() => {
      runMigrations(db);
    }, `Migration run #${i} must succeed without duplicate column or table errors`);
  }

  // Verify column count stability
  const postCols = (db.prepare("PRAGMA table_info(facebook_posts);").all() as any[]).map((c) => c.name);
  const uniqueCols = new Set(postCols);
  assert.equal(postCols.length, uniqueCols.size, "No duplicate columns must exist after multiple runs");
});

runTest("1. Migrations", "1.4 runMigrations() preserves existing data without truncation or loss", () => {
  const db = new DatabaseSync(":memory:");
  initBaselineTables(db);

  // Insert existing data BEFORE migration
  db.prepare(`
    INSERT INTO facebook_posts (id, topic_title, content, status)
    VALUES ('pre_mig_1', 'Chủ đề trước migration', 'Nội dung ban đầu', 'published')
  `).run();

  db.prepare(`
    INSERT INTO ai_images (id, prompt, image_url)
    VALUES ('pre_img_1', 'Bức ảnh cũ', 'https://example.com/old.jpg')
  `).run();

  // Execute migration
  runMigrations(db);

  // Insert data into newly created bounded context tables
  db.prepare(`
    INSERT INTO target_pages (id, page_id, page_name, access_token, is_default, status)
    VALUES ('tp_pre', 'fb_pre_1', 'Target Pre', 'token_pre', 1, 'active')
  `).run();

  // Run migration again over populated tables
  runMigrations(db);

  const post = db.prepare("SELECT * FROM facebook_posts WHERE id = 'pre_mig_1'").get() as any;
  assert.equal(post.topic_title, "Chủ đề trước migration");
  assert.equal(post.seo_score, 0); // default applied
  assert.equal(post.policy_status, "clean"); // default applied

  const target = db.prepare("SELECT * FROM target_pages WHERE id = 'tp_pre'").get() as any;
  assert.equal(target.page_name, "Target Pre");
  assert.equal(target.is_default, 1);
});

// ============================================================================
// SUITE 2: INDEX EXISTENCE & EXPLAIN QUERY PLAN VERIFICATION
// ============================================================================
console.log("\n=== SUITE 2: INDEX EXISTENCE & EXPLAIN QUERY PLAN VERIFICATION ===");

runTest("2. Indexes", "2.1 Required indexes exist in sqlite_master", () => {
  const db = new DatabaseSync(":memory:");
  initBaselineTables(db);
  runMigrations(db);

  const indexes = (db.prepare("SELECT name, tbl_name FROM sqlite_master WHERE type='index';").all() as any[]);
  const indexMap = new Map<string, string>();
  for (const idx of indexes) {
    if (idx.name) indexMap.set(idx.name, idx.tbl_name);
  }

  const expectedIndexes = [
    { name: "idx_source_posts_fb_id", table: "source_posts" },
    { name: "idx_source_posts_content_hash", table: "source_posts" },
    { name: "idx_source_posts_published", table: "source_posts" },
    { name: "idx_moderation_queue_status", table: "moderation_queue" },
  ];

  for (const exp of expectedIndexes) {
    assert.ok(indexMap.has(exp.name), `Index '${exp.name}' must exist in sqlite_master`);
    assert.equal(
      indexMap.get(exp.name),
      exp.table,
      `Index '${exp.name}' must belong to table '${exp.table}'`
    );
  }
});

runTest("2. Indexes", "2.2 Index column mapping verification via PRAGMA index_info", () => {
  const db = new DatabaseSync(":memory:");
  initBaselineTables(db);
  runMigrations(db);

  // idx_source_posts_fb_id -> facebook_post_id
  const fbIdInfo = db.prepare("PRAGMA index_info(idx_source_posts_fb_id);").all() as any[];
  assert.equal(fbIdInfo.length, 1);
  assert.equal(fbIdInfo[0].name, "facebook_post_id");

  // idx_source_posts_content_hash -> content_hash
  const hashInfo = db.prepare("PRAGMA index_info(idx_source_posts_content_hash);").all() as any[];
  assert.equal(hashInfo.length, 1);
  assert.equal(hashInfo[0].name, "content_hash");

  // idx_source_posts_published -> source_page_id, published_time
  const pubInfo = db.prepare("PRAGMA index_info(idx_source_posts_published);").all() as any[];
  assert.equal(pubInfo.length, 2);
  assert.equal(pubInfo[0].name, "source_page_id");
  assert.equal(pubInfo[1].name, "published_time");

  // idx_moderation_queue_status -> status
  const modStatusInfo = db.prepare("PRAGMA index_info(idx_moderation_queue_status);").all() as any[];
  assert.equal(modStatusInfo.length, 1);
  assert.equal(modStatusInfo[0].name, "status");
});

runTest("2. Indexes", "2.3 EXPLAIN QUERY PLAN demonstrates index utilization", () => {
  const db = new DatabaseSync(":memory:");
  initBaselineTables(db);
  runMigrations(db);

  // 1. Check idx_source_posts_fb_id usage
  const planFbId = db.prepare(`
    EXPLAIN QUERY PLAN SELECT * FROM source_posts WHERE facebook_post_id = '123_456'
  `).all() as any[];
  const planFbIdDetail = planFbId.map((r) => r.detail).join(" ");
  assert.ok(
    planFbIdDetail.includes("idx_source_posts_fb_id") || planFbIdDetail.includes("INDEX"),
    `EXPLAIN QUERY PLAN for facebook_post_id must utilize index. Got: ${planFbIdDetail}`
  );

  // 2. Check idx_source_posts_content_hash usage
  const planHash = db.prepare(`
    EXPLAIN QUERY PLAN SELECT * FROM source_posts WHERE content_hash = 'abcdef1234567890'
  `).all() as any[];
  const planHashDetail = planHash.map((r) => r.detail).join(" ");
  assert.ok(
    planHashDetail.includes("idx_source_posts_content_hash") || planHashDetail.includes("INDEX"),
    `EXPLAIN QUERY PLAN for content_hash must utilize index. Got: ${planHashDetail}`
  );

  // 3. Check idx_source_posts_published usage
  const planPub = db.prepare(`
    EXPLAIN QUERY PLAN SELECT * FROM source_posts WHERE source_page_id = 'sp_1' ORDER BY published_time
  `).all() as any[];
  const planPubDetail = planPub.map((r) => r.detail).join(" ");
  assert.ok(
    planPubDetail.includes("idx_source_posts_published") || planPubDetail.includes("INDEX"),
    `EXPLAIN QUERY PLAN for (source_page_id, published_time) must utilize index. Got: ${planPubDetail}`
  );

  // 4. Check idx_moderation_queue_status usage
  const planQueue = db.prepare(`
    EXPLAIN QUERY PLAN SELECT * FROM moderation_queue WHERE status = 'pending'
  `).all() as any[];
  const planQueueDetail = planQueue.map((r) => r.detail).join(" ");
  assert.ok(
    planQueueDetail.includes("idx_moderation_queue_status") || planQueueDetail.includes("INDEX"),
    `EXPLAIN QUERY PLAN for status in moderation_queue must utilize index. Got: ${planQueueDetail}`
  );
});

// ============================================================================
// SUITE 3: DEFAULT TARGET PAGE ELECTION & DELETION FAILOVER
// ============================================================================
console.log("\n=== SUITE 3: DEFAULT TARGET PAGE ELECTION & DELETION FAILOVER ===");

// We test repository functions using the actual database instance.
// To keep data/app.db safe, we back it up before tests and restore it after!
const DATA_DIR = path.join(process.cwd(), "data");
const PROD_DB_PATH = path.join(DATA_DIR, "app.db");
const BACKUP_DB_PATH = path.join(DATA_DIR, "app.db.challenger_backup");

function backupDb() {
  if (fs.existsSync(PROD_DB_PATH)) {
    fs.copyFileSync(PROD_DB_PATH, BACKUP_DB_PATH);
  }
}

function restoreDb() {
  if (fs.existsSync(BACKUP_DB_PATH)) {
    fs.copyFileSync(BACKUP_DB_PATH, PROD_DB_PATH);
    fs.unlinkSync(BACKUP_DB_PATH);
  }
}

// Ensure backup at start
backupDb();

try {
  runTest("3. Target Page Failover", "3.1 First inserted Target Page automatically becomes default", () => {
    const db = getDb();
    // Clean target_pages table for this isolated test
    db.exec("DELETE FROM target_pages;");
    db.prepare("UPDATE facebook_config SET page_id = '', page_name = '', access_token = '' WHERE id = 'active'").run();

    const p1 = saveTargetPage({
      pageId: "tp_page_1",
      pageName: "Fanpage Số 1",
      accessToken: "token_111",
      isDefault: false, // passed false, but table is empty so should be default
    });

    assert.equal(p1.isDefault, true, "First target page must be auto-elected as default");

    const defaultPage = getDefaultTargetPage();
    assert.ok(defaultPage, "getDefaultTargetPage must return a page");
    assert.equal(defaultPage.pageId, "tp_page_1");
  });

  runTest("3. Target Page Failover", "3.2 Saving second Target Page with isDefault: true clears default from previous", () => {
    const p2 = saveTargetPage({
      pageId: "tp_page_2",
      pageName: "Fanpage Số 2",
      accessToken: "token_222",
      isDefault: true,
    });

    assert.equal(p2.isDefault, true);

    const p1Updated = getTargetPageByPageId("tp_page_1");
    assert.equal(p1Updated?.isDefault, false, "Previous default page must have isDefault set to false");

    const currentDefault = getDefaultTargetPage();
    assert.equal(currentDefault?.pageId, "tp_page_2", "New default page must be tp_page_2");
  });

  runTest("3. Target Page Failover", "3.3 Normal deletion failover: Deleting default page elects another page", () => {
    const db = getDb();
    // Currently tp_page_2 is default, tp_page_1 is non-default
    const p2 = getTargetPageByPageId("tp_page_2")!;
    assert.ok(p2, "tp_page_2 must exist");

    const deleted = deleteTargetPage(p2.id);
    assert.equal(deleted, true);

    // Remaining page tp_page_1 should now be elected default
    const newDefault = getDefaultTargetPage();
    assert.ok(newDefault, "A remaining page must be elected default");
    assert.equal(newDefault.pageId, "tp_page_1", "tp_page_1 should be elected default after tp_page_2 deleted");
    assert.equal(newDefault.isDefault, true);

    // And facebook_config must be synchronized to tp_page_1
    const fbCfg = getFbConfig();
    assert.equal(fbCfg.pageId, "tp_page_1", "facebook_config must sync with new default target page");
  });

  runTest("3. Target Page Failover", "3.4 Deleting all target pages clears facebook_config credentials", () => {
    const p1 = getTargetPageByPageId("tp_page_1")!;
    assert.ok(p1);
    const deleted = deleteTargetPage(p1.id);
    assert.equal(deleted, true);

    const allPages = getTargetPages();
    assert.equal(allPages.length, 0, "No target pages should remain");

    const fbCfg = getFbConfig();
    assert.equal(fbCfg.pageId, "", "facebook_config.page_id must be cleared");
    assert.equal(fbCfg.pageAccessToken, "", "facebook_config.access_token must be cleared");
  });

  runTest("3. Target Page Failover", "3.5 ADVERSARIAL CHALLENGE: Deletion failover with active vs non-active (paused/expired) pages", () => {
    const db = getDb();
    db.exec("DELETE FROM target_pages;");

    // Insert 3 pages:
    // Page A: active, default
    // Page B: paused, non-default (inserted before Page C)
    // Page C: active, non-default
    const pA = saveTargetPage({
      pageId: "page_A",
      pageName: "Page A (Active Default)",
      accessToken: "token_A",
      status: "active",
      isDefault: true,
    });

    const pB = saveTargetPage({
      pageId: "page_B",
      pageName: "Page B (Paused)",
      accessToken: "token_B",
      status: "paused",
      isDefault: false,
    });

    const pC = saveTargetPage({
      pageId: "page_C",
      pageName: "Page C (Active Backup)",
      accessToken: "token_C",
      status: "active",
      isDefault: false,
    });

    assert.equal(pA.isDefault, true);
    assert.equal(pB.isDefault, false);
    assert.equal(pC.isDefault, false);

    // Delete default Page A
    deleteTargetPage(pA.id);

    // Query what was elected:
    const remainingPages = getTargetPages();
    const currentDefault = getDefaultTargetPage();

    console.log(`    [Adversarial Probe] Remaining pages after Page A deletion:`, remainingPages.map(p => ({ id: p.pageId, status: p.status, isDefault: p.isDefault })));
    console.log(`    [Adversarial Probe] Elected default page:`, currentDefault ? { id: currentDefault.pageId, status: currentDefault.status } : null);

    // Check if the elected default is an ACTIVE page as requested by "next active page is elected default"
    // If Page B (paused) was elected, document this behavioral discrepancy!
    assert.ok(currentDefault, "A default page must be elected");
    if (currentDefault.status !== "active") {
      throw new Error(
        `Elected default page '${currentDefault.pageId}' has status '${currentDefault.status}', but requirement specifies 'next ACTIVE page is elected default'`
      );
    }
    assert.equal(currentDefault.pageId, "page_C", "Page C (active) should have been elected default over Page B (paused)");
  });

} finally {
  // restoreDb will happen after all suites
}

// ============================================================================
// SUITE 4: CASCADE DELETION OF ASSOCIATED RECORDS
// ============================================================================
console.log("\n=== SUITE 4: CASCADE DELETION OF ASSOCIATED RECORDS ===");

try {
  runTest("4. Cascade Deletion", "4.1 Cascade deletion: Deleting source page cascades to all associated source_posts", () => {
    const db = getDb();
    db.exec("DELETE FROM moderation_queue;");
    db.exec("DELETE FROM source_posts;");
    db.exec("DELETE FROM source_pages;");

    // Create 2 source pages
    const sp1 = saveSourcePage({
      name: "Source Page 1",
      url: "https://www.facebook.com/source1",
    });

    const sp2 = saveSourcePage({
      name: "Source Page 2",
      url: "https://www.facebook.com/source2",
    });

    // Insert 3 posts for sp1 and 2 posts for sp2
    const insertPost = db.prepare(`
      INSERT INTO source_posts (id, source_page_id, facebook_post_id, content_hash, original_content, published_time)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `);

    insertPost.run("post_1a", sp1.id, "fb_post_1a", "hash_1a", "Nội dung bài 1a");
    insertPost.run("post_1b", sp1.id, "fb_post_1b", "hash_1b", "Nội dung bài 1b");
    insertPost.run("post_1c", sp1.id, "fb_post_1c", "hash_1c", "Nội dung bài 1c");

    insertPost.run("post_2a", sp2.id, "fb_post_2a", "hash_2a", "Nội dung bài 2a");
    insertPost.run("post_2b", sp2.id, "fb_post_2b", "hash_2b", "Nội dung bài 2b");

    const countBeforeSp1 = (db.prepare("SELECT COUNT(*) as c FROM source_posts WHERE source_page_id = ?").get(sp1.id) as any).c;
    assert.equal(countBeforeSp1, 3);

    // Delete sp1 via deleteSourcePage
    const deleted = deleteSourcePage(sp1.id);
    assert.equal(deleted, true);

    // Verify sp1 is deleted
    assert.equal(getSourcePageById(sp1.id), null);

    // Verify all posts belonging to sp1 were cascade-deleted
    const countAfterSp1 = (db.prepare("SELECT COUNT(*) as c FROM source_posts WHERE source_page_id = ?").get(sp1.id) as any).c;
    assert.equal(countAfterSp1, 0, "All source_posts referencing deleted source page must be cascade-deleted");

    // Verify sp2 and its posts remain completely untouched
    assert.ok(getSourcePageById(sp2.id));
    const countSp2 = (db.prepare("SELECT COUNT(*) as c FROM source_posts WHERE source_page_id = ?").get(sp2.id) as any).c;
    assert.equal(countSp2, 2, "Posts belonging to other source pages must remain unaffected");
  });

  runTest("4. Cascade Deletion", "4.2 Moderation queue FK constraint: ON DELETE SET NULL behavior on post cascade", () => {
    const db = getDb();

    // Create source page & post
    const sp = saveSourcePage({
      name: "Source Page Moderation Test",
      url: "https://www.facebook.com/sourcemodtest",
    });

    db.prepare(`
      INSERT INTO source_posts (id, source_page_id, facebook_post_id, content_hash, original_content, published_time)
      VALUES ('post_mod_1', ?, 'fb_mod_1', 'hash_mod_1', 'Nội dung mod', datetime('now'))
    `).run(sp.id);

    // Insert queue item pointing to post_mod_1
    db.prepare(`
      INSERT INTO moderation_queue (id, source_post_id, source_page_id, source_page_name, source_content, ai_full_post, status)
      VALUES ('queue_item_1', 'post_mod_1', ?, 'Source Mod', 'Nội dung mod', 'AI viết lại', 'pending')
    `).run(sp.id);

    // Delete source page (which cascade-deletes post_mod_1)
    deleteSourcePage(sp.id);

    // Verify queue_item_1 still exists but source_post_id is SET NULL
    const qItem = db.prepare("SELECT id, source_post_id FROM moderation_queue WHERE id = 'queue_item_1'").get() as any;
    assert.ok(qItem, "Moderation queue item should survive post deletion");
    assert.equal(qItem.source_post_id, null, "source_post_id in moderation_queue should be set to NULL on cascade");
    db.prepare("DELETE FROM moderation_queue WHERE id = 'queue_item_1'").run();
  });

  runTest("4. Cascade Deletion", "4.3 Foreign key enforcement: Inserting post with non-existent source_page_id fails", () => {
    const db = getDb();
    assert.throws(() => {
      db.prepare(`
        INSERT INTO source_posts (id, source_page_id, facebook_post_id, content_hash, original_content, published_time)
        VALUES ('orphan_post', 'non_existent_page_id', 'fb_orphan', 'hash_orphan', 'Nội dung mồ côi', datetime('now'))
      `).run();
    }, /FOREIGN KEY constraint failed/i, "SQLite foreign key constraint must reject orphaned source_posts");
  });

  runTest("4. Cascade Deletion", "4.4 deleteSourcePage returns false on non-existent ID", () => {
    const res = deleteSourcePage("non_existent_source_id_xyz");
    assert.equal(res, false);
  });
} finally {
  // cleanup
}

// ============================================================================
// SUITE 5: TWO-WAY SYNCHRONIZATION (target_pages <-> facebook_config)
// ============================================================================
console.log("\n=== SUITE 5: TWO-WAY SYNCHRONIZATION (target_pages <-> facebook_config) ===");

try {
  runTest("5. Two-Way Sync", "5.1 Direction 1 (Target Page -> Config): Saving default target page updates facebook_config", () => {
    const db = getDb();
    db.exec("DELETE FROM target_pages;");
    db.prepare("UPDATE facebook_config SET page_id = '', page_name = '', access_token = '' WHERE id = 'active'").run();

    saveTargetPage({
      pageId: "sync_page_100",
      pageName: "Fanpage Đồng Bộ 100",
      accessToken: "token_sync_100",
      isDefault: true,
    });

    const cfg = getFbConfig();
    assert.equal(cfg.pageId, "sync_page_100", "facebook_config pageId must match target page");
    assert.equal(cfg.pageName, "Fanpage Đồng Bộ 100", "facebook_config pageName must match target page");
    assert.equal(cfg.pageAccessToken, "token_sync_100", "facebook_config pageAccessToken must match target page");
  });

  runTest("5. Two-Way Sync", "5.2 Direction 2 (Config -> Target Page): Saving facebook_config creates/updates target page", () => {
    saveFbConfig({
      pageId: "sync_page_200",
      pageName: "Fanpage Từ Config 200",
      pageAccessToken: "token_from_config_200",
    });

    const target = getTargetPageByPageId("sync_page_200");
    assert.ok(target, "Target page must be auto-created from saveFbConfig");
    assert.equal(target.pageName, "Fanpage Từ Config 200");
    assert.equal(target.accessToken, "token_from_config_200");
    assert.equal(target.isDefault, true);
  });

  runTest("5. Two-Way Sync", "5.3 ADVERSARIAL CHALLENGE: Dual default check when saveFbConfig is called with pre-existing default", () => {
    const db = getDb();
    // At this point sync_page_200 is default.
    // Let's create an explicit target page sync_page_300 and set it as default
    saveTargetPage({
      pageId: "sync_page_300",
      pageName: "Fanpage 300 Default",
      accessToken: "token_300",
      isDefault: true,
    });

    // Verify 300 is default, 200 is not default
    assert.equal(getTargetPageByPageId("sync_page_300")?.isDefault, true);
    assert.equal(getTargetPageByPageId("sync_page_200")?.isDefault, false);

    // Now call saveFbConfig with a NEW page 400
    saveFbConfig({
      pageId: "sync_page_400",
      pageName: "Fanpage 400 Legacy Call",
      pageAccessToken: "token_400",
    });

    // Check how many pages have is_default = 1 in target_pages:
    const defaultPages = db.prepare("SELECT page_id, is_default FROM target_pages WHERE is_default = 1").all() as any[];
    console.log(`    [Adversarial Probe] Target pages marked is_default = 1:`, defaultPages);

    // If both sync_page_300 and sync_page_400 have is_default = 1, there is a multi-default anomaly!
    if (defaultPages.length > 1) {
      console.warn(`    ⚠️ [DUAL DEFAULT ANOMALY DETECTED]: ${defaultPages.length} target pages have is_default = 1: ${defaultPages.map(p => p.page_id).join(", ")}`);
    }

    assert.equal(
      defaultPages.length,
      1,
      `Exactly 1 page must be default after saveFbConfig, but found ${defaultPages.length} pages with is_default = 1`
    );
  });

  runTest("5. Two-Way Sync", "5.4 Bounded context invariant: canPublishToPage verifies active Target Page only", () => {
    // Registered active target page
    assert.equal(canPublishToPage("sync_page_300"), true, "Registered active target page must be publishable");

    // Unregistered page
    assert.equal(canPublishToPage("random_unregistered_page"), false, "Unregistered page must NOT be publishable");

    // Source page id/url
    const sp = saveSourcePage({ name: "Publish Reject Test", url: "https://facebook.com/publishrejecttest" });
    assert.equal(canPublishToPage(sp.id), false, "Source Page ID must NEVER have publishing rights");
    assert.equal(canPublishToPage(sp.url), false, "Source Page URL must NEVER have publishing rights");
  });

  runTest("5. Two-Way Sync", "5.5 getDbStats reflects target and source page counts", () => {
    const stats = getDbStats();
    assert.ok(typeof stats.totalTargetPages === "number" && stats.totalTargetPages > 0);
    assert.ok(typeof stats.totalSourcePages === "number" && stats.totalSourcePages > 0);
    assert.ok(typeof stats.totalSourcePosts === "number");
    assert.ok(typeof stats.totalModerationQueue === "number");
  });

} finally {
  // Always restore pristine DB state at the end!
  restoreDb();
  console.log("\n[Cleanup] Production app.db restored from backup.");
}

// ============================================================================
// FINAL SUMMARY
// ============================================================================
const total = reports.length;
const passed = reports.filter((r) => r.passed).length;
const failed = reports.filter((r) => !r.passed).length;

console.log("\n=======================================================");
console.log(`CHALLENGER EMPIRICAL TEST SUMMARY:`);
console.log(`Total Scenarios Tested : ${total}`);
console.log(`Passed                 : ${passed} (${((passed / total) * 100).toFixed(1)}%)`);
console.log(`Failed                 : ${failed}`);
console.log("=======================================================");

if (failed > 0) {
  console.log("\nFAILED SCENARIOS:");
  for (const r of reports.filter((r) => !r.passed)) {
    console.log(`❌ [${r.category}] ${r.name}`);
    console.log(`   Error: ${r.error}\n`);
  }
}
