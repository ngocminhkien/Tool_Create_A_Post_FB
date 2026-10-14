import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";
import { SheetSyncConfig, TopicRow } from "@/types/sheet.types";
import { GeminiKeyItem, AiImageRecord } from "@/types/ai.types";
import { FacebookPageConfig, PostHistoryItem } from "@/types/facebook.types";
import {
  TargetPageItem,
  SourcePageItem,
  PageStatus,
  SourcePageInputMode,
} from "@/types/sourcePage.types";
import {
  SourcePostItem,
  SourcePostStatus,
  EvergreenCandidate,
  ModerationQueueItem,
  ModerationStatus,
} from "@/types/sourcePost.types";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "app.db");

let dbInstance: DatabaseSync | null = null;

interface ColumnDefinition {
  name: string;
  sql: string;
}

const FACEBOOK_POSTS_NEW_COLUMNS: ColumnDefinition[] = [
  { name: "scheduled_at", sql: "scheduled_at TEXT" },
  { name: "seo_score", sql: "seo_score INTEGER DEFAULT 0" },
  { name: "seo_breakdown", sql: "seo_breakdown TEXT DEFAULT ''" },
  { name: "policy_warnings", sql: "policy_warnings TEXT DEFAULT ''" },
  { name: "policy_status", sql: "policy_status TEXT DEFAULT 'clean'" },
  { name: "hashtags", sql: "hashtags TEXT DEFAULT ''" },
  { name: "alt_text", sql: "alt_text TEXT DEFAULT ''" },
  { name: "image_caption", sql: "image_caption TEXT DEFAULT ''" },
  { name: "content_style", sql: "content_style TEXT DEFAULT 'standard'" },
  { name: "variations_json", sql: "variations_json TEXT DEFAULT ''" },
];

const AI_IMAGES_NEW_COLUMNS: ColumnDefinition[] = [
  { name: "alt_text", sql: "alt_text TEXT DEFAULT ''" },
  { name: "caption", sql: "caption TEXT DEFAULT ''" },
];

/**
 * Dynamic migration function that safely alters existing tables in data/app.db
 * adding missing columns idempotently using PRAGMA table_info inspection.
 */
export function runMigrations(db: DatabaseSync): void {
  try {
    const postTableExists = Boolean(
      db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'facebook_posts' LIMIT 1").get()
    );
    if (postTableExists) {
      const rawPostCols = db.prepare("PRAGMA table_info(facebook_posts);").all() as Array<{ name: string }>;
      const existingPostCols = new Set(rawPostCols.map((c) => String(c.name)));

      for (const col of FACEBOOK_POSTS_NEW_COLUMNS) {
        if (!existingPostCols.has(col.name)) {
          db.exec(`ALTER TABLE facebook_posts ADD COLUMN ${col.sql};`);
        }
      }
    }
  } catch (err) {
    console.warn("Lỗi dynamic migration facebook_posts:", err);
  }

  try {
    const imgTableExists = Boolean(
      db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'ai_images' LIMIT 1").get()
    );
    if (imgTableExists) {
      const rawImgCols = db.prepare("PRAGMA table_info(ai_images);").all() as Array<{ name: string }>;
      const existingImgCols = new Set(rawImgCols.map((c) => String(c.name)));

      for (const col of AI_IMAGES_NEW_COLUMNS) {
        if (!existingImgCols.has(col.name)) {
          db.exec(`ALTER TABLE ai_images ADD COLUMN ${col.sql};`);
        }
      }
    }
  } catch (err) {
    console.warn("Lỗi dynamic migration ai_images:", err);
  }

  // Requirement R1: Bounded context Target Pages vs Source Pages
  try {
    db.exec(`
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

      CREATE TABLE IF NOT EXISTS source_posts (
        id TEXT PRIMARY KEY,
        source_page_id TEXT NOT NULL REFERENCES source_pages(id) ON DELETE CASCADE,
        facebook_post_id TEXT NOT NULL UNIQUE,
        content_hash TEXT NOT NULL,
        original_content TEXT NOT NULL,
        media_urls TEXT DEFAULT '[]',
        original_media_urls TEXT DEFAULT '[]',
        post_url TEXT DEFAULT '',
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

      CREATE INDEX IF NOT EXISTS idx_source_posts_fb_id ON source_posts(facebook_post_id);
      CREATE INDEX IF NOT EXISTS idx_source_posts_content_hash ON source_posts(content_hash);
      CREATE INDEX IF NOT EXISTS idx_source_posts_published ON source_posts(source_page_id, published_time);

      CREATE TABLE IF NOT EXISTS moderation_queue (
        id TEXT PRIMARY KEY,
        source_post_id TEXT REFERENCES source_posts(id) ON DELETE SET NULL,
        source_page_id TEXT DEFAULT '',
        source_page_name TEXT NOT NULL,
        source_url TEXT DEFAULT '',
        source_published_time TEXT,
        source_content TEXT NOT NULL,
        source_images TEXT DEFAULT '[]',
        target_page_id TEXT DEFAULT '',
        target_page_name TEXT DEFAULT '',
        ai_headline TEXT DEFAULT '',
        ai_hook TEXT DEFAULT '',
        ai_body TEXT DEFAULT '',
        ai_full_post TEXT NOT NULL,
        content_style TEXT DEFAULT 'storytelling',
        selected_images TEXT DEFAULT '[]',
        alt_text TEXT DEFAULT '',
        image_caption TEXT DEFAULT '',
        seo_score INTEGER DEFAULT 0,
        seo_breakdown TEXT DEFAULT '',
        policy_status TEXT DEFAULT 'clean',
        policy_warnings TEXT DEFAULT '[]',
        hashtags TEXT DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'pending',
        scheduled_at TEXT,
        published_at TEXT,
        fb_post_id TEXT,
        fb_post_url TEXT,
        error_message TEXT,
        rewrite_count INTEGER DEFAULT 1,
        last_rewrite_prompt TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_moderation_queue_status ON moderation_queue(status);
    `);

    // Safe dynamic migration for extra moderation_queue columns
    const rawQueueCols = db.prepare("PRAGMA table_info(moderation_queue);").all() as Array<{ name: string }>;
    const existingQueueCols = new Set(rawQueueCols.map((c) => String(c.name)));
    const extraQueueCols: ColumnDefinition[] = [
      { name: "ai_conclusion", sql: "ai_conclusion TEXT DEFAULT ''" },
      { name: "original_word_count", sql: "original_word_count INTEGER DEFAULT 0" },
      { name: "repurposed_word_count", sql: "repurposed_word_count INTEGER DEFAULT 0" },
      { name: "compression_rate", sql: "compression_rate REAL DEFAULT 0" },
      { name: "extracted_points", sql: "extracted_points TEXT DEFAULT '[]'" },
    ];
    for (const col of extraQueueCols) {
      if (!existingQueueCols.has(col.name)) {
        db.exec(`ALTER TABLE moderation_queue ADD COLUMN ${col.sql};`);
      }
    }
  } catch (err) {
    console.warn("Lỗi dynamic migration R1 bounded context tables:", err);
  }
}

/**
 * Initializes and returns the singleton SQLite database instance.
 * Sets WAL mode for concurrent, atomic read/writes.
 */
export function getDb(): DatabaseSync {
  if (dbInstance) return dbInstance;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const db = new DatabaseSync(DB_PATH);

  // High performance PRAGMAs
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");

  // Create tables if not exist
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
      scheduled_at TEXT,
      seo_score INTEGER DEFAULT 0,
      seo_breakdown TEXT DEFAULT '',
      policy_warnings TEXT DEFAULT '',
      policy_status TEXT DEFAULT 'clean',
      hashtags TEXT DEFAULT '',
      alt_text TEXT DEFAULT '',
      image_caption TEXT DEFAULT '',
      content_style TEXT DEFAULT 'standard',
      variations_json TEXT DEFAULT '',
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
      alt_text TEXT DEFAULT '',
      caption TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  dbInstance = db;
  runMigrations(db);
  migrateInitialData(db);
  return dbInstance;
}

/**
 * Automatically migrates existing JSON files into the SQLite database if tables are empty.
 */
