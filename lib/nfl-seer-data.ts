export type NflTeamFeed = {
  code: string;
  name: string;
  city: string;
  color: string;
  offense: number;
  defense: number;
  qb: number;
  trenches: number;
  coaching: number;
  injuries: number;
};

export type NflMatchupFeed = {
  id: string;
  week: string;
  slot: string;
  venue: string;
  weather: string;
  home: NflTeamFeed;
  away: NflTeamFeed;
  homeWin: number;
  awayWin: number;
  projected: string;
  confidence: number;
  chaos: number;
  pace: number;
  read: string;
  edges: string[];
};

export type NflSeerProviderStatus = {
  schedule: "live" | "fallback";
  fantasy: "live" | "fallback";
  notes: string[];
};

export type NflSeerDataset = {
  source: "espn-scoreboard" | "configured-feed" | "seeded-fallback";
  season: string;
  weekLabel: string;
  updatedAt: string;
  matchups: NflMatchupFeed[];
  fantasyPlayers: unknown[];
  providerStatus: NflSeerProviderStatus;
};

type EspnScoreboardResponse = {
  season?: {
    year?: number | string | null;
  } | null;
  week?: {
    number?: number | string | null;
  } | null;
  events?: EspnEvent[];
};

type EspnEvent = {
  id?: string | number | null;
  date?: string | null;
  name?: string | null;
  shortName?: string | null;
  season?: {
    year?: number | string | null;
  } | null;
  week?: {
    number?: number | string | null;
  } | null;
  competitions?: Array<{
    date?: string | null;
    venue?: {
      fullName?: string | null;
      indoor?: boolean | null;
    } | null;
    competitors?: EspnCompetitor[];
  }>;
};

type EspnCompetitor = {
  homeAway?: "home" | "away" | string | null;
  score?: string | number | null;
  team?: {
    abbreviation?: string | null;
    color?: string | null;
    displayName?: string | null;
    location?: string | null;
    name?: string | null;
    shortDisplayName?: string | null;
  } | null;
};

const espnScoreboardUrl =
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?limit=16";

export async function fetchNflSeerDataset(): Promise<NflSeerDataset> {
  const fetchedAt = new Date().toISOString();
  const notes: string[] = [];
  const scheduleUrl = process.env.NFL_SEER_DATA_URL ?? espnScoreboardUrl;
  const fantasyUrl = process.env.NFL_FANTASY_DATA_URL;
  const fantasyPlayers = fantasyUrl
    ? await fetchFantasyPlayers(fantasyUrl, notes)
    : [];

  try {
    const response = await fetch(scheduleUrl, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`NFL schedule feed failed: ${response.status}`);
    }

    const payload = (await response.json()) as unknown;
    const dataset = toNflSeerDataset(payload, {
      fetchedAt,
      fantasyPlayers,
      source: process.env.NFL_SEER_DATA_URL ? "configured-feed" : "espn-scoreboard",
    });

    if (dataset.matchups.length === 0) {
      throw new Error("NFL schedule feed returned no usable matchups");
    }

    return {
      ...dataset,
      providerStatus: {
        schedule: "live",
        fantasy: fantasyPlayers.length > 0 ? "live" : "fallback",
        notes:
          fantasyPlayers.length > 0
            ? notes
            : [...notes, "Fantasy board is still using the seeded preseason rail."],
      },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "NFL schedule feed failed";

    return {
      source: "seeded-fallback",
      season: new Date().getFullYear().toString(),
      weekLabel: "Seeded lab",
      updatedAt: fetchedAt,
      matchups: [],
      fantasyPlayers,
      providerStatus: {
        schedule: "fallback",
        fantasy: fantasyPlayers.length > 0 ? "live" : "fallback",
        notes: [
          message,
          fantasyPlayers.length > 0
            ? "Fantasy feed is live."
            : "Fantasy board is still using the seeded preseason rail.",
        ],
      },
    };
  }
}

export function toNflSeerDataset(
  payload: unknown,
  {
    fetchedAt,
    fantasyPlayers = [],
    source = "configured-feed",
  }: {
    fetchedAt: string;
    fantasyPlayers?: unknown[];
    source?: NflSeerDataset["source"];
  },
): NflSeerDataset {
  if (isCanonicalNflSeerDataset(payload)) {
    return {
      ...payload,
      updatedAt: payload.updatedAt ?? fetchedAt,
      fantasyPlayers:
        payload.fantasyPlayers.length > 0 ? payload.fantasyPlayers : fantasyPlayers,
      providerStatus: {
        schedule: payload.matchups.length > 0 ? "live" : "fallback",
        fantasy:
          payload.fantasyPlayers.length > 0 || fantasyPlayers.length > 0
            ? "live"
            : "fallback",
        notes: payload.providerStatus?.notes ?? [],
      },
    };
  }

  return fromEspnScoreboard(payload, { fetchedAt, fantasyPlayers, source });
}

