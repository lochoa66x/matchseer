// Sport-agnostic forecast calibration engine.
// Given predicted probabilities + actual outcomes, it measures how well-calibrated
// the model is: does "60% confidence" actually happen ~60% of the time?
// Works for any 3-way (home/draw/away) market — World Cup now, NFL or other
// leagues later. For NFL calibration, "draw" can mean the close-game lane
// (within one touchdown), not a literal tied final.

export type ForecastOutcome = "home" | "draw" | "away";

export type CalibrationSample = {
  probabilities: { home: number; draw: number; away: number };
  actual: ForecastOutcome;
  confidence?: number | null;
};

export type CalibrationBucket = {
  label: string;
  count: number;
  predictedPct: number; // average predicted probability in this bucket (0-100)
  actualPct: number; // observed hit rate in this bucket (0-100)
  gap: number; // actualPct - predictedPct (positive = model underconfident)
};

export type CalibrationReport = {
  sampleSize: number;
  accuracy: number; // top-pick hit rate, 0-100
  brierScore: number; // multiclass Brier (0-2), lower is better
  logLoss: number; // lower is better
  byPredictedProbability: CalibrationBucket[]; // bucketed by the leaned pick's probability
  byConfidence: CalibrationBucket[]; // bucketed by the model's stated confidence
};

const OUTCOMES: ForecastOutcome[] = ["home", "draw", "away"];

function normalize(probabilities: CalibrationSample["probabilities"]) {
  const total = probabilities.home + probabilities.draw + probabilities.away;

  if (!(total > 0)) {
    return { home: 1 / 3, draw: 1 / 3, away: 1 / 3 };
  }

  return {
    home: probabilities.home / total,
    draw: probabilities.draw / total,
    away: probabilities.away / total,
  };
}

function leanedPick(p: { home: number; draw: number; away: number }): ForecastOutcome {
  if (p.home >= p.draw && p.home >= p.away) {
    return "home";
  }

  if (p.away >= p.draw && p.away >= p.home) {
    return "away";
  }

  return "draw";
}

function bucketize(
  rows: { predicted: number; hit: boolean }[],
  edges: number[],
): CalibrationBucket[] {
  const buckets: CalibrationBucket[] = [];

  for (let i = 0; i < edges.length - 1; i += 1) {
    const lower = edges[i];
    const upper = edges[i + 1];
    const isLast = i === edges.length - 2;
    const inBucket = rows.filter(
      (row) =>
        row.predicted >= lower && (isLast ? row.predicted <= upper : row.predicted < upper),
    );

    if (inBucket.length === 0) {
      continue;
    }

    const predictedPct =
      inBucket.reduce((sum, row) => sum + row.predicted, 0) / inBucket.length;
    const actualPct =
      (inBucket.filter((row) => row.hit).length / inBucket.length) * 100;

    buckets.push({
      label: `${lower}-${upper}%`,
      count: inBucket.length,
      predictedPct: Math.round(predictedPct * 10) / 10,
      actualPct: Math.round(actualPct * 10) / 10,
      gap: Math.round((actualPct - predictedPct) * 10) / 10,
    });
  }

  return buckets;
}

export function computeCalibration(samples: CalibrationSample[]): CalibrationReport {
  const sampleSize = samples.length;

  if (sampleSize === 0) {
    return {
      sampleSize: 0,
      accuracy: 0,
      brierScore: 0,
      logLoss: 0,
      byPredictedProbability: [],
      byConfidence: [],
    };
  }

  let correct = 0;
  let brierTotal = 0;
  let logLossTotal = 0;
  const probabilityRows: { predicted: number; hit: boolean }[] = [];
  const confidenceRows: { predicted: number; hit: boolean }[] = [];

  for (const sample of samples) {
    const p = normalize(sample.probabilities);
    const pick = leanedPick(p);
    const hit = pick === sample.actual;

    if (hit) {
      correct += 1;
    }

    for (const outcome of OUTCOMES) {
      const actualOneHot = outcome === sample.actual ? 1 : 0;
      brierTotal += (p[outcome] - actualOneHot) ** 2;
    }

    const actualProbability = Math.min(Math.max(p[sample.actual], 1e-9), 1);
    logLossTotal += -Math.log(actualProbability);

    probabilityRows.push({ predicted: p[pick] * 100, hit });

    if (sample.confidence != null && Number.isFinite(sample.confidence)) {
      confidenceRows.push({ predicted: sample.confidence, hit });
    }
  }

  return {
    sampleSize,
    accuracy: Math.round((correct / sampleSize) * 1000) / 10,
    brierScore: Math.round((brierTotal / sampleSize) * 1000) / 1000,
    logLoss: Math.round((logLossTotal / sampleSize) * 1000) / 1000,
    byPredictedProbability: bucketize(
      probabilityRows,
      [30, 40, 50, 60, 70, 80, 90, 100],
    ),
    byConfidence: bucketize(confidenceRows, [40, 50, 60, 70, 80, 90]),
  };
}