function migrateInitialData(db: DatabaseSync) {
  try {
    // 1. Migrate Sheet Cache
    const sheetCachePath = path.join(DATA_DIR, "sheets-cache.json");
    if (fs.existsSync(sheetCachePath)) {
      const topicCount = db.prepare("SELECT COUNT(*) as count FROM topics").get() as { count: number };
      if (topicCount.count === 0) {
        const raw = fs.readFileSync(sheetCachePath, "utf-8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.rows) && parsed.rows.length > 0) {
          saveTopics(parsed.rows);
        }
        if (parsed.config) {
          saveSheetConfig(parsed.config);
        }
      }
    }

    // 2. Migrate Gemini Keys
    const keysJsonPath = path.join(DATA_DIR, "gemini-keys.json");
    if (fs.existsSync(keysJsonPath)) {
      const keyCount = db.prepare("SELECT COUNT(*) as count FROM gemini_keys").get() as { count: number };
      if (keyCount.count === 0) {
        const raw = fs.readFileSync(keysJsonPath, "utf-8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.keys) && parsed.keys.length > 0) {
          saveKeys(parsed.keys);
        }
      }
    }

    // 3. Migrate Facebook Config
    const fbConfigPath = path.join(DATA_DIR, "fb-config.json");
    if (fs.existsSync(fbConfigPath)) {
      const cfgRow = db.prepare("SELECT page_id FROM facebook_config WHERE id = 'active'").get();
      if (!cfgRow) {
        const raw = fs.readFileSync(fbConfigPath, "utf-8");
        const parsed = JSON.parse(raw);
        saveFbConfig(parsed);
      }
    }

    // 4. Migrate Facebook Publish History
    const historyPath = path.join(DATA_DIR, "publish-history.json");
    if (fs.existsSync(historyPath)) {
      const postCount = db.prepare("SELECT COUNT(*) as count FROM facebook_posts").get() as { count: number };
      if (postCount.count === 0) {
        const raw = fs.readFileSync(historyPath, "utf-8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            savePost(item);
          }
        }
      }
    }

    // 5. Migrate Target Pages from facebook_config
    const targetCount = db.prepare("SELECT COUNT(*) as count FROM target_pages").get() as { count: number };
    if (targetCount.count === 0) {
      const fbCfg = db.prepare("SELECT page_id, page_name, access_token FROM facebook_config WHERE id = 'active'").get() as Record<string, unknown> | undefined;
      if (fbCfg && fbCfg.page_id && String(fbCfg.page_id).trim()) {
        db.prepare(`
          INSERT INTO target_pages (id, page_id, page_name, access_token, is_default, status, created_at, updated_at)
          VALUES ('target_default', ?, ?, ?, 1, 'active', datetime('now'), datetime('now'))
        `).run(
          String(fbCfg.page_id).trim(),
          String(fbCfg.page_name || "Facebook Fanpage").trim(),
          String(fbCfg.access_token || "").trim()
        );
      }
    }
  } catch (err) {
    console.warn("Lưu ý migration SQLite:", err);
  }
}

// ============================================================================
// TOPICS & SHEET REPOSITORY
// ============================================================================

export function getAllTopics(): TopicRow[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT 
      id, row_index as rowIndex, title, entity,
      info1, info2, info3, info4,
      prompt1, prompt2, prompt3, prompt4,
      image_url as imageUrl
    FROM topics 
    ORDER BY row_index ASC, id ASC
  `).all();

  return rows.map((r) => ({
    id: String(r.id),
    rowIndex: Number(r.rowIndex),
    title: String(r.title || ""),
    entity: r.entity ? String(r.entity) : undefined,
    info1: String(r.info1 || ""),
    info2: String(r.info2 || ""),
    info3: String(r.info3 || ""),
    info4: String(r.info4 || ""),
    prompt1: String(r.prompt1 || ""),
    prompt2: String(r.prompt2 || ""),
    prompt3: String(r.prompt3 || ""),
    prompt4: String(r.prompt4 || ""),
    imageUrl: r.imageUrl ? String(r.imageUrl) : undefined,
  }));
}

export function saveTopics(topics: TopicRow[]): void {
  const db = getDb();
  db.exec("BEGIN TRANSACTION;");
  try {
    db.exec("DELETE FROM topics;");
    const stmt = db.prepare(`
      INSERT INTO topics (
        id, row_index, title, entity,
        info1, info2, info3, info4,
        prompt1, prompt2, prompt3, prompt4,
        image_url, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    for (const t of topics) {
      stmt.run(
        t.id,
        t.rowIndex,
        t.title,
        t.entity || null,
        t.info1 || "",
        t.info2 || "",
        t.info3 || "",
        t.info4 || "",
        t.prompt1 || "",
        t.prompt2 || "",
        t.prompt3 || "",
        t.prompt4 || "",
        t.imageUrl || null
      );
    }
    db.exec("COMMIT;");
  } catch (err) {
    db.exec("ROLLBACK;");
    throw err;
  }
}

export function upsertTopic(topic: TopicRow): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO topics (
      id, row_index, title, entity,
      info1, info2, info3, info4,
      prompt1, prompt2, prompt3, prompt4,
      image_url, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      row_index = excluded.row_index,
      title = excluded.title,
      entity = excluded.entity,
      info1 = excluded.info1,
      info2 = excluded.info2,
      info3 = excluded.info3,
      info4 = excluded.info4,
      prompt1 = excluded.prompt1,
      prompt2 = excluded.prompt2,
      prompt3 = excluded.prompt3,
      prompt4 = excluded.prompt4,
      image_url = excluded.image_url,
      updated_at = datetime('now')
  `);

  stmt.run(
    topic.id,
    topic.rowIndex,
    topic.title,
    topic.entity || null,
    topic.info1 || "",
    topic.info2 || "",
    topic.info3 || "",
    topic.info4 || "",
    topic.prompt1 || "",
    topic.prompt2 || "",
    topic.prompt3 || "",
    topic.prompt4 || "",
    topic.imageUrl || null
  );
}

export function deleteTopic(id: string): void {
  const db = getDb();
  db.prepare("DELETE FROM topics WHERE id = ?").run(id);
}

export function clearTopics(): void {
  const db = getDb();
  db.exec("DELETE FROM topics;");
}

export function getSheetConfig(): SheetSyncConfig {
  const db = getDb();
  const row = db.prepare("SELECT * FROM sheet_config WHERE id = 'active'").get() as Record<string, unknown> | undefined;
  if (!row) {
    return {
      sheetUrl: "",
      useSampleData: false,
    };
  }

  return {
    sheetUrl: String(row.sheet_url || ""),
    sheetName: row.sheet_name ? String(row.sheet_name) : undefined,
    lastSyncedAt: row.last_synced_at ? String(row.last_synced_at) : undefined,
    useSampleData: Boolean(row.use_sample_data),
  };
}

export function saveSheetConfig(config: SheetSyncConfig): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO sheet_config (id, sheet_url, sheet_name, last_synced_at, use_sample_data, updated_at)
    VALUES ('active', ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      sheet_url = excluded.sheet_url,
      sheet_name = excluded.sheet_name,
      last_synced_at = excluded.last_synced_at,
      use_sample_data = excluded.use_sample_data,
      updated_at = datetime('now')
  `).run(
    config.sheetUrl || "",
    config.sheetName || "",
    config.lastSyncedAt || null,
    config.useSampleData ? 1 : 0
  );
}

// ============================================================================
// GEMINI KEYS REPOSITORY
// ============================================================================

