import { describe, expect, it } from "vitest";
import {
  activateCalibrationTuning,
  computeCalibration,
  type CalibrationSample,
} from "./calibration";

function recommendation(report: ReturnType<typeof computeCalibration>, id: string) {
  const match = report.tuning.recommendations.find((item) => item.id === id);

  if (!match) {
    throw new Error(`Missing recommendation ${id}`);
  }

  return match;
}

describe("computeCalibration", () => {
  it("returns zeroed report for an empty sample set", () => {
    const report = computeCalibration([]);

    expect(report.sampleSize).toBe(0);
    expect(report.accuracy).toBe(0);
    expect(report.brierScore).toBe(0);
    expect(report.logLoss).toBe(0);
    expect(report.byPredictedProbability).toEqual([]);
    expect(report.byConfidence).toEqual([]);
    expect(report.stageSplits).toEqual([]);
    expect(report.contextSplits).toEqual([]);
    expect(report.seerSays).toEqual([]);
    expect(report.diagnostics.favorite.count).toBe(0);
    expect(report.diagnostics.chaos.trend).toBe("insufficient-data");
    expect(report.tuning.readiness).toBe("collecting");
    expect(report.tuning.recommendations).toHaveLength(5);
    expect(recommendation(report, "favorite-scale").direction).toBe("collect");
    expect(report.tuning.application).toMatchObject({
      applied: false,
      sampleSize: 0,
      readiness: "collecting",
      knobs: {
        favoriteScale: 1,
        drawLaneMultiplier: 1,
        confidenceBias: 0,
        chaosSensitivity: 1,
        marketNudgeMaxWeight: 0.18,
      },
    });
  });

  it("computes accuracy, Brier score and log loss with hand-checked values", () => {
    // Sample A: confident and correct.
    //   Brier = (0.6-1)^2 + 0.3^2 + 0.1^2 = 0.26
    //   logloss = -ln(0.6) = 0.5108
    // Sample B: confident and wrong.
    //   Brier = 0.2^2 + 0.2^2 + (0.6-1)... actual=home so:
    //   (0.2-1)^2 + 0.2^2 + 0.6^2 = 0.64 + 0.04 + 0.36 = 1.04
    //   logloss = -ln(0.2) = 1.6094
    const samples: CalibrationSample[] = [
      { probabilities: { home: 0.6, draw: 0.3, away: 0.1 }, actual: "home" },
      { probabilities: { home: 0.2, draw: 0.2, away: 0.6 }, actual: "home" },
    ];

    const report = computeCalibration(samples);

    expect(report.sampleSize).toBe(2);
    expect(report.accuracy).toBe(50); // 1 of 2 top picks correct
    expect(report.brierScore).toBe(0.65); // (0.26 + 1.04) / 2
    expect(report.logLoss).toBe(1.06); // (0.5108 + 1.6094) / 2, rounded to 3dp
  });

  it("normalises probabilities that do not sum to 1", () => {
    // 60/30/10 should behave exactly like 0.6/0.3/0.1.
    const report = computeCalibration([
      { probabilities: { home: 60, draw: 30, away: 10 }, actual: "home" },
    ]);

    expect(report.accuracy).toBe(100);
    expect(report.brierScore).toBe(0.26);
    expect(report.logLoss).toBe(0.511); // -ln(0.6)
  });

  it("falls back to an even split when all probabilities are zero", () => {
    const report = computeCalibration([
      { probabilities: { home: 0, draw: 0, away: 0 }, actual: "home" },
    ]);

    // Even split -> top pick is 'home' (ties resolve home-first), so it 'hits'.
    expect(report.accuracy).toBe(100);
    // Brier = (1/3-1)^2 + (1/3)^2 + (1/3)^2 = 0.6667
    expect(report.brierScore).toBeCloseTo(0.667, 2);
    // logloss = -ln(1/3) = 1.0986
    expect(report.logLoss).toBeCloseTo(1.099, 2);
  });

  it("picks the highest-probability outcome as the lean", () => {
    // away is clearly highest and correct -> 100% accuracy.
    const report = computeCalibration([
      { probabilities: { home: 0.1, draw: 0.2, away: 0.7 }, actual: "away" },
    ]);

    expect(report.accuracy).toBe(100);
  });

  it("buckets predictions by the leaned pick's probability", () => {
    const report = computeCalibration([
      { probabilities: { home: 0.65, draw: 0.2, away: 0.15 }, actual: "home" },
    ]);

    const bucket = report.byPredictedProbability.find((b) => b.label === "60-70%");
    expect(bucket).toBeDefined();
    expect(bucket?.count).toBe(1);
    expect(bucket?.predictedPct).toBe(65);
    expect(bucket?.actualPct).toBe(100);
    expect(bucket?.gap).toBe(35); // 100 observed - 65 predicted
  });

  it("buckets by stated confidence when provided", () => {
    const report = computeCalibration([
      {
        probabilities: { home: 0.55, draw: 0.25, away: 0.2 },
        actual: "home",
        confidence: 72,
      },
    ]);

    const bucket = report.byConfidence.find((b) => b.label === "70-80%");
    expect(bucket).toBeDefined();
    expect(bucket?.count).toBe(1);
  });

  it("ignores missing or non-finite confidence values for confidence buckets", () => {
    const report = computeCalibration([
      { probabilities: { home: 0.6, draw: 0.3, away: 0.1 }, actual: "home", confidence: null },
      { probabilities: { home: 0.6, draw: 0.3, away: 0.1 }, actual: "home" },
    ]);

    expect(report.byConfidence).toEqual([]);
  });

  it("splits receipt calibration by stage and context signals", () => {
    const report = computeCalibration([
      {
        probabilities: { home: 0.6, draw: 0.25, away: 0.15 },
        actual: "home",
        stage: "group",
        contexts: { weather: true, crowd: true },
      },
      {
        probabilities: { home: 0.6, draw: 0.25, away: 0.15 },
        actual: "away",
        stage: "group",
        contexts: { weather: true },
      },
      {
        probabilities: { home: 0.2, draw: 0.2, away: 0.6 },
        actual: "away",
        stage: "knockout",
        contexts: { bodyCost: true, lineup: true, crowd: true },
      },
      {
        probabilities: { home: 0.2, draw: 0.2, away: 0.6 },
        actual: "draw",
        stage: "knockout",
        contexts: { bodyCost: true, lineup: true },
      },
    ]);

    expect(report.stageSplits).toEqual([
      expect.objectContaining({
        id: "group",
        label: "Group games",
        count: 2,
        predictedPct: 60,
        actualPct: 50,
        gap: -10,
      }),
      expect.objectContaining({
        id: "knockout",
        label: "Knockout games",
        count: 2,
        predictedPct: 60,
        actualPct: 50,
        gap: -10,
      }),
    ]);
    expect(report.contextSplits).toEqual([
      expect.objectContaining({ id: "weather", count: 2, actualPct: 50 }),
      expect.objectContaining({ id: "bodyCost", count: 2, actualPct: 50 }),
      expect.objectContaining({ id: "lineup", count: 2, actualPct: 50 }),
      expect.objectContaining({ id: "crowd", count: 2, actualPct: 100 }),
    ]);
    expect(report.seerSays.some((note) => note.startsWith("Favorites:"))).toBe(true);
    expect(report.seerSays.some((note) => note.startsWith("Group games:"))).toBe(true);
  });

  it("flags favorite overconfidence from final-score receipts", () => {
    const report = computeCalibration([
      { probabilities: { home: 0.6, draw: 0.2, away: 0.2 }, actual: "home" },
      { probabilities: { home: 0.6, draw: 0.2, away: 0.2 }, actual: "home" },
      { probabilities: { home: 0.6, draw: 0.2, away: 0.2 }, actual: "away" },
      { probabilities: { home: 0.6, draw: 0.2, away: 0.2 }, actual: "away" },
      { probabilities: { home: 0.6, draw: 0.2, away: 0.2 }, actual: "away" },
    ]);

    expect(report.diagnostics.favorite.count).toBe(5);
    expect(report.diagnostics.favorite.predictedPct).toBe(60);
    expect(report.diagnostics.favorite.actualPct).toBe(40);
    expect(report.diagnostics.favorite.gap).toBe(-20);
    expect(report.diagnostics.favorite.verdict).toContain("Trim favorite confidence");
  });

  it("flags draw underpricing across all completed matches", () => {
    const report = computeCalibration([
      { probabilities: { home: 0.6, draw: 0.2, away: 0.2 }, actual: "home" },
      { probabilities: { home: 0.6, draw: 0.2, away: 0.2 }, actual: "home" },
      { probabilities: { home: 0.6, draw: 0.2, away: 0.2 }, actual: "away" },
      { probabilities: { home: 0.6, draw: 0.2, away: 0.2 }, actual: "draw" },
      { probabilities: { home: 0.6, draw: 0.2, away: 0.2 }, actual: "draw" },
    ]);

    expect(report.diagnostics.draw.count).toBe(5);
    expect(report.diagnostics.draw.predictedPct).toBe(20);
    expect(report.diagnostics.draw.actualPct).toBe(40);
    expect(report.diagnostics.draw.gap).toBe(20);
    expect(report.diagnostics.draw.verdict).toContain("Lift the draw lane");
  });

  it("buckets chaos and reports a rising miss trend", () => {
    const report = computeCalibration([
      { probabilities: { home: 0.6, draw: 0.2, away: 0.2 }, actual: "home", chaos: 44 },
      { probabilities: { home: 0.6, draw: 0.2, away: 0.2 }, actual: "home", chaos: 46 },
      { probabilities: { home: 0.6, draw: 0.2, away: 0.2 }, actual: "home", chaos: 48 },
      { probabilities: { home: 0.6, draw: 0.2, away: 0.2 }, actual: "away", chaos: 72 },
      { probabilities: { home: 0.6, draw: 0.2, away: 0.2 }, actual: "away", chaos: 74 },
      { probabilities: { home: 0.6, draw: 0.2, away: 0.2 }, actual: "away", chaos: 76 },
    ]);

    expect(report.diagnostics.chaos.sampleSize).toBe(6);
    expect(report.diagnostics.chaos.missRatePct).toBe(50);
    expect(report.diagnostics.chaos.trend).toBe("rising");
    expect(report.diagnostics.chaos.buckets).toEqual([
      {
        label: "35-50",
        count: 3,
        averageChaos: 46,
        missRatePct: 0,
        gapFromAverage: -50,
      },
      {
        label: "70-85",
        count: 3,
        averageChaos: 74,
        missRatePct: 100,
        gapFromAverage: 50,
      },
    ]);
  });

  it("turns calibration receipts into bounded tuning recommendations", () => {
    const samples: CalibrationSample[] = [
      {
        probabilities: { home: 0.6, draw: 0.2, away: 0.2 },
        actual: "home",
        confidence: 80,
        chaos: 44,
        market: { leader: "home", liquidityScore: 0.8, alignment: "aligned" },
      },
      {
        probabilities: { home: 0.6, draw: 0.2, away: 0.2 },
        actual: "away",
        confidence: 80,
        chaos: 46,
        market: { leader: "away", liquidityScore: 0.7, alignment: "split" },
      },
      {
        probabilities: { home: 0.6, draw: 0.2, away: 0.2 },
        actual: "away",
        confidence: 80,
        chaos: 48,
        market: { leader: "away", liquidityScore: 0.7, alignment: "split" },
      },
      {
        probabilities: { home: 0.6, draw: 0.2, away: 0.2 },
        actual: "draw",
        confidence: 80,
        chaos: 72,
        market: { leader: "draw", liquidityScore: 0.9, alignment: "split" },
      },
      {
        probabilities: { home: 0.6, draw: 0.2, away: 0.2 },
        actual: "draw",
        confidence: 80,
        chaos: 74,
        market: { leader: "draw", liquidityScore: 0.9, alignment: "split" },
      },
      {
        probabilities: { home: 0.6, draw: 0.2, away: 0.2 },
        actual: "away",
        confidence: 80,
        chaos: 76,
        market: { leader: "away", liquidityScore: 0.7, alignment: "split" },
      },
    ];
    const report = computeCalibration(samples);

    expect(report.tuning.readiness).toBe("early");
    expect(report.tuning.application.applied).toBe(false);
    expect(recommendation(report, "favorite-scale")).toMatchObject({
      direction: "decrease",
      recommendedValue: 0.88,
    });
    expect(recommendation(report, "draw-lane").direction).toBe("increase");
    expect(recommendation(report, "confidence-bias")).toMatchObject({
      direction: "decrease",
      recommendedValue: -5,
    });
    expect(recommendation(report, "chaos-sensitivity")).toMatchObject({
      direction: "increase",
      recommendedValue: 1.08,
    });
    expect(report.tuning.market.edgePct).toBe(83.3);
    expect(recommendation(report, "market-nudge-weight")).toMatchObject({
      direction: "increase",
      recommendedValue: 0.24,
    });
  });

  it("keeps actionable tuning recommendations staged until review", () => {
    const baseSamples: CalibrationSample[] = [
      {
        probabilities: { home: 0.6, draw: 0.2, away: 0.2 },
        actual: "home",
        confidence: 80,
        chaos: 44,
        market: { leader: "home", liquidityScore: 0.8, alignment: "aligned" },
      },
      {
        probabilities: { home: 0.6, draw: 0.2, away: 0.2 },
        actual: "away",
        confidence: 80,
        chaos: 46,
        market: { leader: "away", liquidityScore: 0.7, alignment: "split" },
      },
      {
        probabilities: { home: 0.6, draw: 0.2, away: 0.2 },
        actual: "away",
        confidence: 80,
        chaos: 48,
        market: { leader: "away", liquidityScore: 0.7, alignment: "split" },
      },
      {
        probabilities: { home: 0.6, draw: 0.2, away: 0.2 },
        actual: "draw",
        confidence: 80,
        chaos: 72,
        market: { leader: "draw", liquidityScore: 0.9, alignment: "split" },
      },
      {
        probabilities: { home: 0.6, draw: 0.2, away: 0.2 },
        actual: "draw",
        confidence: 80,
        chaos: 74,
        market: { leader: "draw", liquidityScore: 0.9, alignment: "split" },
      },
      {
        probabilities: { home: 0.6, draw: 0.2, away: 0.2 },
        actual: "away",
        confidence: 80,
        chaos: 76,
        market: { leader: "away", liquidityScore: 0.7, alignment: "split" },
      },
    ];
    const report = computeCalibration([...baseSamples, ...baseSamples]);

    expect(report.tuning.readiness).toBe("actionable");
    expect(report.tuning.application).toMatchObject({
      applied: false,
      sampleSize: 12,
      readiness: "actionable",
      knobs: {
        favoriteScale: 1,
        drawLaneMultiplier: 1,
        confidenceBias: 0,
        chaosSensitivity: 1,
        marketNudgeMaxWeight: 0.18,
      },
      recommendedKnobs: {
        favoriteScale: 0.88,
        drawLaneMultiplier: 1.073,
        confidenceBias: -5,
        chaosSensitivity: 1.08,
        marketNudgeMaxWeight: 0.24,
      },
    });
  });

  it("turns staged recommendations into approved live knobs only when activated", () => {
    const report = computeCalibration([
      {
        probabilities: { home: 0.6, draw: 0.2, away: 0.2 },
        actual: "away",
        confidence: 80,
      },
      {
        probabilities: { home: 0.6, draw: 0.2, away: 0.2 },
        actual: "away",
        confidence: 80,
      },
      {
        probabilities: { home: 0.6, draw: 0.2, away: 0.2 },
        actual: "away",
        confidence: 80,
      },
      {
        probabilities: { home: 0.6, draw: 0.2, away: 0.2 },
        actual: "away",
        confidence: 80,
      },
      {
        probabilities: { home: 0.6, draw: 0.2, away: 0.2 },
        actual: "away",
        confidence: 80,
      },
    ]);
    const activated = activateCalibrationTuning(report.tuning.application);

    expect(report.tuning.application.applied).toBe(false);
    expect(activated.applied).toBe(true);
    expect(activated.knobs).toEqual(report.tuning.application.recommendedKnobs);
    expect(activated.reason).toContain("Admin approved");
  });
});
