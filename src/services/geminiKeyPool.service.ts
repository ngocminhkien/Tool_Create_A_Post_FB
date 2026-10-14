import fs from "fs";
import path from "path";
import { GeminiKeyItem, KeyPoolStats } from "@/types/ai.types";
import {
  saveKeys,
  getAllKeys,
  deleteKeyFromDb,
  deleteInvalidKeysFromDb,
  clearAllKeysFromDb,
  ensureDbSynced,
} from "./db.service";

const DATA_DIR = path.join(process.cwd(), "data");
const KEYS_FILE = path.join(DATA_DIR, "gemini-keys.json");

// 30 Unique Google Gemini Free Keys provided by the user (deduplicated from 31)
const INITIAL_RAW_KEYS: string[] = [
  "AIzaSyBK4iMItab0zVj94F9PaxqEKpKgu39jGMM",
  "AIzaSyBdgl-GW54ukgj6JX2qyFUCPCgduFZSjNo",
  "AIzaSyC7xCPXZ2-H59r0WwHlJjSaty5-kkYg51w",
  "AIzaSyBI5HlJsoRH117xVfnkKDYwPFaE41xw1OQ",
  "AIzaSyDRCK251KTjV6KLKwhcISoZQBc0IWgVS_o",
  "AIzaSyAvVWVPivCSpHLD4wjRsaHk3A1ZLGtbebc",
  "AIzaSyBQMuz5qtptW94I3ByJFj8RCb1LUgjL4PA",
  "AIzaSyBwvL5-9YT8hYcb9bMXKtDwaFp_ZePSvIg",
  "AIzaSyBk1f42Yde2UeL7jHgu2TMg4hpEkZP3BaE",
  "AIzaSyArtCe5LulBa6izakm9D373YdM28_CGO0s",
  "AIzaSyA_nImQGGHmZG31u9bAmWLlmPEqCPhp0DI",
  "AIzaSyCzLd9YwsQdpH33IGawy9oP19wqqxPT8Gg",
  "AIzaSyDsoMU8J64YKY87kjmIg7cjDaI-p22jUbo",
  "AIzaSyCLCfLOPgcLYVqBAHSu4WGnl5oa3KgSwew",
  "AIzaSyDDzJh9uPmrih-Fb7qu0aK37jMTfVvBeAY",
  "AIzaSyC6DuN66mQGnqUklLxa5xsS2PneKM3SCwQ",
  "AIzaSyC10G4P3lH-Gnxc9ed_VPFhvzrgFjidITg",
  "AIzaSyDOJFI3pqoPJ-YYS0qo4hDf7G5T-FtJM8M",
  "AIzaSyA8S2qaaqOAKb-ptOOwM_0OqEGlJi9qcUA",
  "AIzaSyA2ewI7enU1rBMIzbuqbRsUbxWnMQ0Y4ZA",
  "AIzaSyDvyM8pgoXMC9kqIylqSq9JsktCLZckqdA",
  "AIzaSyD0h1snrw5G3cnHmT0MS1YKn6O6fU0dTfU",
  "AIzaSyBkt_WdspkGSTVBEWr8xA0rD83JyBjRaNo",
  "AIzaSyA6SGl3ua1kCl5MRTVv0W5LTRDQ6MyKZuI",
  "AIzaSyBmLwcr_bNC-o0SbiUdyWtfDf0vMM6Cc-c",
  "AIzaSyCvLuZO9w-KO8mvkQVUmkAQCgtYRj0blqw",
  "AIzaSyCIgLobxQ6gS3_K7eSWzZQ6VIoek4MAoeQ",
  "AIzaSyDtGnrAIICiIOfY_HX_sNqhzVp-bYF1qJM",
  "AIzaSyBifPkuvimVpWp6eknN2-2u3IeQsoexQp8",
  "AIzaSyC5JP9Aqrmp2Dg0XCfnbRlAMNvdvAG92_4",
];

interface PersistedKeyPool {
  currentIndex: number;
  totalFailovers: number;
  preferredModel: string;
  keys: GeminiKeyItem[];
}

