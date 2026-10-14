/**
 * Facebook Observer Account & Followed Pages Discovery Types
 * Allows connecting one or more Facebook accounts (via Public Profile URL/UID or User Access Token)
 * to discover the pages they follow/like and bulk-import them into Source Pages.
 */

export type ObserverAuthMode = "public_profile" | "user_token";
export type ObserverAccountStatus = "active" | "inactive";

export interface ObserverAccountItem {
  id: string;
  name: string;
  identifier: string; // Facebook Profile URL or UID or username
  authMode: ObserverAuthMode;
  userToken?: string;
  avatarUrl?: string;
  status: ObserverAccountStatus;
  lastScannedAt?: string;
  pagesDiscoveredCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateObserverAccountRequest {
  name: string;
  identifier: string;
  authMode: ObserverAuthMode;
  userToken?: string;
}

export interface UpdateObserverAccountRequest {
  name?: string;
  identifier?: string;
  authMode?: ObserverAuthMode;
  userToken?: string;
  status?: ObserverAccountStatus;
}

export interface DiscoveredPageItem {
  id: string;
  name: string;
  url: string;
  pageId?: string;
  avatarUrl?: string;
  category?: string;
  fanCount?: number;
  sourceAccountId: string;
  sourceAccountName: string;
  isAlreadyAdded: boolean;
}

export interface DiscoverPagesResult {
  success: boolean;
  totalDiscovered: number;
  newPagesCount: number;
  pages: DiscoveredPageItem[];
  error?: string;
}

export interface ImportDiscoveredPagesRequest {
  pages: Array<{
    name: string;
    url: string;
    pageId?: string;
    avatarUrl?: string;
    scanPostLimit?: number;
  }>;
}

export interface ImportDiscoveredPagesResult {
  success: boolean;
  importedCount: number;
  skippedCount: number;
  importedPages: Array<{ id: string; name: string; url: string }>;
  error?: string;
}
