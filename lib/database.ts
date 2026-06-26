import { createHash } from "crypto";
import type {
  ForecastInterpretation,
  GoalModelForecast,
  KnockoutForecast,
  Language,
  MarketPulse,
  MatchForecast,
  MatchStatus,
  MatchSummary,
  TrailSignal,
} from "./domain";
import type {
  FootballDataSnapshot,
  FootballDataTeam,
} from "./providers/football-data";
import { fetchCurrentVenueWeather } from "./providers/open-meteo";
import { worldCupVenues } from "./providers/world-cup-venues";
import { keyPlayerWatchlist } from "./data/key-players";
import { publishedProjectedScoreCorrections } from "./data/score-corrections";
import { teamRatingProfiles } from "./data/team-ratings";
import {
  DEFAULT_WORLD_STANDING,
  WORLD_STANDING_BY_CODE,
  WORLD_STANDING_BY_NAME,
} from "./data/world-standings";
import {
  tournamentFloorProfilesByCode,
  tournamentFloorProfilesByName,
} from "./data/tournament-floors";
import {
  DEFAULT_TEAM_DEPENDENCY,
  teamDependencyProfiles,
} from "./data/team-dependency";
import {
  buildCupCandidates,
  toCupSnapshotCandidates,
  type CupSnapshotCandidate,
} from "./cup-seer";
import {
  CALIBRATION_TUNING_VERSION,
  DEFAULT_CALIBRATION_TUNING_KNOBS,
  computeCalibration,
  type AppliedCalibrationTuning,
  type CalibrationSample,
  type ForecastOutcome,
} from "./calibration";
import { isKnockoutPhase, normalizeMatchPhase } from "./match-stage";

const ENABLE_PLAYER_SPARKS = false;

export type DataSourceStatus = "database" | "database-unavailable";
export type DataSourceReason =
  | "database"
  | "missing-database-url"
  | "missing-neon-driver"
  | "empty-database-result"
  | "database-query-failed";

type MatchListResult = {
  source: DataSourceStatus;
  reason: DataSourceReason;
  matches: MatchSummary[];
};

type MatchListOptions = {
  limit?: number | null;
  prioritizeUpcoming?: boolean;
};

export type RealDataSyncResult = {
  source: "football-data";
  competition: string;
  season: string;
  teams: number;
  matches: number;
  placeholderMatches: number;
  venuesMapped: number;
  forecasts: number;
  fetchedAt: string;
};

export type WeatherSyncResult = {
  source: "open-meteo";
  venuesSeeded: number;
  venuesWithMatches: number;
  matchesUpdated: number;
  fetchedAt: string;
  skippedReason?: string;
};

export type CupSeerSnapshot = {
  id: string;
  label: string;
  generatedAt: string;
  candidates: Array<
    CupSnapshotCandidate & {
      previousRank: number | null;
      rankDelta: number | null;
    }
  >;
};

export type CupSeerSnapshotDashboard = {
  source: DataSourceStatus;
  reason: DataSourceReason;
  generatedAt: string;
  current: CupSeerSnapshot | null;
  previous: CupSeerSnapshot | null;
  history: CupSeerSnapshot[];
  error?: string;
};

export type MarketPulseUpdate = {
  matchId: string;
  source?: "polymarket" | "manual";
  home: number;
  draw: number;
  away: number;
  liquidityScore?: number | null;
  liquidity?: number | null;
  volume?: number | null;
  capturedAt?: string | null;
  marketId?: string | null;
  marketSlug?: string | null;
  question?: string | null;
};

export type MarketPulseSyncResult = {
  source: "polymarket" | "manual";
  updatesReceived: number;
  pulsesSaved: number;
  skipped: number;
  manualProtected?: number;
  skippedMatchIds?: string[];
  fetchedAt: string;
};

type ProbabilityTriplet = {
  home: number;
  draw: number;
  away: number;
};

type ForecastLiveState = {
  status?: "scheduled" | "live" | "final" | string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  minute?: number | string | null;
  homeRedCards?: number | null;
  awayRedCards?: number | null;
};

const probabilitySides = ["home", "draw", "away"] as const;

type ForecastMovementTrailItem = {
  id: string;
  label: string;
  tone: TrailSignal["tone"];
  publicText: Record<Language, string>;
  adminText: string;
  delta?: Record<string, unknown>;
};

export type VenueOverride = {
  matchId: string;
  venueSlug: string;
};

export type VenueOverrideResult = {
  overridesReceived: number;
  venuesSeeded: number;
  matchesUpdated: number;
  invalidVenues: VenueOverride[];
  missingMatches: VenueOverride[];
  fetchedAt: string;
};

export type TrafficEventInput = {
  path?: unknown;
  referrer?: unknown;
  language?: unknown;
  matchId?: unknown;
  visitorId?: unknown;
  timezone?: unknown;
  viewport?: {
    width?: unknown;
    height?: unknown;
  } | null;
  userAgent?: string | null;
  requestHost?: string | null;
  geo?: {
    country?: unknown;
    region?: unknown;
    city?: unknown;
  } | null;
};

export type TrafficRecordResult = {
  recorded: boolean;
  reason: "recorded" | DataSourceReason;
};

export type TrafficDashboard = {
  source: DataSourceStatus;
  reason: DataSourceReason;
  generatedAt: string;
  windows: {
    last24h: {
      views: number;
      visitors: number;
    };
    last7d: {
      views: number;
      visitors: number;
    };
  };
  topPaths: Array<{
    path: string;
    views: number;
    visitors: number;
  }>;
  topReferrers: Array<{
    referrer: string;
    views: number;
  }>;
  devices: Array<{
    device: string;
    views: number;
  }>;
  topLocations: Array<{
    label: string;
    country: string | null;
    region: string | null;
    city: string | null;
    views: number;
    visitors: number;
  }>;
  timeline: Array<{
    bucket: string;
    views: number;
    visitors: number;
  }>;
  recent: Array<{
    occurredAt: string;
    path: string;
    referrer: string;
    device: string;
    language: string | null;
    matchId: string | null;
    location: string;
  }>;
  revenue: TrafficRevenueEstimate;
};

export type TrafficRevenueEstimate = {
  currency: "USD";
  formula: string;
  assumptions: {
    adSlotsPerPage: number;
    fillRate: number;
    viewability: number;
    ecpms: {
      low: number;
      base: number;
      high: number;
    };
  };
  windows: {
    last24h: TrafficRevenueWindow;
    last7d: TrafficRevenueWindow;
    projected30d: TrafficRevenueWindow;
  };
};

type TrafficRevenueWindow = {
  views: number;
  estimatedImpressions: number;
  low: number;
  base: number;
  high: number;
};

export type VenueMappingCandidate = {
  matchId: string;
  home: string;
  away: string;
  group: string;
  status: string;
  startsAt: string | null;
  currentVenue: {
    slug: string;
    name: string;
    city: string;
  };
  lastPulse: { capturedAt: string; source: string | null } | null;
};

export type PlayerAvailabilityUpdate = {
  slug: string;
  availabilityStatus: string;
  availabilityNote?: string | null;
  yellowCards?: number;
  redCards?: number;
  isSuspended?: boolean;
  lineupStatus?: string | null;
  minutesRecent?: number;
};

export type PlayerAvailabilityUpdateResult = {
  updatesReceived: number;
  playersUpdated: number;
  skippedPlayers: PlayerAvailabilityUpdate[];
  fetchedAt: string;
};

export type ModelControlPlayer = {
  slug: string;
  name: string;
  team: string;
  teamCode: string;
  role: string;
  spark: number;
  importance: number;
  availabilityStatus: string;
  availabilityNote: string | null;
  yellowCards: number;
  redCards: number;
  isSuspended: boolean;
  lineupStatus: string;
  lineupConfirmedAt: string | null;
  age: number | null;
  minutesRecent: number;
};

export type ModelControlForecastVersion = {
  matchId: string;
  group: string;
  status: string;
  startsAt: string | null;
  home: string;
  homeCode: string;
  away: string;
  awayCode: string;
  version: number;
  createdAt: string | null;
  homeWin: number;
  draw: number;
  awayWin: number;
  projected: string;
  confidence: number;
  chaos: number;
  modelVersion: string;
  forecastStatus: string;
  supersedesVersion: number | null;
  previousProjected: string | null;
  movementSummary: string | null;
  calibrationTuningVersion: string | null;
  calibrationTuningApplied: boolean;
  calibrationTuningReadiness: string | null;
};

export type ModelControlDashboard = {
  source: DataSourceStatus;
  reason: DataSourceReason;
  generatedAt: string;
  players: ModelControlPlayer[];
  forecasts: ModelControlForecastVersion[];
};

type NeonQuery = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<Record<string, unknown>[]>;

type NeonModule = {
  neon: (connectionString: string) => NeonQuery;
};

type TrafficSummaryRow = {
  views_24h: string | number | null;
  visitors_24h: string | number | null;
  views_7d: string | number | null;
  visitors_7d: string | number | null;
};

type TrafficPathRow = {
  path: string;
  views: string | number;
  visitors: string | number;
};

type TrafficReferrerRow = {
  referrer: string;
  views: string | number;
};

type TrafficDeviceRow = {
  device: string;
  views: string | number;
};

type TrafficLocationRow = {
  country: string | null;
  region: string | null;
  city: string | null;
  views: string | number;
  visitors: string | number;
};

type TrafficTimelineRow = {
  bucket: Date | string;
  views: string | number;
  visitors: string | number;
};

type TrafficRecentRow = {
  occurred_at: Date | string;
  path: string;
  referrer: string;
  device: string;
  language: string | null;
  match_id: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
};

type DatabaseMatchRow = {
  id: string;
  status: string;
  starts_at: Date | string | null;
  stage: string | null;
  group_name: string | null;
  home_score: number | null;
  away_score: number | null;
  venue_name: string;
  venue_city: string;
  home_name: string;
  home_code: string;
  home_color: string;
  home_record: string | null;
  home_form: string[] | null;
  home_attack: number | null;
  home_control: number | null;
  home_defense: number | null;
  home_set_pieces: number | null;
  away_name: string;
  away_code: string;
  away_color: string;
  away_record: string | null;
  away_form: string[] | null;
  away_attack: number | null;
  away_control: number | null;
  away_defense: number | null;
  away_set_pieces: number | null;
  referee_name: string | null;
  cards_per_match: string | number | null;
  temperature_c: string | number | null;
  wind_kph: string | number | null;
  weather_summary: string | null;
  home_win_probability: string | number | null;
  draw_probability: string | number | null;
  away_win_probability: string | number | null;
  forecast_version: string | number | null;
  forecast_created_at: Date | string | null;
  projected_score: string | null;
  confidence: number | null;
  chaos: number | null;
  source_payload: Record<string, unknown> | string | null;
  market_pulse_payload: Record<string, unknown> | string | null;
  tone: Record<Language, string> | null;
  factors: string[] | null;
  players: Array<{
    name: string;
    team: string;
    role: string;
    club: string | null;
    league: string | null;
    spark: number | null;
    note: string | null;
  }> | null;
};

type ExistingForecastLockRow = {
  forecast_id: string;
  version: number | string;
  status: string | null;
  home_score: number | null;
  away_score: number | null;
  home_win_probability: string | number | null;
  draw_probability: string | number | null;
  away_win_probability: string | number | null;
  projected_score: string | null;
  confidence: number | null;
  chaos: number | null;
  source_payload: Record<string, unknown> | string | null;
};

type CalibrationForecastRow = {
  home_score: number | null;
  away_score: number | null;
  home_win_probability: string | number | null;
  draw_probability: string | number | null;
  away_win_probability: string | number | null;
  confidence: number | null;
  chaos: number | null;
  source_payload: Record<string, unknown> | string | null;
};

type ForecastContextRow = {
  external_id: string | null;
  starts_at: Date | string | null;
  venue_slug: string | null;
  venue_city: string | null;
  venue_country: string | null;
  venue_latitude: string | number | null;
  venue_longitude: string | number | null;
  referee_name: string | null;
  cards_per_match: string | number | null;
  temperature_c: string | number | null;
  wind_kph: string | number | null;
  humidity: string | number | null;
  weather_summary: string | null;
  home_rest_hours: string | number | null;
  away_rest_hours: string | number | null;
  home_tournament_matches: string | number | null;
  home_tournament_points: string | number | null;
  home_tournament_goal_diff: string | number | null;
  away_tournament_matches: string | number | null;
  away_tournament_points: string | number | null;
  away_tournament_goal_diff: string | number | null;
  home_previous_match: Record<string, unknown> | null;
  away_previous_match: Record<string, unknown> | null;
  player_availability: ForecastPlayerContext[] | null;
};

export type ForecastPlayerContext = {
  teamSide: "home" | "away";
  teamCode: string;
  teamName: string;
  name: string;
  role: string;
  spark: string | number | null;
  importance: string | number | null;
  availabilityStatus: string | null;
  availabilityNote: string | null;
  yellowCards: string | number | null;
  redCards: string | number | null;
  isSuspended: boolean | null;
  lineupStatus: string | null;
  lineupConfirmedAt: string | null;
  age: string | number | null;
  minutesRecent: string | number | null;
};

type WeatherVenueRow = {
  match_id: string;
  venue_slug: string;
  latitude: string | number;
  longitude: string | number;
};

type VenueMappingCandidateRow = {
  match_id: string;
  home_name: string;
  away_name: string;
  stage: string | null;
  group_name: string | null;
  status: string;
  starts_at: Date | string | null;
  venue_slug: string;
  venue_name: string;
  venue_city: string;
  pulse_captured_at: string | null;
  pulse_source: string | null;
};

type ModelControlPlayerRow = {
  slug: string;
  name: string;
  team_name: string;
  team_code: string;
  role: string | null;
  spark_rating: string | number | null;
  importance: string | number | null;
  availability_status: string | null;
  availability_note: string | null;
  yellow_cards: string | number | null;
  red_cards: string | number | null;
  is_suspended: boolean | null;
  lineup_status: string | null;
  lineup_confirmed_at: Date | string | null;
  age: string | number | null;
  minutes_recent: string | number | null;
};

type ModelControlForecastRow = {
  match_id: string;
  stage: string | null;
  group_name: string | null;
  status: string;
  starts_at: Date | string | null;
  home_name: string;
  home_code: string;
  away_name: string;
  away_code: string;
  version: string | number | null;
  created_at: Date | string | null;
  home_win_probability: string | number | null;
  draw_probability: string | number | null;
  away_win_probability: string | number | null;
  projected_score: string | null;
  confidence: string | number | null;
  chaos: string | number | null;
  source_payload: Record<string, unknown> | string | null;
};

export type TeamRatings = {
  attack: number;
  control: number;
  defense: number;
  setPieces: number;
};

const fallbackNote =
  "Live match data is unavailable. The public page will use its featured readout fallback until the feed returns.";

async function loadNeon() {
  try {
    return {
      module: (await import("@neondatabase/serverless")) as unknown as NeonModule,
      error: null,
    };
  } catch (error) {
    return {
      module: null,
      error: error instanceof Error ? error.message : "Unknown driver error",
    };
  }
}

async function getSql() {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  const neonModule = await loadNeon();

  if (!neonModule.module) {
    return {
      sql: null,
      reason: "missing-neon-driver" as const,
      detail: neonModule.error,
    };
  }

  return {
    sql: neonModule.module.neon(process.env.DATABASE_URL),
    reason: "database" as const,
    detail: null,
  };
}

export async function listMatches(
  options: MatchListOptions = {},
): Promise<MatchListResult> {
  const connection = await getSql();

  if (!connection) {
    return unavailableResult("missing-database-url");
  }

  if (connection.sql) {
    try {
      const rows = await fetchMatchRows(connection.sql, options);
      const matches = dedupeMatches(filterDemoRows(rows.map(toMatchSummary)));

      if (matches.length > 0) {
        return {
          source: "database" satisfies DataSourceStatus,
          reason: "database",
          matches,
        };
      }

      return unavailableResult("empty-database-result");
    } catch (error) {
      console.error("MatchSeer database read failed", error);
      return unavailableResult("database-query-failed");
    }
  }

  return unavailableResult(connection.reason);
}

function filterDemoRows(matches: MatchSummary[]) {
  const demoIds = new Set(["mx-rsa", "br-jp", "ca-ma"]);

  return matches.filter((match) => !demoIds.has(match.id));
}

function dedupeMatches(matches: MatchSummary[]) {
  const preferredByFixture = new Map<string, MatchSummary>();

  for (const match of matches) {
    const key = [
      normalizeFixtureName(match.home.name),
      normalizeFixtureName(match.away.name),
      normalizeFixtureName(match.group),
    ]
      .sort()
      .join("|");
    const current = preferredByFixture.get(key);

    if (!current || matchQualityScore(match) >= matchQualityScore(current)) {
      preferredByFixture.set(key, match);
    }
  }

  return Array.from(preferredByFixture.values());
}

function normalizeFixtureName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function matchQualityScore(match: MatchSummary) {
  return [
    match.id.startsWith("fd-") ? 8 : 0,
    match.startsAt ? 4 : 0,
    match.venue.toLowerCase().includes("tbd") ? 0 : 2,
    match.players.length > 0 ? 1 : 0,
  ].reduce((total, value) => total + value, 0);
}

type CupSeerSnapshotRow = {
  id: string;
  label: string;
  generated_at: Date | string;
  candidates: unknown;
};

export async function listCupSeerSnapshots(): Promise<CupSeerSnapshotDashboard> {
  const connection = await getSql();

  if (!connection) {
    return unavailableCupSeerSnapshotResult("missing-database-url");
  }

  if (!connection.sql) {
    return unavailableCupSeerSnapshotResult(connection.reason);
  }

  try {
    await ensureCupSeerSnapshotSchema(connection.sql);

    const rows = (await connection.sql`
      select id, label, generated_at, candidates
      from cup_seer_snapshots
      order by generated_at desc
      limit 8;
    `) as unknown as CupSeerSnapshotRow[];

    const rawSnapshots = rows.map(toCupSeerSnapshotBase);
    const snapshots = rawSnapshots.map((snapshot, index) =>
      withCupSeerMovement(snapshot, rawSnapshots[index + 1] ?? null),
    );

    return {
      source: "database",
      reason: "database",
      generatedAt: new Date().toISOString(),
      current: snapshots[0] ?? null,
      previous: snapshots[1] ?? null,
      history: snapshots,
    };
  } catch (error) {
    console.error("MatchSeer cup snapshot read failed", error);
    return {
      ...unavailableCupSeerSnapshotResult("database-query-failed"),
      error: error instanceof Error ? error.message : "Snapshot read failed",
    };
  }
}

export async function saveCupSeerSnapshot(
  label?: string | null,
): Promise<CupSeerSnapshotDashboard> {
  const connection = await getSql();

  if (!connection) {
    return unavailableCupSeerSnapshotResult("missing-database-url");
  }

  if (!connection.sql) {
    return unavailableCupSeerSnapshotResult(connection.reason);
  }

  try {
    await ensureCupSeerSnapshotSchema(connection.sql);

    const { matches } = await listMatches();
    const candidates = toCupSnapshotCandidates(buildCupCandidates(matches, "en", 8));
    const countRows = (await connection.sql`
      select count(*)::int as count
      from cup_seer_snapshots;
    `) as unknown as Array<{ count: number | string }>;
    const nextIndex = toNumber(countRows[0]?.count) + 1;
    const snapshotLabel =
      typeof label === "string" && label.trim()
        ? label.replace(/\s+/g, " ").trim().slice(0, 80)
        : `Week ${Math.max(1, nextIndex)}`;

    await connection.sql`
      insert into cup_seer_snapshots (label, candidates, source_payload)
      values (
        ${snapshotLabel},
        ${JSON.stringify(candidates)}::jsonb,
        ${JSON.stringify({
          modelVersion: "v4.0",
          matchesConsidered: matches.length,
          note: "Final 8 lane snapshot with second-round path probability.",
        })}::jsonb
      );
    `;

    return listCupSeerSnapshots();
  } catch (error) {
    console.error("MatchSeer cup snapshot save failed", error);
    return {
      ...unavailableCupSeerSnapshotResult("database-query-failed"),
      error: error instanceof Error ? error.message : "Snapshot save failed",
    };
  }
}

function unavailableCupSeerSnapshotResult(
  reason: DataSourceReason,
): CupSeerSnapshotDashboard {
  return {
    source: "database-unavailable",
    reason,
    generatedAt: new Date().toISOString(),
    current: null,
    previous: null,
    history: [],
  };
}

function toCupSeerSnapshotBase(row: CupSeerSnapshotRow): CupSeerSnapshot {
  return {
    id: row.id,
    label: row.label,
    generatedAt: new Date(row.generated_at).toISOString(),
    candidates: readCupSnapshotCandidates(row.candidates).map((candidate) => ({
      ...candidate,
      previousRank: null,
      rankDelta: null,
    })),
  };
}

function withCupSeerMovement(
  snapshot: CupSeerSnapshot,
  previous: CupSeerSnapshot | null,
): CupSeerSnapshot {
  const previousRanks = new Map(
    previous?.candidates.map((candidate) => [
      candidate.team.code,
      candidate.rank,
    ]) ?? [],
  );

  return {
    ...snapshot,
    candidates: snapshot.candidates.map((candidate) => {
      const previousRank = previousRanks.get(candidate.team.code) ?? null;

      return {
        ...candidate,
        previousRank,
        rankDelta: previousRank === null ? null : previousRank - candidate.rank,
      };
    }),
  };
}

function readCupSnapshotCandidates(value: unknown): CupSnapshotCandidate[] {
  const parsed = typeof value === "string" ? safeJson(value) : value;

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.flatMap((candidate) => {
    const record = readPayloadRecord(candidate);
    const team = readPayloadRecord(record?.team);
    const rank = readPayloadNumber(record?.rank);
    const signal = readPayloadNumber(record?.signal);
    const advanceProbability = readPayloadNumber(record?.advanceProbability);

    if (!record || !team || rank === null || signal === null) {
      return [];
    }

    return [
      {
        rank,
        team: {
          name: readPayloadString(team.name) ?? "Unknown",
          code: readPayloadString(team.code) ?? "TBD",
          color: readPayloadString(team.color) ?? "#8fa2c4",
        },
        signal,
        advanceProbability: advanceProbability ?? signal,
        expectedPoints: readPayloadNumber(record.expectedPoints) ?? 0,
        matches: readPayloadNumber(record.matches) ?? 0,
        pathSignal: readPayloadNumber(record.pathSignal) ?? signal,
        traits: Array.isArray(record.traits)
          ? record.traits.filter((trait): trait is string => typeof trait === "string")
          : [],
      },
    ];
  });
}

function safeJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

export async function getMatch(matchId: string) {
  const result = await listMatches();

  return {
    source: result.source,
    reason: result.reason,
    match: result.matches.find((match) => match.id === matchId) ?? null,
  };
}

let trafficSchemaPromise: Promise<void> | null = null;
let playerModelSchemaPromise: Promise<void> | null = null;
let forecastLedgerSchemaPromise: Promise<void> | null = null;
let cupSeerSnapshotSchemaPromise: Promise<void> | null = null;

export async function recordTrafficEvent(
  input: TrafficEventInput,
): Promise<TrafficRecordResult> {
  const connection = await getSql();

  if (!connection) {
    return { recorded: false, reason: "missing-database-url" };
  }

  if (!connection.sql) {
    return { recorded: false, reason: connection.reason };
  }

  const sql = connection.sql;

  try {
    await ensureTrafficSchema(sql);

    const userAgent = input.userAgent ?? "";
    const visitorSource =
      typeof input.visitorId === "string" && input.visitorId.trim()
        ? input.visitorId.trim()
        : `${userAgent}:${new Date().toISOString().slice(0, 10)}`;
    const path = normalizeTrafficPath(input.path);
    const referrer = normalizeTrafficReferrer(input.referrer, input.requestHost);
    const device = deviceFromUserAgent(userAgent);
    const viewport = normalizeViewport(input.viewport);
    const language =
      typeof input.language === "string" && input.language.trim()
        ? input.language.trim().slice(0, 12)
        : null;
    const matchId =
      typeof input.matchId === "string" && input.matchId.trim()
        ? input.matchId.trim().slice(0, 80)
        : null;
    const timezone =
      typeof input.timezone === "string" && input.timezone.trim()
        ? input.timezone.trim().slice(0, 80)
        : null;
    const geo = normalizeTrafficGeo(input.geo);

    await sql`
      insert into traffic_events (
        path,
        referrer,
        language,
        match_id,
        visitor_hash,
        user_agent_hash,
        device,
        viewport_width,
        viewport_height,
        timezone,
        country,
        region,
        city
      )
      values (
        ${path},
        ${referrer},
        ${language},
        ${matchId},
        ${hashTrafficValue(visitorSource)},
        ${hashTrafficValue(userAgent)},
        ${device},
        ${viewport.width},
        ${viewport.height},
        ${timezone},
        ${geo.country},
        ${geo.region},
        ${geo.city}
      );
    `;

    return { recorded: true, reason: "database" };
  } catch (error) {
    console.error("MatchSeer traffic record failed", error);
    return { recorded: false, reason: "database-query-failed" };
  }
}

export async function getTrafficDashboard(): Promise<TrafficDashboard> {
  const connection = await getSql();
  const generatedAt = new Date().toISOString();

  if (!connection) {
    return emptyTrafficDashboard("missing-database-url", generatedAt);
  }

  if (!connection.sql) {
    return emptyTrafficDashboard(connection.reason, generatedAt);
  }

  const sql = connection.sql;

  try {
    await ensureTrafficSchema(sql);

    const [summaryRow] = (await sql`
      select
        count(*) filter (where occurred_at >= now() - interval '24 hours') as views_24h,
        count(distinct visitor_hash) filter (where occurred_at >= now() - interval '24 hours') as visitors_24h,
        count(*) filter (where occurred_at >= now() - interval '7 days') as views_7d,
        count(distinct visitor_hash) filter (where occurred_at >= now() - interval '7 days') as visitors_7d
      from traffic_events;
    `) as unknown as TrafficSummaryRow[];
    const topPathRows = (await sql`
      select
        path,
        count(*) as views,
        count(distinct visitor_hash) as visitors
      from traffic_events
      where occurred_at >= now() - interval '7 days'
      group by path
      order by views desc, path asc
      limit 8;
    `) as unknown as TrafficPathRow[];
    const referrerRows = (await sql`
      select
        referrer,
        count(*) as views
      from traffic_events
      where occurred_at >= now() - interval '7 days'
      group by referrer
      order by views desc, referrer asc
      limit 8;
    `) as unknown as TrafficReferrerRow[];
    const deviceRows = (await sql`
      select
        device,
        count(*) as views
      from traffic_events
      where occurred_at >= now() - interval '7 days'
      group by device
      order by views desc, device asc;
    `) as unknown as TrafficDeviceRow[];
    const locationRows = (await sql`
      select
        country,
        region,
        city,
        count(*) as views,
        count(distinct visitor_hash) as visitors
      from traffic_events
      where occurred_at >= now() - interval '7 days'
        and (country is not null or region is not null or city is not null)
      group by country, region, city
      order by views desc, visitors desc
      limit 8;
    `) as unknown as TrafficLocationRow[];
    const timelineRows = (await sql`
      select
        date_trunc('hour', occurred_at) as bucket,
        count(*) as views,
        count(distinct visitor_hash) as visitors
      from traffic_events
      where occurred_at >= now() - interval '24 hours'
      group by bucket
      order by bucket asc;
    `) as unknown as TrafficTimelineRow[];
    const recentRows = (await sql`
      select
        occurred_at,
        path,
        referrer,
        device,
        language,
        match_id,
        country,
        region,
        city
      from traffic_events
      order by occurred_at desc
      limit 12;
    `) as unknown as TrafficRecentRow[];
    const views24h = toNumber(summaryRow?.views_24h ?? 0);
    const visitors24h = toNumber(summaryRow?.visitors_24h ?? 0);
    const views7d = toNumber(summaryRow?.views_7d ?? 0);
    const visitors7d = toNumber(summaryRow?.visitors_7d ?? 0);

    return {
      source: "database",
      reason: "database",
      generatedAt,
      windows: {
        last24h: {
          views: views24h,
          visitors: visitors24h,
        },
        last7d: {
          views: views7d,
          visitors: visitors7d,
        },
      },
      topPaths: topPathRows.map((row) => ({
        path: row.path,
        views: toNumber(row.views),
        visitors: toNumber(row.visitors),
      })),
      topReferrers: referrerRows.map((row) => ({
        referrer: row.referrer,
        views: toNumber(row.views),
      })),
      devices: deviceRows.map((row) => ({
        device: row.device,
        views: toNumber(row.views),
      })),
      topLocations: locationRows.map((row) => ({
        label: formatTrafficLocation(row),
        country: row.country,
        region: row.region,
        city: row.city,
        views: toNumber(row.views),
        visitors: toNumber(row.visitors),
      })),
      timeline: fillTrafficTimeline(timelineRows),
      recent: recentRows.map((row) => ({
        occurredAt: new Date(row.occurred_at).toISOString(),
        path: row.path,
        referrer: row.referrer,
        device: row.device,
        language: row.language,
        matchId: row.match_id,
        location: formatTrafficLocation(row),
      })),
      revenue: estimateTrafficRevenue({
        views24h,
        views7d,
      }),
    };
  } catch (error) {
    console.error("MatchSeer traffic dashboard failed", error);
    return emptyTrafficDashboard("database-query-failed", generatedAt);
  }
}

async function ensureTrafficSchema(sql: NeonQuery) {
  if (!trafficSchemaPromise) {
    trafficSchemaPromise = (async () => {
      await sql`create extension if not exists pgcrypto;`;
      await sql`
        create table if not exists traffic_events (
          id uuid primary key default gen_random_uuid(),
          occurred_at timestamptz not null default now(),
          path text not null,
          referrer text not null default 'Direct',
          language text,
          match_id text,
          visitor_hash text not null,
          user_agent_hash text,
          device text not null default 'Desktop',
          viewport_width integer,
          viewport_height integer,
          timezone text,
          country text,
          region text,
          city text
        );
      `;
      await sql`
        alter table traffic_events
        add column if not exists country text;
      `;
      await sql`
        alter table traffic_events
        add column if not exists region text;
      `;
      await sql`
        alter table traffic_events
        add column if not exists city text;
      `;
      await sql`
        create index if not exists traffic_events_occurred_at_idx
        on traffic_events (occurred_at desc);
      `;
      await sql`
        create index if not exists traffic_events_path_idx
        on traffic_events (path);
      `;
      await sql`
        create index if not exists traffic_events_visitor_hash_idx
        on traffic_events (visitor_hash);
      `;
      await sql`
        create index if not exists traffic_events_country_idx
        on traffic_events (country);
      `;
    })().catch((error) => {
      trafficSchemaPromise = null;
      throw error;
    });
  }

  return trafficSchemaPromise;
}

async function ensurePlayerModelSchema(sql: NeonQuery) {
  if (!playerModelSchemaPromise) {
    playerModelSchemaPromise = (async () => {
      await sql`
        alter table players
        add column if not exists importance integer not null default 50;
      `;
      await sql`
        alter table players
        add column if not exists availability_status text not null default 'available';
      `;
      await sql`
        alter table players
        add column if not exists availability_note text;
      `;
      await sql`
        alter table players
        add column if not exists yellow_cards integer not null default 0;
      `;
      await sql`
        alter table players
        add column if not exists red_cards integer not null default 0;
      `;
      await sql`
        alter table players
        add column if not exists is_suspended boolean not null default false;
      `;
      await sql`
        alter table players
        add column if not exists lineup_status text not null default 'unknown';
      `;
      await sql`
        alter table players
        add column if not exists lineup_confirmed_at timestamptz;
      `;
      await sql`
        alter table players
        add column if not exists age integer;
      `;
      await sql`
        alter table players
        add column if not exists minutes_recent integer not null default 0;
      `;
      await sql`
        alter table players
        add column if not exists is_key_player boolean not null default false;
      `;
      await sql`
        create index if not exists players_team_id_idx
        on players (team_id);
      `;
    })().catch((error) => {
      playerModelSchemaPromise = null;
      throw error;
    });
  }

  return playerModelSchemaPromise;
}

async function ensureForecastLedgerSchema(sql: NeonQuery) {
  if (!forecastLedgerSchemaPromise) {
    forecastLedgerSchemaPromise = (async () => {
      await sql`
        create index if not exists forecasts_match_latest_idx
        on forecasts (match_id, version desc, created_at desc);
      `;
    })().catch((error) => {
      forecastLedgerSchemaPromise = null;
      throw error;
    });
  }

  return forecastLedgerSchemaPromise;
}

async function ensureCupSeerSnapshotSchema(sql: NeonQuery) {
  if (!cupSeerSnapshotSchemaPromise) {
    cupSeerSnapshotSchemaPromise = (async () => {
      await sql`
        create table if not exists cup_seer_snapshots (
          id uuid primary key default gen_random_uuid(),
          label text not null,
          generated_at timestamptz not null default now(),
          candidates jsonb not null,
          source_payload jsonb not null default '{}'::jsonb
        );
      `;
      await sql`
        create index if not exists cup_seer_snapshots_generated_idx
        on cup_seer_snapshots (generated_at desc);
      `;
    })().catch((error) => {
      cupSeerSnapshotSchemaPromise = null;
      throw error;
    });
  }

  return cupSeerSnapshotSchemaPromise;
}


