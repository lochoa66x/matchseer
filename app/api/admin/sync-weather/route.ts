import { NextResponse } from "next/server";
import { syncWorldCupWeather } from "../../../../lib/database";

export const dynamic = "force-dynamic";

export async function GET() {
  const hasSyncSecret = Boolean(process.env.MATCHSEER_SYNC_SECRET);

  return NextResponse.json({
    ready: hasSyncSecret,
    provider: "open-meteo",
    envStatus: {
      hasSyncSecret,
      requiresWeatherToken: false,
    },
    requiredEnv: ["MATCHSEER_SYNC_SECRET"],
  });
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
    const result = await syncWorldCupWeather();

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Weather sync failed",
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
