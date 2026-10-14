/**
 * Turso Database Cloud Bridge
 * Provides seamless synchronization between local SQLite (fast in-memory / /tmp)
 * and Turso Cloud (serverless-persistent database on Vercel).
 */

import { createClient, Client } from "@libsql/client";
import { DatabaseSync } from "node:sqlite";

let tursoClient: Client | null = null;
let isInitialized = false;

export function getTursoClient(): Client | null {
  if (tursoClient) return tursoClient;

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (url && authToken) {
    try {
      tursoClient = createClient({ url, authToken });
      return tursoClient;
    } catch (err) {
      console.warn("Failed to initialize Turso client:", err);
      return null;
    }
  }

  return null;
}

export function isTursoEnabled(): boolean {
  return Boolean(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN);
}

let initPromise: Promise<void> | null = null;

/**
 * Ensures Turso has finished its initial sync to local SQLite.
 */
export function ensureTursoSynced(db: DatabaseSync): Promise<void> {
  if (isInitialized) return Promise.resolve();
  if (!isTursoEnabled()) {
    isInitialized = true;
    return Promise.resolve();
  }
  if (!initPromise) {
    initPromise = syncFromTursoToLocal(db);
  }
  return initPromise;
}

/**
 * Asynchronously pushes an INSERT, UPDATE, or DELETE to Turso Cloud in the background.
 * Fire-and-forget: does not block the user response.
 */
export function pushToTurso(sql: string, args: unknown[] = []): void {
  const client = getTursoClient();
  if (!client) return;

  client
    .execute({ sql, args: args as any })
    .catch((err) => {
      console.warn("Background Turso sync error:", err?.message || err);
    });
}

/**
 * Asynchronously executes a batch of statements on Turso Cloud in a single HTTP request.
 */
export function pushBatchToTurso(statements: Array<{ sql: string; args?: unknown[] }>): void {
  const client = getTursoClient();
  if (!client || statements.length === 0) return;

  client
    .batch(statements.map((s) => ({ sql: s.sql, args: (s.args || []) as any })))
    .catch((err) => {
      console.warn("Background Turso batch sync error:", err?.message || err);
    });
}

/**
 * On initial server cold start, fetches the latest state from Turso Cloud
 * and syncs it into the local SQLite database.
 */
export async function syncFromTursoToLocal(db: DatabaseSync): Promise<void> {
  const client = getTursoClient();
  if (!client || isInitialized) return;

  try {
    const TABLES = [
      "sheet_config",
      "gemini_keys",
      "facebook_config",
      "target_pages",
      "source_pages",
      "source_posts",
      "moderation_queue",
      "fb_observer_accounts",
      "topics",
      "ai_images",
    ];

    for (const table of TABLES) {
      try {
        const res = await client.execute(`SELECT * FROM ${table}`);
        if (res.rows && res.rows.length > 0) {
          for (const row of res.rows) {
            const keys = Object.keys(row);
            const placeholders = keys.map(() => "?").join(", ");
            const values = keys.map((k) => (row as any)[k]);
            const sql = `INSERT OR REPLACE INTO ${table} (${keys.join(", ")}) VALUES (${placeholders})`;
            try {
              db.prepare(sql).run(...values);
            } catch {
              // ignore
            }
          }
        }
      } catch {
        // table might be empty or not yet queried
      }
    }

    isInitialized = true;
    console.log("✓ Turso Cloud state successfully synchronized to local database.");
  } catch (err) {
    console.warn("Turso sync to local warning:", err);
  }
}
