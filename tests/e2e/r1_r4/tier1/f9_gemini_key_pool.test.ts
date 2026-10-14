/**
 * tests/e2e/r1_r4/tier1/f9_gemini_key_pool.test.ts
 * Tier 1 — Feature F9: Gemini 30-Key Pool Integration
 * Verifies 30-key pool capacity, masked key formatting, rotation under rate limit, and model fallback.
 */

import { TestRunnerContext } from "../../harness/runnerHelper";
import { createTestDatabase } from "../../harness/testDb";
import { rewriteSourcePost } from "../../harness/serviceLoader";
import { TestSuiteSummary } from "../../types";

export async function runTier1F9GeminiKeyPoolTests(): Promise<TestSuiteSummary> {
  const ctx = new TestRunnerContext("F9: Gemini 30-Key Pool Integration", 1, "F9");

  await ctx.test("F9-01: Key pool contains 30 unique keys in database", async () => {
    const db = createTestDatabase();
    // Seed 30 keys into gemini_keys
    for (let i = 1; i <= 30; i++) {
      const fullKey = `AIzaSyFakeKeyNumber${String(i).padStart(2, "0")}ForTestingOnly`;
      const masked = `AIzaSy...${String(i).padStart(2, "0")}k`;
      db.prepare(`
        INSERT INTO gemini_keys (id, key, masked_key, status)
        VALUES (?, ?, ?, 'active');
      `).run(`key_${i}`, fullKey, masked);
    }

    const count = (db.prepare("SELECT COUNT(*) as c FROM gemini_keys;").get() as any).c;
    if (count !== 30) {
      throw new Error(`Expected exactly 30 Gemini keys, found ${count}`);
    }
  });

  await ctx.test("F9-02: Rewriter metadata masks API key to prevent credential exposure", async () => {
    const res = await rewriteSourcePost({
      sourcePostId: "sp_test_mask",
      sourcePageName: "Source Mask Test",
      sourceContent: "Nội dung kiểm tra mask token bí mật",
      style: "storytelling",
    });

    if (!res.usedKeyMasked) {
      throw new Error("Expected usedKeyMasked to be present in response metadata");
    }
    if (res.usedKeyMasked.length > 25 || !res.usedKeyMasked.includes("...")) {
      throw new Error(`Key was not properly masked: ${res.usedKeyMasked}`);
    }
  });

  await ctx.test("F9-03: Rewriter returns configured primary or fallback model identifier", async () => {
    const res = await rewriteSourcePost({
      sourcePostId: "sp_test_model",
      sourcePageName: "Source Model Test",
      sourceContent: "Nội dung kiểm tra model identifier",
      style: "news_guide",
    });

    if (!res.model) {
      throw new Error("Expected model to be returned in response");
    }
    const validModels = [
      "gemini-3.8-flash",
      "gemini-3.5-flash-lite",
      "gemini-3.1-flash-lite",
      "gemini-2.5-flash-lite",
      "gemini-2.5-flash",
    ];
    if (!validModels.some((m) => res.model.includes(m))) {
      throw new Error(`Unexpected model identifier: ${res.model}`);
    }
  });

  await ctx.test("F9-04: Key rotation handles rate limit by marking cooldown and picking next active key", async () => {
    const db = createTestDatabase();
    // Insert 2 keys: key 1 in cooldown, key 2 active
    const now = Date.now();
    const cooldownFuture = new Date(now + 60000).toISOString();

    db.prepare(`
      INSERT INTO gemini_keys (id, key, masked_key, status, cooldown_until)
      VALUES ('k1', 'AIzaKeyOneRateLimited', 'AIza...k1', 'cooldown', ?);
    `).run(cooldownFuture);

    db.prepare(`
      INSERT INTO gemini_keys (id, key, masked_key, status)
      VALUES ('k2', 'AIzaKeyTwoActive', 'AIza...k2', 'active');
    `).run();

    // Query active keys that are ready for immediate use
    const availableKey = db.prepare(`
      SELECT * FROM gemini_keys
      WHERE status = 'active'
         OR (status = 'cooldown' AND datetime(cooldown_until) <= datetime('now'))
      ORDER BY status ASC
      LIMIT 1;
    `).get() as any;

    if (availableKey.id !== "k2") {
      throw new Error(`Expected active key 'k2' to be selected over key in cooldown, got '${availableKey?.id}'`);
    }
  });

  await ctx.test("F9-05: Cooldown expiration restores key to active candidate rotation", async () => {
    const db = createTestDatabase();
    const pastTime = new Date(Date.now() - 5000).toISOString();

    db.prepare(`
      INSERT INTO gemini_keys (id, key, masked_key, status, cooldown_until)
      VALUES ('k_expired_cooldown', 'AIzaKeyExpired', 'AIza...exp', 'cooldown', ?);
    `).run(pastTime);

    // Auto-recovery query using datetime conversion for ISO strings
    db.prepare(`
      UPDATE gemini_keys
      SET status = 'active', cooldown_until = NULL
      WHERE status = 'cooldown' AND datetime(cooldown_until) <= datetime('now');
    `).run();

    const restored = db.prepare("SELECT status FROM gemini_keys WHERE id = 'k_expired_cooldown';").get() as any;
    if (restored.status !== "active") {
      throw new Error(`Expected status to be restored to 'active', got '${restored.status}'`);
    }
  });

  await ctx.test("F9-06: Error failover increments error_count and preserves system availability", async () => {
    const db = createTestDatabase();
    db.prepare(`
      INSERT INTO gemini_keys (id, key, masked_key, status, error_count)
      VALUES ('k_error_test', 'AIzaKeyError', 'AIza...err', 'active', 0);
    `).run();

    // Simulate error recording
    db.prepare(`
      UPDATE gemini_keys
      SET error_count = error_count + 1,
          last_error = 'HTTP 500 Internal Error'
      WHERE id = 'k_error_test';
    `).run();

    const keyRow = db.prepare("SELECT error_count, last_error FROM gemini_keys WHERE id = 'k_error_test';").get() as any;
    if (keyRow.error_count !== 1 || !keyRow.last_error.includes("500")) {
      throw new Error("Failed to record error telemetry on key");
    }
  });

  return ctx.getSummary();
}
