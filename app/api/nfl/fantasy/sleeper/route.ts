import { NextResponse } from "next/server";
import {
  buildSleeperFantasyLeague,
  parseSleeperImportQuery,
  sleeperLeagueOptionsFromLeagues,
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
  username?: string | null;
  display_name?: string | null;
};

type SleeperLeagueLookup = {
  league_id?: string | number | null;
  name?: string | null;
  status?: string | null;
  season?: string | number | null;
  total_rosters?: string | number | null;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawLeagueId = searchParams.get("leagueId")?.trim() ?? "";
  const rawUserId = searchParams.get("userId")?.trim() ?? "";
  const rawQuery =
    searchParams.get("q") ??
    searchParams.get("query") ??
    (rawLeagueId || searchParams.get("username") || "");
  const query = parseSleeperImportQuery(rawLeagueId || rawQuery);
  const explicitSeason = searchParams.get("season")?.trim();
  const explicitWeek = numberFromValue(searchParams.get("week"));

  if (!query.token) {
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
    const lookup = rawLeagueId
      ? {
          league: await sleeperJson<SleeperLeagueLookup>(`/league/${rawLeagueId}`, {
            cache: "no-store",
          }),
          userId: rawUserId,
        }
      : await resolveSleeperLookup(query, season, rawUserId);

    if ("leagueOptions" in lookup) {
      return NextResponse.json({
        mode: "league-options",
        season,
        userId: lookup.userId,
        username: lookup.username,
        week,
        leagues: lookup.leagueOptions,
        message: `${lookup.leagueOptions.length} Sleeper leagues found. Pick the one to analyze.`,
      });
    }

    const { league } = lookup;
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
      preferredOwnerId: lookup.userId,
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

async function resolveSleeperLookup(
  query: ReturnType<typeof parseSleeperImportQuery>,
  season: string,
  userIdHint: string,
): Promise<
  | { league: SleeperLeagueLookup; userId: string }
  | {
      leagueOptions: ReturnType<typeof sleeperLeagueOptionsFromLeagues>;
      userId: string;
      username: string;
    }
> {
  if (query.kind === "league") {
    return {
      league: await sleeperJson<SleeperLeagueLookup>(`/league/${query.token}`, {
        cache: "no-store",
      }),
      userId: userIdHint,
    };
  }

  if (query.kind === "id" && !userIdHint) {
    try {
      const league = await sleeperJson<SleeperLeagueLookup>(`/league/${query.token}`, {
        cache: "no-store",
      });

      if (stringFromValue(league.league_id)) {
        return { league, userId: "" };
      }
    } catch {
      // Numeric Sleeper user ids look like league ids, so fall through to user lookup.
    }
  }

  const user = await sleeperJson<SleeperUserLookup>(
    `/user/${encodeURIComponent(query.token)}`,
    { cache: "no-store" },
  );
  const userId = stringFromValue(user.user_id) || userIdHint;

  if (!userId) {
    throw new Error("Sleeper user was not found.");
  }

  const leagues = await sleeperJson<SleeperLeagueLookup[]>(
    `/user/${userId}/leagues/nfl/${encodeURIComponent(season)}`,
    { cache: "no-store" },
  );
  const leagueOptions = sleeperLeagueOptionsFromLeagues({
    leagues,
    season,
    userId,
  });

  if (leagueOptions.length === 0) {
    throw new Error(`No Sleeper NFL leagues found for ${season}.`);
  }

  if (leagueOptions.length > 1) {
    return {
      leagueOptions,
      userId,
      username: stringFromValue(user.display_name) || stringFromValue(user.username),
    };
  }

  const league = leagues.find(
    (candidate) => stringFromValue(candidate.league_id) === leagueOptions[0].leagueId,
  );

  if (!league) {
    throw new Error(`No Sleeper NFL leagues found for ${season}.`);
  }

  return { league, userId };
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
