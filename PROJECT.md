# Project: Facebook Content & Media Studio — Source Harvester, Smart Deduplication & Moderation Engine

## Architecture
Next.js 15.2 (App Router), React 19, TypeScript 5.7, Tailwind CSS v4, Node.js 24 native `node:sqlite` (`DatabaseSync` in WAL mode at `data/app.db`).
The application is structured into:
- **Core Domain Services & Algorithms (`src/services/`)**:
  - `pageManager.service.ts`: Bounded context separation between Target Pages (admin owned, token, auto-publish) and Source Pages (reference/inspiration monitoring, URL scraping or Graph API).
  - `postCollector.service.ts`: Post ingestion (1-10 posts), dual-mode scraper / Graph API, 2-layer deduplication (`facebook_post_id` + SHA-256 `content_hash`), and media downloader to `public/uploads/source_media`.
  - `evergreenFallback.service.ts`: Fallback engine when all recent posts are already collected ("Tất cả bài gần nhất đều đã được lấy"), ranking past posts (> 15-30 days) by engagement.
  - `repurposeEngine.service.ts`: AI multi-style unique rewriting engine using Gemini 30-key pool (`geminiKeyPool.service.ts`), chained with `policyGuard.service.ts` auto-sanitizing and `hashtagEngine.service.ts` 3-tier hashtags.
  - `moderationQueue.service.ts`: State machine and repository for pending review posts (`pending` -> `approved` / `scheduled` / `published` / `rejected`).
  - `facebookGraph.service.ts`: Meta Graph API integration with local file buffer streaming and multi-photo album posts (`attached_media`).
  - `db.service.ts`: SQLite dynamic migration and queries for `target_pages`, `source_pages`, `source_posts`, `moderation_queue`.
- **Frontend Studio & Moderation (`src/app/` & `src/components/`)**:
  - `/settings`: Tabbed Page Manager separating "Fanpage Đăng Bài (Target)" and "Fanpage Nguồn Theo Dõi (Source)".
  - `/queue`: Human-in-the-loop Moderation Queue with Side-by-Side comparison (Source Post vs AI Rewritten Post), real-time Social SEO Scorecard (0-100), Policy Guard, Golden Hours presets, Target Page selector, and 4 action buttons.
  - Sidebar Navigation (`AppShell.tsx`): Direct link to `/queue` ("Hàng Đợi Duyệt Bài").
- **Shared Types (`src/types/`)**:
  - `sourcePage.types.ts`: Target and Source page models, input modes (`url_scrape` vs `graph_api`).
  - `sourcePost.types.ts`: Collected post items, deduplication results, media download paths, evergreen candidates.
  - `repurpose.types.ts`: Moderation queue items, rewrite requests, queue action payloads.
  - `socialSeo.types.ts`, `facebook.types.ts`: Existing Social SEO, Policy, and Facebook types.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | Bounded Context Page Separation | Strict domain split between owned Target Pages (with credentials & write rights) and monitored Source Pages (zero write rights) | M1 | ORIGINAL_REQUEST §R1 |
| F2 | Dual Input Mode Source Pages | Support adding Source Pages via public Facebook URL/Link or via Graph API ID/Token | M1 | ORIGINAL_REQUEST §R1 |
| F3 | Tabbed Page Manager UI | Settings UI with dedicated tabs for Target Pages and Source Pages with status indicators | M1 | ORIGINAL_REQUEST §R1 |
| F4 | SQLite Bounded Schema Migration | Dynamic creation and migration of `target_pages`, `source_pages`, `source_posts`, and `moderation_queue` | M1 | Survey Finding |
| F5 | Configurable Post Collector (1-10) | Collect 1 to 10 latest posts from Source Pages via Graph API or public web extraction | M2 | ORIGINAL_REQUEST §R2 |
| F6 | Media Downloader to `public/uploads/source_media` | Download and persist remote images locally with collision-proof naming and static web serving | M2 | ORIGINAL_REQUEST §R2 |
| F7 | 2-Layer Smart Deduplication | Prevent duplicate collection using `facebook_post_id` and SHA-256 `content_hash` | M2 | ORIGINAL_REQUEST §R2 |
| F8 | Evergreen Content Fallback (>15-30 days) | Detect when all latest posts are collected, display exact notice "Tất cả bài gần nhất đều đã được lấy", suggest high-engagement past post | M2 | ORIGINAL_REQUEST §R2 |
| F9 | Gemini 30-Key Pool Integration | AI rewriter utilizing round-robin key rotation, quota backoff, and model fallback chain | M3 | ORIGINAL_REQUEST §R3 |
| F10 | Unique Anti-Verbatim Content Rewriter | AI prompt extracting core message and generating 100% unique Vietnamese hook & copy across 4 styles | M3 | ORIGINAL_REQUEST §R3 |
| F11 | Auto-Policy Guard & 3-Tier Hashtags Chaining | Automatically sanitize sensitive words and append 3-tier hashtags to AI repurposed posts | M3 | ORIGINAL_REQUEST §R3 |
| F12 | Source Media Attachment Linking | Link downloaded source photos from `public/uploads/source_media` to repurposed posts | M3 | ORIGINAL_REQUEST §R3 |
| F13 | Side-by-Side Moderation Queue UI | Split-view interface comparing original source post (left) and editable AI rewritten post (right) | M4 | ORIGINAL_REQUEST §R4 |
| F14 | Interactive Moderation Actions | 4 action buttons: Approve & Publish Now, Approve & Schedule, Request AI Revision, Reject / Delete | M4 | ORIGINAL_REQUEST §R4 |
| F15 | Enhanced Graph API Media Publishing | Stream local file buffers from `public/uploads/source_media` and support multi-photo album posts | M4 | Survey Finding |
| F16 | Opaque-Box E2E Test Suite | Comprehensive 4-tier test suite covering R1-R4 workflows end-to-end | E2E Track | Project Pattern |
| F17 | Clean Typecheck & Build Verification | Zero errors on `npx tsc --noEmit` and clean compilation on `npm run build` | M5 | Acceptance Criteria |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| E2E | E2E Testing Suite (R1-R4) | Requirements-driven opaque-box test runner & Tiers 1-4 test cases for R1-R4 | none | DONE |
| M1 | Bounded Context & Page Management (R1) | Types (`sourcePage.types.ts`), DB migrations (`db.service.ts`), `pageManager.service.ts`, API endpoints (`/api/pages/...`), Settings UI tabs | none | DONE |
| M2 | Post Collector, Deduplication & Evergreen (R2) | `sourcePost.types.ts`, `postCollector.service.ts`, media downloader (`public/uploads/source_media`), SHA-256 deduplication, evergreen fallback engine, API routes | M1 | IN_PROGRESS |
| M3 | AI Repurposing Engine (R3) | `repurpose.types.ts`, `repurposeEngine.service.ts` using Gemini 30-key pool, anti-verbatim prompts, auto-policy & hashtag chaining, media linking, API route | M1, M2 | PLANNED |
| M4 | Moderation Queue UI & Publishing (R4) | `moderationQueue.service.ts`, Side-by-Side `/queue` page, 4 moderation actions, enhanced local media publishing in `facebookGraph.service.ts` | M1, M2, M3 | PLANNED |
| M5 | Final Milestone: E2E 100% Pass, Build & Hardening | Pass 100% E2E tests (Tiers 1-4), Adversarial Hardening (Tier 5), `npx tsc --noEmit` 0 errors, `npm run build` success | M1, M2, M3, M4, E2E | PLANNED |

