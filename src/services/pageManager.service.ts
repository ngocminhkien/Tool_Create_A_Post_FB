/**
 * Page Manager Service
 * Bounded Context Architecture:
 * - Target Pages (Fanpage Đích): Owned and managed by the user, holds access tokens, has publishing rights.
 * - Source Pages (Fanpage Nguồn): External inspiration and competitor channels, read-only monitoring, zero publishing rights.
 */

import {
  TargetPageItem,
  SourcePageItem,
  CreateTargetPageRequest,
  UpdateTargetPageRequest,
  CreateSourcePageRequest,
  UpdateSourcePageRequest,
  ParsedFacebookUrl,
  TokenValidationResult,
  PageStatus,
} from "@/types/sourcePage.types";
import {
  getTargetPages as dbGetTargetPages,
  getTargetPageById as dbGetTargetPageById,
  getTargetPageByPageId as dbGetTargetPageByPageId,
  getDefaultTargetPage as dbGetDefaultTargetPage,
  saveTargetPage as dbSaveTargetPage,
  deleteTargetPage as dbDeleteTargetPage,
  getSourcePages as dbGetSourcePages,
  getSourcePageById as dbGetSourcePageById,
  getSourcePageByUrl as dbGetSourcePageByUrl,
  saveSourcePage as dbSaveSourcePage,
  deleteSourcePage as dbDeleteSourcePage,
  updateSourcePageScanStatus as dbUpdateSourcePageScanStatus,
} from "./db.service";

// ============================================================================
// 1. URL PARSER & VALIDATOR FOR FACEBOOK PAGES
// ============================================================================

const FACEBOOK_SYSTEM_PATHS = new Set([
  "home.php",
  "login",
  "login.php",
  "recover",
  "settings",
  "messages",
  "watch",
  "marketplace",
  "gaming",
  "groups",
  "events",
  "saved",
  "memories",
  "help",
  "policies",
  "terms",
  "privacy",
  "dialog",
  "share",
  "sharer.php",
]);

/**
 * Parses and normalizes various Facebook Page URL formats.
 * Supported formats:
 * - https://www.facebook.com/{slug}
 * - https://facebook.com/{slug}/
 * - https://m.facebook.com/{slug}
 * - https://mbasic.facebook.com/{slug}
 * - https://fb.com/{slug}
 * - https://www.facebook.com/profile.php?id={numeric_id}
 * - https://www.facebook.com/pages/category/{category}/{slug}-{numeric_id}
 * - https://www.facebook.com/pages/{slug}/{numeric_id}
 * - https://www.facebook.com/p/{slug}-{numeric_id}/
 */
