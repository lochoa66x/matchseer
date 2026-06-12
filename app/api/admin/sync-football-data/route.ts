import { NextResponse } from "next/server";
import { syncFootballDataSnapshot } from "../../../../lib/database";
import { fetchFootballDataSnapshot } from "../../../../lib/providers/football-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const hasFootballDataToken = Boolean(process.env.FOOTBALL_DATA_API_TOKEN);
  const hasSyncSecret = Boolean(process.env.MATCHSEER_SYNC_SECRET);

  return NextResponse.json({
    ready: hasFootballDataToken && hasSyncSecret,
    provider: "football-data",
    competition: process.env.FOOTBALL_DATA_COMPETITION ?? "WC",
    envStatus: {
      hasFootballDataToken,
      hasSyncSecret,
    },
    requiredEnv: ["FOOTBALL_DATA_API_TOKEN", "MATCHSEER_SYNC_SECRET"],
  });
}

export async function POST(request: Request) {
  const secret = process.env.MATCHSEER_SYNC_SECRET;
  const token = process.env.FOOTBALL_DATA_API_TOKEN;

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

  try {
    const snapshot = await fetchFootballDataSnapshot({
      token,
      competitionCode: process.env.FOOTBALL_DATA_COMPETITION ?? "WC",
    });
    const result = await syncFootballDataSnapshot(snapshot);

    return NextResponse.json(result);
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