## Interface Contracts

### 1. Page Context Contract (`src/types/sourcePage.types.ts`)
```typescript
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
```

### 2. Post Collection & Deduplication Contract (`src/types/sourcePost.types.ts`)
```typescript
export type SourcePostStatus = "collected" | "rewritten" | "ignored" | "evergreen_repurposed";

export interface SourcePostItem {
  id: string;
  sourcePageId: string;
  facebookPostId: string;
  contentHash: string; // SHA-256 of normalized content
  originalContent: string;
  mediaUrls: string[]; // local paths e.g. ["/uploads/source_media/spost_123_0.jpg"]
  originalMediaUrls?: string[];
  publishedTime: string; // ISO 8601
  likeCount: number;
  commentCount: number;
  shareCount: number;
  status: SourcePostStatus;
  collectedAt: string;
  evergreenSelectedAt?: string;
  rewrittenAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CollectPostsResult {
  success: boolean;
  sourcePageId: string;
  totalScanned: number;
  newCollected: number;
  duplicatesSkipped: number;
  allAlreadyCollected: boolean;
  message: string;
  posts: SourcePostItem[];
  evergreenSuggestion?: SourcePostItem | null;
}
```

### 3. Repurposing & Moderation Queue Contract (`src/types/repurpose.types.ts`)
```typescript
import { ContentStyleVariation, PolicyScanResult, SocialSeoEvaluation } from "./socialSeo.types";

export type QueueItemStatus = "pending" | "approved" | "scheduled" | "published" | "rejected";

export interface ModerationQueueItem {
  id: string;
  sourcePostId: string;
  sourcePageId: string;
  sourcePageName: string;
  sourceUrl?: string;
  sourcePublishedTime?: string;
  sourceContent: string;
  sourceImages: string[];
  targetPageId: string;
  targetPageName: string;
  aiHeadline: string;
  aiHook: string;
  aiBody: string;
  aiFullPost: string;
  contentStyle: ContentStyleVariation;
  selectedImages: string[];
  altText?: string;
  imageCaption?: string;
  seoScore: number;
  seoBreakdown?: SocialSeoEvaluation;
  policyStatus: "clean" | "warning" | "danger";
  policyWarnings: PolicyScanResult["violations"];
  hashtags: string[];
  status: QueueItemStatus;
  scheduledAt?: string;
  publishedAt?: string;
  fbPostId?: string;
  fbPostUrl?: string;
  errorMessage?: string;
  rewriteCount: number;
  lastRewritePrompt?: string;
  createdAt: string;
  updatedAt: string;
}
```

## Code Layout
- `src/types/sourcePage.types.ts` — Target and Source Page types.
- `src/types/sourcePost.types.ts` — Collected post, deduplication, and evergreen types.
- `src/types/repurpose.types.ts` — Moderation queue, AI rewriter types.
- `src/services/pageManager.service.ts` — CRUD & validation for Target and Source pages.
- `src/services/postCollector.service.ts` — Ingestion, deduplication, and media download.
- `src/services/evergreenFallback.service.ts` — Evergreen candidate selection.
- `src/services/repurposeEngine.service.ts` — Gemini 30-key rewriter, anti-verbatim, policy/hashtag chaining.
- `src/services/moderationQueue.service.ts` — Moderation queue state management and actions.
- `src/services/facebookGraph.service.ts` — Meta publishing with local buffer streaming and albums.
- `src/services/db.service.ts` — Database schema dynamic migrations and queries.
- `src/app/settings/page.tsx` — Tabbed settings UI (Target vs Source pages).
- `src/app/queue/page.tsx` — Side-by-Side Moderation Queue UI.
- `src/components/layout/AppShell.tsx` — Navigation bar linking to `/queue`.
- `public/uploads/source_media/` — Local media storage directory.
- `tests/e2e/` — Opaque-box test suite for R1-R4.
