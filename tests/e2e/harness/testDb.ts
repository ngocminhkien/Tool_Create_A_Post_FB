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

    -- R1: Bounded Context: Target Pages & Source Pages
    CREATE TABLE IF NOT EXISTS target_pages (
      id TEXT PRIMARY KEY,
      page_id TEXT NOT NULL UNIQUE,
      page_name TEXT NOT NULL,
      access_token TEXT NOT NULL,
      avatar_url TEXT DEFAULT '',
      is_default INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS source_pages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      page_id TEXT DEFAULT '',
      input_mode TEXT NOT NULL DEFAULT 'url_scrape',
      access_token TEXT DEFAULT '',
      avatar_url TEXT DEFAULT '',
      scan_post_limit INTEGER DEFAULT 5,
      status TEXT NOT NULL DEFAULT 'active',
      last_scanned_at TEXT,
      last_error TEXT DEFAULT '',
      total_posts_scanned INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- R2: Source Posts & Deduplication
    CREATE TABLE IF NOT EXISTS source_posts (
      id TEXT PRIMARY KEY,
      source_page_id TEXT NOT NULL,
      facebook_post_id TEXT NOT NULL UNIQUE,
      content_hash TEXT NOT NULL,
      original_content TEXT NOT NULL,
      media_urls TEXT DEFAULT '[]',
      original_media_urls TEXT DEFAULT '[]',
      published_time TEXT NOT NULL,
      like_count INTEGER DEFAULT 0,
      comment_count INTEGER DEFAULT 0,
      share_count INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'collected',
      collected_at TEXT DEFAULT (datetime('now')),
      evergreen_selected_at TEXT,
      rewritten_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_source_posts_fb_id ON source_posts(facebook_post_id);
    CREATE INDEX IF NOT EXISTS idx_source_posts_content_hash ON source_posts(content_hash);
    CREATE INDEX IF NOT EXISTS idx_source_posts_page_pub ON source_posts(source_page_id, published_time DESC);

    -- R3 & R4: Moderation Queue
    CREATE TABLE IF NOT EXISTS moderation_queue (
      id TEXT PRIMARY KEY,
      source_post_id TEXT,
      source_page_id TEXT,
      source_page_name TEXT DEFAULT '',
      source_url TEXT DEFAULT '',
      source_published_time TEXT,
      source_content TEXT NOT NULL,
      source_images_json TEXT DEFAULT '[]',
      target_page_id TEXT DEFAULT '',
      target_page_name TEXT DEFAULT '',
      ai_headline TEXT DEFAULT '',
      ai_hook TEXT DEFAULT '',
      ai_body TEXT DEFAULT '',
      ai_full_post TEXT NOT NULL,
      content_style TEXT DEFAULT 'storytelling',
      selected_images_json TEXT DEFAULT '[]',
      alt_text TEXT DEFAULT '',
      image_caption TEXT DEFAULT '',
      seo_score INTEGER DEFAULT 0,
      seo_breakdown_json TEXT DEFAULT '{}',
      policy_status TEXT DEFAULT 'clean',
      policy_warnings_json TEXT DEFAULT '[]',
      hashtags_json TEXT DEFAULT '[]',
      status TEXT DEFAULT 'pending',
      scheduled_at TEXT,
      published_at TEXT,
      fb_post_id TEXT,
      fb_post_url TEXT,
      error_message TEXT,
      rewrite_count INTEGER DEFAULT 1,
      last_rewrite_prompt TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_mod_queue_status ON moderation_queue(status);
    CREATE INDEX IF NOT EXISTS idx_mod_queue_source_post ON moderation_queue(source_post_id);
  `);

  return db;
}
