import { NextResponse } from "next/server";
import {
  getDatabaseReadiness,
  listMatches,
  syncFootballDataSnapshot,
} from "../../../lib/database";
import { fetchFootballDataSnapshot } from "../../../lib/providers/football-data";
import { getSoccerCompetition } from "../../../lib/soccer-competitions";

export const dynamic = "force-dynamic";

const LIVE_SYNC_INTERVAL_MS = 12_000;

const lastPublicLiveSyncByCompetition = new Map<string, number>();
const publicLiveSyncPromiseByCompetition = new Map<string, Promise<unknown>>();

export async function GET(request: Request) {
  const url = new URL(request.url);
  const isInitial = url.searchParams.get("initial") === "1";
  const limit = parsePositiveLimit(url.searchParams.get("limit"));
  const competition = getSoccerCompetition(url.searchParams.get("competition"));

  const result = await listMatches({
    limit: limit ?? (isInitial ? 8 : null),
    prioritizeUpcoming: isInitial,
    competitionName: competition.databaseCompetitionName,
    competitionSlug: competition.databaseCompetitionSlug,
  });

  if (url.searchParams.get("refresh") === "live") {
    void maybeSyncLiveData(competition.key, competition.footballDataCode);
  }

  return NextResponse.json({
    ...result,
    competition: {
      key: competition.key,
      name: competition.name,
      liveDataStatus: competition.liveDataStatus,
    },
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

async function maybeSyncLiveData(
  competitionKey: string,
  footballDataCode: string | undefined,
) {
  if (
    !footballDataCode ||
    !process.env.FOOTBALL_DATA_API_TOKEN ||
    !process.env.DATABASE_URL
  ) {
    return;
  }

  const now = Date.now();
  const lastPublicLiveSyncAt =
    lastPublicLiveSyncByCompetition.get(competitionKey) ?? 0;

  if (now - lastPublicLiveSyncAt < LIVE_SYNC_INTERVAL_MS) {
    return;
  }

  if (!publicLiveSyncPromiseByCompetition.has(competitionKey)) {
    const syncPromise = syncLiveData(competitionKey, footballDataCode)
      .catch((error) => {
        console.error("MatchSeer public live sync failed", error);
      })
      .finally(() => {
        publicLiveSyncPromiseByCompetition.delete(competitionKey);
      });

    publicLiveSyncPromiseByCompetition.set(competitionKey, syncPromise);
  }

  await publicLiveSyncPromiseByCompetition.get(competitionKey);
}

async function syncLiveData(competitionKey: string, footballDataCode: string) {
  lastPublicLiveSyncByCompetition.set(competitionKey, Date.now());
  const snapshot = await fetchFootballDataSnapshot({
    token: process.env.FOOTBALL_DATA_API_TOKEN!,
    competitionCode: footballDataCode,
  });

  await syncFootballDataSnapshot(snapshot);
}
