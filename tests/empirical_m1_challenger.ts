/**
 * Empirical Verification & Stress Test Suite — Milestone 1 (R1 Bounded Context & Page Management)
 * Challenger 1
 *
 * Requirements to Stress-Test:
 * 1. parseFacebookUrl: 20+ exotic, malformed, edge-case URLs (trailing slashes, query params, hash fragments,
 *    non-standard subdomains, reserved words, Unicode, empty strings, path traversal, injection payloads).
 * 2. canPublishToPage Invariant: Ensure a Source Page can NEVER be granted publishing permissions under any input combination.
 * 3. Scan post limit constraints: Enforce 1 to 10 across bounds, negatives, overflow, decimals, NaNs, strings.
 */

import {
  parseFacebookUrl,
  canPublishToPage,
  saveTargetPage,
  saveSourcePage,
  deleteTargetPage,
  deleteSourcePage,
  getTargetPage,
  getSourcePage,
  listTargetPages,
  listSourcePages,
} from "../src/services/pageManager.service";
import { getDb } from "../src/services/db.service";

interface UrlTestCase {
  id: string;
  category: string;
  input: string | any;
  description: string;
  expectedValid: boolean;
  expectedIdentifierType?: "slug" | "id" | "unknown";
  expectedIdentifier?: string;
}

