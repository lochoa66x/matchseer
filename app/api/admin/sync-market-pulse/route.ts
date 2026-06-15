import { NextResponse } from "next/server";
import {
  applyMarketPulseUpdates,
  listMatches,
  type MarketPulseUpdate,
} from "../../../../lib/database";
import { fetchPolymarketPulseSnapshot } from "../../../../lib/providers/polymarket";

export const dynamic = "force-dynamic";

export async function GET() {
  const hasSyncSecret = Boolean(process.env.MATCHSEER_SYNC_SECRET);

  return NextResponse.json({
    ready: hasSyncSecret,
    provider: "polymarket",
    mode: "public-market-data",
    envStatus: {
      hasSyncSecret,
    },
    requiredEnv: ["MATCHSEER_SYNC_SECRET"],
    note: "No paid API key required. Market Pulse is public sentiment only.",
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
    const payload = await readOptionalJson(request);
    const manualUpdates = parseManualUpdates(payload);

    if (manualUpdates.length > 0) {
      const result = await applyMarketPulseUpdates(manualUpdates, "manual");

      return NextResponse.json(result);
    }

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
          error instanceof Error ? error.message : "Market pulse sync failed",
      },
      { status: 500 },
    );
  }
}

async function readOptionalJson(request: Request) {
  try {
    const text = await request.text();

    return text.trim() ? (JSON.parse(text) as unknown) : null;
  } catch {
    return null;
  }
}

function parseManualUpdates(payload: unknown): MarketPulseUpdate[] {
  if (!payload || typeof payload !== "object" || !("updates" in payload)) {
    return [];
  }

  const updates = (payload as { updates?: unknown }).updates;

  if (!Array.isArray(updates)) {
    return [];
  }

  return updates.flatMap((update): MarketPulseUpdate[] => {
    if (!update || typeof update !== "object") {
      return [];
    }

    const value = update as Record<string, unknown>;

    if (typeof value.matchId !== "string") {
      return [];
    }

    return [
      {
        matchId: value.matchId,
        source: "manual",
        home: Number(value.home),
        draw: Number(value.draw),
        away: Number(value.away),
        liquidityScore:
          value.liquidityScore === undefined
            ? undefined
            : Number(value.liquidityScore),
        liquidity:
          value.liquidity === undefined ? undefined : Number(value.liquidity),
        volume: value.volume === undefined ? undefined : Number(value.volume),
        capturedAt:
          typeof value.capturedAt === "string" ? value.capturedAt : undefined,
        marketId: typeof value.marketId === "string" ? value.marketId : undefined,
        marketSlug:
          typeof value.marketSlug === "string" ? value.marketSlug : undefined,
        question: typeof value.question === "string" ? value.question : undefined,
      },
    ];
  });
}

function isAuthorized(request: Request, secret: string) {
  const authorization = request.headers.get("authorization");
  const syncSecret = request.headers.get("x-sync-secret");

  return authorization === `Bearer ${secret}` || syncSecret === secret;
}
