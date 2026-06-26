import { NextResponse } from "next/server";
import {
  buildSleeperFantasyLeague,
  type SleeperMatchup,
  type SleeperPlayer,
  type SleeperRoster,
  type SleeperUser,
} from "../../../../../lib/nfl-fantasy-import";

export const dynamic = "force-dynamic";

const sleeperApiBase = "https://api.sleeper.app/v1";

type SleeperState = {
  season?: string | number | null;
  league_season?: string | number | null;
  display_week?: string | number | null;
  week?: string | number | null;
};

type SleeperUserLookup = {
  user_id?: string | number | null;
};

type SleeperLeagueLookup = {
  league_id?: string | number | null;
  name?: string | null;
  status?: string | null;
  season?: string | number | null;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawQuery =
    searchParams.get("q") ??
    searchParams.get("query") ??
    searchParams.get("leagueId") ??
    searchParams.get("username") ??
    "";
  const query = extractSleeperToken(rawQuery);
  const explicitSeason = searchParams.get("season")?.trim();
  const explicitWeek = numberFromValue(searchParams.get("week"));

  if (!query) {
    return NextResponse.json(
      { error: "Enter a Sleeper username, league id, or league link." },
      { status: 400 },
    );
  }

  try {
    const state = await sleeperJson<SleeperState>("/state/nfl", {
      cache: "no-store",
    });
    const season =
      explicitSeason ||
      stringFromValue(state.league_season) ||
      stringFromValue(state.season) ||
      new Date().getFullYear().toString();
    const week =
      explicitWeek ??
      numberFromValue(state.display_week) ??
      numberFromValue(state.week) ??
      undefined;
    const league = looksLikeSleeperId(query)
      ? await sleeperJson<SleeperLeagueLookup>(`/league/${query}`, {
          cache: "no-store",
        })
      : await leagueFromUsername(query, season);
    const leagueId = stringFromValue(league.league_id);

    if (!leagueId) {
      return NextResponse.json(
        { error: "No Sleeper league found for that input." },
        { status: 404 },
      );
    }

    const [rosters, users, players, matchups] = await Promise.all([
      sleeperJson<SleeperRoster[]>(`/league/${leagueId}/rosters`, {
        cache: "no-store",
      }),
      sleeperJson<SleeperUser[]>(`/league/${leagueId}/users`, {
        cache: "no-store",
      }),
      sleeperJson<Record<string, SleeperPlayer>>("/players/nfl", {
        next: { revalidate: 86400 },
      }),
      week
        ? sleeperJson<SleeperMatchup[]>(`/league/${leagueId}/matchups/${week}`, {
            cache: "no-store",
          }).catch(() => [])
        : Promise.resolve([] as SleeperMatchup[]),
    ]);
    const importedLeague = buildSleeperFantasyLeague({
      league,
      matchups,
      players,
      rosters,
      users,
      week,
    });

    if (importedLeague.teams.length === 0) {
      return NextResponse.json(
        { error: "Sleeper returned the league, but no fantasy rosters were usable." },
        { status: 422 },
      );
    }

    return NextResponse.json(importedLeague);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Sleeper import failed. Try a league ID or paste the rosters.",
      },
      { status: 502 },
    );
  }
}

async function leagueFromUsername(username: string, season: string) {
  const user = await sleeperJson<SleeperUserLookup>(
    `/user/${encodeURIComponent(username)}`,
    { cache: "no-store" },
  );
  const userId = stringFromValue(user.user_id);

  if (!userId) {
    throw new Error("Sleeper user was not found.");
  }

  const leagues = await sleeperJson<SleeperLeagueLookup[]>(
    `/user/${userId}/leagues/nfl/${encodeURIComponent(season)}`,
    { cache: "no-store" },
  );
  const league =
    leagues.find((candidate) => candidate.status === "in_season") ??
    leagues.find((candidate) => candidate.status === "pre_draft") ??
    leagues[0];

  if (!league) {
    throw new Error(`No Sleeper NFL leagues found for ${season}.`);
  }

  return league;
}

async function sleeperJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${sleeperApiBase}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Sleeper request failed (${response.status}).`);
  }

  return (await response.json()) as T;
}

function extractSleeperToken(value: string) {
  const trimmed = value.trim();
  const idMatch = trimmed.match(/\d{8,}/);

  return idMatch?.[0] ?? trimmed;
}

function looksLikeSleeperId(value: string) {
  return /^\d{8,}$/.test(value);
}

function stringFromValue(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function numberFromValue(value: unknown) {
  const numberValue =
    typeof value === "string" || typeof value === "number" ? Number(value) : NaN;

  return Number.isFinite(numberValue) && numberValue > 0
    ? Math.floor(numberValue)
    : undefined;
}