// In-memory cache to prevent concurrent file read/write race conditions
let memoryPool: PersistedKeyPool | null = null;

export function maskApiKey(key: string): string {
  if (!key || key.length < 14) return "****";
  return `${key.slice(0, 10)}...${key.slice(-6)}`;
}

function buildInitialPool(): PersistedKeyPool {
  const uniqueKeys = Array.from(
    new Set(INITIAL_RAW_KEYS.map((k) => k.trim()).filter(Boolean))
  );
  return {
    currentIndex: 0,
    totalFailovers: 0,
    preferredModel: "gemini-2.5-flash",
    keys: uniqueKeys.map((key, idx) => ({
      id: `key-${idx + 1}`,
      key,
      maskedKey: maskApiKey(key),
      status: "active",
      successCount: 0,
      errorCount: 0,
      rateLimitCount: 0,
      lastUsedAt: null,
      cooldownUntil: null,
      lastError: null,
    })),
  };
}

export async function ensureKeyPoolReady(): Promise<PersistedKeyPool> {
  try {
    await ensureDbSynced();
    const dbKeys = getAllKeys();
    if (dbKeys && dbKeys.length > 0) {
      if (!memoryPool) {
        memoryPool = {
          currentIndex: 0,
          totalFailovers: 0,
          preferredModel: "gemini-2.5-flash",
          keys: dbKeys,
        };
      } else {
        memoryPool.keys = dbKeys;
      }
    }
  } catch {
    // ignore
  }
  return ensureDataFile();
}

function ensureDataFile(): PersistedKeyPool {
  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch {
      // ignore read-only on serverless
    }
  }

  if (!memoryPool) {
    let dbKeys: GeminiKeyItem[] = [];
    try {
      dbKeys = getAllKeys();
    } catch {
      // ignore
    }

    if (dbKeys && dbKeys.length > 0) {
      memoryPool = {
        currentIndex: 0,
        totalFailovers: 0,
        preferredModel: "gemini-2.5-flash",
        keys: dbKeys,
      };
    } else if (fs.existsSync(KEYS_FILE)) {
      try {
        const raw = fs.readFileSync(KEYS_FILE, "utf-8");
        if (raw.trim().length > 0) {
          memoryPool = JSON.parse(raw) as PersistedKeyPool;
        }
      } catch {
        // Fallback to building initial pool if file was corrupted
      }
    }
    if (!memoryPool) {
      memoryPool = buildInitialPool();
      savePool(memoryPool);
    }
  }

  // Auto-recover keys whose cooldown period has expired
  const now = Date.now();
  let changed = false;
  for (const k of memoryPool.keys) {
    if (k.status === "cooldown" && k.cooldownUntil) {
      if (new Date(k.cooldownUntil).getTime() <= now) {
        k.status = "active";
        k.cooldownUntil = null;
        changed = true;
      }
    }
  }
  if (changed) {
    savePool(memoryPool);
  }
  return memoryPool;
}

