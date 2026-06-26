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
  chaos?: number | null;
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
  diagnostics: CalibrationDiagnostics;
};

export type CalibrationSegment = {
  label: string;
  count: number;
  predictedPct: number;
  actualPct: number;
  gap: number;
  verdict: string;
};

export type ChaosMissBucket = {
  label: string;
  count: number;
  averageChaos: number;
  missRatePct: number;
  gapFromAverage: number;
};

export type ChaosCalibration = {
  sampleSize: number;
  averageChaos: number;
  missRatePct: number;
  trend: "rising" | "flat" | "inverted" | "insufficient-data";
  verdict: string;
  buckets: ChaosMissBucket[];
};

export type CalibrationDiagnostics = {
  favorite: CalibrationSegment;
  draw: CalibrationSegment;
  chaos: ChaosCalibration;
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

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function emptyDiagnostics(): CalibrationDiagnostics {
  return {
    favorite: {
      label: "Favorite calls",
      count: 0,
      predictedPct: 0,
      actualPct: 0,
      gap: 0,
      verdict: "No favorite receipts yet.",
    },
    draw: {
      label: "Draw lane",
      count: 0,
      predictedPct: 0,
      actualPct: 0,
      gap: 0,
      verdict: "No draw receipts yet.",
    },
    chaos: {
      sampleSize: 0,
      averageChaos: 0,
      missRatePct: 0,
      trend: "insufficient-data",
      verdict: "No chaos-tagged receipts yet.",
      buckets: [],
    },
  };
}

function calibrationSegment({
  label,
  rows,
  emptyVerdict,
  verdict,
}: {
  label: string;
  rows: { predicted: number; hit: boolean }[];
  emptyVerdict: string;
  verdict: (gap: number, count: number) => string;
}): CalibrationSegment {
  if (rows.length === 0) {
    return {
      label,
      count: 0,
      predictedPct: 0,
      actualPct: 0,
      gap: 0,
      verdict: emptyVerdict,
    };
  }

  const predictedPct = rows.reduce((sum, row) => sum + row.predicted, 0) / rows.length;
  const actualPct = (rows.filter((row) => row.hit).length / rows.length) * 100;
  const gap = actualPct - predictedPct;

  return {
    label,
    count: rows.length,
    predictedPct: round1(predictedPct),
    actualPct: round1(actualPct),
    gap: round1(gap),
    verdict: verdict(gap, rows.length),
  };
}

function favoriteVerdict(gap: number, count: number) {
  if (count < 5) {
    return "Early read: add more final receipts before moving the favorite dial.";
  }

  if (gap <= -8) {
    return "Favorites are running cold versus their quoted probability. Trim favorite confidence.";
  }

  if (gap >= 8) {
    return "Favorites are landing more often than quoted. The model can give strong teams a little more room.";
  }

  return "Favorite calls are close to calibrated.";
}

function drawVerdict(gap: number, count: number) {
  if (count < 5) {
    return "Early read: draw calibration needs more finished matches.";
  }

  if (gap >= 4) {
    return "Draws are landing more often than priced. Lift the draw lane in close games.";
  }

  if (gap <= -4) {
    return "The draw lane is too generous. Let cleaner team gaps pull more share away from draws.";
  }

  return "Draw pricing is close to the final-score receipts.";
}

function computeChaosCalibration(
  rows: { chaos: number; miss: boolean }[],
): ChaosCalibration {
  if (rows.length === 0) {
    return emptyDiagnostics().chaos;
  }

  const missRatePct = (rows.filter((row) => row.miss).length / rows.length) * 100;
  const averageChaos = rows.reduce((sum, row) => sum + row.chaos, 0) / rows.length;
  const buckets = chaosBuckets(rows, missRatePct);
  const trend = chaosTrend(buckets, rows.length);

  return {
    sampleSize: rows.length,
    averageChaos: round1(averageChaos),
    missRatePct: round1(missRatePct),
    trend,
    verdict: chaosVerdict(trend, rows.length),
    buckets,
  };
}

function chaosBuckets(
  rows: { chaos: number; miss: boolean }[],
  averageMissRatePct: number,
) {
  const edges = [35, 50, 60, 70, 85];
  const buckets: ChaosMissBucket[] = [];

  for (let i = 0; i < edges.length - 1; i += 1) {
    const lower = edges[i];
    const upper = edges[i + 1];
    const isLast = i === edges.length - 2;
    const inBucket = rows.filter(
      (row) =>
        row.chaos >= lower && (isLast ? row.chaos <= upper : row.chaos < upper),
    );

    if (inBucket.length === 0) {
      continue;
    }

    const averageChaos = inBucket.reduce((sum, row) => sum + row.chaos, 0) / inBucket.length;
    const missRatePct =
      (inBucket.filter((row) => row.miss).length / inBucket.length) * 100;

    buckets.push({
      label: `${lower}-${upper}`,
      count: inBucket.length,
      averageChaos: round1(averageChaos),
      missRatePct: round1(missRatePct),
      gapFromAverage: round1(missRatePct - averageMissRatePct),
    });
  }

  return buckets;
}

function chaosTrend(
  buckets: ChaosMissBucket[],
  sampleSize: number,
): ChaosCalibration["trend"] {
  if (sampleSize < 5 || buckets.length < 2) {
    return "insufficient-data";
  }

  const first = buckets[0];
  const last = buckets[buckets.length - 1];

  if (last.missRatePct >= first.missRatePct + 5) {
    return "rising";
  }

  if (first.missRatePct >= last.missRatePct + 5) {
    return "inverted";
  }

  return "flat";
}

function chaosVerdict(trend: ChaosCalibration["trend"], sampleSize: number) {
  if (trend === "insufficient-data") {
    return sampleSize === 0
      ? "No chaos-tagged receipts yet."
      : "Early read: chaos needs more finals before it becomes a reliable warning light.";
  }

  if (trend === "rising") {
    return "Chaos is doing its job: higher-chaos matches miss more often.";
  }

  if (trend === "inverted") {
    return "Chaos is not warning correctly yet. Review which inputs are inflating steady matches.";
  }

  return "Chaos is not separating misses yet. Tighten the chaos scale or add sharper volatility signals.";
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
      diagnostics: emptyDiagnostics(),
    };
  }

  let correct = 0;
  let brierTotal = 0;
  let logLossTotal = 0;
  const probabilityRows: { predicted: number; hit: boolean }[] = [];
  const confidenceRows: { predicted: number; hit: boolean }[] = [];
  const favoriteRows: { predicted: number; hit: boolean }[] = [];
  const drawRows: { predicted: number; hit: boolean }[] = [];
  const chaosRows: { chaos: number; miss: boolean }[] = [];

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
    drawRows.push({ predicted: p.draw * 100, hit: sample.actual === "draw" });

    if (pick !== "draw") {
      favoriteRows.push({ predicted: p[pick] * 100, hit });
    }

    if (sample.confidence != null && Number.isFinite(sample.confidence)) {
      confidenceRows.push({ predicted: sample.confidence, hit });
    }

    if (sample.chaos != null && Number.isFinite(sample.chaos)) {
      chaosRows.push({ chaos: sample.chaos, miss: !hit });
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
    diagnostics: {
      favorite: calibrationSegment({
        label: "Favorite calls",
        rows: favoriteRows,
        emptyVerdict: "No favorite receipts yet.",
        verdict: favoriteVerdict,
      }),
      draw: calibrationSegment({
        label: "Draw lane",
        rows: drawRows,
        emptyVerdict: "No draw receipts yet.",
        verdict: drawVerdict,
      }),
      chaos: computeChaosCalibration(chaosRows),
    },
  };
}
