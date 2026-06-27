import {
  fetchPolymarketPulseForTarget,
  type MarketPulseTarget,
  type PulseSkipReason,
} from "./providers/polymarket";
import {
  applyFantasyProjectionRealism,
  buildSleeperFantasyLeague,
  fantasyPlayersFromSourceProjections,
  isNflFantasyPlayer,
  mergeFantasyPlayerPools,
  mergeFantasySourceFeeds,
  normalizeFantasyProjectionFeed,
  type FantasyProjectionMatchupContext,
  type FantasySourceProjection,
  type NflFantasyPlayer,
  type SleeperLeague,
  type SleeperMatchup,
  type SleeperPlayer,
  type SleeperRoster,
  type SleeperUser,
} from "./nfl-fantasy-import";
import {
  readNflRuntimeSettings,
  type NflRuntimeSettings,
} from "./nfl-admin-settings";

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
  fantasyProviders?: NflFantasyProviderStatus[];
  fantasyCoverage?: NflFantasyCoverageStatus;
};

export type FantasyProviderStatusValue = "live" | "fallback" | "missing" | "error";

export type FantasyProviderFreshness = "fresh" | "stale" | "unknown";

export type FantasyProviderKind = "sleeper" | "players" | "projections" | "rankings";

export type FantasyPosition = "QB" | "RB" | "WR" | "TE" | "K" | "DST";

export type FantasyPositionCounts = Record<FantasyPosition, number>;

export type NflFantasyProviderStatus = {
  id: string;
  label: string;
  kind: FantasyProviderKind;
  status: FantasyProviderStatusValue;
  source: string | null;
  count: number;
  updatedAt: string | null;
  freshness: FantasyProviderFreshness;
  positions: FantasyPositionCounts;
  message: string;
};

