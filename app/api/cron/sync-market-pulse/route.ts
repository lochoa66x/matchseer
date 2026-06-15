import { NextResponse } from "next/server";
import { applyMarketPulseUpdates, listMatches } from "../../../../lib/database";
import { fetchPolymarketPulseSnapshot } from "../../../../lib/providers/polymarket";

export const dynamic = "force-dynamic";
// Polymarket sync does up to ~90 lookups; give it headroom so a slow batch can't
// be cut off mid-run. Allowed on Vercel Pro (Hobby caps function duration at 10s).
export const maxDuration = 120;

// Triggered by Vercel Cron (see vercel.json). Vercel attaches
// `Authorization: Bearer <CRON_SECRET>` to scheduled requests, so we require
// CRON_SECRET to be set and matched — that also stops the endpoint being abused.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET is required to run the scheduled sync" },
      { status: 503 },
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const matchResult = await listMatches();
    const targets = matchResult.matches
      .filter((match) => match.status !== "Final")
      .slice(0, 90)
      .map((match) => ({
        matchId: match.id,
        startsAt: match.startsAt,
        home: {
          name: match.home.name,
          code: match.home.code,
        },
        away: {
          name: match.away.name,
          code: match.away.code,
        },
      }));

    const snapshot = await fetchPolymarketPulseSnapshot(targets);
    const result = await applyMarketPulseUpdates(snapshot.updates, "polymarket");

    return NextResponse.json({
      ...result,
      targets: snapshot.targets,
      marketsScanned: snapshot.marketsScanned,
      skippedReasons: snapshot.skipped,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Scheduled market sync failed",
      },
      { status: 500 },
    );
  }
}
