/**
 * tests/e2e/r1_r4/tier1/f3_tabbed_page_manager.test.ts
 * Tier 1 — Feature F3: Tabbed Page Manager Contract & Operations
 * Verifies settings operations, scan limit bounds (1-10), status toggling, and page deletion.
 */

import { TestRunnerContext } from "../../harness/runnerHelper";
import { createTestDatabase } from "../../harness/testDb";
import {
  saveTargetPage,
  getTargetPages,
  getTargetPageById,
  saveSourcePage,
  getSourcePages,
  getSourcePageById,
  deletePage,
  collectPosts,
} from "../../harness/serviceLoader";
import { TargetPageItem, SourcePageItem, TestSuiteSummary } from "../../types";

export async function runTier1F3TabbedPageManagerTests(): Promise<TestSuiteSummary> {
  const ctx = new TestRunnerContext("F3: Tabbed Page Manager Operations", 1, "F3");

  await ctx.test("F3-01: Tabbed querying separates Target Pages and Source Pages strictly", async () => {
    const db = createTestDatabase();
    await saveTargetPage(db, {
      id: "tgt_tab_1",
      pageId: "fb_target_100",
      pageName: "Fanpage Đích Tuyến 1",
      accessToken: "token_t1",
      isDefault: true,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await saveSourcePage(db, {
      id: "src_tab_1",
      name: "Fanpage Nguồn Tham Khảo 1",
      url: "https://facebook.com/source.ref.1",
      inputMode: "url_scrape",
      scanPostLimit: 5,
      status: "active",
      totalPostsScanned: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const targetList = await getTargetPages(db);
    const sourceList = await getSourcePages(db);

    if (targetList.length !== 1 || targetList[0].pageName !== "Fanpage Đích Tuyến 1") {
      throw new Error("Target tab listing failed");
    }
    if (sourceList.length !== 1 || sourceList[0].name !== "Fanpage Nguồn Tham Khảo 1") {
      throw new Error("Source tab listing failed");
    }
  });

  await ctx.test("F3-02: Enforce scanPostLimit clamped between 1 and 10", async () => {
    const db = createTestDatabase();
    // Test lower bound: limit = -5 should be clamped to 1
    await saveSourcePage(db, {
      id: "src_limit_low",
      name: "Lower Bound Page",
      url: "https://facebook.com/low.bound",
      inputMode: "url_scrape",
      scanPostLimit: -5,
      status: "active",
      totalPostsScanned: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Test upper bound: limit = 50 should be clamped to 10
    await saveSourcePage(db, {
      id: "src_limit_high",
      name: "Upper Bound Page",
      url: "https://facebook.com/high.bound",
      inputMode: "url_scrape",
      scanPostLimit: 50,
      status: "active",
      totalPostsScanned: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const lowPage = await getSourcePageById(db, "src_limit_low");
    const highPage = await getSourcePageById(db, "src_limit_high");

    if (lowPage?.scanPostLimit !== 1) {
      throw new Error(`Expected scanPostLimit clamped to 1, got ${lowPage?.scanPostLimit}`);
    }
    if (highPage?.scanPostLimit !== 10) {
      throw new Error(`Expected scanPostLimit clamped to 10, got ${highPage?.scanPostLimit}`);
    }
  });

  await ctx.test("F3-03: Toggle Source Page status between active and paused", async () => {
    const db = createTestDatabase();
    await saveSourcePage(db, {
      id: "src_toggle",
      name: "Toggle Page",
      url: "https://facebook.com/toggle.page",
      inputMode: "url_scrape",
      scanPostLimit: 5,
      status: "active",
      totalPostsScanned: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    let page = await getSourcePageById(db, "src_toggle");
    if (page?.status !== "active") throw new Error("Expected initial status 'active'");

    // Pause the source page
    await saveSourcePage(db, {
      ...page,
      status: "paused",
    });

    page = await getSourcePageById(db, "src_toggle");
    if (page?.status !== "paused") throw new Error("Expected updated status 'paused'");
  });

  await ctx.test("F3-04: Delete Target Page preserves Source Page registry", async () => {
    const db = createTestDatabase();
    await saveTargetPage(db, {
      id: "tgt_to_delete",
      pageId: "fb_del_target",
      pageName: "Page to delete",
      accessToken: "token_del",
      isDefault: false,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await saveSourcePage(db, {
      id: "src_should_remain",
      name: "Remaining Source",
      url: "https://facebook.com/should.remain",
      inputMode: "url_scrape",
      scanPostLimit: 5,
      status: "active",
      totalPostsScanned: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const deleted = await deletePage(db, "target", "tgt_to_delete");
    if (!deleted) throw new Error("deletePage returned false for existing target page");

    const targets = await getTargetPages(db);
    const sources = await getSourcePages(db);

    if (targets.length !== 0) throw new Error("Target page was not deleted");
    if (sources.length !== 1 || sources[0].id !== "src_should_remain") {
      throw new Error("Source page was corrupted or deleted during target page deletion");
    }
  });

  await ctx.test("F3-05: Delete Source Page cascades deletion of associated source_posts", async () => {
    const db = createTestDatabase();
    await saveSourcePage(db, {
      id: "src_cascade_test",
      name: "Cascade Source Page",
      url: "https://facebook.com/cascade.source",
      inputMode: "url_scrape",
      scanPostLimit: 5,
      status: "active",
      totalPostsScanned: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Ingest 2 posts for this source page
    await collectPosts(
      db,
      { sourcePageId: "src_cascade_test", limit: 2 },
      [
        {
          facebookPostId: "fb_cas_1",
          originalContent: "Nội dung bài viết 1",
          publishedTime: new Date().toISOString(),
        },
        {
          facebookPostId: "fb_cas_2",
          originalContent: "Nội dung bài viết 2",
          publishedTime: new Date().toISOString(),
        },
      ]
    );

    const postRowsBefore = db.prepare(`SELECT COUNT(*) as count FROM source_posts WHERE source_page_id = 'src_cascade_test';`).get() as any;
    if (postRowsBefore.count !== 2) {
      throw new Error(`Expected 2 source posts before deletion, got ${postRowsBefore.count}`);
    }

    // Delete source page
    await deletePage(db, "source", "src_cascade_test");

    const postRowsAfter = db.prepare(`SELECT COUNT(*) as count FROM source_posts WHERE source_page_id = 'src_cascade_test';`).get() as any;
    if (postRowsAfter.count !== 0) {
      throw new Error(`Expected 0 source posts after cascading deletion, got ${postRowsAfter.count}`);
    }
  });

  await ctx.test("F3-06: In-place edit of Target Page updates name and avatar without mutating token", async () => {
    const db = createTestDatabase();
    await saveTargetPage(db, {
      id: "tgt_edit_test",
      pageId: "fb_edit_1",
      pageName: "Original Name",
      accessToken: "super_secret_token_never_lost",
      avatarUrl: "https://example.com/old_avatar.jpg",
      isDefault: false,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Update name and avatar
    await saveTargetPage(db, {
      id: "tgt_edit_test",
      pageId: "fb_edit_1",
      pageName: "Renamed Marketing Fanpage",
      accessToken: "super_secret_token_never_lost",
      avatarUrl: "https://example.com/new_avatar.jpg",
      isDefault: false,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const updated = await getTargetPageById(db, "tgt_edit_test");
    if (updated?.pageName !== "Renamed Marketing Fanpage") {
      throw new Error(`Expected pageName to update, got '${updated?.pageName}'`);
    }
    if (updated?.avatarUrl !== "https://example.com/new_avatar.jpg") {
      throw new Error(`Expected avatarUrl to update, got '${updated?.avatarUrl}'`);
    }
    if (updated?.accessToken !== "super_secret_token_never_lost") {
      throw new Error("Access token was corrupted during in-place update");
    }
  });

  return ctx.getSummary();
}
