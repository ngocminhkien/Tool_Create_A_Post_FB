/**
 * tests/e2e/tier1/f1_policy_guard.test.ts
 * Feature F1: Facebook Policy Guard & Anti-Shadowban Scanner
 * Validates dictionary & regex scanning across 6 policy categories.
 */

import assert from "node:assert/strict";
import { scanFacebookPolicy } from "../harness/serviceLoader";
import { TestRunnerContext } from "../harness/runnerHelper";
import { TestSuiteSummary } from "../types";

export async function runTier1F1Tests(): Promise<TestSuiteSummary> {
  const runner = new TestRunnerContext("Facebook Policy Guard Scanner", 1, "F1");

  await runner.test("F1.1: Detects absolute claims (cam kết 100%) with high severity", async () => {
    const text = "Sản phẩm của chúng tôi cam kết 100% mang lại hiệu quả vượt trội cho khách hàng.";
    const result = await scanFacebookPolicy(text);

    assert.equal(result.isSafe, false, "Should flag absolute claim as unsafe");
    assert.ok(result.violations.length >= 1, "Should report at least one violation");
    const v = result.violations.find((item) => item.category === "absolute_claim");
    assert.ok(v, "Should categorize as absolute_claim");
    assert.equal(v?.severity, "high", "Absolute claim must have high severity");
    assert.match(v?.matchedText || "", /cam kết\s+100%/i, "Should match the prohibited phrase");
    assert.ok(v?.suggestions.length && v.suggestions.length > 0, "Should provide safe suggestions");
  });

  await runner.test("F1.2: Detects medical curative claims (trị dứt điểm)", async () => {
    const text = "Liệu trình thảo dược giúp trị dứt điểm mụn viêm và phục hồi da cấp tốc.";
    const result = await scanFacebookPolicy(text);

    assert.equal(result.isSafe, false);
    const v = result.violations.find((item) => item.category === "medical_curative");
    assert.ok(v, "Should categorize as medical_curative");
    assert.equal(v?.severity, "high");
    assert.match(v?.matchedText || "", /trị dứt điểm/i);
    assert.ok(result.riskScore >= 35, "Risk score should reflect high severity violation");
  });

  await runner.test("F1.3: Detects financial hype & get-rich-quick claims", async () => {
    const text = "Cơ hội kiếm tiền tại nhà nhân đôi tài sản sau 1 tháng tham gia hội thảo.";
    const result = await scanFacebookPolicy(text);

    assert.equal(result.isSafe, false);
    const v = result.violations.find((item) => item.category === "financial_hype");
    assert.ok(v, "Should categorize as financial_hype");
    assert.equal(result.riskLevel, "danger", "Multiple financial hype triggers should result in danger level");
  });

  await runner.test("F1.4: Detects exposed phone numbers & hotline spam", async () => {
    const text = "Mọi thắc mắc xin vui lòng liên hệ hotline 0901.234.567 để được tư vấn ngay.";
    const result = await scanFacebookPolicy(text);

    assert.equal(result.isSafe, false);
    const v = result.violations.find((item) => item.category === "phone_spam");
    assert.ok(v, "Should categorize as phone_spam");
    assert.equal(v?.severity, "medium");
    assert.match(v?.matchedText || "", /0901\.234\.567/);
  });

  await runner.test("F1.5: Detects shortened external spam links", async () => {
    const text = "Bấm ngay vào link bit.ly/giam-gia-soc để nhận quà tặng giới hạn!";
    const result = await scanFacebookPolicy(text);

    assert.equal(result.isSafe, false);
    const v = result.violations.find((item) => item.category === "external_link");
    assert.ok(v, "Should categorize as external_link");
    assert.match(v?.matchedText || "", /bit\.ly\/giam-gia-soc/);
  });

  await runner.test("F1.6: Detects before-and-after body comparisons", async () => {
    const text = "Xem ngay ảnh trước và sau khi thực hiện liệu trình để thấy sự khác biệt.";
    const result = await scanFacebookPolicy(text);

    assert.equal(result.isSafe, false);
    const v = result.violations.find((item) => item.category === "body_claim");
    assert.ok(v, "Should categorize as body_claim");
  });

  await runner.test("F1.7: Confirms clean, educational copy as safe with 0 risk", async () => {
    const cleanText = "Chia sẻ 5 bí quyết chăm sóc da khoa học vào mùa hè giúp duy trì độ ẩm tự nhiên.";
    const result = await scanFacebookPolicy(cleanText);

    assert.equal(result.isSafe, true, "Clean text must be marked isSafe=true");
    assert.equal(result.riskScore, 0, "Clean text must have riskScore=0");
    assert.equal(result.riskLevel, "safe", "Clean text must have riskLevel='safe'");
    assert.equal(result.violations.length, 0, "Clean text must have 0 violations");
  });

  return runner.getSummary();
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  runTier1F1Tests().then((s) => {
    new TestRunnerContext(s.suiteName, s.tier, "F1").printSummary();
  });
}
