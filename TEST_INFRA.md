# TEST_INFRA.md — Facebook Content & Media Studio Test Infrastructure

## 1. Overview & Test Philosophy

### 1.1 Opaque-Box Requirements-Driven Methodology
The testing infrastructure for the Facebook Content & Media Studio upgrade operates strictly on an **opaque-box, contract-driven methodology**. Test suites are derived directly from user requirements (`ORIGINAL_REQUEST.md` § R1-R5) and the project architectural specification (`PROJECT.md` § Feature Inventory F1-F14). 

The test harness evaluates system behavior through public interface contracts and observable outputs without relying on internal implementation details. Tests never modify production source code under `src/` and run safely in any environment.

### 1.2 Expected Output Derivation
Every test assertion is anchored in an authoritative source of truth:
1. **R1: Policy Guard & Anti-Shadowban**: Meta Content Guidelines & Facebook Ad Policy dictionary (prohibiting absolute promises, unverified curative claims, exposed raw phone numbers, spam redirects, aggressive get-rich-quick claims, and misleading before/after physical assertions).
2. **R2: Social SEO & Readability (0-100)**: Mathematical scoring formula evaluating 6 distinct dimensions: 120-char entity hook (25 pts), keyword density 1.0-2.5% (20 pts), post length 250-500 words (20 pts), paragraph readability (15 pts), emoji count 3-10 (10 pts), and comment-provoking CTA (10 pts).
3. **R3: Golden Hours 1-Click Scheduling**: Official Vietnam Facebook engagement peaks (Morning 07:30-08:30, Noon 11:30-13:00, Evening Prime 19:30-21:30, Night 22:00-23:00) with UTC+7 calendar math and Meta Graph API unix timestamp constraints.
4. **R4: 3-Tier Hashtags & AI Image SEO**: Facebook algorithm 3-tier hashtag structure (Tier 1: Entity/Brand, Tier 2: Topic/Industry, Tier 3: Trend/Community) and WCAG-compliant accessible image Alt Text with localized Social SEO photo captions.
5. **R5: A/B Content Style Variations**: 4 distinct conversion tones (Storytelling, Direct Sales, News/Guide, Humorous/Trend) verifying prompt structures and variation payloads.
6. **Data & Infrastructure Integrity**: Node.js 22 native `node:sqlite` dynamic schema migrations (`ALTER TABLE ... ADD COLUMN`) maintaining backward compatibility and idempotency.

---

## 2. Feature Inventory Matrix (F1 through F14)

| Feature | Name | Source Req | Service / Component Contract | Target File | Tier 1 (Min Cases) | Tier 2 (Min Cases) | Tier 3 & 4 Included |
|---|---|---|---|---|---|---|---|
| **F1** | Facebook Policy Guard Engine | R1 | `scanFacebookPolicy(text): PolicyScanResult` | `policyGuard.service.ts` | >=5 | >=5 | Yes |
| **F2** | Policy Guard Quick-Fix Action | R1 | `applyPolicyFix()`, `autoSanitizeAll()` | `policyGuard.service.ts` | >=5 | >=5 | Yes |
| **F3** | Social SEO Scorecard Engine (0-100) | R2 | `evaluateSocialSeo(content, entity, title)` | `socialSeo.service.ts` | >=5 | >=5 | Yes |
| **F4** | Real-time Scorecard UI Widget | R2 | Checklist items, feedback text, color grade badges | UI / Engine contract | >=5 | >=5 | Yes |
| **F5** | Golden Hours Calculator | R3 | `getGoldenHourPresets()`, `getUpcomingPreset()` | `goldenHours.service.ts` | >=5 | >=5 | Yes |
| **F6** | 1-Click Golden Hours Scheduling UI | R3 | Scheduling payload, Facebook Graph API timestamp | `facebookGraph.service.ts` | >=5 | >=5 | Yes |
| **F7** | 3-Tier Hashtag Generator | R4 | `generateThreeTierHashtags()` | `hashtagEngine.service.ts` | >=5 | >=5 | Yes |
| **F8** | 3-Tier Hashtag UI & 1-Click Append | R4 | Color chips, append action with delimiter spacing | UI / Engine contract | >=5 | >=5 | Yes |
| **F9** | AI Image Alt Text & SEO Caption | R4 | Alt Text generation & SEO photo caption | `promptEngine.service.ts` | >=5 | >=5 | Yes |
| **F10** | Image Alt Text & Caption Form Inputs & DB | R4 | Form input schema, `facebook_posts` & `ai_images` columns | `db.service.ts` | >=5 | >=5 | Yes |
| **F11** | A/B Content Style Presets | R5 | `getStylePrompt()`, `getAllStylePresets()` | `contentVariations.service.ts` | >=5 | >=5 | Yes |
| **F12** | A/B Variations Editor & Tone Switcher | R5 | Tab switching, variation JSON storage, comparison | UI / Engine contract | >=5 | >=5 | Yes |
| **F13** | SQLite Dynamic Schema Migration | Survey | `runMigrations(db)`, safe `ALTER TABLE` execution | `db.service.ts` | >=5 | >=5 | Yes |
| **F14** | Clean TypeScript Verification | All | Zero compile errors (`npx tsc --noEmit`) | Project root | >=5 | >=5 | Yes |

