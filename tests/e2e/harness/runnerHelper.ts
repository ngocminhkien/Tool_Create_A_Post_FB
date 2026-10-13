/**
 * tests/e2e/harness/runnerHelper.ts
 * Shared assertion and suite summary utilities for opaque-box E2E tests.
 */

import { TestResultItem, TestSuiteSummary } from "../types";

export type TestFn = () => Promise<void> | void;

export interface TestDef {
  name: string;
  fn: TestFn;
}

export class TestRunnerContext {
  private results: TestResultItem[] = [];
  private suiteName: string;
  private tier: number;
  private feature: string;
  private startTime = 0;

  constructor(suiteName: string, tier: number, feature: string) {
    this.suiteName = suiteName;
    this.tier = tier;
    this.feature = feature;
  }

  async test(name: string, fn: TestFn): Promise<void> {
    const start = performance.now();
    try {
      await fn();
      const durationMs = Math.round((performance.now() - start) * 100) / 100;
      this.results.push({
        name,
        tier: this.tier,
        feature: this.feature,
        passed: true,
        durationMs,
      });
    } catch (err: any) {
      const durationMs = Math.round((performance.now() - start) * 100) / 100;
      this.results.push({
        name,
        tier: this.tier,
        feature: this.feature,
        passed: false,
        durationMs,
        error: err?.stack || String(err),
      });
    }
  }

  getSummary(): TestSuiteSummary {
    const passed = this.results.filter((r) => r.passed).length;
    const failed = this.results.filter((r) => !r.passed).length;
    const totalDuration = this.results.reduce((acc, r) => acc + r.durationMs, 0);

    return {
      suiteName: this.suiteName,
      tier: this.tier,
      total: this.results.length,
      passed,
      failed,
      durationMs: Math.round(totalDuration * 100) / 100,
      results: this.results,
    };
  }

  printSummary(): void {
    const summary = this.getSummary();
    console.log(`\n==================================================`);
    console.log(`[Tier ${this.tier}] ${this.suiteName} (${this.feature})`);
    console.log(`Passed: ${summary.passed}/${summary.total} (${Math.round((summary.passed / summary.total) * 100)}%) | Time: ${summary.durationMs}ms`);
    console.log(`==================================================`);

    for (const r of summary.results) {
      if (r.passed) {
        console.log(`  ✓ [PASS] ${r.name} (${r.durationMs}ms)`);
      } else {
        console.error(`  ✗ [FAIL] ${r.name} (${r.durationMs}ms)`);
        console.error(`    ${r.error}`);
      }
    }
  }
}
