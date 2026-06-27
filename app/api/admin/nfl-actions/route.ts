import { NextResponse } from "next/server";
import {
  fetchNflSeerDataset,
  type FantasyProviderKind,
  type NflFantasyProviderStatus,
  type NflSeerDataset,
} from "../../../../lib/nfl-seer-data";

export const dynamic = "force-dynamic";

type NflAdminAction =
  | "all"
  | "players"
  | "polymarket"
  | "projections"
  | "rankings"
  | "schedule"
  | "sleeper";

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
    const action = readAction(payload);
    const dataset = await fetchNflSeerDataset();

    return NextResponse.json({
      action,
      dataset,
      fetchedAt: new Date().toISOString(),
      receipt: actionReceipt(action, dataset),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "NFL action failed.",
      },
      { status: 500 },
    );
  }
}

async function readJson(request: Request) {
  try {
    return (await request.json()) as unknown;
  } catch {
    return null;
  }
}

function readAction(payload: unknown): NflAdminAction {
  if (!payload || typeof payload !== "object" || !("action" in payload)) {
    return "all";
  }

  const action = (payload as { action?: unknown }).action;

  if (
    action === "all" ||
    action === "players" ||
    action === "polymarket" ||
    action === "projections" ||
    action === "rankings" ||
    action === "schedule" ||
    action === "sleeper"
  ) {
    return action;
  }

  return "all";
}

function actionReceipt(action: NflAdminAction, dataset: NflSeerDataset) {
  if (action === "schedule") {
    return `Schedule lane ${dataset.providerStatus.schedule}: ${dataset.matchups.length} NFL matchup${dataset.matchups.length === 1 ? "" : "s"} loaded for ${dataset.weekLabel}.`;
  }

  if (action === "polymarket") {
    const pulseCount = dataset.matchups.filter((matchup) => matchup.marketPulse).length;

    return `Crowd lane ${dataset.providerStatus.market}: ${pulseCount}/${dataset.matchups.length} matchup${dataset.matchups.length === 1 ? "" : "s"} have usable Polymarket signal.`;
  }

  if (action === "all") {
    const liveProviders =
      dataset.providerStatus.fantasyProviders?.filter(
        (provider) => provider.status === "live",
      ).length ?? 0;

    return `NFL admin refresh complete: schedule ${dataset.providerStatus.schedule}, fantasy ${dataset.providerStatus.fantasy}, crowd ${dataset.providerStatus.market}, ${liveProviders} provider lane${liveProviders === 1 ? "" : "s"} live.`;
  }

  const provider = providerForAction(action, dataset.providerStatus.fantasyProviders ?? []);

  if (!provider) {
    return `${actionLabel(action)} lane has no provider receipt yet.`;
  }

  return `${provider.label} ${provider.status}: ${provider.count} row${provider.count === 1 ? "" : "s"} · ${provider.message}`;
}

function providerForAction(
  action: Exclude<NflAdminAction, "all" | "polymarket" | "schedule">,
  providers: NflFantasyProviderStatus[],
) {
  const kindByAction: Record<typeof action, FantasyProviderKind> = {
    players: "players",
    projections: "projections",
    rankings: "rankings",
    sleeper: "sleeper",
  };

  return providers.find((provider) => provider.kind === kindByAction[action]);
}

function actionLabel(action: NflAdminAction) {
  if (action === "polymarket") {
    return "Crowd";
  }

  return action.slice(0, 1).toUpperCase() + action.slice(1);
}

function isAuthorized(request: Request, secret: string) {
  const authorization = request.headers.get("authorization");
  const syncSecret = request.headers.get("x-sync-secret");

  return authorization === `Bearer ${secret}` || syncSecret === secret;
}