---

## 3. Test Architecture & Runner Design

```
tests/e2e/
├── types.ts                        # Interface contracts and test payload schemas
├── harness/
│   ├── serviceLoader.ts            # Dynamic service loader (loads src/services or oracle fallback)
│   ├── referenceOracle.ts          # Authoritative specification oracle for derivation
│   └── testDb.ts                   # Isolated in-memory/temp SQLite database instance manager
├── tier1/                          # Feature Coverage (>=5 test cases per feature in isolation)
│   ├── f1_policy_guard.test.ts
│   ├── f2_policy_quick_fix.test.ts
│   ├── f3_social_seo_engine.test.ts
│   ├── f4_scorecard_widget.test.ts
│   ├── f5_golden_hours_calculator.test.ts
│   ├── f6_golden_hours_scheduling.test.ts
│   ├── f7_hashtag_generator.test.ts
│   ├── f8_hashtag_append_ui.test.ts
│   ├── f9_ai_image_alt_text.test.ts
│   ├── f10_image_alt_inputs_db.test.ts
│   ├── f11_ab_style_presets.test.ts
│   ├── f12_ab_variations_editor.test.ts
│   ├── f13_sqlite_migration.test.ts
│   └── f14_clean_typescript.test.ts
├── tier2/                          # Boundary & Corner Cases (>=5 test cases per feature)
│   └── boundary_corner_cases.test.ts
├── tier3/                          # Cross-Feature Combinations (pairwise interactions)
│   └── cross_feature_combinations.test.ts
├── tier4/                          # Real-World Editorial Scenarios (end-to-end editorial journeys)
│   └── real_world_scenarios.test.ts
└── runAll.ts                       # Unified test runner with colorized tier reports & exit codes
```

### 3.1 Dual-Mode Service Loader
The runner uses `tests/e2e/harness/serviceLoader.ts` to bridge tests with application services:
- When production services under `src/services/` are compiled and present on disk, `serviceLoader` dynamically imports them, executing tests directly against the live implementation.
- While milestone workers are still in progress, `serviceLoader` references `tests/e2e/harness/referenceOracle.ts` to verify the mathematical and logical validity of all test cases and expectations ahead of time.
- All database tests run on isolated in-memory instances (`:memory:`) created via `tests/e2e/harness/testDb.ts`, guaranteeing **zero mutation** of the user's active database at `data/app.db`.

---

## 4. Test Tiers Specification

### Tier 1: Feature Coverage (Isolation)
Tests each feature (F1 through F14) in complete isolation with at least 5 distinct test cases per feature (70+ test cases total). Every primary capability, rule trigger, and return signature is explicitly exercised.

