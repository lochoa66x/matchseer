import { NextResponse } from "next/server";
import {
  approveCalibrationTuningForForecasts,
  getApprovedCalibrationTuning,
  listMatches,
  revertCalibrationTuningApproval,
} from "../../../../lib/database";
import {
  computeCalibration,
  type CalibrationContextFlags,
  type CalibrationSample,
  type CalibrationStage,
  type ForecastOutcome,
} from "../../../../lib/calibration";

export const dynamic = "force-dynamic";

// Admin-only: measures how well the Seer's forecasts match reality, using the
// completed matches already stored. Read-only; secured by MATCHSEER_SYNC_SECRET.
export async function GET(request: Request) {
  const secret = process.env.MATCHSEER_SYNC_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: "MATCHSEER_SYNC_SECRET is required" },
      { status: 503 },
    );
  }

  if (!isAuthorized(request, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const report = await buildCalibrationReport();
    const activeTuning = await getApprovedCalibrationTuning();

    return NextResponse.json({
      ...report,
      activeTuning,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Calibration failed",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const secret = process.env.MATCHSEER_SYNC_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: "MATCHSEER_SYNC_SECRET is required" },
      { status: 503 },
    );
  }

  if (!isAuthorized(request, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await readJson(request);
    const action =
      payload && typeof payload === "object" && "action" in payload
        ? (payload as { action?: unknown }).action
        : null;

    if (action === "apply") {
      const report = await buildCalibrationReport();

      if (report.tuning.readiness === "collecting") {
        return NextResponse.json(
          {
            error:
              "The Seer needs a few more receipts before applying calibration knobs.",
          },
          { status: 400 },
        );
      }

      const activeTuning = await approveCalibrationTuningForForecasts(
        report.tuning.application,
      );

      return NextResponse.json({
        action,
        activeTuning,
        generatedAt: new Date().toISOString(),
      });
    }

    if (action === "revert") {
      const activeTuning = await revertCalibrationTuningApproval();

      return NextResponse.json({
        action,
        activeTuning,
        generatedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json(
      { error: 'Provide {"action":"apply"} or {"action":"revert"}.' },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Calibration tuning update failed",
      },
      { status: 500 },
    );
  }
}

async function buildCalibrationReport() {
  const { matches } = await listMatches();
  const samples: CalibrationSample[] = [];

  for (const match of matches) {
    if (match.status !== "Final") {
      continue;
    }

    const actual = scoreToOutcome(match.score);

    if (!actual) {
      continue;
    }

    const marketPulse = match.forecast.marketPulse;

    samples.push({
      probabilities: {
        home: match.forecast.home,
        draw: match.forecast.draw,
        away: match.forecast.away,
      },
      actual,
      confidence: match.forecast.confidence,
      chaos: match.forecast.chaos,
      stage: stageToCalibration(match.stage, match.group),
      contexts: contextFlagsFromForecast(match.forecast),
      market: marketPulse
        ? {
            leader: marketPulse.leader,
            liquidityScore: marketPulse.liquidityScore,
            alignment: marketPulse.alignment,
            nudgeApplied: marketPulse.nudge?.applied ?? false,
          }
        : null,
    });
  }

  return {
    ...computeCalibration(samples),
    completedMatchesConsidered: matches.filter((m) => m.status === "Final").length,
  };
}

async function readJson(request: Request) {
  try {
    return (await request.json()) as unknown;
  } catch {
    return null;
  }
}

function stageToCalibration(
  stage: string | null | undefined,
  group: string | null | undefined,
): CalibrationStage {
  const value = `${stage ?? ""} ${group ?? ""}`.toLowerCase();

  if (value.includes("group")) {
    return "group";
  }

  if (
    value.includes("knockout") ||
    value.includes("round of") ||
    value.includes("quarter") ||
    value.includes("semi") ||
    value.includes("final") ||
    value.includes("third place")
  ) {
    return "knockout";
  }

  return "other";
}

function contextFlagsFromForecast(forecast: {
  trail?: Array<{ id: string }> | null;
  waterfall?: Array<{ id: string }> | null;
  marketPulse?: { nudge?: { applied?: boolean | null } | null } | null;
}): CalibrationContextFlags {
  const ids = [
    ...(forecast.trail ?? []).map((signal) => signal.id.toLowerCase()),
    ...(forecast.waterfall ?? []).map((signal) => signal.id.toLowerCase()),
  ];
  const hasSignal = (needles: string[]) =>
    ids.some((id) => needles.some((needle) => id.includes(needle)));

  return {
    weather: hasSignal([
      "fog",
      "heat",
      "humid",
      "night",
      "pitch",
      "slick",
      "sun",
      "weather",
      "wind",
    ]),
    bodyCost: hasSignal(["altitude", "body", "legs", "rest", "travel"]),
    lineup: hasSignal(["lineup", "player", "star", "suspension"]),
    crowd: hasSignal(["crowd"]) || Boolean(forecast.marketPulse?.nudge?.applied),
  };
}

function isAuthorized(request: Request, secret: string) {
  const authorization = request.headers.get("authorization");
  const syncSecret = request.headers.get("x-sync-secret");

  return authorization === `Bearer ${secret}` || syncSecret === secret;
}

function scoreToOutcome(score: string | undefined): ForecastOutcome | null {
  if (!score) {
    return null;
  }

  const match = score.match(/(\d+)\s*[-:–]\s*(\d+)/);

  if (!match) {
    return null;
  }

  const home = Number(match[1]);
  const away = Number(match[2]);

  if (!Number.isFinite(home) || !Number.isFinite(away)) {
    return null;
  }

  if (home > away) {
    return "home";
  }

  if (home < away) {
    return "away";
  }

  return "draw";
}
