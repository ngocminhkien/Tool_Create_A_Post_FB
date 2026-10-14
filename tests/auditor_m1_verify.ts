/**
 * tests/auditor_m1_verify.ts
 * Independent Forensic Verification Suite for Milestone 1 (R1 Bounded Context & Page Management)
 * Executed directly by Forensic Auditor.
 */

import { parseFacebookUrl, canPublishToPage, verifyPageAccessToken } from "../src/services/pageManager.service";
import {
  getDb,
  runMigrations,
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
  updateSourcePageScanStatus,
  getDbStats,
  getFbConfig
} from "../src/services/db.service";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (!condition) {
    failed++;
    console.error(`❌ FAIL: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  } else {
    passed++;
    console.log(`✅ PASS: ${msg}`);
  }
}

async function runAuditorTests() {
  console.log("============================================================");
  console.log("AUDITOR M1: INDEPENDENT FORENSIC TEST EXECUTION");
  console.log("============================================================");

  // --------------------------------------------------------------------------
  // SECTION 1: parseFacebookUrl Forensic Tests
  // --------------------------------------------------------------------------
  console.log("\n--- SECTION 1: URL Parser & Normalizer ---");
  
  const testCases = [
    { input: "https://www.facebook.com/thongtinchinhphu", valid: true, id: "thongtinchinhphu", type: "slug" },
    { input: "https://m.facebook.com/baoquangninh/", valid: true, id: "baoquangninh", type: "slug" },
    { input: "fb.com/vtv24news", valid: true, id: "vtv24news", type: "slug" },
    { input: "https://www.facebook.com/profile.php?id=100064567891234", valid: true, id: "100064567891234", type: "id" },
    { input: "https://www.facebook.com/p/Dan-Tri-News-100044556677889/", valid: true, id: "100044556677889", type: "id" },
    { input: "https://www.facebook.com/pages/category/Media/vnexpress-10928374928/", valid: true, id: "10928374928", type: "id" },
    { input: "https://www.facebook.com/watch", valid: false },
    { input: "https://www.facebook.com/login.php", valid: false },
    { input: "https://www.facebook.com/settings", valid: false },
    { input: "https://google.com/test", valid: false },
    { input: "", valid: false },
    { input: "   ", valid: false }
  ];

  for (const tc of testCases) {
    const res = parseFacebookUrl(tc.input);
    if (tc.valid) {
      assert(res.isValid === true, `Valid URL recognized: ${tc.input}`);
      assert(res.slugOrId === tc.id, `Correct ID extracted: ${res.slugOrId} === ${tc.id}`);
      assert(res.identifierType === tc.type, `Correct identifier type: ${res.identifierType} === ${tc.type}`);
    } else {
      assert(res.isValid === false, `Invalid URL correctly rejected: "${tc.input}" (error: ${res.error})`);
    }
  }

  // --------------------------------------------------------------------------
  // SECTION 2: verifyPageAccessToken Authentic API Check
  // --------------------------------------------------------------------------
  console.log("\n--- SECTION 2: Graph API Verification ---");
  const emptyRes = await verifyPageAccessToken("", "");
  assert(emptyRes.valid === false && Boolean(emptyRes.error), "Empty Page ID/Token rejected");

  const invalidTokenRes = await verifyPageAccessToken("123456789", "INVALID_TOKEN_TEST_XYZ");
  assert(invalidTokenRes.valid === false && Boolean(invalidTokenRes.error), "Invalid Meta token rejected with authentic Graph API response");
  console.log(`Graph API rejection response message: "${invalidTokenRes.error}"`);

  // --------------------------------------------------------------------------
  // SECTION 3: Isolated SQLite In-Memory DB & Schema Integrity
  // --------------------------------------------------------------------------
  console.log("\n--- SECTION 3: SQLite Migration & Schema Constraints ---");
  const tempDbPath = path.join(process.cwd(), "data", `test_auditor_${Date.now()}.db`);
  const testDb = new DatabaseSync(tempDbPath);
  testDb.exec("PRAGMA journal_mode = WAL;");
  testDb.exec("PRAGMA foreign_keys = ON;");

  // Create base tables
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS topics (id TEXT PRIMARY KEY, title TEXT);
    CREATE TABLE IF NOT EXISTS facebook_config (id TEXT PRIMARY KEY DEFAULT 'active', page_id TEXT, page_name TEXT, access_token TEXT);
    CREATE TABLE IF NOT EXISTS facebook_posts (id TEXT PRIMARY KEY, topic_title TEXT, content TEXT, status TEXT);
    CREATE TABLE IF NOT EXISTS ai_images (id TEXT PRIMARY KEY, prompt TEXT, image_url TEXT);
  `);

  // Run dynamic migrations
  runMigrations(testDb);

  const tables = testDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r: any) => r.name);
  assert(tables.includes("target_pages"), "target_pages table exists");
  assert(tables.includes("source_pages"), "source_pages table exists");
  assert(tables.includes("source_posts"), "source_posts table exists");
  assert(tables.includes("moderation_queue"), "moderation_queue table exists");

  const indexes = testDb.prepare("SELECT name FROM sqlite_master WHERE type='index'").all().map((r: any) => r.name);
  assert(indexes.includes("idx_source_posts_fb_id"), "idx_source_posts_fb_id index exists");
  assert(indexes.includes("idx_source_posts_content_hash"), "idx_source_posts_content_hash index exists");
  assert(indexes.includes("idx_source_posts_published"), "idx_source_posts_published index exists");
  assert(indexes.includes("idx_moderation_queue_status"), "idx_moderation_queue_status index exists");

  // Foreign key cascade test
  testDb.prepare(`
    INSERT INTO source_pages (id, name, url) VALUES ('sp_test_1', 'Source Page 1', 'https://facebook.com/source1');
  `).run();

  testDb.prepare(`
    INSERT INTO source_posts (id, source_page_id, facebook_post_id, content_hash, original_content, published_time)
    VALUES ('post_1', 'sp_test_1', 'fb_post_999', 'hash123', 'Original content', '2026-10-14T00:00:00Z');
  `).run();

  const postBefore = testDb.prepare("SELECT COUNT(*) as c FROM source_posts WHERE source_page_id = 'sp_test_1'").get() as { c: number };
  assert(postBefore.c === 1, "Source post inserted with FK");

  // Delete source page -> verify cascade delete
  testDb.prepare("DELETE FROM source_pages WHERE id = 'sp_test_1'").run();
  const postAfter = testDb.prepare("SELECT COUNT(*) as c FROM source_posts WHERE id = 'post_1'").get() as { c: number };
  assert(postAfter.c === 0, "Source post deleted via ON DELETE CASCADE foreign key");

  // Cleanup temp DB
  testDb.close();
  try { fs.unlinkSync(tempDbPath); } catch {}
  try { fs.unlinkSync(`${tempDbPath}-wal`); } catch {}
  try { fs.unlinkSync(`${tempDbPath}-shm`); } catch {}

  // --------------------------------------------------------------------------
  // SECTION 4: Live DB CRUD & Bounded Context Invariant Testing
  // --------------------------------------------------------------------------
  console.log("\n--- SECTION 4: Bounded Context Domain Invariants ---");

  // Test Target Page
  const targetId = `tgt_auditor_${Date.now()}`;
  const targetPageId = `999888777_${Date.now()}`;
  const targetToken = `EAA_TOKEN_${Date.now()}`;

  assert(canPublishToPage(targetPageId) === false, "canPublishToPage returns false before target page added");

  const savedTarget = saveTargetPage({
    id: targetId,
    pageId: targetPageId,
    pageName: "Forensic Audit Target Page",
    accessToken: targetToken,
    isDefault: false,
    status: "active"
  });

  assert(savedTarget.pageId === targetPageId, "Target page saved successfully");
  assert(canPublishToPage(targetPageId) === true, "canPublishToPage returns true for Target Page ID");
  assert(canPublishToPage(targetId) === true, "canPublishToPage returns true for Target Page internal ID");

  // Test status paused/error
  saveTargetPage({
    id: targetId,
    pageId: targetPageId,
    pageName: "Forensic Audit Target Page",
    accessToken: targetToken,
    isDefault: false,
    status: "token_expired"
  });
  assert(canPublishToPage(targetPageId) === false, "canPublishToPage returns false when Target Page status is token_expired");

  // Re-activate
  saveTargetPage({
    id: targetId,
    pageId: targetPageId,
    pageName: "Forensic Audit Target Page",
    accessToken: targetToken,
    isDefault: false,
    status: "active"
  });
  assert(canPublishToPage(targetPageId) === true, "canPublishToPage returns true when re-activated");

  // Test Source Page: MUST NEVER HAVE PUBLISHING RIGHTS
  const sourceId = `src_auditor_${Date.now()}`;
  const sourceUrl = `https://www.facebook.com/source_auditor_${Date.now()}`;
  const sourcePageId = `111222333_${Date.now()}`;

  const savedSource = saveSourcePage({
    id: sourceId,
    name: "Forensic Audit Source Page",
    url: sourceUrl,
    pageId: sourcePageId,
    inputMode: "url_scrape",
    scanPostLimit: 7,
    status: "active"
  });

  assert(savedSource.url === sourceUrl, "Source page saved successfully");
  assert(canPublishToPage(sourcePageId) === false, "CRITICAL: canPublishToPage returns false for Source Page ID");
  assert(canPublishToPage(sourceId) === false, "CRITICAL: canPublishToPage returns false for Source Page internal ID");
  assert(canPublishToPage(sourceUrl) === false, "CRITICAL: canPublishToPage returns false for Source Page URL");

  // Test telemetry update
  updateSourcePageScanStatus(sourceId, {
    status: "active",
    lastScannedAt: "2026-10-14T04:00:00Z",
    incrementPosts: 5
  });
  const updatedSource = getSourcePageById(sourceId);
  assert(updatedSource?.totalPostsScanned === 5, "Source page telemetry incrementPosts works");
  assert(updatedSource?.lastScannedAt === "2026-10-14T04:00:00Z", "Source page lastScannedAt updated");

  // Test deletion
  const delSource = deleteSourcePage(sourceId);
  assert(delSource === true, "Source page deleted");
  assert(getSourcePageById(sourceId) === null, "Source page no longer exists");

  const delTarget = deleteTargetPage(targetId);
  assert(delTarget === true, "Target page deleted");
  assert(getTargetPageById(targetId) === null, "Target page no longer exists");
  assert(canPublishToPage(targetPageId) === false, "canPublishToPage returns false after target page deleted");

  // --------------------------------------------------------------------------
  // SECTION 5: Default Target Page Synchronization with facebook_config
  // --------------------------------------------------------------------------
  console.log("\n--- SECTION 5: Default Page Synchronization ---");
  const defTargetId = `tgt_default_${Date.now()}`;
  const defPageId = `def_page_${Date.now()}`;
  const defToken = `def_token_${Date.now()}`;

  saveTargetPage({
    id: defTargetId,
    pageId: defPageId,
    pageName: "Default Target Page Test",
    accessToken: defToken,
    isDefault: true,
    status: "active"
  });

  const fbConfig = getFbConfig();
  assert(fbConfig.pageId === defPageId, "facebook_config synchronized with default Target Page ID");
  assert(fbConfig.pageAccessToken === defToken, "facebook_config synchronized with default Target Page token");

  deleteTargetPage(defTargetId);

  // --------------------------------------------------------------------------
  // SECTION 6: getDbStats Metric Verification
  // --------------------------------------------------------------------------
  console.log("\n--- SECTION 6: getDbStats Metric Integrity ---");
  const stats = getDbStats();
  assert(typeof stats.totalTargetPages === "number", "stats.totalTargetPages is number");
  assert(typeof stats.totalSourcePages === "number", "stats.totalSourcePages is number");
  assert(typeof stats.totalSourcePosts === "number", "stats.totalSourcePosts is number");
  assert(typeof stats.totalModerationQueue === "number", "stats.totalModerationQueue is number");
  assert(stats.journalMode.includes("WAL"), "journalMode is WAL");

  console.log("\n============================================================");
  console.log(`TOTAL CHECKS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log("============================================================");
}

runAuditorTests().catch((err) => {
  console.error("Auditor Test Suite Error:", err);
  process.exit(1);
});
