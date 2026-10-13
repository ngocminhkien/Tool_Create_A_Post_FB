import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";
import { SheetSyncConfig, TopicRow } from "@/types/sheet.types";
import { GeminiKeyItem, AiImageRecord } from "@/types/ai.types";
import { FacebookPageConfig, PostHistoryItem } from "@/types/facebook.types";

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
    const rawPostCols = db.prepare("PRAGMA table_info(facebook_posts);").all() as Array<{ name: string }>;
    const existingPostCols = new Set(rawPostCols.map((c) => String(c.name)));

    for (const col of FACEBOOK_POSTS_NEW_COLUMNS) {
      if (!existingPostCols.has(col.name)) {
        db.exec(`ALTER TABLE facebook_posts ADD COLUMN ${col.sql};`);
      }
    }
  } catch (err) {
    console.warn("Lỗi dynamic migration facebook_posts:", err);
  }

  try {
    const rawImgCols = db.prepare("PRAGMA table_info(ai_images);").all() as Array<{ name: string }>;
    const existingImgCols = new Set(rawImgCols.map((c) => String(c.name)));

    for (const col of AI_IMAGES_NEW_COLUMNS) {
      if (!existingImgCols.has(col.name)) {
        db.exec(`ALTER TABLE ai_images ADD COLUMN ${col.sql};`);
      }
    }
  } catch (err) {
    console.warn("Lỗi dynamic migration ai_images:", err);
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
  db.prepare(`
    INSERT INTO facebook_config (id, page_id, page_name, access_token, updated_at)
    VALUES ('active', ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      page_id = excluded.page_id,
      page_name = excluded.page_name,
      access_token = excluded.access_token,
      updated_at = datetime('now')
  `).run(
    config.pageId || "",
    config.pageName || "Facebook Fanpage",
    config.pageAccessToken || ""
  );
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
// DATABASE SYSTEM STATS
// ============================================================================

export function getDbStats() {
  const db = getDb();
  const topicCount = db.prepare("SELECT COUNT(*) as c FROM topics").get() as { c: number };
  const keyCount = db.prepare("SELECT COUNT(*) as c FROM gemini_keys").get() as { c: number };
  const postCount = db.prepare("SELECT COUNT(*) as c FROM facebook_posts").get() as { c: number };
  const imageCount = db.prepare("SELECT COUNT(*) as c FROM ai_images").get() as { c: number };

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
    journalMode: "WAL (Write-Ahead Logging)",
  };
}
