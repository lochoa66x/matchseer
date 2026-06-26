import { NextResponse } from "next/server";
import { listMatches } from "../../../../lib/database";
import {
  computeCalibration,
  type CalibrationSample,
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

    const report = computeCalibration(samples);

    return NextResponse.json({
      ...report,
      completedMatchesConsidered: matches.filter((m) => m.status === "Final").length,
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