function fromEspnScoreboard(
  payload: unknown,
  {
    fetchedAt,
    fantasyPlayers,
    source,
  }: {
    fetchedAt: string;
    fantasyPlayers: unknown[];
    source: NflSeerDataset["source"];
  },
): NflSeerDataset {
  const scoreboard = payload as Partial<EspnScoreboardResponse>;
  const weekNumber = scoreboard.week?.number
    ? Number(scoreboard.week.number)
    : null;
  const season =
    scoreboard.season?.year ??
    scoreboard.events?.find((event) => event.season?.year)?.season?.year ??
    new Date().getFullYear();
  const matchups =
    scoreboard.events
      ?.map((event) => espnEventToMatchup(event, weekNumber))
      .filter((matchup): matchup is NflMatchupFeed => matchup !== null)
      .slice(0, 8) ?? [];

  return {
    source,
    season: String(season),
    weekLabel: weekNumber ? `Week ${weekNumber}` : "NFL slate",
    updatedAt: fetchedAt,
    matchups,
    fantasyPlayers,
    providerStatus: {
      schedule: matchups.length > 0 ? "live" : "fallback",
      fantasy: fantasyPlayers.length > 0 ? "live" : "fallback",
      notes: [],
    },
  };
}

function espnEventToMatchup(
  event: EspnEvent,
  scoreboardWeek: number | null,
): NflMatchupFeed | null {
  const competition = event.competitions?.[0];
  const home = competition?.competitors?.find(
    (competitor) => competitor.homeAway === "home",
  );
  const away = competition?.competitors?.find(
    (competitor) => competitor.homeAway === "away",
  );

  if (!home?.team || !away?.team) {
    return null;
  }

  const homeTeam = espnCompetitorToTeam(home);
  const awayTeam = espnCompetitorToTeam(away);
  const weekNumber =
    event.week?.number ?? scoreboardWeek ?? event.season?.year ?? "NFL";
  const venueName = competition?.venue?.fullName ?? "NFL venue";
  const weather = competition?.venue?.indoor ? "Dome" : "Weather watch";
  const homeWin = projectedHomeWin(homeTeam, awayTeam, venueName);
  const awayWin = 100 - homeWin;
  const projected = projectedScore({
    away: awayTeam,
    awayWin,
    home: homeTeam,
    homeWin,
  });
  const leader = homeWin >= awayWin ? homeTeam : awayTeam;
  const edge = Math.abs(homeWin - awayWin);

  return {
    id: `espn-${event.id ?? `${awayTeam.code}-${homeTeam.code}`}`,
    week: typeof weekNumber === "number" ? `Week ${weekNumber}` : String(weekNumber),
    slot: formatKickoff(competition?.date ?? event.date),
    venue: venueName,
    weather,
    home: homeTeam,
    away: awayTeam,
    homeWin,
    awayWin,
    projected,
    confidence: clampMeter(52 + Math.round(edge * 0.9)),
    chaos: clampMeter(48 + Math.round((100 - edge) * 0.16)),
    pace: matchupPace(homeTeam, awayTeam),
    read:
      edge <= 6
        ? `${awayTeam.code} at ${homeTeam.code} opens as a thin-lane read. The Seer wants injury, weather, and depth chart receipts before shouting.`
        : `${leader.code} has the first ${Math.max(homeWin, awayWin)}% lane from the real slate pull, with roster strength and venue pressure doing the early work.`,
    edges: matchupEdges({ away: awayTeam, home: homeTeam, venueName, weather }),
  };
}

function espnCompetitorToTeam(competitor: EspnCompetitor): NflTeamFeed {
  const team = competitor.team;
  const code = normalizeCode(team?.abbreviation ?? team?.shortDisplayName ?? "NFL");
  const city = cleanLine(team?.location) || code;
  const name = cleanLine(team?.shortDisplayName ?? team?.name) || code;

  return {
    code,
    name,
    city,
    color: normalizeColor(team?.color, code),
    offense: seededRating(`${code}-offense`, 74, 91),
    defense: seededRating(`${code}-defense`, 72, 90),
    qb: seededRating(`${code}-qb`, 70, 94),
    trenches: seededRating(`${code}-trenches`, 72, 92),
    coaching: seededRating(`${code}-coaching`, 72, 93),
    injuries: seededRating(`${code}-health`, 70, 92),
  };
}

