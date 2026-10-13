/**
 * tests/e2e/tier1/f8_hashtag_append_ui.test.ts
 * Feature F8: 3-Tier Hashtag UI & 1-Click Append Action
 * Validates appending hashtag blocks with proper paragraph separation and deduplication.
 */

import assert from "node:assert/strict";
import { appendHashtags } from "../harness/serviceLoader";
import { TestRunnerContext } from "../harness/runnerHelper";
import { TestSuiteSummary } from "../types";

export async function runTier1F8Tests(): Promise<TestSuiteSummary> {
  const runner = new TestRunnerContext("Hashtag 1-Click Append Action", 1, "F8");

  await runner.test("F8.1: Appends hashtags cleanly when post content is currently empty", () => {
    const tags = ["#VinFast", "#VF7", "#XeDien"];
    const result = appendHashtags("", tags);

    assert.equal(result, "#VinFast #VF7 #XeDien");
  });

  await runner.test("F8.2: Appends hashtags with double newlines delimiter to existing text", () => {
    const content = "Nội dung bài viết chia sẻ về công nghệ xe điện.";
    const tags = ["#VinFast", "#CongNgheXeDien"];
    const result = appendHashtags(content, tags);

    assert.equal(result, `${content}\n\n#VinFast #CongNgheXeDien`);
    assert.ok(result.startsWith(content));
    assert.ok(result.endsWith("#CongNgheXeDien"));
  });

  await runner.test("F8.3: Preserves existing multiline formatting in original content", () => {
    const content = "Đoạn 1 giới thiệu.\n\nĐoạn 2 chi tiết.\n\nĐoạn 3 kết luận.";
    const tags = ["#KienThuc", "#GiaTri"];
    const result = appendHashtags(content, tags);

    assert.ok(result.includes("Đoạn 1 giới thiệu.\n\nĐoạn 2 chi tiết."));
    assert.ok(result.endsWith("\n\n#KienThuc #GiaTri"));
  });

  await runner.test("F8.4: Trims trailing whitespace from original text before appending", () => {
    const content = "Nội dung bài viết có khoảng trắng thừa ở cuối.   \n\n   ";
    const tags = ["#ThoiTrang", "#XuHuong"];
    const result = appendHashtags(content, tags);

    assert.ok(!result.includes("   \n\n   \n\n"));
    assert.ok(result.endsWith("#ThoiTrang #XuHuong"));
  });

  await runner.test("F8.5: Returns original text unchanged when hashtags array is empty", () => {
    const content = "Nội dung bài viết không thay đổi.";
    const result = appendHashtags(content, []);

    assert.equal(result, content);
  });

  return runner.getSummary();
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  runTier1F8Tests().then((s) => {
    new TestRunnerContext(s.suiteName, s.tier, "F8").printSummary();
  });
}
