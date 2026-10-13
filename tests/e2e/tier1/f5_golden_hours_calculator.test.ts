/**
 * tests/e2e/tier1/f5_golden_hours_calculator.test.ts
 * Feature F5: Golden Hours Calculator
 * Validates 4 Vietnam peak engagement slots and today/tomorrow calendar transitions.
 */

import assert from "node:assert/strict";
import { getGoldenHourPresets, getUpcomingPreset } from "../harness/serviceLoader";
import { TestRunnerContext } from "../harness/runnerHelper";
import { TestSuiteSummary } from "../types";

export async function runTier1F5Tests(): Promise<TestSuiteSummary> {
  const runner = new TestRunnerContext("Golden Hours Calculator", 1, "F5");

  await runner.test("F5.1: Returns exactly 4 standard Vietnam peak engagement slots", async () => {
    const presets = await getGoldenHourPresets();
    assert.equal(presets.length, 4, "Must return exactly 4 presets");

    const ids = presets.map((p) => p.id);
    assert.deepEqual(ids, ["morning", "noon", "evening", "night"]);
  });

  await runner.test("F5.2: Identifies evening slot (19:30 - 21:30) as recommended prime slot", async () => {
    const presets = await getGoldenHourPresets();
    const evening = presets.find((p) => p.id === "evening");

    assert.ok(evening);
    assert.equal(evening?.isRecommendedPrime, true, "Evening slot must be marked as recommended prime");

    const others = presets.filter((p) => p.id !== "evening");
    for (const slot of others) {
      assert.equal(slot.isRecommendedPrime, false, "Non-evening slots should not be prime");
    }
  });

  await runner.test("F5.3: Schedules for today when reference time is before slot cutoff", async () => {
    // Reference time: 06:00 AM today (before morning slot 07:30 - 08:30)
    const refDate = new Date();
    refDate.setHours(6, 0, 0, 0);

    const morningSlot = await getUpcomingPreset("morning", refDate);
    assert.equal(morningSlot.isToday, true, "Morning slot at 06:00 should be scheduled for today");
    assert.match(morningSlot.formattedTarget, /^Hôm nay,\s*(?:07:30|08:00)/);
  });

  await runner.test("F5.4: Advances schedule to tomorrow when reference time has passed slot cutoff", async () => {
    // Reference time: 09:00 AM today (passed morning slot cutoff 08:30)
    const refDate = new Date();
    refDate.setHours(9, 0, 0, 0);

    const morningSlot = await getUpcomingPreset("morning", refDate);
    assert.equal(morningSlot.isToday, false, "Morning slot after 08:30 should roll over to tomorrow");
    assert.match(morningSlot.formattedTarget, /^Ngày mai,\s*(?:07:30|08:00)/);
  });

  await runner.test("F5.5: Generates valid ISO timestamp pointing to the designated hour", async () => {
    const refDate = new Date();
    refDate.setHours(10, 0, 0, 0);

    const noonSlot = await getUpcomingPreset("noon", refDate);
    assert.ok(noonSlot.timestamp, "Must provide timestamp");

    const parsedDate = new Date(noonSlot.timestamp);
    assert.ok(!isNaN(parsedDate.getTime()), "Timestamp must be a valid ISO date");
    assert.ok(parsedDate.getHours() === 11 || parsedDate.getHours() === 12, "Noon target hour must be 11 or 12");
  });

  await runner.test("F5.6: Displays accurate label and time range descriptions", async () => {
    const presets = await getGoldenHourPresets();
    for (const preset of presets) {
      assert.ok(preset.label.length > 0, `Label for ${preset.id} must not be empty`);
      assert.ok(preset.timeRange.includes("-"), `Time range for ${preset.id} must contain hyphen separator`);
    }
  });

  return runner.getSummary();
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  runTier1F5Tests().then((s) => {
    new TestRunnerContext(s.suiteName, s.tier, "F5").printSummary();
  });
}