async function seedKeyPlayerWatchlist(sql: NeonQuery) {
  for (const player of keyPlayerWatchlist) {
    await sql`
      insert into players (
        team_id,
        slug,
        name,
        role,
        club,
        league,
        spark_rating,
        importance,
        availability_status,
        availability_note,
        yellow_cards,
        red_cards,
        is_suspended,
        age,
        minutes_recent,
        is_key_player,
        note
      )
      select
        teams.id,
        ${player.slug},
        ${player.name},
        ${player.role},
        ${player.club},
        ${player.league},
        ${player.spark},
        ${player.importance},
        'available',
        null,
        0,
        0,
        false,
        ${player.age},
        0,
        true,
        ${player.note}
      from teams
      where upper(teams.code) = ${player.teamCode}
         or teams.slug = ${player.teamSlug}
      order by case when upper(teams.code) = ${player.teamCode} then 0 else 1 end
      limit 1
      on conflict (slug) do update set
        team_id = excluded.team_id,
        name = excluded.name,
        role = excluded.role,
        club = excluded.club,
        league = excluded.league,
        spark_rating = excluded.spark_rating,
        importance = excluded.importance,
        age = excluded.age,
        is_key_player = excluded.is_key_player,
        note = excluded.note,
        availability_note = case
          when players.availability_note = 'Availability feed pending' then null
          else players.availability_note
        end;
    `;
  }
}

function emptyTrafficDashboard(
  reason: DataSourceReason,
  generatedAt: string,
): TrafficDashboard {
  return {
    source: "database-unavailable",
    reason,
    generatedAt,
    windows: {
      last24h: { views: 0, visitors: 0 },
      last7d: { views: 0, visitors: 0 },
    },
    topPaths: [],
    topReferrers: [],
    devices: [],
    topLocations: [],
    timeline: fillTrafficTimeline([]),
    recent: [],
    revenue: estimateTrafficRevenue({ views24h: 0, views7d: 0 }),
  };
}

function emptyModelControlDashboard(
  reason: DataSourceReason,
  generatedAt: string,
): ModelControlDashboard {
  return {
    source: "database-unavailable",
    reason,
    generatedAt,
    players: [],
    forecasts: [],
  };
}

function toModelControlPlayer(row: ModelControlPlayerRow): ModelControlPlayer {
  return {
    slug: row.slug,
    name: row.name,
    team: row.team_name,
    teamCode: row.team_code,
    role: row.role ?? "Player",
    spark: toNumber(row.spark_rating),
    importance: toNumber(row.importance),
    availabilityStatus: row.availability_status ?? "available",
    availabilityNote: normalizeStoredAvailabilityNote(row.availability_note),
    yellowCards: toNumber(row.yellow_cards),
    redCards: toNumber(row.red_cards),
    isSuspended: Boolean(row.is_suspended),
    lineupStatus: normalizeLineupStatus(row.lineup_status),
    lineupConfirmedAt: row.lineup_confirmed_at
      ? new Date(row.lineup_confirmed_at).toISOString()
      : null,
    age: toOptionalNumber(row.age),
    minutesRecent: toNumber(row.minutes_recent),
  };
}

function toModelControlForecastVersion(
  row: ModelControlForecastRow,
): ModelControlForecastVersion {
  const payload = parseJsonPayload(row.source_payload);
  const previousForecast = readPayloadRecord(payload?.previousForecast);
  const movementTrail = readForecastMovementTrail(payload);
  const calibrationTuning = readPayloadRecord(payload?.calibrationTuning);

  return {
    matchId: row.match_id,
    group: normalizeMatchPhase(row.stage, row.group_name),
    status: row.status,
    startsAt: row.starts_at ? new Date(row.starts_at).toISOString() : null,
    home: row.home_name,
    homeCode: row.home_code,
    away: row.away_name,
    awayCode: row.away_code,
    version: toNumber(row.version),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    homeWin: toNumber(row.home_win_probability),
    draw: toNumber(row.draw_probability),
    awayWin: toNumber(row.away_win_probability),
    projected: normalizeProjectedScore(row.projected_score),
    confidence: toNumber(row.confidence),
    chaos: toNumber(row.chaos),
    modelVersion: readPayloadString(payload?.modelVersion) ?? "unknown-model",
    forecastStatus: readPayloadString(payload?.forecastStatus) ?? "open",
    supersedesVersion: readPayloadNumber(payload?.supersedesVersion),
    previousProjected: readPayloadString(previousForecast?.projected),
    movementSummary: movementTrail[0]?.adminText ?? null,
    calibrationTuningVersion: readPayloadString(calibrationTuning?.version),
    calibrationTuningApplied:
      readPayloadBoolean(calibrationTuning?.applied) ?? false,
    calibrationTuningReadiness: readPayloadString(calibrationTuning?.readiness),
  };
}

const allowedAvailabilityStatuses = new Set([
  "available",
  "doubtful",
  "limited",
  "sick",
  "injured",
  "suspended",
  "out",
]);

const allowedLineupStatuses = new Set([
  "unknown",
  "expected_start",
  "confirmed_start",
  "bench",
  "not_in_squad",
]);

const confirmedLineupStatuses = new Set([
  "confirmed_start",
  "bench",
  "not_in_squad",
]);

const yellowCardSuspensionThreshold = 2;

function normalizePlayerAvailabilityUpdate(
  update: PlayerAvailabilityUpdate,
): PlayerAvailabilityUpdate | null {
  const slug = normalizePlayerSlug(update.slug);
  const status = normalizeAvailabilityStatus(update.availabilityStatus);
  const lineupStatus = normalizeLineupStatus(update.lineupStatus);
  const yellowCards = clampInteger(update.yellowCards, 0, 3);
  const isAccumulationSuspension =
    yellowCards >= yellowCardSuspensionThreshold;

  if (!slug || !status) {
    return null;
  }

  return {
    slug,
    availabilityStatus: status,
    availabilityNote: normalizeAvailabilityNote(update.availabilityNote),
    yellowCards,
    redCards: clampInteger(update.redCards, 0, 2),
    isSuspended:
      Boolean(update.isSuspended) ||
      status === "suspended" ||
      isAccumulationSuspension,
    lineupStatus,
    minutesRecent: clampInteger(update.minutesRecent, 0, 450),
  };
}

function normalizeMarketPulseUpdate(
  update: MarketPulseUpdate,
): MarketPulseUpdate | null {
  const matchId =
    typeof update.matchId === "string" ? update.matchId.trim().slice(0, 120) : "";
  const home = readPayloadNumber(update.home);
  const draw = readPayloadNumber(update.draw);
  const away = readPayloadNumber(update.away);

  if (!matchId || home === null || draw === null || away === null) {
    return null;
  }

  const normalized = normalizePulseProbabilities(home, draw, away);

  if (!hasUsablePulse(normalized)) {
    return null;
  }

  const source = update.source === "manual" ? "manual" : "polymarket";

  return {
    matchId,
    source,
    home: normalized.home,
    draw: normalized.draw,
    away: normalized.away,
    liquidityScore: clampNumber(
      readPayloadNumber(update.liquidityScore) ??
        liquidityToTrust(
          readPayloadNumber(update.liquidity),
          readPayloadNumber(update.volume),
        ),
      0,
      1,
    ),
    liquidity: readPayloadNumber(update.liquidity),
    volume: readPayloadNumber(update.volume),
    capturedAt:
      typeof update.capturedAt === "string" && update.capturedAt.trim()
        ? update.capturedAt
        : new Date().toISOString(),
    marketId: normalizeMarketText(update.marketId, 120),
    marketSlug: normalizeMarketText(update.marketSlug, 160),
    question: normalizeMarketText(update.question, 260),
  };
}

function normalizeMarketText(value: unknown, maxLength: number) {
  return typeof value === "string" && value.trim()
    ? value.replace(/\s+/g, " ").trim().slice(0, maxLength)
    : null;
}

function normalizePlayerSlug(value: unknown) {
  return typeof value === "string"
    ? value.trim().toLowerCase().slice(0, 120)
    : "";
}

function normalizeAvailabilityStatus(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  return allowedAvailabilityStatuses.has(normalized) ? normalized : null;
}

function normalizeLineupStatus(value: unknown) {
  if (typeof value !== "string") {
    return "unknown";
  }

  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");

  return allowedLineupStatuses.has(normalized) ? normalized : "unknown";
}

function isConfirmedLineupStatus(value: string | null | undefined) {
  return confirmedLineupStatuses.has(normalizeLineupStatus(value));
}

function normalizeAvailabilityNote(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.replace(/\s+/g, " ").trim();

  return trimmed ? trimmed.slice(0, 180) : null;
}

function normalizeStoredAvailabilityNote(value: string | null) {
  if (value === "Availability feed pending") {
    return null;
  }

  return value;
}

function normalizeProjectedScore(value: string | null | undefined) {
  if (!value) {
    return "Pending";
  }

  return value.split("/")[0]?.trim() || "Pending";
}

function clampInteger(value: unknown, min: number, max: number) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return min;
  }

  return Math.round(Math.min(max, Math.max(min, numberValue)));
}

function readPayloadRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function readPayloadString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function readPayloadNumber(value: unknown) {
  const numberValue =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;

  return Number.isFinite(numberValue) ? numberValue : null;
}

function readPayloadBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    return normalized === "true" || normalized === "1" || normalized === "yes";
  }

  return false;
}

function estimateTrafficRevenue({
  views24h,
  views7d,
}: {
  views24h: number;
  views7d: number;
}): TrafficRevenueEstimate {
  const assumptions = {
    adSlotsPerPage: readEnvNumber("MATCHSEER_AD_SLOTS_PER_PAGE", 2),
    fillRate: readEnvNumber("MATCHSEER_AD_FILL_RATE", 0.82),
    viewability: readEnvNumber("MATCHSEER_AD_VIEWABILITY", 0.68),
    ecpms: {
      low: readEnvNumber("MATCHSEER_AD_ECPM_LOW", 1.25),
      base: readEnvNumber("MATCHSEER_AD_ECPM_BASE", 3.5),
      high: readEnvNumber("MATCHSEER_AD_ECPM_HIGH", 7.5),
    },
  };
  const last24h = estimateRevenueWindow(views24h, assumptions);
  const last7d = estimateRevenueWindow(views7d, assumptions);
  const projected30d = estimateRevenueWindow((views7d / 7) * 30, assumptions);

  return {
    currency: "USD",
    formula:
      "views * ad slots per page * fill rate * viewability * eCPM / 1000",
    assumptions,
    windows: {
      last24h,
      last7d,
      projected30d,
    },
  };
}

function estimateRevenueWindow(
  views: number,
  assumptions: TrafficRevenueEstimate["assumptions"],
): TrafficRevenueWindow {
  const normalizedViews = Math.max(0, Math.round(views));
  const estimatedImpressions =
    normalizedViews *
    assumptions.adSlotsPerPage *
    assumptions.fillRate *
    assumptions.viewability;

  return {
    views: normalizedViews,
    estimatedImpressions: Math.round(estimatedImpressions),
    low: roundMoney((estimatedImpressions * assumptions.ecpms.low) / 1000),
    base: roundMoney((estimatedImpressions * assumptions.ecpms.base) / 1000),
    high: roundMoney((estimatedImpressions * assumptions.ecpms.high) / 1000),
  };
}

function readEnvNumber(name: string, fallback: number) {
  const value = Number(process.env[name]);

  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeTrafficPath(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return "/";
  }

  try {
    const url = new URL(value, "https://matchseer.local");
    return `${url.pathname}${url.search}`.slice(0, 220) || "/";
  } catch {
    return value.startsWith("/") ? value.slice(0, 220) : "/";
  }
}

function normalizeTrafficReferrer(value: unknown, requestHost: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return "Direct";
  }

  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    const currentHost =
      typeof requestHost === "string"
        ? requestHost.split(":")[0].replace(/^www\./, "")
        : "";

    if (host === currentHost || host === "matchseer.com") {
      return "Internal";
    }

    return host.slice(0, 120);
  } catch {
    return value.slice(0, 120);
  }
}

function normalizeTrafficGeo(value: TrafficEventInput["geo"]) {
  return {
    country: normalizeGeoField(value?.country, 48, true),
    region: normalizeGeoField(value?.region, 80, false),
    city: normalizeGeoField(value?.city, 80, false),
  };
}

function normalizeGeoField(
  value: unknown,
  maxLength: number,
  uppercase: boolean,
) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const normalized = decodeGeoHeader(value)
    .replace(/\+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

  return normalized ? (uppercase ? normalized.toUpperCase() : normalized) : null;
}

function decodeGeoHeader(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function formatTrafficLocation({
  country,
  region,
  city,
}: {
  country: string | null;
  region: string | null;
  city: string | null;
}) {
  const parts = [city, region, country].filter(
    (part): part is string => Boolean(part),
  );

  return parts.length > 0 ? parts.join(", ") : "Unknown";
}

function normalizeViewport(value: TrafficEventInput["viewport"]) {
  const width = toBoundedInteger(value?.width, 0, 10000);
  const height = toBoundedInteger(value?.height, 0, 10000);

  return {
    width: width === 0 ? null : width,
    height: height === 0 ? null : height,
  };
}

function toBoundedInteger(value: unknown, min: number, max: number) {
  const numeric = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numeric)) {
    return min;
  }

  return Math.round(Math.min(max, Math.max(min, numeric)));
}

function deviceFromUserAgent(userAgent: string) {
  const value = userAgent.toLowerCase();

  if (/bot|crawler|spider|preview|facebookexternalhit|slackbot/.test(value)) {
    return "Bot";
  }

  if (/ipad|tablet/.test(value)) {
    return "Tablet";
  }

  if (/mobi|android|iphone|ipod/.test(value)) {
    return "Mobile";
  }

  return "Desktop";
}

function hashTrafficValue(value: string) {
  const salt =
    process.env.MATCHSEER_TRAFFIC_SALT ??
    process.env.MATCHSEER_SYNC_SECRET ??
    "matchseer-traffic";

  return createHash("sha256")
    .update(`${salt}:${value}`)
    .digest("hex")
    .slice(0, 40);
}

function fillTrafficTimeline(rows: TrafficTimelineRow[]) {
  const byBucket = new Map(
    rows.map((row) => [
      new Date(row.bucket).toISOString().slice(0, 13),
      {
        views: toNumber(row.views),
        visitors: toNumber(row.visitors),
      },
    ]),
  );
  const points: TrafficDashboard["timeline"] = [];
  const now = new Date();

  now.setMinutes(0, 0, 0);

  for (let index = 23; index >= 0; index -= 1) {
    const bucketDate = new Date(now);
    bucketDate.setHours(now.getHours() - index);

    const key = bucketDate.toISOString().slice(0, 13);
    const values = byBucket.get(key) ?? { views: 0, visitors: 0 };

    points.push({
      bucket: bucketDate.toISOString(),
      ...values,
    });
  }

  return points;
}

export async function syncFootballDataSnapshot(
  snapshot: FootballDataSnapshot,
): Promise<RealDataSyncResult> {
  const connection = await getSql();

  if (!connection?.sql) {
    throw new Error("DATABASE_URL is required for real data sync.");
  }

  const sql = connection.sql;
  const fallbackVenueSlug = "provider-venue-tbd";

  await sql`
    insert into competitions (slug, name, sport, season)
    values (
      ${snapshot.competition.slug},
      ${snapshot.competition.name},
      ${snapshot.competition.sport},
      ${snapshot.competition.season}
    )
    on conflict (slug) do update set
      name = excluded.name,
      sport = excluded.sport,
      season = excluded.season;
  `;

  await upsertWorldCupVenues(sql);
  await ensurePlayerModelSchema(sql);
  await ensureForecastLedgerSchema(sql);

  const teamByProviderId = new Map(
    snapshot.teams.map((team) => [team.id, team] as const),
  );
  const ratingsByProviderId = new Map<number, TeamRatings>();

  for (const team of snapshot.teams) {
    const ratings = teamRatings(team);
    ratingsByProviderId.set(team.id, ratings);
    const record = team.isPlaceholder ? "Knockout slot pending" : "Provider synced";

    await sql`
      insert into teams (
        competition_id,
        slug,
        name,
        code,
        color,
        country,
        record,
        form,
        attack,
        control,
        defense,
        set_pieces
      )
      values (
        (select id from competitions where slug = ${snapshot.competition.slug}),
        ${team.slug},
        ${team.name},
        ${team.code},
        ${team.color},
        ${team.country},
        ${record},
        array[]::text[],
        ${ratings.attack},
        ${ratings.control},
        ${ratings.defense},
        ${ratings.setPieces}
      )
      on conflict (slug) do update set
        competition_id = excluded.competition_id,
        name = excluded.name,
        code = excluded.code,
        color = excluded.color,
        country = excluded.country,
        attack = excluded.attack,
        control = excluded.control,
        defense = excluded.defense,
        set_pieces = excluded.set_pieces;
    `;
  }

  await seedKeyPlayerWatchlist(sql);

  const teamSlugByProviderId = new Map(
    snapshot.teams.map((team) => [team.id, team.slug] as const),
  );
  const calibrationTuning = await readAppliedCalibrationTuning(sql);
  let forecasts = 0;
  let venuesMapped = 0;
  let placeholderMatches = 0;

  for (const match of snapshot.matches) {
    const homeSlug = teamSlugByProviderId.get(match.homeTeamProviderId);
    const awaySlug = teamSlugByProviderId.get(match.awayTeamProviderId);
    const homeTeam = teamByProviderId.get(match.homeTeamProviderId);
    const awayTeam = teamByProviderId.get(match.awayTeamProviderId);
    const homeRatings = ratingsByProviderId.get(match.homeTeamProviderId);
    const awayRatings = ratingsByProviderId.get(match.awayTeamProviderId);

    if (!homeSlug || !awaySlug || !homeTeam || !awayTeam || !homeRatings || !awayRatings) {
      continue;
    }

    if (match.venueSlug) {
      venuesMapped += 1;
    }

    const matchHasPlaceholderTeam =
      match.homeTeamIsPlaceholder || match.awayTeamIsPlaceholder;

    if (matchHasPlaceholderTeam) {
      placeholderMatches += 1;
    }

    await sql`
      insert into matches (
        external_id,
        competition_id,
        home_team_id,
        away_team_id,
        venue_id,
        stage,
        group_name,
        starts_at,
        status,
        home_score,
        away_score,
        updated_at
      )
      values (
        ${match.externalId},
        (select id from competitions where slug = ${snapshot.competition.slug}),
        (select id from teams where slug = ${homeSlug}),
        (select id from teams where slug = ${awaySlug}),
        (select id from venues where slug = ${match.venueSlug ?? fallbackVenueSlug}),
        ${match.stage},
        ${match.groupName},
        ${match.startsAt},
        ${match.status},
        ${match.homeScore},
        ${match.awayScore},
        now()
      )
      on conflict (external_id) do update set
        competition_id = excluded.competition_id,
        venue_id = case
          when ${match.venueSlug === null}::boolean
            then coalesce(matches.venue_id, excluded.venue_id)
          else excluded.venue_id
        end,
        home_team_id = case
          when ${match.homeTeamIsPlaceholder}::boolean
            then coalesce(matches.home_team_id, excluded.home_team_id)
          else excluded.home_team_id
        end,
        away_team_id = case
          when ${match.awayTeamIsPlaceholder}::boolean
            then coalesce(matches.away_team_id, excluded.away_team_id)
          else excluded.away_team_id
        end,
        stage = excluded.stage,
        group_name = excluded.group_name,
        starts_at = excluded.starts_at,
        status = case
          when matches.status = 'final'
           and matches.home_score is not null
           and matches.away_score is not null
           and (
             excluded.status <> 'final'
             or excluded.home_score is null
             or excluded.away_score is null
           )
            then matches.status
          else excluded.status
        end,
        home_score = case
          when matches.status = 'final'
           and matches.home_score is not null
           and matches.away_score is not null
           and (
             excluded.status <> 'final'
             or excluded.home_score is null
             or excluded.away_score is null
           )
            then matches.home_score
          else excluded.home_score
        end,
        away_score = case
          when matches.status = 'final'
           and matches.home_score is not null
           and matches.away_score is not null
           and (
             excluded.status <> 'final'
             or excluded.home_score is null
             or excluded.away_score is null
           )
            then matches.away_score
          else excluded.away_score
        end,
        updated_at = now();
    `;

    if (matchHasPlaceholderTeam) {
      continue;
    }

    const existingForecastRows = (await sql`
      select
        forecasts.id as forecast_id,
        forecasts.version,
        matches.status,
        matches.home_score,
        matches.away_score,
        forecasts.home_win_probability,
        forecasts.draw_probability,
        forecasts.away_win_probability,
        forecasts.projected_score,
        forecasts.confidence,
        forecasts.chaos,
        forecasts.source_payload
      from matches
      join forecasts
        on forecasts.match_id = matches.id
      where matches.external_id = ${match.externalId}
      order by forecasts.version desc, forecasts.created_at desc
      limit 1;
    `) as unknown as ExistingForecastLockRow[];
    const existingForecast = existingForecastRows[0] ?? null;

    if (
      existingForecast &&
      shouldPreserveModelForecast(existingForecast)
    ) {
      if (match.status === "final" && match.duration && existingForecast.forecast_id) {
        const resultPayload = {
          result: {
            duration: match.duration,
            homeScore: match.homeScore,
            awayScore: match.awayScore,
            updatedAt: snapshot.fetchedAt,
          },
        };

        await sql`
          update forecasts
          set source_payload =
            coalesce(source_payload, '{}'::jsonb) ||
            ${JSON.stringify(resultPayload)}::jsonb
          where id = ${existingForecast.forecast_id};
        `;
      }

      forecasts += 1;
      continue;
    }

    const forecastContextRows = (await sql`
      with current_match as (
        select
          matches.id,
          matches.external_id,
          matches.home_team_id,
          matches.away_team_id,
          matches.referee_id,
          matches.starts_at,
          venues.slug as venue_slug,
          venues.city as venue_city,
          venues.country as venue_country,
          venues.latitude as venue_latitude,
          venues.longitude as venue_longitude
        from matches
        left join venues on venues.id = matches.venue_id
        where matches.external_id = ${match.externalId}
        limit 1
      ),
      latest_weather as (
        select distinct on (weather_snapshots.match_id)
          weather_snapshots.match_id,
          weather_snapshots.temperature_c,
          weather_snapshots.wind_kph,
          weather_snapshots.humidity,
          weather_snapshots.summary
        from weather_snapshots
        order by weather_snapshots.match_id, weather_snapshots.captured_at desc
      )
      select
        current_match.external_id,
        current_match.starts_at,
        current_match.venue_slug,
        current_match.venue_city,
        current_match.venue_country,
        current_match.venue_latitude,
        current_match.venue_longitude,
        referees.name as referee_name,
        referees.cards_per_match,
        latest_weather.temperature_c,
        latest_weather.wind_kph,
        latest_weather.humidity,
        latest_weather.summary as weather_summary,
        (
          select extract(epoch from (current_match.starts_at - max(previous_match.starts_at))) / 3600
          from matches previous_match
          where current_match.starts_at is not null
            and previous_match.starts_at is not null
            and previous_match.starts_at < current_match.starts_at
            and (
              previous_match.home_team_id = current_match.home_team_id
              or previous_match.away_team_id = current_match.home_team_id
            )
        ) as home_rest_hours,
        (
          select extract(epoch from (current_match.starts_at - max(previous_match.starts_at))) / 3600
          from matches previous_match
          where current_match.starts_at is not null
            and previous_match.starts_at is not null
            and previous_match.starts_at < current_match.starts_at
            and (
              previous_match.home_team_id = current_match.away_team_id
              or previous_match.away_team_id = current_match.away_team_id
            )
        ) as away_rest_hours,
        (
          select jsonb_build_object(
            'externalId', previous_match.external_id,
            'stage', previous_match.stage,
            'groupName', previous_match.group_name,
            'startsAt', previous_match.starts_at,
            'venueSlug', previous_venue.slug,
            'venueCity', previous_venue.city,
            'venueCountry', previous_venue.country,
            'latitude', previous_venue.latitude,
            'longitude', previous_venue.longitude,
            'duration', previous_forecast.source_payload -> 'result' ->> 'duration'
          )
          from matches previous_match
          left join venues previous_venue on previous_venue.id = previous_match.venue_id
          left join lateral (
            select forecasts.source_payload
            from forecasts
            where forecasts.match_id = previous_match.id
            order by forecasts.version desc, forecasts.created_at desc
            limit 1
          ) previous_forecast on true
          where current_match.starts_at is not null
            and previous_match.starts_at is not null
            and previous_match.starts_at < current_match.starts_at
            and (
              previous_match.home_team_id = current_match.home_team_id
              or previous_match.away_team_id = current_match.home_team_id
            )
          order by previous_match.starts_at desc
          limit 1
        ) as home_previous_match,
        (
          select jsonb_build_object(
            'externalId', previous_match.external_id,
            'stage', previous_match.stage,
            'groupName', previous_match.group_name,
            'startsAt', previous_match.starts_at,
            'venueSlug', previous_venue.slug,
            'venueCity', previous_venue.city,
            'venueCountry', previous_venue.country,
            'latitude', previous_venue.latitude,
            'longitude', previous_venue.longitude,
            'duration', previous_forecast.source_payload -> 'result' ->> 'duration'
          )
          from matches previous_match
          left join venues previous_venue on previous_venue.id = previous_match.venue_id
          left join lateral (
            select forecasts.source_payload
            from forecasts
            where forecasts.match_id = previous_match.id
            order by forecasts.version desc, forecasts.created_at desc
            limit 1
          ) previous_forecast on true
          where current_match.starts_at is not null
            and previous_match.starts_at is not null
            and previous_match.starts_at < current_match.starts_at
            and (
              previous_match.home_team_id = current_match.away_team_id
              or previous_match.away_team_id = current_match.away_team_id
            )
          order by previous_match.starts_at desc
          limit 1
        ) as away_previous_match,
        (
          select count(*)
          from matches previous_match
          where current_match.starts_at is not null
            and previous_match.starts_at is not null
            and previous_match.starts_at < current_match.starts_at
            and previous_match.status = 'final'
            and previous_match.home_score is not null
            and previous_match.away_score is not null
            and (
              previous_match.home_team_id = current_match.home_team_id
              or previous_match.away_team_id = current_match.home_team_id
            )
        ) as home_tournament_matches,
        coalesce(
          (
            select sum(
              case
                when previous_match.home_score = previous_match.away_score then 1
                when previous_match.home_team_id = current_match.home_team_id
                  and previous_match.home_score > previous_match.away_score then 3
                when previous_match.away_team_id = current_match.home_team_id
                  and previous_match.away_score > previous_match.home_score then 3
                else 0
              end
            )
            from matches previous_match
            where current_match.starts_at is not null
              and previous_match.starts_at is not null
              and previous_match.starts_at < current_match.starts_at
              and previous_match.status = 'final'
              and previous_match.home_score is not null
              and previous_match.away_score is not null
              and (
                previous_match.home_team_id = current_match.home_team_id
                or previous_match.away_team_id = current_match.home_team_id
              )
          ),
          0
        ) as home_tournament_points,
        coalesce(
          (
            select sum(
              case
                when previous_match.home_team_id = current_match.home_team_id
                  then previous_match.home_score - previous_match.away_score
                else previous_match.away_score - previous_match.home_score
              end
            )
            from matches previous_match
            where current_match.starts_at is not null
              and previous_match.starts_at is not null
              and previous_match.starts_at < current_match.starts_at
              and previous_match.status = 'final'
              and previous_match.home_score is not null
              and previous_match.away_score is not null
              and (
                previous_match.home_team_id = current_match.home_team_id
                or previous_match.away_team_id = current_match.home_team_id
              )
          ),
          0
        ) as home_tournament_goal_diff,
        (
          select count(*)
          from matches previous_match
          where current_match.starts_at is not null
            and previous_match.starts_at is not null
            and previous_match.starts_at < current_match.starts_at
            and previous_match.status = 'final'
            and previous_match.home_score is not null
            and previous_match.away_score is not null
            and (
              previous_match.home_team_id = current_match.away_team_id
              or previous_match.away_team_id = current_match.away_team_id
            )
        ) as away_tournament_matches,
        coalesce(
          (
            select sum(
              case
                when previous_match.home_score = previous_match.away_score then 1
                when previous_match.home_team_id = current_match.away_team_id
                  and previous_match.home_score > previous_match.away_score then 3
                when previous_match.away_team_id = current_match.away_team_id
                  and previous_match.away_score > previous_match.home_score then 3
                else 0
              end
            )
            from matches previous_match
            where current_match.starts_at is not null
              and previous_match.starts_at is not null
              and previous_match.starts_at < current_match.starts_at
              and previous_match.status = 'final'
              and previous_match.home_score is not null
              and previous_match.away_score is not null
              and (
                previous_match.home_team_id = current_match.away_team_id
                or previous_match.away_team_id = current_match.away_team_id
              )
          ),
          0
        ) as away_tournament_points,
        coalesce(
          (
            select sum(
              case
                when previous_match.home_team_id = current_match.away_team_id
                  then previous_match.home_score - previous_match.away_score
                else previous_match.away_score - previous_match.home_score
              end
            )
            from matches previous_match
            where current_match.starts_at is not null
              and previous_match.starts_at is not null
              and previous_match.starts_at < current_match.starts_at
              and previous_match.status = 'final'
              and previous_match.home_score is not null
              and previous_match.away_score is not null
              and (
                previous_match.home_team_id = current_match.away_team_id
                or previous_match.away_team_id = current_match.away_team_id
              )
          ),
          0
        ) as away_tournament_goal_diff,
        coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'teamSide',
                case
                  when players.team_id = current_match.home_team_id then 'home'
                  else 'away'
                end,
                'teamCode',
                player_team.code,
                'teamName',
                player_team.name,
                'name',
                players.name,
                'role',
                players.role,
                'spark',
                players.spark_rating,
                'importance',
                players.importance,
                'availabilityStatus',
                players.availability_status,
                'availabilityNote',
                players.availability_note,
                'yellowCards',
                players.yellow_cards,
                'redCards',
                players.red_cards,
                'isSuspended',
                players.is_suspended,
                'lineupStatus',
                players.lineup_status,
                'lineupConfirmedAt',
                players.lineup_confirmed_at,
                'age',
                players.age,
                'minutesRecent',
                players.minutes_recent
              )
              order by players.importance desc, players.spark_rating desc nulls last, players.name
            )
            from players
            join teams player_team on player_team.id = players.team_id
            where players.team_id in (
              current_match.home_team_id,
              current_match.away_team_id
            )
              and players.is_key_player = true
          ),
          '[]'::jsonb
        ) as player_availability
      from current_match
      left join referees on referees.id = current_match.referee_id
      left join latest_weather on latest_weather.match_id = current_match.id
      limit 1;
    `) as unknown as ForecastContextRow[];
    const forecastContext = forecastContextRows[0] ?? null;
    const storedMarketPulse = extractStoredMarketPulse(
      existingForecast?.source_payload,
    );
    const phase = normalizeMatchPhase(match.stage, match.groupName);
    const forecast = matchseerV3Forecast({
      homeTeam,
      awayTeam,
      homeRatings,
      awayRatings,
      phase,
      venueSlug: match.venueSlug,
      context: forecastContext,
      marketPulse: storedMarketPulse,
      calibrationTuning,
      liveState: {
        status: match.status,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        minute: match.minute ?? null,
        homeRedCards: match.homeRedCards ?? 0,
        awayRedCards: match.awayRedCards ?? 0,
      },
    });
    const forecastFingerprint = createForecastFingerprint({
      forecast,
      homeRatings,
      awayRatings,
    });
    const existingFingerprint = readForecastFingerprint(
      existingForecast?.source_payload,
    );

    if (existingForecast && existingFingerprint === forecastFingerprint) {
      forecasts += 1;
      continue;
    }

    const nextVersion = existingForecast
      ? Math.max(1, toNumber(existingForecast.version) + 1)
      : 1;
    const previousForecast = existingForecast
      ? {
          version: toNumber(existingForecast.version),
          home: toNumber(existingForecast.home_win_probability),
          draw: toNumber(existingForecast.draw_probability),
          away: toNumber(existingForecast.away_win_probability),
          projected: existingForecast.projected_score,
          confidence: toNumber(existingForecast.confidence),
          chaos: toNumber(existingForecast.chaos),
          fingerprint: existingFingerprint,
        }
      : null;
    const movementTrail = buildForecastMovementTrail({
      forecast,
      previousForecast,
    });
    const sourcePayload = {
      provider: snapshot.provider,
      providerMatchId: match.providerId,
      fetchedAt: snapshot.fetchedAt,
      forecastEngine: "matchseer-v4",
      modelVersion: "matchseer-v4.1-receipt-tuning",
      phase,
      forecastFingerprint,
      forecastStatus: "open",
      supersedesVersion: existingForecast
        ? toNumber(existingForecast.version)
        : null,
      homeRatings,
      awayRatings,
      goalModel: forecast.goalModel,
      knockout: forecast.knockout,
      calibrationTuning: forecast.calibrationTuning,
      marketNudge: forecast.marketNudge,
      liveModel: forecast.liveModel,
      modifiers: forecast.modifiers,
      // Carry any saved crowd signal forward so it survives forecast re-versioning
      // (manual pulses were silently orphaned on old versions before this).
      marketPulse: storedMarketPulse,
      result:
        match.status === "final" && match.duration
          ? {
              duration: match.duration,
              homeScore: match.homeScore,
              awayScore: match.awayScore,
              updatedAt: snapshot.fetchedAt,
            }
          : null,
      previousForecast,
      movementTrail,
      note: "Versioned dynamic forecast from team profiles, venue, weather, altitude, heat load, travel distance, rest windows, referee rhythm, spotlight gravity, VIP stage pressure, player availability, yellow-card accumulation, suspension risk, confirmed lineups, team dependency, fatigue signals, extra-time hangover, tournament-floor score pressure, knockout resolution logic, xG-derived outcome probabilities, guarded receipt tuning, capped crowd nudges, and live-state probability reads.",
    };
    const forecastRows = await sql`
      insert into forecasts (
        match_id,
        version,
        home_win_probability,
        draw_probability,
        away_win_probability,
        projected_score,
        confidence,
        chaos,
        source_payload
      )
      values (
        (select id from matches where external_id = ${match.externalId}),
        ${nextVersion},
        ${forecast.home},
        ${forecast.draw},
        ${forecast.away},
        ${forecast.projected},
        ${forecast.confidence},
        ${forecast.chaos},
        ${JSON.stringify(sourcePayload)}::jsonb
      )
      on conflict (match_id, version) do nothing
      returning id;
    `;
    const forecastId = forecastRows[0]?.id;

    if (typeof forecastId !== "string") {
      continue;
    }

    await sql`
      delete from forecast_factors
      where forecast_id = ${forecastId};
    `;

    for (const factor of forecast.factors) {
      await sql`
        insert into forecast_factors (forecast_id, label, weight, explanation)
        values (${forecastId}, ${factor.label}, ${factor.weight}, ${factor.explanation});
      `;
    }

    for (const language of ["en", "es", "fr"] as Language[]) {
      const copy = baselineInterpretationCopy(language, forecast.projected);

      await sql`
        insert into forecast_interpretations (
          forecast_id,
          language,
          headline,
          summary,
          tone_line,
          missing_data_notes,
          disclaimer
        )
        values (
          ${forecastId},
          ${language},
          ${copy.headline},
          ${copy.summary},
          ${copy.toneLine},
          array['Provider synced fixture data. Ask the Seer for a fresh AI readout.']::text[],
          'Forecasts are for entertainment and sports analysis only. No betting advice.'
        )
        on conflict (forecast_id, language) do update set
          headline = excluded.headline,
          summary = excluded.summary,
          tone_line = excluded.tone_line,
          missing_data_notes = excluded.missing_data_notes,
          disclaimer = excluded.disclaimer;
      `;
    }

    forecasts += 1;
  }

  return {
    source: snapshot.provider,
    competition: snapshot.competition.name,
    season: snapshot.competition.season,
    teams: snapshot.teams.length,
    matches: snapshot.matches.length,
    placeholderMatches,
    venuesMapped,
    forecasts,
    fetchedAt: snapshot.fetchedAt,
  };
}

