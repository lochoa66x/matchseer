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

  const result = await listMatches();

  if (url.searchParams.get("refresh") === "live") {
    void maybeSyncLiveData();
  }

  return NextResponse.json({
    ...result,
    database: getDatabaseReadiness(),
  });
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
