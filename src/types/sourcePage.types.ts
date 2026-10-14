/**
 * Source & Target Page Domain Types and Contracts
 * Bounded Context:
 * - Target Pages (Fanpage Đích): Owned pages, requires access token, has publishing rights.
 * - Source Pages (Fanpage Nguồn): Reference/monitored channels, zero publishing rights.
 */

export type SourcePageInputMode = "url_scrape" | "graph_api";
export type PageStatus = "active" | "paused" | "error" | "token_expired";

export interface TargetPageItem {
  id: string;
  pageId: string;
  pageName: string;
  accessToken: string;
  avatarUrl?: string;
  isDefault: boolean;
  status: PageStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SourcePageItem {
  id: string;
  name: string;
  url: string;
  pageId?: string;
  inputMode: SourcePageInputMode;
  accessToken?: string;
  avatarUrl?: string;
  scanPostLimit: number; // 1 to 10, default 5
  status: PageStatus;
  lastScannedAt?: string;
  lastError?: string;
  totalPostsScanned: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// DTOs & API Request / Response Types
// ============================================================================

export interface CreateTargetPageRequest {
  pageId: string;
  pageName: string;
  accessToken: string;
  avatarUrl?: string;
  isDefault?: boolean;
}

export interface UpdateTargetPageRequest {
  id: string;
  pageId?: string;
  pageName?: string;
  accessToken?: string;
  avatarUrl?: string;
  isDefault?: boolean;
  status?: PageStatus;
}

export interface CreateSourcePageRequest {
  name: string;
  url: string;
  pageId?: string;
  inputMode: SourcePageInputMode;
  accessToken?: string;
  avatarUrl?: string;
  scanPostLimit?: number; // 1 to 10
}

export interface UpdateSourcePageRequest {
  id: string;
  name?: string;
  url?: string;
  pageId?: string;
  inputMode?: SourcePageInputMode;
  accessToken?: string;
  avatarUrl?: string;
  scanPostLimit?: number;
  status?: PageStatus;
}

export interface ParsedFacebookUrl {
  isValid: boolean;
  normalizedUrl: string;
  slugOrId?: string;
  identifierType: "slug" | "id" | "unknown";
  error?: string;
}

export interface TokenValidationResult {
  valid: boolean;
  pageId?: string;
  pageName?: string;
  avatarUrl?: string;
  error?: string;
}

export interface TargetPagesApiResponse {
  success: boolean;
  pages?: TargetPageItem[];
  page?: TargetPageItem;
  error?: string;
  validation?: TokenValidationResult;
}

export interface SourcePagesApiResponse {
  success: boolean;
  pages?: SourcePageItem[];
  page?: SourcePageItem;
  error?: string;
  parsedUrl?: ParsedFacebookUrl;
}