function shouldPreserveModelForecast(row: ExistingForecastLockRow) {
  const status = row.status?.toLowerCase();

  return (
    row.home_score !== null ||
    row.away_score !== null ||
    status === "live" ||
    status === "final" ||
    status === "finished" ||
    status === "ft"
  );
}

export async function applyVenueOverrides(
  overrides: VenueOverride[],
): Promise<VenueOverrideResult> {
  const connection = await getSql();

  if (!connection?.sql) {
    throw new Error("DATABASE_URL is required for venue overrides.");
  }

  const sql = connection.sql;
  const venuesSeeded = await upsertWorldCupVenues(sql);
  const validVenueSlugs = new Set([
    "provider-venue-tbd",
    ...worldCupVenues.map((venue) => venue.slug),
  ]);
  const invalidVenues = overrides.filter(
    (override) => !validVenueSlugs.has(override.venueSlug),
  );
  const validOverrides = overrides.filter((override) =>
    validVenueSlugs.has(override.venueSlug),
  );
  const missingMatches: VenueOverride[] = [];
  let matchesUpdated = 0;

  for (const override of validOverrides) {
    const updatedRows = await sql`
      update matches
      set
        venue_id = (select id from venues where slug = ${override.venueSlug}),
        updated_at = now()
      where external_id = ${override.matchId}
      returning external_id;
    `;

    if (updatedRows.length === 0) {
      missingMatches.push(override);
    } else {
      matchesUpdated += updatedRows.length;
    }
  }

  return {
    overridesReceived: overrides.length,
    venuesSeeded,
    matchesUpdated,
    invalidVenues,
    missingMatches,
    fetchedAt: new Date().toISOString(),
  };
}

export async function getModelControlDashboard(): Promise<ModelControlDashboard> {
  const connection = await getSql();
  const generatedAt = new Date().toISOString();

  if (!connection) {
    return emptyModelControlDashboard("missing-database-url", generatedAt);
  }

  if (!connection.sql) {
    return emptyModelControlDashboard(connection.reason, generatedAt);
  }

  const sql = connection.sql;

  try {
    await ensurePlayerModelSchema(sql);
    await ensureForecastLedgerSchema(sql);
    await seedKeyPlayerWatchlist(sql);

    const playerRows = (await sql`
      select
        players.slug,
        players.name,
        teams.name as team_name,
        teams.code as team_code,
        players.role,
        players.spark_rating,
        players.importance,
        players.availability_status,
        players.availability_note,
        players.yellow_cards,
        players.red_cards,
        players.is_suspended,
        players.lineup_status,
        players.lineup_confirmed_at,
        players.age,
        players.minutes_recent
      from players
      join teams on teams.id = players.team_id
      where players.is_key_player = true
      order by teams.name, players.importance desc, players.spark_rating desc nulls last, players.name;
    `) as unknown as ModelControlPlayerRow[];
    const forecastRows = (await sql`
      select
        matches.external_id as match_id,
        matches.stage,
        matches.group_name,
        matches.status,
        matches.starts_at,
        home_team.name as home_name,
        home_team.code as home_code,
        away_team.name as away_name,
        away_team.code as away_code,
        forecasts.version,
        forecasts.created_at,
        forecasts.home_win_probability,
        forecasts.draw_probability,
        forecasts.away_win_probability,
        forecasts.projected_score,
        forecasts.confidence,
        forecasts.chaos,
        forecasts.source_payload
      from forecasts
      join matches on matches.id = forecasts.match_id
      join teams home_team on home_team.id = matches.home_team_id
      join teams away_team on away_team.id = matches.away_team_id
      where matches.external_id like 'fd-%'
      order by forecasts.created_at desc nulls last, matches.starts_at desc nulls last
      limit 18;
    `) as unknown as ModelControlForecastRow[];

    return {
      source: "database",
      reason: "database",
      generatedAt,
      players: playerRows.map(toModelControlPlayer),
      forecasts: forecastRows.map(toModelControlForecastVersion),
    };
  } catch (error) {
    console.error("MatchSeer model control read failed", error);
    return emptyModelControlDashboard("database-query-failed", generatedAt);
  }
}

export async function applyPlayerAvailabilityUpdates(
  updates: PlayerAvailabilityUpdate[],
): Promise<PlayerAvailabilityUpdateResult> {
  const connection = await getSql();

  if (!connection?.sql) {
    throw new Error("DATABASE_URL is required for player availability updates.");
  }

  const sql = connection.sql;
  const skippedPlayers: PlayerAvailabilityUpdate[] = [];
  let playersUpdated = 0;

  await ensurePlayerModelSchema(sql);
  await seedKeyPlayerWatchlist(sql);

  for (const update of updates) {
    const normalized = normalizePlayerAvailabilityUpdate(update);

    if (!normalized) {
      skippedPlayers.push(update);
      continue;
    }

    const updatedRows = await sql`
      update players
      set
        availability_status = ${normalized.availabilityStatus},
        availability_note = ${normalized.availabilityNote},
        yellow_cards = ${normalized.yellowCards},
        red_cards = ${normalized.redCards},
        is_suspended = ${normalized.isSuspended},
        lineup_status = ${normalized.lineupStatus},
        lineup_confirmed_at = case
          when ${isConfirmedLineupStatus(normalized.lineupStatus)}
            and players.lineup_status is distinct from ${normalized.lineupStatus}
            then now()
          when not ${isConfirmedLineupStatus(normalized.lineupStatus)}
            then null
          else players.lineup_confirmed_at
        end,
        minutes_recent = ${normalized.minutesRecent}
      where slug = ${normalized.slug}
        and is_key_player = true
      returning slug;
    `;

    if (updatedRows.length === 0) {
      skippedPlayers.push(normalized);
    } else {
      playersUpdated += updatedRows.length;
    }
  }

  return {
    updatesReceived: updates.length,
    playersUpdated,
    skippedPlayers,
    fetchedAt: new Date().toISOString(),
  };
}

export async function applyMarketPulseUpdates(
  updates: MarketPulseUpdate[],
  source: "polymarket" | "manual" = "polymarket",
): Promise<MarketPulseSyncResult> {
  const connection = await getSql();

  if (!connection?.sql) {
    throw new Error("DATABASE_URL is required for market pulse updates.");
  }

  const sql = connection.sql;
  let pulsesSaved = 0;
  let skipped = 0;
  let manualProtected = 0;
  const skippedMatchIds: string[] = [];

  await ensureForecastLedgerSchema(sql);

  for (const update of updates) {
    const normalized = normalizeMarketPulseUpdate({
      ...update,
      source: update.source ?? source,
    });

    if (!normalized) {
      skipped += 1;
      if (typeof update.matchId === "string" && update.matchId.trim()) {
        skippedMatchIds.push(update.matchId.trim());
      }
      continue;
    }

    const matchId = normalized.matchId;
    const incomingSource =
      normalized.source === "manual" ? "manual" : "polymarket";
    const matchIds = marketPulseMatchIdentifiers(matchId);
    const targetRows = await sql`
      select
        forecasts.id,
        forecasts.match_id,
        forecasts.source_payload -> 'marketPulse' ->> 'source' as pulse_source,
        exists (
          select 1
          from forecasts manual_forecasts
          where manual_forecasts.match_id = forecasts.match_id
            and manual_forecasts.source_payload -> 'marketPulse' ->> 'source' = 'manual'
        ) as has_manual_pulse
      from forecasts
      join matches on matches.id = forecasts.match_id
      where matches.external_id = ${matchIds.matchId}
        or matches.external_id = ${matchIds.externalMatchId}
        or forecasts.source_payload ->> 'providerMatchId' = ${matchIds.matchId}
        or forecasts.source_payload ->> 'providerMatchId' = ${matchIds.providerMatchId}
      order by forecasts.version desc, forecasts.created_at desc
      limit 1;
    `;

    const target = targetRows[0] as
      | {
          id?: string;
          match_id?: string;
          pulse_source?: string | null;
          has_manual_pulse?: boolean;
        }
      | undefined;

    if (!target?.id || !target.match_id) {
      skipped += 1;
      skippedMatchIds.push(normalized.matchId);
      continue;
    }

    if (
      incomingSource === "polymarket" &&
      (target.has_manual_pulse ||
        !shouldApplyMarketPulseUpdate(target.pulse_source, incomingSource))
    ) {
      skipped += 1;
      manualProtected += 1;
      skippedMatchIds.push(normalized.matchId);
      continue;
    }

    const rows = await sql`
      update forecasts
      set source_payload =
        coalesce(source_payload, '{}'::jsonb) ||
        jsonb_build_object('marketPulse', ${JSON.stringify(normalized)}::jsonb)
      where match_id = ${target.match_id}
      returning id;
    `;

    if (rows.length === 0) {
      skipped += 1;
      skippedMatchIds.push(normalized.matchId);
    } else {
      pulsesSaved += 1;
    }
  }

  return {
    source,
    updatesReceived: updates.length,
    pulsesSaved,
    skipped,
    manualProtected,
    skippedMatchIds: skippedMatchIds.slice(0, 12),
    fetchedAt: new Date().toISOString(),
  };
}

export function marketPulseMatchIdentifiers(matchId: string) {
  const cleanMatchId = matchId.trim();

  return {
    matchId: cleanMatchId,
    externalMatchId: cleanMatchId.startsWith("fd-")
      ? cleanMatchId
      : `fd-${cleanMatchId}`,
    providerMatchId: cleanMatchId.startsWith("fd-")
      ? cleanMatchId.slice(3)
      : cleanMatchId,
  };
}

export function shouldApplyMarketPulseUpdate(
  existingSource: string | null | undefined,
  incomingSource: "polymarket" | "manual",
) {
  return incomingSource === "manual" || existingSource !== "manual";
}

export async function listVenueMappingCandidates({
  includeMapped = false,
}: {
  includeMapped?: boolean;
} = {}) {
  const connection = await getSql();

  if (!connection?.sql) {
    throw new Error("DATABASE_URL is required for venue mapping candidates.");
  }

  const rows = (await connection.sql`
    select
      matches.external_id as match_id,
      home_team.name as home_name,
      away_team.name as away_name,
      matches.stage,
      matches.group_name,
      matches.status,
      matches.starts_at,
      venues.slug as venue_slug,
      venues.name as venue_name,
      venues.city as venue_city,
      pulse.pulse_captured_at,
      pulse.pulse_source
    from matches
    join teams home_team on home_team.id = matches.home_team_id
    join teams away_team on away_team.id = matches.away_team_id
    join venues on venues.id = matches.venue_id
    left join lateral (
      select
        forecasts.source_payload -> 'marketPulse' ->> 'capturedAt' as pulse_captured_at,
        forecasts.source_payload -> 'marketPulse' ->> 'source' as pulse_source
      from forecasts
      where forecasts.match_id = matches.id
        and forecasts.source_payload -> 'marketPulse' is not null
      order by forecasts.version desc, forecasts.created_at desc
      limit 1
    ) pulse on true
    where matches.external_id like 'fd-%'
      and (${includeMapped} or venues.slug = 'provider-venue-tbd')
    order by matches.starts_at nulls last, matches.external_id;
  `) as unknown as VenueMappingCandidateRow[];

  return rows.map((row) => ({
    matchId: row.match_id,
    home: row.home_name,
    away: row.away_name,
    group: normalizeMatchPhase(row.stage, row.group_name),
    status: row.status,
    startsAt: row.starts_at ? new Date(row.starts_at).toISOString() : null,
    currentVenue: {
      slug: row.venue_slug,
      name: row.venue_name,
      city: row.venue_city,
    },
    lastPulse: row.pulse_captured_at
      ? { capturedAt: row.pulse_captured_at, source: row.pulse_source ?? null }
      : null,
  })) satisfies VenueMappingCandidate[];
}

export async function syncWorldCupWeather(): Promise<WeatherSyncResult> {
  const connection = await getSql();

  if (!connection?.sql) {
    throw new Error("DATABASE_URL is required for weather sync.");
  }

  const sql = connection.sql;
  const venuesSeeded = await upsertWorldCupVenues(sql);
  const rows = (await sql`
    select
      matches.id as match_id,
      venues.slug as venue_slug,
      venues.latitude,
      venues.longitude
    from matches
    join venues on venues.id = matches.venue_id
    where venues.latitude is not null
      and venues.longitude is not null;
  `) as unknown as WeatherVenueRow[];

  if (rows.length === 0) {
    return {
      source: "open-meteo",
      venuesSeeded,
      venuesWithMatches: 0,
      matchesUpdated: 0,
      fetchedAt: new Date().toISOString(),
      skippedReason:
        "No synced matches have a known World Cup venue yet. Run football-data sync again when venue fields are available.",
    };
  }

  const rowsByVenue = new Map<string, WeatherVenueRow[]>();

  for (const row of rows) {
    const venueRows = rowsByVenue.get(row.venue_slug) ?? [];
    venueRows.push(row);
    rowsByVenue.set(row.venue_slug, venueRows);
  }

  let matchesUpdated = 0;

  for (const venueRows of rowsByVenue.values()) {
    const firstRow = venueRows[0];
    const weather = await fetchCurrentVenueWeather({
      latitude: Number(firstRow.latitude),
      longitude: Number(firstRow.longitude),
    });

    for (const row of venueRows) {
      await sql`
        insert into weather_snapshots (
          match_id,
          temperature_c,
          wind_kph,
          rain_probability,
          humidity,
          summary
        )
        values (
          ${row.match_id},
          ${weather.temperatureC},
          ${weather.windKph},
          ${weather.precipitationMm},
          ${weather.humidity},
          ${weather.summary}
        );
      `;
      matchesUpdated += 1;
    }
  }

  return {
    source: "open-meteo",
    venuesSeeded,
    venuesWithMatches: rowsByVenue.size,
    matchesUpdated,
    fetchedAt: new Date().toISOString(),
  };
}

async function upsertWorldCupVenues(sql: NeonQuery) {
  await sql`
    insert into venues (slug, name, city, country)
    values ('provider-venue-tbd', 'Venue TBD', 'City TBD', null)
    on conflict (slug) do update set
      name = excluded.name,
      city = excluded.city,
      country = excluded.country;
  `;

  for (const venue of worldCupVenues) {
    await sql`
      insert into venues (slug, name, city, country, latitude, longitude)
      values (
        ${venue.slug},
        ${venue.name},
        ${venue.city},
        ${venue.country},
        ${venue.latitude},
        ${venue.longitude}
      )
      on conflict (slug) do update set
        name = excluded.name,
        city = excluded.city,
        country = excluded.country,
        latitude = excluded.latitude,
        longitude = excluded.longitude;
    `;
  }

  return worldCupVenues.length + 1;
}

export function getDatabaseReadiness() {
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

  return {
    hasDatabaseUrl,
    driver: hasDatabaseUrl
      ? "@neondatabase/serverless"
      : "waiting-for-database-url",
    note: hasDatabaseUrl
      ? "The API reads Neon/provider data only. If the database is unavailable, the public page keeps its featured readout fallback."
      : fallbackNote,
  };
}

function unavailableResult(reason: DataSourceReason): MatchListResult {
  return {
    source: "database-unavailable",
    reason,
    matches: [],
  };
}

async function fetchMatchRows(sql: NeonQuery, options: MatchListOptions = {}) {
  const rowLimit =
    typeof options.limit === "number" && Number.isFinite(options.limit)
      ? Math.max(1, Math.min(72, Math.round(options.limit)))
      : null;
  const prioritizeUpcoming = Boolean(options.prioritizeUpcoming);

  return (await sql`
    with target_matches as (
      select matches.id
      from matches
      order by
        case
          when ${prioritizeUpcoming}
            and lower(matches.status) <> 'final'
            and (
              matches.starts_at is null
              or matches.starts_at >= now() - interval '2 hours'
            )
          then 0
          else 1
        end,
        matches.starts_at nulls last,
        matches.external_id
      limit ${rowLimit}
    ),
    latest_weather as (
      select distinct on (weather_snapshots.match_id)
        weather_snapshots.match_id,
        weather_snapshots.temperature_c,
        weather_snapshots.wind_kph,
        weather_snapshots.summary
      from weather_snapshots
      join target_matches on target_matches.id = weather_snapshots.match_id
      order by weather_snapshots.match_id, weather_snapshots.captured_at desc
    ),
    latest_forecast as (
      select distinct on (forecasts.match_id)
        forecasts.id,
        forecasts.match_id,
        forecasts.version,
        forecasts.home_win_probability,
        forecasts.draw_probability,
        forecasts.away_win_probability,
        forecasts.projected_score,
        forecasts.confidence,
        forecasts.chaos,
        forecasts.source_payload,
        forecasts.created_at
      from forecasts
      join target_matches on target_matches.id = forecasts.match_id
      order by forecasts.match_id, forecasts.version desc, forecasts.created_at desc
    ),
    latest_market_pulse as (
      select distinct on (forecasts.match_id)
        forecasts.match_id,
        forecasts.source_payload -> 'marketPulse' as market_pulse_payload
      from forecasts
      join target_matches on target_matches.id = forecasts.match_id
      where forecasts.source_payload -> 'marketPulse' is not null
      order by
        forecasts.match_id,
        case
          when forecasts.source_payload -> 'marketPulse' ->> 'source' = 'manual' then 0
          else 1
        end,
        forecasts.source_payload -> 'marketPulse' ->> 'capturedAt' desc nulls last,
        forecasts.version desc,
        forecasts.created_at desc
    ),
    forecast_reason_groups as (
      select
        forecast_id,
        jsonb_agg(explanation order by weight desc nulls last, label) as factors
      from forecast_factors
      join latest_forecast on latest_forecast.id = forecast_factors.forecast_id
      group by forecast_id
    ),
    interpretation_groups as (
      select
        forecast_id,
        jsonb_object_agg(language, summary) as tone
      from forecast_interpretations
      join latest_forecast on latest_forecast.id = forecast_interpretations.forecast_id
      group by forecast_id
    )
    select
      matches.external_id as id,
      matches.status,
      matches.starts_at,
      matches.stage,
      matches.group_name,
      matches.home_score,
      matches.away_score,
      venues.name as venue_name,
      venues.city as venue_city,
      home_team.name as home_name,
      home_team.code as home_code,
      home_team.color as home_color,
      home_team.record as home_record,
      home_team.form as home_form,
      home_team.attack as home_attack,
      home_team.control as home_control,
      home_team.defense as home_defense,
      home_team.set_pieces as home_set_pieces,
      away_team.name as away_name,
      away_team.code as away_code,
      away_team.color as away_color,
      away_team.record as away_record,
      away_team.form as away_form,
      away_team.attack as away_attack,
      away_team.control as away_control,
      away_team.defense as away_defense,
      away_team.set_pieces as away_set_pieces,
      referees.name as referee_name,
      referees.cards_per_match,
      latest_weather.temperature_c,
      latest_weather.wind_kph,
      latest_weather.summary as weather_summary,
      latest_forecast.home_win_probability,
      latest_forecast.draw_probability,
      latest_forecast.away_win_probability,
      latest_forecast.version as forecast_version,
      latest_forecast.created_at as forecast_created_at,
      latest_forecast.projected_score,
      latest_forecast.confidence,
      latest_forecast.chaos,
      latest_forecast.source_payload,
      latest_market_pulse.market_pulse_payload,
      interpretation_groups.tone,
      forecast_reason_groups.factors,
      '[]'::jsonb as players
    from matches
    join target_matches on target_matches.id = matches.id
    join teams home_team on home_team.id = matches.home_team_id
    join teams away_team on away_team.id = matches.away_team_id
    join venues on venues.id = matches.venue_id
    left join referees on referees.id = matches.referee_id
    left join latest_weather on latest_weather.match_id = matches.id
    left join latest_forecast on latest_forecast.match_id = matches.id
    left join latest_market_pulse on latest_market_pulse.match_id = matches.id
    left join forecast_reason_groups on forecast_reason_groups.forecast_id = latest_forecast.id
    left join interpretation_groups on interpretation_groups.forecast_id = latest_forecast.id
    order by
      case
        when ${prioritizeUpcoming}
          and lower(matches.status) <> 'final'
          and (
            matches.starts_at is null
            or matches.starts_at >= now() - interval '2 hours'
          )
        then 0
        else 1
      end,
      matches.starts_at nulls last,
      matches.external_id
    limit ${rowLimit};
  `) as unknown as DatabaseMatchRow[];
}

export async function recordAiRequestAudit({
  matchId,
  model,
  requestPayload,
  responsePayload,
  status,
}: {
  matchId: string;
  model: string;
  requestPayload: unknown;
  responsePayload: unknown | null;
  status: string;
}) {
  const connection = await getSql();

  if (!connection?.sql) {
    return false;
  }

  const serializedResponse =
    responsePayload === null ? null : JSON.stringify(responsePayload);

  try {
    await connection.sql`
      insert into ai_request_audits (
        forecast_id,
        model,
        request_payload,
        response_payload,
        status
      )
      values (
        (
          select forecasts.id
          from forecasts
          join matches on matches.id = forecasts.match_id
          where matches.external_id = ${matchId}
          order by forecasts.version desc, forecasts.created_at desc
          limit 1
        ),
        ${model},
        ${JSON.stringify(requestPayload)}::jsonb,
        ${serializedResponse}::jsonb,
        ${status}
      );
    `;

    return true;
  } catch (error) {
    console.error("MatchSeer AI audit write failed", error);
    return false;
  }
}

export async function saveForecastInterpretation({
  matchId,
  interpretation,
}: {
  matchId: string;
  interpretation: ForecastInterpretation;
}) {
  const connection = await getSql();

  if (!connection?.sql) {
    return false;
  }

  try {
    const rows = await connection.sql`
      insert into forecast_interpretations (
        forecast_id,
        language,
        headline,
        summary,
        tone_line,
        missing_data_notes,
        disclaimer
      )
      values (
        (
          select forecasts.id
          from forecasts
          join matches on matches.id = forecasts.match_id
          where matches.external_id = ${matchId}
          order by forecasts.version desc, forecasts.created_at desc
          limit 1
        ),
        ${interpretation.language},
        ${interpretation.headline},
        ${interpretation.summary},
        ${interpretation.toneLine},
        coalesce(
          (
            select array_agg(note)
            from jsonb_array_elements_text(
              ${JSON.stringify(interpretation.missingDataNotes)}::jsonb
            ) as notes(note)
          ),
          array[]::text[]
        ),
        ${interpretation.disclaimer}
      )
      on conflict (forecast_id, language) do update set
        headline = excluded.headline,
        summary = excluded.summary,
        tone_line = excluded.tone_line,
        missing_data_notes = excluded.missing_data_notes,
        disclaimer = excluded.disclaimer
      returning id;
    `;

    return rows.length > 0;
  } catch (error) {
    console.error("MatchSeer forecast interpretation save failed", error);
    return false;
  }
}

function toMatchSummary(row: DatabaseMatchRow): MatchSummary {
  const status = toMatchStatus(row.status);
  const reasons = toReasons(row.factors);
  const sourcePayload = sourcePayloadWithRecoveredMarketPulse(
    row.source_payload,
    row.market_pulse_payload,
  );
  const weatherMood = toLanguageRecord(
    row.weather_summary ?? "Weather data pending.",
  );
  const projectedScore = normalizeProjectedScore(
    publishedProjectedScoreCorrections[row.id] ?? row.projected_score,
  );
  const storedProbabilities = normalizeProbabilityTriplet({
    home: toNumber(row.home_win_probability),
    draw: toNumber(row.draw_probability),
    away: toNumber(row.away_win_probability),
  });
  const storedMarketNudge = toMarketPulseNudge(sourcePayload);
  const displayMarketNudge = storedMarketNudge
    ? null
    : applyMarketPulseProbabilityNudge({
        probabilities: storedProbabilities,
        marketPulse: sourcePayload?.marketPulse,
      });
  const marketAdjustedProbabilities =
    displayMarketNudge?.probabilities ?? storedProbabilities;
  const modifiers = readPayloadRecord(sourcePayload?.modifiers);
  const hasStoredLiveModel = Boolean(
    readPayloadRecord(sourcePayload?.liveModel) ??
      readPayloadRecord(modifiers?.liveModel),
  );
  const confidence = toNumber(row.confidence);
  const chaos = toNumber(row.chaos);
  const displayLiveModel = hasStoredLiveModel
    ? null
    : applyLiveMatchProbabilityNudge({
        probabilities: marketAdjustedProbabilities,
        status: row.status,
        homeScore: row.home_score,
        awayScore: row.away_score,
        confidence,
        chaos,
      });
  const displayProbabilities =
    displayLiveModel?.probabilities ?? marketAdjustedProbabilities;
  const displayConfidence = displayLiveModel
    ? clamp(confidence + displayLiveModel.confidenceDelta, 35, 90)
    : confidence;
  const displayChaos = displayLiveModel
    ? clamp(chaos + displayLiveModel.chaosDelta, 30, 90)
    : chaos;
  const displayMarketPulseNudge =
    storedMarketNudge ??
    (displayMarketNudge?.applied
      ? {
          applied: displayMarketNudge.applied,
          weight: displayMarketNudge.weight,
          cap: displayMarketNudge.cap,
          homeDelta: displayMarketNudge.deltas.home,
          drawDelta: displayMarketNudge.deltas.draw,
          awayDelta: displayMarketNudge.deltas.away,
          summary: displayMarketNudge.summary,
        }
      : null);
  const homeForecast = displayProbabilities.home;
  const drawForecast = displayProbabilities.draw;
  const awayForecast = displayProbabilities.away;
  const goalModel = toGoalModelForecast(sourcePayload);
  const knockout = toKnockoutForecast(sourcePayload);
  const marketPulse = toMarketPulse(sourcePayload, {
    homeForecast,
    drawForecast,
    awayForecast,
    confidence: displayConfidence,
    chaos: displayChaos,
    homeName: row.home_name,
    awayName: row.away_name,
    nudge: displayMarketPulseNudge,
  });
  const homeIsPlaceholder = isPlaceholderTeamRow(row.home_record, row.home_code);
  const awayIsPlaceholder = isPlaceholderTeamRow(row.away_record, row.away_code);
  const forecastIsPending =
    homeIsPlaceholder || awayIsPlaceholder || row.forecast_version === null;
  const phase = normalizeMatchPhase(row.stage, row.group_name);

  return {
    id: row.id,
    status,
    startsAt: row.starts_at ? new Date(row.starts_at).toISOString() : null,
    stage: row.stage,
    group: phase,
    time: toMatchTime(status, row.starts_at),
    venue: row.venue_name,
    city: row.venue_city,
    score:
      row.home_score !== null && row.away_score !== null
        ? `${row.home_score} - ${row.away_score}`
        : undefined,
    home: {
      name: row.home_name,
      code: row.home_code,
      color: row.home_color,
      record: row.home_record ?? "Form pending",
      form: row.home_form ?? [],
      attack: toNumber(row.home_attack),
      control: toNumber(row.home_control),
      defense: toNumber(row.home_defense),
      setPieces: toNumber(row.home_set_pieces),
      isPlaceholder: homeIsPlaceholder,
    },
    away: {
      name: row.away_name,
      code: row.away_code,
      color: row.away_color,
      record: row.away_record ?? "Form pending",
      form: row.away_form ?? [],
      attack: toNumber(row.away_attack),
      control: toNumber(row.away_control),
      defense: toNumber(row.away_defense),
      setPieces: toNumber(row.away_set_pieces),
      isPlaceholder: awayIsPlaceholder,
    },
    forecast: forecastIsPending
      ? pendingForecast(row.home_name, row.away_name, phase)
      : {
          home: homeForecast,
          draw: drawForecast,
          away: awayForecast,
          version: toNumber(row.forecast_version),
          generatedAt: row.forecast_created_at
            ? new Date(row.forecast_created_at).toISOString()
            : null,
          confidence: displayConfidence,
          chaos: displayChaos,
          projected: projectedScore,
          marketPulse,
          goalModel,
          knockout,
          trail: buildPublicSeerTrail({
            awayName: row.away_name,
            homeName: row.home_name,
            marketPulse,
            sourcePayload,
          }),
          tone: {
            ...toLanguageRecord("Forecast copy pending."),
            ...(row.tone ?? {}),
          },
          reasons,
        },
    weather: {
      temp:
        row.temperature_c === null
          ? "Pending"
          : `${Math.round(toNumber(row.temperature_c))}°C`,
      wind:
        row.wind_kph === null
          ? "Pending"
          : `${Math.round(toNumber(row.wind_kph))} km/h`,
      mood: weatherMood,
    },
    referee: {
      name: row.referee_name ?? "TBD",
      cardRisk: toCardRisk(row.cards_per_match),
    },
    players: ENABLE_PLAYER_SPARKS
      ? (row.players ?? []).map((player) => ({
          name: player.name,
          team: player.team,
          role: player.role,
          club: player.club ?? "Club pending",
          league: player.league ?? "League pending",
          spark: toNumber(player.spark),
          note: player.note ?? "Spark pending",
        }))
      : [],
  };
}

export function sourcePayloadWithRecoveredMarketPulse(
  sourcePayload:
    | ExistingForecastLockRow["source_payload"]
    | DatabaseMatchRow["source_payload"]
    | undefined,
  recoveredPulse: unknown,
) {
  const payload = parseJsonPayload(sourcePayload);
  const recovered = readPayloadRecord(recoveredPulse);

  if (!recovered) {
    return payload;
  }

  if (readPayloadRecord(payload?.marketPulse)) {
    return payload;
  }

  return {
    ...(payload ?? {}),
    marketPulse: recovered,
  };
}