export function getAllKeys(): GeminiKeyItem[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT 
      id, key, masked_key as maskedKey, status,
      success_count as successCount, error_count as errorCount, rate_limit_count as rateLimitCount,
      last_used_at as lastUsedAt, cooldown_until as cooldownUntil, last_error as lastError
    FROM gemini_keys
    ORDER BY id ASC
  `).all();

  return rows.map((r) => ({
    id: String(r.id),
    key: String(r.key),
    maskedKey: String(r.maskedKey),
    status: r.status as GeminiKeyItem["status"],
    successCount: Number(r.successCount || 0),
    errorCount: Number(r.errorCount || 0),
    rateLimitCount: Number(r.rateLimitCount || 0),
    lastUsedAt: r.lastUsedAt ? String(r.lastUsedAt) : null,
    cooldownUntil: r.cooldownUntil ? String(r.cooldownUntil) : null,
    lastError: r.lastError ? String(r.lastError) : null,
  }));
}

export function saveKeys(keys: GeminiKeyItem[]): void {
  const db = getDb();
  db.exec("BEGIN TRANSACTION;");
  try {
    const stmt = db.prepare(`
      INSERT INTO gemini_keys (
        id, key, masked_key, status,
        success_count, error_count, rate_limit_count,
        last_used_at, cooldown_until, last_error, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET
        status = excluded.status,
        success_count = excluded.success_count,
        error_count = excluded.error_count,
        rate_limit_count = excluded.rate_limit_count,
        last_used_at = excluded.last_used_at,
        cooldown_until = excluded.cooldown_until,
        last_error = excluded.last_error,
        updated_at = datetime('now')
    `);

    for (const k of keys) {
      stmt.run(
        k.id,
        k.key,
        k.maskedKey,
        k.status,
        k.successCount,
        k.errorCount,
        k.rateLimitCount,
        k.lastUsedAt,
        k.cooldownUntil,
        k.lastError
      );
    }
    db.exec("COMMIT;");
  } catch (err) {
    db.exec("ROLLBACK;");
    throw err;
  }
}

// ============================================================================
// FACEBOOK CONFIG REPOSITORY
// ============================================================================

export function getFbConfig(): FacebookPageConfig {
  const db = getDb();
  const row = db.prepare("SELECT page_id, page_name, access_token FROM facebook_config WHERE id = 'active'").get() as Record<string, unknown> | undefined;
  if (!row) {
    return {
      pageId: "",
      pageName: "Facebook Fanpage",
      pageAccessToken: "",
    };
  }

  return {
    pageId: String(row.page_id || ""),
    pageName: String(row.page_name || "Facebook Fanpage"),
    pageAccessToken: String(row.access_token || ""),
  };
}

export function saveFbConfig(config: Partial<FacebookPageConfig>): void {
  const db = getDb();
  const pageId = config.pageId?.trim() || "";
  const pageName = config.pageName?.trim() || (pageId ? "Facebook Fanpage" : "");
  const accessToken = config.pageAccessToken?.trim() || "";

  db.exec("BEGIN TRANSACTION;");
  try {
    db.prepare(`
      INSERT INTO facebook_config (id, page_id, page_name, access_token, updated_at)
      VALUES ('active', ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        page_id = excluded.page_id,
        page_name = excluded.page_name,
        access_token = excluded.access_token,
        updated_at = datetime('now')
    `).run(pageId, pageName, accessToken);

    // Sync to target_pages if pageId provided
    if (pageId) {
      // 1. Clear any other default target pages
      db.prepare("UPDATE target_pages SET is_default = 0 WHERE page_id <> ?").run(pageId);

      // 2. Inspect existing page to preserve richer attributes if incoming config is partial
      const existing = db.prepare("SELECT id, page_name, access_token FROM target_pages WHERE page_id = ?").get(pageId) as { id: string; page_name: string; access_token: string } | undefined;
      const targetId = existing?.id || `tp_${Date.now()}`;
      const finalName = pageName !== "Facebook Fanpage" && pageName !== "" ? pageName : (existing?.page_name || pageName || "Facebook Fanpage");
      const finalToken = accessToken !== "" ? accessToken : (existing?.access_token || "");

      db.prepare(`
        INSERT INTO target_pages (id, page_id, page_name, access_token, is_default, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, 1, 'active', datetime('now'), datetime('now'))
        ON CONFLICT(page_id) DO UPDATE SET
          page_name = excluded.page_name,
          access_token = excluded.access_token,
          is_default = 1,
          status = 'active',
          updated_at = datetime('now')
      `).run(
        targetId,
        pageId,
        finalName,
        finalToken
      );

      // 3. Keep facebook_config in sync with final resolved credentials
      if (finalName !== pageName || finalToken !== accessToken) {
        db.prepare(`
          UPDATE facebook_config SET page_name = ?, access_token = ?, updated_at = datetime('now') WHERE id = 'active'
        `).run(finalName, finalToken);
      }
    }
    db.exec("COMMIT;");
  } catch (err) {
    db.exec("ROLLBACK;");
    throw err;
  }
}

// ============================================================================
// TARGET PAGES REPOSITORY (Bounded Context: Owned Pages with Publishing Rights)
// ============================================================================

export function getTargetPages(): TargetPageItem[] {
  const db = getDb();
  let rows = db.prepare(`
    SELECT id, page_id as pageId, page_name as pageName, access_token as accessToken,
           avatar_url as avatarUrl, is_default as isDefault, status,
           created_at as createdAt, updated_at as updatedAt
    FROM target_pages
    ORDER BY is_default DESC, created_at DESC
  `).all() as Record<string, unknown>[];

  // Backward compatibility: If target_pages is empty, auto-seed from active facebook_config
  if (rows.length === 0) {
    const fbCfg = db.prepare("SELECT page_id, page_name, access_token FROM facebook_config WHERE id = 'active'").get() as Record<string, unknown> | undefined;
    if (fbCfg && fbCfg.page_id && String(fbCfg.page_id).trim()) {
      db.prepare(`
        INSERT INTO target_pages (id, page_id, page_name, access_token, is_default, status, created_at, updated_at)
        VALUES ('target_default', ?, ?, ?, 1, 'active', datetime('now'), datetime('now'))
        ON CONFLICT(page_id) DO NOTHING
      `).run(
        String(fbCfg.page_id).trim(),
        String(fbCfg.page_name || "Facebook Fanpage").trim(),
        String(fbCfg.access_token || "").trim()
      );

      rows = db.prepare(`
        SELECT id, page_id as pageId, page_name as pageName, access_token as accessToken,
               avatar_url as avatarUrl, is_default as isDefault, status,
               created_at as createdAt, updated_at as updatedAt
        FROM target_pages
        ORDER BY is_default DESC, created_at DESC
      `).all() as Record<string, unknown>[];
    }
  }

  return rows.map((r) => ({
    id: String(r.id),
    pageId: String(r.pageId),
    pageName: String(r.pageName),
    accessToken: String(r.accessToken),
    avatarUrl: r.avatarUrl ? String(r.avatarUrl) : undefined,
    isDefault: Boolean(r.isDefault),
    status: (r.status as PageStatus) || "active",
    createdAt: String(r.createdAt || new Date().toISOString()),
    updatedAt: String(r.updatedAt || new Date().toISOString()),
  }));
}

export function getTargetPageById(id: string): TargetPageItem | null {
  const db = getDb();
  const r = db.prepare(`
    SELECT id, page_id as pageId, page_name as pageName, access_token as accessToken,
           avatar_url as avatarUrl, is_default as isDefault, status,
           created_at as createdAt, updated_at as updatedAt
    FROM target_pages
    WHERE id = ?
  `).get(id) as Record<string, unknown> | undefined;

  if (!r) return null;
  return {
    id: String(r.id),
    pageId: String(r.pageId),
    pageName: String(r.pageName),
    accessToken: String(r.accessToken),
    avatarUrl: r.avatarUrl ? String(r.avatarUrl) : undefined,
    isDefault: Boolean(r.isDefault),
    status: (r.status as PageStatus) || "active",
    createdAt: String(r.createdAt || new Date().toISOString()),
    updatedAt: String(r.updatedAt || new Date().toISOString()),
  };
}

export function getTargetPageByPageId(pageId: string): TargetPageItem | null {
  const db = getDb();
  const r = db.prepare(`
    SELECT id, page_id as pageId, page_name as pageName, access_token as accessToken,
           avatar_url as avatarUrl, is_default as isDefault, status,
           created_at as createdAt, updated_at as updatedAt
    FROM target_pages
    WHERE page_id = ?
  `).get(pageId) as Record<string, unknown> | undefined;

  if (!r) return null;
  return {
    id: String(r.id),
    pageId: String(r.pageId),
    pageName: String(r.pageName),
    accessToken: String(r.accessToken),
    avatarUrl: r.avatarUrl ? String(r.avatarUrl) : undefined,
    isDefault: Boolean(r.isDefault),
    status: (r.status as PageStatus) || "active",
    createdAt: String(r.createdAt || new Date().toISOString()),
    updatedAt: String(r.updatedAt || new Date().toISOString()),
  };
}

export function getDefaultTargetPage(): TargetPageItem | null {
  const db = getDb();
  const r = db.prepare(`
    SELECT id, page_id as pageId, page_name as pageName, access_token as accessToken,
           avatar_url as avatarUrl, is_default as isDefault, status,
           created_at as createdAt, updated_at as updatedAt
    FROM target_pages
    WHERE is_default = 1
    LIMIT 1
  `).get() as Record<string, unknown> | undefined;

  if (!r) {
    const list = getTargetPages();
    return list.length > 0 ? list[0] : null;
  }

  return {
    id: String(r.id),
    pageId: String(r.pageId),
    pageName: String(r.pageName),
    accessToken: String(r.accessToken),
    avatarUrl: r.avatarUrl ? String(r.avatarUrl) : undefined,
    isDefault: Boolean(r.isDefault),
    status: (r.status as PageStatus) || "active",
    createdAt: String(r.createdAt || new Date().toISOString()),
    updatedAt: String(r.updatedAt || new Date().toISOString()),
  };
}

export function saveTargetPage(page: Partial<TargetPageItem> & { pageId: string; pageName: string; accessToken: string }): TargetPageItem {
  const db = getDb();
  const id = page.id || `tp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const avatarUrl = page.avatarUrl || "";
  const status = page.status || "active";

  const countRow = db.prepare("SELECT COUNT(*) as c FROM target_pages").get() as { c: number };
  const shouldBeDefault = page.isDefault === true || countRow.c === 0;

  if (shouldBeDefault) {
    db.prepare("UPDATE target_pages SET is_default = 0").run();
  }

  db.prepare(`
    INSERT INTO target_pages (id, page_id, page_name, access_token, avatar_url, is_default, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(page_id) DO UPDATE SET
      page_name = excluded.page_name,
      access_token = excluded.access_token,
      avatar_url = CASE WHEN excluded.avatar_url <> '' THEN excluded.avatar_url ELSE target_pages.avatar_url END,
      is_default = CASE WHEN excluded.is_default = 1 THEN 1 ELSE target_pages.is_default END,
      status = excluded.status,
      updated_at = datetime('now')
  `).run(
    id,
    page.pageId.trim(),
    page.pageName.trim(),
    page.accessToken.trim(),
    avatarUrl,
    shouldBeDefault ? 1 : 0,
    status
  );

  // Sync to facebook_config if default
  if (shouldBeDefault) {
    db.prepare(`
      INSERT INTO facebook_config (id, page_id, page_name, access_token, updated_at)
      VALUES ('active', ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        page_id = excluded.page_id,
        page_name = excluded.page_name,
        access_token = excluded.access_token,
        updated_at = datetime('now')
    `).run(page.pageId.trim(), page.pageName.trim(), page.accessToken.trim());
  }

  const saved = getTargetPageByPageId(page.pageId.trim());
  return saved!;
}

export function deleteTargetPage(id: string): boolean {
  const db = getDb();
  const target = getTargetPageById(id);
  if (!target) return false;

  db.exec("BEGIN TRANSACTION;");
  try {
    db.prepare("DELETE FROM target_pages WHERE id = ?").run(id);

    if (target.isDefault) {
      // Elect next page prioritizing: active (1) > paused (2) > token_expired (3) > error (4)
      const next = db.prepare(`
        SELECT id, page_id, page_name, access_token, status
        FROM target_pages
        ORDER BY 
          CASE status
            WHEN 'active' THEN 1
            WHEN 'paused' THEN 2
            WHEN 'token_expired' THEN 3
            ELSE 4
          END ASC,
          created_at DESC
        LIMIT 1
      `).get() as Record<string, unknown> | undefined;

      if (next) {
        db.prepare("UPDATE target_pages SET is_default = 0").run();
        db.prepare("UPDATE target_pages SET is_default = 1 WHERE id = ?").run(String(next.id));
        db.prepare(`
          INSERT INTO facebook_config (id, page_id, page_name, access_token, updated_at)
          VALUES ('active', ?, ?, ?, datetime('now'))
          ON CONFLICT(id) DO UPDATE SET
            page_id = excluded.page_id,
            page_name = excluded.page_name,
            access_token = excluded.access_token,
            updated_at = datetime('now')
        `).run(String(next.page_id), String(next.page_name), String(next.access_token));
      } else {
        db.prepare(`
          INSERT INTO facebook_config (id, page_id, page_name, access_token, updated_at)
          VALUES ('active', '', '', '', datetime('now'))
          ON CONFLICT(id) DO UPDATE SET
            page_id = '',
            page_name = '',
            access_token = '',
            updated_at = datetime('now')
        `).run();
      }
    }
    db.exec("COMMIT;");
    return true;
  } catch (err) {
    db.exec("ROLLBACK;");
    throw err;
  }
}

// ============================================================================
// SOURCE PAGES REPOSITORY (Bounded Context: Monitored Channels, Zero Publishing Rights)
// ============================================================================

export function getSourcePages(): SourcePageItem[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, name, url, page_id as pageId, input_mode as inputMode,
           access_token as accessToken, avatar_url as avatarUrl,
           scan_post_limit as scanPostLimit, status,
           last_scanned_at as lastScannedAt, last_error as lastError,
           total_posts_scanned as totalPostsScanned,
           created_at as createdAt, updated_at as updatedAt
    FROM source_pages
    ORDER BY created_at DESC
  `).all() as Record<string, unknown>[];

  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    url: String(r.url),
    pageId: r.pageId ? String(r.pageId) : undefined,
    inputMode: (r.inputMode as SourcePageInputMode) || "url_scrape",
    accessToken: r.accessToken ? String(r.accessToken) : undefined,
    avatarUrl: r.avatarUrl ? String(r.avatarUrl) : undefined,
    scanPostLimit: Number(r.scanPostLimit) || 5,
    status: (r.status as PageStatus) || "active",
    lastScannedAt: r.lastScannedAt ? String(r.lastScannedAt) : undefined,
    lastError: r.lastError ? String(r.lastError) : undefined,
    totalPostsScanned: Number(r.totalPostsScanned) || 0,
    createdAt: String(r.createdAt || new Date().toISOString()),
    updatedAt: String(r.updatedAt || new Date().toISOString()),
  }));
}

export function getSourcePageById(id: string): SourcePageItem | null {
  const db = getDb();
  const r = db.prepare(`
    SELECT id, name, url, page_id as pageId, input_mode as inputMode,
           access_token as accessToken, avatar_url as avatarUrl,
           scan_post_limit as scanPostLimit, status,
           last_scanned_at as lastScannedAt, last_error as lastError,
           total_posts_scanned as totalPostsScanned,
           created_at as createdAt, updated_at as updatedAt
    FROM source_pages
    WHERE id = ?
  `).get(id) as Record<string, unknown> | undefined;

  if (!r) return null;
  return {
    id: String(r.id),
    name: String(r.name),
    url: String(r.url),
    pageId: r.pageId ? String(r.pageId) : undefined,
    inputMode: (r.inputMode as SourcePageInputMode) || "url_scrape",
    accessToken: r.accessToken ? String(r.accessToken) : undefined,
    avatarUrl: r.avatarUrl ? String(r.avatarUrl) : undefined,
    scanPostLimit: Number(r.scanPostLimit) || 5,
    status: (r.status as PageStatus) || "active",
    lastScannedAt: r.lastScannedAt ? String(r.lastScannedAt) : undefined,
    lastError: r.lastError ? String(r.lastError) : undefined,
    totalPostsScanned: Number(r.totalPostsScanned) || 0,
    createdAt: String(r.createdAt || new Date().toISOString()),
    updatedAt: String(r.updatedAt || new Date().toISOString()),
  };
}

export function getSourcePageByUrl(url: string): SourcePageItem | null {
  const db = getDb();
  const r = db.prepare(`
    SELECT id, name, url, page_id as pageId, input_mode as inputMode,
           access_token as accessToken, avatar_url as avatarUrl,
           scan_post_limit as scanPostLimit, status,
           last_scanned_at as lastScannedAt, last_error as lastError,
           total_posts_scanned as totalPostsScanned,
           created_at as createdAt, updated_at as updatedAt
    FROM source_pages
    WHERE url = ?
  `).get(url) as Record<string, unknown> | undefined;

  if (!r) return null;
  return {
    id: String(r.id),
    name: String(r.name),
    url: String(r.url),
    pageId: r.pageId ? String(r.pageId) : undefined,
    inputMode: (r.inputMode as SourcePageInputMode) || "url_scrape",
    accessToken: r.accessToken ? String(r.accessToken) : undefined,
    avatarUrl: r.avatarUrl ? String(r.avatarUrl) : undefined,
    scanPostLimit: Number(r.scanPostLimit) || 5,
    status: (r.status as PageStatus) || "active",
    lastScannedAt: r.lastScannedAt ? String(r.lastScannedAt) : undefined,
    lastError: r.lastError ? String(r.lastError) : undefined,
    totalPostsScanned: Number(r.totalPostsScanned) || 0,
    createdAt: String(r.createdAt || new Date().toISOString()),
    updatedAt: String(r.updatedAt || new Date().toISOString()),
  };
}

export function saveSourcePage(page: Partial<SourcePageItem> & { name: string; url: string }): SourcePageItem {
  const db = getDb();
  const id = page.id || `sp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const inputMode = page.inputMode || "url_scrape";
  const limit = Math.max(1, Math.min(10, page.scanPostLimit || 5));
  const status = page.status || "active";

  db.prepare(`
    INSERT INTO source_pages (
      id, name, url, page_id, input_mode, access_token, avatar_url,
      scan_post_limit, status, last_scanned_at, last_error, total_posts_scanned,
      created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(url) DO UPDATE SET
      name = excluded.name,
      page_id = excluded.page_id,
      input_mode = excluded.input_mode,
      access_token = excluded.access_token,
      avatar_url = CASE WHEN excluded.avatar_url <> '' THEN excluded.avatar_url ELSE source_pages.avatar_url END,
      scan_post_limit = excluded.scan_post_limit,
      status = excluded.status,
      updated_at = datetime('now')
  `).run(
    id,
    page.name.trim(),
    page.url.trim(),
    page.pageId?.trim() || "",
    inputMode,
    page.accessToken?.trim() || "",
    page.avatarUrl?.trim() || "",
    limit,
    status,
    page.lastScannedAt || null,
    page.lastError || "",
    page.totalPostsScanned || 0
  );

  const saved = getSourcePageByUrl(page.url.trim());
  return saved!;
}

export function deleteSourcePage(id: string): boolean {
  const db = getDb();
  const info = db.prepare("DELETE FROM source_pages WHERE id = ?").run(id);
  return info.changes > 0;
}

export function updateSourcePageScanStatus(
  id: string,
  update: { status?: PageStatus; lastScannedAt?: string; lastError?: string; incrementPosts?: number }
): void {
  const db = getDb();
  const current = getSourcePageById(id);
  if (!current) return;

  const newStatus = update.status || current.status;
  const newLastScanned = update.lastScannedAt || current.lastScannedAt || new Date().toISOString();
  const newLastError = update.lastError !== undefined ? update.lastError : (current.lastError || "");
  const newTotal = current.totalPostsScanned + (update.incrementPosts || 0);

  db.prepare(`
    UPDATE source_pages
    SET status = ?, last_scanned_at = ?, last_error = ?, total_posts_scanned = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(newStatus, newLastScanned, newLastError, newTotal, id);
}

// ============================================================================
// FACEBOOK POSTS & PUBLISH HISTORY REPOSITORY
// ============================================================================

export function getAllPosts(): PostHistoryItem[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT 
      id, topic_title as topicTitle, hook, content,
      image_url as imageUrl, image_base64 as imageBase64,
      status, fb_post_id as fbPostId, fb_post_url as fbPostUrl,
      error_message as errorMessage, mode_used as modeUsed,
      published_at as publishedAt, scheduled_at as scheduledAt,
      seo_score as seoScore, seo_breakdown as seoBreakdown,
      policy_warnings as policyWarnings, policy_status as policyStatus,
      hashtags, alt_text as altText, image_caption as imageCaption,
      content_style as contentStyle, variations_json as variationsJson,
      created_at as createdAt
    FROM facebook_posts
    ORDER BY created_at DESC
  `).all();

  return rows.map((r) => ({
    id: String(r.id),
    topicTitle: String(r.topicTitle),
    hook: String(r.hook || ""),
    finalPost: String(r.content || ""),
    modeUsed: String(r.modeUsed || "modular"),
    imageUrl: r.imageUrl ? String(r.imageUrl) : undefined,
    imageBase64: r.imageBase64 ? String(r.imageBase64) : undefined,
    status: (r.status as PostHistoryItem["status"]) || "draft",
    fbPostId: r.fbPostId ? String(r.fbPostId) : undefined,
    fbPostUrl: r.fbPostUrl ? String(r.fbPostUrl) : undefined,
    errorMessage: r.errorMessage ? String(r.errorMessage) : undefined,
    publishedAt: r.publishedAt ? String(r.publishedAt) : undefined,
    scheduledAt: r.scheduledAt ? String(r.scheduledAt) : undefined,
    seoScore: r.seoScore !== null && r.seoScore !== undefined ? Number(r.seoScore) : 0,
    seoBreakdown: r.seoBreakdown ? String(r.seoBreakdown) : undefined,
    policyWarnings: r.policyWarnings ? String(r.policyWarnings) : undefined,
    policyStatus: r.policyStatus ? String(r.policyStatus) : undefined,
    hashtags: r.hashtags ? String(r.hashtags) : undefined,
    altText: r.altText ? String(r.altText) : undefined,
    imageCaption: r.imageCaption ? String(r.imageCaption) : undefined,
    contentStyle: r.contentStyle ? String(r.contentStyle) : undefined,
    variationsJson: r.variationsJson ? String(r.variationsJson) : undefined,
    createdAt: String(r.createdAt),
  }));
}

export function savePost(item: PostHistoryItem): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO facebook_posts (
      id, topic_title, hook, content,
      image_url, image_base64, status,
      fb_post_id, fb_post_url, error_message,
      mode_used, published_at, scheduled_at,
      seo_score, seo_breakdown,
      policy_warnings, policy_status,
      hashtags, alt_text, image_caption,
      content_style, variations_json,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      topic_title = excluded.topic_title,
      hook = excluded.hook,
      content = excluded.content,
      image_url = excluded.image_url,
      image_base64 = excluded.image_base64,
      status = excluded.status,
      fb_post_id = excluded.fb_post_id,
      fb_post_url = excluded.fb_post_url,
      error_message = excluded.error_message,
      mode_used = excluded.mode_used,
      published_at = excluded.published_at,
      scheduled_at = excluded.scheduled_at,
      seo_score = excluded.seo_score,
      seo_breakdown = excluded.seo_breakdown,
      policy_warnings = excluded.policy_warnings,
      policy_status = excluded.policy_status,
      hashtags = excluded.hashtags,
      alt_text = excluded.alt_text,
      image_caption = excluded.image_caption,
      content_style = excluded.content_style,
      variations_json = excluded.variations_json,
      updated_at = datetime('now')
  `).run(
    item.id,
    item.topicTitle,
    item.hook || "",
    item.finalPost || "",
    item.imageUrl || null,
    item.imageBase64 || null,
    item.status,
    item.fbPostId || null,
    item.fbPostUrl || null,
    item.errorMessage || null,
    item.modeUsed || "modular",
    item.publishedAt || null,
    item.scheduledAt || null,
    item.seoScore ?? 0,
    item.seoBreakdown || "",
    item.policyWarnings || "",
    item.policyStatus || "clean",
    item.hashtags || "",
    item.altText || "",
    item.imageCaption || "",
    item.contentStyle || "standard",
    item.variationsJson || "",
    item.createdAt || new Date().toISOString()
  );
}

export function getPostById(id: string): PostHistoryItem | null {
  const db = getDb();
  const r = db.prepare(`
    SELECT 
      id, topic_title as topicTitle, hook, content,
      image_url as imageUrl, image_base64 as imageBase64,
      status, fb_post_id as fbPostId, fb_post_url as fbPostUrl,
      error_message as errorMessage, mode_used as modeUsed,
      published_at as publishedAt, scheduled_at as scheduledAt,
      seo_score as seoScore, seo_breakdown as seoBreakdown,
      policy_warnings as policyWarnings, policy_status as policyStatus,
      hashtags, alt_text as altText, image_caption as imageCaption,
      content_style as contentStyle, variations_json as variationsJson,
      created_at as createdAt
    FROM facebook_posts
    WHERE id = ?
  `).get(id) as Record<string, unknown> | undefined;

  if (!r) return null;
  return {
    id: String(r.id),
    topicTitle: String(r.topicTitle),
    hook: String(r.hook || ""),
    finalPost: String(r.content || ""),
    modeUsed: String(r.modeUsed || "modular"),
    imageUrl: r.imageUrl ? String(r.imageUrl) : undefined,
    imageBase64: r.imageBase64 ? String(r.imageBase64) : undefined,
    status: (r.status as PostHistoryItem["status"]) || "draft",
    fbPostId: r.fbPostId ? String(r.fbPostId) : undefined,
    fbPostUrl: r.fbPostUrl ? String(r.fbPostUrl) : undefined,
    errorMessage: r.errorMessage ? String(r.errorMessage) : undefined,
    publishedAt: r.publishedAt ? String(r.publishedAt) : undefined,
    scheduledAt: r.scheduledAt ? String(r.scheduledAt) : undefined,
    seoScore: r.seoScore !== null && r.seoScore !== undefined ? Number(r.seoScore) : 0,
    seoBreakdown: r.seoBreakdown ? String(r.seoBreakdown) : undefined,
    policyWarnings: r.policyWarnings ? String(r.policyWarnings) : undefined,
    policyStatus: r.policyStatus ? String(r.policyStatus) : undefined,
    hashtags: r.hashtags ? String(r.hashtags) : undefined,
    altText: r.altText ? String(r.altText) : undefined,
    imageCaption: r.imageCaption ? String(r.imageCaption) : undefined,
    contentStyle: r.contentStyle ? String(r.contentStyle) : undefined,
    variationsJson: r.variationsJson ? String(r.variationsJson) : undefined,
    createdAt: String(r.createdAt),
  };
}

export function deletePost(id: string): void {
  const db = getDb();
  db.prepare("DELETE FROM facebook_posts WHERE id = ?").run(id);
}

// ============================================================================
// AI IMAGES REPOSITORY
// ============================================================================

export function saveAiImage(item: AiImageRecord): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO ai_images (
      id, topic_title, entity, prompt, style,
      image_url, image_base64, provider, alt_text, caption, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      topic_title = excluded.topic_title,
      entity = excluded.entity,
      prompt = excluded.prompt,
      style = excluded.style,
      image_url = excluded.image_url,
      image_base64 = excluded.image_base64,
      provider = excluded.provider,
      alt_text = excluded.alt_text,
      caption = excluded.caption
  `).run(
    item.id,
    item.topicTitle || null,
    item.entity || null,
    item.prompt,
    item.style || null,
    item.imageUrl,
    item.imageBase64 || null,
    item.provider || null,
    item.altText || "",
    item.caption || "",
    item.createdAt || new Date().toISOString()
  );
}

export function saveAiImages(items: AiImageRecord[]): void {
  const db = getDb();
  db.exec("BEGIN TRANSACTION;");
  try {
    for (const item of items) {
      saveAiImage(item);
    }
    db.exec("COMMIT;");
  } catch (err) {
    db.exec("ROLLBACK;");
    throw err;
  }
}

export function getAllAiImages(limit = 50): AiImageRecord[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT 
      id, topic_title as topicTitle, entity, prompt, style,
      image_url as imageUrl, image_base64 as imageBase64, provider,
      alt_text as altText, caption, created_at as createdAt
    FROM ai_images
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit);

  return rows.map((r) => ({
    id: String(r.id),
    topicTitle: r.topicTitle ? String(r.topicTitle) : undefined,
    entity: r.entity ? String(r.entity) : undefined,
    prompt: String(r.prompt || ""),
    style: r.style ? String(r.style) : undefined,
    imageUrl: String(r.imageUrl || ""),
    imageBase64: r.imageBase64 ? String(r.imageBase64) : undefined,
    provider: r.provider ? String(r.provider) : undefined,
    altText: r.altText ? String(r.altText) : "",
    caption: r.caption ? String(r.caption) : "",
    createdAt: r.createdAt ? String(r.createdAt) : undefined,
  }));
}

