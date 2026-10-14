/**
 * Empirical API Route Stress-Test — Milestone 1
 * Challenger 1
 */

import { NextRequest } from "next/server";
import { POST as sourcePost, GET as sourceGet, DELETE as sourceDelete } from "../src/app/api/pages/source/route";
import { POST as targetPost, GET as targetGet, DELETE as targetDelete } from "../src/app/api/pages/target/route";
import { getSourcePage, getTargetPage } from "../src/services/pageManager.service";

async function runApiEmpiricalTests() {
  console.log("===============================================================================");
  console.log("🔥 EMPIRICAL API ROUTE STRESS TEST (NextRequest -> Route Handlers)");
  console.log("===============================================================================\n");

  let total = 0;
  let passed = 0;
  let failed = 0;

  // 1. POST /api/pages/source action=validate_url with valid URL
  total++;
  const req1 = new NextRequest("http://localhost:3000/api/pages/source", {
    method: "POST",
    body: JSON.stringify({ action: "validate_url", url: "https://facebook.com/techcrunch" }),
  });
  const res1 = await sourcePost(req1);
  const data1 = await res1.json();
  if (data1.success === true && data1.parsedUrl?.isValid === true && data1.parsedUrl?.slugOrId === "techcrunch") {
    passed++;
    console.log("  ✅ [PASS] API-01: validate_url with valid URL returns success: true");
  } else {
    failed++;
    console.log("  ❌ [FAIL] API-01: validate_url failed", data1);
  }

  // 2. POST /api/pages/source action=validate_url with invalid URL
  total++;
  const req2 = new NextRequest("http://localhost:3000/api/pages/source", {
    method: "POST",
    body: JSON.stringify({ action: "validate_url", url: "https://facebook.com/login" }),
  });
  const res2 = await sourcePost(req2);
  const data2 = await res2.json();
  if (data2.success === false && data2.error) {
    passed++;
    console.log("  ✅ [PASS] API-02: validate_url with reserved system URL returns success: false");
  } else {
    failed++;
    console.log("  ❌ [FAIL] API-02: validate_url failed to reject reserved path", data2);
  }

  // 3. POST /api/pages/source with negative scanPostLimit
  total++;
  const testUrl3 = `https://facebook.com/api_test_limit_neg_${Date.now()}`;
  const req3 = new NextRequest("http://localhost:3000/api/pages/source", {
    method: "POST",
    body: JSON.stringify({
      name: "API Neg Limit",
      url: testUrl3,
      inputMode: "url_scrape",
      scanPostLimit: -20,
    }),
  });
  const res3 = await sourcePost(req3);
  const data3 = await res3.json();
  if (data3.success === true && data3.page?.scanPostLimit >= 1 && data3.page?.scanPostLimit <= 10) {
    passed++;
    console.log(`  ✅ [PASS] API-03: Negative scanPostLimit clamped to safe bound (${data3.page?.scanPostLimit})`);
    // cleanup
    const delReq = new NextRequest(`http://localhost:3000/api/pages/source?id=${data3.page.id}`, { method: "DELETE" });
    await sourceDelete(delReq);
  } else {
    failed++;
    console.log("  ❌ [FAIL] API-03: Negative scanPostLimit not handled correctly", data3);
  }

  // 4. POST /api/pages/source with excessive scanPostLimit (100)
  total++;
  const testUrl4 = `https://facebook.com/api_test_limit_overflow_${Date.now()}`;
  const req4 = new NextRequest("http://localhost:3000/api/pages/source", {
    method: "POST",
    body: JSON.stringify({
      name: "API Overflow Limit",
      url: testUrl4,
      inputMode: "url_scrape",
      scanPostLimit: 100,
    }),
  });
  const res4 = await sourcePost(req4);
  const data4 = await res4.json();
  if (data4.success === true && data4.page?.scanPostLimit === 10) {
    passed++;
    console.log(`  ✅ [PASS] API-04: Excessive scanPostLimit clamped to 10 (${data4.page?.scanPostLimit})`);
    // cleanup
    const delReq = new NextRequest(`http://localhost:3000/api/pages/source?id=${data4.page.id}`, { method: "DELETE" });
    await sourceDelete(delReq);
  } else {
    failed++;
    console.log("  ❌ [FAIL] API-04: Excessive scanPostLimit not clamped to 10", data4);
  }

  // 5. POST /api/pages/source with string scanPostLimit "invalid_limit"
  total++;
  const testUrl5 = `https://facebook.com/api_test_limit_str_${Date.now()}`;
  const req5 = new NextRequest("http://localhost:3000/api/pages/source", {
    method: "POST",
    body: JSON.stringify({
      name: "API String Limit",
      url: testUrl5,
      inputMode: "url_scrape",
      scanPostLimit: "invalid_limit",
    }),
  });
  const res5 = await sourcePost(req5);
  const data5 = await res5.json();
  if (data5.success === true && typeof data5.page?.scanPostLimit === "number" && !isNaN(data5.page?.scanPostLimit) && data5.page?.scanPostLimit >= 1 && data5.page?.scanPostLimit <= 10) {
    passed++;
    console.log(`  ✅ [PASS] API-05: Non-numeric scanPostLimit string safely resolved to ${data5.page?.scanPostLimit}`);
    const delReq = new NextRequest(`http://localhost:3000/api/pages/source?id=${data5.page.id}`, { method: "DELETE" });
    await sourceDelete(delReq);
  } else {
    failed++;
    console.log("  ❌ [FAIL] API-05: String limit caused error or NaN", data5);
  }

  // 6. POST /api/pages/source missing URL in url_scrape mode
  total++;
  const req6 = new NextRequest("http://localhost:3000/api/pages/source", {
    method: "POST",
    body: JSON.stringify({
      name: "No URL",
      url: "",
      inputMode: "url_scrape",
    }),
  });
  const res6 = await sourcePost(req6);
  const data6 = await res6.json();
  if (res6.status === 400 && data6.success === false) {
    passed++;
    console.log("  ✅ [PASS] API-06: Missing URL in url_scrape mode returns 400 Bad Request");
  } else {
    failed++;
    console.log("  ❌ [FAIL] API-06: Missing URL was not rejected with 400", data6);
  }

  // 7. POST /api/pages/target missing pageId
  total++;
  const req7 = new NextRequest("http://localhost:3000/api/pages/target", {
    method: "POST",
    body: JSON.stringify({
      pageId: "",
      accessToken: "EAAB...",
    }),
  });
  const res7 = await targetPost(req7);
  const data7 = await res7.json();
  if (res7.status === 400 && data7.success === false) {
    passed++;
    console.log("  ✅ [PASS] API-07: Missing pageId in target creation returns 400 Bad Request");
  } else {
    failed++;
    console.log("  ❌ [FAIL] API-07: Missing pageId was not rejected with 400", data7);
  }

  // 8. POST /api/pages/target missing accessToken
  total++;
  const req8 = new NextRequest("http://localhost:3000/api/pages/target", {
    method: "POST",
    body: JSON.stringify({
      pageId: "123456789",
      accessToken: "",
    }),
  });
  const res8 = await targetPost(req8);
  const data8 = await res8.json();
  if (res7.status === 400 && data8.success === false) {
    passed++;
    console.log("  ✅ [PASS] API-08: Missing accessToken in target creation returns 400 Bad Request");
  } else {
    failed++;
    console.log("  ❌ [FAIL] API-08: Missing accessToken was not rejected with 400", data8);
  }

  // 9. POST /api/pages/target action=set_default non-existent id
  total++;
  const req9 = new NextRequest("http://localhost:3000/api/pages/target", {
    method: "POST",
    body: JSON.stringify({
      action: "set_default",
      id: "tgt_non_existent_404",
    }),
  });
  const res9 = await targetPost(req9);
  const data9 = await res9.json();
  if (res9.status === 404 && data9.success === false) {
    passed++;
    console.log("  ✅ [PASS] API-09: set_default with non-existent id returns 404 Not Found");
  } else {
    failed++;
    console.log("  ❌ [FAIL] API-09: set_default non-existent id not handled with 404", data9);
  }

  // 10. DELETE /api/pages/source with missing id
  total++;
  const req10 = new NextRequest("http://localhost:3000/api/pages/source", {
    method: "DELETE",
    body: JSON.stringify({}),
  });
  const res10 = await sourceDelete(req10);
  const data10 = await res10.json();
  if (res10.status === 400 && data10.success === false) {
    passed++;
    console.log("  ✅ [PASS] API-10: DELETE without id returns 400 Bad Request");
  } else {
    failed++;
    console.log("  ❌ [FAIL] API-10: DELETE without id did not return 400", data10);
  }

  console.log("\n===============================================================================");
  console.log(`📊 API ROUTE TEST RESULTS: ${passed}/${total} PASSED (${((passed / total) * 100).toFixed(1)}%)`);
  console.log("===============================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runApiEmpiricalTests().catch((err) => {
  console.error("API test fatal error:", err);
  process.exit(1);
});