function savePool(pool: PersistedKeyPool) {
  memoryPool = pool;
  try {
    saveKeys(pool.keys);
  } catch {
    // ignore
  }
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tempFile = `${KEYS_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(pool, null, 2), "utf-8");
    fs.renameSync(tempFile, KEYS_FILE);
  } catch {
    try {
      fs.writeFileSync(KEYS_FILE, JSON.stringify(pool, null, 2), "utf-8");
    } catch {
      // ignore read-only filesystem on Vercel
    }
  }
}

export function getKeyPoolState(): {
  keys: Omit<GeminiKeyItem, "key">[];
  stats: KeyPoolStats;
  preferredModel: string;
} {
  const pool = ensureDataFile();
  const sanitizedKeys = pool.keys.map(({ key: _rawKey, ...rest }) => rest);

  const stats: KeyPoolStats = {
    total: pool.keys.length,
    active: pool.keys.filter((k) => k.status === "active").length,
    cooldown: pool.keys.filter((k) => k.status === "cooldown").length,
    invalid: pool.keys.filter((k) => k.status === "invalid").length,
    currentIndex: pool.currentIndex,
    totalSuccessRequests: pool.keys.reduce((acc, k) => acc + k.successCount, 0),
    totalFailovers: pool.totalFailovers || 0,
  };

  return {
    keys: sanitizedKeys,
    stats,
    preferredModel: pool.preferredModel || "gemini-2.5-flash",
  };
}

export function resetAllKeyCooldowns() {
  const pool = ensureDataFile();
  for (const k of pool.keys) {
    if (k.status === "cooldown") {
      k.status = "active";
      k.cooldownUntil = null;
      k.lastError = null;
    }
  }
  savePool(pool);
  return getKeyPoolState();
}

export function addBulkKeys(rawText: string): {
  addedCount: number;
  reactivatedCount: number;
  totalFound: number;
  state: ReturnType<typeof getKeyPoolState>;
  error?: string;
} {
  const pool = ensureDataFile();
  if (!rawText || typeof rawText !== "string" || !rawText.trim()) {
    return {
      addedCount: 0,
      reactivatedCount: 0,
      totalFound: 0,
      state: getKeyPoolState(),
      error: "Vui lòng dán ít nhất 1 mã Gemini API Key.",
    };
  }

  // Regex extract any Google API key (starts with AIza and has 35 base64url chars = 39 chars)
  const matches = rawText.match(/AIza[0-9A-Za-z\-_]{35}/g);
  let candidateKeys: string[] = [];

  if (matches && matches.length > 0) {
    candidateKeys = matches;
  } else {
    // Fallback: tokenize and clean quotes/spaces for slightly non-standard or truncated strings
    candidateKeys = rawText
      .split(/[\r\n,;\s]+/)
      .map((s) => s.replace(/['"`]/g, "").trim())
      .filter((s) => s.startsWith("AIza"));
  }

  const uniqueCandidates = Array.from(new Set(candidateKeys));

  if (uniqueCandidates.length === 0) {
    return {
      addedCount: 0,
      reactivatedCount: 0,
      totalFound: 0,
      state: getKeyPoolState(),
      error:
        "Không tìm thấy Key Google Gemini hợp lệ nào trong nội dung bạn vừa nhập. Mã Key của Google Gemini luôn bắt đầu bằng 'AIza' (ví dụ: AIzaSy... 39 ký tự).",
    };
  }

  let addedCount = 0;
  let reactivatedCount = 0;

  for (const key of uniqueCandidates) {
    const existing = pool.keys.find((k) => k.key === key);
    if (existing) {
      // Re-activate and reset previous error state
      const wasBad = existing.status !== "active";
      existing.status = "active";
      existing.errorCount = 0;
      existing.rateLimitCount = 0;
      existing.cooldownUntil = null;
      existing.lastError = null;
      if (wasBad) {
        reactivatedCount++;
      }
    } else {
      pool.keys.push({
        id: `key-${pool.keys.length + 1}-${Date.now().toString().slice(-4)}`,
        key,
        maskedKey: maskApiKey(key),
        status: "active",
        successCount: 0,
        errorCount: 0,
        rateLimitCount: 0,
        lastUsedAt: null,
        cooldownUntil: null,
        lastError: null,
      });
      addedCount++;
    }
  }

  savePool(pool);
  return {
    addedCount,
    reactivatedCount,
    totalFound: uniqueCandidates.length,
    state: getKeyPoolState(),
  };
}

export function removeKeyById(id: string) {
  const pool = ensureDataFile();
  pool.keys = pool.keys.filter((k) => k.id !== id);
  if (pool.currentIndex >= pool.keys.length) {
    pool.currentIndex = 0;
  }
  savePool(pool);
  try {
    deleteKeyFromDb(id);
  } catch {
    // ignore
  }
  return getKeyPoolState();
}

export function removeAllInvalidKeys(): {
  removedCount: number;
  state: ReturnType<typeof getKeyPoolState>;
} {
  const pool = ensureDataFile();
  const invalidKeys = pool.keys.filter((k) => k.status === "invalid");
  const removedCount = invalidKeys.length;
  pool.keys = pool.keys.filter((k) => k.status !== "invalid");
  if (pool.currentIndex >= pool.keys.length) {
    pool.currentIndex = 0;
  }
  savePool(pool);
  try {
    deleteInvalidKeysFromDb();
  } catch {
    // ignore
  }
  return { removedCount, state: getKeyPoolState() };
}

