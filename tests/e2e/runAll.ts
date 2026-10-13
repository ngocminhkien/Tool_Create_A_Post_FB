/**
 * tests/e2e/runAll.ts
 * Unified Master E2E Test Runner for Facebook Content & Media Studio
 * Executes Tiers 1-4 sequentially, formats comprehensive tier reports,
 * asserts 100% pass rate, and exits with 0 on success (or 1 on failure).
 */

import { performance } from "node:perf_hooks";
import { runTier1F1Tests } from "./tier1/f1_policy_guard.test";
import { runTier1F2Tests } from "./tier1/f2_policy_quick_fix.test";
import { runTier1F3Tests } from "./tier1/f3_social_seo_engine.test";
import { runTier1F4Tests } from "./tier1/f4_scorecard_widget.test";
import { runTier1F5Tests } from "./tier1/f5_golden_hours_calculator.test";
import { runTier1F6Tests } from "./tier1/f6_golden_hours_scheduling.test";
import { runTier1F7Tests } from "./tier1/f7_hashtag_generator.test";
import { runTier1F8Tests } from "./tier1/f8_hashtag_append_ui.test";
import { runTier1F9Tests } from "./tier1/f9_ai_image_alt_text.test";
import { runTier1F10Tests } from "./tier1/f10_image_alt_inputs_db.test";
import { runTier1F11Tests } from "./tier1/f11_ab_style_presets.test";
import { runTier1F12Tests } from "./tier1/f12_ab_variations_editor.test";
import { runTier1F13Tests } from "./tier1/f13_sqlite_migration.test";
import { runTier1F14Tests } from "./tier1/f14_clean_typescript.test";
import { runTier2BoundaryTests } from "./tier2/boundary_corner_cases.test";
import { runTier3CombinationTests } from "./tier3/cross_feature_combinations.test";
import { runTier4ScenarioTests } from "./tier4/real_world_scenarios.test";
import { TestSuiteSummary, TestResultItem } from "./types";

interface SuiteExecutionEntry {
  tier: number;
  feature: string;
  name: string;
  fn: () => Promise<TestSuiteSummary>;
}

const SUITE_REGISTRY: SuiteExecutionEntry[] = [
  // Tier 1: Feature Coverage in Isolation (F1 - F14)
  { tier: 1, feature: "F1", name: "Facebook Policy Guard Scanner", fn: runTier1F1Tests },
  { tier: 1, feature: "F2", name: "Policy Guard Quick-Fix Action", fn: runTier1F2Tests },
  { tier: 1, feature: "F3", name: "Social SEO Scorecard Engine", fn: runTier1F3Tests },
  { tier: 1, feature: "F4", name: "Scorecard Widget Contract", fn: runTier1F4Tests },
  { tier: 1, feature: "F5", name: "Golden Hours Calculator", fn: runTier1F5Tests },
  { tier: 1, feature: "F6", name: "Golden Hours 1-Click Scheduling", fn: runTier1F6Tests },
  { tier: 1, feature: "F7", name: "3-Tier Hashtag Generator", fn: runTier1F7Tests },
  { tier: 1, feature: "F8", name: "Hashtag Append Action Contract", fn: runTier1F8Tests },
  { tier: 1, feature: "F9", name: "AI Image Alt Text & SEO Caption", fn: runTier1F9Tests },
  { tier: 1, feature: "F10", name: "Image Alt Text & Caption DB Persistence", fn: runTier1F10Tests },
  { tier: 1, feature: "F11", name: "A/B Content Style Presets", fn: runTier1F11Tests },
  { tier: 1, feature: "F12", name: "A/B Variations Editor Contract", fn: runTier1F12Tests },
  { tier: 1, feature: "F13", name: "SQLite Dynamic Schema Migration", fn: runTier1F13Tests },
  { tier: 1, feature: "F14", name: "Clean TypeScript Verification", fn: runTier1F14Tests },

  // Tier 2: Boundary & Corner Cases (F1 - F14)
  { tier: 2, feature: "F1-F14", name: "Boundary & Corner Cases", fn: runTier2BoundaryTests },

  // Tier 3: Cross-Feature Combinations (Pairwise)
  { tier: 3, feature: "COMB", name: "Cross-Feature Combinations", fn: runTier3CombinationTests },

  // Tier 4: Real-World Editorial Scenarios
  { tier: 4, feature: "SCENARIOS", name: "Real-World Editorial Scenarios", fn: runTier4ScenarioTests },
];