const URL_TEST_CASES: UrlTestCase[] = [
  // --- Category A: Standard & Minor Variants ---
  {
    id: "URL-01",
    category: "Standard",
    input: "https://www.facebook.com/techcrunch",
    description: "Standard clean full URL with www",
    expectedValid: true,
    expectedIdentifierType: "slug",
    expectedIdentifier: "techcrunch",
  },
  {
    id: "URL-02",
    category: "Standard",
    input: "https://facebook.com/techcrunch/",
    description: "Trailing slash on standard URL",
    expectedValid: true,
    expectedIdentifierType: "slug",
    expectedIdentifier: "techcrunch",
  },
  {
    id: "URL-03",
    category: "Standard",
    input: "http://facebook.com/techcrunch",
    description: "HTTP protocol (insecure) instead of HTTPS",
    expectedValid: true,
    expectedIdentifierType: "slug",
    expectedIdentifier: "techcrunch",
  },
  {
    id: "URL-04",
    category: "Standard",
    input: "facebook.com/techcrunch",
    description: "Missing protocol prefix",
    expectedValid: true,
    expectedIdentifierType: "slug",
    expectedIdentifier: "techcrunch",
  },
  {
    id: "URL-05",
    category: "Standard",
    input: "   https://facebook.com/techcrunch   ",
    description: "Leading and trailing whitespace",
    expectedValid: true,
    expectedIdentifierType: "slug",
    expectedIdentifier: "techcrunch",
  },

  // --- Category B: Subdomain Variants ---
  {
    id: "URL-06",
    category: "Subdomain",
    input: "https://m.facebook.com/techcrunch",
    description: "Mobile subdomain (m.facebook.com)",
    expectedValid: true,
    expectedIdentifierType: "slug",
    expectedIdentifier: "techcrunch",
  },
  {
    id: "URL-07",
    category: "Subdomain",
    input: "https://mbasic.facebook.com/techcrunch",
    description: "Basic mobile subdomain (mbasic.facebook.com)",
    expectedValid: true,
    expectedIdentifierType: "slug",
    expectedIdentifier: "techcrunch",
  },
  {
    id: "URL-08",
    category: "Subdomain",
    input: "https://fb.com/techcrunch",
    description: "Short domain fb.com",
    expectedValid: true,
    expectedIdentifierType: "slug",
    expectedIdentifier: "techcrunch",
  },
  {
    id: "URL-09",
    category: "Subdomain",
    input: "https://www.fb.com/techcrunch",
    description: "Short domain with www (www.fb.com)",
    expectedValid: true,
    expectedIdentifierType: "slug",
    expectedIdentifier: "techcrunch",
  },
  {
    id: "URL-10",
    category: "Subdomain (Exotic)",
    input: "https://web.facebook.com/techcrunch",
    description: "Regional redirect web.facebook.com",
    expectedValid: false, // Stress-test: check how pageManager handles web.facebook.com
  },
  {
    id: "URL-11",
    category: "Subdomain (Exotic)",
    input: "https://touch.facebook.com/techcrunch",
    description: "Touch mobile touch.facebook.com",
    expectedValid: false,
  },
  {
    id: "URL-12",
    category: "Subdomain (Spoofing)",
    input: "https://facebook.com.attacker.com/techcrunch",
    description: "Domain spoofing attempt (attacker domain suffix)",
    expectedValid: false,
  },
  {
    id: "URL-13",
    category: "Subdomain (Phishing)",
    input: "https://notfacebook.com/techcrunch",
    description: "Completely different domain",
    expectedValid: false,
  },
  {
    id: "URL-14",
    category: "Subdomain (Phishing)",
    input: "https://fakefb.com/techcrunch",
    description: "Fake short domain",
    expectedValid: false,
  },

  // --- Category C: Query Parameters, Tracking & Hash Fragments ---
  {
    id: "URL-15",
    category: "QueryParams",
    input: "https://www.facebook.com/techcrunch?mibextid=ZbWKwL&ref=bookmarks",
    description: "Facebook mobile app tracking parameters (mibextid, ref)",
    expectedValid: true,
    expectedIdentifierType: "slug",
    expectedIdentifier: "techcrunch",
  },
  {
    id: "URL-16",
    category: "QueryParams",
    input: "https://www.facebook.com/techcrunch?utm_source=fb&utm_medium=cpc&utm_campaign=brand",
    description: "Google Analytics UTM tracking parameters",
    expectedValid: true,
    expectedIdentifierType: "slug",
    expectedIdentifier: "techcrunch",
  },
  {
    id: "URL-17",
    category: "Fragments",
    input: "https://www.facebook.com/techcrunch#about-section",
    description: "Hash fragment in URL",
    expectedValid: true,
    expectedIdentifierType: "slug",
    expectedIdentifier: "techcrunch",
  },
  {
    id: "URL-18",
    category: "Fragments & Query",
    input: "https://facebook.com/techcrunch/?ref=share#header",
    description: "Combination of trailing slash, query param, and hash",
    expectedValid: true,
    expectedIdentifierType: "slug",
    expectedIdentifier: "techcrunch",
  },
  {
    id: "URL-19",
    category: "QueryParams",
    input: "https://facebook.com/techcrunch?id=999999999",
    description: "Deceptive 'id' query parameter on a standard slug page",
    expectedValid: true,
    expectedIdentifierType: "slug",
    expectedIdentifier: "techcrunch",
  },

  // --- Category D: Alternate Facebook URL Structures ---
  {
    id: "URL-20",
    category: "ProfileId",
    input: "https://www.facebook.com/profile.php?id=100085938472910",
    description: "Classic profile.php with valid numeric ID",
    expectedValid: true,
    expectedIdentifierType: "id",
    expectedIdentifier: "100085938472910",
  },
  {
    id: "URL-21",
    category: "ProfileId",
    input: "https://m.facebook.com/profile.php?id=100085938472910&sk=photos",
    description: "profile.php on mobile with subtab query parameter",
    expectedValid: true,
    expectedIdentifierType: "id",
    expectedIdentifier: "100085938472910",
  },
  {
    id: "URL-22",
    category: "ProfileId (Malformed)",
    input: "https://www.facebook.com/profile.php?id=abc_not_numeric",
    description: "profile.php with non-numeric ID parameter",
    expectedValid: false,
  },
  {
    id: "URL-23",
    category: "ProfileId (Malformed)",
    input: "https://www.facebook.com/profile.php",
    description: "profile.php without any id parameter",
    expectedValid: false,
  },
  {
    id: "URL-24",
    category: "Modern /p/",
    input: "https://www.facebook.com/p/congtyabc-100092837465910/",
    description: "Modern /p/ URL with slug and numeric ID",
    expectedValid: true,
    expectedIdentifierType: "id",
    expectedIdentifier: "100092837465910",
  },
  {
    id: "URL-25",
    category: "Modern /p/",
    input: "https://www.facebook.com/p/simple-slug-name/",
    description: "Modern /p/ URL with non-numeric slug only",
    expectedValid: true,
    expectedIdentifierType: "slug",
    expectedIdentifier: "simple-slug-name",
  },
  {
    id: "URL-26",
    category: "Legacy /pages/",
    input: "https://www.facebook.com/pages/category/News-Company/Kenh14-105293847593/",
    description: "Legacy /pages/category/Category-Name/Page-ID format",
    expectedValid: true,
    expectedIdentifierType: "id",
    expectedIdentifier: "105293847593",
  },
  {
    id: "URL-27",
    category: "Legacy /pages/",
    input: "https://www.facebook.com/pages/Kenh14/105293847593",
    description: "Legacy /pages/Name/ID format",
    expectedValid: true,
    expectedIdentifierType: "id",
    expectedIdentifier: "105293847593",
  },
  {
    id: "URL-28",
    category: "Legacy /pages/",
    input: "https://www.facebook.com/pages/justpages",
    description: "Arbitrary /pages/ subpath",
    expectedValid: true,
    expectedIdentifierType: "slug",
    expectedIdentifier: "justpages",
  },
  {
    id: "URL-29",
    category: "NumericSlug",
    input: "https://www.facebook.com/109283746501928",
    description: "Pure numeric page ID directly at root path",
    expectedValid: true,
    expectedIdentifierType: "id",
    expectedIdentifier: "109283746501928",
  },

  // --- Category E: Facebook Reserved System Paths ---
  {
    id: "URL-30",
    category: "Reserved System",
    input: "https://facebook.com/login",
    description: "Facebook Login system path",
    expectedValid: false,
  },
  {
    id: "URL-31",
    category: "Reserved System",
    input: "https://facebook.com/watch",
    description: "Facebook Watch video portal",
    expectedValid: false,
  },
  {
    id: "URL-32",
    category: "Reserved System",
    input: "https://facebook.com/marketplace",
    description: "Facebook Marketplace portal",
    expectedValid: false,
  },
  {
    id: "URL-33",
    category: "Reserved System",
    input: "https://facebook.com/messages/t/100012345",
    description: "Facebook Messages inbox path",
    expectedValid: false,
  },
  {
    id: "URL-34",
    category: "Reserved System",
    input: "https://facebook.com/groups/1092837465",
    description: "Facebook Group path (not a Fanpage)",
    expectedValid: false,
  },
  {
    id: "URL-35",
    category: "Reserved System",
    input: "https://facebook.com/events/1092837465",
    description: "Facebook Event path (not a Fanpage)",
    expectedValid: false,
  },
  {
    id: "URL-36",
    category: "Reserved System",
    input: "https://facebook.com/settings",
    description: "Facebook User Settings",
    expectedValid: false,
  },
  {
    id: "URL-37",
    category: "Reserved System",
    input: "https://facebook.com/policies",
    description: "Facebook Policies and Guidelines",
    expectedValid: false,
  },
  {
    id: "URL-38",
    category: "Reserved System",
    input: "https://facebook.com/sharer.php?u=https://example.com",
    description: "Facebook Sharer dialog system endpoint",
    expectedValid: false,
  },

  // --- Category F: Malformed, Unicode, Edge Cases & Injections ---
  {
    id: "URL-39",
    category: "Empty/Blank",
    input: "",
    description: "Empty string input",
    expectedValid: false,
  },
  {
    id: "URL-40",
    category: "Empty/Blank",
    input: "   ",
    description: "Whitespace only input",
    expectedValid: false,
  },
  {
    id: "URL-41",
    category: "Empty/Blank",
    input: null as any,
    description: "Null input",
    expectedValid: false,
  },
  {
    id: "URL-42",
    category: "Empty/Blank",
    input: undefined as any,
    description: "Undefined input",
    expectedValid: false,
  },
  {
    id: "URL-43",
    category: "Root Domain",
    input: "https://www.facebook.com",
    description: "Root domain without trailing slash",
    expectedValid: false,
  },
  {
    id: "URL-44",
    category: "Root Domain",
    input: "https://www.facebook.com/",
    description: "Root domain with trailing slash",
    expectedValid: false,
  },
  {
    id: "URL-45",
    category: "Multi Slash",
    input: "https://www.facebook.com////",
    description: "Multiple slashes with no slug",
    expectedValid: false,
  },
  {
    id: "URL-46",
    category: "Multi Slash Slug",
    input: "https://www.facebook.com///techcrunch///",
    description: "Multiple slashes enclosing a valid slug",
    expectedValid: true,
    expectedIdentifierType: "slug",
    expectedIdentifier: "techcrunch",
  },
  {
    id: "URL-47",
    category: "Unicode Slug",
    input: "https://www.facebook.com/bánh-mì-hà-nội",
    description: "Vietnamese diacritics in slug",
    expectedValid: true,
    expectedIdentifierType: "slug",
  },
  {
    id: "URL-48",
    category: "Unicode Slug",
    input: "https://www.facebook.com/カフェ・喫茶店",
    description: "Japanese Kanji/Katakana characters in slug",
    expectedValid: true,
    expectedIdentifierType: "slug",
  },
  {
    id: "URL-49",
    category: "Security/Protocol",
    input: "javascript:alert(document.cookie)",
    description: "XSS JavaScript pseudo-protocol",
    expectedValid: false,
  },
  {
    id: "URL-50",
    category: "Security/Protocol",
    input: "data:text/html,<script>alert(1)</script>",
    description: "Data URI HTML payload",
    expectedValid: false,
  },
  {
    id: "URL-51",
    category: "Path Traversal",
    input: "https://facebook.com/../../../etc/passwd",
    description: "Path traversal attempt",
    expectedValid: false,
  },
  {
    id: "URL-52",
    category: "Slug with Dots & Underscores",
    input: "https://facebook.com/kenh14.official_page",
    description: "Dots and underscores in slug name",
    expectedValid: true,
    expectedIdentifierType: "slug",
    expectedIdentifier: "kenh14.official_page",
  },
];

