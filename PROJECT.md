# Project: Facebook Content & Media Studio — Social SEO & Policy Upgrade

## Architecture
Next.js 15.2 (App Router), React 19, TypeScript 5.7, Tailwind CSS v4, Node.js 22 native `node:sqlite` (`DatabaseSync` in WAL mode at `data/app.db`).
The application is structured into:
- **Core Domain Services & Algorithms (`src/services/`)**:
  - `policyGuard.service.ts`: Facebook Policy Guard & Anti-Shadowban Scanner engine.
  - `socialSeo.service.ts`: Real-time Social SEO & Readability Scorecard (0-100) engine.
  - `goldenHours.service.ts`: Golden Hours 1-click scheduling calculator.
  - `hashtagEngine.service.ts`: 3-tier SEO hashtag generator.
  - `contentVariations.service.ts`: Multi-style prompt builder and A/B variations generator.
  - `db.service.ts`: Node native SQLite database access with dynamic runtime migrations (`ALTER TABLE`).
  - `facebookGraph.service.ts`: Meta Graph API integration with scheduled publish support.
- **Frontend Studio (`src/app/page.tsx` & `src/components/`)**:
  - 2-column layout: Left column for Topic/Hook/Execution/Tone selection, Right column for Scorecard, Policy Guard, A/B Variations, Image SEO, and 1-Click Scheduling Mockup.
- **Shared Types (`src/types/`)**:
  - `socialSeo.types.ts`: Comprehensive types for Policy Guard, SEO Scorecard, Golden Hours, Hashtags, Variations.
  - `facebook.types.ts`: Extended post history and publishing request types.
  - `ai.types.ts`: Extended image metadata and prompt options.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | Facebook Policy Guard Engine | Regex & dictionary scanner detecting absolute claims, curative health terms, phone numbers, spam links, financial hype, with safe replacements | M1 | ORIGINAL_REQUEST §R1 |
| F2 | Policy Guard Quick-Fix Action | 1-click text replacement and one-click auto-sanitize for all detected violations | M1, M2 | ORIGINAL_REQUEST §R1 |
| F3 | Social SEO Scorecard Engine (0-100) | Mathematical evaluation of 6 dimensions: 120-char entity hook (25p), keyword density 1-2.5% (20p), post length 250-500 words (20p), paragraph readability (15p), emoji count 3-10 (10p), comment CTA (10p) | M1 | ORIGINAL_REQUEST §R2 |
| F4 | Real-time Scorecard UI Widget | Visual score badge (0-100) with color gauge and dynamic checklist of passed/failed criteria | M2 | ORIGINAL_REQUEST §R2 |
| F5 | Golden Hours Calculator | 4 Vietnam peak engagement slots (07:30-08:30, 11:30-13:00, 19:30-21:30, 22:00-23:00) with auto today/tomorrow calculation | M1 | ORIGINAL_REQUEST §R3 |
| F6 | 1-Click Golden Hours Scheduling UI | 1-click preset buttons, schedule time badge, and integration with Facebook publish/save draft | M3 | ORIGINAL_REQUEST §R3 |
| F7 | 3-Tier Hashtag Generator | Structured hashtag engine: Tier 1 (Entity/Brand), Tier 2 (Topic/Industry), Tier 3 (Trend/Community) with sanitization | M1 | ORIGINAL_REQUEST §R4 |
| F8 | 3-Tier Hashtag UI & 1-Click Append | Color-coded chips for 3 tiers and "Chèn vào bài" action appending formatted hashtags | M3 | ORIGINAL_REQUEST §R4 |
| F9 | AI Image Alt Text & SEO Caption | Heuristic and AI generation of Vietnamese/English Alt Text and social photo captions for Flux.1 images | M1, M3 | ORIGINAL_REQUEST §R4 |
| F10 | Image Alt Text & Caption Inputs | Form fields in image module and display in Facebook mockup preview | M3 | ORIGINAL_REQUEST §R4 |
| F11 | A/B Content Style Presets | 4 conversion styles: Storytelling, Direct Sales, News/Guide, Humorous/Trend with specialized prompts | M1 | ORIGINAL_REQUEST §R5 |
| F12 | A/B Variations Editor & Tone Switcher | Step 3 Tone selection cards, multi-variation tabs in Final Post editor, and side-by-side comparison modal | M2 | ORIGINAL_REQUEST §R5 |
| F13 | SQLite Dynamic Schema Migration | Safe dynamic `ALTER TABLE ... ADD COLUMN` migration in `db.service.ts` for existing `data/app.db` | M1 | Survey Finding |
| F14 | Clean TypeScript Verification | Full project compiles cleanly with `npx tsc --noEmit` (0 errors) | M1, M2, M3, M4 | Acceptance Criteria |
| F15 | E2E Opaque-Box Test Suite | Comprehensive 4-tier test suite verifying R1-R5 functionality end-to-end | E2E Track | Project Pattern |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| E2E | E2E Testing Suite | Requirements-driven opaque-box test runner & Tiers 1-4 test cases | none | IN_PROGRESS |
| M1 | Core Domain Engines & DB Migration | Types (`socialSeo.types.ts`), DB dynamic migration (`db.service.ts`), Policy Scanner (`policyGuard.service.ts`), SEO Scorecard (`socialSeo.service.ts`), Golden Hours (`goldenHours.service.ts`), Hashtag Engine (`hashtagEngine.service.ts`), Variations Engine (`contentVariations.service.ts`), Prompt Engine update, API routes | none | IN_PROGRESS |
| M2 | Content Studio UI: SEO, Policy & A/B Variations | Scorecard Widget, Policy Guard visual box & quick-fix, Tone selector cards, A/B variation tabs, side-by-side comparison modal | M1 | PLANNED |
| M3 | Studio UI: Hashtags, Image SEO & Golden Hours Scheduling | 3-Tier Hashtag chips & append button, Image Alt Text & Caption fields + auto-generator, Golden Hours 1-click buttons & scheduling status | M1 | PLANNED |
| M4 | Final Milestone: E2E Pass & Adversarial Hardening | Pass 100% of E2E tests (Phase 1), Adversarial Coverage Hardening (Tier 5, Phase 2), `npx tsc --noEmit` clean verification | M1, M2, M3, E2E | PLANNED |