function projectedHomeWin(home: NflTeamFeed, away: NflTeamFeed, venueName: string) {
  const homeStrength = teamStrength(home);
  const awayStrength = teamStrength(away);
  const venueEdge = venueName === "NFL venue" ? 1.5 : 2.8;

  return clampProbability(Math.round(50 + (homeStrength - awayStrength) * 0.38 + venueEdge));
}

function projectedScore({
  away,
  awayWin,
  home,
  homeWin,
}: {
  away: NflTeamFeed;
  awayWin: number;
  home: NflTeamFeed;
  homeWin: number;
}) {
  const total = Math.round(
    41 +
      (home.offense + away.offense - 150) * 0.13 +
      (home.qb + away.qb - 150) * 0.08,
  );
  const homeMargin = (homeWin - 50) / 2.4;
  let homeScore = Math.round(total / 2 + homeMargin / 2);
  let awayScore = Math.round(total - homeScore);

  if (homeWin > awayWin && homeScore <= awayScore) {
    homeScore = awayScore + 1;
  }

  if (awayWin > homeWin && awayScore <= homeScore) {
    awayScore = homeScore + 1;
  }

  if (homeScore >= awayScore) {
    return `${home.code} ${homeScore}-${awayScore}`;
  }

  return `${away.code} ${awayScore}-${homeScore}`;
}

function matchupEdges({
  away,
  home,
  venueName,
  weather,
}: {
  away: NflTeamFeed;
  home: NflTeamFeed;
  venueName: string;
  weather: string;
}) {
  const edges = [
    Math.abs(home.qb - away.qb) >= 5 ? "QB edge" : "QB duel",
    Math.abs(home.trenches - away.trenches) >= 5 ? "Trench stress" : "Line balance",
    weather === "Dome" ? "Clean track" : "Weather watch",
  ];

  if (venueName !== "NFL venue") {
    edges.push("Home noise");
  }

  return edges.slice(0, 3);
}

async function fetchFantasyPlayers(url: string, notes: string[]) {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`NFL fantasy feed failed: ${response.status}`);
    }

    const payload = (await response.json()) as unknown;

    if (Array.isArray(payload)) {
      return payload;
    }

    if (
      typeof payload === "object" &&
      payload !== null &&
      "fantasyPlayers" in payload &&
      Array.isArray(payload.fantasyPlayers)
    ) {
      return payload.fantasyPlayers;
    }
  } catch (error) {
    notes.push(
      error instanceof Error ? error.message : "NFL fantasy feed failed to load.",
    );
  }

  return [];
}

function isCanonicalNflSeerDataset(
  payload: unknown,
): payload is NflSeerDataset {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "matchups" in payload &&
    Array.isArray(payload.matchups) &&
    "season" in payload &&
    "weekLabel" in payload
  );
}

function formatKickoff(value: string | null | undefined) {
  if (!value) {
    return "Kickoff TBD";
  }

  const kickoff = new Date(value);

  if (Number.isNaN(kickoff.getTime())) {
    return "Kickoff TBD";
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZone: "America/New_York",
    weekday: "short",
  }).format(kickoff);
}

function matchupPace(home: NflTeamFeed, away: NflTeamFeed) {
  return clampMeter(Math.round(58 + (home.offense + away.offense - 150) * 0.45));
}

function teamStrength(team: NflTeamFeed) {
  return (
    team.offense * 0.26 +
    team.defense * 0.22 +
    team.qb * 0.24 +
    team.trenches * 0.14 +
    team.coaching * 0.1 +
    team.injuries * 0.04
  );
}

function seededRating(seed: string, min: number, max: number) {
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 9973;
  }

  return min + (hash % (max - min + 1));
}

function normalizeCode(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase() || "NFL";
}

function normalizeColor(value: string | null | undefined, fallbackSeed: string) {
  const color = value?.replace(/[^a-f0-9]/gi, "").slice(0, 6);

  if (color?.length === 6) {
    return `#${color}`;
  }

  const hue = seededRating(fallbackSeed, 0, 359);
  return `hsl(${hue} 74% 56%)`;
}

function cleanLine(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function clampProbability(value: number) {
  return Math.max(35, Math.min(65, value));
}

function clampMeter(value: number) {
  return Math.max(0, Math.min(100, value));
}
