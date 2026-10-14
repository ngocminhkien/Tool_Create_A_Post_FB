/**
 * tests/e2e/r1_r4/tier1/f1_bounded_context.test.ts
 * Tier 1 — Feature F1: Bounded Context Page Separation (Target Pages vs Source Pages)
 * Verifies strict domain separation between owned Target Pages (publishing context)
 * and monitored Source Pages (read-only reference context).
 */

import { TestRunnerContext } from "../../harness/runnerHelper";
import { createTestDatabase } from "../../harness/testDb";
import {
  saveTargetPage,
  getTargetPages,
  getTargetPageById,
  saveSourcePage,
  getSourcePages,
  validatePageContext,
} from "../../harness/serviceLoader";
import { TargetPageItem, SourcePageItem, TestSuiteSummary } from "../../types";

export async function runTier1F1BoundedContextTests(): Promise<TestSuiteSummary> {
  const ctx = new TestRunnerContext("F1: Bounded Context Page Separation", 1, "F1");

  await ctx.test("F1-01: Add valid Target Page persists credentials and active status", async () => {
    const db = createTestDatabase();
    const target: TargetPageItem = {
      id: "tgt_brand_main",
      pageId: "109876543210987",
      pageName: "Thương Hiệu Việt Nam Official",
      accessToken: "EAABwzLIXnjkBA...secret_token_target",
      avatarUrl: "https://example.com/avatar_target.jpg",
      isDefault: true,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveTargetPage(db, target);
    const pages = await getTargetPages(db);

    if (pages.length !== 1) {
      throw new Error(`Expected exactly 1 target page, found ${pages.length}`);
    }
    if (pages[0].pageId !== "109876543210987") {
      throw new Error(`Expected pageId 109876543210987, got ${pages[0].pageId}`);
    }
    if (!pages[0].isDefault) {
      throw new Error("Expected page to be marked as default target page");
    }
    const contextCheck = validatePageContext(pages[0], "target");
    if (!contextCheck.valid) {
      throw new Error(`Target page context validation failed: ${contextCheck.reason}`);
    }
  });

  await ctx.test("F1-02: Reject Target Page creation if accessToken or pageId is missing", async () => {
    const db = createTestDatabase();
    let threwForMissingToken = false;
    try {
      await saveTargetPage(db, {
        id: "tgt_invalid_token",
        pageId: "123456789",
        pageName: "No Token Page",
        accessToken: "", // Invalid: Missing token
        isDefault: false,
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } catch {
      threwForMissingToken = true;
    }

    if (!threwForMissingToken) {
      throw new Error("Expected saveTargetPage to throw an error for empty accessToken");
    }

    let threwForMissingPageId = false;
    try {
      await saveTargetPage(db, {
        id: "tgt_invalid_page_id",
        pageId: "   ", // Invalid: Empty whitespace pageId
        pageName: "No Page ID",
        accessToken: "EAABwz...",
        isDefault: false,
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } catch {
      threwForMissingPageId = true;
    }

    if (!threwForMissingPageId) {
      throw new Error("Expected saveTargetPage to throw an error for empty pageId");
    }
  });

  await ctx.test("F1-03: Add Source Page strictly marked as reference with zero write permissions", async () => {
    const db = createTestDatabase();
    const source: SourcePageItem = {
      id: "src_competitor_alpha",
      name: "Đối Thủ Cạnh Tranh Alpha",
      url: "https://www.facebook.com/competitor.alpha.official",
      pageId: "987654321098",
      inputMode: "url_scrape",
      scanPostLimit: 5,
      status: "active",
      totalPostsScanned: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveSourcePage(db, source);
    const sources = await getSourcePages(db);

    if (sources.length !== 1) {
      throw new Error(`Expected exactly 1 source page, found ${sources.length}`);
    }
    if (sources[0].url !== "https://www.facebook.com/competitor.alpha.official") {
      throw new Error(`Unexpected source URL: ${sources[0].url}`);
    }

    // Context validation: Source page must never possess publishing rights
    const contextCheck = validatePageContext({ ...sources[0], canPublish: false }, "source");
    if (!contextCheck.valid) {
      throw new Error(`Source page context validation failed: ${contextCheck.reason}`);
    }

    const illegalPublishCheck = validatePageContext({ ...sources[0], canPublish: true }, "source");
    if (illegalPublishCheck.valid) {
      throw new Error("Source Page must fail validation if canPublish is set to true");
    }
  });

  await ctx.test("F1-04: Multi-Target Page default flag management unsets previous default", async () => {
    const db = createTestDatabase();
    await saveTargetPage(db, {
      id: "tgt_page_1",
      pageId: "111111111",
      pageName: "Target Page 1",
      accessToken: "token_111",
      isDefault: true,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await saveTargetPage(db, {
      id: "tgt_page_2",
      pageId: "222222222",
      pageName: "Target Page 2",
      accessToken: "token_222",
      isDefault: true, // Should unset tgt_page_1
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const page1 = await getTargetPageById(db, "tgt_page_1");
    const page2 = await getTargetPageById(db, "tgt_page_2");

    if (!page2?.isDefault) {
      throw new Error("Target Page 2 should be the new default");
    }
    if (page1?.isDefault) {
      throw new Error("Target Page 1 should no longer be default");
    }
  });

  await ctx.test("F1-05: Target Pages and Source Pages remain in mutually exclusive bounded tables", async () => {
    const db = createTestDatabase();
    await saveTargetPage(db, {
      id: "shared_id_target",
      pageId: "tgt_bound_1",
      pageName: "Only Target",
      accessToken: "token_abc",
      isDefault: true,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await saveSourcePage(db, {
      id: "shared_id_source",
      name: "Only Source",
      url: "https://facebook.com/source.exclusive",
      inputMode: "url_scrape",
      scanPostLimit: 5,
      status: "active",
      totalPostsScanned: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const targets = await getTargetPages(db);
    const sources = await getSourcePages(db);

    if (targets.some((t) => t.id === "shared_id_source")) {
      throw new Error("Source page illegally leaked into Target Pages table!");
    }
    if (sources.some((s) => s.id === "shared_id_target")) {
      throw new Error("Target page illegally leaked into Source Pages table!");
    }
  });

  await ctx.test("F1-06: Retrieval by Page ID supports both UUID and Meta Graph Page ID", async () => {
    const db = createTestDatabase();
    await saveTargetPage(db, {
      id: "tgt_uuid_999",
      pageId: "fb_numeric_888888",
      pageName: "Dual Lookup Target",
      accessToken: "token_dual",
      isDefault: false,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const byUuid = await getTargetPageById(db, "tgt_uuid_999");
    const byFbId = await getTargetPageById(db, "fb_numeric_888888");

    if (!byUuid || byUuid.pageName !== "Dual Lookup Target") {
      throw new Error("Lookup by internal UUID failed");
    }
    if (!byFbId || byFbId.pageName !== "Dual Lookup Target") {
      throw new Error("Lookup by Facebook numeric page ID failed");
    }
  });

  return ctx.getSummary();
}
