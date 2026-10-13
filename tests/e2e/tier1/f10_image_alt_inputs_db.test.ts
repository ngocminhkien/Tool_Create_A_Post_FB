/**
 * tests/e2e/tier1/f10_image_alt_inputs_db.test.ts
 * Feature F10: Image Alt Text & Caption Inputs & SQLite Persistence
 * Validates database schema storage and retrieval for image accessibility metadata.
 */

import assert from "node:assert/strict";
import { runMigrations } from "../harness/serviceLoader";
import { createTestDatabase } from "../harness/testDb";
import { TestRunnerContext } from "../harness/runnerHelper";
import { TestSuiteSummary } from "../types";

export async function runTier1F10Tests(): Promise<TestSuiteSummary> {
  const runner = new TestRunnerContext("Image Alt Text & Caption DB Persistence", 1, "F10");

  await runner.test("F10.1: Stores alt_text and caption fields in ai_images table", async () => {
    const db = createTestDatabase();
    await runMigrations(db);

    const imageId = `img_${Date.now()}`;
    const altText = "Ảnh chụp chiếc xe điện VinFast VF7 màu xanh trên đường phố.";
    const caption = "Trải nghiệm xe điện thế hệ mới cùng VinFast VF7.";

    db.prepare(`
      INSERT INTO ai_images (id, topic_title, entity, prompt, image_url, alt_text, caption)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(imageId, "Xe điện VF7", "VinFast", "A modern electric car", "https://example.com/vf7.png", altText, caption);

    const row = db.prepare("SELECT * FROM ai_images WHERE id = ?").get(imageId) as any;
    assert.ok(row, "Image record must exist");
    assert.equal(row.alt_text, altText);
    assert.equal(row.caption, caption);
  });

  await runner.test("F10.2: Stores alt_text and image_caption fields in facebook_posts table", async () => {
    const db = createTestDatabase();
    await runMigrations(db);

    const postId = `post_${Date.now()}`;
    const altText = "Mô tả hình ảnh tiếp cận cho bài viết Facebook.";
    const imageCaption = "Chú thích bài đăng Facebook chuẩn SEO hình ảnh.";

    db.prepare(`
      INSERT INTO facebook_posts (id, topic_title, content, status, alt_text, image_caption)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(postId, "Chủ đề thử nghiệm", "Nội dung bài viết", "draft", altText, imageCaption);

    const row = db.prepare("SELECT * FROM facebook_posts WHERE id = ?").get(postId) as any;
    assert.ok(row);
    assert.equal(row.alt_text, altText);
    assert.equal(row.image_caption, imageCaption);
  });

  await runner.test("F10.3: Successfully updates image alt_text and caption on existing post", async () => {
    const db = createTestDatabase();
    await runMigrations(db);

    const postId = `post_update_${Date.now()}`;
    db.prepare(`
      INSERT INTO facebook_posts (id, topic_title, content, status, alt_text, image_caption)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(postId, "Chủ đề ban đầu", "Nội dung", "draft", "Alt ban đầu", "Caption ban đầu");

    const newAlt = "Alt text cập nhật mới tối ưu SEO";
    const newCaption = "Caption cập nhật mới";

    db.prepare(`
      UPDATE facebook_posts SET alt_text = ?, image_caption = ? WHERE id = ?
    `).run(newAlt, newCaption, postId);

    const updated = db.prepare("SELECT alt_text, image_caption FROM facebook_posts WHERE id = ?").get(postId) as any;
    assert.equal(updated.alt_text, newAlt);
    assert.equal(updated.image_caption, newCaption);
  });

  await runner.test("F10.4: Gracefully handles empty string for alt_text and caption without errors", async () => {
    const db = createTestDatabase();
    await runMigrations(db);

    const imageId = `img_empty_${Date.now()}`;
    assert.doesNotThrow(() => {
      db.prepare(`
        INSERT INTO ai_images (id, topic_title, prompt, image_url, alt_text, caption)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(imageId, "Chủ đề", "Prompt", "https://example.com/img.png", "", "");
    });

    const row = db.prepare("SELECT alt_text, caption FROM ai_images WHERE id = ?").get(imageId) as any;
    assert.equal(row.alt_text, "");
    assert.equal(row.caption, "");
  });

  await runner.test("F10.5: Verifies table schema columns existence via PRAGMA table_info", async () => {
    const db = createTestDatabase();
    await runMigrations(db);

    const postCols = (db.prepare("PRAGMA table_info(facebook_posts);").all() as any[]).map((c) => c.name);
    assert.ok(postCols.includes("alt_text"), "facebook_posts must have alt_text column");
    assert.ok(postCols.includes("image_caption"), "facebook_posts must have image_caption column");

    const imgCols = (db.prepare("PRAGMA table_info(ai_images);").all() as any[]).map((c) => c.name);
    assert.ok(imgCols.includes("alt_text"), "ai_images must have alt_text column");
    assert.ok(imgCols.includes("caption"), "ai_images must have caption column");
  });

  return runner.getSummary();
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  runTier1F10Tests().then((s) => {
    new TestRunnerContext(s.suiteName, s.tier, "F10").printSummary();
  });
}