export function getAiImagesByTopic(topicTitle: string): AiImageRecord[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT 
      id, topic_title as topicTitle, entity, prompt, style,
      image_url as imageUrl, image_base64 as imageBase64, provider,
      alt_text as altText, caption, created_at as createdAt
    FROM ai_images
    WHERE topic_title = ?
    ORDER BY created_at DESC
  `).all(topicTitle);

  return rows.map((r) => ({
    id: String(r.id),
    topicTitle: r.topicTitle ? String(r.topicTitle) : undefined,
    entity: r.entity ? String(r.entity) : undefined,
    prompt: String(r.prompt || ""),
    style: r.style ? String(r.style) : undefined,
    imageUrl: String(r.imageUrl || ""),
    imageBase64: r.imageBase64 ? String(r.imageBase64) : undefined,
    provider: r.provider ? String(r.provider) : undefined,
    altText: r.altText ? String(r.altText) : "",
    caption: r.caption ? String(r.caption) : "",
    createdAt: r.createdAt ? String(r.createdAt) : undefined,
  }));
}

export function getAiImageById(id: string): AiImageRecord | null {
  const db = getDb();
  const r = db.prepare(`
    SELECT 
      id, topic_title as topicTitle, entity, prompt, style,
      image_url as imageUrl, image_base64 as imageBase64, provider,
      alt_text as altText, caption, created_at as createdAt
    FROM ai_images
    WHERE id = ?
  `).get(id) as Record<string, unknown> | undefined;

  if (!r) return null;
  return {
    id: String(r.id),
    topicTitle: r.topicTitle ? String(r.topicTitle) : undefined,
    entity: r.entity ? String(r.entity) : undefined,
    prompt: String(r.prompt || ""),
    style: r.style ? String(r.style) : undefined,
    imageUrl: String(r.imageUrl || ""),
    imageBase64: r.imageBase64 ? String(r.imageBase64) : undefined,
    provider: r.provider ? String(r.provider) : undefined,
    altText: r.altText ? String(r.altText) : "",
    caption: r.caption ? String(r.caption) : "",
    createdAt: r.createdAt ? String(r.createdAt) : undefined,
  };
}

export function deleteAiImage(id: string): void {
  const db = getDb();
  db.prepare("DELETE FROM ai_images WHERE id = ?").run(id);
}

export function clearAiImages(): void {
  const db = getDb();
  db.exec("DELETE FROM ai_images;");
}

// ============================================================================
// SOURCE POSTS REPOSITORY (Requirement R2: Deduplication & Evergreen Fallback)
// ============================================================================

export function saveSourcePost(post: Omit<SourcePostItem, "createdAt" | "updatedAt"> & { createdAt?: string; updatedAt?: string }): SourcePostItem {
  const db = getDb();
  const id = post.id || `spost_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const mediaUrls = JSON.stringify(post.mediaUrls || []);
  const originalMediaUrls = JSON.stringify(post.originalMediaUrls || []);
  const status = post.status || "collected";

  db.prepare(`
    INSERT INTO source_posts (
      id, source_page_id, facebook_post_id, content_hash,
      original_content, media_urls, original_media_urls, post_url,
      published_time, like_count, comment_count, share_count,
      status, collected_at, evergreen_selected_at, rewritten_at,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(facebook_post_id) DO UPDATE SET
      content_hash = excluded.content_hash,
      original_content = excluded.original_content,
      media_urls = CASE WHEN excluded.media_urls <> '[]' THEN excluded.media_urls ELSE source_posts.media_urls END,
      original_media_urls = CASE WHEN excluded.original_media_urls <> '[]' THEN excluded.original_media_urls ELSE source_posts.original_media_urls END,
      post_url = excluded.post_url,
      like_count = excluded.like_count,
      comment_count = excluded.comment_count,
      share_count = excluded.share_count,
      updated_at = datetime('now')
  `).run(
    id,
    post.sourcePageId,
    post.facebookPostId,
    post.contentHash,
    post.originalContent,
    mediaUrls,
    originalMediaUrls,
    post.postUrl || "",
    post.publishedTime,
    post.likeCount || 0,
    post.commentCount || 0,
    post.shareCount || 0,
    status,
    post.collectedAt || new Date().toISOString(),
    post.evergreenSelectedAt || null,
    post.rewrittenAt || null
  );

  return getSourcePostByFbId(post.facebookPostId)!;
}

