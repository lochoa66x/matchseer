import { NextResponse } from "next/server";
import { syncFootballDataSnapshot } from "../../../../lib/database";
import { fetchFootballDataSnapshot } from "../../../../lib/providers/football-data";
import { getSoccerCompetition } from "../../../../lib/soccer-competitions";

export const dynamic = "force-dynamic";

export async function GET() {
  const hasFootballDataToken = Boolean(process.env.FOOTBALL_DATA_API_TOKEN);
  const hasSyncSecret = Boolean(process.env.MATCHSEER_SYNC_SECRET);
  const defaultCompetition = getSoccerCompetition(
    process.env.FOOTBALL_DATA_COMPETITION_KEY,
  );

  return NextResponse.json({
    ready: hasFootballDataToken && hasSyncSecret,
    provider: "football-data",
    competition: defaultCompetition.key,
    competitionCode:
      process.env.FOOTBALL_DATA_COMPETITION ??
      defaultCompetition.footballDataCode ??
      "WC",
    envStatus: {
      hasFootballDataToken,
      hasSyncSecret,
    },
    requiredEnv: ["FOOTBALL_DATA_API_TOKEN", "MATCHSEER_SYNC_SECRET"],
  });
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const secret = process.env.MATCHSEER_SYNC_SECRET;
  const token = process.env.FOOTBALL_DATA_API_TOKEN;
  const selectedCompetitionKey =
    url.searchParams.get("competition") ??
    process.env.FOOTBALL_DATA_COMPETITION_KEY;
  const competition = getSoccerCompetition(selectedCompetitionKey);
  const competitionCode =
    selectedCompetitionKey && !competition.footballDataCode
      ? null
      : (competition.footballDataCode ??
          process.env.FOOTBALL_DATA_COMPETITION ??
          "WC");

  if (!secret) {
    return NextResponse.json(
      { error: "MATCHSEER_SYNC_SECRET is required" },
      { status: 503 },
    );
  }

  if (!token) {
    return NextResponse.json(
      { error: "FOOTBALL_DATA_API_TOKEN is required" },
      { status: 503 },
    );
  }

  if (!isAuthorized(request, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!competitionCode) {
    return NextResponse.json(
      {
        error: `${competition.name} does not have a football-data provider configured yet.`,
        competitionKey: competition.key,
      },
      { status: 400 },
    );
  }

  try {
    const snapshot = await fetchFootballDataSnapshot({
      token,
      competitionCode,
    });
    const result = await syncFootballDataSnapshot(snapshot);

    return NextResponse.json({
      ...result,
      competitionKey: competition.key,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Sync failed",
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