export async function runAllSuites(): Promise<{
  totalSuites: number;
  totalTests: number;
  totalPassed: number;
  totalFailed: number;
  durationMs: number;
  summaries: TestSuiteSummary[];
  allPassed: boolean;
}> {
  const globalStart = performance.now();
  const summaries: TestSuiteSummary[] = [];

  console.log(`\n` + "=".repeat(75));
  console.log(`  FACEBOOK CONTENT & MEDIA STUDIO — UNIFIED E2E TEST RUNNER`);
  console.log(`  Node.js: ${process.version} | Platform: ${process.platform} | Time: ${new Date().toISOString()}`);
  console.log("=".repeat(75) + `\n`);

  let currentTier = -1;

  for (const entry of SUITE_REGISTRY) {
    if (entry.tier !== currentTier) {
      currentTier = entry.tier;
      console.log(`\n>>> STARTING TIER ${currentTier} EXECUTION <<<`);
      console.log("-".repeat(75));
    }

    const suiteStart = performance.now();
    try {
      const summary = await entry.fn();
      summaries.push(summary);

      const statusBadge = summary.failed === 0 ? "✓ PASS" : `✗ FAIL (${summary.failed})`;
      console.log(
        `  [${statusBadge}] Tier ${entry.tier} | ${entry.feature.padEnd(8)} | ${summary.suiteName.padEnd(38)} | ${String(summary.passed).padStart(2)}/${String(summary.total).padEnd(2)} passed (${summary.durationMs}ms)`
      );
    } catch (err: any) {
      const suiteDuration = Math.round((performance.now() - suiteStart) * 100) / 100;
      const failedSummary: TestSuiteSummary = {
        suiteName: entry.name,
        tier: entry.tier,
        total: 1,
        passed: 0,
        failed: 1,
        durationMs: suiteDuration,
        results: [
          {
            name: `${entry.name} runner crashed`,
            tier: entry.tier,
            feature: entry.feature,
            passed: false,
            durationMs: suiteDuration,
            error: err?.stack || String(err),
          },
        ],
      };
      summaries.push(failedSummary);
      console.error(`  [✗ CRASH] Tier ${entry.tier} | ${entry.feature} | ${entry.name} failed to execute:`);
      console.error(`    ${err?.message || err}`);
    }
  }

  const globalDuration = Math.round((performance.now() - globalStart) * 100) / 100;

  // Aggregate metrics
  let totalTests = 0;
  let totalPassed = 0;
  let totalFailed = 0;
  const failures: TestResultItem[] = [];

  for (const s of summaries) {
    totalTests += s.total;
    totalPassed += s.passed;
    totalFailed += s.failed;
    for (const r of s.results) {
      if (!r.passed) {
        failures.push(r);
      }
    }
  }

  // Print Tier Breakdown
  console.log(`\n` + "=".repeat(75));
  console.log(`                       TIER BREAKDOWN REPORT`);
  console.log("=".repeat(75));

  const tierGroups = [1, 2, 3, 4];
  for (const t of tierGroups) {
    const tierSummaries = summaries.filter((s) => s.tier === t);
    const tTotal = tierSummaries.reduce((acc, s) => acc + s.total, 0);
    const tPassed = tierSummaries.reduce((acc, s) => acc + s.passed, 0);
    const tFailed = tierSummaries.reduce((acc, s) => acc + s.failed, 0);
    const tDuration = Math.round(tierSummaries.reduce((acc, s) => acc + s.durationMs, 0) * 100) / 100;
    const tPct = tTotal > 0 ? Math.round((tPassed / tTotal) * 100) : 0;
    const tStatus = tFailed === 0 ? "✓ ALL PASSED" : `✗ ${tFailed} FAILED`;

    console.log(
      `  Tier ${t}: ${String(tPassed).padStart(3)}/${String(tTotal).padEnd(3)} tests passed (${tPct}%) | ${String(tDuration + "ms").padStart(9)} | ${tStatus}`
    );
  }

  console.log("=".repeat(75));
  console.log(`                       GRAND SUMMARY METRICS`);
  console.log("=".repeat(75));
  console.log(`  Total Test Suites   : ${summaries.length}`);
  console.log(`  Total Test Cases    : ${totalTests}`);
  console.log(`  Tests Passed        : ${totalPassed} (${Math.round((totalPassed / totalTests) * 100)}%)`);
  console.log(`  Tests Failed        : ${totalFailed}`);
  console.log(`  Total Wall Time     : ${globalDuration}ms`);
  console.log("=".repeat(75));

  if (failures.length > 0) {
    console.error(`\n❌ FAILURES DETECTED (${failures.length} failing tests):`);
    for (const f of failures) {
      console.error(`  - [Tier ${f.tier}] [${f.feature}] ${f.name}`);
      if (f.error) {
        console.error(`    ${f.error.split("\n")[0]}`);
      }
    }
    console.log(`\n`);
  } else {
    console.log(`\n🎉 [100% SUCCESS] All ${totalTests} E2E test cases passed cleanly!`);
    console.log(`   Quality Gates Met: Tier 1 (Isolation), Tier 2 (Boundaries), Tier 3 (Cross-Feature), Tier 4 (Real-World Scenarios).\n`);
  }

  const allPassed = totalFailed === 0;
  return {
    totalSuites: summaries.length,
    totalTests,
    totalPassed,
    totalFailed,
    durationMs: globalDuration,
    summaries,
    allPassed,
  };
}

// Direct invocation handler
if (
  import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}` ||
  process.argv[1]?.replace(/\\/g, "/").endsWith("tests/e2e/runAll.ts")
) {
  runAllSuites()
    .then((result) => {
      process.exit(result.allPassed ? 0 : 1);
    })
    .catch((err) => {
      console.error("Fatal error executing test runner:", err);
      process.exit(1);
    });
}
