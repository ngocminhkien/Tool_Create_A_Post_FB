/**
 * tests/e2e/harness/testDb.ts
 * Isolated in-memory SQLite database harness for opaque-box testing.
 * Guarantees ZERO side-effects on production data/app.db.
 */

import { DatabaseSync } from "node:sqlite";

/**
 * Creates a freshly initialized in-memory SQLite database with original tables.
 */
export function createTestDatabase(): DatabaseSync {
  const db = new DatabaseSync(":memory:");

  // Set standard WAL pragma
  db.exec("PRAGMA foreign_keys = ON;");

  // Create baseline tables matching production
  db.exec(`
    CREATE TABLE IF NOT EXISTS topics (
      id TEXT PRIMARY KEY,
      row_index INTEGER NOT NULL,
      title TEXT NOT NULL,
      entity TEXT,
      info1 TEXT DEFAULT '',
      info2 TEXT DEFAULT '',
      info3 TEXT DEFAULT '',
      info4 TEXT DEFAULT '',
      prompt1 TEXT DEFAULT '',
      prompt2 TEXT DEFAULT '',
      prompt3 TEXT DEFAULT '',
      prompt4 TEXT DEFAULT '',
      image_url TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sheet_config (
      id TEXT PRIMARY KEY DEFAULT 'active',
      sheet_url TEXT DEFAULT '',
      sheet_name TEXT DEFAULT '',
      last_synced_at TEXT,
      use_sample_data INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS gemini_keys (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      masked_key TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      success_count INTEGER DEFAULT 0,
      error_count INTEGER DEFAULT 0,
      rate_limit_count INTEGER DEFAULT 0,
      last_used_at TEXT,
      cooldown_until TEXT,
      last_error TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS facebook_config (
      id TEXT PRIMARY KEY DEFAULT 'active',
      page_id TEXT DEFAULT '',
      page_name TEXT DEFAULT '',
      access_token TEXT DEFAULT '',
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS facebook_posts (
      id TEXT PRIMARY KEY,
      topic_title TEXT NOT NULL,
      hook TEXT DEFAULT '',
      content TEXT NOT NULL,
      image_url TEXT,
      image_base64 TEXT,
      status TEXT NOT NULL,
      fb_post_id TEXT,
      fb_post_url TEXT,
      error_message TEXT,
      mode_used TEXT,
      published_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ai_images (
      id TEXT PRIMARY KEY,
      topic_title TEXT,
      entity TEXT,
      prompt TEXT NOT NULL,
      style TEXT,
      image_url TEXT NOT NULL,
      image_base64 TEXT,
      provider TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  return db;
}