### Tier 2: Boundary & Corner Cases (Extremes)
Tests each feature against extreme conditions (at least 5 cases per feature = 70+ test cases total):
- Vietnamese complex Unicode diacritics (e.g. `tiếng Việt`, `thuốc đặc trị`, `khỏe mạnh`, `phòng khám`).
- Empty strings, whitespace-only, single-character, and extremely long texts (>10,000 words).
- Zero-keyword, extreme keyword stuffing (>20% density).
- Boundary lengths (249 words, 250 words, 500 words, 501 words).
- Midnight / edge-of-hour timestamp transitions for Golden Hours.
- Special punctuation, emoji overloads, hashtags with hyphens, underscores, dots, and symbols.
- Database SQL injection strings, duplicate migrations, and schema concurrency.

### Tier 3: Cross-Feature Combinations (Pairwise)
Tests the interaction between multiple features operating together:
1. Policy Guard + Quick-Fix + Social SEO Scorecard re-evaluation.
2. Golden Hours Calculator + 1-Click Scheduling + SQLite Post Persistence.
3. 3-Tier Hashtags + Social SEO Keyword Hook + Alt Text generation.
4. A/B Content Style Variations + Policy Guard scanning per variation.
5. Complete Post Publishing Flow (Title + Entity + Style + Scorecard + Hashtag Block + Alt Text + Golden Hour Slot).

### Tier 4: Real-World Application Scenarios
Executes 5 complete end-to-end editorial workflows matching real Vietnamese Facebook marketing campaigns:
1. **Scenario 1: Spa & Skincare Post (Policy Heavy)**: Detects sensitive curative claims, applies auto-sanitize, generates Tier 1-3 hashtags, computes SEO score, and schedules for Evening Prime (20:00).
2. **Scenario 2: E-Commerce Gadget Flash Sale (Sales Hook)**: Direct sales angle, 120-char entity hook, keyword density validation, product image Alt Text & caption, scheduled for Noon (12:00).
3. **Scenario 3: Healthcare / Dental Clinic Awareness (Anti-Shadowban)**: Replaces phone spam and curative terms, generates community hashtags, verifies readability.
4. **Scenario 4: Educational Coding Academy Guide (Storytelling Angle)**: Long-form guide, checks paragraph readability, emoji density, CTA comment trigger, scheduled for Night (22:30).
5. **Scenario 5: Viral Food & Beverage Review (Humorous/Trend Angle)**: Emoji rich, trend hashtags, Alt Text with delicious visual descriptions, scheduled for Morning (08:00).

---

## 5. Coverage Thresholds & Quality Gates

1. **Test Pass Rate**: 100% of all executed tests must pass.
2. **Test Quantity**:
   - Tier 1: >= 70 test cases (>=5 for each of F1-F14).
   - Tier 2: >= 70 test cases (>=5 for each of F1-F14).
   - Tier 3: >= 10 combination test cases.
   - Tier 4: >= 5 real-world scenario test cases.
   - Total Suite: **>= 155 test cases**.
3. **TypeScript Health**: `npx tsc --noEmit` must pass with **0 errors**.
4. **Data Isolation**: 0 mutations to `data/app.db`. All tests use isolated in-memory SQLite databases.

---

## 6. How to Run Tests

### Run Full Test Suite
```bash
npx tsx tests/e2e/runAll.ts
```

### Run Specific Tiers
```bash
# Tier 1 Feature Coverage
npx tsx tests/e2e/tier1/f1_policy_guard.test.ts
npx tsx tests/e2e/tier1/f3_social_seo_engine.test.ts
npx tsx tests/e2e/tier1/f5_golden_hours_calculator.test.ts

# Tier 2 Boundary & Corner Cases
npx tsx tests/e2e/tier2/boundary_corner_cases.test.ts

# Tier 3 Cross-Feature Combinations
npx tsx tests/e2e/tier3/cross_feature_combinations.test.ts

# Tier 4 Real-World Editorial Scenarios
npx tsx tests/e2e/tier4/real_world_scenarios.test.ts
```

### Typecheck Test Suite
```bash
npx tsc --noEmit
```
