import { NextResponse } from "next/server";
import {
  getDatabaseReadiness,
  listMatches,
  syncFootballDataSnapshot,
} from "../../../lib/database";
import { fetchFootballDataSnapshot } from "../../../lib/providers/football-data";

export const dynamic = "force-dynamic";

const LIVE_SYNC_INTERVAL_MS = 12_000;

let lastPublicLiveSyncAt = 0;
let publicLiveSyncPromise: Promise<unknown> | null = null;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const isInitial = url.searchParams.get("initial") === "1";
  const limit = parsePositiveLimit(url.searchParams.get("limit"));

  const result = await listMatches({
    limit: limit ?? (isInitial ? 14 : null),
    prioritizeUpcoming: isInitial,
  });

  if (url.searchParams.get("refresh") === "live") {
    void maybeSyncLiveData();
  }

  return NextResponse.json({
    ...result,
    database: getDatabaseReadiness(),
  });
}

function parsePositiveLimit(value: string | null) {
  if (!value) {
    return null;
  }

  const numeric = Number(value);

  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

async function maybeSyncLiveData() {
  if (!process.env.FOOTBALL_DATA_API_TOKEN || !process.env.DATABASE_URL) {
    return;
  }

  const now = Date.now();

  if (now - lastPublicLiveSyncAt < LIVE_SYNC_INTERVAL_MS) {
    return;
  }

  if (!publicLiveSyncPromise) {
    publicLiveSyncPromise = syncLiveData()
      .catch((error) => {
        console.error("MatchSeer public live sync failed", error);
      })
      .finally(() => {
        publicLiveSyncPromise = null;
      });
  }

  await publicLiveSyncPromise;
}

async function syncLiveData() {
  lastPublicLiveSyncAt = Date.now();
  const snapshot = await fetchFootballDataSnapshot({
    token: process.env.FOOTBALL_DATA_API_TOKEN!,
    competitionCode: process.env.FOOTBALL_DATA_COMPETITION ?? "WC",
  });

  await syncFootballDataSnapshot(snapshot);
}
