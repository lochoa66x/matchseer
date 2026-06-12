import { findWorldCupVenue } from "./world-cup-venues";

export type FootballDataTeam = {
  id: number;
  slug: string;
  name: string;
  code: string;
  color: string;
  country: string | null;
};

export type FootballDataMatch = {
  providerId: number;
  externalId: string;
  status: "scheduled" | "live" | "final";
  stage: string | null;
  groupName: string | null;
  startsAt: string | null;
  homeScore: number | null;
  awayScore: number | null;
  homeTeamProviderId: number;
  awayTeamProviderId: number;
  venueSlug: string | null;
  venueName: string | null;
};

export type FootballDataSnapshot = {
  provider: "football-data";
  competition: {
    slug: string;
    name: string;
    sport: "football";
    season: string;
    code: string;
  };
  teams: FootballDataTeam[];
  matches: FootballDataMatch[];
  fetchedAt: string;
};

type FootballDataTeamsResponse = {
  competition?: {
    code?: string | null;
    name?: string | null;
  };
  season?: {
    startDate?: string | null;
    endDate?: string | null;
  };
  teams?: Array<{
    id: number;
    name: string;
    shortName?: string | null;
    tla?: string | null;
    area?: {
      name?: string | null;
    };
    clubColors?: string | null;
  }>;
};

type FootballDataMatchesResponse = {
  competition?: {
    code?: string | null;
    name?: string | null;
  };
  matches?: Array<{
    id: number;
    utcDate?: string | null;
    status?: string | null;
    stage?: string | null;
    group?: string | null;
    homeTeam?: FootballDataMatchTeam | null;
    awayTeam?: FootballDataMatchTeam | null;
    venue?: string | { name?: string | null } | null;
    venueName?: string | null;
    stadium?: string | { name?: string | null } | null;
    score?: {
      fullTime?: {
        home?: number | null;
        away?: number | null;
      } | null;
    } | null;
  }>;
};

type FootballDataMatchTeam = {
  id?: number | null;
  name?: string | null;
  shortName?: string | null;
  tla?: string | null;
};

export async function fetchFootballDataSnapshot({
  token,
  competitionCode = "WC",
}: {
  token: string;
  competitionCode?: string;
}): Promise<FootballDataSnapshot> {
  const headers = {
    "X-Auth-Token": token,
  };
  const baseUrl = "https://api.football-data.org/v4";

  const [teamsResponse, matchesResponse] = await Promise.all([
    fetch(`${baseUrl}/competitions/${competitionCode}/teams`, {
      headers,
      cache: "no-store",
    }),
    fetch(`${baseUrl}/competitions/${competitionCode}/matches`, {
      headers,
      cache: "no-store",
    }),
  ]);

  if (!teamsResponse.ok) {
    throw new Error(`football-data teams request failed: ${teamsResponse.status}`);
  }

  if (!matchesResponse.ok) {
    throw new Error(
      `football-data matches request failed: ${matchesResponse.status}`,
    );
  }

  const teamsPayload = (await teamsResponse.json()) as FootballDataTeamsResponse;
  const matchesPayload =
    (await matchesResponse.json()) as FootballDataMatchesResponse;
  const competitionName =
    teamsPayload.competition?.name ??
    matchesPayload.competition?.name ??
    "World Cup";
  const season =
    extractSeason(teamsPayload.season?.startDate) ??
    extractSeason(teamsPayload.season?.endDate) ??
    new Date().getFullYear().toString();

  return {
    provider: "football-data",
    competition: {
      slug: slugify(`${competitionName}-${season}`),
      name: competitionName,
      sport: "football",
      season,
      code: competitionCode,
    },
    teams: buildTeamList(teamsPayload.teams ?? [], matchesPayload.matches ?? []),
    matches: (matchesPayload.matches ?? [])
      .map(toFootballDataMatch)
      .filter((match): match is FootballDataMatch => match !== null),
    fetchedAt: new Date().toISOString(),
  };
}

function buildTeamList(
  teams: NonNullable<FootballDataTeamsResponse["teams"]>,
  matches: NonNullable<FootballDataMatchesResponse["matches"]>,
) {
  const byProviderId = new Map<number, FootballDataTeam>();

  for (const team of teams) {
    byProviderId.set(team.id, {
      id: team.id,
      slug: teamSlug(team.tla, team.shortName ?? team.name),
      name: team.shortName ?? team.name,
      code: normalizeCode(team.tla, team.shortName ?? team.name),
      color: colorFromText(team.clubColors ?? team.name),
      country: team.area?.name ?? null,
    });
  }

  for (const match of matches) {
    for (const team of [match.homeTeam, match.awayTeam]) {
      if (!team?.id || byProviderId.has(team.id)) {
        continue;
      }

      const name = team.shortName ?? team.name ?? `Team ${team.id}`;

      byProviderId.set(team.id, {
        id: team.id,
        slug: teamSlug(team.tla, name),
        name,
        code: normalizeCode(team.tla, name),
        color: colorFromText(name),
        country: null,
      });
    }
  }

  return Array.from(byProviderId.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

function toFootballDataMatch(
  match: NonNullable<FootballDataMatchesResponse["matches"]>[number],
) {
  const homeTeamProviderId = match.homeTeam?.id;
  const awayTeamProviderId = match.awayTeam?.id;
  const venueName = readVenueName(match);
  const venue = findWorldCupVenue(venueName);

  if (!homeTeamProviderId || !awayTeamProviderId) {
    return null;
  }

  return {
    providerId: match.id,
    externalId: `fd-${match.id}`,
    status: toMatchStatus(match.status),
    stage: match.stage ?? null,
    groupName: match.group ?? match.stage ?? null,
    startsAt: match.utcDate ?? null,
    homeScore: match.score?.fullTime?.home ?? null,
    awayScore: match.score?.fullTime?.away ?? null,
    homeTeamProviderId,
    awayTeamProviderId,
    venueSlug: venue?.slug ?? null,
    venueName,
  };
}

function readVenueName(
  match: NonNullable<FootballDataMatchesResponse["matches"]>[number],
) {
  const venueValues = [match.venue, match.venueName, match.stadium];

  for (const venueValue of venueValues) {
    if (typeof venueValue === "string" && venueValue.trim()) {
      return venueValue;
    }

    if (
      venueValue &&
      typeof venueValue === "object" &&
      "name" in venueValue &&
      typeof venueValue.name === "string" &&
      venueValue.name.trim()
    ) {
      return venueValue.name;
    }
  }

  return null;
}

function toMatchStatus(status: string | null | undefined) {
  if (status === "FINISHED") {
    return "final";
  }

  if (status === "LIVE" || status === "IN_PLAY" || status === "PAUSED") {
    return "live";
  }

  return "scheduled";
}

function extractSeason(dateValue: string | null | undefined) {
  return dateValue?.slice(0, 4) || null;
}

function normalizeCode(code: string | null | undefined, fallback: string) {
  const cleanCode = code?.replace(/[^A-Z0-9]/gi, "").toUpperCase();

  if (cleanCode && cleanCode.length <= 4) {
    return cleanCode;
  }

  return fallback
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

function teamSlug(code: string | null | undefined, name: string) {
  return slugify(code && code.length <= 4 ? code : name);
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function colorFromText(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = value.charCodeAt(index) + ((hash << 5) - hash);
  }

  const colors = [
    "#11a36a",
    "#f5c542",
    "#325dff",
    "#d94141",
    "#8d5cf6",
    "#e1251b",
    "#0b8fa8",
    "#c1272d",
  ];

  return colors[Math.abs(hash) % colors.length];
}