function toGoalModelForecast(
  sourcePayload: Record<string, unknown> | null,
): GoalModelForecast | null {
  const rawGoalModel = readPayloadRecord(sourcePayload?.goalModel);

  if (!rawGoalModel) {
    return null;
  }

  const projectedScore = readPayloadString(rawGoalModel.projectedScore);

  if (!projectedScore) {
    return null;
  }

  return {
    homeXg: roundXg(readPayloadNumber(rawGoalModel.homeXg) ?? 0),
    awayXg: roundXg(readPayloadNumber(rawGoalModel.awayXg) ?? 0),
    totalXg: roundXg(readPayloadNumber(rawGoalModel.totalXg) ?? 0),
    homeCleanSheet: clampInteger(rawGoalModel.homeCleanSheet, 0, 100),
    awayCleanSheet: clampInteger(rawGoalModel.awayCleanSheet, 0, 100),
    over25: clampInteger(rawGoalModel.over25, 0, 100),
    under25: clampInteger(rawGoalModel.under25, 0, 100),
    bothTeamsScore: clampInteger(rawGoalModel.bothTeamsScore, 0, 100),
    projectedScore,
    signals: readPayloadArray(rawGoalModel.signals).flatMap((signal) => {
      const record = readPayloadRecord(signal);
      const id = readPayloadString(record?.id);
      const label = readPayloadRecord(record?.label);
      const text = readPayloadRecord(record?.text);
      const value = readPayloadNumber(record?.value);
      const tone = readPayloadString(record?.tone);

      if (
        !id ||
        value === null ||
        (tone !== "over" &&
          tone !== "under" &&
          tone !== "clean" &&
          tone !== "balanced")
      ) {
        return [];
      }

      const signalTone: GoalModelForecast["signals"][number]["tone"] = tone;
      const englishLabel = readPayloadString(label?.en) ?? "Goal model";
      const englishText =
        readPayloadString(text?.en) ?? "The xG model keeps this goal script live.";

      return [
        {
          id,
          label: {
            en: englishLabel,
            es: readPayloadString(label?.es) ?? englishLabel,
            fr: readPayloadString(label?.fr) ?? englishLabel,
          },
          value: clampInteger(value, 0, 100),
          tone: signalTone,
          text: {
            en: englishText,
            es: readPayloadString(text?.es) ?? englishText,
            fr: readPayloadString(text?.fr) ?? englishText,
          },
        },
      ];
    }),
  };
}

function toKnockoutForecast(
  sourcePayload: Record<string, unknown> | null,
): KnockoutForecast | null {
  const rawKnockout = readPayloadRecord(sourcePayload?.knockout);

  if (!rawKnockout) {
    return null;
  }

  const projectedAdvancer = readPayloadString(rawKnockout.projectedAdvancer);

  if (projectedAdvancer !== "home" && projectedAdvancer !== "away") {
    return null;
  }

  const phase =
    readPayloadString(rawKnockout.phase) ??
    readPayloadString(sourcePayload?.phase) ??
    "Knockout";
  const regulationDraw = clampInteger(
    readPayloadNumber(rawKnockout.regulationDraw) ??
      readPayloadNumber(rawKnockout.extraTime),
    0,
    100,
  );
  const extraTime = clampInteger(
    readPayloadNumber(rawKnockout.extraTime) ?? regulationDraw,
    0,
    100,
  );
  const penalties = clampInteger(readPayloadNumber(rawKnockout.penalties), 0, 100);
  const homeAdvance = clampInteger(readPayloadNumber(rawKnockout.homeAdvance), 0, 100);
  const awayAdvance = clampInteger(readPayloadNumber(rawKnockout.awayAdvance), 0, 100);
  const summary = readPayloadRecord(rawKnockout.summary);
  const fallbackSummary = `${phase} cannot end level; the draw lane means deadlocked after 90 minutes.`;

  return {
    phase,
    regulationDraw,
    extraTime,
    penalties,
    homeAdvance,
    awayAdvance,
    projectedAdvancer,
    summary: {
      en: readPayloadString(summary?.en) ?? fallbackSummary,
      es: readPayloadString(summary?.es) ?? readPayloadString(summary?.en) ?? fallbackSummary,
      fr: readPayloadString(summary?.fr) ?? readPayloadString(summary?.en) ?? fallbackSummary,
    },
  };
}

function toMarketPulse(
  sourcePayload:
    | DatabaseMatchRow["source_payload"]
    | Record<string, unknown>
    | null,
  base: {
    homeForecast: number;
    drawForecast: number;
    awayForecast: number;
    confidence: number;
    chaos: number;
    homeName: string;
    awayName: string;
    nudge?: MarketPulse["nudge"] | null;
  },
): MarketPulse | null {
  const payload = parseJsonPayload(sourcePayload);
  const rawPulse = readPayloadRecord(payload?.marketPulse);

  if (!rawPulse) {
    return null;
  }

  const rawHome = readPayloadNumber(rawPulse.home);
  const rawDraw = readPayloadNumber(rawPulse.draw);
  const rawAway = readPayloadNumber(rawPulse.away);

  if (rawHome === null || rawDraw === null || rawAway === null) {
    return null;
  }

  const normalized = normalizePulseProbabilities(rawHome, rawDraw, rawAway);

  if (!hasUsablePulse(normalized)) {
    return null;
  }

  const liquidityScore = clampNumber(
    readPayloadNumber(rawPulse.liquidityScore) ??
      liquidityToTrust(
        readPayloadNumber(rawPulse.liquidity),
        readPayloadNumber(rawPulse.volume),
      ),
    0,
    1,
  );
  const marketLeader = leadingSide(normalized.home, normalized.draw, normalized.away);
  const modelLeader = leadingSide(
    base.homeForecast,
    base.drawForecast,
    base.awayForecast,
  );
  const sortedMarket = [normalized.home, normalized.draw, normalized.away].sort(
    (left, right) => right - left,
  );
  const marketGap = sortedMarket[0] - sortedMarket[1];
  const marketStrength = clampNumber(marketGap / 18, 0.2, 1);
  const trust = liquidityScore * marketStrength;
  const isThin = liquidityScore < 0.25;
  const aligned = marketLeader === modelLeader;
  const confidenceDelta = isThin
    ? 0
    : aligned
      ? Math.round(2 + trust * 8)
      : -Math.round(2 + trust * 7);
  const chaosDelta = isThin
    ? Math.round(1 + marketStrength * 2)
    : aligned
      ? -Math.round(1 + trust * 5)
      : Math.round(2 + trust * 8);
  const adjustedConfidence = clamp(base.confidence + confidenceDelta, 35, 90);
  const adjustedChaos = clamp(base.chaos + chaosDelta, 30, 90);
  const alignment = isThin ? "thin" : aligned ? "aligned" : "split";
  const source =
    rawPulse.source === "manual" || rawPulse.source === "polymarket"
      ? rawPulse.source
      : "polymarket";
  const nudge = base.nudge ?? toMarketPulseNudge(payload);

  return {
    source,
    capturedAt: readPayloadString(rawPulse.capturedAt),
    home: normalized.home,
    draw: normalized.draw,
    away: normalized.away,
    liquidityScore: Math.round(liquidityScore * 100) / 100,
    confidenceDelta,
    chaosDelta,
    adjustedConfidence,
    adjustedChaos,
    alignment,
    leader: marketLeader,
    nudge,
    summary:
      nudge?.applied === true
        ? nudge.summary
        : marketPulseSummary({
            alignment,
            leader: marketLeader,
            homeName: base.homeName,
            awayName: base.awayName,
          }),
  };
}

function toMarketPulseNudge(
  payload: Record<string, unknown> | null,
): MarketPulse["nudge"] {
  const modifiers = readPayloadRecord(payload?.modifiers);
  const rawNudge =
    readPayloadRecord(payload?.marketNudge) ??
    readPayloadRecord(modifiers?.marketNudge);

  if (!rawNudge) {
    return null;
  }

  const deltas = readPayloadRecord(rawNudge.deltas);
  const fallbackSummary = marketProbabilityNudgeSummary({
    applied: readPayloadBoolean(rawNudge.applied),
    deltas: {
      home: Math.round(readPayloadNumber(deltas?.home) ?? 0),
      draw: Math.round(readPayloadNumber(deltas?.draw) ?? 0),
      away: Math.round(readPayloadNumber(deltas?.away) ?? 0),
    },
    cap: Math.round(readPayloadNumber(rawNudge.cap) ?? 0),
  });
  const rawSummary = readPayloadRecord(rawNudge.summary);

  return {
    applied: readPayloadBoolean(rawNudge.applied),
    weight: readPayloadNumber(rawNudge.weight) ?? 0,
    cap: Math.round(readPayloadNumber(rawNudge.cap) ?? 0),
    homeDelta: Math.round(readPayloadNumber(deltas?.home) ?? 0),
    drawDelta: Math.round(readPayloadNumber(deltas?.draw) ?? 0),
    awayDelta: Math.round(readPayloadNumber(deltas?.away) ?? 0),
    summary: {
      en: readPayloadString(rawSummary?.en) ?? fallbackSummary.en,
      es: readPayloadString(rawSummary?.es) ?? fallbackSummary.es,
      fr: readPayloadString(rawSummary?.fr) ?? fallbackSummary.fr,
    },
  };
}

// Pull the raw stored crowd-signal object out of a forecast's source_payload so
// it can be carried into a new forecast version (toMarketPulse re-derives the
// confidence/chaos deltas against the new forecast).
function extractStoredMarketPulse(
  sourcePayload: string | Record<string, unknown> | null | undefined,
): unknown {
  const payload = parseJsonPayload(sourcePayload);

  if (payload && typeof payload === "object") {
    const pulse = (payload as Record<string, unknown>).marketPulse;

    if (pulse && typeof pulse === "object") {
      return pulse;
    }
  }

  return undefined;
}

function normalizePulseProbabilities(home: number, draw: number, away: number) {
  const values = [home, draw, away].map((value) =>
    value <= 1 ? value * 100 : value,
  );
  const total = values.reduce((sum, value) => sum + value, 0);

  if (total <= 0) {
    return { home: 0, draw: 0, away: 0 };
  }

  const normalizedHome = Math.round((values[0] / total) * 100);
  const normalizedDraw = Math.round((values[1] / total) * 100);
  const normalizedAway = clamp(100 - normalizedHome - normalizedDraw, 0, 100);

  return {
    home: normalizedHome,
    draw: normalizedDraw,
    away: normalizedAway,
  };
}

function hasUsablePulse({
  home,
  draw,
  away,
}: {
  home: number;
  draw: number;
  away: number;
}) {
  return home + draw + away > 0;
}

function liquidityToTrust(liquidity: number | null, volume: number | null) {
  const signal = Math.max(liquidity ?? 0, volume ?? 0);

  if (signal <= 0) {
    return 0.35;
  }

  return clampNumber(Math.log10(signal + 1) / 5, 0.12, 1);
}

function leadingSide(
  home: number,
  draw: number,
  away: number,
): "home" | "draw" | "away" {
  if (draw >= home && draw >= away) {
    return "draw";
  }

  return home >= away ? "home" : "away";
}

function normalizeProbabilityTriplet({
  home,
  draw,
  away,
}: ProbabilityTriplet): ProbabilityTriplet {
  const values = [home, draw, away].map((value) =>
    Number.isFinite(value) ? Math.max(0, value) : 0,
  );
  const total = values.reduce((sum, value) => sum + value, 0);

  if (total <= 0) {
    return { home: 34, draw: 33, away: 33 };
  }

  const exact = values.map((value) => (value / total) * 100);
  const rounded = exact.map(Math.floor);
  let remainder = 100 - rounded.reduce((sum, value) => sum + value, 0);
  const order = [0, 1, 2].sort(
    (left, right) =>
      exact[right] - Math.floor(exact[right]) -
      (exact[left] - Math.floor(exact[left])),
  );

  for (const index of order) {
    if (remainder <= 0) {
      break;
    }

    rounded[index] += 1;
    remainder -= 1;
  }

  return {
    home: rounded[0],
    draw: rounded[1],
    away: rounded[2],
  };
}

function probabilityDeltas(
  before: ProbabilityTriplet,
  after: ProbabilityTriplet,
) {
  return {
    home: after.home - before.home,
    draw: after.draw - before.draw,
    away: after.away - before.away,
  };
}

function maxAbsProbabilityDelta(deltas: ProbabilityTriplet) {
  return Math.max(
    Math.abs(deltas.home),
    Math.abs(deltas.draw),
    Math.abs(deltas.away),
  );
}

function rebalanceProbabilityDeltas(
  deltas: ProbabilityTriplet,
  cap: number,
): ProbabilityTriplet {
  const balanced: ProbabilityTriplet = {
    home: clampNumber(deltas.home, -cap, cap),
    draw: clampNumber(deltas.draw, -cap, cap),
    away: clampNumber(deltas.away, -cap, cap),
  };

  for (let attempts = 0; attempts < 8; attempts += 1) {
    const total = probabilitySides.reduce((sum, side) => sum + balanced[side], 0);

    if (Math.abs(total) < 0.001) {
      break;
    }

    const adjustable = probabilitySides.filter((side) =>
      total > 0 ? balanced[side] > -cap : balanced[side] < cap,
    );

    if (adjustable.length === 0) {
      break;
    }

    const adjustment = total / adjustable.length;

    for (const side of adjustable) {
      balanced[side] = clampNumber(balanced[side] - adjustment, -cap, cap);
    }
  }

  return balanced;
}

function shiftProbabilityTriplet(
  probabilities: ProbabilityTriplet,
  deltas: ProbabilityTriplet,
) {
  return normalizeProbabilityTriplet({
    home: probabilities.home + deltas.home,
    draw: probabilities.draw + deltas.draw,
    away: probabilities.away + deltas.away,
  });
}

function emptyProbabilityDeltas(): ProbabilityTriplet {
  return {
    home: 0,
    draw: 0,
    away: 0,
  };
}

export function applyMarketPulseProbabilityNudge({
  probabilities,
  marketPulse,
  maxShift = 6,
  maxWeight = 0.18,
}: {
  probabilities: ProbabilityTriplet;
  marketPulse: unknown;
  maxShift?: number;
  maxWeight?: number;
}) {
  const preNudge = normalizeProbabilityTriplet(probabilities);
  const rawPulse = readPayloadRecord(marketPulse);

  function unchanged(reason: string, market: ProbabilityTriplet | null = null) {
    const deltas = emptyProbabilityDeltas();

    return {
      applied: false,
      reason,
      liquidityScore: 0,
      weight: 0,
      cap: maxShift,
      preNudge,
      market,
      probabilities: preNudge,
      deltas,
      summary: marketProbabilityNudgeSummary({
        applied: false,
        deltas,
        cap: maxShift,
      }),
    };
  }

  if (!rawPulse) {
    return unchanged("no-market-pulse");
  }

  const rawHome = readPayloadNumber(rawPulse.home);
  const rawDraw = readPayloadNumber(rawPulse.draw);
  const rawAway = readPayloadNumber(rawPulse.away);

  if (rawHome === null || rawDraw === null || rawAway === null) {
    return unchanged("incomplete-market-pulse");
  }

  const market = normalizePulseProbabilities(rawHome, rawDraw, rawAway);

  if (!hasUsablePulse(market)) {
    return unchanged("empty-market-pulse", market);
  }

  const liquidityScore = clampNumber(
    readPayloadNumber(rawPulse.liquidityScore) ??
      liquidityToTrust(
        readPayloadNumber(rawPulse.liquidity),
        readPayloadNumber(rawPulse.volume),
      ),
    0,
    1,
  );

  if (liquidityScore < 0.2) {
    return {
      ...unchanged("thin-market-pulse", market),
      liquidityScore: roundModifier(liquidityScore),
    };
  }

  const disagreement =
    maxAbsProbabilityDelta({
      home: market.home - preNudge.home,
      draw: market.draw - preNudge.draw,
      away: market.away - preNudge.away,
    }) / 100;
  const sortedMarket = [market.home, market.draw, market.away].sort(
    (left, right) => right - left,
  );
  const conviction = clampNumber((sortedMarket[0] - sortedMarket[1]) / 30, 0, 1);
  const weight = clampNumber(
    liquidityScore * (0.06 + disagreement * 0.18 + conviction * 0.04),
    0,
    maxWeight,
  );
  const rawDeltas = rebalanceProbabilityDeltas(
    {
      home: (market.home - preNudge.home) * weight,
      draw: (market.draw - preNudge.draw) * weight,
      away: (market.away - preNudge.away) * weight,
    },
    maxShift,
  );
  const nudged = shiftProbabilityTriplet(preNudge, rawDeltas);
  const deltas = probabilityDeltas(preNudge, nudged);
  const applied = maxAbsProbabilityDelta(deltas) > 0;

  return {
    applied,
    reason: applied ? "market-pulse-nudge" : "no-material-market-move",
    liquidityScore: roundModifier(liquidityScore),
    weight: Math.round(weight * 1000) / 1000,
    cap: maxShift,
    preNudge,
    market,
    probabilities: nudged,
    deltas,
    summary: marketProbabilityNudgeSummary({
      applied,
      deltas,
      cap: maxShift,
    }),
  };
}

function marketProbabilityNudgeSummary({
  applied,
  deltas,
  cap,
}: {
  applied: boolean;
  deltas: ProbabilityTriplet;
  cap: number;
}): Record<Language, string> {
  if (!applied) {
    return {
      en: "The crowd murmur was too faint or too evenly split, so the Seer kept the read untouched.",
      es: "El murmullo de la gente fue muy flojo o muy dividido, asi que el Vidente dejo la lectura intacta.",
      fr: "Le murmure du public etait trop faible ou trop partage, donc le voyant a garde la lecture intacte.",
    };
  }

  return {
    en: `The crowd breeze tugged the read ${formatSignedDelta(deltas.home)} home, ${formatSignedDelta(deltas.draw)} draw, ${formatSignedDelta(deltas.away)} away; the Seer kept that omen inside a ${cap}-point circle.`,
    es: `La brisa de la gente movio la lectura ${formatSignedDelta(deltas.home)} local, ${formatSignedDelta(deltas.draw)} empate, ${formatSignedDelta(deltas.away)} visitante; el Vidente guardo ese presagio dentro de un circulo de ${cap} puntos.`,
    fr: `Le souffle du public a tire la lecture ${formatSignedDelta(deltas.home)} domicile, ${formatSignedDelta(deltas.draw)} nul, ${formatSignedDelta(deltas.away)} exterieur; le voyant a garde ce presage dans un cercle de ${cap} points.`,
  };
}

export function applyLiveMatchProbabilityNudge({
  probabilities,
  status,
  homeScore,
  awayScore,
  minute,
  homeRedCards = 0,
  awayRedCards = 0,
  confidence,
  chaos,
}: {
  probabilities: ProbabilityTriplet;
  status?: ForecastLiveState["status"];
  homeScore?: number | null;
  awayScore?: number | null;
  minute?: number | string | null;
  homeRedCards?: number | null;
  awayRedCards?: number | null;
  confidence: number;
  chaos: number;
}) {
  const preLive = normalizeProbabilityTriplet(probabilities);
  const statusLabel = typeof status === "string" ? status.toLowerCase() : "";
  const isLive =
    statusLabel === "live" ||
    statusLabel === "in_play" ||
    statusLabel === "paused";

  function unchanged(reason: string) {
    const deltas = emptyProbabilityDeltas();

    return {
      applied: false,
      reason,
      minute: null as number | null,
      minuteSource: "none" as "feed" | "fallback" | "none",
      homeScore: homeScore ?? null,
      awayScore: awayScore ?? null,
      homeRedCards: homeRedCards ?? 0,
      awayRedCards: awayRedCards ?? 0,
      preLive,
      probabilities: preLive,
      deltas,
      confidenceDelta: 0,
      chaosDelta: 0,
      summary: liveProbabilitySummary({
        applied: false,
        score: null,
        minute: null,
        deltas,
      }),
    };
  }

  if (!isLive) {
    return unchanged("not-live");
  }

  if (homeScore === null || homeScore === undefined || awayScore === null || awayScore === undefined) {
    return unchanged("missing-live-score");
  }

  const parsedMinute = normalizeLiveMinute(minute);
  const liveMinute = parsedMinute ?? 55;
  const minuteSource = parsedMinute === null ? "fallback" : "feed";
  const remainingShare = clampNumber((90 - liveMinute) / 90, 0.04, 0.98);
  const elapsedShare = 1 - remainingShare;
  const scoreGap = homeScore - awayScore;
  const absoluteGap = Math.abs(scoreGap);
  const confidenceLean = clampNumber((confidence - 52) / 42, -0.25, 0.4);
  const chaosBrake = clampNumber((chaos - 58) / 75, -0.12, 0.24);
  const baseBlend = clampNumber(
    0.28 + elapsedShare * 0.58 + confidenceLean - chaosBrake,
    0.18,
    0.88,
  );
  const target =
    scoreGap > 0
      ? liveLeaderTarget({
          leader: "home",
          elapsedShare,
          absoluteGap,
          chaos,
        })
      : scoreGap < 0
        ? liveLeaderTarget({
            leader: "away",
            elapsedShare,
            absoluteGap,
            chaos,
          })
        : liveLevelTarget({
            preLive,
            elapsedShare,
            chaos,
          });
  const blended = normalizeProbabilityTriplet({
    home: preLive.home + (target.home - preLive.home) * baseBlend,
    draw: preLive.draw + (target.draw - preLive.draw) * baseBlend,
    away: preLive.away + (target.away - preLive.away) * baseBlend,
  });
  const redCardAdjusted = applyLiveRedCardSwing({
    probabilities: blended,
    homeRedCards: homeRedCards ?? 0,
    awayRedCards: awayRedCards ?? 0,
    remainingShare,
    chaos,
  });
  const deltas = probabilityDeltas(preLive, redCardAdjusted);
  const cardGap = Math.abs((homeRedCards ?? 0) - (awayRedCards ?? 0));
  const confidenceDelta =
    scoreGap === 0
      ? -Math.round(elapsedShare * 5 + cardGap * 2)
      : Math.round(elapsedShare * 7 + absoluteGap * 2 - cardGap * 1.5);
  const chaosDelta = Math.round(
    (scoreGap === 0 ? 2 + elapsedShare * 4 : -elapsedShare * 3) +
      cardGap * 5 +
      (absoluteGap === 1 && liveMinute < 75 ? 2 : 0),
  );

  return {
    applied: maxAbsProbabilityDelta(deltas) > 0,
    reason: "live-match-state",
    minute: liveMinute,
    minuteSource,
    homeScore,
    awayScore,
    homeRedCards: homeRedCards ?? 0,
    awayRedCards: awayRedCards ?? 0,
    preLive,
    probabilities: redCardAdjusted,
    deltas,
    confidenceDelta,
    chaosDelta,
    summary: liveProbabilitySummary({
      applied: true,
      score: `${homeScore}-${awayScore}`,
      minute: liveMinute,
      deltas,
    }),
  };
}

function normalizeLiveMinute(value: number | string | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return clamp(Math.round(value), 1, 130);
  }

  if (typeof value === "string") {
    const match = value.match(/\d+/);

    if (match) {
      return clamp(Number(match[0]), 1, 130);
    }
  }

  return null;
}

function liveLeaderTarget({
  leader,
  elapsedShare,
  absoluteGap,
  chaos,
}: {
  leader: "home" | "away";
  elapsedShare: number;
  absoluteGap: number;
  chaos: number;
}): ProbabilityTriplet {
  const leaderTarget = clamp(
    Math.round(
      52 +
        elapsedShare * 42 +
        absoluteGap * 8 -
        clampNumber((chaos - 60) * 0.12, -3, 4),
    ),
    56,
    96,
  );
  const trailingFloor = clamp(18 - Math.round(elapsedShare * 14), 2, 18);
  const drawTarget = clamp(
    Math.round((100 - leaderTarget) * (0.6 - elapsedShare * 0.28)),
    2,
    Math.max(2, 100 - leaderTarget - trailingFloor),
  );
  const trailingTarget = Math.max(1, 100 - leaderTarget - drawTarget);

  return leader === "home"
    ? normalizeProbabilityTriplet({
        home: leaderTarget,
        draw: drawTarget,
        away: trailingTarget,
      })
    : normalizeProbabilityTriplet({
        home: trailingTarget,
        draw: drawTarget,
        away: leaderTarget,
      });
}

function liveLevelTarget({
  preLive,
  elapsedShare,
  chaos,
}: {
  preLive: ProbabilityTriplet;
  elapsedShare: number;
  chaos: number;
}): ProbabilityTriplet {
  const drawTarget = clamp(
    Math.round(27 + elapsedShare * 42 - clampNumber((chaos - 60) * 0.08, -2, 4)),
    25,
    74,
  );
  const winMass = 100 - drawTarget;
  const winTotal = Math.max(1, preLive.home + preLive.away);
  const homeShare = preLive.home / winTotal;

  return normalizeProbabilityTriplet({
    home: winMass * homeShare,
    draw: drawTarget,
    away: winMass * (1 - homeShare),
  });
}

function applyLiveRedCardSwing({
  probabilities,
  homeRedCards,
  awayRedCards,
  remainingShare,
  chaos,
}: {
  probabilities: ProbabilityTriplet;
  homeRedCards: number;
  awayRedCards: number;
  remainingShare: number;
  chaos: number;
}) {
  const cardGap = homeRedCards - awayRedCards;

  if (cardGap === 0) {
    return probabilities;
  }

  const swing = clampNumber(
    Math.abs(cardGap) * (4.5 + remainingShare * 4 + Math.max(0, chaos - 58) * 0.03),
    3,
    13,
  );

  if (cardGap > 0) {
    return normalizeProbabilityTriplet({
      home: probabilities.home - swing,
      draw: probabilities.draw + swing * 0.25,
      away: probabilities.away + swing * 0.75,
    });
  }

  return normalizeProbabilityTriplet({
    home: probabilities.home + swing * 0.75,
    draw: probabilities.draw + swing * 0.25,
    away: probabilities.away - swing,
  });
}

function liveProbabilitySummary({
  applied,
  score,
  minute,
  deltas,
}: {
  applied: boolean;
  score: string | null;
  minute: number | null;
  deltas: ProbabilityTriplet;
}): Record<Language, string> {
  if (!applied || !score || minute === null) {
    return {
      en: "No live-state probability adjustment is active.",
      es: "No hay ajuste de probabilidad en vivo activo.",
      fr: "Aucun ajustement de probabilite en direct n'est actif.",
    };
  }

  return {
    en: `Live state (${score}, ${minute}') moved the read ${formatSignedDelta(deltas.home)} home, ${formatSignedDelta(deltas.draw)} draw, ${formatSignedDelta(deltas.away)} away.`,
    es: `El estado en vivo (${score}, ${minute}') movio la lectura ${formatSignedDelta(deltas.home)} local, ${formatSignedDelta(deltas.draw)} empate, ${formatSignedDelta(deltas.away)} visitante.`,
    fr: `L'etat en direct (${score}, ${minute}') a bouge la lecture ${formatSignedDelta(deltas.home)} domicile, ${formatSignedDelta(deltas.draw)} nul, ${formatSignedDelta(deltas.away)} exterieur.`,
  };
}

function marketPulseSummary({
  alignment,
  leader,
  homeName,
  awayName,
}: {
  alignment: MarketPulse["alignment"];
  leader: MarketPulse["leader"];
  homeName: string;
  awayName: string;
}): Record<Language, string> {
  const leaderLabel =
    leader === "home" ? homeName : leader === "away" ? awayName : "a draw";

  if (alignment === "thin") {
    return {
      en: "The crowd is only a murmur, so the Seer keeps that whisper behind the glass.",
      es: "La gente apenas murmura, asi que el Vidente deja ese susurro detras del cristal.",
      fr: "Le public n'est qu'un murmure, donc le voyant garde ce souffle derriere la vitre.",
    };
  }

  if (alignment === "aligned") {
    return {
      en: `The crowd hum leans toward ${leaderLabel}; it warms the read without taking the wheel.`,
      es: `El zumbido de la gente se inclina por ${leaderLabel}; calienta la lectura sin tomar el volante.`,
      fr: `Le bourdonnement du public penche vers ${leaderLabel}; il rechauffe la lecture sans prendre le volant.`,
    };
  }

  return {
    en: `The crowd drums for ${leaderLabel}; the Seer holds the read, but the room gets noisier.`,
    es: `La gente marca el ritmo por ${leaderLabel}; el Vidente sostiene la lectura, pero la sala suena mas fuerte.`,
    fr: `Le public bat le rythme pour ${leaderLabel}; le voyant garde la lecture, mais la salle devient plus bruyante.`,
  };
}

export function buildPublicSeerTrail({
  awayName,
  homeName,
  marketPulse,
  sourcePayload,
}: {
  awayName: string;
  homeName: string;
  marketPulse: MarketPulse | null;
  sourcePayload: Record<string, unknown> | null;
}): TrailSignal[] {
  const modifiers = readPayloadRecord(sourcePayload?.modifiers);
  const signals: TrailSignal[] = readForecastMovementTrail(sourcePayload).map(
    movementTrailToSignal,
  );

  if (modifiers) {
    signals.push(...weatherTrailSignals(readPayloadRecord(modifiers.weather)));

    if (marketPulse) {
      signals.push(marketPulseTrailSignal(marketPulse));
    }

    const knockout = readPayloadRecord(modifiers.knockout);

    if (readPayloadBoolean(knockout?.isKnockout)) {
      signals.push({
        id: "knockout-path",
        label: "Knockout path",
        tone: "steady",
        text: {
          en: "This round cannot end level, so the Seer separates the 90-minute deadlock from the advance path.",
          es: "Esta ronda no puede terminar empatada, así que el Vidente separa el empate a 90 minutos de la ruta para avanzar.",
          fr: "Ce tour ne peut pas finir à égalité, donc le voyant sépare le blocage après 90 minutes de la voie de qualification.",
        },
      });
    }

    const availability = readPayloadRecord(modifiers.availability);
    const impactedPlayers = readPayloadArray(availability?.impactedPlayers);

    if (impactedPlayers.length > 0) {
      signals.push({
        id: "player-watch",
        label: "Player watch",
        tone: "drag",
        text: {
          en: "A key-player warning takes some bite out of the attack.",
          es: "Una alerta de jugador clave le quita filo al ataque.",
          fr: "Une alerte joueur clé retire un peu de mordant à l'attaque.",
        },
      });

      const dependencyPlayer = impactedPlayers.find((player) => {
        const record = readPayloadRecord(player);
        return (readPayloadNumber(record?.dependencyMultiplier) ?? 0) >= 1.05;
      });
      const dependencyName = readPayloadString(
        readPayloadRecord(dependencyPlayer)?.name,
      );

      if (dependencyName) {
        signals.push({
          id: "star-gravity",
          label: "Star gravity",
          tone: "drag",
          text: {
            en: `${dependencyName}'s warning lands louder because the team orbit bends around that spark.`,
            es: `La alerta de ${dependencyName} pesa más porque el equipo gira alrededor de esa chispa.`,
            fr: `L'alerte de ${dependencyName} pèse plus lourd parce que l'équipe tourne autour de cette étincelle.`,
          },
        });
      }
    }

    const fatigue = readPayloadRecord(modifiers.fatigue);

    if (readPayloadArray(fatigue?.impactedPlayers).length > 0) {
      signals.push({
        id: "legs",
        label: "Legs",
        tone: "chaos",
        text: {
          en: "Short rest and heavy legs add late wobble to the trail.",
          es: "El poco descanso y las piernas pesadas meten temblor al cierre.",
          fr: "Le repos court et les jambes lourdes ajoutent du flottement en fin de piste.",
        },
      });
    }

    if ((readPayloadNumber(availability?.confirmedLineupCount) ?? 0) > 0) {
      signals.push({
        id: "lineup-sheet",
        label: "Lineup sheet",
        tone: "steady",
        text: {
          en: "Confirmed lineup signals are in, so the player board is less guessy before kickoff.",
          es: "Ya entraron señales de alineación confirmada, así que el tablero de jugadores llega con menos duda.",
          fr: "Les signaux de composition confirmée sont là, donc le tableau joueurs est moins flou avant le coup d'envoi.",
        },
      });
    }

    const hasSuspensionRisk = impactedPlayers.some((player) => {
      const record = readPayloadRecord(player);
      return readPayloadString(record?.reason)?.includes("suspension");
    });

    if (hasSuspensionRisk) {
      signals.push({
        id: "suspension-risk",
        label: "Suspension risk",
        tone: "chaos",
        text: {
          en: "Card accumulation or suspension risk changes how boldly a key player can live in the match.",
          es: "La acumulación de tarjetas o el riesgo de suspensión cambia la agresividad de un jugador clave.",
          fr: "L'accumulation de cartons ou le risque de suspension change la liberté d'un joueur clé.",
        },
      });
    }

    const bodyCost = readPayloadRecord(modifiers.bodyCost);
    const bodyStatus = readPayloadString(bodyCost?.status);
    const homeBody = readPayloadRecord(bodyCost?.home);
    const awayBody = readPayloadRecord(bodyCost?.away);
    const maxBodyStress = Math.max(
      readPayloadNumber(homeBody?.totalStress) ?? 0,
      readPayloadNumber(awayBody?.totalStress) ?? 0,
    );

    if (bodyStatus === "active" && maxBodyStress >= 0.5) {
      signals.push({
        id: "body-cost",
        label: "Body cost",
        tone: maxBodyStress >= 1.6 ? "chaos" : "drag",
        text: {
          en: "Altitude, travel, heat, or rest load leaves a body-cost mark on the read.",
          es: "La altura, el viaje, el calor o el descanso dejan una marca física en la lectura.",
          fr: "Altitude, voyage, chaleur ou repos court laissent une marque physique sur la lecture.",
        },
      });
    }

    const referee = readPayloadRecord(modifiers.referee);
    const refereeChaos = readPayloadNumber(referee?.chaosDelta) ?? 0;

    if (refereeChaos >= 2) {
      signals.push({
        id: "card-noise",
        label: "Card noise",
        tone: "chaos",
        text: {
          en: "Card rhythm can tilt the room if tempers spike.",
          es: "El ritmo de tarjetas puede inclinar la sala si sube la temperatura.",
          fr: "Le rythme des cartons peut faire basculer la pièce si les nerfs montent.",
        },
      });
    } else if (refereeChaos <= -2) {
      signals.push({
        id: "calm-whistle",
        label: "Calm whistle",
        tone: "steady",
        text: {
          en: "A calmer whistle trims some chaos from the read.",
          es: "Un silbato más tranquilo recorta algo de caos en la lectura.",
          fr: "Un coup de sifflet plus calme retire un peu de chaos à la lecture.",
        },
      });
    }

    const venue = readPayloadRecord(modifiers.venue);
    const homeVenue = readPayloadNumber(venue?.home) ?? 0;
    const awayVenue = readPayloadNumber(venue?.away) ?? 0;

    if (Math.max(homeVenue, awayVenue) >= 2.5) {
      const venueTeam = homeVenue >= awayVenue ? homeName : awayName;

      signals.push({
        id: "venue-pull",
        label: "Venue pull",
        tone: "boost",
        text: {
          en: `${venueTeam} get a little familiarity lift from the room.`,
          es: `${venueTeam} recibe un pequeño empujón de familiaridad del escenario.`,
          fr: `${venueTeam} reçoit un petit soutien de familiarité dans ce décor.`,
        },
      });
    }

    const tournamentForm = readPayloadRecord(modifiers.tournamentForm);
    const formStatus = readPayloadString(tournamentForm?.status);
    const formLeader = readPayloadString(tournamentForm?.leader);
    const formGap = Math.abs(readPayloadNumber(tournamentForm?.formGap) ?? 0);

    if (formStatus === "active" && formLeader && formGap >= 0.45) {
      signals.push({
        id: "tournament-pulse",
        label: "Tournament pulse",
        tone: readPayloadBoolean(tournamentForm?.contradictsPrior) ? "chaos" : "boost",
        text: {
          en: `${formLeader} have put fresher proof on tape, so the read gives that pulse a little room.`,
          es: `${formLeader} ya dejó prueba fresca en la cancha, y la lectura le abre un poco de espacio.`,
          fr: `${formLeader} a montré une preuve fraîche sur le terrain, et la lecture lui laisse un peu de place.`,
        },
      });
    }

    const spotlight = readPayloadRecord(modifiers.spotlight);
    const spotlightGap = Math.abs(
      (readPayloadNumber(spotlight?.home) ?? 0) -
        (readPayloadNumber(spotlight?.away) ?? 0),
    );

    if (spotlightGap >= 1.4) {
      signals.push({
        id: "spotlight",
        label: "Spotlight",
        tone: "boost",
        text: {
          en: "Global attention gives the bigger stage team a small invisible push.",
          es: "La atención global le da al equipo de mayor escenario un pequeño empujón invisible.",
          fr: "L'attention mondiale donne à l'équipe la plus exposée une petite poussée invisible.",
        },
      });
    }

    const vipSpotlight = readPayloadRecord(modifiers.vipSpotlight);

    if (readPayloadBoolean(vipSpotlight?.active)) {
      const strongerTeam = readPayloadString(vipSpotlight?.strongerTeam);

      signals.push({
        id: "vip-spotlight",
        label: "VIP spotlight",
        tone: "boost",
        text: {
          en: strongerTeam
            ? `${strongerTeam} feel a tiny stage-pressure nudge from the bigger room.`
            : "The bigger room adds a tiny stage-pressure nudge to the read.",
          es: strongerTeam
            ? `${strongerTeam} siente un pequeño empujón de escenario grande.`
            : "El escenario grande mete un pequeño empujón de presión en la lectura.",
          fr: strongerTeam
            ? `${strongerTeam} reçoit une petite poussée de grande scène.`
            : "La grande scène ajoute une petite poussée de pression à la lecture.",
        },
      });
    }
  }

  if (signals.length === 0 && marketPulse) {
    signals.push(marketPulseTrailSignal(marketPulse));
  }

  return uniqueTrailSignals(signals).slice(0, 4);
}