export function parseFacebookUrl(rawUrl: string): ParsedFacebookUrl {
  if (!rawUrl || typeof rawUrl !== "string" || !rawUrl.trim()) {
    return {
      isValid: false,
      normalizedUrl: "",
      identifierType: "unknown",
      error: "Đường link Fanpage Facebook không được để trống.",
    };
  }

  let cleaned = rawUrl.trim();
  if (!/^https?:\/\//i.test(cleaned)) {
    cleaned = "https://" + cleaned;
  }

  let parsed: URL;
  try {
    parsed = new URL(cleaned);
  } catch {
    return {
      isValid: false,
      normalizedUrl: rawUrl,
      identifierType: "unknown",
      error: "Định dạng URL không hợp lệ.",
    };
  }

  const hostname = parsed.hostname.toLowerCase();
  const isFbDomain =
    hostname === "facebook.com" ||
    hostname === "www.facebook.com" ||
    hostname === "m.facebook.com" ||
    hostname === "mbasic.facebook.com" ||
    hostname === "fb.com" ||
    hostname === "www.fb.com";

  if (!isFbDomain) {
    return {
      isValid: false,
      normalizedUrl: cleaned,
      identifierType: "unknown",
      error: "URL không thuộc tên miền Facebook (facebook.com hoặc fb.com).",
    };
  }

  const pathname = parsed.pathname.replace(/\/+/g, "/").replace(/\/$/, "");

  // Format 1: profile.php?id=123456789
  if (pathname === "/profile.php") {
    const id = parsed.searchParams.get("id");
    if (id && /^\d+$/.test(id)) {
      return {
        isValid: true,
        normalizedUrl: `https://www.facebook.com/profile.php?id=${id}`,
        slugOrId: id,
        identifierType: "id",
      };
    }
    return {
      isValid: false,
      normalizedUrl: cleaned,
      identifierType: "unknown",
      error: "URL dạng profile.php thiếu tham số id hợp lệ.",
    };
  }

  // Format 2: /p/{slug-or-id}/ or /p/{slug}-{id}
  const pMatch = pathname.match(/^\/p\/([^/]+)/i);
  if (pMatch) {
    const segment = pMatch[1];
    const numericMatch = segment.match(/(\d{6,})$/);
    const identifier = numericMatch ? numericMatch[1] : segment;
    return {
      isValid: true,
      normalizedUrl: `https://www.facebook.com/p/${segment}`,
      slugOrId: identifier,
      identifierType: numericMatch ? "id" : "slug",
    };
  }

  // Format 3: /pages/{category}/{name-id} or /pages/{name}/{id} or arbitrary /pages/...
  if (pathname.startsWith("/pages/")) {
    const pageSegments = pathname.split("/").filter(Boolean);
    const lastPart = pageSegments[pageSegments.length - 1];
    const numPart = lastPart.match(/(\d{6,})$/);
    const identifier = numPart ? numPart[1] : lastPart;
    return {
      isValid: true,
      normalizedUrl: `https://www.facebook.com${pathname}`,
      slugOrId: identifier,
      identifierType: numPart ? "id" : "slug",
    };
  }

  // Format 4: /{slug}
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) {
    return {
      isValid: false,
      normalizedUrl: "https://www.facebook.com/",
      identifierType: "unknown",
      error: "URL chưa chỉ định Fanpage Facebook cụ thể.",
    };
  }

  const firstSegment = segments[0];
  if (FACEBOOK_SYSTEM_PATHS.has(firstSegment.toLowerCase())) {
    return {
      isValid: false,
      normalizedUrl: cleaned,
      identifierType: "unknown",
      error: `Đường dẫn "${firstSegment}" là trang hệ thống của Facebook, không phải Fanpage.`,
    };
  }

  const normalized = `https://www.facebook.com/${firstSegment}`;
  const isNumeric = /^\d+$/.test(firstSegment);

  return {
    isValid: true,
    normalizedUrl: normalized,
    slugOrId: firstSegment,
    identifierType: isNumeric ? "id" : "slug",
  };
}

// ============================================================================
// 2. GRAPH API TOKEN VALIDATOR
// ============================================================================

/**
 * Validates a Page ID & Page Access Token against Meta Graph API.
 * Fetches Page Name and High-Resolution Avatar if valid.
 */