export function clearAllKeys(): {
  clearedCount: number;
  state: ReturnType<typeof getKeyPoolState>;
} {
  const pool = ensureDataFile();
  const clearedCount = pool.keys.length;
  pool.keys = [];
  pool.currentIndex = 0;
  savePool(pool);
  try {
    clearAllKeysFromDb();
  } catch {
    // ignore
  }
  return { clearedCount, state: getKeyPoolState() };
}

export function setPreferredGeminiModel(model: string) {
  const pool = ensureDataFile();
  pool.preferredModel = model;
  savePool(pool);
  return getKeyPoolState();
}

/**
 * Selects the next available key using Round-Robin and automatically fails over
 * to the next key in the pool if a 429 Quota Exceeded / 403 / 503 error occurs.
 */
export async function generateTextWithKeyRotation(options: {
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
}): Promise<{
  text: string;
  usedKeyMasked: string;
  failoverAttempts: number;
  model: string;
}> {
  await ensureKeyPoolReady();
  const pool = ensureDataFile();
  const totalKeys = pool.keys.length;

  if (totalKeys === 0) {
    throw new Error(
      "Không có Gemini API Key nào trong hệ thống. Vui lòng thêm key tại mục Quản lý Key."
    );
  }

  const allModels = [
    "gemini-3.8-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
  ];
  const totalReq = pool.keys.reduce((acc, k) => acc + k.successCount, 0);
  const rotatedStartModel = allModels[totalReq % allModels.length];
  const preferred =
    pool.preferredModel && pool.preferredModel !== "gemini-2.5-flash"
      ? pool.preferredModel
      : rotatedStartModel;
  const modelChain = Array.from(new Set([preferred, ...allModels]));

  let failoverAttempts = 0;
  const errorsCollected: string[] = [];

  // Up to 3 passes with backoff in case working free-tier keys hit temporary per-minute RPM limit
  for (let pass = 0; pass < 3; pass++) {
    if (pass > 0) {
      await new Promise((r) => setTimeout(r, pass * 4000));
    }

    const startIndex = pool.currentIndex % totalKeys;

    // Prioritize keys in 3 tiers starting from Round-Robin startIndex:
    // Tier 1: Active keys that have succeeded before or have 0 errors
    // Tier 2: Other Active keys
    // Tier 3: Cooldown keys that previously succeeded (working keys waiting for RPM window)
    const tier1: number[] = [];
    const tier2: number[] = [];
    const tier3: number[] = [];

    for (let offset = 0; offset < totalKeys; offset++) {
      const idx = (startIndex + offset) % totalKeys;
      const k = pool.keys[idx];
      if (k.status === "active") {
        if (k.successCount > 0 || k.errorCount === 0) {
          tier1.push(idx);
        } else {
          tier2.push(idx);
        }
      } else if (k.status === "cooldown" && k.successCount > 0) {
        tier3.push(idx);
      }
    }

    const candidateIndices = [...tier1, ...tier2, ...tier3];

    // If all keys were marked cooldown/invalid and none are in candidateIndices, try non-invalid keys
    if (candidateIndices.length === 0) {
      for (let offset = 0; offset < totalKeys; offset++) {
        const idx = (startIndex + offset) % totalKeys;
        if (pool.keys[idx].status !== "invalid") {
          candidateIndices.push(idx);
        }
      }
    }

    for (const idx of candidateIndices) {
      const keyItem = pool.keys[idx];

      for (const modelName of modelChain) {
        try {
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${keyItem.key}`;

          const payload: Record<string, unknown> = {
            contents: [
              {
                role: "user",
                parts: [{ text: options.prompt }],
              },
            ],
            generationConfig: {
              temperature: options.temperature ?? 0.75,
              maxOutputTokens: 4096,
            },
          };

          if (options.systemInstruction) {
            payload.systemInstruction = {
              parts: [{ text: options.systemInstruction }],
            };
          }

          const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          const data = await res.json();

          if (!res.ok) {
            const errMessage =
              data?.error?.message || `HTTP ${res.status}: ${res.statusText}`;

            if (res.status === 404) {
              continue;
            }

            // Permanently invalid, suspended, or zero-quota project (limit: 0)
            if (
              res.status === 400 ||
              res.status === 403 ||
              errMessage.includes("API_KEY_INVALID") ||
              errMessage.toLowerCase().includes("suspended") ||
              errMessage.toLowerCase().includes("key not valid") ||
              (res.status === 429 &&
                keyItem.successCount === 0 &&
                (errMessage.includes("limit: 0") ||
                  errMessage.includes("limit '0'") ||
                  keyItem.rateLimitCount >= 1))
            ) {
              keyItem.status = "invalid";
              keyItem.errorCount += 1;
              keyItem.lastError =
                res.status === 429
                  ? "Key hết hạn mức ngày hoặc Limit = 0 (429)"
                  : `Key bị khóa hoặc không hợp lệ (${res.status})`;
              pool.totalFailovers = (pool.totalFailovers || 0) + 1;
              failoverAttempts += 1;
              pool.currentIndex = (idx + 1) % totalKeys;
              savePool(pool);
              errorsCollected.push(`[${keyItem.maskedKey}] ${keyItem.lastError}`);
              break;
            }

            // Temporary Rate Limit (429) on a key
            if (
              res.status === 429 ||
              errMessage.toLowerCase().includes("quota")
            ) {
              if (modelName !== modelChain[modelChain.length - 1]) {
                continue;
              }
              keyItem.status = "cooldown";
              keyItem.rateLimitCount += 1;
              keyItem.errorCount += 1;
              // Working keys get a short 15s RPM cooldown; untested keys get 60s
              const cooldownSec = keyItem.successCount > 0 ? 15 : 60;
              keyItem.cooldownUntil = new Date(
                Date.now() + cooldownSec * 1000
              ).toISOString();
              keyItem.lastError = `429 Chạm giới hạn RPM tạm thời (${modelName})`;
              pool.totalFailovers = (pool.totalFailovers || 0) + 1;
              failoverAttempts += 1;
              pool.currentIndex = (idx + 1) % totalKeys;
              savePool(pool);
              errorsCollected.push(`[${keyItem.maskedKey}] 429 RPM`);
              break;
            }

            keyItem.status = "cooldown";
            keyItem.errorCount += 1;
            keyItem.cooldownUntil = new Date(
              Date.now() + 20 * 1000
            ).toISOString();
            keyItem.lastError = errMessage;
            pool.totalFailovers = (pool.totalFailovers || 0) + 1;
            failoverAttempts += 1;
            pool.currentIndex = (idx + 1) % totalKeys;
            savePool(pool);
            errorsCollected.push(`[${keyItem.maskedKey}] ${errMessage}`);
            break;
          }

          const generatedText =
            data?.candidates?.[0]?.content?.parts
              ?.map((p: { text?: string }) => p.text || "")
              .join("")
              .trim() || "";

          if (!generatedText) {
            throw new Error("Gemini trả về nội dung rỗng.");
          }

          keyItem.status = "active";
          keyItem.cooldownUntil = null;
          keyItem.lastError = null;
          keyItem.successCount += 1;
          keyItem.lastUsedAt = new Date().toISOString();
          pool.currentIndex = (idx + 1) % totalKeys;
          savePool(pool);

          return {
            text: generatedText,
            usedKeyMasked: keyItem.maskedKey,
            failoverAttempts,
            model: modelName,
          };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          keyItem.errorCount += 1;
          keyItem.lastError = msg;
          failoverAttempts += 1;
          pool.totalFailovers = (pool.totalFailovers || 0) + 1;
          pool.currentIndex = (idx + 1) % totalKeys;
          savePool(pool);
          errorsCollected.push(`[${keyItem.maskedKey}] ${msg}`);
          break;
        }
      }
    }
  }

  throw new Error(
    `Đã thử luân phiên qua các key trong Pool nhưng đều gặp lỗi. Chi tiết gần nhất: ${errorsCollected
      .slice(-3)
      .join(" | ")}`
  );
}
