/**
 * tests/e2e/tier1/f2_policy_quick_fix.test.ts
 * Feature F2: Policy Guard Quick-Fix Action
 * Validates 1-click single replacement and auto-sanitization of Meta violations.
 */

import assert from "node:assert/strict";
import { applyPolicyFix, autoSanitizeAll, scanFacebookPolicy } from "../harness/serviceLoader";
import { TestRunnerContext } from "../harness/runnerHelper";
import { TestSuiteSummary } from "../types";

export async function runTier1F2Tests(): Promise<TestSuiteSummary> {
  const runner = new TestRunnerContext("Policy Guard Quick-Fix Actions", 1, "F2");

  await runner.test("F2.1: Replaces a specific violation with user-selected suggestion", async () => {
    const original = "Chúng tôi cam kết 100% về độ bền của sản phẩm.";
    const scan = await scanFacebookPolicy(original);
    assert.ok(scan.violations.length > 0);

    const violation = scan.violations[0];
    const suggestion = violation.suggestions[0] || "cam kết chất lượng hàng đầu";

    const fixed = await applyPolicyFix(original, violation.id, suggestion);
    assert.ok(!fixed.includes("cam kết 100%"), "Fixed text should not contain prohibited phrase");
    assert.ok(fixed.includes(suggestion), "Fixed text should contain the suggested replacement");
  });

  await runner.test("F2.2: Preserves surrounding punctuation and spacing when applying fix", async () => {
    const original = "Ưu đãi đặc biệt: bảo đảm 100%! Hãy nhanh tay.";
    const scan = await scanFacebookPolicy(original);
    const violation = scan.violations[0];

    const fixed = await applyPolicyFix(original, violation.id, "đồng hành tận tâm");
    assert.ok(fixed.startsWith("Ưu đãi đặc biệt: "));
    assert.ok(fixed.endsWith("! Hãy nhanh tay."));
  });

  await runner.test("F2.3: autoSanitizeAll removes multiple violations of diverse categories", async () => {
    const multiViolation =
      "Dịch vụ cam kết 100% trị dứt điểm mụn. Hotline 0901.234.567. Bấm bit.ly/dat-lich ngay.";
    const sanitized = await autoSanitizeAll(multiViolation);

    assert.ok(!sanitized.includes("cam kết 100%"));
    assert.ok(!sanitized.includes("trị dứt điểm"));
    assert.ok(!sanitized.includes("0901.234.567"));
    assert.ok(!sanitized.includes("bit.ly/dat-lich"));
  });

  await runner.test("F2.4: Post-sanitization scan confirms text is safe (riskScore: 0)", async () => {
    const dirtyText = "Sản phẩm hỗ trợ trị dứt điểm thâm nám, bảo đảm 100% hiệu quả.";
    const sanitized = await autoSanitizeAll(dirtyText);
    const scanAfter = await scanFacebookPolicy(sanitized);

    assert.equal(scanAfter.isSafe, true, "Sanitized text must pass policy scan as safe");
    assert.equal(scanAfter.violations.length, 0, "Sanitized text must have zero violations");
    assert.equal(scanAfter.riskScore, 0, "Sanitized text riskScore must be 0");
  });

  await runner.test("F2.5: autoSanitizeAll is idempotent on already clean text", async () => {
    const clean = "Bộ sưu tập thời trang thu đông thanh lịch, tôn dáng và mang lại sự thoải mái tối đa.";
    const sanitized = await autoSanitizeAll(clean);
    assert.equal(sanitized, clean, "Clean text must remain completely unchanged");
  });

  await runner.test("F2.6: applyPolicyFix returns original text gracefully when invalid id passed", async () => {
    const original = "Nội dung bài viết thông thường.";
    const result = await applyPolicyFix(original, "non_existent_violation_id_999", "thay thế");
    assert.equal(result, original, "Should return original text if violation id is not found");
  });

  return runner.getSummary();
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  runTier1F2Tests().then((s) => {
    new TestRunnerContext(s.suiteName, s.tier, "F2").printSummary();
  });
}