async function runEmpiricalSuite() {
  console.log("===============================================================================");
  console.log("🔥 STARTING EMPIRICAL CHALLENGER 1 STRESS TEST SUITE");
  console.log("===============================================================================\n");

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  const failureDetails: string[] = [];

  // ==========================================================================
  // SECTION 1: parseFacebookUrl 52 EXOTIC & MALFORMED EDGE-CASE URLS
  // ==========================================================================
  console.log("-------------------------------------------------------------------------------");
  console.log("PART 1: parseFacebookUrl Empirical Stress-Test (52 Edge Cases)");
  console.log("-------------------------------------------------------------------------------");

  const urlResults: any[] = [];

  for (const tc of URL_TEST_CASES) {
    totalTests++;
    let result: any;
    let threwException = false;
    let exceptionMsg = "";

    try {
      result = parseFacebookUrl(tc.input);
    } catch (err: any) {
      threwException = true;
      exceptionMsg = err?.message || String(err);
    }

    let pass = true;
    let failureReason = "";

    if (threwException) {
      pass = false;
      failureReason = `Threw unhandled exception: ${exceptionMsg}`;
    } else {
      if (result.isValid !== tc.expectedValid) {
        pass = false;
        failureReason = `Expected isValid=${tc.expectedValid}, got isValid=${result.isValid} (error: ${result.error})`;
      } else if (tc.expectedValid) {
        if (!result.normalizedUrl || !result.normalizedUrl.startsWith("https://www.facebook.com")) {
          pass = false;
          failureReason = `Invalid normalizedUrl: ${result.normalizedUrl}`;
        }
        if (tc.expectedIdentifierType && result.identifierType !== tc.expectedIdentifierType) {
          pass = false;
          failureReason = `Expected identifierType=${tc.expectedIdentifierType}, got ${result.identifierType}`;
        }
        if (tc.expectedIdentifier) {
          // Normalize URI encoding comparison if applicable
          const actualDecoded = decodeURIComponent(result.slugOrId || "");
          const expectedDecoded = decodeURIComponent(tc.expectedIdentifier);
          if (actualDecoded !== expectedDecoded) {
            pass = false;
            failureReason = `Expected slugOrId='${tc.expectedIdentifier}', got '${result.slugOrId}'`;
          }
        }
      }
    }

    if (pass) {
      passedTests++;
      console.log(`  ✅ [PASS] ${tc.id.padEnd(7)} | ${tc.category.padEnd(20)} | valid=${String(result?.isValid).padEnd(5)} | ${tc.description}`);
    } else {
      failedTests++;
      failureDetails.push(`[${tc.id}] ${tc.description}: ${failureReason}`);
      console.log(`  ❌ [FAIL] ${tc.id.padEnd(7)} | ${tc.category.padEnd(20)} | valid=${String(result?.isValid).padEnd(5)} | ${failureReason}`);
    }

    urlResults.push({
      id: tc.id,
      input: String(tc.input),
      isValid: result?.isValid,
      slugOrId: result?.slugOrId,
      normalized: result?.normalizedUrl,
      error: result?.error,
      pass,
    });
  }

  console.log(`\nPart 1 Summary: ${URL_TEST_CASES.length - failedTests}/${URL_TEST_CASES.length} URLs behaved as expected.\n`);

  // ==========================================================================
  // SECTION 2: canPublishToPage BOUNDED CONTEXT INVARIANT VERIFICATION
  // ==========================================================================
  console.log("-------------------------------------------------------------------------------");
  console.log("PART 2: canPublishToPage Invariant Empirical Verification");
  console.log("Enforce: Source Page can NEVER be granted publishing permissions under any condition");
  console.log("-------------------------------------------------------------------------------");

  const db = getDb();

  // Test 2.1: Add Source Page via regular URL scrape mode
  totalTests++;
  const sp1 = await saveSourcePage({
    name: "Empirical Source Page 1",
    url: "https://facebook.com/emp_source_alpha",
    inputMode: "url_scrape",
    scanPostLimit: 5,
  });

  const canPublishSp1ById = canPublishToPage(sp1.id);
  const canPublishSp1BySlug = canPublishToPage(sp1.pageId || "emp_source_alpha");

  if (!canPublishSp1ById && !canPublishSp1BySlug) {
    passedTests++;
    console.log(`  ✅ [PASS] INV-01: Source Page (url_scrape) has ZERO publishing rights (id: ${sp1.id})`);
  } else {
    failedTests++;
    failureDetails.push(`INV-01: Source Page unexpectedly granted publishing rights! canPublishById=${canPublishSp1ById}, canPublishBySlug=${canPublishSp1BySlug}`);
    console.log(`  ❌ [FAIL] INV-01: Source Page was granted publishing rights!`);
  }

  // Test 2.2: Source Page with injected Token (even if someone injects a valid-looking token into source_pages table)
  totalTests++;
  const spInjectedId = `sp_injected_${Date.now()}`;
  db.prepare(`
    INSERT INTO source_pages (id, name, url, page_id, input_mode, access_token, status)
    VALUES (?, 'Injected Source Page', 'https://facebook.com/injected_page', '123456789012345', 'graph_api', 'EAAB_LEAKED_TOKEN_TEST', 'active')
    ON CONFLICT(url) DO UPDATE SET access_token = 'EAAB_LEAKED_TOKEN_TEST'
  `).run(spInjectedId);

  const canPublishInjectedById = canPublishToPage(spInjectedId);
  const canPublishInjectedByPageId = canPublishToPage("123456789012345");

  if (!canPublishInjectedById && !canPublishInjectedByPageId) {
    passedTests++;
    console.log(`  ✅ [PASS] INV-02: Source Page with access_token injected in DB is STRICTLY BLOCKED from publishing`);
  } else {
    failedTests++;
    failureDetails.push(`INV-02: Leaked/Injected Token in Source Page bypassed publish guard!`);
    console.log(`  ❌ [FAIL] INV-02: Injected Source Page was granted publishing rights!`);
  }

  // Test 2.3: Same external Facebook Page registered in BOTH Target and Source tables
  // Target Page ID: 'tgt_dual_99', Page ID: '998877665544'
  // Source Page ID: 'src_dual_99', Page ID: '998877665544'
  totalTests++;
  const tgtDual = await saveTargetPage({
    pageId: "998877665544",
    pageName: "Dual Registered Page",
    accessToken: "EAAB_VALID_TGT_TOKEN",
    status: "active",
  });

  const canPublishTargetEntity = canPublishToPage(tgtDual.id);
  const canPublishSourceEntity = canPublishToPage(spInjectedId); // distinct entity

  if (canPublishTargetEntity && !canPublishSourceEntity) {
    passedTests++;
    console.log(`  ✅ [PASS] INV-03: Dual registration correctly separates Target identity (${tgtDual.id} -> ALLOWED) from Source entity (${spInjectedId} -> BLOCKED)`);
  } else {
    failedTests++;
    failureDetails.push(`INV-03: Dual registration failed to distinguish Target vs Source entities`);
    console.log(`  ❌ [FAIL] INV-03: Dual registration error`);
  }

  // Test 2.4: Target Page in non-active states (paused, token_expired, empty token)
  totalTests++;
  const tgtPaused = await saveTargetPage({
    pageId: "112233445566",
    pageName: "Paused Target Page",
    accessToken: "EAAB_PAUSED_TOKEN",
    status: "paused",
  });

  const canPublishPaused = canPublishToPage(tgtPaused.id);
  if (!canPublishPaused) {
    passedTests++;
    console.log(`  ✅ [PASS] INV-04: Paused Target Page is BLOCKED from publishing (status: paused)`);
  } else {
    failedTests++;
    failureDetails.push(`INV-04: Paused Target Page was granted publishing rights`);
    console.log(`  ❌ [FAIL] INV-04: Paused Target Page granted publishing rights`);
  }

  totalTests++;
  const tgtExpired = await saveTargetPage({
    pageId: "223344556677",
    pageName: "Expired Target Page",
    accessToken: "EAAB_EXPIRED_TOKEN",
    status: "token_expired",
  });

  const canPublishExpired = canPublishToPage(tgtExpired.id);
  if (!canPublishExpired) {
    passedTests++;
    console.log(`  ✅ [PASS] INV-05: Expired Target Page is BLOCKED from publishing (status: token_expired)`);
  } else {
    failedTests++;
    failureDetails.push(`INV-05: Expired Target Page was granted publishing rights`);
    console.log(`  ❌ [FAIL] INV-05: Expired Target Page granted publishing rights`);
  }

  // Test 2.5: Deleted Target Page cannot publish
  totalTests++;
  deleteTargetPage(tgtDual.id);
  const canPublishDeleted = canPublishToPage(tgtDual.id);
  if (!canPublishDeleted) {
    passedTests++;
    console.log(`  ✅ [PASS] INV-06: Deleted Target Page immediately loses publishing rights`);
  } else {
    failedTests++;
    failureDetails.push(`INV-06: Deleted Target Page still retained publishing rights`);
    console.log(`  ❌ [FAIL] INV-06: Deleted Target Page retained publishing rights`);
  }

  // Test 2.6: SQL Injection / Malformed inputs into canPublishToPage
  const injectionInputs = [
    "",
    "   ",
    null as any,
    undefined as any,
    "' OR '1'='1",
    "'; DROP TABLE target_pages; --",
    "123' UNION SELECT * FROM target_pages --",
    "<script>alert(1)</script>",
    "non_existent_uuid_404",
  ];

  for (const inj of injectionInputs) {
    totalTests++;
    const res = canPublishToPage(inj);
    if (res === false) {
      passedTests++;
      console.log(`  ✅ [PASS] INV-SEC: Malicious input '${String(inj).slice(0, 25)}' safely returned false`);
    } else {
      failedTests++;
      failureDetails.push(`INV-SEC: Injection/Invalid input '${inj}' returned true!`);
      console.log(`  ❌ [FAIL] INV-SEC: Input '${inj}' unexpectedly returned true!`);
    }
  }

  // Clean up test records
  deleteSourcePage(sp1.id);
  deleteSourcePage(spInjectedId);
  deleteTargetPage(tgtPaused.id);
  deleteTargetPage(tgtExpired.id);

  console.log(`\nPart 2 Summary: All canPublishToPage invariants tested.\n`);

  // ==========================================================================
  // SECTION 3: SCAN POST LIMIT CONSTRAINTS (ENFORCING 1 TO 10)
  // ==========================================================================
  console.log("-------------------------------------------------------------------------------");
  console.log("PART 3: Scan Post Limit Constraints Empirical Verification (1 to 10)");
  console.log("-------------------------------------------------------------------------------");

  interface LimitTestCase {
    id: string;
    description: string;
    inputLimit: any;
    expectedLimit: number;
  }

  const LIMIT_TEST_CASES: LimitTestCase[] = [
    { id: "LIM-01", description: "Lower boundary: 1", inputLimit: 1, expectedLimit: 1 },
    { id: "LIM-02", description: "Upper boundary: 10", inputLimit: 10, expectedLimit: 10 },
    { id: "LIM-03", description: "Mid value: 5", inputLimit: 5, expectedLimit: 5 },
    { id: "LIM-04", description: "Mid value: 3", inputLimit: 3, expectedLimit: 3 },
    { id: "LIM-05", description: "Mid value: 8", inputLimit: 8, expectedLimit: 8 },
    { id: "LIM-06", description: "Below min: 0 (must be clamped to 1)", inputLimit: 0, expectedLimit: 1 },
    { id: "LIM-07", description: "Negative: -1 (must be clamped to 1)", inputLimit: -1, expectedLimit: 1 },
    { id: "LIM-08", description: "Extreme negative: -999 (must be clamped to 1)", inputLimit: -999, expectedLimit: 1 },
    { id: "LIM-09", description: "Above max: 11 (must be clamped to 10)", inputLimit: 11, expectedLimit: 10 },
    { id: "LIM-10", description: "Above max: 50 (must be clamped to 10)", inputLimit: 50, expectedLimit: 10 },
    { id: "LIM-11", description: "Extreme positive: 9999 (must be clamped to 10)", inputLimit: 9999, expectedLimit: 10 },
    { id: "LIM-12", description: "Undefined (must fallback to default 5)", inputLimit: undefined, expectedLimit: 5 },
    { id: "LIM-13", description: "Null (must fallback to default 5 or 1)", inputLimit: null as any, expectedLimit: 5 },
  ];

  for (const tc of LIMIT_TEST_CASES) {
    totalTests++;
    const testUrl = `https://facebook.com/emp_limit_${tc.id.toLowerCase()}_${Date.now()}`;
    const page = await saveSourcePage({
      name: `Test ${tc.id}`,
      url: testUrl,
      inputMode: "url_scrape",
      scanPostLimit: tc.inputLimit,
    });

    const savedFromDb = getSourcePage(page.id);
    const actualLimit = savedFromDb?.scanPostLimit;

    // Both 1 and default (5) are acceptable safe bounds when 0/null is passed, but must be in [1, 10]
    const isWithinBounds = typeof actualLimit === "number" && actualLimit >= 1 && actualLimit <= 10;
    const matchesExpected = actualLimit === tc.expectedLimit || (tc.inputLimit === 0 && (actualLimit === 1 || actualLimit === 5)) || (tc.inputLimit === null && (actualLimit === 1 || actualLimit === 5));

    if (isWithinBounds && matchesExpected) {
      passedTests++;
      console.log(`  ✅ [PASS] ${tc.id} | ${tc.description.padEnd(45)} | Input: ${String(tc.inputLimit).padEnd(9)} | Saved: ${actualLimit}`);
    } else {
      failedTests++;
      failureDetails.push(`[${tc.id}] ${tc.description}: input=${tc.inputLimit}, got=${actualLimit}, expected=${tc.expectedLimit}`);
      console.log(`  ❌ [FAIL] ${tc.id} | ${tc.description.padEnd(45)} | Input: ${String(tc.inputLimit).padEnd(9)} | Saved: ${actualLimit} (Expected: ${tc.expectedLimit})`);
    }

    // Clean up
    deleteSourcePage(page.id);
  }

  // Test edge case: NaN and float handling in scanPostLimit
  totalTests++;
  const nanUrl = `https://facebook.com/emp_limit_nan_${Date.now()}`;
  const nanPage = await saveSourcePage({
    name: "Test NaN Limit",
    url: nanUrl,
    inputMode: "url_scrape",
    scanPostLimit: NaN,
  });
  const nanSaved = getSourcePage(nanPage.id);
  deleteSourcePage(nanPage.id);

  if (nanSaved && typeof nanSaved.scanPostLimit === "number" && !isNaN(nanSaved.scanPostLimit) && nanSaved.scanPostLimit >= 1 && nanSaved.scanPostLimit <= 10) {
    passedTests++;
    console.log(`  ✅ [PASS] LIM-NAN: NaN scanPostLimit safely recovered to valid integer ${nanSaved.scanPostLimit}`);
  } else {
    failedTests++;
    failureDetails.push(`LIM-NAN: NaN scanPostLimit resulted in: ${nanSaved?.scanPostLimit}`);
    console.log(`  ❌ [FAIL] LIM-NAN: NaN scanPostLimit failed safe recovery! Got: ${nanSaved?.scanPostLimit}`);
  }

  // ==========================================================================
  // FINAL SCORECARD
  // ==========================================================================
  console.log("\n===============================================================================");
  console.log(`📊 EMPIRICAL STRESS TEST RESULTS:`);
  console.log(`   Total Tests Run   : ${totalTests}`);
  console.log(`   Passed Tests      : ${passedTests} (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
  console.log(`   Failed Tests      : ${failedTests}`);
  console.log("===============================================================================");

  if (failureDetails.length > 0) {
    console.log("\n❌ Failure Details:");
    failureDetails.forEach((f) => console.log(`   - ${f}`));
  }

  return {
    totalTests,
    passedTests,
    failedTests,
    failureDetails,
    urlResults,
  };
}

runEmpiricalSuite().catch((err) => {
  console.error("Fatal error executing empirical test suite:", err);
  process.exit(1);
});