export type NflFantasyCoverageStatus = {
  totalPlayers: number;
  totalProjections: number;
  totalRankings: number;
  positions: Record<
    FantasyPosition,
    {
      players: number;
      projections: number;
      rankings: number;
      total: number;
    }
  >;
  missingPositions: FantasyPosition[];
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
const sleeperApiBase = "https://api.sleeper.app/v1";
const fantasyFreshHours = Number(process.env.NFL_FANTASY_FRESH_HOURS ?? "24");
const fantasyStaleHours = Number(process.env.NFL_FANTASY_STALE_HOURS ?? "72");
const fantasyPositions = ["QB", "RB", "WR", "TE", "K", "DST"] as const;

export async function fetchNflSeerDataset(): Promise<NflSeerDataset> {
  const fetchedAt = new Date().toISOString();
  const notes: string[] = [];
  const runtimeSettings = await readNflRuntimeSettings();
  const scheduleUrl = runtimeSettings.nflSeerDataUrl || espnScoreboardUrl;
  const fantasyAdapters = await loadFantasyProviderAdapters(
    fetchedAt,
    notes,
    runtimeSettings,
  );
  const fantasyPlayers = fantasyAdapters.players;
  const fantasySignals = fantasyAdapters.signals;

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
    const dataset = applyFantasyProjectionLayer(
      toNflSeerDataset(payload, {
        fetchedAt,
        fantasyPlayers,
        source: runtimeSettings.nflSeerDataUrl
          ? "configured-feed"
          : "espn-scoreboard",
      }),
      fantasySignals,
    );

    if (dataset.matchups.length === 0) {
      throw new Error("NFL schedule feed returned no usable matchups");
    }

    const marketResult = await applyNflMarketPulses(dataset, runtimeSettings);

    return {
      ...marketResult.dataset,
      providerStatus: {
        schedule: "live",
        fantasy:
          fantasyPlayers.length > 0 || fantasySignals.length > 0
            ? "live"
            : "fallback",
        market: marketResult.status,
        fantasyProviders: fantasyAdapters.providers,
        fantasyCoverage: fantasyAdapters.coverage,
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
            fantasyProviders: fantasyAdapters.providers,
            fantasyCoverage: fantasyAdapters.coverage,
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
        fantasyProviders: fantasyAdapters.providers,
        fantasyCoverage: fantasyAdapters.coverage,
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
        fantasyProviders: payload.providerStatus?.fantasyProviders,
        fantasyCoverage: payload.providerStatus?.fantasyCoverage,
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

async function applyNflMarketPulses(
  dataset: NflSeerDataset,
  settings: NflRuntimeSettings,
): Promise<{
  dataset: NflSeerDataset;
  status: "live" | "fallback";
  notes: string[];
}> {
  if (!settings.polymarketEnabled) {
    return {
      dataset,
      status: "fallback",
      notes: ["Crowd signal is disabled for this environment."],
    };
  }

  const maxGames = marketMaxGames(settings);
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

        return update ? applyNflMarketPulse(matchup, update, settings) : matchup;
      }),
    },
    status: "live",
    notes: [
      `Polymarket crowd signal nudged ${updates.size} game${
        updates.size === 1 ? "" : "s"
      }; each move is capped at ${marketMaxShift(settings)} points.`,
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
  settings: NflRuntimeSettings,
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
    marketMaxWeight(settings),
  );
  const rawDelta = (market.home - sourceHomeWin) * weight;
  const homeDelta = clampRoundedDelta(rawDelta, marketMaxShift(settings));
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
        cap: marketMaxShift(settings),
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

async function loadFantasyProviderAdapters(
  fetchedAt: string,
  notes: string[],
  settings: NflRuntimeSettings,
) {
  const [sleeper, players, projections, rankings] = await Promise.all([
    loadSleeperRosterAdapter(fetchedAt, notes, settings),
    loadFantasyPlayersAdapter({
      fetchedAt,
      label: "Player feed",
      notes,
      source: settings.fantasyDataUrl,
    }),
    loadFantasySignalAdapter({
      fetchedAt,
      id: "projections",
      kind: "projections",
      label: "Projection feed",
      missingMessage: "Set NFL_FANTASY_PROJECTIONS_URL for source point receipts.",
      notes,
      source: settings.fantasyProjectionsUrl,
    }),
    loadFantasySignalAdapter({
      fetchedAt,
      id: "rankings",
      kind: "rankings",
      label: "Rankings / ECR / ADP",
      missingMessage: "Set NFL_FANTASY_RANKINGS_URL for rankings, ECR, or ADP.",
      notes,
      source: settings.fantasyRankingsUrl,
    }),
  ]);
  const providerPlayers = mergeFantasyPlayerPools(
    players.players.filter(isNflFantasyPlayer),
    sleeper.players,
  );
  const signals = mergeFantasySourceFeeds(projections.signals, rankings.signals);
  const providers = [
    sleeper.provider,
    players.provider,
    projections.provider,
    rankings.provider,
  ];

  return {
    coverage: fantasyCoverage(providerPlayers, signals),
    players: providerPlayers,
    providers,
    signals,
  };
}

async function loadFantasyPlayersAdapter({
  fetchedAt,
  label,
  notes,
  source,
}: {
  fetchedAt: string;
  label: string;
  notes: string[];
  source: string;
}): Promise<{
  players: unknown[];
  provider: NflFantasyProviderStatus;
}> {
  if (!source) {
    return {
      players: [],
      provider: missingProvider({
        id: "players",
        kind: "players",
        label,
        message: "Set NFL_FANTASY_DATA_URL for a canonical fantasy player feed.",
      }),
    };
  }

  try {
    const { payload, updatedAt } = await fetchJsonPayload(source, fetchedAt);
    const players = fantasyPlayersFromPayload(payload);

    return {
      players,
      provider: providerStatus({
        count: players.length,
        fetchedAt,
        id: "players",
        kind: "players",
        label,
        message:
          players.length > 0
            ? `Loaded ${players.length} canonical fantasy player${players.length === 1 ? "" : "s"}.`
            : "Fantasy player feed loaded but did not include usable players.",
        positions: positionCountsForPlayers(players),
        source,
        status: players.length > 0 ? "live" : "fallback",
        updatedAt,
      }),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "NFL fantasy player feed failed.";
    notes.push(message);

    return {
      players: [],
      provider: providerStatus({
        count: 0,
        fetchedAt,
        id: "players",
        kind: "players",
        label,
        message,
        positions: emptyPositionCounts(),
        source,
        status: "error",
        updatedAt: null,
      }),
    };
  }
}

async function loadFantasySignalAdapter({
  fetchedAt,
  id,
  kind,
  label,
  missingMessage,
  notes,
  source,
}: {
  fetchedAt: string;
  id: string;
  kind: Extract<FantasyProviderKind, "projections" | "rankings">;
  label: string;
  missingMessage: string;
  notes: string[];
  source: string;
}): Promise<{
  signals: FantasySourceProjection[];
  provider: NflFantasyProviderStatus;
}> {
  if (!source) {
    return {
      provider: missingProvider({ id, kind, label, message: missingMessage }),
      signals: [],
    };
  }

  try {
    const { payload, updatedAt } = await fetchJsonPayload(source, fetchedAt);
    const signals = normalizeFantasyProjectionFeed(payload);

    return {
      provider: providerStatus({
        count: signals.length,
        fetchedAt,
        id,
        kind,
        label,
        message:
          signals.length > 0
            ? `Normalized ${signals.length} ${kind === "rankings" ? "ranking" : "projection"} row${signals.length === 1 ? "" : "s"}.`
            : `${label} loaded but had no usable fantasy rows.`,
        positions: positionCountsForSignals(signals),
        source,
        status: signals.length > 0 ? "live" : "fallback",
        updatedAt,
      }),
      signals,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : `${label} failed to load.`;
    notes.push(message);

    return {
      provider: providerStatus({
        count: 0,
        fetchedAt,
        id,
        kind,
        label,
        message,
        positions: emptyPositionCounts(),
        source,
        status: "error",
        updatedAt: null,
      }),
      signals: [],
    };
  }
}

async function loadSleeperRosterAdapter(
  fetchedAt: string,
  notes: string[],
  settings: NflRuntimeSettings,
): Promise<{
  players: NflFantasyPlayer[];
  provider: NflFantasyProviderStatus;
}> {
  const leagueId = settings.sleeperLeagueId.trim();

  if (!leagueId) {
    return {
      players: [],
      provider: missingProvider({
        id: "sleeper",
        kind: "sleeper",
        label: "Sleeper rosters",
        message: "Set NFL_SLEEPER_LEAGUE_ID to sync a public Sleeper league.",
      }),
    };
  }

  try {
    const week = await sleeperWeek(settings);
    const [league, rosters, users, players, matchups] = await Promise.all([
      sleeperJson<SleeperLeague>(`/league/${encodeURIComponent(leagueId)}`, {
        cache: "no-store",
      }),
      sleeperJson<SleeperRoster[]>(`/league/${encodeURIComponent(leagueId)}/rosters`, {
        cache: "no-store",
      }),
      sleeperJson<SleeperUser[]>(`/league/${encodeURIComponent(leagueId)}/users`, {
        cache: "no-store",
      }),
      sleeperJson<Record<string, SleeperPlayer>>("/players/nfl", {
        next: { revalidate: 86400 },
      }),
      week
        ? sleeperJson<SleeperMatchup[]>(
            `/league/${encodeURIComponent(leagueId)}/matchups/${week}`,
            { cache: "no-store" },
          ).catch(() => [])
        : Promise.resolve([] as SleeperMatchup[]),
    ]);
    const leagueImport = buildSleeperFantasyLeague({
      league,
      matchups,
      players,
      rosters,
      users,
      week,
    });

    return {
      players: leagueImport.players,
      provider: providerStatus({
        count: leagueImport.players.length,
        fetchedAt,
        id: "sleeper",
        kind: "sleeper",
        label: "Sleeper rosters",
        message:
          leagueImport.players.length > 0
            ? `Synced ${leagueImport.teams.length} team${leagueImport.teams.length === 1 ? "" : "s"} from ${leagueImport.label}.`
            : "Sleeper league loaded but no roster players were usable.",
        positions: positionCountsForPlayers(leagueImport.players),
        source: `sleeper:${leagueId}`,
        status: leagueImport.players.length > 0 ? "live" : "fallback",
        updatedAt: fetchedAt,
      }),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Sleeper roster sync failed.";
    notes.push(message);

    return {
      players: [],
      provider: providerStatus({
        count: 0,
        fetchedAt,
        id: "sleeper",
        kind: "sleeper",
        label: "Sleeper rosters",
        message,
        positions: emptyPositionCounts(),
        source: `sleeper:${leagueId}`,
        status: "error",
        updatedAt: null,
      }),
    };
  }
}

async function fetchJsonPayload(source: string, fetchedAt: string) {
  const response = await fetch(source, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Fantasy provider failed: ${response.status}`);
  }

  const payload = (await response.json()) as unknown;

  return {
    payload,
    updatedAt: payloadUpdatedAt(payload, response, fetchedAt),
  };
}

async function sleeperWeek(settings: NflRuntimeSettings) {
  if (settings.sleeperWeek !== null) {
    return settings.sleeperWeek;
  }

  const state = await sleeperJson<{
    display_week?: string | number | null;
    week?: string | number | null;
  }>("/state/nfl", { cache: "no-store" }).catch(() => null);

  return (
    numberFromValue(state?.display_week) ??
    numberFromValue(state?.week) ??
    undefined
  );
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

function fantasyPlayersFromPayload(payload: unknown) {
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

  return [];
}

function providerStatus({
  count,
  fetchedAt,
  id,
  kind,
  label,
  message,
  positions,
  source,
  status,
  updatedAt,
}: {
  count: number;
  fetchedAt: string;
  id: string;
  kind: FantasyProviderKind;
  label: string;
  message: string;
  positions: FantasyPositionCounts;
  source: string | null;
  status: FantasyProviderStatusValue;
  updatedAt: string | null;
}): NflFantasyProviderStatus {
  return {
    count,
    freshness: freshnessStatus(updatedAt, fetchedAt),
    id,
    kind,
    label,
    message,
    positions,
    source,
    status,
    updatedAt,
  };
}

function missingProvider({
  id,
  kind,
  label,
  message,
}: {
  id: string;
  kind: FantasyProviderKind;
  label: string;
  message: string;
}): NflFantasyProviderStatus {
  return {
    count: 0,
    freshness: "unknown",
    id,
    kind,
    label,
    message,
    positions: emptyPositionCounts(),
    source: null,
    status: "missing",
    updatedAt: null,
  };
}

function fantasyCoverage(
  players: unknown[],
  signals: FantasySourceProjection[],
): NflFantasyCoverageStatus {
  const positions = fantasyPositions.reduce<NflFantasyCoverageStatus["positions"]>(
    (coverage, position) => {
      coverage[position] = {
        players: 0,
        projections: 0,
        rankings: 0,
        total: 0,
      };
      return coverage;
    },
    {} as NflFantasyCoverageStatus["positions"],
  );

  players.filter(isNflFantasyPlayer).forEach((player) => {
    const position = normalizeFantasyPosition(player.position);
    positions[position].players += 1;
  });

  signals.forEach((signal) => {
    const position = normalizeFantasyPosition(signal.position);

    if (typeof signal.projection === "number") {
      positions[position].projections += 1;
    }

    if (
      typeof signal.sourceRank === "number" ||
      typeof signal.positionRank === "number"
    ) {
      positions[position].rankings += 1;
    }
  });

  fantasyPositions.forEach((position) => {
    const row = positions[position];
    row.total = row.players + row.projections + row.rankings;
  });

  return {
    missingPositions: fantasyPositions.filter(
      (position) => positions[position].total === 0,
    ),
    positions,
    totalPlayers: players.filter(isNflFantasyPlayer).length,
    totalProjections: signals.filter(
      (signal) => typeof signal.projection === "number",
    ).length,
    totalRankings: signals.filter(
      (signal) =>
        typeof signal.sourceRank === "number" ||
        typeof signal.positionRank === "number",
    ).length,
  };
}

function positionCountsForPlayers(players: unknown[]) {
  const counts = emptyPositionCounts();

  players.filter(isNflFantasyPlayer).forEach((player) => {
    counts[normalizeFantasyPosition(player.position)] += 1;
  });

  return counts;
}

function positionCountsForSignals(signals: FantasySourceProjection[]) {
  const counts = emptyPositionCounts();

  signals.forEach((signal) => {
    counts[normalizeFantasyPosition(signal.position)] += 1;
  });

  return counts;
}

function emptyPositionCounts(): FantasyPositionCounts {
  return {
    DST: 0,
    K: 0,
    QB: 0,
    RB: 0,
    TE: 0,
    WR: 0,
  };
}

function normalizeFantasyPosition(value: unknown): FantasyPosition {
  const position = typeof value === "string" ? value.toUpperCase() : "";

  if (position === "DEF" || position === "D") {
    return "DST";
  }

  if (
    position === "QB" ||
    position === "RB" ||
    position === "WR" ||
    position === "TE" ||
    position === "K" ||
    position === "DST"
  ) {
    return position;
  }

  return "WR";
}

function payloadUpdatedAt(
  payload: unknown,
  response: Response,
  fetchedAt: string,
) {
  const payloadDate =
    typeof payload === "object" && payload !== null
      ? dateStringFromRecord(payload as Record<string, unknown>)
      : "";
  const headerDate = response.headers.get("last-modified") ?? response.headers.get("date");

  return validDateString(payloadDate) ?? validDateString(headerDate) ?? fetchedAt;
}

function dateStringFromRecord(record: Record<string, unknown>) {
  for (const key of ["updatedAt", "lastUpdated", "generatedAt", "asOf", "timestamp"]) {
    const value = record[key];

    if (typeof value === "string" || typeof value === "number") {
      return String(value);
    }
  }

  return "";
}

function validDateString(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function freshnessStatus(
  updatedAt: string | null,
  fetchedAt: string,
): FantasyProviderFreshness {
  if (!updatedAt) {
    return "unknown";
  }

  const updated = new Date(updatedAt).getTime();
  const fetched = new Date(fetchedAt).getTime();

  if (Number.isNaN(updated) || Number.isNaN(fetched)) {
    return "unknown";
  }

  const ageHours = Math.max(0, (fetched - updated) / 36e5);
  const freshHours = Number.isFinite(fantasyFreshHours)
    ? Math.max(1, fantasyFreshHours)
    : 24;
  const staleHours = Number.isFinite(fantasyStaleHours)
    ? Math.max(freshHours, fantasyStaleHours)
    : freshHours;

  return ageHours <= staleHours ? "fresh" : "stale";
}

function numberFromValue(value: unknown) {
  const numberValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;

  return Number.isFinite(numberValue) ? numberValue : null;
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

function marketMaxGames(settings: NflRuntimeSettings) {
  return Number.isFinite(settings.polymarketMaxGames)
    ? Math.max(0, Math.min(10, Math.floor(settings.polymarketMaxGames)))
    : 6;
}

function marketMaxShift(settings: NflRuntimeSettings) {
  return Number.isFinite(settings.polymarketMaxShift)
    ? Math.max(0, Math.min(8, Math.round(settings.polymarketMaxShift)))
    : 4;
}

function marketMaxWeight(settings: NflRuntimeSettings) {
  return Number.isFinite(settings.polymarketMaxWeight)
    ? clampNumber(settings.polymarketMaxWeight, 0.02, 0.3)
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
