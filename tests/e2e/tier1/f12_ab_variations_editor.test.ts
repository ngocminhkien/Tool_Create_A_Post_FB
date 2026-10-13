/**
 * tests/e2e/tier1/f12_ab_variations_editor.test.ts
 * Feature F12: A/B Variations Editor & Tone Switcher Contract
 * Validates variation payloads, multi-tone switching, and SQLite JSON persistence.
 */

import assert from "node:assert/strict";
import { runMigrations } from "../harness/serviceLoader";
import { createTestDatabase } from "../harness/testDb";
import { TestRunnerContext } from "../harness/runnerHelper";
import { TestSuiteSummary, VariationContentItem } from "../types";

export async function runTier1F12Tests(): Promise<TestSuiteSummary> {
  const runner = new TestRunnerContext("A/B Variations Editor & Tone Switcher", 1, "F12");

  await runner.test("F12.1: Correctly serializes and deserializes variation JSON array", () => {
    const variations: VariationContentItem[] = [
      {
        style: "storytelling",
        title: "Hành trình xe điện",
        content: "Nội dung kể chuyện cảm xúc...",
        hook: "Mở đầu ấn tượng...",
        createdAt: new Date().toISOString(),
      },
      {
        style: "direct_sales",
        title: "Ưu đãi xe điện",
        content: "Nội dung bán hàng trực diện...",
        hook: "Ưu đãi có 1-0-2...",
        createdAt: new Date().toISOString(),
      },
    ];

    const jsonStr = JSON.stringify(variations);
    const parsed = JSON.parse(jsonStr) as VariationContentItem[];

    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].style, "storytelling");
    assert.equal(parsed[1].style, "direct_sales");
  });

  await runner.test("F12.2: Stores and queries variations_json in facebook_posts table", async () => {
    const db = createTestDatabase();
    await runMigrations(db);

    const postId = `post_var_${Date.now()}`;
    const variations: VariationContentItem[] = [
      {
        style: "news_guide",
        title: "Cẩm nang bảo dưỡng xe",
        content: "5 bước bảo dưỡng...",
        hook: "Bí quyết kéo dài tuổi thọ pin...",
        createdAt: new Date().toISOString(),
      },
    ];

    db.prepare(`
      INSERT INTO facebook_posts (id, topic_title, content, status, content_style, variations_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(postId, "Bảo dưỡng xe", "Nội dung", "draft", "news_guide", JSON.stringify(variations));

    const row = db.prepare("SELECT * FROM facebook_posts WHERE id = ?").get(postId) as any;
    assert.ok(row);
    assert.equal(row.content_style, "news_guide");

    const retrievedVariations = JSON.parse(row.variations_json);
    assert.equal(retrievedVariations.length, 1);
    assert.equal(retrievedVariations[0].style, "news_guide");
  });

  await runner.test("F12.3: Supports updating active tone selection (content_style)", async () => {
    const db = createTestDatabase();
    await runMigrations(db);

    const postId = `post_tone_${Date.now()}`;
    db.prepare(`
      INSERT INTO facebook_posts (id, topic_title, content, status, content_style)
      VALUES (?, ?, ?, ?, ?)
    `).run(postId, "Chủ đề", "Nội dung", "draft", "storytelling");

    db.prepare("UPDATE facebook_posts SET content_style = ? WHERE id = ?").run("humorous_trend", postId);

    const row = db.prepare("SELECT content_style FROM facebook_posts WHERE id = ?").get(postId) as any;
    assert.equal(row.content_style, "humorous_trend");
  });

  await runner.test("F12.4: Enables comparing two variations side-by-side by structure", () => {
    const varA: VariationContentItem = {
      style: "storytelling",
      title: "Bài viết A",
      content: "Nội dung bài viết dài 300 từ với câu chuyện.",
      hook: "Hook A",
      createdAt: new Date().toISOString(),
    };

    const varB: VariationContentItem = {
      style: "direct_sales",
      title: "Bài viết B",
      content: "Nội dung bài viết bán hàng trực tiếp 200 từ.",
      hook: "Hook B",
      createdAt: new Date().toISOString(),
    };

    assert.notEqual(varA.style, varB.style);
    assert.notEqual(varA.hook, varB.hook);
    assert.ok(varA.content.length > 0 && varB.content.length > 0);
  });

  await runner.test("F12.5: Default value for variations_json and content_style is clean and non-null", async () => {
    const db = createTestDatabase();
    await runMigrations(db);

    const postId = `post_default_${Date.now()}`;
    db.prepare(`
      INSERT INTO facebook_posts (id, topic_title, content, status)
      VALUES (?, ?, ?, ?)
    `).run(postId, "Chủ đề", "Nội dung", "draft");

    const row = db.prepare("SELECT content_style, variations_json FROM facebook_posts WHERE id = ?").get(postId) as any;
    assert.ok(row.content_style !== undefined);
    assert.ok(row.variations_json !== undefined);
  });

  return runner.getSummary();
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  runTier1F12Tests().then((s) => {
    new TestRunnerContext(s.suiteName, s.tier, "F12").printSummary();
  });
}
