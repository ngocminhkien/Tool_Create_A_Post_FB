/**
 * tests/auditor_m1_routes_verify.ts
 * Independent Forensic Verification of Next.js Route Handlers for Target & Source Pages
 */

import { GET as getTarget, POST as postTarget, DELETE as deleteTarget } from "../src/app/api/pages/target/route";
import { GET as getSource, POST as postSource, DELETE as deleteSource } from "../src/app/api/pages/source/route";
import { NextRequest } from "next/server";

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

function makeRequest(url: string, method: string, body?: any): NextRequest {
  const init: any = { method };
  if (body) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

async function runRouteTests() {
  console.log("============================================================");
  console.log("AUDITOR M1: ROUTE HANDLERS FORENSIC INTEGRITY AUDIT");
  console.log("============================================================");

  // 1. GET /api/pages/target
  const resTargetGet = await getTarget();
  assert(resTargetGet.status === 200, "GET /api/pages/target returns HTTP 200");
  const dataTargetGet = await resTargetGet.json();
  assert(dataTargetGet.success === true && Array.isArray(dataTargetGet.pages), "GET /api/pages/target returns pages array");

  // 2. POST /api/pages/target action="verify"
  const reqTargetVerify = makeRequest("http://localhost:3000/api/pages/target", "POST", {
    action: "verify",
    pageId: "123456",
    accessToken: "fake_token_for_audit"
  });
  const resTargetVerify = await postTarget(reqTargetVerify);
  const dataTargetVerify = await resTargetVerify.json();
  assert(dataTargetVerify.success === false, "POST /api/pages/target verify returns false for fake token");
  assert(dataTargetVerify.validation?.valid === false, "validation.valid is false");

  // 3. POST /api/pages/target create page
  const testPageId = `route_tgt_${Date.now()}`;
  const reqTargetCreate = makeRequest("http://localhost:3000/api/pages/target", "POST", {
    pageId: testPageId,
    pageName: "Route Test Target",
    accessToken: "route_test_token",
    isDefault: false
  });
  const resTargetCreate = await postTarget(reqTargetCreate);
  assert(resTargetCreate.status === 200, "POST /api/pages/target returns HTTP 200 on creation");
  const dataTargetCreate = await resTargetCreate.json();
  assert(dataTargetCreate.success === true && dataTargetCreate.page?.pageId === testPageId, "Target page created via API");
  const createdTargetId = dataTargetCreate.page.id;

  // 4. POST /api/pages/target action="set_default"
  const reqTargetSetDef = makeRequest("http://localhost:3000/api/pages/target", "POST", {
    action: "set_default",
    id: createdTargetId
  });
  const resTargetSetDef = await postTarget(reqTargetSetDef);
  const dataTargetSetDef = await resTargetSetDef.json();
  assert(dataTargetSetDef.success === true && dataTargetSetDef.page?.isDefault === true, "Set default target page works via API");

  // 5. DELETE /api/pages/target
  const reqTargetDelete = makeRequest(`http://localhost:3000/api/pages/target?id=${encodeURIComponent(createdTargetId)}`, "DELETE");
  const resTargetDelete = await deleteTarget(reqTargetDelete);
  assert(resTargetDelete.status === 200, "DELETE /api/pages/target returns HTTP 200");
  const dataTargetDelete = await resTargetDelete.json();
  assert(dataTargetDelete.success === true, "Target page deleted via API");

  // 6. GET /api/pages/source
  const resSourceGet = await getSource();
  assert(resSourceGet.status === 200, "GET /api/pages/source returns HTTP 200");
  const dataSourceGet = await resSourceGet.json();
  assert(dataSourceGet.success === true && Array.isArray(dataSourceGet.pages), "GET /api/pages/source returns pages array");

  // 7. POST /api/pages/source action="validate_url"
  const reqSourceVal = makeRequest("http://localhost:3000/api/pages/source", "POST", {
    action: "validate_url",
    url: "https://www.facebook.com/thongtinchinhphu"
  });
  const resSourceVal = await postSource(reqSourceVal);
  const dataSourceVal = await resSourceVal.json();
  assert(dataSourceVal.success === true && dataSourceVal.parsedUrl?.slugOrId === "thongtinchinhphu", "URL validation action works via API");

  // 8. POST /api/pages/source create page (url_scrape mode)
  const testSourceUrl = `https://www.facebook.com/src_test_${Date.now()}`;
  const reqSourceCreate = makeRequest("http://localhost:3000/api/pages/source", "POST", {
    name: "Route Test Source",
    url: testSourceUrl,
    inputMode: "url_scrape",
    scanPostLimit: 8
  });
  const resSourceCreate = await postSource(reqSourceCreate);
  assert(resSourceCreate.status === 200, "POST /api/pages/source returns HTTP 200 on creation");
  const dataSourceCreate = await resSourceCreate.json();
  assert(dataSourceCreate.success === true && dataSourceCreate.page?.url === testSourceUrl, "Source page created via API");
  assert(dataSourceCreate.page?.scanPostLimit === 8, "scanPostLimit set to 8");
  const createdSourceId = dataSourceCreate.page.id;

  // 9. DELETE /api/pages/source
  const reqSourceDelete = makeRequest(`http://localhost:3000/api/pages/source?id=${encodeURIComponent(createdSourceId)}`, "DELETE");
  const resSourceDelete = await deleteSource(reqSourceDelete);
  assert(resSourceDelete.status === 200, "DELETE /api/pages/source returns HTTP 200");
  const dataSourceDelete = await resSourceDelete.json();
  assert(dataSourceDelete.success === true, "Source page deleted via API");

  console.log("\n============================================================");
  console.log(`TOTAL ROUTE CHECKS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log("============================================================");
}

runRouteTests().catch((err) => {
  console.error("Route Tests Error:", err);
  process.exit(1);
});