function readForecastMovementTrail(
  sourcePayload: Record<string, unknown> | null,
): ForecastMovementTrailItem[] {
  return readPayloadArray(sourcePayload?.movementTrail).flatMap(
    (item): ForecastMovementTrailItem[] => {
      const record = readPayloadRecord(item);
      const id = readPayloadString(record?.id);
      const label = readPayloadString(record?.label);
      const adminText = readPayloadString(record?.adminText);
      const publicText = readPayloadRecord(record?.publicText);
      const tone = readPayloadString(record?.tone);

      if (
        !id ||
        !label ||
        !adminText ||
        !publicText ||
        (tone !== "boost" &&
          tone !== "drag" &&
          tone !== "chaos" &&
          tone !== "steady")
      ) {
        return [];
      }

      return [
        {
          id,
          label,
          tone,
          publicText: {
            en: readPayloadString(publicText.en) ?? adminText,
            es: readPayloadString(publicText.es) ?? readPayloadString(publicText.en) ?? adminText,
            fr: readPayloadString(publicText.fr) ?? readPayloadString(publicText.en) ?? adminText,
          },
          adminText,
          delta: readPayloadRecord(record?.delta) ?? undefined,
        },
      ];
    },
  );
}

function movementTrailToSignal(item: ForecastMovementTrailItem): TrailSignal {
  return {
    id: `movement-${item.id}`,
    label: item.label,
    tone: item.tone,
    text: item.publicText,
  };
}

function weatherTrailSignals(weather: Record<string, unknown> | null): TrailSignal[] {
  if (!weather) {
    return [];
  }

  const signals: TrailSignal[] = [];
  const temperature = readPayloadNumber(weather.temperatureC);
  const humidity = readPayloadNumber(weather.humidity);
  const wind = readPayloadNumber(weather.windKph);
  const daypart = readPayloadString(weather.daypart);
  const summary = readPayloadString(weather.summary)?.toLowerCase() ?? "";
  const gapMultiplier = readPayloadNumber(weather.gapMultiplier) ?? 1;
  const isHumid = (humidity ?? 0) >= 65 || summary.includes("humid") || summary.includes("muggy");

  if (gapMultiplier <= 0.96 && daypart === "day") {
    signals.push({
      id: isHumid ? "humid-drag" : "sun-tax",
      label: isHumid ? "Humid drag" : "Sun tax",
      tone: "drag",
      text: {
        en: isHumid
          ? "Day heat and humidity make the chase heavier and tighten the favorite's edge."
          : "Day heat pulls speed out of the match and gives the underdog more cover.",
        es: isHumid
          ? "El calor de día y la humedad hacen más pesada la persecución y aprietan la ventaja del favorito."
          : "El calor de día le quita velocidad al partido y le da más refugio al chico.",
        fr: isHumid
          ? "La chaleur de jour et l'humidité alourdissent la poursuite et resserrent l'écart du favori."
          : "La chaleur de jour retire de la vitesse au match et couvre un peu plus l'outsider.",
      },
    });
  } else if (gapMultiplier >= 1.03 && daypart === "late") {
    signals.push({
      id: "night-lift",
      label: "Night lift",
      tone: "boost",
      text: {
        en: "Cooler late air lets the stronger legs separate more cleanly.",
        es: "El aire fresco de noche deja que las piernas más fuertes se separen mejor.",
        fr: "L'air plus frais du soir laisse les jambes les plus fortes se détacher plus proprement.",
      },
    });
  } else if (temperature !== null && temperature >= 27 && daypart === "late") {
    signals.push({
      id: "softened-heat",
      label: "Softened heat",
      tone: "steady",
      text: {
        en: "The late kickoff softens the heat tax without clearing it completely.",
        es: "El horario tardío suaviza el impuesto del calor sin borrarlo del todo.",
        fr: "Le coup d'envoi tardif adoucit la taxe de chaleur sans l'effacer totalement.",
      },
    });
  }

  if (wind !== null && wind >= 18) {
    signals.push({
      id: "wind-noise",
      label: "Wind noise",
      tone: "chaos",
      text: {
        en: "Wind adds noise to long balls, crosses, and dead-ball moments.",
        es: "El viento mete ruido en balones largos, centros y jugadas quietas.",
        fr: "Le vent ajoute du bruit aux longs ballons, centres et phases arrêtées.",
      },
    });
  }

  if (summary.includes("rain") || summary.includes("shower") || summary.includes("slick")) {
    signals.push({
      id: "slick-pitch",
      label: "Slick pitch",
      tone: "chaos",
      text: {
        en: "A slick surface can turn rebounds into little emergencies.",
        es: "Una cancha resbalosa puede convertir rebotes en pequeñas emergencias.",
        fr: "Une surface glissante peut transformer les rebonds en petites urgences.",
      },
    });
  } else if (summary.includes("fog")) {
    signals.push({
      id: "fog-edge",
      label: "Fog edge",
      tone: "chaos",
      text: {
        en: "Fog blurs the long-ball trail and makes second balls stranger.",
        es: "La niebla borra el rastro del balón largo y vuelve raras las segundas jugadas.",
        fr: "Le brouillard floute les longs ballons et rend les seconds ballons plus étranges.",
      },
    });
  }

  return signals;
}

function marketPulseTrailSignal(marketPulse: MarketPulse): TrailSignal {
  if (marketPulse.alignment === "thin") {
    return {
      id: "crowd-thin",
      label: "Crowd whisper",
      tone: "steady",
      text: {
        en: "The crowd is only a murmur, so the Seer keeps that whisper behind the glass.",
        es: "La gente apenas murmura, asi que el Vidente deja ese susurro detras del cristal.",
        fr: "Le public n'est qu'un murmure, donc le voyant garde ce souffle derriere la vitre.",
      },
    };
  }

  if (marketPulse.alignment === "aligned") {
    return {
      id: "crowd-backs",
      label: "Crowd backs",
      tone: "boost",
      text: {
        en: "The crowd hums in the same direction, warming the read without taking the wheel.",
        es: "La gente zumba en la misma direccion, calentando la lectura sin tomar el volante.",
        fr: "Le public bourdonne dans le meme sens, rechauffant la lecture sans prendre le volant.",
      },
    };
  }

  return {
    id: "crowd-split",
    label: "Crowd split",
    tone: "chaos",
    text: {
      en: "The crowd drums another rhythm, so the Seer keeps the read but hears louder noise.",
      es: "La gente marca otro ritmo, asi que el Vidente mantiene la lectura pero oye mas ruido.",
      fr: "Le public bat un autre rythme, donc le voyant garde la lecture mais entend plus de bruit.",
    },
  };
}

function uniqueTrailSignals(signals: TrailSignal[]) {
  const seen = new Set<string>();

  return signals.filter((signal) => {
    if (seen.has(signal.id)) {
      return false;
    }

    seen.add(signal.id);
    return true;
  });
}

function readPayloadArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function toMatchStatus(status: string): MatchStatus {
  if (status === "live") {
    return "Live";
  }

  if (status === "final") {
    return "Final";
  }

  return "Upcoming";
}

function toMatchTime(status: MatchStatus, startsAt: Date | string | null) {
  if (status === "Live") {
    return "Now";
  }

  if (status === "Final") {
    return "Final";
  }

  if (!startsAt) {
    return "TBD";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Toronto",
  }).format(new Date(startsAt));
}

function kickoffHourInTournamentZone(startsAt: Date | string | null | undefined) {
  if (!startsAt) {
    return null;
  }

  const date = new Date(startsAt);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const hourPart = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hourCycle: "h23",
    timeZone: "America/Toronto",
  })
    .formatToParts(date)
    .find((part) => part.type === "hour")?.value;
  const hour = hourPart === undefined ? NaN : Number(hourPart);

  return Number.isFinite(hour) ? hour : null;
}

function toReasons(factors: string[] | null) {
  const fallback = ["More data is being loaded into the Seer."];
  const values = factors && factors.length > 0 ? factors : fallback;

  return {
    en: values,
    es: values,
    fr: values,
  };
}

function pendingForecast(
  homeName: string,
  awayName: string,
  phase: string,
): MatchForecast {
  return {
    home: 0,
    draw: 0,
    away: 0,
    confidence: 0,
    chaos: 0,
    projected: "TBD",
    isPending: true,
    tone: {
      en: `${phase} is on the board. The Seer will wait for confirmed teams before reading ${homeName} vs ${awayName}.`,
      es: `${phase} ya está en el tablero. El Vidente esperará equipos confirmados antes de leer ${homeName} vs ${awayName}.`,
      fr: `${phase} est au tableau. Le voyant attendra les équipes confirmées avant de lire ${homeName} vs ${awayName}.`,
    },
    reasons: {
      en: ["This next-round slot is synced, but the matchup is not confirmed yet."],
      es: ["Esta plaza de la siguiente ronda ya está sincronizada, pero el cruce aún no está confirmado."],
      fr: ["Cette place du prochain tour est synchronisée, mais l'affiche n'est pas encore confirmée."],
    },
    trail: [],
  };
}

function isPlaceholderTeamRow(record: string | null, code: string | null) {
  return record === "Knockout slot pending" || code === "TBD";
}

function toLanguageRecord(value: string): Record<Language, string> {
  return {
    en: value,
    es: value,
    fr: value,
  };
}

function toCardRisk(value: string | number | null) {
  if (value === null) {
    return "Pending";
  }

  const cardsPerMatch = toNumber(value);

  if (cardsPerMatch >= 4) {
    return "Medium-high";
  }

  if (cardsPerMatch >= 3.3) {
    return "Medium";
  }

  return "Medium-low";
}

function toNumber(value: string | number | null) {
  if (value === null) {
    return 0;
  }

  return typeof value === "number" ? value : Number(value);
}

function toOptionalNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  const numberValue = typeof value === "number" ? value : Number(value);

  return Number.isFinite(numberValue) ? numberValue : null;
}

function roundModifier(value: number) {
  return Math.round(value * 100) / 100;
}

function createForecastFingerprint({
  forecast,
  homeRatings,
  awayRatings,
}: {
  forecast: ReturnType<typeof matchseerV3Forecast>;
  homeRatings: TeamRatings;
  awayRatings: TeamRatings;
}) {
  return createHash("sha256")
    .update(
      stableStringify({
        home: forecast.home,
        draw: forecast.draw,
        away: forecast.away,
        confidence: forecast.confidence,
        chaos: forecast.chaos,
        projected: forecast.projected,
        goalModel: forecast.goalModel,
        knockout: forecast.knockout,
        modifiers: forecast.modifiers,
        factorExplanations: forecast.factors.map((factor) => ({
          label: factor.label,
          weight: factor.weight,
          explanation: factor.explanation,
        })),
        homeRatings,
        awayRatings,
      }),
    )
    .digest("hex")
    .slice(0, 32);
}

function buildForecastMovementTrail({
  forecast,
  previousForecast,
}: {
  forecast: ReturnType<typeof matchseerV3Forecast>;
  previousForecast: {
    version: number;
    home: number;
    draw: number;
    away: number;
    projected: string | null;
    confidence: number;
    chaos: number;
    fingerprint: string | null;
  } | null;
}): ForecastMovementTrailItem[] {
  const trail: ForecastMovementTrailItem[] = [];

  if (!previousForecast) {
    trail.push({
      id: "first-read",
      label: "First read",
      tone: "steady",
      publicText: {
        en: "The Seer opened the first trail for this match.",
        es: "El Vidente abrió la primera lectura de este partido.",
        fr: "Le voyant a ouvert la première piste de ce match.",
      },
      adminText: "Initial forecast version minted from the current v4 inputs.",
      delta: {
        projected: forecast.projected,
        confidence: forecast.confidence,
        chaos: forecast.chaos,
      },
    });

    return trail;
  }

  const projectedBefore = normalizeProjectedScore(previousForecast.projected);

  if (projectedBefore !== forecast.projected) {
    trail.push({
      id: "scoreline-moved",
      label: "Scoreline moved",
      tone: "chaos",
      publicText: {
        en: "The score trail shifted after the newest match signals came in.",
        es: "El marcador proyectado se movió con las señales más recientes.",
        fr: "La piste du score a bougé avec les derniers signaux du match.",
      },
      adminText: `Projected score moved from ${projectedBefore} to ${forecast.projected}.`,
      delta: {
        previousProjected: projectedBefore,
        projected: forecast.projected,
      },
    });
  }

  const leaderBefore = leadingSide(
    previousForecast.home,
    previousForecast.draw,
    previousForecast.away,
  );
  const leaderAfter = leadingSide(forecast.home, forecast.draw, forecast.away);

  if (leaderBefore !== leaderAfter) {
    trail.push({
      id: "leader-flipped",
      label: "Lean flipped",
      tone: "chaos",
      publicText: {
        en: "The lean changed shirts after the latest read.",
        es: "La inclinación cambió de camiseta tras la nueva lectura.",
        fr: "Le penchant a changé de maillot après la nouvelle lecture.",
      },
      adminText: `Forecast leader changed from ${leaderBefore} to ${leaderAfter}.`,
      delta: {
        previousLeader: leaderBefore,
        leader: leaderAfter,
      },
    });
  } else {
    const leaderDelta =
      leaderAfter === "home"
        ? forecast.home - previousForecast.home
        : leaderAfter === "away"
          ? forecast.away - previousForecast.away
          : forecast.draw - previousForecast.draw;

    if (Math.abs(leaderDelta) >= 3) {
      trail.push({
        id: leaderDelta > 0 ? "lean-grew" : "lean-softened",
        label: leaderDelta > 0 ? "Lean grew" : "Lean softened",
        tone: leaderDelta > 0 ? "boost" : "drag",
        publicText: {
          en:
            leaderDelta > 0
              ? "The favorite found a little more oxygen in the read."
              : "The favorite's edge lost a little oxygen in the read.",
          es:
            leaderDelta > 0
              ? "El favorito encontró un poco más de aire en la lectura."
              : "La ventaja del favorito perdió un poco de aire en la lectura.",
          fr:
            leaderDelta > 0
              ? "Le favori a trouvé un peu plus d'air dans la lecture."
              : "L'avantage du favori a perdu un peu d'air dans la lecture.",
        },
        adminText: `Leader probability moved ${formatSignedDelta(leaderDelta)} points.`,
        delta: {
          leader: leaderAfter,
          probabilityDelta: leaderDelta,
        },
      });
    }
  }

  const confidenceDelta = forecast.confidence - previousForecast.confidence;

  if (Math.abs(confidenceDelta) >= 3) {
    trail.push({
      id: confidenceDelta > 0 ? "confidence-lift" : "confidence-dip",
      label: confidenceDelta > 0 ? "Confidence lift" : "Confidence dip",
      tone: confidenceDelta > 0 ? "boost" : "drag",
      publicText: {
        en:
          confidenceDelta > 0
            ? "The trail got cleaner, so the Seer stands a little taller."
            : "The trail got noisier, so the Seer lowers the stance.",
        es:
          confidenceDelta > 0
            ? "La lectura se limpió y el Vidente se planta un poco más firme."
            : "La lectura se volvió más ruidosa y el Vidente baja la postura.",
        fr:
          confidenceDelta > 0
            ? "La piste s'est éclaircie, le voyant se tient un peu plus droit."
            : "La piste est devenue plus bruyante, le voyant baisse sa posture.",
      },
      adminText: `Confidence moved ${formatSignedDelta(confidenceDelta)} points.`,
      delta: {
        confidenceDelta,
        previousConfidence: previousForecast.confidence,
        confidence: forecast.confidence,
      },
    });
  }

  const chaosDelta = forecast.chaos - previousForecast.chaos;

  if (Math.abs(chaosDelta) >= 3) {
    trail.push({
      id: chaosDelta > 0 ? "chaos-louder" : "chaos-quieter",
      label: chaosDelta > 0 ? "Chaos louder" : "Chaos quieter",
      tone: chaosDelta > 0 ? "chaos" : "steady",
      publicText: {
        en:
          chaosDelta > 0
            ? "The room got louder, and the match picked up more wobble."
            : "The room quieted down, and the read got cleaner.",
        es:
          chaosDelta > 0
            ? "La sala se puso más ruidosa y el partido ganó temblor."
            : "La sala se calmó y la lectura quedó más limpia.",
        fr:
          chaosDelta > 0
            ? "La pièce est devenue plus bruyante et le match a gagné du flottement."
            : "La pièce s'est calmée et la lecture est devenue plus nette.",
      },
      adminText: `Chaos moved ${formatSignedDelta(chaosDelta)} points.`,
      delta: {
        chaosDelta,
        previousChaos: previousForecast.chaos,
        chaos: forecast.chaos,
      },
    });
  }

  if (trail.length === 0) {
    trail.push({
      id: "inputs-refreshed",
      label: "Inputs refreshed",
      tone: "steady",
      publicText: {
        en: "The Seer refreshed the board, but the match read held steady.",
        es: "El Vidente refrescó el tablero, pero la lectura se mantuvo firme.",
        fr: "Le voyant a rafraîchi le tableau, mais la lecture est restée stable.",
      },
      adminText: "Forecast inputs changed, but the public read stayed materially stable.",
      delta: {
        projected: forecast.projected,
      },
    });
  }

  return trail.slice(0, 4);
}

function formatSignedDelta(value: number) {
  return `${value > 0 ? "+" : ""}${Math.round(value)}`;
}

function formatSignedDecimal(value: number) {
  return `${value > 0 ? "+" : ""}${roundModifier(value)}`;
}

function baselineAppliedCalibrationTuning(
  reason = "No actionable receipt sample yet.",
): AppliedCalibrationTuning {
  return {
    version: CALIBRATION_TUNING_VERSION,
    readiness: "collecting",
    sampleSize: 0,
    applied: false,
    reason,
    knobs: DEFAULT_CALIBRATION_TUNING_KNOBS,
    recommendedKnobs: DEFAULT_CALIBRATION_TUNING_KNOBS,
  };
}

async function readAppliedCalibrationTuning(
  sql: NeonQuery,
): Promise<AppliedCalibrationTuning> {
  try {
    const rows = (await sql`
      select distinct on (forecasts.match_id)
        matches.home_score,
        matches.away_score,
        forecasts.home_win_probability,
        forecasts.draw_probability,
        forecasts.away_win_probability,
        forecasts.confidence,
        forecasts.chaos,
        forecasts.source_payload
      from forecasts
      join matches on matches.id = forecasts.match_id
      where lower(matches.status) = 'final'
        and matches.home_score is not null
        and matches.away_score is not null
      order by forecasts.match_id, forecasts.version desc, forecasts.created_at desc;
    `) as unknown as CalibrationForecastRow[];
    const samples = rows.flatMap((row) => {
      const sample = calibrationSampleFromForecastRow(row);

      return sample ? [sample] : [];
    });

    return computeCalibration(samples).tuning.application;
  } catch (error) {
    console.error("MatchSeer calibration tuning read failed", error);

    return baselineAppliedCalibrationTuning("Calibration read failed; baseline knobs kept.");
  }
}

function calibrationSampleFromForecastRow(
  row: CalibrationForecastRow,
): CalibrationSample | null {
  const actual = scoreToForecastOutcome(row.home_score, row.away_score);

  if (!actual) {
    return null;
  }

  const payload = parseJsonPayload(row.source_payload);
  const marketPulse =
    readPayloadRecord(payload?.marketPulse) ??
    readPayloadRecord(readPayloadRecord(payload?.marketNudge)?.market);
  const marketHome = readPayloadNumber(marketPulse?.home);
  const marketDraw = readPayloadNumber(marketPulse?.draw);
  const marketAway = readPayloadNumber(marketPulse?.away);
  const marketNudge = readPayloadRecord(payload?.marketNudge);
  const marketLeader =
    marketHome !== null && marketDraw !== null && marketAway !== null
      ? leadingSide(marketHome, marketDraw, marketAway)
      : null;

  return {
    probabilities: {
      home: toNumber(row.home_win_probability),
      draw: toNumber(row.draw_probability),
      away: toNumber(row.away_win_probability),
    },
    actual,
    confidence: row.confidence,
    chaos: row.chaos,
    market: marketLeader
      ? {
          leader: marketLeader,
          liquidityScore:
            readPayloadNumber(marketPulse?.liquidityScore) ??
            readPayloadNumber(marketNudge?.liquidityScore),
          alignment: null,
          nudgeApplied: readPayloadBoolean(marketNudge?.applied) ?? false,
        }
      : null,
  };
}

function scoreToForecastOutcome(
  homeScore: number | null,
  awayScore: number | null,
): ForecastOutcome | null {
  if (homeScore === null || awayScore === null) {
    return null;
  }

  if (homeScore > awayScore) {
    return "home";
  }

  if (homeScore < awayScore) {
    return "away";
  }

  return "draw";
}

export function applyCalibrationTuningToExpectedGoals({
  homeXg,
  awayXg,
  calibrationTuning,
}: {
  homeXg: number;
  awayXg: number;
  calibrationTuning?: AppliedCalibrationTuning | null;
}) {
  const preTuning = {
    homeXg: roundXg(homeXg),
    awayXg: roundXg(awayXg),
  };

  if (!calibrationTuning?.applied) {
    return {
      applied: false,
      version: calibrationTuning?.version ?? CALIBRATION_TUNING_VERSION,
      readiness: calibrationTuning?.readiness ?? "collecting",
      reason: calibrationTuning?.reason ?? "Baseline xG kept.",
      knobs: calibrationTuning?.knobs ?? DEFAULT_CALIBRATION_TUNING_KNOBS,
      preTuning,
      homeXg: preTuning.homeXg,
      awayXg: preTuning.awayXg,
      deltas: { homeXg: 0, awayXg: 0 },
    };
  }

  const knobs = calibrationTuning.knobs;
  const totalXg = clampNumber(homeXg + awayXg, 0.8, 5.2);
  const xgGap = homeXg - awayXg;
  const drawPressure = clampNumber(knobs.drawLaneMultiplier - 1, -0.1, 0.16);
  const gapScale = clampNumber(
    knobs.favoriteScale * (1 - drawPressure * 0.7),
    0.78,
    1.22,
  );
  const totalScale = clampNumber(
    1 - Math.max(0, drawPressure) * 0.16,
    0.92,
    1.04,
  );
  const tunedGap = clampNumber(xgGap * gapScale, xgGap - 0.3, xgGap + 0.3);
  const tunedTotal = clampNumber(totalXg * totalScale, 0.8, 5.2);
  const tunedHome = clampNumber((tunedTotal + tunedGap) / 2, 0.25, 3.8);
  const tunedAway = clampNumber((tunedTotal - tunedGap) / 2, 0.25, 3.8);
  const nextHomeXg = roundXg(tunedHome);
  const nextAwayXg = roundXg(tunedAway);

  return {
    applied:
      Math.abs(nextHomeXg - preTuning.homeXg) > 0.001 ||
      Math.abs(nextAwayXg - preTuning.awayXg) > 0.001,
    version: calibrationTuning.version,
    readiness: calibrationTuning.readiness,
    reason: calibrationTuning.reason,
    knobs,
    preTuning,
    homeXg: nextHomeXg,
    awayXg: nextAwayXg,
    deltas: {
      homeXg: roundXg(nextHomeXg - preTuning.homeXg),
      awayXg: roundXg(nextAwayXg - preTuning.awayXg),
    },
  };
}

function applyCalibrationTuningToChaos(
  chaos: number,
  calibrationTuning?: AppliedCalibrationTuning | null,
) {
  if (!calibrationTuning?.applied) {
    return {
      applied: false,
      raw: chaos,
      chaos,
      sensitivity: DEFAULT_CALIBRATION_TUNING_KNOBS.chaosSensitivity,
      delta: 0,
    };
  }

  const sensitivity = calibrationTuning.knobs.chaosSensitivity;
  const tunedChaos = clamp(Math.round(60 + (chaos - 60) * sensitivity), 36, 82);

  return {
    applied: tunedChaos !== chaos,
    raw: chaos,
    chaos: tunedChaos,
    sensitivity,
    delta: tunedChaos - chaos,
  };
}

function applyCalibrationTuningToConfidence(
  confidence: number,
  calibrationTuning?: AppliedCalibrationTuning | null,
) {
  if (!calibrationTuning?.applied) {
    return {
      applied: false,
      raw: confidence,
      confidence,
      bias: 0,
      delta: 0,
    };
  }

  const bias = calibrationTuning.knobs.confidenceBias;
  const tunedConfidence = clamp(Math.round(confidence + bias), 45, 80);

  return {
    applied: tunedConfidence !== confidence,
    raw: confidence,
    confidence: tunedConfidence,
    bias,
    delta: tunedConfidence - confidence,
  };
}

function readForecastFingerprint(
  payload: ExistingForecastLockRow["source_payload"] | undefined,
) {
  const parsedPayload = parseJsonPayload(payload);
  const fingerprint = parsedPayload?.forecastFingerprint;

  return typeof fingerprint === "string" ? fingerprint : null;
}

function parseJsonPayload(
  payload:
    | ExistingForecastLockRow["source_payload"]
    | DatabaseMatchRow["source_payload"]
    | undefined,
) {
  if (!payload) {
    return null;
  }

  if (typeof payload !== "string") {
    return payload;
  }

  try {
    return JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function stableStringify(value: unknown) {
  return JSON.stringify(sortJsonValue(value));
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, sortJsonValue(nestedValue)]),
    );
  }

  return value;
}


function teamRatings(team: FootballDataTeam): TeamRatings {
  if (team.isPlaceholder) {
    return {
      attack: 50,
      control: 50,
      defense: 50,
      setPieces: 50,
    };
  }

  const profile = teamRatingProfiles[team.code.toUpperCase()];

  if (profile) {
    return profile;
  }

  const seed = team.id;

  return {
    attack: 58 + (seed % 33),
    control: 56 + ((seed * 3) % 35),
    defense: 57 + ((seed * 5) % 34),
    setPieces: 55 + ((seed * 7) % 36),
  };
}

