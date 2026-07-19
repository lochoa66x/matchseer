import { NextResponse } from "next/server";
import {
  buildCompetitionDataStatus,
  buildSourceHubStatus,
} from "../../../../lib/providers/source-hub";

export const dynamic = "force-dynamic";

export async function GET() {
  const sources = buildSourceHubStatus();

  return NextResponse.json({
    ready: sources.some((source) => source.status === "live" || source.status === "ready"),
    generatedAt: new Date().toISOString(),
    sources,
    competitions: buildCompetitionDataStatus(),
    nextSteps: [
      "Use football-data for real fixtures, results, standings, and Champions League when configured.",
      "Keep Polymarket as the capped crowd nudge already wired into forecasts.",
      "Wire Kalshi and Metaculus as receipt-only feeds first, then calibrate before any model nudge.",
      "Pick a Liga MX source before claiming that league is live-data complete.",
    ],
  });
}