## Interface Contracts

### 1. Types Contract (`src/types/socialSeo.types.ts`)
```typescript
export type ContentStyleVariation = "storytelling" | "direct_sales" | "news_guide" | "humorous_trend";

export interface PolicyViolationItem {
  id: string;
  category: "absolute_claim" | "medical_curative" | "financial_hype" | "phone_spam" | "external_link" | "body_claim";
  severity: "high" | "medium" | "low";
  matchedText: string;
  startIndex: number;
  endIndex: number;
  label: string;
  explanation: string;
  suggestions: string[];
}

export interface PolicyScanResult {
  isSafe: boolean;
  riskScore: number;
  riskLevel: "safe" | "warning" | "danger";
  violations: PolicyViolationItem[];
}

export interface SeoCheckItem {
  id: string;
  label: string;
  passed: boolean;
  points: number;
  maxPoints: number;
  feedback: string;
}

export interface SocialSeoEvaluation {
  totalScore: number; // 0 - 100
  grade: "excellent" | "good" | "average" | "poor";
  metrics: {
    hookEntityPresent: boolean;
    hookCharacterCount: number;
    keywordDensityPercent: number;
    wordCount: number;
    paragraphCount: number;
    avgWordsPerParagraph: number;
    emojiCount: number;
    hasCommentCta: boolean;
  };
  checks: SeoCheckItem[];
}

export interface GoldenHourSlot {
  id: "morning" | "noon" | "evening" | "night";
  label: string;
  timeRange: string;
  isToday: boolean;
  formattedTarget: string;
  timestamp: string;
  isRecommendedPrime: boolean;
}

export interface ThreeTierHashtags {
  tier1Entity: string[];
  tier2Topic: string[];
  tier3Trend: string[];
  allCombined: string[];
  formattedBlock: string;
}

export interface ImageSeoMetadata {
  altText: string;
  caption: string;
}
```

### 2. Service Contracts (`src/services/`)
- `policyGuard.service.ts`:
  - `scanFacebookPolicy(text: string): PolicyScanResult`
  - `applyPolicyFix(text: string, violationId: string, suggestion: string): string`
  - `autoSanitizeAll(text: string): string`
- `socialSeo.service.ts`:
  - `evaluateSocialSeo(content: string, entity?: string, title?: string): SocialSeoEvaluation`
- `goldenHours.service.ts`:
  - `getGoldenHourPresets(referenceDate?: Date): GoldenHourSlot[]`
  - `getUpcomingPreset(id: GoldenHourSlot["id"], referenceDate?: Date): GoldenHourSlot`
- `hashtagEngine.service.ts`:
  - `generateThreeTierHashtags(title: string, entity?: string, content?: string): ThreeTierHashtags`
- `contentVariations.service.ts`:
  - `getStylePrompt(style: ContentStyleVariation): string`
  - `getAllStylePresets(): Array<{ id: ContentStyleVariation; name: string; desc: string; icon: string }>`

### 3. Database Schema Extensions (`src/services/db.service.ts`)
Dynamic migration function `runMigrations(db: DatabaseSync)` executed on `getDb()`:
- `facebook_posts` columns:
  - `scheduled_at TEXT`
  - `seo_score INTEGER DEFAULT 0`
  - `seo_breakdown TEXT DEFAULT ''`
  - `policy_warnings TEXT DEFAULT ''`
  - `policy_status TEXT DEFAULT 'clean'`
  - `hashtags TEXT DEFAULT ''`
  - `alt_text TEXT DEFAULT ''`
  - `image_caption TEXT DEFAULT ''`
  - `content_style TEXT DEFAULT 'standard'`
  - `variations_json TEXT DEFAULT ''`
- `ai_images` columns:
  - `alt_text TEXT DEFAULT ''`
  - `caption TEXT DEFAULT ''`

## Code Layout
- `src/types/socialSeo.types.ts` — Type definitions for R1-R5.
- `src/services/policyGuard.service.ts` — Policy scanning & replacement logic.
- `src/services/socialSeo.service.ts` — 0-100 SEO scoring logic.
- `src/services/goldenHours.service.ts` — Golden hours scheduling logic.
- `src/services/hashtagEngine.service.ts` — 3-tier hashtag generator.
- `src/services/contentVariations.service.ts` — A/B style variations configuration.
- `src/services/db.service.ts` — SQLite schema migrations & database access.
- `src/services/facebookGraph.service.ts` — Facebook publishing with scheduled post support.
- `src/app/page.tsx` — Main Content Studio UI with new widgets and controls.
- `tests/e2e/` — E2E test runner and test cases (Tiers 1-4).