function matchseerV3Forecast({
  homeTeam,
  awayTeam,
  homeRatings,
  awayRatings,
  phase,
  venueSlug,
  context,
  marketPulse,
  calibrationTuning,
  liveState,
}: {
  homeTeam: FootballDataTeam;
  awayTeam: FootballDataTeam;
  homeRatings: TeamRatings;
  awayRatings: TeamRatings;
  phase: string;
  venueSlug: string | null;
  context: ForecastContextRow | null;
  marketPulse?: unknown;
  calibrationTuning?: AppliedCalibrationTuning | null;
  liveState?: ForecastLiveState;
}) {
  const homeVenueBoost = venueCountryBoost(homeTeam, venueSlug);
  const awayVenueBoost = venueCountryBoost(awayTeam, venueSlug);
  const homeBasePower = teamPowerWithStanding(homeTeam, homeRatings);
  const awayBasePower = teamPowerWithStanding(awayTeam, awayRatings);
  const weather = weatherForecastModifier(context, homeRatings, awayRatings);
  const bodyCost = travelBodyCostModifier({
    homeTeam,
    awayTeam,
    phase,
    venueSlug,
    context,
  });
  const referee = refereeForecastModifier(context, homeRatings, awayRatings);
  const spotlight = spotlightGravityModifier(homeTeam, awayTeam);
  const vipSpotlight = vipSpotlightModifier(context, homeTeam, awayTeam);
  const playerContext = forecastPlayerContexts(context);
  const availability = availabilityForecastModifier(playerContext);
  const fatigue = fatigueForecastModifier(playerContext, context);
  const knockout = knockoutRoundForecastModifier(phase);
  const tournamentForm = tournamentFormModifier({
    homeTeam,
    awayTeam,
    homeRatings,
    awayRatings,
    context,
  });
  const tactical = tacticalMatchupModifier({
    homeName: homeTeam.name,
    awayName: awayTeam.name,
    homeRatings,
    awayRatings,
    context,
    referee: referee.payload,
    bodyCost: bodyCost.payload,
    availability: availability.payload,
  });
  const homePower =
    homeBasePower +
    homeVenueBoost +
    weather.homePower +
    referee.homePower +
    spotlight.homePower +
    vipSpotlight.homePower +
    tournamentForm.homePower -
    availability.homePenalty -
    bodyCost.homePenalty -
    fatigue.homePenalty;
  const awayPower =
    awayBasePower +
    awayVenueBoost +
    weather.awayPower +
    referee.awayPower +
    spotlight.awayPower +
    vipSpotlight.awayPower +
    tournamentForm.awayPower -
    availability.awayPenalty -
    bodyCost.awayPenalty -
    fatigue.awayPenalty;
  const rawPowerGap = homePower - awayPower;
  const powerGap =
    rawPowerGap *
    weather.gapMultiplier *
    bodyCost.gapMultiplier *
    knockout.gapMultiplier;
  const baseChaos =
    64 -
    Math.abs(powerGap) * 0.9 +
    Math.abs(homeRatings.attack - awayRatings.defense) * 0.05 +
    Math.abs(awayRatings.attack - homeRatings.defense) * 0.05;
  const rawChaos = clamp(
    Math.round(
      baseChaos +
        weather.chaosDelta +
        referee.chaosDelta +
        spotlight.chaosDelta +
        vipSpotlight.chaosDelta +
        tournamentForm.chaosDelta +
        bodyCost.chaosDelta +
        availability.chaosDelta +
        fatigue.chaosDelta +
        knockout.chaosDelta +
        tactical.chaosDelta,
    ),
    36,
    82,
  );
  const calibrationChaos = applyCalibrationTuningToChaos(
    rawChaos,
    calibrationTuning,
  );
  const chaos = calibrationChaos.chaos;
  const xgPowerSwing = clampNumber(powerGap * 0.014, -0.38, 0.38);
  const rawHomeXg = expectedGoals(
    homeRatings,
    awayRatings,
    homeVenueBoost,
    weather.xgDelta +
      knockout.xgDelta +
      xgPowerSwing +
      tactical.homeXgDelta +
      weather.homeXgDelta +
      referee.homeXgDelta +
      vipSpotlight.homeXgDelta +
      tournamentForm.homeXgDelta -
      bodyCost.homeXgPenalty -
      availability.homeXgPenalty -
      fatigue.homeXgPenalty,
  );
  const rawAwayXg = expectedGoals(
    awayRatings,
    homeRatings,
    awayVenueBoost,
    weather.xgDelta +
      knockout.xgDelta +
      -xgPowerSwing +
      tactical.awayXgDelta +
      weather.awayXgDelta +
      referee.awayXgDelta +
      vipSpotlight.awayXgDelta +
      tournamentForm.awayXgDelta -
      bodyCost.awayXgPenalty -
      availability.awayXgPenalty -
      fatigue.awayXgPenalty,
  );
  const preliminaryGoalModel = deriveForecastFromExpectedGoals({
    homeXg: rawHomeXg,
    awayXg: rawAwayXg,
  });
  const tournamentReality = tournamentRealityScoreModifier({
    homeTeam,
    awayTeam,
    homeRatings,
    awayRatings,
    homePower,
    awayPower,
    homeProbability: preliminaryGoalModel.homeWin,
    awayProbability: preliminaryGoalModel.awayWin,
    chaos,
    context,
  });
  const finalXg = applyTournamentRealityToExpectedGoals({
    homeXg: rawHomeXg,
    awayXg: rawAwayXg,
    tournamentReality,
  });
  const opponentAdjustedXg = opponentAdjustedExpectedGoals({
    homeXg: finalXg.homeXg,
    awayXg: finalXg.awayXg,
    homeRatings,
    awayRatings,
    tournamentForm: tournamentForm.payload,
  });
  const tunedXg = applyCalibrationTuningToExpectedGoals({
    homeXg: opponentAdjustedXg.homeXg,
    awayXg: opponentAdjustedXg.awayXg,
    calibrationTuning,
  });
  const goalModel = deriveForecastFromExpectedGoals({
    homeXg: tunedXg.homeXg,
    awayXg: tunedXg.awayXg,
  });
  const projected = goalModel.projectedScore;
  const dynamicDrag =
    Math.abs(weather.chaosDelta) +
    Math.abs(referee.chaosDelta) +
    Math.abs(vipSpotlight.chaosDelta) +
    Math.abs(tournamentForm.chaosDelta) +
    Math.abs(bodyCost.chaosDelta) +
    Math.abs(availability.chaosDelta) +
    Math.abs(fatigue.chaosDelta) +
    Math.abs(tactical.chaosDelta);
  const rawBaseConfidence = clamp(
    Math.round(
      50 +
        Math.abs(powerGap) * 1.04 +
        (78 - chaos) * 0.08 -
        dynamicDrag * 0.24 +
        weather.confidenceDelta +
        vipSpotlight.confidenceDelta +
        tournamentForm.confidenceDelta +
        bodyCost.confidenceDelta +
        availability.confidenceDelta +
        knockout.confidenceDelta +
        tactical.confidenceDelta,
    ),
    45,
    80,
  );
  const calibrationConfidence = applyCalibrationTuningToConfidence(
    rawBaseConfidence,
    calibrationTuning,
  );
  const baseConfidence = calibrationConfidence.confidence;
  const marketNudge = applyMarketPulseProbabilityNudge({
    probabilities: {
      home: goalModel.homeWin,
      draw: goalModel.draw,
      away: goalModel.awayWin,
    },
    marketPulse,
    maxWeight:
      calibrationTuning?.knobs.marketNudgeMaxWeight ??
      DEFAULT_CALIBRATION_TUNING_KNOBS.marketNudgeMaxWeight,
  });
  const liveModel = applyLiveMatchProbabilityNudge({
    probabilities: marketNudge.probabilities,
    status: liveState?.status,
    homeScore: liveState?.homeScore,
    awayScore: liveState?.awayScore,
    minute: liveState?.minute,
    homeRedCards: liveState?.homeRedCards,
    awayRedCards: liveState?.awayRedCards,
    confidence: baseConfidence,
    chaos,
  });
  const home = liveModel.probabilities.home;
  const draw = liveModel.probabilities.draw;
  const away = liveModel.probabilities.away;
  const finalChaos = clamp(chaos + liveModel.chaosDelta, 30, 90);
  const confidence = clamp(baseConfidence + liveModel.confidenceDelta, 35, 90);
  const knockoutLane = knockout.isKnockout
    ? buildKnockoutResolutionLane({
        phase,
        homeTeam,
        awayTeam,
        homeProbability: home,
        drawProbability: draw,
        awayProbability: away,
        powerGap,
        chaos: finalChaos,
      })
    : null;
  const favorite =
    home === away
      ? null
      : home > away
        ? { team: homeTeam, ratings: homeRatings, probability: home }
        : { team: awayTeam, ratings: awayRatings, probability: away };
  const pressurePoint =
    Math.abs(homeRatings.attack - awayRatings.defense) >
    Math.abs(awayRatings.attack - homeRatings.defense)
      ? `${homeTeam.name}'s attack against ${awayTeam.name}'s defensive shape`
      : `${awayTeam.name}'s attack against ${homeTeam.name}'s defensive shape`;
  const venueExplanation =
    homeVenueBoost > awayVenueBoost
      ? `${homeTeam.name} get a small venue familiarity lift.`
      : awayVenueBoost > homeVenueBoost
        ? `${awayTeam.name} get a small venue familiarity lift.`
        : "The venue profile stays close to neutral for this dynamic read.";
  const marketNudgeFactor = marketNudge.applied
    ? {
        label: "Crowd price nudge",
        weight: 0.42,
        explanation: `Crowd signal moved the lanes ${formatSignedDelta(marketNudge.deltas.home)} home, ${formatSignedDelta(marketNudge.deltas.draw)} draw, and ${formatSignedDelta(marketNudge.deltas.away)} away with a ${marketNudge.cap}-point cap.`,
      }
    : null;
  const calibrationTuningFactor = calibrationTuning?.applied
    ? {
        label: "Receipt tuning",
        weight: 0.64,
        explanation: `Actionable calibration receipts activated ${calibrationTuning.version}: favorite ${calibrationTuning.knobs.favoriteScale}x, draw ${calibrationTuning.knobs.drawLaneMultiplier}x, confidence ${formatSignedDelta(calibrationTuning.knobs.confidenceBias)}, chaos ${calibrationTuning.knobs.chaosSensitivity}x, crowd weight ${calibrationTuning.knobs.marketNudgeMaxWeight}.`,
      }
    : null;
  const opponentAdjustedXgFactor = opponentAdjustedXg.applied
    ? {
        label: "Opponent-adjusted xG",
        weight: 0.62,
        explanation: `Raw xG was normalized for opponent strength: ${homeTeam.name} ${formatSignedDecimal(opponentAdjustedXg.deltas.homeXg)} xG and ${awayTeam.name} ${formatSignedDecimal(opponentAdjustedXg.deltas.awayXg)} xG after defensive and attacking context.`,
      }
    : null;
  const liveMinuteLabel =
    liveModel.minuteSource === "feed" && liveModel.minute !== null
      ? `${liveModel.minute}'`
      : "the live window";
  const liveModelFactor = liveModel.applied
    ? {
        label: "Live match state",
        weight: 0.86,
        explanation: `The live score (${liveModel.homeScore}-${liveModel.awayScore}) at ${liveMinuteLabel} reshaped the pre-match lanes before the Seer settled the read.`,
      }
    : null;
  const factors = [
    {
      label: favorite ? "Team profile signal" : "Balanced profile signal",
      weight: 1,
      explanation: favorite
        ? `${favorite.team.name} carry the stronger Seer profile at ${favorite.probability}%.`
        : "The Seer team profiles are close enough to keep the match balanced.",
    },
    weather.factor,
    referee.factor,
    spotlight.factor,
    vipSpotlight.factor,
    tournamentForm.factor,
    bodyCost.factor,
    availability.factor,
    fatigue.factor,
    tactical.factor,
    knockout.factor,
    tournamentReality.factor,
    opponentAdjustedXgFactor,
    calibrationTuningFactor,
    marketNudgeFactor,
    liveModelFactor,
    {
      label: "Venue context",
      weight: 0.55,
      explanation: venueExplanation,
    },
    {
      label: "Attack and defense shape",
      weight: 0.7,
      explanation: `The sharpest matchup is ${pressurePoint}.`,
    },
  ].filter((factor): factor is { label: string; weight: number; explanation: string } =>
    Boolean(factor),
  );

  return {
    home,
    draw,
    away,
    confidence,
    chaos: finalChaos,
    projected,
    goalModel,
    knockout: knockoutLane,
    calibrationTuning: calibrationTuning ?? baselineAppliedCalibrationTuning(),
    marketNudge,
    liveModel,
    modifiers: {
      basePower: {
        home: roundModifier(homeBasePower),
        away: roundModifier(awayBasePower),
      },
      adjustedPower: {
        home: roundModifier(homePower),
        away: roundModifier(awayPower),
      },
      weatherPowerGap: {
        raw: roundModifier(rawPowerGap),
        adjusted: roundModifier(powerGap),
        multiplier: roundModifier(weather.gapMultiplier),
        bodyCostMultiplier: roundModifier(bodyCost.gapMultiplier),
      },
      venue: {
        home: homeVenueBoost,
        away: awayVenueBoost,
      },
      xg: {
        rawHome: roundXg(rawHomeXg),
        rawAway: roundXg(rawAwayXg),
        tournamentHome: roundXg(finalXg.homeXg),
        tournamentAway: roundXg(finalXg.awayXg),
        tacticalHome: roundModifier(tactical.homeXgDelta),
        tacticalAway: roundModifier(tactical.awayXgDelta),
        adjustedHome: opponentAdjustedXg.homeXg,
        adjustedAway: opponentAdjustedXg.awayXg,
        tunedHome: tunedXg.homeXg,
        tunedAway: tunedXg.awayXg,
        home: goalModel.homeXg,
        away: goalModel.awayXg,
        total: goalModel.totalXg,
        powerSwing: roundModifier(xgPowerSwing),
        homeWin: goalModel.homeWin,
        draw: goalModel.draw,
        awayWin: goalModel.awayWin,
        projected: goalModel.projectedScore,
        homeCleanSheet: goalModel.homeCleanSheet,
        awayCleanSheet: goalModel.awayCleanSheet,
        over25: goalModel.over25,
        under25: goalModel.under25,
        bothTeamsScore: goalModel.bothTeamsScore,
      },
      weather: weather.payload,
      referee: referee.payload,
      spotlight: spotlight.payload,
      vipSpotlight: vipSpotlight.payload,
      tournamentForm: tournamentForm.payload,
      bodyCost: bodyCost.payload,
      availability: availability.payload,
      fatigue: fatigue.payload,
      tacticalMatchup: tactical.payload,
      knockout: knockout.payload,
      opponentAdjustedXg,
      calibrationTuning: {
        ...(calibrationTuning ?? baselineAppliedCalibrationTuning()),
        expectedGoals: tunedXg,
        chaos: calibrationChaos,
        confidence: calibrationConfidence,
      },
      tournamentReality: tournamentReality.payload,
      marketNudge,
      liveModel,
    },
    factors,
  };
}

export function knockoutRoundForecastModifier(phase: string | null | undefined) {
  const isKnockout = isKnockoutPhase(phase);
  const isFinalLane = phase === "Final" || phase === "Semi-finals";
  const drawDelta = isKnockout ? (isFinalLane ? 5 : 4) : 0;

  return {
    isKnockout,
    gapMultiplier: isKnockout ? 0.86 : 1,
    drawDelta,
    drawFloor: isKnockout ? 22 : 15,
    drawCeiling: isKnockout ? 40 : 34,
    xgDelta: isKnockout ? -0.12 : 0,
    chaosDelta: isKnockout ? 2 : 0,
    confidenceDelta: isKnockout ? -2 : 0,
    factor: isKnockout
      ? {
          label: "Knockout pressure",
          weight: 0.72,
          explanation:
            "Knockout football shrinks risk appetite: the 90-minute draw lane gets louder, but the match still needs an advancer.",
        }
      : null,
    payload: {
      phase: phase ?? "Group stage",
      isKnockout,
      gapMultiplier: isKnockout ? 0.86 : 1,
      drawDelta,
      drawFloor: isKnockout ? 22 : 15,
      drawCeiling: isKnockout ? 40 : 34,
      xgDelta: isKnockout ? -0.12 : 0,
      chaosDelta: isKnockout ? 2 : 0,
      confidenceDelta: isKnockout ? -2 : 0,
    },
  };
}

export function buildKnockoutResolutionLane({
  phase,
  homeTeam,
  awayTeam,
  homeProbability,
  drawProbability,
  awayProbability,
  powerGap,
  chaos,
}: {
  phase: string;
  homeTeam: FootballDataTeam;
  awayTeam: FootballDataTeam;
  homeProbability: number;
  drawProbability: number;
  awayProbability: number;
  powerGap: number;
  chaos: number;
}): KnockoutForecast {
  const penaltyRate = clampNumber(
    0.42 + (chaos - 58) * 0.006 - Math.abs(powerGap) * 0.009,
    0.26,
    0.58,
  );
  const penaltyFloor = drawProbability >= 16 ? 8 : 4;
  const penalties = clamp(
    Math.round(drawProbability * penaltyRate),
    penaltyFloor,
    Math.max(penaltyFloor, drawProbability - 4),
  );
  const homeResolutionShare = clampNumber(0.5 + powerGap / 120, 0.38, 0.62);
  const homeAdvanceRaw = homeProbability + drawProbability * homeResolutionShare;
  const awayAdvanceRaw = awayProbability + drawProbability * (1 - homeResolutionShare);
  const advanceTotal = homeAdvanceRaw + awayAdvanceRaw;
  const homeAdvance = clamp(
    Math.round((homeAdvanceRaw / advanceTotal) * 100),
    1,
    99,
  );
  const awayAdvance = 100 - homeAdvance;
  const projectedAdvancer = homeAdvance >= awayAdvance ? "home" : "away";
  const advancerName =
    projectedAdvancer === "home" ? homeTeam.name : awayTeam.name;
  const advancerProbability =
    projectedAdvancer === "home" ? homeAdvance : awayAdvance;

  return {
    phase,
    regulationDraw: drawProbability,
    extraTime: drawProbability,
    penalties,
    homeAdvance,
    awayAdvance,
    projectedAdvancer,
    summary: {
      en: `${phase} cannot end level, so ${drawProbability}% is a 90-minute deadlock lane. ${advancerName} hold the stronger advance path at ${advancerProbability}% once extra time and penalties are folded in.`,
      es: `${phase} no puede terminar empatado, así que ${drawProbability}% es una ruta de empate a 90 minutos. ${advancerName} tiene la vía más fuerte para avanzar con ${advancerProbability}% al incluir prórroga y penales.`,
      fr: `${phase} ne peut pas finir à égalité, donc ${drawProbability}% devient la voie du blocage après 90 minutes. ${advancerName} garde la meilleure voie de qualification à ${advancerProbability}% avec prolongation et tirs au but.`,
    },
  };
}

function teamPower(ratings: TeamRatings) {
  return (
    ratings.attack * 0.32 +
    ratings.control * 0.24 +
    ratings.defense * 0.28 +
    ratings.setPieces * 0.16
  );
}

function technicalSeparationScore(ratings: TeamRatings) {
  return ratings.attack * 0.34 + ratings.control * 0.46 + ratings.setPieces * 0.12;
}

// World-stage standing prior (0-99): how strong each nation is on the world stage.
// The match model previously ignored this and ran purely on attack/control/defense/
// set-piece ratings, which underrated reputation gaps (e.g. Sweden vs Tunisia).
// This is an interim curated map — replace later with a live FIFA ranking / Elo and
// validate via the receipts calibration check. Unknown teams fall back to a neutral 58.
const STANDING_WEIGHT = 0.55;
const RATINGS_WEIGHT = 0.45;

function worldStandingPrior(team: FootballDataTeam): number {
  const key = team.name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const code = (team.code ?? "").toUpperCase();

  return (
    WORLD_STANDING_BY_NAME[key] ??
    WORLD_STANDING_BY_CODE[code] ??
    DEFAULT_WORLD_STANDING
  );
}

// Blend world standing (prior) with the raw ratings-based power so reputation
// gaps influence the win probability without overriding match-specific ratings.
function teamPowerWithStanding(team: FootballDataTeam, ratings: TeamRatings) {
  return (
    STANDING_WEIGHT * worldStandingPrior(team) +
    RATINGS_WEIGHT * teamPower(ratings)
  );
}

function venueCountryBoost(team: FootballDataTeam, venueSlug: string | null) {
  if (!venueSlug || !team.country) {
    return 0;
  }

  const country = team.country.toLowerCase();

  if (country === "mexico" && venueSlug.includes("mexico")) {
    return 3.5;
  }

  if (
    country === "canada" &&
    ["toronto", "vancouver"].some((city) => venueSlug.includes(city))
  ) {
    return 3;
  }

  if (
    country === "united states" &&
    [
      "atlanta",
      "boston",
      "dallas",
      "houston",
      "kansas-city",
      "los-angeles",
      "miami",
      "new-york",
      "philadelphia",
      "san-francisco",
      "seattle",
    ].some((city) => venueSlug.includes(city))
  ) {
    return 2.5;
  }

  return 0;
}

export function travelBodyCostModifier({
  homeTeam,
  awayTeam,
  phase,
  venueSlug,
  context,
}: {
  homeTeam: FootballDataTeam;
  awayTeam: FootballDataTeam;
  phase: string | null;
  venueSlug: string | null;
  context: ForecastContextRow | null;
}) {
  const currentVenue = venueProfileForContext(venueSlug, context);
  const temperature = toOptionalNumber(context?.temperature_c);
  const humidity = toOptionalNumber(context?.humidity);
  const summary = context?.weather_summary?.toLowerCase() ?? "";
  const kickoffHour = kickoffHourInTournamentZone(context?.starts_at);
  const isDayKickoff =
    kickoffHour !== null && kickoffHour >= 11 && kickoffHour < 18;
  const isHumid =
    (humidity !== null && humidity >= 65) ||
    summary.includes("humid") ||
    summary.includes("muggy");
  const heatStress = bodyHeatStress(temperature, humidity, isDayKickoff, summary);
  const altitudeStress = bodyAltitudeStress(currentVenue?.elevationMeters ?? null);
  const isKnockout = isKnockoutPhase(phase);
  const home = travelBodySideCost({
    team: homeTeam,
    side: "home",
    currentVenue,
    previousMatch: previousContextMatch(context, "home"),
    restHours: toOptionalNumber(context?.home_rest_hours),
    heatStress,
    altitudeStress,
    isHumid,
    isKnockout,
  });
  const away = travelBodySideCost({
    team: awayTeam,
    side: "away",
    currentVenue,
    previousMatch: previousContextMatch(context, "away"),
    restHours: toOptionalNumber(context?.away_rest_hours),
    heatStress,
    altitudeStress,
    isHumid,
    isKnockout,
  });
  const maxStress = Math.max(home.totalStress, away.totalStress);
  const sharedStress = Math.min(home.totalStress, away.totalStress);
  const stressGap = Math.abs(home.totalStress - away.totalStress);
  const gapMultiplier = clampNumber(1 - sharedStress * 0.024, 0.9, 1);
  const chaosDelta = clamp(
    Math.round(maxStress * 1.25 + (heatStress >= 0.75 ? 1 : 0)),
    0,
    6,
  );
  const confidenceDelta = -clamp(
    Math.round(maxStress * 0.8 + sharedStress * 0.35),
    0,
    4,
  );
  const activeNotes = [
    ...home.notes.map((note) => `${homeTeam.name}: ${note}`),
    ...away.notes.map((note) => `${awayTeam.name}: ${note}`),
  ].slice(0, 4);
  const active =
    maxStress >= 0.35 ||
    altitudeStress >= 0.45 ||
    heatStress >= 0.45 ||
    home.travelDistanceKm !== null ||
    away.travelDistanceKm !== null;
  const factor =
    active && activeNotes.length > 0
      ? {
          label: "Travel and body cost",
          weight: 0.58,
          explanation: `Travel load nudges the read: ${sentenceList(activeNotes)}.`,
        }
      : active
        ? {
            label: "Travel and body cost",
            weight: 0.38,
            explanation:
              "Venue altitude, travel, heat, and rest are synced but do not shove either side hard.",
          }
        : null;

  return {
    homePenalty: home.powerPenalty,
    awayPenalty: away.powerPenalty,
    homeXgPenalty: home.xgPenalty,
    awayXgPenalty: away.xgPenalty,
    gapMultiplier,
    chaosDelta,
    confidenceDelta,
    factor,
    payload: {
      status: active ? "active" : "pending-previous-venue-feed",
      phase: phase ?? "Group stage",
      venue: currentVenue,
      heatStress: roundModifier(heatStress),
      altitudeStress: roundModifier(altitudeStress),
      stressGap: roundModifier(stressGap),
      sharedStress: roundModifier(sharedStress),
      gapMultiplier: roundModifier(gapMultiplier),
      home: home.payload,
      away: away.payload,
      chaosDelta,
      confidenceDelta,
    },
  };
}

export function tacticalMatchupModifier({
  homeName = "Home",
  awayName = "Away",
  homeRatings,
  awayRatings,
  context = null,
  referee = null,
  bodyCost = null,
  availability = null,
}: {
  homeName?: string;
  awayName?: string;
  homeRatings: TeamRatings;
  awayRatings: TeamRatings;
  context?: Pick<
    ForecastContextRow,
    "cards_per_match" | "temperature_c" | "humidity" | "weather_summary" | "starts_at"
  > | null;
  referee?: Record<string, unknown> | null;
  bodyCost?: Record<string, unknown> | null;
  availability?: Record<string, unknown> | null;
}) {
  const refereePayload = referee ?? {};
  const bodyCostPayload = bodyCost ?? {};
  const availabilityPayload = availability ?? {};
  const homeBody = readPayloadRecord(bodyCostPayload.home);
  const awayBody = readPayloadRecord(bodyCostPayload.away);
  const cardsPerMatch =
    readPayloadNumber(refereePayload.cardsPerMatch) ??
    toOptionalNumber(context?.cards_per_match);
  const heatStress =
    readPayloadNumber(bodyCostPayload.heatStress) ??
    bodyHeatStress(
      toOptionalNumber(context?.temperature_c),
      toOptionalNumber(context?.humidity),
      kickoffHourInTournamentZone(context?.starts_at) !== null &&
        (kickoffHourInTournamentZone(context?.starts_at) ?? 0) >= 11 &&
        (kickoffHourInTournamentZone(context?.starts_at) ?? 0) < 18,
      context?.weather_summary?.toLowerCase() ?? "",
    );
  const homeStress = readPayloadNumber(homeBody?.totalStress) ?? 0;
  const awayStress = readPayloadNumber(awayBody?.totalStress) ?? 0;
  const homeAvailabilityPenalty =
    readPayloadNumber(availabilityPayload.homeXgPenalty) ?? 0;
  const awayAvailabilityPenalty =
    readPayloadNumber(availabilityPayload.awayXgPenalty) ?? 0;
  const homePressBase = tacticalPressRating(homeRatings);
  const awayPressBase = tacticalPressRating(awayRatings);
  const homePress = tacticalAvailablePressRating(
    homePressBase,
    heatStress,
    homeStress,
    homeAvailabilityPenalty,
  );
  const awayPress = tacticalAvailablePressRating(
    awayPressBase,
    heatStress,
    awayStress,
    awayAvailabilityPenalty,
  );
  const signals: Array<{
    id: string;
    label: string;
    side: "home" | "away";
    xgDelta: number;
    chaosDelta: number;
    confidenceDelta: number;
    note: string;
  }> = [];
  let homeXgDelta = 0;
  let awayXgDelta = 0;
  let chaosDelta = 0;
  let confidenceDelta = 0;

  const applySignal = ({
    chaos = 0,
    confidence = 0,
    delta,
    id,
    label,
    note,
    side,
  }: {
    chaos?: number;
    confidence?: number;
    delta: number;
    id: string;
    label: string;
    note: string;
    side: "home" | "away";
  }) => {
    if (Math.abs(delta) < 0.01 && chaos === 0 && confidence === 0) {
      return;
    }

    if (side === "home") {
      homeXgDelta += delta;
    } else {
      awayXgDelta += delta;
    }

    chaosDelta += chaos;
    confidenceDelta += confidence;
    signals.push({
      id,
      label,
      side,
      xgDelta: roundModifier(delta),
      chaosDelta: chaos,
      confidenceDelta: confidence,
      note,
    });
  };

  const homePressEdge = homePress - tacticalPressureResistance(awayRatings);
  const awayPressEdge = awayPress - tacticalPressureResistance(homeRatings);

  if (homePressEdge >= 6.5) {
    applySignal({
      id: "home-press-trap",
      label: "Press trap",
      side: "home",
      delta: clampNumber(homePressEdge * 0.007, 0.03, 0.12),
      chaos: 1,
      note: `${homeName}'s press can bother ${awayName}'s buildup.`,
    });
  }

  if (awayPressEdge >= 6.5) {
    applySignal({
      id: "away-press-trap",
      label: "Press trap",
      side: "away",
      delta: clampNumber(awayPressEdge * 0.007, 0.03, 0.12),
      chaos: 1,
      note: `${awayName}'s press can bother ${homeName}'s buildup.`,
    });
  }

  const homeHeatPressTax = tacticalHeatPressTax(homePressBase, heatStress, homeStress);
  const awayHeatPressTax = tacticalHeatPressTax(awayPressBase, heatStress, awayStress);

  if (homeHeatPressTax > 0) {
    applySignal({
      id: "home-heat-press-drag",
      label: "Heat press drag",
      side: "home",
      delta: -homeHeatPressTax,
      confidence: -1,
      note: `Heat and body load make ${homeName}'s press harder to hold.`,
    });
  }

  if (awayHeatPressTax > 0) {
    applySignal({
      id: "away-heat-press-drag",
      label: "Heat press drag",
      side: "away",
      delta: -awayHeatPressTax,
      confidence: -1,
      note: `Heat and body load make ${awayName}'s press harder to hold.`,
    });
  }

  const cardRestarts = tacticalCardRestartWeight(cardsPerMatch);
  const setPieceGap = homeRatings.setPieces - awayRatings.setPieces;

  if (cardRestarts > 0 && Math.abs(setPieceGap) >= 8) {
    const side = setPieceGap > 0 ? "home" : "away";
    const sideName = side === "home" ? homeName : awayName;

    applySignal({
      id: `${side}-set-piece-referee`,
      label: "Restart edge",
      side,
      delta: clampNumber(Math.abs(setPieceGap) * 0.0045 * (0.75 + cardRestarts), 0.03, 0.11),
      chaos: cardsPerMatch !== null && cardsPerMatch >= 4.2 ? 2 : 1,
      note: `${sideName}'s set pieces get louder with this referee/card rhythm.`,
    });
  }

  const homeLowBlockDelta = possessionLowBlockXgDelta(homeRatings, awayRatings);
  const awayLowBlockDelta = possessionLowBlockXgDelta(awayRatings, homeRatings);

  if (homeLowBlockDelta !== 0) {
    applySignal({
      id: "home-possession-low-block",
      label: "Low-block puzzle",
      side: "home",
      delta: homeLowBlockDelta,
      confidence: homeLowBlockDelta < 0 ? -1 : 0,
      note:
        homeLowBlockDelta < 0
          ? `${awayName}'s low block can turn ${homeName}'s control sterile.`
          : `${homeName}'s control has enough lock-picking against the low block.`,
    });
  }

  if (awayLowBlockDelta !== 0) {
    applySignal({
      id: "away-possession-low-block",
      label: "Low-block puzzle",
      side: "away",
      delta: awayLowBlockDelta,
      confidence: awayLowBlockDelta < 0 ? -1 : 0,
      note:
        awayLowBlockDelta < 0
          ? `${homeName}'s low block can turn ${awayName}'s control sterile.`
          : `${awayName}'s control has enough lock-picking against the low block.`,
    });
  }

  const homeTransitionEdge =
    tacticalTransitionRating(homeRatings) - tacticalTransitionResistance(awayRatings);
  const awayTransitionEdge =
    tacticalTransitionRating(awayRatings) - tacticalTransitionResistance(homeRatings);

  if (awayStress >= 0.65 && homeTransitionEdge >= 5) {
    applySignal({
      id: "home-transition-vs-tired-legs",
      label: "Transition lane",
      side: "home",
      delta: clampNumber(awayStress * 0.035 + homeTransitionEdge * 0.004, 0.03, 0.13),
      chaos: 1,
      note: `${homeName}'s transition game can hit ${awayName}'s travel-tired legs.`,
    });
  }

  if (homeStress >= 0.65 && awayTransitionEdge >= 5) {
    applySignal({
      id: "away-transition-vs-tired-legs",
      label: "Transition lane",
      side: "away",
      delta: clampNumber(homeStress * 0.035 + awayTransitionEdge * 0.004, 0.03, 0.13),
      chaos: 1,
      note: `${awayName}'s transition game can hit ${homeName}'s travel-tired legs.`,
    });
  }

  if (homeAvailabilityPenalty >= 0.08 && homeXgDelta > 0) {
    applySignal({
      id: "home-availability-tactical-drag",
      label: "Role dependency",
      side: "home",
      delta: -clampNumber(homeAvailabilityPenalty * 0.45, 0.02, 0.08),
      confidence: -1,
      note: `${homeName}'s tactical edge is muted by the key-player board.`,
    });
  }

  if (awayAvailabilityPenalty >= 0.08 && awayXgDelta > 0) {
    applySignal({
      id: "away-availability-tactical-drag",
      label: "Role dependency",
      side: "away",
      delta: -clampNumber(awayAvailabilityPenalty * 0.45, 0.02, 0.08),
      confidence: -1,
      note: `${awayName}'s tactical edge is muted by the key-player board.`,
    });
  }

  homeXgDelta = roundModifier(clampNumber(homeXgDelta, -0.18, 0.18));
  awayXgDelta = roundModifier(clampNumber(awayXgDelta, -0.18, 0.18));
  chaosDelta = clamp(Math.round(chaosDelta), -2, 5);
  confidenceDelta = clamp(Math.round(confidenceDelta), -3, 2);

  const activeSignals = signals
    .filter((signal) => Math.abs(signal.xgDelta) >= 0.02 || signal.chaosDelta !== 0)
    .slice(0, 5);
  const active =
    activeSignals.length > 0 ||
    Math.abs(homeXgDelta) >= 0.03 ||
    Math.abs(awayXgDelta) >= 0.03;
  const factor = active
    ? {
        label: "Tactical matchup",
        weight: 0.57,
        explanation: `Style clash nudges the read: ${sentenceList(
          activeSignals.slice(0, 3).map((signal) => signal.note),
        )}.`,
      }
    : null;

  return {
    homeXgDelta,
    awayXgDelta,
    chaosDelta,
    confidenceDelta,
    factor,
    payload: {
      status: active ? "active" : "quiet",
      cap: 0.18,
      cardsPerMatch,
      heatStress: roundModifier(heatStress),
      home: {
        press: roundModifier(homePress),
        transition: roundModifier(tacticalTransitionRating(homeRatings)),
        bodyStress: roundModifier(homeStress),
        availabilityXgPenalty: roundModifier(homeAvailabilityPenalty),
        xgDelta: homeXgDelta,
      },
      away: {
        press: roundModifier(awayPress),
        transition: roundModifier(tacticalTransitionRating(awayRatings)),
        bodyStress: roundModifier(awayStress),
        availabilityXgPenalty: roundModifier(awayAvailabilityPenalty),
        xgDelta: awayXgDelta,
      },
      signals: activeSignals,
      chaosDelta,
      confidenceDelta,
    },
  };
}

function tacticalAvailablePressRating(
  press: number,
  heatStress: number,
  bodyStress: number,
  availabilityPenalty: number,
) {
  return press - heatStress * 7.5 - bodyStress * 1.7 - availabilityPenalty * 10;
}

function tacticalPressRating(ratings: TeamRatings) {
  return (
    ratings.attack * 0.34 +
    ratings.defense * 0.38 +
    ratings.control * 0.2 +
    ratings.setPieces * 0.08
  );
}

function tacticalPressureResistance(ratings: TeamRatings) {
  return (
    ratings.control * 0.62 +
    ratings.defense * 0.2 +
    ratings.attack * 0.12 +
    ratings.setPieces * 0.06
  );
}

function tacticalHeatPressTax(
  press: number,
  heatStress: number,
  bodyStress: number,
) {
  if (heatStress < 0.55 || press < 74) {
    return 0;
  }

  return clampNumber((press - 74) * 0.004 * heatStress + bodyStress * 0.006, 0.02, 0.08);
}

function tacticalCardRestartWeight(cardsPerMatch: number | null) {
  if (cardsPerMatch === null) {
    return 0;
  }

  if (cardsPerMatch >= 4.2) {
    return 1;
  }

  if (cardsPerMatch >= 3.3) {
    return 0.55;
  }

  if (cardsPerMatch >= 2.8) {
    return 0.25;
  }

  return 0;
}

