import {
  fetchPolymarketPulseForTarget,
  type MarketPulseTarget,
  type PulseSkipReason,
} from "./providers/polymarket";
import {
  applyFantasyProjectionRealism,
  fantasyPlayersFromSourceProjections,
  isNflFantasyPlayer,
  mergeFantasySourceFeeds,
  normalizeFantasyProjectionFeed,
  type FantasyProjectionMatchupContext,
  type FantasySourceProjection,
} from "./nfl-fantasy-import";

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

export type NflMarketPulseFeed = {
  source: "polymarket";
  capturedAt: string | null;
  home: number;
  away: number;
  liquidityScore: number;
  leader: "home" | "away";
  alignment: "aligned" | "split";
  marketSlug: string | null;
  question: string | null;
  nudge: {
    applied: boolean;
    homeDelta: number;
    awayDelta: number;
    cap: number;
    summary: string;
  };
};

export type NflMatchupFeed = {
  id: string;
  week: string;
  slot: string;
  startsAt?: string | null;
  venue: string;
  weather: string;
  home: NflTeamFeed;
  away: NflTeamFeed;
  sourceHomeWin?: number;
  sourceAwayWin?: number;
  homeWin: number;
  awayWin: number;
  projected: string;
  confidence: number;
  chaos: number;
  pace: number;
  read: string;
  edges: string[];
  marketPulse?: NflMarketPulseFeed | null;
};