export async function verifyPageAccessToken(
  pageId: string,
  accessToken: string
): Promise<TokenValidationResult> {
  const pId = pageId?.trim();
  const token = accessToken?.trim();

  if (!pId) {
    return { valid: false, error: "Vui lòng nhập Facebook Page ID." };
  }
  if (!token) {
    return { valid: false, error: "Vui lòng nhập Page Access Token." };
  }

  try {
    const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(
      pId
    )}?fields=id,name,picture.type(large)&access_token=${encodeURIComponent(
      token
    )}`;

    const res = await fetch(url, { method: "GET" });
    const data = await res.json();

    if (!res.ok || data.error) {
      const msg =
        data?.error?.message ||
        `Lỗi xác thực Meta Graph API (Mã HTTP: ${res.status})`;
      return {
        valid: false,
        error: msg,
      };
    }

    const avatarUrl = data.picture?.data?.url || "";
    return {
      valid: true,
      pageId: data.id || pId,
      pageName: data.name || "Facebook Fanpage",
      avatarUrl,
    };
  } catch (err: unknown) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ============================================================================
// 3. BOUNDED CONTEXT ENFORCEMENT & TARGET PAGES MANAGEMENT
// ============================================================================

/**
 * Lists all target pages configured in the system.
 */
export function listTargetPages(): TargetPageItem[] {
  return dbGetTargetPages();
}

/**
 * Gets a specific target page by internal ID.
 */
export function getTargetPage(id: string): TargetPageItem | null {
  return dbGetTargetPageById(id);
}

/**
 * Gets the active/default target page for publishing.
 */
export function getDefaultTargetPage(): TargetPageItem | null {
  return dbGetDefaultTargetPage();
}

/**
 * Creates or updates a Target Page.
 * Target Pages MUST have a Page ID and Page Access Token.
 */
export async function saveTargetPage(
  req: CreateTargetPageRequest | UpdateTargetPageRequest
): Promise<TargetPageItem> {
  if (!req.pageId || !req.pageId.trim()) {
    throw new Error("Target Page bắt buộc phải có Page ID.");
  }
  if (!req.accessToken || !req.accessToken.trim()) {
    throw new Error("Target Page bắt buộc phải có Page Access Token để cấp quyền đăng bài.");
  }

  const pId = req.pageId.trim();
  const name = req.pageName?.trim() || "Facebook Fanpage";
  const token = req.accessToken.trim();

  return dbSaveTargetPage({
    ...req,
    pageId: pId,
    pageName: name,
    accessToken: token,
  });
}

/**
 * Sets a Target Page as the default publishing destination.
 */
export function setDefaultTargetPage(id: string): TargetPageItem | null {
  const target = dbGetTargetPageById(id);
  if (!target) return null;

  return dbSaveTargetPage({
    ...target,
    isDefault: true,
  });
}

/**
 * Deletes a target page by internal ID.
 */
export function deleteTargetPage(id: string): boolean {
  return dbDeleteTargetPage(id);
}

/**
 * Bounded Context Invariant Check:
 * Enforces that publishing is ONLY permitted to registered Target Pages.
 */
export function canPublishToPage(pageIdOrTargetId: string): boolean {
  if (!pageIdOrTargetId || !pageIdOrTargetId.trim()) return false;
  const byId = dbGetTargetPageById(pageIdOrTargetId.trim());
  if (byId && byId.status === "active" && byId.accessToken) return true;

  const byPageId = dbGetTargetPageByPageId(pageIdOrTargetId.trim());
  if (byPageId && byPageId.status === "active" && byPageId.accessToken) return true;

  return false;
}

// ============================================================================
// 4. BOUNDED CONTEXT ENFORCEMENT & SOURCE PAGES MANAGEMENT
// ============================================================================

/**
 * Lists all source pages configured in the system.
 */
export function listSourcePages(): SourcePageItem[] {
  return dbGetSourcePages();
}

/**
 * Gets a source page by internal ID.
 */
export function getSourcePage(id: string): SourcePageItem | null {
  return dbGetSourcePageById(id);
}

/**
 * Creates or updates a Source Page.
 * Source Pages are monitored channels and NEVER have publishing rights.
 */
export async function saveSourcePage(
  req: CreateSourcePageRequest | UpdateSourcePageRequest
): Promise<SourcePageItem> {
  const mode = req.inputMode || "url_scrape";
  let targetUrl = req.url ? req.url.trim() : "";
  let pageId = req.pageId ? req.pageId.trim() : "";

  if (mode === "url_scrape") {
    if (!targetUrl) {
      throw new Error("Chế độ quét qua Link yêu cầu nhập URL Facebook Fanpage.");
    }
    const parsed = parseFacebookUrl(targetUrl);
    if (!parsed.isValid) {
      throw new Error(parsed.error || "URL Fanpage Facebook không hợp lệ.");
    }
    targetUrl = parsed.normalizedUrl;
    if (!pageId && parsed.slugOrId) {
      pageId = parsed.slugOrId;
    }
  } else if (mode === "graph_api") {
    if (!pageId && !targetUrl) {
      throw new Error("Chế độ Graph API yêu cầu nhập Page ID hoặc URL của Fanpage.");
    }
    if (!targetUrl) {
      targetUrl = `https://www.facebook.com/${pageId}`;
    }
  }

  // Auto-name if not provided
  let name = req.name ? req.name.trim() : "";
  if (!name) {
    if (pageId) {
      name = `Page ${pageId}`;
    } else {
      const match = targetUrl.match(/facebook\.com\/([^/?#]+)/);
      name = match ? match[1] : "Fanpage Nguồn";
    }
  }

  const limit = Math.max(1, Math.min(10, req.scanPostLimit ?? 5));

  return dbSaveSourcePage({
    ...req,
    name,
    url: targetUrl,
    pageId,
    inputMode: mode,
    scanPostLimit: limit,
  });
}

/**
 * Deletes a source page by internal ID.
 */
export function deleteSourcePage(id: string): boolean {
  return dbDeleteSourcePage(id);
}

/**
 * Updates telemetry/scan status for a source page.
 */
export function updateSourcePageScanTelemetry(
  id: string,
  update: {
    status?: PageStatus;
    lastScannedAt?: string;
    lastError?: string;
    incrementPosts?: number;
  }
): void {
  dbUpdateSourcePageScanStatus(id, update);
}