function possessionLowBlockXgDelta(
  possessionRatings: TeamRatings,
  blockRatings: TeamRatings,
) {
  const lowBlockScore =
    blockRatings.defense * 0.68 +
    (100 - blockRatings.attack) * 0.18 +
    (100 - blockRatings.control) * 0.14;

  if (
    possessionRatings.control < 76 ||
    blockRatings.defense < 77 ||
    lowBlockScore < 72
  ) {
    return 0;
  }

  const lockpickScore =
    possessionRatings.attack * 0.42 +
    possessionRatings.control * 0.5 +
    possessionRatings.setPieces * 0.08 -
    lowBlockScore;

  if (lockpickScore >= 4) {
    return clampNumber(lockpickScore * 0.004, 0.02, 0.07);
  }

  return -clampNumber((4 - lockpickScore) * 0.006, 0.025, 0.09);
}

function tacticalTransitionRating(ratings: TeamRatings) {
  return (
    ratings.attack * 0.58 +
    (100 - ratings.control) * 0.18 +
    ratings.setPieces * 0.12 +
    ratings.defense * 0.12
  );
}

function tacticalTransitionResistance(ratings: TeamRatings) {
  return ratings.control * 0.45 + ratings.defense * 0.35 + ratings.attack * 0.2;
}

function travelBodySideCost({
  team,
  side,
  currentVenue,
  previousMatch,
  restHours,
  heatStress,
  altitudeStress,
  isHumid,
  isKnockout,
}: {
  team: FootballDataTeam;
  side: "home" | "away";
  currentVenue: VenueBodyProfile | null;
  previousMatch: Record<string, unknown> | null;
  restHours: number | null;
  heatStress: number;
  altitudeStress: number;
  isHumid: boolean;
  isKnockout: boolean;
}) {
  const previousVenue = previousVenueProfile(previousMatch);
  const travelDistanceKm =
    currentVenue && previousVenue
      ? haversineDistanceKm(currentVenue, previousVenue)
      : null;
  const travelStress = bodyTravelStress(travelDistanceKm);
  const restStress = bodyRestStress(restHours);
  const duration = readPayloadString(previousMatch?.duration);
  const extraTimeStress =
    isKnockout && isExtraTimeDuration(duration)
      ? duration === "penalties"
        ? 0.9
        : 0.68
      : 0;
  const altitudePenalty =
    altitudeStress * (1 - teamAltitudeAcclimation(team, currentVenue));
  const heatTravelLoad = heatStress * (0.45 + travelStress * 0.18 + restStress * 0.16);
  const totalStress = clampNumber(
    travelStress * 0.85 +
      restStress * 0.72 +
      heatTravelLoad +
      altitudePenalty * 0.8 +
      extraTimeStress,
    0,
    4.8,
  );
  const powerPenalty = clampNumber(totalStress * 0.76, 0, 3.8);
  const xgPenalty = clampNumber(
    powerPenalty * 0.034 + heatTravelLoad * 0.025 + altitudePenalty * 0.035,
    0,
    0.24,
  );
  const notes: string[] = [];

  if (altitudePenalty >= 0.55) {
    notes.push(
      currentVenue?.city === "Mexico City"
        ? "Mexico City altitude taxes the lungs"
        : `${Math.round(currentVenue?.elevationMeters ?? 0)}m altitude adds a lung tax`,
    );
  }

  if (heatTravelLoad >= 0.5) {
    notes.push(
      isHumid
        ? "heat and humidity make recovery heavier"
        : "heat makes the legs burn faster",
    );
  }

  if (travelDistanceKm !== null && travelStress >= 0.45) {
    notes.push(`${Math.round(travelDistanceKm)}km venue jump`);
  }

  if (restStress >= 0.65) {
    notes.push(
      restHours === null
        ? "rest window is unclear"
        : `${Math.round(restHours)}h rest keeps the turnaround short`,
    );
  }

  if (extraTimeStress > 0) {
    notes.push(
      duration === "penalties"
        ? "penalty shootout hangover follows the knockout win"
        : "extra-time hangover follows the knockout win",
    );
  }

  return {
    totalStress,
    travelDistanceKm,
    powerPenalty,
    xgPenalty,
    notes,
    payload: {
      side,
      team: team.code,
      previousVenue,
      travelDistanceKm:
        travelDistanceKm === null ? null : Math.round(travelDistanceKm),
      restHours: restHours === null ? null : Math.round(restHours * 10) / 10,
      previousDuration: duration,
      travelStress: roundModifier(travelStress),
      restStress: roundModifier(restStress),
      heatTravelLoad: roundModifier(heatTravelLoad),
      altitudePenalty: roundModifier(altitudePenalty),
      extraTimeStress: roundModifier(extraTimeStress),
      totalStress: roundModifier(totalStress),
      powerPenalty: roundModifier(powerPenalty),
      xgPenalty: roundModifier(xgPenalty),
      notes,
    },
  };
}

type VenueBodyProfile = {
  slug: string | null;
  city: string | null;
  country: string | null;
  latitude: number;
  longitude: number;
  elevationMeters: number | null;
};

function venueProfileForContext(
  venueSlug: string | null,
  context: ForecastContextRow | null,
): VenueBodyProfile | null {
  const curated = worldCupVenues.find((venue) => venue.slug === venueSlug);

  if (curated) {
    return {
      slug: curated.slug,
      city: curated.city,
      country: curated.country,
      latitude: curated.latitude,
      longitude: curated.longitude,
      elevationMeters: curated.elevationMeters,
    };
  }

  const latitude = toOptionalNumber(context?.venue_latitude);
  const longitude = toOptionalNumber(context?.venue_longitude);

  if (latitude === null || longitude === null) {
    return null;
  }

  return {
    slug: context?.venue_slug ?? venueSlug,
    city: context?.venue_city ?? null,
    country: context?.venue_country ?? null,
    latitude,
    longitude,
    elevationMeters: null,
  };
}

function previousContextMatch(
  context: ForecastContextRow | null,
  side: "home" | "away",
) {
  return readPayloadRecord(
    side === "home" ? context?.home_previous_match : context?.away_previous_match,
  );
}

function previousVenueProfile(
  previousMatch: Record<string, unknown> | null,
): VenueBodyProfile | null {
  const venueSlug = readPayloadString(previousMatch?.venueSlug);
  const curated = worldCupVenues.find((venue) => venue.slug === venueSlug);

  if (curated) {
    return {
      slug: curated.slug,
      city: curated.city,
      country: curated.country,
      latitude: curated.latitude,
      longitude: curated.longitude,
      elevationMeters: curated.elevationMeters,
    };
  }

  const latitude = readPayloadNumber(previousMatch?.latitude);
  const longitude = readPayloadNumber(previousMatch?.longitude);

  if (latitude === null || longitude === null) {
    return null;
  }

  return {
    slug: venueSlug,
    city: readPayloadString(previousMatch?.venueCity),
    country: readPayloadString(previousMatch?.venueCountry),
    latitude,
    longitude,
    elevationMeters: null,
  };
}

function bodyHeatStress(
  temperature: number | null,
  humidity: number | null,
  isDayKickoff: boolean,
  summary: string,
) {
  if (temperature === null) {
    return summary.includes("humid") || summary.includes("muggy") ? 0.35 : 0;
  }

  let stress = 0;

  if (temperature >= 33) {
    stress += 1.05;
  } else if (temperature >= 30) {
    stress += 0.78;
  } else if (temperature >= 27) {
    stress += 0.45;
  }

  if ((humidity ?? 0) >= 72 || summary.includes("muggy")) {
    stress += 0.42;
  } else if ((humidity ?? 0) >= 62 || summary.includes("humid")) {
    stress += 0.25;
  }

  if (isDayKickoff && temperature >= 27) {
    stress += 0.18;
  }

  return clampNumber(stress, 0, 1.45);
}

function bodyAltitudeStress(elevationMeters: number | null) {
  if (elevationMeters === null) {
    return 0;
  }

  if (elevationMeters >= 2000) {
    return 1.25;
  }

  if (elevationMeters >= 1500) {
    return 0.72;
  }

  if (elevationMeters >= 900) {
    return 0.35;
  }

  return 0;
}

function bodyTravelStress(distanceKm: number | null) {
  if (distanceKm === null) {
    return 0;
  }

  if (distanceKm >= 3200) {
    return 1.15;
  }

  if (distanceKm >= 2200) {
    return 0.85;
  }

  if (distanceKm >= 1200) {
    return 0.58;
  }

  if (distanceKm >= 650) {
    return 0.34;
  }

  return 0.12;
}

function bodyRestStress(restHours: number | null) {
  if (restHours === null) {
    return 0.22;
  }

  if (restHours < 72) {
    return 1.08;
  }

  if (restHours < 96) {
    return 0.72;
  }

  if (restHours < 120) {
    return 0.36;
  }

  return 0;
}

function teamAltitudeAcclimation(
  team: FootballDataTeam,
  venue: VenueBodyProfile | null,
) {
  const teamCountry = team.country?.toLowerCase() ?? "";
  const venueCountry = venue?.country?.toLowerCase() ?? "";

  if (!teamCountry || !venueCountry) {
    return 0.05;
  }

  if (teamCountry === venueCountry && venueCountry === "mexico") {
    return 0.58;
  }

  if (teamCountry === venueCountry) {
    return 0.22;
  }

  return 0.05;
}

function isExtraTimeDuration(duration: string | null) {
  return duration === "extra_time" || duration === "penalties";
}