export type NflSeerProviderStatus = {
  schedule: "live" | "fallback";
  fantasy: "live" | "fallback";
  market: "live" | "fallback";
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
const nflPolymarketEnabled = process.env.NFL_POLYMARKET_ENABLED !== "0";
const nflPolymarketMaxGames = Number(process.env.NFL_POLYMARKET_MAX_GAMES ?? "6");
const nflPolymarketMaxShift = Number(process.env.NFL_POLYMARKET_MAX_SHIFT ?? "4");
const nflPolymarketMaxWeight = Number(process.env.NFL_POLYMARKET_MAX_WEIGHT ?? "0.16");

export async function fetchNflSeerDataset(): Promise<NflSeerDataset> {
  const fetchedAt = new Date().toISOString();
  const notes: string[] = [];
  const scheduleUrl = process.env.NFL_SEER_DATA_URL ?? espnScoreboardUrl;
  const fantasyUrl = process.env.NFL_FANTASY_DATA_URL;
  const fantasyProjectionUrl = process.env.NFL_FANTASY_PROJECTIONS_URL;
  const fantasyRankingUrl = process.env.NFL_FANTASY_RANKINGS_URL;
  const fantasyPlayers = fantasyUrl
    ? await fetchFantasyPlayers(fantasyUrl, notes)
    : [];
  const fantasyProjections = fantasyProjectionUrl
    ? await fetchFantasyProjections(fantasyProjectionUrl, notes)
    : [];
  const fantasyRankings = fantasyRankingUrl
    ? await fetchFantasyRankings(fantasyRankingUrl, notes)
    : [];
  const fantasySignals = mergeFantasySourceFeeds(fantasyProjections, fantasyRankings);

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
    const dataset = applyFantasyProjectionLayer(toNflSeerDataset(payload, {
      fetchedAt,
      fantasyPlayers,
      source: process.env.NFL_SEER_DATA_URL ? "configured-feed" : "espn-scoreboard",
    }), fantasySignals);

    if (dataset.matchups.length === 0) {
      throw new Error("NFL schedule feed returned no usable matchups");
    }

    const marketResult = await applyNflMarketPulses(dataset);

    return {
      ...marketResult.dataset,
      providerStatus: {
        schedule: "live",
          fantasy:
          fantasyPlayers.length > 0 || fantasySignals.length > 0
            ? "live"
            : "fallback",
        market: marketResult.status,
        notes:
          fantasyPlayers.length > 0 || fantasySignals.length > 0
            ? [...notes, ...projectionNotes(fantasySignals), ...marketResult.notes]
            : [
                ...notes,
                "Fantasy board is still using the seeded preseason rail.",
                ...projectionNotes(fantasySignals),
                ...marketResult.notes,
              ],
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
      fantasyPlayers: applyFantasyProjectionLayer(
        {
          source: "seeded-fallback",
          season: new Date().getFullYear().toString(),
          weekLabel: "Seeded lab",
          updatedAt: fetchedAt,
          matchups: [],
          fantasyPlayers,
          providerStatus: {
            schedule: "fallback",
            fantasy: fantasyPlayers.length > 0 ? "live" : "fallback",
            market: "fallback",
            notes: [],
          },
        },
        fantasySignals,
      ).fantasyPlayers,
      providerStatus: {
        schedule: "fallback",
          fantasy:
          fantasyPlayers.length > 0 || fantasySignals.length > 0
            ? "live"
            : "fallback",
        market: "fallback",
        notes: [
          message,
          fantasyPlayers.length > 0 || fantasySignals.length > 0
            ? "Fantasy feed is live."
            : "Fantasy board is still using the seeded preseason rail.",
          ...projectionNotes(fantasySignals),
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
        market: payload.providerStatus?.market ?? "fallback",
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
      market: matchups.some((matchup) => matchup.marketPulse) ? "live" : "fallback",
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
    startsAt: competition?.date ?? event.date ?? null,
    venue: venueName,
    weather,
    home: homeTeam,
    away: awayTeam,
    sourceHomeWin: homeWin,
    sourceAwayWin: awayWin,
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

async function applyNflMarketPulses(dataset: NflSeerDataset): Promise<{
  dataset: NflSeerDataset;
  status: "live" | "fallback";
  notes: string[];
}> {
  if (!nflPolymarketEnabled) {
    return {
      dataset,
      status: "fallback",
      notes: ["Crowd signal is disabled for this environment."],
    };
  }

  const maxGames = Number.isFinite(nflPolymarketMaxGames)
    ? Math.max(0, Math.min(10, Math.floor(nflPolymarketMaxGames)))
    : 6;
  const targets = dataset.matchups.slice(0, maxGames);

  if (targets.length === 0) {
    return { dataset, status: "fallback", notes: [] };
  }

  const skipped: Partial<Record<PulseSkipReason, number>> = {};
  const lookups = await Promise.all(
    targets.map(async (matchup) => {
      try {
        const lookup = await fetchPolymarketPulseForTarget(
          nflMarketTarget(matchup),
          dataset.updatedAt,
        );

        if (!lookup.update) {
          skipped[lookup.reason] = (skipped[lookup.reason] ?? 0) + 1;
        }

        return {
          matchId: matchup.id,
          update: lookup.update,
        };
      } catch {
        skipped["fetch-error"] = (skipped["fetch-error"] ?? 0) + 1;

        return {
          matchId: matchup.id,
          update: null,
        };
      }
    }),
  );
  const updates = new Map(
    lookups
      .filter((lookup) => lookup.update)
      .map((lookup) => [lookup.matchId, lookup.update]),
  );

  if (updates.size === 0) {
    return {
      dataset,
      status: "fallback",
      notes: [`No usable Polymarket NFL crowd signal yet${skipSummary(skipped)}.`],
    };
  }

  return {
    dataset: {
      ...dataset,
      matchups: dataset.matchups.map((matchup) => {
        const update = updates.get(matchup.id);

        return update ? applyNflMarketPulse(matchup, update) : matchup;
      }),
    },
    status: "live",
    notes: [
      `Polymarket crowd signal nudged ${updates.size} game${
        updates.size === 1 ? "" : "s"
      }; each move is capped at ${marketMaxShift()} points.`,
    ],
  };
}

function nflMarketTarget(matchup: NflMatchupFeed): MarketPulseTarget {
  return {
    matchId: matchup.id,
    sport: "football",
    league: "nfl",
    marketShape: "two-way",
    startsAt: matchup.startsAt ?? null,
    home: {
      name: `${matchup.home.city} ${matchup.home.name}`,
      code: matchup.home.code,
      aliases: teamMarketAliases(matchup.home),
    },
    away: {
      name: `${matchup.away.city} ${matchup.away.name}`,
      code: matchup.away.code,
      aliases: teamMarketAliases(matchup.away),
    },
  };
}

function teamMarketAliases(team: NflTeamFeed) {
  return [team.code, team.name, team.city, `${team.city} ${team.name}`];
}

function applyNflMarketPulse(
  matchup: NflMatchupFeed,
  update: NonNullable<
    Awaited<ReturnType<typeof fetchPolymarketPulseForTarget>>["update"]
  >,
): NflMatchupFeed {
  const sourceHomeWin = matchup.sourceHomeWin ?? matchup.homeWin;
  const sourceAwayWin = matchup.sourceAwayWin ?? matchup.awayWin;
  const market = normalizeTwoWayMarket(update.home, update.away);
  const liquidityScore = clampNumber(
    update.liquidityScore ?? liquidityToTrust(update.liquidity, update.volume),
    0,
    1,
  );
  const disagreement = Math.abs(market.home - sourceHomeWin) / 100;
  const conviction = Math.abs(market.home - market.away) / 100;
  const weight = clampNumber(
    liquidityScore * (0.07 + disagreement * 0.16 + conviction * 0.05),
    0,
    marketMaxWeight(),
  );
  const rawDelta = (market.home - sourceHomeWin) * weight;
  const homeDelta = clampRoundedDelta(rawDelta, marketMaxShift());
  const nudgedHomeWin = clampProbability(sourceHomeWin + homeDelta);
  const nudgedAwayWin = 100 - nudgedHomeWin;
  const sourceLeader = sourceHomeWin >= sourceAwayWin ? "home" : "away";
  const marketLeader = market.home >= market.away ? "home" : "away";
  const alignment = sourceLeader === marketLeader ? "aligned" : "split";
  const applied = homeDelta !== 0;

  return {
    ...matchup,
    sourceHomeWin,
    sourceAwayWin,
    homeWin: nudgedHomeWin,
    awayWin: nudgedAwayWin,
    projected: projectedScore({
      away: matchup.away,
      awayWin: nudgedAwayWin,
      home: matchup.home,
      homeWin: nudgedHomeWin,
    }),
    confidence: clampMeter(
      matchup.confidence + (applied && alignment === "aligned" ? 2 : 0),
    ),
    chaos: clampMeter(
      matchup.chaos + (applied && alignment === "split" ? 3 : 0),
    ),
    edges: applied
      ? [...new Set(["Crowd nudge", ...matchup.edges])].slice(0, 3)
      : matchup.edges,
    marketPulse: {
      source: "polymarket",
      capturedAt: update.capturedAt ?? null,
      home: market.home,
      away: market.away,
      liquidityScore: Math.round(liquidityScore * 100) / 100,
      leader: marketLeader,
      alignment,
      marketSlug: update.marketSlug ?? null,
      question: update.question ?? null,
      nudge: {
        applied,
        homeDelta,
        awayDelta: -homeDelta,
        cap: marketMaxShift(),
        summary: applied
          ? `Crowd signal moved the Seer ${formatSigned(homeDelta)} toward ${homeDelta > 0 ? matchup.home.code : matchup.away.code}, capped so the model still owns the read.`
          : "Crowd signal was close to the source model, so the Seer kept the read untouched.",
      },
    },
  };
}

function normalizeTwoWayMarket(home: number, away: number) {
  const rawHome = home <= 1 ? home * 100 : home;
  const rawAway = away <= 1 ? away * 100 : away;
  const total = rawHome + rawAway;

  if (total <= 0) {
    return { home: 50, away: 50 };
  }

  const normalizedHome = Math.round((rawHome / total) * 100);

  return {
    home: normalizedHome,
    away: 100 - normalizedHome,
  };
}

function liquidityToTrust(liquidity: number | null | undefined, volume: number | null | undefined) {
  const signal = Math.max(liquidity ?? 0, volume ?? 0);

  if (signal <= 0) {
    return 0.25;
  }

  return clampNumber(Math.log10(signal + 1) / 5, 0.12, 1);
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

async function fetchFantasyProjections(url: string, notes: string[]) {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`NFL fantasy projections feed failed: ${response.status}`);
    }

    const payload = (await response.json()) as unknown;

    return normalizeFantasyProjectionFeed(payload);
  } catch (error) {
    notes.push(
      error instanceof Error
        ? error.message
        : "NFL fantasy projections feed failed to load.",
    );
  }

  return [];
}

async function fetchFantasyRankings(url: string, notes: string[]) {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`NFL fantasy rankings feed failed: ${response.status}`);
    }

    const payload = (await response.json()) as unknown;

    return normalizeFantasyProjectionFeed(payload);
  } catch (error) {
    notes.push(
      error instanceof Error
        ? error.message
        : "NFL fantasy rankings feed failed to load.",
    );
  }

  return [];
}

function applyFantasyProjectionLayer(
  dataset: NflSeerDataset,
  sourceProjections: FantasySourceProjection[],
): NflSeerDataset {
  const existingPlayers = dataset.fantasyPlayers.filter(isNflFantasyPlayer);
  const projectionPlayers =
    existingPlayers.length > 0
      ? existingPlayers
      : fantasyPlayersFromSourceProjections(sourceProjections);

  if (projectionPlayers.length === 0) {
    return dataset;
  }

  return {
    ...dataset,
    fantasyPlayers: applyFantasyProjectionRealism(
      projectionPlayers,
      sourceProjections,
      {
        matchups: fantasyProjectionContexts(dataset.matchups),
      },
    ),
    providerStatus: {
      ...dataset.providerStatus,
      fantasy:
        projectionPlayers.length > 0 || sourceProjections.length > 0
          ? "live"
          : dataset.providerStatus.fantasy,
    },
  };
}

function fantasyProjectionContexts(
  matchups: NflMatchupFeed[],
): FantasyProjectionMatchupContext[] {
  return matchups.flatMap((matchup) => [
    {
      team: matchup.home.code,
      opponent: `vs ${matchup.away.code}`,
      weather: matchup.weather,
      pace: matchup.pace,
      teamWin: matchup.homeWin,
      opponentWin: matchup.awayWin,
      teamOffense: matchup.home.offense,
      opponentDefense: matchup.away.defense,
      teamHealth: matchup.home.injuries,
      venue: matchup.venue,
    },
    {
      team: matchup.away.code,
      opponent: `at ${matchup.home.code}`,
      weather: matchup.weather,
      pace: matchup.pace,
      teamWin: matchup.awayWin,
      opponentWin: matchup.homeWin,
      teamOffense: matchup.away.offense,
      opponentDefense: matchup.home.defense,
      teamHealth: matchup.away.injuries,
      venue: matchup.venue,
    },
  ]);
}

function projectionNotes(sourceProjections: FantasySourceProjection[]) {
  if (sourceProjections.length === 0) {
    return [];
  }

  const projectionCount = sourceProjections.filter(
    (projection) => typeof projection.projection === "number",
  ).length;
  const rankingCount = sourceProjections.filter(
    (projection) =>
      typeof projection.sourceRank === "number" ||
      typeof projection.positionRank === "number",
  ).length;

  return [
    `Fantasy data spine matched ${projectionCount} projection${
      projectionCount === 1 ? "" : "s"
    } and ${rankingCount} ranking signal${rankingCount === 1 ? "" : "s"} with capped Seer nudges.`,
  ];
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

function skipSummary(skipped: Partial<Record<PulseSkipReason, number>>) {
  const parts = Object.entries(skipped)
    .filter(([, count]) => count > 0)
    .map(([reason, count]) => `${count} ${reason}`);

  return parts.length > 0 ? ` (${parts.join(", ")})` : "";
}

function marketMaxShift() {
  return Number.isFinite(nflPolymarketMaxShift)
    ? Math.max(0, Math.min(8, Math.round(nflPolymarketMaxShift)))
    : 4;
}

function marketMaxWeight() {
  return Number.isFinite(nflPolymarketMaxWeight)
    ? clampNumber(nflPolymarketMaxWeight, 0.02, 0.3)
    : 0.16;
}

function clampRoundedDelta(value: number, cap: number) {
  const rounded = Math.round(value);

  if (rounded === 0 && Math.abs(value) >= 0.45) {
    return value > 0 ? 1 : -1;
  }

  return clampNumber(rounded, -cap, cap);
}

function formatSigned(value: number) {
  return value > 0 ? `+${value}` : `${value}`;
}

function clampProbability(value: number) {
  return Math.max(35, Math.min(65, value));
}

function clampMeter(value: number) {
  return Math.max(0, Math.min(100, value));
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
