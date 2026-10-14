/**
 * tests/e2e/r1_r4/tier1/f2_dual_input_mode.test.ts
 * Tier 1 — Feature F2: Dual Input Mode Source Pages (URL Scraping vs Graph API)
 * Verifies URL extraction, validation, and Graph API credential support.
 */

import { TestRunnerContext } from "../../harness/runnerHelper";
import { createTestDatabase } from "../../harness/testDb";
import {
  saveSourcePage,
  getSourcePages,
  parseSourceUrl,
} from "../../harness/serviceLoader";
import { SourcePageItem, TestSuiteSummary } from "../../types";

export async function runTier1F2DualInputModeTests(): Promise<TestSuiteSummary> {
  const ctx = new TestRunnerContext("F2: Dual Input Mode Source Pages", 1, "F2");

  await ctx.test("F2-01: Standard desktop Facebook URL parses clean slug and normalizes", async () => {
    const rawUrl = "https://www.facebook.com/vietnamnet.vn/";
    const parsed = parseSourceUrl(rawUrl);

    if (!parsed.isValid) {
      throw new Error(`Expected valid Facebook URL, got error: ${parsed.error}`);
    }
    if (parsed.slug !== "vietnamnet.vn") {
      throw new Error(`Expected slug 'vietnamnet.vn', got '${parsed.slug}'`);
    }
    if (parsed.normalizedUrl !== "https://www.facebook.com/vietnamnet.vn") {
      throw new Error(`Unexpected normalized URL: ${parsed.normalizedUrl}`);
    }
    if (parsed.isNumericId) {
      throw new Error("Handle slug should not be marked as numeric ID");
    }
  });

  await ctx.test("F2-02: Mobile and short Facebook domains (m.facebook.com & fb.com) parse correctly", async () => {
    const mobileUrl = "https://m.facebook.com/cafebiz.vn";
    const shortUrl = "https://fb.com/vnexpress.net";

    const parsedMobile = parseSourceUrl(mobileUrl);
    const parsedShort = parseSourceUrl(shortUrl);

    if (!parsedMobile.isValid || parsedMobile.slug !== "cafebiz.vn") {
      throw new Error(`Failed to parse mobile URL: ${mobileUrl}`);
    }
    if (!parsedShort.isValid || parsedShort.slug !== "vnexpress.net") {
      throw new Error(`Failed to parse short URL: ${shortUrl}`);
    }
  });

  await ctx.test("F2-03: Numeric profile URL (profile.php?id=...) parses numeric ID", async () => {
    const profileUrl = "https://www.facebook.com/profile.php?id=100064821948321";
    const parsed = parseSourceUrl(profileUrl);

    if (!parsed.isValid) {
      throw new Error(`Expected valid numeric profile URL, got error: ${parsed.error}`);
    }
    if (!parsed.isNumericId) {
      throw new Error("Expected isNumericId to be true");
    }
    if (parsed.slug !== "100064821948321") {
      throw new Error(`Expected numeric ID slug, got '${parsed.slug}'`);
    }
    if (parsed.normalizedUrl !== "https://www.facebook.com/profile.php?id=100064821948321") {
      throw new Error(`Unexpected normalized URL: ${parsed.normalizedUrl}`);
    }
  });

  await ctx.test("F2-04: Non-Facebook domains and malformed links are rejected", async () => {
    const invalidUrls = [
      "https://youtube.com/c/example",
      "https://tiktok.com/@vietnamtravel",
      "https://instagram.com/p/B9x123",
      "https://google.com",
      "not_a_valid_url_at_all",
      "",
    ];

    for (const url of invalidUrls) {
      const parsed = parseSourceUrl(url);
      if (parsed.isValid) {
        throw new Error(`URL '${url}' should have been rejected as invalid Facebook URL`);
      }
    }
  });

  await ctx.test("F2-05: Graph API mode persists Page ID and Access Token for verified ingestion", async () => {
    const db = createTestDatabase();
    const sourceGraph: SourcePageItem = {
      id: "src_graph_partner_1",
      name: "Partner Page via Graph API",
      url: "https://facebook.com/partner.page.1",
      pageId: "445566778899",
      inputMode: "graph_api",
      accessToken: "EAABwzLIXnjkBA...partner_read_token",
      scanPostLimit: 8,
      status: "active",
      totalPostsScanned: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveSourcePage(db, sourceGraph);
    const pages = await getSourcePages(db);
    const saved = pages.find((p) => p.id === "src_graph_partner_1");

    if (!saved) {
      throw new Error("Graph API source page was not saved");
    }
    if (saved.inputMode !== "graph_api") {
      throw new Error(`Expected inputMode 'graph_api', got '${saved.inputMode}'`);
    }
    if (saved.pageId !== "445566778899") {
      throw new Error(`Expected pageId '445566778899', got '${saved.pageId}'`);
    }
    if (!saved.accessToken) {
      throw new Error("Expected accessToken to be preserved for Graph API source mode");
    }
  });

  await ctx.test("F2-06: Dual mode persistence supports mixed URL scrape and Graph API sources concurrently", async () => {
    const db = createTestDatabase();
    await saveSourcePage(db, {
      id: "src_scrape_mode",
      name: "Public Scraped Media Page",
      url: "https://facebook.com/public.scraped",
      inputMode: "url_scrape",
      scanPostLimit: 5,
      status: "active",
      totalPostsScanned: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await saveSourcePage(db, {
      id: "src_api_mode",
      name: "API Monitored Media Page",
      url: "https://facebook.com/api.monitored",
      inputMode: "graph_api",
      accessToken: "token_api",
      pageId: "998877",
      scanPostLimit: 10,
      status: "active",
      totalPostsScanned: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const sources = await getSourcePages(db);
    const urlModes = sources.filter((s) => s.inputMode === "url_scrape");
    const apiModes = sources.filter((s) => s.inputMode === "graph_api");

    if (urlModes.length !== 1 || apiModes.length !== 1) {
      throw new Error(`Expected 1 URL scrape and 1 Graph API source, got ${urlModes.length} and ${apiModes.length}`);
    }
  });

  return ctx.getSummary();
}