function haversineDistanceKm(
  from: Pick<VenueBodyProfile, "latitude" | "longitude">,
  to: Pick<VenueBodyProfile, "latitude" | "longitude">,
) {
  const earthRadiusKm = 6371;
  const latitudeDelta = degreesToRadians(to.latitude - from.latitude);
  const longitudeDelta = degreesToRadians(to.longitude - from.longitude);
  const fromLatitude = degreesToRadians(from.latitude);
  const toLatitude = degreesToRadians(to.latitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

function weatherForecastModifier(
  context: ForecastContextRow | null,
  homeRatings: TeamRatings,
  awayRatings: TeamRatings,
) {
  const temperature = toOptionalNumber(context?.temperature_c);
  const wind = toOptionalNumber(context?.wind_kph);
  const humidity = toOptionalNumber(context?.humidity);
  const summary = context?.weather_summary ?? null;
  const summaryText = summary?.toLowerCase() ?? "";
  const kickoffHour = kickoffHourInTournamentZone(context?.starts_at);
  const isDayKickoff =
    kickoffHour !== null && kickoffHour >= 11 && kickoffHour < 18;
  const isLateKickoff =
    kickoffHour !== null && (kickoffHour >= 19 || kickoffHour < 2);
  const isHumid =
    (humidity !== null && humidity >= 65) ||
    summaryText.includes("humid") ||
    summaryText.includes("muggy");
  const hasAdverseSurface =
    summaryText.includes("rain") ||
    summaryText.includes("shower") ||
    summaryText.includes("slick") ||
    summaryText.includes("fog");
  const hasWindDrag = wind !== null && wind >= 18;
  let chaosDelta = 0;
  let confidenceDelta = 0;
  let drawDelta = 0;
  let gapMultiplier = 1;
  let xgDelta = 0;
  let homePower = 0;
  let awayPower = 0;
  let homeXgDelta = 0;
  let awayXgDelta = 0;
  const notes: string[] = [];
  const homeProfilePower = teamPower(homeRatings);
  const awayProfilePower = teamPower(awayRatings);
  const homeIsProfileFavorite = homeProfilePower >= awayProfilePower;
  const homeTechnicalEdge = technicalSeparationScore(homeRatings);
  const awayTechnicalEdge = technicalSeparationScore(awayRatings);

  if (temperature !== null) {
    if (temperature >= 30) {
      chaosDelta += 3;
      xgDelta -= 0.08;
      notes.push("heat can thin legs and make late defending messy");
    } else if (temperature <= 4) {
      chaosDelta += 2;
      xgDelta -= 0.04;
      notes.push("cold air can make the touch a little heavier");
    } else if (temperature >= 16 && temperature <= 24) {
      xgDelta += 0.03;
      notes.push("the temperature sits in a clean football window");
    }
  }

  if (temperature !== null && temperature >= 27 && isDayKickoff) {
    const heatStress =
      (temperature >= 32 ? 1 : 0.65) +
      (isHumid ? 0.45 : 0) +
      (temperature >= 30 ? 0.25 : 0);
    const compression = clampNumber(heatStress * 0.07, 0.04, 0.13);

    gapMultiplier -= compression;
    drawDelta += Math.round(heatStress * 2);
    chaosDelta += isHumid ? 2 : 1;
    confidenceDelta -= Math.round(1 + heatStress);
    xgDelta -= isHumid ? 0.07 : 0.04;
    const favoriteXgTax = clampNumber(0.04 + heatStress * 0.035, 0.05, 0.12);
    const underdogXgLift = clampNumber(0.015 + heatStress * 0.018, 0.02, 0.05);
    const favoritePowerTax = clampNumber(heatStress * 0.32, 0.2, 0.65);
    const underdogPowerLift = clampNumber(heatStress * 0.18, 0.12, 0.38);

    if (homeIsProfileFavorite) {
      homePower -= favoritePowerTax;
      awayPower += underdogPowerLift;
      homeXgDelta -= favoriteXgTax;
      awayXgDelta += underdogXgLift;
    } else {
      awayPower -= favoritePowerTax;
      homePower += underdogPowerLift;
      awayXgDelta -= favoriteXgTax;
      homeXgDelta += underdogXgLift;
    }

    notes.push(
      isHumid
        ? "day heat and humidity compress the favorite's edge and slow the chase"
        : "day heat pulls tempo down and gives the underdog a little more cover",
    );
  } else if (temperature !== null && temperature >= 27 && isLateKickoff) {
    chaosDelta += isHumid ? 1 : 0;
    xgDelta -= isHumid ? 0.03 : 0;
    notes.push("the later kickoff softens the heat tax without erasing it entirely");
  } else if (
    isLateKickoff &&
    temperature !== null &&
    temperature >= 14 &&
    temperature <= 26 &&
    !isHumid &&
    !hasWindDrag &&
    !hasAdverseSurface
  ) {
    gapMultiplier += 0.04;
    drawDelta -= 1;
    confidenceDelta += 1;
    xgDelta += 0.02;
    const technicalGap = Math.abs(homeTechnicalEdge - awayTechnicalEdge);

    if (technicalGap >= 3) {
      const qualityLift = clampNumber(0.025 + technicalGap * 0.004, 0.03, 0.08);
      const qualityPower = clampNumber(technicalGap * 0.09, 0.25, 0.75);

      if (homeTechnicalEdge > awayTechnicalEdge) {
        homePower += qualityPower;
        homeXgDelta += qualityLift;
      } else {
        awayPower += qualityPower;
        awayXgDelta += qualityLift;
      }
    }

    notes.push("a cooler late kickoff lets quality and legs separate more cleanly");
  }

  if (hasWindDrag) {
    chaosDelta += wind >= 28 ? 4 : 2;
    xgDelta -= wind >= 28 ? 0.12 : 0.06;
    notes.push("wind adds noise to diagonals and dead balls");
    const setPiecePower = setPieceModifier(homeRatings, awayRatings, wind >= 28 ? 0.55 : 0.3);
    homePower += setPiecePower.home;
    awayPower += setPiecePower.away;
  }

  if (
    summaryText.includes("rain") ||
    summaryText.includes("shower") ||
    summaryText.includes("slick")
  ) {
    chaosDelta += 4;
    xgDelta -= 0.06;
    notes.push("a slick surface can turn rebounds into little emergencies");
    const setPiecePower = setPieceModifier(homeRatings, awayRatings, 0.45);
    homePower += setPiecePower.home;
    awayPower += setPiecePower.away;
  } else if (summaryText.includes("clear") || summaryText.includes("clean")) {
    chaosDelta -= 1;
    notes.push("clear conditions give the cleaner passers a little more oxygen");
  } else if (summaryText.includes("fog")) {
    chaosDelta += 3;
    xgDelta -= 0.05;
    notes.push("foggy edges make long balls and second balls harder to read");
  }

  const hasWeather =
    temperature !== null ||
    wind !== null ||
    humidity !== null ||
    summary !== null ||
    kickoffHour !== null;
  const factor = hasWeather
    ? {
        label: "Weather drift",
        weight: 0.5,
        explanation:
          notes.length > 0
            ? `Weather nudges the read: ${sentenceList(notes)}.`
            : "Weather is synced but not forceful enough to move the forecast lane.",
      }
    : null;

  return {
    chaosDelta,
    confidenceDelta,
    drawDelta,
    factor,
    gapMultiplier: clampNumber(gapMultiplier, 0.84, 1.08),
    homePower,
    homeXgDelta,
    awayPower,
    awayXgDelta,
    xgDelta,
    payload: {
      temperatureC: temperature,
      windKph: wind,
      humidity,
      kickoffHour,
      daypart:
        kickoffHour === null ? null : isDayKickoff ? "day" : isLateKickoff ? "late" : "evening",
      summary,
      homePower: roundModifier(homePower),
      awayPower: roundModifier(awayPower),
      homeXgDelta: roundModifier(homeXgDelta),
      awayXgDelta: roundModifier(awayXgDelta),
      chaosDelta,
      confidenceDelta,
      drawDelta,
      gapMultiplier: roundModifier(clampNumber(gapMultiplier, 0.84, 1.08)),
      xgDelta: roundModifier(xgDelta),
    },
  };
}

function tournamentFormModifier({
  homeTeam,
  awayTeam,
  homeRatings,
  awayRatings,
  context,
}: {
  homeTeam: FootballDataTeam;
  awayTeam: FootballDataTeam;
  homeRatings: TeamRatings;
  awayRatings: TeamRatings;
  context: ForecastContextRow | null;
}) {
  const home = tournamentFormSide("home", homeTeam, homeRatings, context);
  const away = tournamentFormSide("away", awayTeam, awayRatings, context);
  const formGap = home.signal - away.signal;
  const priorGap =
    teamPowerWithStanding(homeTeam, homeRatings) -
    teamPowerWithStanding(awayTeam, awayRatings);
  const contradictsPrior = Math.abs(formGap) >= 0.65 && formGap * priorGap < 0;
  const confirmsPrior = Math.abs(formGap) >= 0.9 && formGap * priorGap > 0;
  const chaosDelta = contradictsPrior ? 2 : confirmsPrior ? -1 : 0;
  const confidenceDelta = confirmsPrior ? 1 : contradictsPrior ? -1 : 0;
  const active = home.matches > 0 || away.matches > 0;
  const leader =
    Math.abs(formGap) < 0.35 ? null : formGap > 0 ? homeTeam.name : awayTeam.name;
  const factor =
    active && leader
      ? {
          label: "Tournament form",
          weight: 0.52,
          explanation: `${leader} have shown the better tournament pulse so far, but the Seer keeps the adjustment bounded until the sample grows.`,
        }
      : active
        ? {
            label: "Tournament form",
            weight: 0.38,
            explanation:
              "Early tournament results are in the model, but the form gap is not loud enough to shove the forecast.",
          }
        : null;

  return {
    homePower: home.powerDelta,
    awayPower: away.powerDelta,
    homeXgDelta: home.xgDelta,
    awayXgDelta: away.xgDelta,
    chaosDelta,
    confidenceDelta,
    factor,
    payload: {
      status: active ? "active" : "pending",
      leader,
      formGap: roundModifier(formGap),
      contradictsPrior,
      confirmsPrior,
      confidenceDelta,
      chaosDelta,
      home: home.payload,
      away: away.payload,
    },
  };
}

function tournamentFormSide(
  side: "home" | "away",
  team: FootballDataTeam,
  ratings: TeamRatings,
  context: ForecastContextRow | null,
) {
  const matches =
    toOptionalNumber(
      side === "home"
        ? context?.home_tournament_matches
        : context?.away_tournament_matches,
    ) ?? 0;
  const points =
    toOptionalNumber(
      side === "home"
        ? context?.home_tournament_points
        : context?.away_tournament_points,
    ) ?? 0;
  const goalDiff =
    toOptionalNumber(
      side === "home"
        ? context?.home_tournament_goal_diff
        : context?.away_tournament_goal_diff,
    ) ?? 0;

  if (matches <= 0) {
    return {
      matches: 0,
      signal: 0,
      powerDelta: 0,
      xgDelta: 0,
      payload: {
        team: team.code,
        matches: 0,
        status: "pending",
      },
    };
  }

  const priorPower = teamPowerWithStanding(team, ratings);
  const pointsPerMatch = points / matches;
  const goalDiffPerMatch = goalDiff / matches;
  const expectedPointsPerMatch = clampNumber((priorPower - 44) / 18, 0.45, 2.35);
  const performanceIndex = pointsPerMatch + goalDiffPerMatch * 0.42;
  let rawDelta = performanceIndex - expectedPointsPerMatch;

  if (priorPower < 60 && rawDelta > 0) {
    rawDelta *= 1.1;
  }

  if (priorPower > 76 && rawDelta < 0) {
    rawDelta *= 1.15;
  }

  const trust = matches === 1 ? 0.45 : matches === 2 ? 0.72 : 0.9;
  const signal = rawDelta * trust;
  const powerDelta = clampNumber(signal * 1.45, -2.5, 2.5);
  const xgDelta = clampNumber(signal * 0.055, -0.11, 0.11);

  return {
    matches,
    signal,
    powerDelta,
    xgDelta,
    payload: {
      team: team.code,
      matches,
      points,
      goalDiff,
      pointsPerMatch: roundModifier(pointsPerMatch),
      goalDiffPerMatch: roundModifier(goalDiffPerMatch),
      expectedPointsPerMatch: roundModifier(expectedPointsPerMatch),
      rawDelta: roundModifier(rawDelta),
      trust: roundModifier(trust),
      signal: roundModifier(signal),
      powerDelta: roundModifier(powerDelta),
      xgDelta: roundModifier(xgDelta),
      status:
        signal >= 0.45
          ? "overperforming"
          : signal <= -0.45
            ? "underperforming"
            : "holding",
    },
  };
}

function refereeForecastModifier(
  context: ForecastContextRow | null,
  homeRatings: TeamRatings,
  awayRatings: TeamRatings,
) {
  const cardsPerMatch = toOptionalNumber(context?.cards_per_match);
  const refereeName = context?.referee_name ?? null;
  let chaosDelta = 0;
  let homePower = 0;
  let awayPower = 0;
  let homeXgDelta = 0;
  let awayXgDelta = 0;
  let explanation: string | null = null;

  if (cardsPerMatch !== null) {
    if (cardsPerMatch >= 4.2) {
      chaosDelta += 4;
      const setPiecePower = setPieceModifier(homeRatings, awayRatings, 0.55);
      homePower += setPiecePower.home;
      awayPower += setPiecePower.away;
      homeXgDelta += setPiecePower.home > 0 ? 0.04 : 0;
      awayXgDelta += setPiecePower.away > 0 ? 0.04 : 0;
      explanation =
        "the assigned referee profile points to a choppier match, so set pieces and cards get louder";
    } else if (cardsPerMatch >= 3.3) {
      chaosDelta += 1;
      explanation =
        "the referee rhythm is active enough to keep contact and restarts in the read";
    } else {
      chaosDelta -= 2;
      explanation =
        "the referee profile looks calmer, which trims some card noise from the forecast";
    }
  }

  const factor =
    refereeName && refereeName !== "Assignment pending" && explanation
      ? {
          label: "Referee rhythm",
          weight: 0.45,
          explanation: `${refereeName}: ${explanation}.`,
        }
      : null;

  return {
    awayPower,
    awayXgDelta,
    chaosDelta,
    factor,
    homePower,
    homeXgDelta,
    payload: {
      refereeName,
      cardsPerMatch,
      homePower: roundModifier(homePower),
      awayPower: roundModifier(awayPower),
      homeXgDelta: roundModifier(homeXgDelta),
      awayXgDelta: roundModifier(awayXgDelta),
      chaosDelta,
    },
  };
}

function spotlightGravityModifier(
  homeTeam: FootballDataTeam,
  awayTeam: FootballDataTeam,
) {
  const homePower = spotlightGravity(homeTeam);
  const awayPower = spotlightGravity(awayTeam);
  const gap = Math.abs(homePower - awayPower);
  const chaosDelta = gap >= 1.4 ? 1 : 0;
  const strongerTeam =
    homePower === awayPower
      ? null
      : homePower > awayPower
        ? homeTeam.name
        : awayTeam.name;
  const factor =
    strongerTeam && gap >= 1
      ? {
          label: "Spotlight gravity",
          weight: 0.35,
          explanation:
            `${strongerTeam} carry more global attention and neutral fan pull, a small nudge that matters most in tight rooms.`,
        }
      : null;

  return {
    awayPower,
    chaosDelta,
    factor,
    homePower,
    payload: {
      home: roundModifier(homePower),
      away: roundModifier(awayPower),
      chaosDelta,
    },
  };
}

function vipSpotlightModifier(
  context: ForecastContextRow | null,
  homeTeam: FootballDataTeam,
  awayTeam: FootballDataTeam,
) {
  const active = isVipSpotlightActive(context?.external_id);
  const homeIconBoost = active ? marqueeIconBoost(homeTeam) : 0;
  const awayIconBoost = active ? marqueeIconBoost(awayTeam) : 0;
  const gap = Math.abs(homeIconBoost - awayIconBoost);
  const strongerTeam =
    homeIconBoost === awayIconBoost
      ? null
      : homeIconBoost > awayIconBoost
        ? homeTeam.name
        : awayTeam.name;
  const homeXgDelta = homeIconBoost > 0 ? 0.02 + homeIconBoost * 0.018 : 0;
  const awayXgDelta = awayIconBoost > 0 ? 0.02 + awayIconBoost * 0.018 : 0;
  const chaosDelta = active && gap >= 0.45 ? -1 : 0;
  const confidenceDelta = active && gap >= 0.45 ? 1 : 0;
  const factor =
    active && strongerTeam
      ? {
          label: "VIP spotlight",
          weight: 0.22,
          explanation:
            `${strongerTeam} get a tiny stage-pressure nudge from the bigger room. It colours tight calls, but it does not drive the forecast.`,
        }
      : null;

  return {
    active,
    awayPower: awayIconBoost,
    awayXgDelta,
    chaosDelta,
    confidenceDelta,
    factor,
    homePower: homeIconBoost,
    homeXgDelta,
    payload: {
      active,
      matchId: context?.external_id ?? null,
      home: roundModifier(homeIconBoost),
      away: roundModifier(awayIconBoost),
      homeXgDelta: roundModifier(homeXgDelta),
      awayXgDelta: roundModifier(awayXgDelta),
      chaosDelta,
      confidenceDelta,
      strongerTeam,
    },
  };
}

function isVipSpotlightActive(matchId: string | null | undefined) {
  const mode = process.env.MATCHSEER_VIP_SPOTLIGHT?.trim().toLowerCase();

  if (mode === "always" || mode === "true" || mode === "1") {
    return true;
  }

  if (!matchId) {
    return false;
  }

  const configuredIds = (
    process.env.MATCHSEER_VIP_SPOTLIGHT_MATCH_IDS ??
    process.env.MATCHSEER_FIFA_PRESIDENT_MATCH_IDS ??
    ""
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return configuredIds.includes("*") || configuredIds.includes(matchId);
}

function marqueeIconBoost(team: FootballDataTeam) {
  const byCode: Record<string, number> = {
    ARG: 0.75,
    FRA: 0.58,
    BRA: 0.5,
    POR: 0.38,
  };
  const byName: Record<string, number> = {
    argentina: 0.75,
    france: 0.58,
    brazil: 0.5,
    brasil: 0.5,
    portugal: 0.38,
  };
  const codeBoost = byCode[team.code.toUpperCase()] ?? 0;
  const nameBoost = byName[team.name.toLowerCase()] ?? 0;

  return Math.max(codeBoost, nameBoost);
}

function forecastPlayerContexts(context: ForecastContextRow | null) {
  if (!Array.isArray(context?.player_availability)) {
    return [];
  }

  return context.player_availability.filter(
    (player): player is ForecastPlayerContext =>
      (player.teamSide === "home" || player.teamSide === "away") &&
      typeof player.name === "string" &&
      player.name.trim().length > 0,
  );
}

type PlayerModifierImpact = {
  name: string;
  reason: string;
  penalty: number;
  dependency: number;
  benchDepth: number;
  dependencyNote: string;
  multiplier: number;
};

export function availabilityForecastModifier(players: ForecastPlayerContext[]) {
  const homeImpacts: PlayerModifierImpact[] = [];
  const awayImpacts: PlayerModifierImpact[] = [];
  const confirmedStarters: PlayerModifierImpact[] = [];
  const suspensionRisks: PlayerModifierImpact[] = [];
  let homePenalty = 0;
  let awayPenalty = 0;
  let homeXgPenalty = 0;
  let awayXgPenalty = 0;
  let chaosDelta = 0;
  let confirmedLineupCount = 0;

  for (const player of players) {
    const availability = availabilitySeverity(player);
    const lineupSeverity = playerLineupSeverity(player);
    const severity = Math.max(availability, lineupSeverity);
    const cardRisk = playerCardRisk(player);
    const lineupStatus = normalizeLineupStatus(player.lineupStatus);

    if (isConfirmedLineupStatus(lineupStatus)) {
      confirmedLineupCount += 1;
    }

    if (severity === 0 && cardRisk === 0) {
      if (lineupStatus === "confirmed_start") {
        const dependency = playerDependencyImpact(player);

        confirmedStarters.push({
          name: player.name,
          reason: "is confirmed in the XI",
          penalty: 0,
          ...dependency,
        });
      }

      continue;
    }

    const impact = playerImpactScore(player);
    const dependency = playerDependencyImpact(player);
    const penalty = clampNumber(
      (severity * impact + cardRisk * impact) * dependency.multiplier,
      0.15,
      4.8,
    );
    const xgPenalty = clampNumber(penalty * 0.04, 0.01, 0.24);
    const reason = playerAvailabilityReason(player, severity, cardRisk);
    const bucket = player.teamSide === "home" ? homeImpacts : awayImpacts;

    bucket.push({
      name: player.name,
      reason,
      penalty,
      ...dependency,
    });
    chaosDelta += severity >= 2 ? 2 : cardRisk > 0 ? 1 : 0;

    if (cardRisk > 0 && severity < 2) {
      suspensionRisks.push({
        name: player.name,
        reason,
        penalty,
        ...dependency,
      });
    }

    if (player.teamSide === "home") {
      homePenalty += penalty;
      homeXgPenalty += xgPenalty;
    } else {
      awayPenalty += penalty;
      awayXgPenalty += xgPenalty;
    }
  }

  homePenalty = clampNumber(homePenalty, 0, 7);
  awayPenalty = clampNumber(awayPenalty, 0, 7);
  homeXgPenalty = clampNumber(homeXgPenalty, 0, 0.42);
  awayXgPenalty = clampNumber(awayXgPenalty, 0, 0.42);
  chaosDelta = clamp(Math.round(chaosDelta), 0, 6);
  const confidenceDelta = clamp(
    Math.round(
      confirmedStarters.length * 0.7 -
        homeImpacts.length * 0.25 -
        awayImpacts.length * 0.25 -
        suspensionRisks.length * 0.25,
    ),
    -3,
    2,
  );

  const impacted = [...homeImpacts, ...awayImpacts]
    .sort((a, b) => b.penalty - a.penalty)
    .slice(0, 3);
  const factor =
    impacted.length > 0
      ? {
          label: "Availability watch",
          weight: 0.65,
          explanation: `Key-player board moved: ${sentenceList(
            impacted.map((player) =>
              `${player.name} ${player.reason}${
                player.multiplier >= 1.05 ? " with extra team dependency" : ""
              }`,
            ),
          )}.`,
        }
      : confirmedLineupCount > 0
        ? {
            label: "Confirmed lineups",
            weight: 0.48,
            explanation:
              confirmedStarters.length > 0
                ? `Lineup sheet steadies the read: ${sentenceList(
                    confirmedStarters
                      .slice(0, 3)
                      .map((player) => `${player.name} is confirmed in the XI`),
                  )}.`
                : "Lineup sheet is synced, and the key-player board does not flag a major absence.",
          }
      : null;

  return {
    awayPenalty,
    awayXgPenalty,
    chaosDelta,
    confidenceDelta,
    factor,
    homePenalty,
    homeXgPenalty,
    payload: {
      status:
        players.length > 0
          ? impacted.length > 0
            ? "availability-signals-active"
            : confirmedLineupCount > 0
              ? "lineups-confirmed"
            : "watchlist-clear"
          : "pending-player-availability-feed",
      watchedPlayers: players.length,
      teamDependency: availabilityTeamDependencyPayload(players),
      confirmedLineupCount,
      suspensionRiskCount: suspensionRisks.length,
      impactedPlayers: impacted.map((player) => ({
        name: player.name,
        reason: player.reason,
        penalty: roundModifier(player.penalty),
        dependency: roundModifier(player.dependency),
        benchDepth: roundModifier(player.benchDepth),
        dependencyMultiplier: roundModifier(player.multiplier),
        dependencyNote: player.dependencyNote,
      })),
      confirmedStarters: confirmedStarters.slice(0, 4).map((player) => ({
        name: player.name,
        dependency: roundModifier(player.dependency),
        benchDepth: roundModifier(player.benchDepth),
        dependencyMultiplier: roundModifier(player.multiplier),
        dependencyNote: player.dependencyNote,
      })),
      homePenalty: roundModifier(homePenalty),
      awayPenalty: roundModifier(awayPenalty),
      homeXgPenalty: roundModifier(homeXgPenalty),
      awayXgPenalty: roundModifier(awayXgPenalty),
      chaosDelta,
      confidenceDelta,
    },
  };
}

export function fatigueForecastModifier(
  players: ForecastPlayerContext[],
  context: ForecastContextRow | null,
) {
  const homeRestHours = toOptionalNumber(context?.home_rest_hours);
  const awayRestHours = toOptionalNumber(context?.away_rest_hours);
  const homeImpacts: PlayerModifierImpact[] = [];
  const awayImpacts: PlayerModifierImpact[] = [];
  let homePenalty = 0;
  let awayPenalty = 0;
  let homeXgPenalty = 0;
  let awayXgPenalty = 0;
  let chaosDelta = 0;

  for (const player of players) {
    const minutesRecent = toOptionalNumber(player.minutesRecent) ?? 0;
    const restHours = player.teamSide === "home" ? homeRestHours : awayRestHours;
    const restStress = fatigueRestStress(restHours);

    if (minutesRecent <= 0 || restStress <= 0) {
      continue;
    }

    const age = toOptionalNumber(player.age);
    const minuteLoad = clampNumber(minutesRecent / 270, 0.15, 1.2);
    const impact = playerImpactScore(player);
    const ageMultiplier = fatigueAgeMultiplier(age);
    const dependency = playerDependencyImpact(player);
    const penalty = clampNumber(
      impact * minuteLoad * restStress * ageMultiplier * dependency.multiplier,
      0,
      3.3,
    );

    if (penalty < 0.18) {
      continue;
    }

    const reason =
      restHours === null
        ? "carries recent-minute fatigue"
        : `carries recent-minute fatigue on ${Math.round(restHours)}h rest`;
    const bucket = player.teamSide === "home" ? homeImpacts : awayImpacts;

    bucket.push({ name: player.name, reason, penalty, ...dependency });
    chaosDelta += penalty >= 1 ? 1 : 0;

    if (player.teamSide === "home") {
      homePenalty += penalty;
      homeXgPenalty += penalty * 0.035;
    } else {
      awayPenalty += penalty;
      awayXgPenalty += penalty * 0.035;
    }
  }

  homePenalty = clampNumber(homePenalty, 0, 4);
  awayPenalty = clampNumber(awayPenalty, 0, 4);
  homeXgPenalty = clampNumber(homeXgPenalty, 0, 0.26);
  awayXgPenalty = clampNumber(awayXgPenalty, 0, 0.26);
  chaosDelta = clamp(Math.round(chaosDelta), 0, 4);

  const impacted = [...homeImpacts, ...awayImpacts]
    .sort((a, b) => b.penalty - a.penalty)
    .slice(0, 3);
  const factor =
    impacted.length > 0
      ? {
          label: "Legs and recovery",
          weight: 0.45,
          explanation: `Fatigue nudges the read: ${sentenceList(
            impacted.map((player) => `${player.name} ${player.reason}`),
          )}.`,
        }
      : null;

  return {
    awayPenalty,
    awayXgPenalty,
    chaosDelta,
    factor,
    homePenalty,
    homeXgPenalty,
    payload: {
      status:
        players.length > 0
          ? impacted.length > 0
            ? "fatigue-signals-active"
            : "watchlist-clear"
          : "pending-minutes-age-travel-feed",
      homeRestHours:
        homeRestHours === null ? null : Math.round(homeRestHours * 10) / 10,
      awayRestHours:
        awayRestHours === null ? null : Math.round(awayRestHours * 10) / 10,
      impactedPlayers: impacted.map((player) => ({
        name: player.name,
        reason: player.reason,
        penalty: roundModifier(player.penalty),
        dependency: roundModifier(player.dependency),
        benchDepth: roundModifier(player.benchDepth),
        dependencyMultiplier: roundModifier(player.multiplier),
        dependencyNote: player.dependencyNote,
      })),
      homePenalty: roundModifier(homePenalty),
      awayPenalty: roundModifier(awayPenalty),
      homeXgPenalty: roundModifier(homeXgPenalty),
      awayXgPenalty: roundModifier(awayXgPenalty),
      chaosDelta,
    },
  };
}

function availabilitySeverity(player: ForecastPlayerContext) {
  const status = normalizedPlayerStatus(player.availabilityStatus);
  const redCards = toOptionalNumber(player.redCards) ?? 0;
  const yellowCards = toOptionalNumber(player.yellowCards) ?? 0;

  if (
    player.isSuspended ||
    redCards > 0 ||
    status.includes("suspend") ||
    yellowCards >= yellowCardSuspensionThreshold
  ) {
    return 3.4;
  }

  if (
    status.includes("out") ||
    status.includes("injur") ||
    status.includes("unavailable") ||
    hasRedCardStatus(status)
  ) {
    return 3;
  }

  if (
    status.includes("doubt") ||
    status.includes("sick") ||
    status.includes("ill") ||
    status.includes("knock") ||
    status.includes("limited") ||
    status.includes("question")
  ) {
    return 1.7;
  }

  return 0;
}

function playerLineupSeverity(player: ForecastPlayerContext) {
  const lineupStatus = normalizeLineupStatus(player.lineupStatus);

  if (lineupStatus === "not_in_squad") {
    return 3.2;
  }

  if (lineupStatus === "bench") {
    return 1.45;
  }

  return 0;
}

function playerCardRisk(player: ForecastPlayerContext) {
  const yellowCards = toOptionalNumber(player.yellowCards) ?? 0;

  if (yellowCards >= yellowCardSuspensionThreshold) {
    return 0;
  }

  if (yellowCards === yellowCardSuspensionThreshold - 1) {
    return 0.62;
  }

  return 0;
}

function playerAvailabilityReason(
  player: ForecastPlayerContext,
  severity: number,
  cardRisk: number,
) {
  const status = normalizedPlayerStatus(player.availabilityStatus);
  const lineupStatus = normalizeLineupStatus(player.lineupStatus);
  const yellowCards = toOptionalNumber(player.yellowCards) ?? 0;

  if (lineupStatus === "not_in_squad") {
    return "is missing from the confirmed squad";
  }

  if (lineupStatus === "bench") {
    return "starts on the bench";
  }

  if (yellowCards >= yellowCardSuspensionThreshold) {
    return "is suspended by yellow-card accumulation";
  }

  if (player.isSuspended || status.includes("suspend")) {
    return "is suspended";
  }

  if ((toOptionalNumber(player.redCards) ?? 0) > 0 || hasRedCardStatus(status)) {
    return "is red-card flagged";
  }

  if (status.includes("injur") || status.includes("out") || status.includes("unavailable")) {
    return "is not fully available";
  }

  if (severity > 0) {
    return "is limited";
  }

  return cardRisk >= 0.6
    ? "is one booking from suspension risk"
    : "is carrying card risk";
}

function normalizedPlayerStatus(value: string | null) {
  return (value ?? "available").toLowerCase().trim();
}

function hasRedCardStatus(status: string) {
  return (
    status === "red" ||
    status.includes("red card") ||
    status.includes("red-card")
  );
}

function playerImpactScore(player: ForecastPlayerContext) {
  const importance = toOptionalNumber(player.importance);
  const spark = toOptionalNumber(player.spark);
  const rawImpact = importance ?? spark ?? 50;

  return clampNumber((rawImpact - 42) / 44, 0.18, 1.35);
}

export function playerDependencyImpact(player: ForecastPlayerContext) {
  const profile =
    teamDependencyProfiles[player.teamCode.toUpperCase()] ??
    DEFAULT_TEAM_DEPENDENCY;
  const multiplier = clampNumber(
    0.72 + profile.dependency * 0.62 - profile.benchDepth * 0.28,
    0.58,
    1.24,
  );

  return {
    dependency: profile.dependency,
    benchDepth: profile.benchDepth,
    dependencyNote: profile.note,
    multiplier,
  };
}

function availabilityTeamDependencyPayload(players: ForecastPlayerContext[]) {
  const byTeam = new Map<
    string,
    {
      side: "home" | "away";
      teamCode: string;
      teamName: string;
      watchedPlayers: number;
      profile: typeof DEFAULT_TEAM_DEPENDENCY;
    }
  >();

  for (const player of players) {
    const teamCode = player.teamCode.toUpperCase();

    if (!byTeam.has(teamCode)) {
      byTeam.set(teamCode, {
        side: player.teamSide,
        teamCode,
        teamName: player.teamName,
        watchedPlayers: 0,
        profile: teamDependencyProfiles[teamCode] ?? DEFAULT_TEAM_DEPENDENCY,
      });
    }

    const record = byTeam.get(teamCode);

    if (record) {
      record.watchedPlayers += 1;
    }
  }

  return Array.from(byTeam.values()).map((record) => ({
    side: record.side,
    teamCode: record.teamCode,
    teamName: record.teamName,
    watchedPlayers: record.watchedPlayers,
    dependency: roundModifier(record.profile.dependency),
    benchDepth: roundModifier(record.profile.benchDepth),
    note: record.profile.note,
  }));
}

function fatigueRestStress(restHours: number | null) {
  if (restHours === null) {
    return 0.25;
  }

  if (restHours < 72) {
    return 1.25;
  }

  if (restHours < 96) {
    return 0.85;
  }

  if (restHours < 120) {
    return 0.45;
  }

  return 0;
}

function fatigueAgeMultiplier(age: number | null) {
  if (age === null) {
    return 1;
  }

  if (age >= 36) {
    return 1.45;
  }

  if (age >= 32) {
    return 1.18;
  }

  if (age <= 23) {
    return 0.78;
  }

  return 1;
}

function spotlightGravity(team: FootballDataTeam) {
  const byCode: Record<string, number> = {
    ARG: 2.5,
    BRA: 2.45,
    FRA: 2.35,
    ESP: 2.15,
    ENG: 2.1,
    GER: 2,
    POR: 1.95,
    NED: 1.7,
    MEX: 1.6,
    USA: 1.4,
    ITA: 1.35,
    MAR: 1.05,
    CAN: 0.85,
    JPN: 0.8,
    KOR: 0.78,
  };
  const byName: Record<string, number> = {
    argentina: 2.5,
    brazil: 2.45,
    brasil: 2.45,
    france: 2.35,
    spain: 2.15,
    england: 2.1,
    germany: 2,
    portugal: 1.95,
    netherlands: 1.7,
    mexico: 1.6,
    usa: 1.4,
    "united states": 1.4,
  };
  const code = team.code.toUpperCase();
  const name = team.name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return clampNumber(byCode[code] ?? byName[name] ?? 0, 0, 2.5);
}

type TournamentRealityModifier = {
  side: "home" | "away" | null;
  severity: number;
  favoriteMinGoals: number;
  underdogMaxGoals: number | null;
  underdogCapReliefXg: number;
  minMargin: number;
  factor: { label: string; weight: number; explanation: string } | null;
  payload: Record<string, unknown>;
};

function tournamentRealityScoreModifier({
  homeTeam,
  awayTeam,
  homeRatings,
  awayRatings,
  homePower,
  awayPower,
  homeProbability,
  awayProbability,
  chaos,
  context,
}: {
  homeTeam: FootballDataTeam;
  awayTeam: FootballDataTeam;
  homeRatings: TeamRatings;
  awayRatings: TeamRatings;
  homePower: number;
  awayPower: number;
  homeProbability: number;
  awayProbability: number;
  chaos: number;
  context: ForecastContextRow | null;
}): TournamentRealityModifier {
  const homePrior = tournamentFloorPower(homeTeam, homeRatings);
  const awayPrior = tournamentFloorPower(awayTeam, awayRatings);
  const probabilityGap = homeProbability - awayProbability;
  const powerGap = homePower - awayPower;
  const clearHomeFavorite = probabilityGap >= 18 || powerGap >= 14;
  const clearAwayFavorite = probabilityGap <= -18 || powerGap <= -14;

  if (!clearHomeFavorite && !clearAwayFavorite) {
    return inactiveTournamentReality({
      homePrior,
      awayPrior,
      status: "balanced-matchup",
    });
  }

  const side = clearHomeFavorite ? "home" : "away";
  const favorite =
    side === "home"
      ? { team: homeTeam, ratings: homeRatings, power: homePower, prior: homePrior }
      : { team: awayTeam, ratings: awayRatings, power: awayPower, prior: awayPrior };
  const underdog =
    side === "home"
      ? { team: awayTeam, ratings: awayRatings, power: awayPower, prior: awayPrior }
      : { team: homeTeam, ratings: homeRatings, power: homePower, prior: homePrior };
  const powerSeparation = favorite.power - underdog.power;
  const priorSeparation = favorite.prior - underdog.prior;
  const underdogWeakness = tournamentFloorWeakness(
    underdog.team,
    underdog.ratings,
    underdog.prior,
  );
  const favoriteStrength =
    clampNumber((powerSeparation - 10) / 18, 0, 1) +
    clampNumber((priorSeparation - 16) / 28, 0, 0.55);
  const surpriseCredit = tournamentSurpriseCredit(side === "home" ? "away" : "home", context);
  const chaosRelief = clampNumber((chaos - 62) / 34, 0, 0.4);
  const severity = clampNumber(
    underdogWeakness * 1.05 + favoriteStrength * 0.78 - surpriseCredit - chaosRelief,
    0,
    1.6,
  );

  if (severity < 0.35) {
    return inactiveTournamentReality({
      homePrior,
      awayPrior,
      status: surpriseCredit > 0 ? "surprise-credit-softened" : "floor-clear",
      side,
      severity,
      surpriseCredit,
    });
  }

  const favoriteMinGoals = severity >= 1.05 ? 3 : severity >= 0.55 ? 2 : 0;
  const underdogMaxGoals = severity >= 0.72 ? 0 : severity >= 0.45 ? 1 : null;
  const underdogCapReliefXg = severity >= 1.05 ? 1.48 : severity >= 0.72 ? 1.32 : 1.18;
  const minMargin = severity >= 0.95 ? 2 : 1;
  const softened = surpriseCredit > 0.25;
  const explanation = softened
    ? `${underdog.team.name} still carry a low tournament floor against ${favorite.team.name}, but earlier proof softens the scoreline tax.`
    : `${underdog.team.name} carry a low tournament floor against ${favorite.team.name}; the scoreline gets less polite until they prove otherwise.`;

  return {
    side,
    severity: roundModifier(severity),
    favoriteMinGoals,
    underdogMaxGoals,
    underdogCapReliefXg,
    minMargin,
    factor: {
      label: "Tournament floor",
      weight: 0.68,
      explanation,
    },
    payload: {
      status: "active",
      side,
      favorite: favorite.team.code,
      underdog: underdog.team.code,
      homePrior: roundModifier(homePrior),
      awayPrior: roundModifier(awayPrior),
      underdogWeakness: roundModifier(underdogWeakness),
      favoriteStrength: roundModifier(favoriteStrength),
      surpriseCredit: roundModifier(surpriseCredit),
      chaosRelief: roundModifier(chaosRelief),
      severity: roundModifier(severity),
      favoriteMinGoals,
      underdogMaxGoals,
      underdogCapReliefXg,
      minMargin,
    },
  };
}

function inactiveTournamentReality(payload: Record<string, unknown>): TournamentRealityModifier {
  return {
    side: null,
    severity: 0,
    favoriteMinGoals: 0,
    underdogMaxGoals: null,
    underdogCapReliefXg: 1.18,
    minMargin: 0,
    factor: null,
    payload: {
      status: "inactive",
      ...payload,
    },
  };
}

function tournamentFloorPower(team: FootballDataTeam, ratings: TeamRatings) {
  const code = team.code.toUpperCase();
  const nameKey = normalizeModelTeamKey(team.name);
  const profile =
    tournamentFloorProfilesByCode[code] ?? tournamentFloorProfilesByName[nameKey];
  const ratingsPower = teamPower(ratings);

  return clampNumber(profile?.power ?? ratingsPower, 35, 96);
}

function tournamentFloorWeakness(
  team: FootballDataTeam,
  ratings: TeamRatings,
  prior: number,
) {
  const code = team.code.toUpperCase();
  const nameKey = normalizeModelTeamKey(team.name);
  const profile =
    tournamentFloorProfilesByCode[code] ?? tournamentFloorProfilesByName[nameKey];
  const ratingsPower = teamPower(ratings);
  const ratingsWeakness = clampNumber((68 - ratingsPower) / 18, 0, 1);
  const priorWeakness = clampNumber((62 - prior) / 20, 0, 1);

  return clampNumber(
    Math.max(ratingsWeakness, priorWeakness) + (profile?.tax ?? 0),
    0,
    1.55,
  );
}

function tournamentSurpriseCredit(
  side: "home" | "away",
  context: ForecastContextRow | null,
) {
  const matches = toOptionalNumber(
    side === "home"
      ? context?.home_tournament_matches
      : context?.away_tournament_matches,
  ) ?? 0;
  const points = toOptionalNumber(
    side === "home"
      ? context?.home_tournament_points
      : context?.away_tournament_points,
  ) ?? 0;
  const goalDiff = toOptionalNumber(
    side === "home"
      ? context?.home_tournament_goal_diff
      : context?.away_tournament_goal_diff,
  ) ?? 0;

  if (matches <= 0) {
    return 0;
  }

  const pointsPerMatch = points / matches;
  const pointsCredit =
    pointsPerMatch >= 3 ? 0.95 : pointsPerMatch >= 1 ? 0.48 : 0;
  const goalCredit = goalDiff >= 2 ? 0.28 : goalDiff > 0 ? 0.16 : 0;
  const consistencyCredit = matches >= 2 && points >= 4 ? 0.32 : 0;

  return clampNumber(pointsCredit + goalCredit + consistencyCredit, 0, 1.35);
}

function normalizeModelTeamKey(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}


function setPieceModifier(
  homeRatings: TeamRatings,
  awayRatings: TeamRatings,
  scale: number,
) {
  const gap = homeRatings.setPieces - awayRatings.setPieces;

  if (Math.abs(gap) < 5) {
    return { home: 0, away: 0 };
  }

  const boost = clampNumber((Math.abs(gap) / 20) * scale, 0.1, scale);

  return gap > 0 ? { home: boost, away: 0 } : { home: 0, away: boost };
}

function sentenceList(values: string[]) {
  if (values.length <= 1) {
    return values[0] ?? "";
  }

  return `${values.slice(0, -1).join(", ")} and ${values[values.length - 1]}`;
}

function expectedGoals(
  attackingTeam: TeamRatings,
  defendingTeam: TeamRatings,
  venueBoost: number,
  dynamicXgModifier = 0,
) {
  return clampNumber(
    1.08 +
      (attackingTeam.attack - defendingTeam.defense) * 0.026 +
      (attackingTeam.control - defendingTeam.control) * 0.01 +
      (attackingTeam.setPieces - defendingTeam.setPieces) * 0.008 +
      venueBoost * 0.035 +
      dynamicXgModifier,
    0.35,
    3.2,
  );
}

export function opponentAdjustedExpectedGoals({
  homeXg,
  awayXg,
  homeRatings,
  awayRatings,
  tournamentForm,
}: {
  homeXg: number;
  awayXg: number;
  homeRatings: TeamRatings;
  awayRatings: TeamRatings;
  tournamentForm?: Record<string, unknown> | null;
}) {
  const homeContext = opponentXgSideAdjustment({
    rawXg: homeXg,
    attackRatings: homeRatings,
    opponentRatings: awayRatings,
    side: "home",
    tournamentForm,
  });
  const awayContext = opponentXgSideAdjustment({
    rawXg: awayXg,
    attackRatings: awayRatings,
    opponentRatings: homeRatings,
    side: "away",
    tournamentForm,
  });
  const adjustedHomeXg = roundXg(clampNumber(homeXg + homeContext.delta, 0.25, 3.8));
  const adjustedAwayXg = roundXg(clampNumber(awayXg + awayContext.delta, 0.25, 3.8));

  return {
    applied:
      Math.abs(adjustedHomeXg - roundXg(homeXg)) > 0.001 ||
      Math.abs(adjustedAwayXg - roundXg(awayXg)) > 0.001,
    homeXg: adjustedHomeXg,
    awayXg: adjustedAwayXg,
    preAdjustment: {
      homeXg: roundXg(homeXg),
      awayXg: roundXg(awayXg),
    },
    deltas: {
      homeXg: roundXg(adjustedHomeXg - roundXg(homeXg)),
      awayXg: roundXg(adjustedAwayXg - roundXg(awayXg)),
    },
    home: homeContext,
    away: awayContext,
  };
}

function opponentXgSideAdjustment({
  rawXg,
  attackRatings,
  opponentRatings,
  side,
  tournamentForm,
}: {
  rawXg: number;
  attackRatings: TeamRatings;
  opponentRatings: TeamRatings;
  side: "home" | "away";
  tournamentForm?: Record<string, unknown> | null;
}) {
  const opponentDefenseStrength =
    (opponentRatings.defense - 70) * 0.0042 +
    (opponentRatings.control - 70) * 0.0018;
  const attackQuality =
    (attackRatings.attack - 70) * 0.0015 +
    (attackRatings.control - 70) * 0.0008;
  const attackDanger =
    (attackRatings.attack - 70) * 0.003 +
    (attackRatings.control - 70) * 0.002;
  const form = readOpponentAdjustmentFormSignal(tournamentForm, side);
  const qualityGate = clampNumber((rawXg - 0.9) * 0.06, -0.025, 0.08);
  const defenseAdjustment = clampNumber(opponentDefenseStrength * (0.65 + rawXg * 0.22), -0.2, 0.2);
  const attackAdjustment = clampNumber(attackQuality * rawXg, -0.08, 0.08);
  const defensiveSuppression = clampNumber(0.95 - rawXg, 0, 0.65);
  const defensiveSuppressionAdjustment = clampNumber(
    -attackDanger * defensiveSuppression * 2.6,
    -0.12,
    0.12,
  );
  const formAdjustment = clampNumber(form * 0.035, -0.1, 0.1);
  const delta = clampNumber(
    defenseAdjustment +
      attackAdjustment +
      defensiveSuppressionAdjustment +
      formAdjustment +
      qualityGate,
    -0.28,
    0.28,
  );

  return {
    rawXg: roundXg(rawXg),
    adjustedXg: roundXg(clampNumber(rawXg + delta, 0.25, 3.8)),
    delta: roundXg(delta),
    opponentDefenseStrength: roundModifier(opponentDefenseStrength),
    attackQuality: roundModifier(attackQuality),
    defensiveSuppression: roundModifier(defensiveSuppressionAdjustment),
    tournamentFormSignal: roundModifier(form),
  };
}

function readOpponentAdjustmentFormSignal(
  tournamentForm: Record<string, unknown> | null | undefined,
  side: "home" | "away",
) {
  const sidePayload = readPayloadRecord(tournamentForm?.[side]);
  const formGap = readPayloadNumber(tournamentForm?.formGap) ?? 0;
  const teamSignal = readPayloadNumber(sidePayload?.signal) ?? 0;
  const gapSignal = side === "home" ? formGap * 0.08 : -formGap * 0.08;

  return clampNumber(teamSignal + gapSignal, -1.4, 1.4);
}

type GoalOutcomeSide = "home" | "draw" | "away";

type GoalDistributionCell = {
  homeGoals: number;
  awayGoals: number;
  probability: number;
  side: GoalOutcomeSide;
};

export type ExpectedGoalsDerivation = GoalModelForecast & {
  homeWin: number;
  draw: number;
  awayWin: number;
  projectedSide: GoalOutcomeSide;
};

export function deriveForecastFromExpectedGoals({
  homeXg,
  awayXg,
}: {
  homeXg: number;
  awayXg: number;
}): ExpectedGoalsDerivation {
  const homeDistribution = poissonDistribution(homeXg);
  const awayDistribution = poissonDistribution(awayXg);
  const cells: GoalDistributionCell[] = [];
  let homeShare = 0;
  let drawShare = 0;
  let awayShare = 0;
  let under25Share = 0;
  let totalMass = 0;

  for (let homeGoals = 0; homeGoals < homeDistribution.length; homeGoals += 1) {
    for (let awayGoals = 0; awayGoals < awayDistribution.length; awayGoals += 1) {
      const probability = homeDistribution[homeGoals] * awayDistribution[awayGoals];
      const side = goalOutcomeSide(homeGoals, awayGoals);

      totalMass += probability;

      if (side === "home") {
        homeShare += probability;
      } else if (side === "away") {
        awayShare += probability;
      } else {
        drawShare += probability;
      }

      if (homeGoals + awayGoals <= 2) {
        under25Share += probability;
      }

      cells.push({ homeGoals, awayGoals, probability, side });
    }
  }

  const normalizedHomeShare = homeShare / totalMass;
  const normalizedDrawShare = drawShare / totalMass;
  const normalizedAwayShare = awayShare / totalMass;
  const percentages = outcomePercentages({
    home: normalizedHomeShare,
    draw: normalizedDrawShare,
    away: normalizedAwayShare,
  });
  const projectedSide = leadingSide(
    percentages.home,
    percentages.draw,
    percentages.away,
  );
  const projectedCell =
    cells
      .filter((cell) => cell.side === projectedSide)
      .sort((left, right) => right.probability - left.probability)[0] ??
    cells.sort((left, right) => right.probability - left.probability)[0] ?? {
      homeGoals: 0,
      awayGoals: 0,
      probability: 0,
      side: "draw" as const,
    };
  const homeCleanSheet = Math.round(Math.exp(-awayXg) * 100);
  const awayCleanSheet = Math.round(Math.exp(-homeXg) * 100);
  const under25 = Math.round((under25Share / totalMass) * 100);
  const over25 = 100 - under25;
  const bothTeamsScore = Math.round(
    (1 - Math.exp(-homeXg)) * (1 - Math.exp(-awayXg)) * 100,
  );

  return {
    homeXg: roundXg(homeXg),
    awayXg: roundXg(awayXg),
    totalXg: roundXg(homeXg + awayXg),
    homeWin: percentages.home,
    draw: percentages.draw,
    awayWin: percentages.away,
    projectedSide,
    projectedScore: `${projectedCell.homeGoals}-${projectedCell.awayGoals}`,
    homeCleanSheet,
    awayCleanSheet,
    over25,
    under25,
    bothTeamsScore,
    signals: goalModelSignals({
      homeCleanSheet,
      awayCleanSheet,
      over25,
      under25,
      bothTeamsScore,
    }),
  };
}

function poissonDistribution(lambda: number, maxGoals = 8) {
  const probabilities: number[] = [Math.exp(-lambda)];

  for (let goals = 1; goals <= maxGoals; goals += 1) {
    probabilities[goals] = (probabilities[goals - 1] * lambda) / goals;
  }

  return probabilities;
}

function outcomePercentages({
  home,
  draw,
  away,
}: {
  home: number;
  draw: number;
  away: number;
}) {
  const raw = {
    home: home * 100,
    draw: draw * 100,
    away: away * 100,
  };
  const rounded = {
    home: Math.round(raw.home),
    draw: Math.round(raw.draw),
    away: Math.round(raw.away),
  };
  const total = rounded.home + rounded.draw + rounded.away;
  const diff = 100 - total;
  const largest = Object.entries(raw).sort(
    (left, right) => right[1] - left[1],
  )[0]?.[0] as "home" | "draw" | "away" | undefined;

  if (largest && diff !== 0) {
    rounded[largest] = clamp(rounded[largest] + diff, 0, 100);
  }

  return rounded;
}

function goalOutcomeSide(homeGoals: number, awayGoals: number): GoalOutcomeSide {
  if (homeGoals > awayGoals) {
    return "home";
  }

  if (awayGoals > homeGoals) {
    return "away";
  }

  return "draw";
}

function goalModelSignals({
  homeCleanSheet,
  awayCleanSheet,
  over25,
  under25,
  bothTeamsScore,
}: {
  homeCleanSheet: number;
  awayCleanSheet: number;
  over25: number;
  under25: number;
  bothTeamsScore: number;
}) {
  const signals: GoalModelForecast["signals"] = [];
  const cleanSheet = Math.max(homeCleanSheet, awayCleanSheet);

  if (over25 >= 57) {
    signals.push({
      id: "over-lean",
      label: { en: "Over lean", es: "Más goles", fr: "Plus de buts" },
      value: over25,
      tone: "over",
      text: {
        en: "The xG profile points toward a fuller scoreboard.",
        es: "El perfil xG apunta a un marcador más cargado.",
        fr: "Le profil xG pointe vers un score plus rempli.",
      },
    });
  } else if (under25 >= 57) {
    signals.push({
      id: "under-lean",
      label: { en: "Under lean", es: "Menos goles", fr: "Moins de buts" },
      value: under25,
      tone: "under",
      text: {
        en: "The xG profile sees a tighter total-goals lane.",
        es: "El perfil xG ve una ruta más cerrada de goles totales.",
        fr: "Le profil xG voit une voie plus serrée sur le total de buts.",
      },
    });
  }

  if (bothTeamsScore >= 54) {
    signals.push({
      id: "both-score",
      label: { en: "Both score", es: "Ambos anotan", fr: "Les deux marquent" },
      value: bothTeamsScore,
      tone: "over",
      text: {
        en: "Both attacks have enough xG oxygen to find one.",
        es: "Ambos ataques tienen suficiente oxígeno xG para encontrar uno.",
        fr: "Les deux attaques ont assez d'oxygène xG pour en trouver un.",
      },
    });
  }

  if (cleanSheet >= 34) {
    signals.push({
      id: "clean-sheet-watch",
      label: { en: "Clean sheet watch", es: "Portería en cero", fr: "Clean sheet" },
      value: cleanSheet,
      tone: "clean",
      text: {
        en: "One side has a live shutout lane in the xG model.",
        es: "Un lado tiene una ruta viva para dejar el arco en cero.",
        fr: "Un côté garde une vraie voie vers le match sans encaisser.",
      },
    });
  }

  if (signals.length === 0) {
    signals.push({
      id: "balanced-goals",
      label: { en: "Balanced total", es: "Total balanceado", fr: "Total équilibré" },
      value: Math.max(over25, under25),
      tone: "balanced",
      text: {
        en: "The xG total stays near the middle: neither goal script dominates.",
        es: "El total xG queda en el medio: ningún guion de goles domina.",
        fr: "Le total xG reste au milieu : aucun scénario de buts ne domine.",
      },
    });
  }

  return signals.slice(0, 3);
}

function applyTournamentRealityToExpectedGoals({
  homeXg,
  awayXg,
  tournamentReality,
}: {
  homeXg: number;
  awayXg: number;
  tournamentReality: TournamentRealityModifier;
}) {
  if (!tournamentReality.side || tournamentReality.severity <= 0) {
    return { homeXg, awayXg };
  }

  const severityLift = tournamentReality.severity * 0.14;
  let adjustedHomeXg = homeXg;
  let adjustedAwayXg = awayXg;

  if (tournamentReality.side === "home") {
    adjustedHomeXg += severityLift;

    if (tournamentReality.favoriteMinGoals > 0) {
      adjustedHomeXg = Math.max(
        adjustedHomeXg,
        tournamentReality.favoriteMinGoals - 0.35,
      );
    }

    if (tournamentReality.underdogMaxGoals !== null) {
      const relief =
        awayXg >= tournamentReality.underdogCapReliefXg ? 0.5 : 0.25;

      adjustedAwayXg = Math.min(
        adjustedAwayXg,
        tournamentReality.underdogMaxGoals + relief,
      );
    }
  }

  if (tournamentReality.side === "away") {
    adjustedAwayXg += severityLift;

    if (tournamentReality.favoriteMinGoals > 0) {
      adjustedAwayXg = Math.max(
        adjustedAwayXg,
        tournamentReality.favoriteMinGoals - 0.35,
      );
    }

    if (tournamentReality.underdogMaxGoals !== null) {
      const relief =
        homeXg >= tournamentReality.underdogCapReliefXg ? 0.5 : 0.25;

      adjustedHomeXg = Math.min(
        adjustedHomeXg,
        tournamentReality.underdogMaxGoals + relief,
      );
    }
  }

  return {
    homeXg: clampNumber(adjustedHomeXg, 0.25, 3.8),
    awayXg: clampNumber(adjustedAwayXg, 0.25, 3.8),
  };
}

function roundXg(value: number) {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function baselineInterpretationCopy(language: Language, projected: string) {
  const copy = {
    en: {
      headline: "The Seer is warming the lens",
      summary:
        "Fresh fixture data is in. Ask the Seer to turn the team shape, venue mood, and weather into a proper match trail.",
      toneLine: `The early trail sketches ${projected}, but the richer read wakes up when the Seer is called.`,
    },
    es: {
      headline: "El Vidente calienta la lente",
      summary:
        "Ya entraron datos reales del calendario. Pregunta al Vidente para convertir forma, sede y clima en una lectura con filo.",
      toneLine: `El rastro temprano dibuja ${projected}, pero la lectura rica despierta cuando llamas al Vidente.`,
    },
    fr: {
      headline: "Le voyant chauffe la lentille",
      summary:
        "Les données réelles du calendrier sont arrivées. Demande au voyant de transformer forme, stade et météo en vraie trace de match.",
      toneLine: `La trace initiale dessine ${projected}, mais la lecture riche s'allume quand le voyant est appelé.`,
    },
  };

  return copy[language];
}