export function getSourcePosts(sourcePageId?: string, limit = 50): SourcePostItem[] {
  const db = getDb();
  let rows: Record<string, unknown>[];
  if (sourcePageId) {
    rows = db.prepare(`
      SELECT * FROM source_posts
      WHERE source_page_id = ?
      ORDER BY datetime(published_time) DESC
      LIMIT ?
    `).all(sourcePageId, limit) as Record<string, unknown>[];
  } else {
    rows = db.prepare(`
      SELECT * FROM source_posts
      ORDER BY datetime(published_time) DESC
      LIMIT ?
    `).all(limit) as Record<string, unknown>[];
  }

  return rows.map((r) => mapSourcePostRow(r));
}

export function getSourcePostById(id: string): SourcePostItem | null {
  const db = getDb();
  const r = db.prepare("SELECT * FROM source_posts WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!r) return null;
  return mapSourcePostRow(r);
}

export function getSourcePostByFbId(fbPostId: string): SourcePostItem | null {
  const db = getDb();
  const r = db.prepare("SELECT * FROM source_posts WHERE facebook_post_id = ?").get(fbPostId) as Record<string, unknown> | undefined;
  if (!r) return null;
  return mapSourcePostRow(r);
}

export function getSourcePostByHash(contentHash: string): SourcePostItem | null {
  const db = getDb();
  const r = db.prepare("SELECT * FROM source_posts WHERE content_hash = ?").get(contentHash) as Record<string, unknown> | undefined;
  if (!r) return null;
  return mapSourcePostRow(r);
}

export function getEvergreenCandidates(sourcePageId: string, olderThanDays = 15, limit = 5): EvergreenCandidate[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT *,
      CAST((julianday('now') - julianday(published_time)) AS INTEGER) as age_days,
      (like_count * 2 + comment_count * 3 + share_count * 5) as engagement_score
    FROM source_posts
    WHERE source_page_id = ?
      AND julianday('now') - julianday(published_time) >= ?
      AND status != 'ignored'
    ORDER BY (like_count * 2 + comment_count * 3 + share_count * 5) DESC, published_time DESC
    LIMIT ?
  `).all(sourcePageId, olderThanDays, limit) as Array<Record<string, unknown> & { age_days: number; engagement_score: number }>;

  return rows.map((r) => ({
    post: mapSourcePostRow(r),
    ageDays: Math.max(0, Number(r.age_days) || 0),
    engagementScore: Number(r.engagement_score) || 0,
  }));
}

export function updateSourcePostStatus(
  id: string,
  status: SourcePostStatus,
  options?: { isEvergreen?: boolean; rewrittenAt?: string }
): void {
  const db = getDb();
  const evergreenAt = options?.isEvergreen ? new Date().toISOString() : null;
  const rewrittenAt = options?.rewrittenAt || null;

  db.prepare(`
    UPDATE source_posts
    SET status = ?,
        evergreen_selected_at = COALESCE(?, evergreen_selected_at),
        rewritten_at = COALESCE(?, rewritten_at),
        updated_at = datetime('now')
    WHERE id = ?
  `).run(status, evergreenAt, rewrittenAt, id);
}

export function deleteSourcePost(id: string): boolean {
  const db = getDb();
  const res = db.prepare("DELETE FROM source_posts WHERE id = ?").run(id);
  return res.changes > 0;
}

function mapSourcePostRow(r: Record<string, unknown>): SourcePostItem {
  let mediaUrls: string[] = [];
  try {
    mediaUrls = JSON.parse(String(r.media_urls || "[]"));
  } catch {
    mediaUrls = [];
  }

  let originalMediaUrls: string[] = [];
  try {
    originalMediaUrls = JSON.parse(String(r.original_media_urls || "[]"));
  } catch {
    originalMediaUrls = [];
  }

  return {
    id: String(r.id),
    sourcePageId: String(r.source_page_id),
    facebookPostId: String(r.facebook_post_id),
    contentHash: String(r.content_hash),
    originalContent: String(r.original_content || ""),
    mediaUrls,
    originalMediaUrls,
    postUrl: r.post_url ? String(r.post_url) : undefined,
    publishedTime: String(r.published_time || new Date().toISOString()),
    likeCount: Number(r.like_count) || 0,
    commentCount: Number(r.comment_count) || 0,
    shareCount: Number(r.share_count) || 0,
    status: (r.status as SourcePostStatus) || "collected",
    collectedAt: String(r.collected_at || new Date().toISOString()),
    evergreenSelectedAt: r.evergreen_selected_at ? String(r.evergreen_selected_at) : undefined,
    rewrittenAt: r.rewritten_at ? String(r.rewritten_at) : undefined,
    createdAt: String(r.created_at || new Date().toISOString()),
    updatedAt: String(r.updated_at || new Date().toISOString()),
  };
}

// ============================================================================
// MODERATION QUEUE REPOSITORY (Requirement R4: Review Queue Before Publishing)
// ============================================================================

export function saveModerationItem(item: ModerationQueueItem): ModerationQueueItem {
  const db = getDb();
  const id = item.id || `mod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const sourceImages = JSON.stringify(item.sourceImages || []);
  const selectedImages = JSON.stringify(item.selectedImages || []);
  const policyWarnings = JSON.stringify(item.policyWarnings || []);
  const hashtags = JSON.stringify(item.hashtags || []);
  const extractedPoints = JSON.stringify(item.extractedPoints || []);

  db.prepare(`
    INSERT INTO moderation_queue (
      id, source_post_id, source_page_id, source_page_name, source_url,
      source_published_time, source_content, source_images,
      target_page_id, target_page_name,
      ai_headline, ai_hook, ai_body, ai_conclusion, ai_full_post,
      content_style, selected_images, alt_text, image_caption,
      seo_score, seo_breakdown, policy_status, policy_warnings, hashtags,
      original_word_count, repurposed_word_count, compression_rate, extracted_points,
      status, scheduled_at, published_at, fb_post_id, fb_post_url,
      error_message, rewrite_count, last_rewrite_prompt,
      created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?,
      datetime('now'), datetime('now')
    )
    ON CONFLICT(id) DO UPDATE SET
      target_page_id = excluded.target_page_id,
      target_page_name = excluded.target_page_name,
      ai_headline = excluded.ai_headline,
      ai_hook = excluded.ai_hook,
      ai_body = excluded.ai_body,
      ai_conclusion = excluded.ai_conclusion,
      ai_full_post = excluded.ai_full_post,
      content_style = excluded.content_style,
      selected_images = excluded.selected_images,
      alt_text = excluded.alt_text,
      image_caption = excluded.image_caption,
      seo_score = excluded.seo_score,
      seo_breakdown = excluded.seo_breakdown,
      policy_status = excluded.policy_status,
      policy_warnings = excluded.policy_warnings,
      hashtags = excluded.hashtags,
      original_word_count = excluded.original_word_count,
      repurposed_word_count = excluded.repurposed_word_count,
      compression_rate = excluded.compression_rate,
      extracted_points = excluded.extracted_points,
      status = excluded.status,
      scheduled_at = excluded.scheduled_at,
      published_at = excluded.published_at,
      fb_post_id = excluded.fb_post_id,
      fb_post_url = excluded.fb_post_url,
      error_message = excluded.error_message,
      rewrite_count = excluded.rewrite_count,
      last_rewrite_prompt = excluded.last_rewrite_prompt,
      updated_at = datetime('now')
  `).run(
    id,
    item.sourcePostId || null,
    item.sourcePageId || "",
    item.sourcePageName || "Facebook Fanpage",
    item.sourceUrl || "",
    item.sourcePublishedTime || null,
    item.sourceContent || "",
    sourceImages,
    item.targetPageId || "",
    item.targetPageName || "",
    item.aiHeadline || "",
    item.aiHook || "",
    item.aiBody || "",
    item.aiConclusion || "",
    item.aiFullPost || "",
    item.contentStyle || "storytelling",
    selectedImages,
    item.altText || "",
    item.imageCaption || "",
    item.seoScore ?? 0,
    item.seoBreakdown || "",
    item.policyStatus || "clean",
    policyWarnings,
    hashtags,
    item.originalWordCount || 0,
    item.repurposedWordCount || 0,
    item.compressionRate || 0,
    extractedPoints,
    item.status || "pending",
    item.scheduledAt || null,
    item.publishedAt || null,
    item.fbPostId || null,
    item.fbPostUrl || null,
    item.errorMessage || null,
    item.rewriteCount || 1,
    item.lastRewritePrompt || ""
  );

  return getModerationItemById(id)!;
}

export function getModerationItems(status?: ModerationStatus, limit = 50): ModerationQueueItem[] {
  const db = getDb();
  let rows: Record<string, unknown>[];
  if (status) {
    rows = db.prepare(`
      SELECT * FROM moderation_queue
      WHERE status = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(status, limit) as Record<string, unknown>[];
  } else {
    rows = db.prepare(`
      SELECT * FROM moderation_queue
      ORDER BY 
        CASE status
          WHEN 'pending' THEN 1
          WHEN 'approved' THEN 2
          WHEN 'scheduled' THEN 3
          WHEN 'published' THEN 4
          ELSE 5
        END ASC,
        created_at DESC
      LIMIT ?
    `).all(limit) as Record<string, unknown>[];
  }

  return rows.map((r) => mapModerationRow(r));
}

export function getModerationItemById(id: string): ModerationQueueItem | null {
  const db = getDb();
  const r = db.prepare("SELECT * FROM moderation_queue WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!r) return null;
  return mapModerationRow(r);
}

export function updateModerationItem(id: string, updates: Partial<ModerationQueueItem>): ModerationQueueItem | null {
  const current = getModerationItemById(id);
  if (!current) return null;

  const merged: ModerationQueueItem = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  return saveModerationItem(merged);
}

export function deleteModerationItem(id: string): boolean {
  const db = getDb();
  const res = db.prepare("DELETE FROM moderation_queue WHERE id = ?").run(id);
  return res.changes > 0;
}

export function getModerationStats() {
  const db = getDb();
  const rows = db.prepare(`
    SELECT status, COUNT(*) as c
    FROM moderation_queue
    GROUP BY status
  `).all() as Array<{ status: string; c: number }>;

  const stats = {
    pending: 0,
    approved: 0,
    published: 0,
    scheduled: 0,
    rejected: 0,
    total: 0,
  };

  for (const r of rows) {
    const s = String(r.status) as keyof typeof stats;
    if (s in stats) {
      stats[s] = Number(r.c);
    }
    stats.total += Number(r.c);
  }

  return stats;
}

function mapModerationRow(r: Record<string, unknown>): ModerationQueueItem {
  let sourceImages: string[] = [];
  try {
    sourceImages = JSON.parse(String(r.source_images || "[]"));
  } catch {
    sourceImages = [];
  }

  let selectedImages: string[] = [];
  try {
    selectedImages = JSON.parse(String(r.selected_images || "[]"));
  } catch {
    selectedImages = [];
  }

  let policyWarnings: string[] = [];
  try {
    policyWarnings = JSON.parse(String(r.policy_warnings || "[]"));
  } catch {
    policyWarnings = [];
  }

  let hashtags: string[] = [];
  try {
    hashtags = JSON.parse(String(r.hashtags || "[]"));
  } catch {
    hashtags = [];
  }

  let extractedPoints: string[] = [];
  try {
    extractedPoints = JSON.parse(String(r.extracted_points || "[]"));
  } catch {
    extractedPoints = [];
  }

  return {
    id: String(r.id),
    sourcePostId: r.source_post_id ? String(r.source_post_id) : undefined,
    sourcePageId: r.source_page_id ? String(r.source_page_id) : undefined,
    sourcePageName: String(r.source_page_name || "Facebook Fanpage"),
    sourceUrl: r.source_url ? String(r.source_url) : undefined,
    sourcePublishedTime: r.source_published_time ? String(r.source_published_time) : undefined,
    sourceContent: String(r.source_content || ""),
    sourceImages,
    targetPageId: r.target_page_id ? String(r.target_page_id) : undefined,
    targetPageName: r.target_page_name ? String(r.target_page_name) : undefined,
    aiHeadline: String(r.ai_headline || ""),
    aiHook: String(r.ai_hook || ""),
    aiBody: String(r.ai_body || ""),
    aiConclusion: r.ai_conclusion ? String(r.ai_conclusion) : undefined,
    aiFullPost: String(r.ai_full_post || ""),
    contentStyle: String(r.content_style || "storytelling"),
    selectedImages,
    altText: r.alt_text ? String(r.alt_text) : undefined,
    imageCaption: r.image_caption ? String(r.image_caption) : undefined,
    seoScore: Number(r.seo_score) || 0,
    seoBreakdown: r.seo_breakdown ? String(r.seo_breakdown) : undefined,
    policyStatus: (r.policy_status as "clean" | "warning" | "violation") || "clean",
    policyWarnings,
    hashtags,
    originalWordCount: Number(r.original_word_count) || 0,
    repurposedWordCount: Number(r.repurposed_word_count) || 0,
    compressionRate: Number(r.compression_rate) || 0,
    extractedPoints,
    status: (r.status as ModerationStatus) || "pending",
    scheduledAt: r.scheduled_at ? String(r.scheduled_at) : undefined,
    publishedAt: r.published_at ? String(r.published_at) : undefined,
    fbPostId: r.fb_post_id ? String(r.fb_post_id) : undefined,
    fbPostUrl: r.fb_post_url ? String(r.fb_post_url) : undefined,
    errorMessage: r.error_message ? String(r.error_message) : undefined,
    rewriteCount: Number(r.rewrite_count) || 1,
    lastRewritePrompt: r.last_rewrite_prompt ? String(r.last_rewrite_prompt) : undefined,
    createdAt: String(r.created_at || new Date().toISOString()),
    updatedAt: String(r.updated_at || new Date().toISOString()),
  };
}

// ============================================================================
// DATABASE SYSTEM STATS
// ============================================================================

export function getDbStats() {
  const db = getDb();
  const topicCount = db.prepare("SELECT COUNT(*) as c FROM topics").get() as { c: number };
  const keyCount = db.prepare("SELECT COUNT(*) as c FROM gemini_keys").get() as { c: number };
  const postCount = db.prepare("SELECT COUNT(*) as c FROM facebook_posts").get() as { c: number };
  const imageCount = db.prepare("SELECT COUNT(*) as c FROM ai_images").get() as { c: number };

  let targetCount = { c: 0 };
  let sourceCount = { c: 0 };
  let sourcePostCount = { c: 0 };
  let queueCount = { c: 0 };

  try {
    targetCount = db.prepare("SELECT COUNT(*) as c FROM target_pages").get() as { c: number };
    sourceCount = db.prepare("SELECT COUNT(*) as c FROM source_pages").get() as { c: number };
    sourcePostCount = db.prepare("SELECT COUNT(*) as c FROM source_posts").get() as { c: number };
    queueCount = db.prepare("SELECT COUNT(*) as c FROM moderation_queue").get() as { c: number };
  } catch {
    // ignore if tables not yet queried
  }

  let sizeBytes = 0;
  try {
    if (fs.existsSync(DB_PATH)) {
      sizeBytes = fs.statSync(DB_PATH).size;
    }
  } catch {
    // ignore
  }

  return {
    engine: "SQLite 3 (Native Node Engine)",
    dbPath: DB_PATH,
    sizeBytes,
    totalTopics: topicCount.c,
    totalKeys: keyCount.c,
    totalPosts: postCount.c,
    totalImages: imageCount.c,
    totalTargetPages: targetCount.c,
    totalSourcePages: sourceCount.c,
    totalSourcePosts: sourcePostCount.c,
    totalModerationQueue: queueCount.c,
    journalMode: "WAL (Write-Ahead Logging)",
  };
}
