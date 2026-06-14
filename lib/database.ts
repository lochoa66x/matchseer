import { createHash } from "crypto";
import type {
  ForecastInterpretation,
  Language,
  MarketPulse,
  MatchStatus,
  MatchSummary,
} from "./domain";
import type {
  FootballDataSnapshot,
  FootballDataTeam,
} from "./providers/football-data";
import { fetchCurrentVenueWeather } from "./providers/open-meteo";
import { worldCupVenues } from "./providers/world-cup-venues";

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

export type RealDataSyncResult = {
  source: "football-data";
  competition: string;
  season: string;
  teams: number;
  matches: number;
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
  fetchedAt: string;
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
};

export type PlayerAvailabilityUpdate = {
  slug: string;
  availabilityStatus: string;
  availabilityNote?: string | null;
  yellowCards?: number;
  redCards?: number;
  isSuspended?: boolean;
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

type ForecastContextRow = {
  referee_name: string | null;
  cards_per_match: string | number | null;
  temperature_c: string | number | null;
  wind_kph: string | number | null;
  weather_summary: string | null;
  home_rest_hours: string | number | null;
  away_rest_hours: string | number | null;
  home_tournament_matches: string | number | null;
  home_tournament_points: string | number | null;
  home_tournament_goal_diff: string | number | null;
  away_tournament_matches: string | number | null;
  away_tournament_points: string | number | null;
  away_tournament_goal_diff: string | number | null;
  player_availability: ForecastPlayerContext[] | null;
};

type ForecastPlayerContext = {
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
  group_name: string | null;
  status: string;
  starts_at: Date | string | null;
  venue_slug: string;
  venue_name: string;
  venue_city: string;
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
  age: string | number | null;
  minutes_recent: string | number | null;
};

type ModelControlForecastRow = {
  match_id: string;
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

type TeamRatings = {
  attack: number;
  control: number;
  defense: number;
  setPieces: number;
};

const fallbackNote =
  "Live match data is unavailable. Demo fixtures are not shown in production.";

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

export async function listMatches(): Promise<MatchListResult> {
  const connection = await getSql();

  if (!connection) {
    return unavailableResult("missing-database-url");
  }

  if (connection.sql) {
    try {
      const rows = await fetchMatchRows(connection.sql);
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

type KeyPlayerProfile = {
  teamCode: string;
  teamSlug: string;
  slug: string;
  name: string;
  role: string;
  club: string;
  league: string;
  spark: number;
  importance: number;
  age: number;
  note: string;
};

const keyPlayerWatchlist: KeyPlayerProfile[] = [
  {
    teamCode: "ARG",
    teamSlug: "arg",
    slug: "lionel-messi",
    name: "Lionel Messi",
    role: "Creator",
    club: "Club profile pending",
    league: "International",
    spark: 96,
    importance: 99,
    age: 39,
    note: "Gravity player",
  },
  {
    teamCode: "POR",
    teamSlug: "por",
    slug: "cristiano-ronaldo",
    name: "Cristiano Ronaldo",
    role: "Forward",
    club: "Club profile pending",
    league: "International",
    spark: 91,
    importance: 94,
    age: 41,
    note: "Box gravity",
  },
  {
    teamCode: "BRA",
    teamSlug: "bra",
    slug: "vinicius-junior",
    name: "Vinicius Junior",
    role: "Winger",
    club: "Club profile pending",
    league: "International",
    spark: 94,
    importance: 94,
    age: 25,
    note: "Left-lane lightning",
  },
  {
    teamCode: "FRA",
    teamSlug: "fra",
    slug: "kylian-mbappe",
    name: "Kylian Mbappe",
    role: "Forward",
    club: "Club profile pending",
    league: "International",
    spark: 96,
    importance: 96,
    age: 27,
    note: "Depth breaker",
  },
  {
    teamCode: "GER",
    teamSlug: "ger",
    slug: "florian-wirtz",
    name: "Florian Wirtz",
    role: "Creator",
    club: "Club profile pending",
    league: "International",
    spark: 89,
    importance: 88,
    age: 23,
    note: "Between-line spark",
  },
  {
    teamCode: "ESP",
    teamSlug: "esp",
    slug: "lamine-yamal",
    name: "Lamine Yamal",
    role: "Winger",
    club: "Club profile pending",
    league: "International",
    spark: 91,
    importance: 89,
    age: 18,
    note: "Wide-lane voltage",
  },
  {
    teamCode: "ENG",
    teamSlug: "eng",
    slug: "jude-bellingham",
    name: "Jude Bellingham",
    role: "Midfielder",
    club: "Club profile pending",
    league: "International",
    spark: 93,
    importance: 92,
    age: 23,
    note: "Box-to-box magnet",
  },
  {
    teamCode: "MEX",
    teamSlug: "mex",
    slug: "santiago-gimenez",
    name: "Santiago Gimenez",
    role: "Forward",
    club: "Club profile pending",
    league: "International",
    spark: 82,
    importance: 82,
    age: 25,
    note: "Box gravity",
  },
  {
    teamCode: "USA",
    teamSlug: "usa",
    slug: "christian-pulisic",
    name: "Christian Pulisic",
    role: "Winger",
    club: "Club profile pending",
    league: "International",
    spark: 88,
    importance: 89,
    age: 27,
    note: "Final-third switch",
  },
  {
    teamCode: "CAN",
    teamSlug: "can",
    slug: "alphonso-davies",
    name: "Alphonso Davies",
    role: "Wingback",
    club: "Club profile pending",
    league: "International",
    spark: 90,
    importance: 91,
    age: 25,
    note: "Left-side ignition",
  },
  {
    teamCode: "MAR",
    teamSlug: "mar",
    slug: "achraf-hakimi",
    name: "Achraf Hakimi",
    role: "Fullback",
    club: "Club profile pending",
    league: "International",
    spark: 88,
    importance: 87,
    age: 27,
    note: "Two-way engine",
  },
  {
    teamCode: "KOR",
    teamSlug: "kor",
    slug: "son-heung-min",
    name: "Son Heung-min",
    role: "Forward",
    club: "Club profile pending",
    league: "International",
    spark: 90,
    importance: 93,
    age: 33,
    note: "Transition blade",
  },
  {
    teamCode: "JPN",
    teamSlug: "jpn",
    slug: "takefusa-kubo",
    name: "Takefusa Kubo",
    role: "Creator",
    club: "Club profile pending",
    league: "International",
    spark: 86,
    importance: 84,
    age: 25,
    note: "Pocket mischief",
  },
  {
    teamCode: "URU",
    teamSlug: "uru",
    slug: "federico-valverde",
    name: "Federico Valverde",
    role: "Midfielder",
    club: "Club profile pending",
    league: "International",
    spark: 91,
    importance: 90,
    age: 27,
    note: "Midfield engine",
  },
  {
    teamCode: "NED",
    teamSlug: "ned",
    slug: "virgil-van-dijk",
    name: "Virgil van Dijk",
    role: "Defender",
    club: "Club profile pending",
    league: "International",
    spark: 88,
    importance: 86,
    age: 34,
    note: "Back-line anchor",
  },
  {
    teamCode: "RSA",
    teamSlug: "rsa",
    slug: "teboho-mokoena",
    name: "Teboho Mokoena",
    role: "Midfielder",
    club: "Club profile pending",
    league: "International",
    spark: 78,
    importance: 72,
    age: 29,
    note: "Long-range spark",
  },
];

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
        availability_note = nullif(players.availability_note, 'Availability feed pending');
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
    age: toOptionalNumber(row.age),
    minutesRecent: toNumber(row.minutes_recent),
  };
}

function toModelControlForecastVersion(
  row: ModelControlForecastRow,
): ModelControlForecastVersion {
  const payload = parseJsonPayload(row.source_payload);
  const previousForecast = readPayloadRecord(payload?.previousForecast);

  return {
    matchId: row.match_id,
    group: normalizeGroupName(row.group_name),
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

function normalizePlayerAvailabilityUpdate(
  update: PlayerAvailabilityUpdate,
): PlayerAvailabilityUpdate | null {
  const slug = normalizePlayerSlug(update.slug);
  const status = normalizeAvailabilityStatus(update.availabilityStatus);

  if (!slug || !status) {
    return null;
  }

  return {
    slug,
    availabilityStatus: status,
    availabilityNote: normalizeAvailabilityNote(update.availabilityNote),
    yellowCards: clampInteger(update.yellowCards, 0, 3),
    redCards: clampInteger(update.redCards, 0, 2),
    isSuspended: Boolean(update.isSuspended) || status === "suspended",
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
        'Provider synced',
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
  let forecasts = 0;
  let venuesMapped = 0;

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
        home_team_id = excluded.home_team_id,
        away_team_id = excluded.away_team_id,
        venue_id = case
          when ${match.venueSlug === null}
            then coalesce(matches.venue_id, excluded.venue_id)
          else excluded.venue_id
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

    if (
      existingForecastRows[0] &&
      shouldPreserveModelForecast(existingForecastRows[0])
    ) {
      forecasts += 1;
      continue;
    }

    const forecastContextRows = (await sql`
      with current_match as (
        select
          matches.id,
          matches.home_team_id,
          matches.away_team_id,
          matches.referee_id,
          matches.starts_at
        from matches
        where matches.external_id = ${match.externalId}
        limit 1
      ),
      latest_weather as (
        select distinct on (weather_snapshots.match_id)
          weather_snapshots.match_id,
          weather_snapshots.temperature_c,
          weather_snapshots.wind_kph,
          weather_snapshots.summary
        from weather_snapshots
        order by weather_snapshots.match_id, weather_snapshots.captured_at desc
      )
      select
        referees.name as referee_name,
        referees.cards_per_match,
        latest_weather.temperature_c,
        latest_weather.wind_kph,
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
    const forecast = matchseerV3Forecast({
      homeTeam,
      awayTeam,
      homeRatings,
      awayRatings,
      venueSlug: match.venueSlug,
      context: forecastContext,
    });
    const forecastFingerprint = createForecastFingerprint({
      forecast,
      homeRatings,
      awayRatings,
    });
    const existingForecast = existingForecastRows[0] ?? null;
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
    const sourcePayload = {
      provider: snapshot.provider,
      providerMatchId: match.providerId,
      fetchedAt: snapshot.fetchedAt,
      forecastEngine: "matchseer-v3",
      modelVersion: "matchseer-v3.1-ledger",
      forecastFingerprint,
      forecastStatus: "open",
      supersedesVersion: existingForecast
        ? toNumber(existingForecast.version)
        : null,
      homeRatings,
      awayRatings,
      modifiers: forecast.modifiers,
      previousForecast: existingForecast
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
        : null,
      note: "Versioned dynamic forecast from team profiles, venue, weather, referee rhythm, spotlight gravity, player availability, fatigue signals, and tournament-floor score pressure.",
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

  await ensureForecastLedgerSchema(sql);

  for (const update of updates) {
    const normalized = normalizeMarketPulseUpdate({
      ...update,
      source: update.source ?? source,
    });

    if (!normalized) {
      skipped += 1;
      continue;
    }

    const rows = await sql`
      update forecasts
      set source_payload =
        coalesce(source_payload, '{}'::jsonb) ||
        jsonb_build_object('marketPulse', ${JSON.stringify(normalized)}::jsonb)
      where id = (
        select forecasts.id
        from forecasts
        join matches on matches.id = forecasts.match_id
        where matches.external_id = ${normalized.matchId}
        order by forecasts.version desc, forecasts.created_at desc
        limit 1
      )
      returning id;
    `;

    if (rows.length === 0) {
      skipped += 1;
    } else {
      pulsesSaved += rows.length;
    }
  }

  return {
    source,
    updatesReceived: updates.length,
    pulsesSaved,
    skipped,
    fetchedAt: new Date().toISOString(),
  };
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
      matches.group_name,
      matches.status,
      matches.starts_at,
      venues.slug as venue_slug,
      venues.name as venue_name,
      venues.city as venue_city
    from matches
    join teams home_team on home_team.id = matches.home_team_id
    join teams away_team on away_team.id = matches.away_team_id
    join venues on venues.id = matches.venue_id
    where matches.external_id like 'fd-%'
      and (${includeMapped} or venues.slug = 'provider-venue-tbd')
    order by matches.starts_at nulls last, matches.external_id;
  `) as unknown as VenueMappingCandidateRow[];

  return rows.map((row) => ({
    matchId: row.match_id,
    home: row.home_name,
    away: row.away_name,
    group: normalizeGroupName(row.group_name),
    status: row.status,
    startsAt: row.starts_at ? new Date(row.starts_at).toISOString() : null,
    currentVenue: {
      slug: row.venue_slug,
      name: row.venue_name,
      city: row.venue_city,
    },
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
      ? "The API reads Neon/provider data only. Demo fixtures are not returned if the database is unavailable."
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

async function fetchMatchRows(sql: NeonQuery) {
  return (await sql`
    with latest_weather as (
      select distinct on (match_id)
        match_id,
        temperature_c,
        wind_kph,
        summary
      from weather_snapshots
      order by match_id, captured_at desc
    ),
    latest_forecast as (
      select distinct on (match_id)
        id,
        match_id,
        version,
        home_win_probability,
        draw_probability,
        away_win_probability,
        projected_score,
        confidence,
        chaos,
        source_payload,
        created_at
      from forecasts
      order by match_id, version desc, created_at desc
    ),
    forecast_reason_groups as (
      select
        forecast_id,
        jsonb_agg(explanation order by weight desc nulls last, label) as factors
      from forecast_factors
      group by forecast_id
    ),
    interpretation_groups as (
      select
        forecast_id,
        jsonb_object_agg(language, summary) as tone
      from forecast_interpretations
      group by forecast_id
    )
    select
      matches.external_id as id,
      matches.status,
      matches.starts_at,
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
      interpretation_groups.tone,
      forecast_reason_groups.factors,
      coalesce(
        jsonb_agg(
          distinct jsonb_build_object(
            'name', players.name,
            'team', player_team.name,
            'role', players.role,
            'club', players.club,
            'league', players.league,
            'spark', players.spark_rating,
            'note', players.note
          )
        ) filter (where players.id is not null),
        '[]'::jsonb
      ) as players
    from matches
    join teams home_team on home_team.id = matches.home_team_id
    join teams away_team on away_team.id = matches.away_team_id
    join venues on venues.id = matches.venue_id
    left join referees on referees.id = matches.referee_id
    left join latest_weather on latest_weather.match_id = matches.id
    left join latest_forecast on latest_forecast.match_id = matches.id
    left join forecast_reason_groups on forecast_reason_groups.forecast_id = latest_forecast.id
    left join interpretation_groups on interpretation_groups.forecast_id = latest_forecast.id
    left join players on players.team_id in (matches.home_team_id, matches.away_team_id)
    left join teams player_team on player_team.id = players.team_id
    group by
      matches.external_id,
      matches.status,
      matches.starts_at,
      matches.group_name,
      matches.home_score,
      matches.away_score,
      venues.name,
      venues.city,
      home_team.name,
      home_team.code,
      home_team.color,
      home_team.record,
      home_team.form,
      home_team.attack,
      home_team.control,
      home_team.defense,
      home_team.set_pieces,
      away_team.name,
      away_team.code,
      away_team.color,
      away_team.record,
      away_team.form,
      away_team.attack,
      away_team.control,
      away_team.defense,
      away_team.set_pieces,
      referees.name,
      referees.cards_per_match,
      latest_weather.temperature_c,
      latest_weather.wind_kph,
      latest_weather.summary,
      latest_forecast.home_win_probability,
      latest_forecast.draw_probability,
      latest_forecast.away_win_probability,
      latest_forecast.version,
      latest_forecast.created_at,
      latest_forecast.projected_score,
      latest_forecast.confidence,
      latest_forecast.chaos,
      latest_forecast.source_payload,
      interpretation_groups.tone,
      forecast_reason_groups.factors
    order by matches.starts_at nulls last, matches.external_id;
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
  const weatherMood = toLanguageRecord(
    row.weather_summary ?? "Weather data pending.",
  );
  const projectedScore = normalizeProjectedScore(
    publishedProjectedScoreCorrections[row.id] ?? row.projected_score,
  );
  const homeForecast = toNumber(row.home_win_probability);
  const drawForecast = toNumber(row.draw_probability);
  const awayForecast = toNumber(row.away_win_probability);
  const confidence = toNumber(row.confidence);
  const chaos = toNumber(row.chaos);
  const marketPulse = toMarketPulse(row.source_payload, {
    homeForecast,
    drawForecast,
    awayForecast,
    confidence,
    chaos,
    homeName: row.home_name,
    awayName: row.away_name,
  });

  return {
    id: row.id,
    status,
    startsAt: row.starts_at ? new Date(row.starts_at).toISOString() : null,
    group: normalizeGroupName(row.group_name),
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
    },
    forecast: {
      home: homeForecast,
      draw: drawForecast,
      away: awayForecast,
      version: toNumber(row.forecast_version),
      generatedAt: row.forecast_created_at
        ? new Date(row.forecast_created_at).toISOString()
        : null,
      confidence,
      chaos,
      projected: projectedScore,
      marketPulse,
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

function toMarketPulse(
  sourcePayload: DatabaseMatchRow["source_payload"],
  base: {
    homeForecast: number;
    drawForecast: number;
    awayForecast: number;
    confidence: number;
    chaos: number;
    homeName: string;
    awayName: string;
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
    summary: marketPulseSummary({
      alignment,
      leader: marketLeader,
      homeName: base.homeName,
      awayName: base.awayName,
    }),
  };
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
      en: "Crowd signal is thin, so the Seer barely lets it touch the read.",
      es: "La señal de la gente viene floja, así que el Vidente apenas la roza.",
      fr: "Le signal du public est léger, donc le voyant le laisse à peine peser.",
    };
  }

  if (alignment === "aligned") {
    return {
      en: `Crowd signal leans ${leaderLabel}; it backs the Seer without changing the pick.`,
      es: `La señal de la gente se inclina por ${leaderLabel}; acompaña al Vidente sin cambiar la lectura.`,
      fr: `Le signal du public penche vers ${leaderLabel}; il soutient le voyant sans changer la lecture.`,
    };
  }

  return {
    en: `Crowd signal leans ${leaderLabel}; the Seer keeps the pick, but chaos gets louder.`,
    es: `La señal de la gente se inclina por ${leaderLabel}; el Vidente mantiene la lectura, pero sube el caos.`,
    fr: `Le signal du public penche vers ${leaderLabel}; le voyant garde sa lecture, mais le chaos monte.`,
  };
}

const publishedProjectedScoreCorrections: Record<string, string> = {
  "fd-537328": "2-1",
};

function normalizeGroupName(groupName: string | null) {
  if (!groupName) {
    return "Group";
  }

  const normalized = groupName
    .replace(/^GROUP[_\s-]+/i, "Group ")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized.replace(/\b([a-z])/g, (letter) => letter.toUpperCase());
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

function toReasons(factors: string[] | null) {
  const fallback = ["More data is being loaded into the Seer."];
  const values = factors && factors.length > 0 ? factors : fallback;

  return {
    en: values,
    es: values,
    fr: values,
  };
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

const teamRatingProfiles: Record<string, TeamRatings> = {
  ALG: { attack: 72, control: 72, defense: 74, setPieces: 75 },
  ARG: { attack: 88, control: 87, defense: 83, setPieces: 81 },
  AUS: { attack: 70, control: 70, defense: 73, setPieces: 78 },
  AUT: { attack: 78, control: 82, defense: 76, setPieces: 79 },
  BEL: { attack: 82, control: 82, defense: 77, setPieces: 80 },
  BIH: { attack: 75, control: 72, defense: 74, setPieces: 78 },
  BRA: { attack: 90, control: 87, defense: 81, setPieces: 78 },
  CAN: { attack: 76, control: 72, defense: 68, setPieces: 74 },
  CHI: { attack: 74, control: 76, defense: 72, setPieces: 73 },
  CIV: { attack: 79, control: 75, defense: 74, setPieces: 77 },
  COL: { attack: 82, control: 80, defense: 76, setPieces: 78 },
  CRO: { attack: 79, control: 86, defense: 80, setPieces: 77 },
  CUW: { attack: 62, control: 66, defense: 59, setPieces: 64 },
  CZE: { attack: 73, control: 73, defense: 76, setPieces: 79 },
  DEN: { attack: 78, control: 82, defense: 81, setPieces: 80 },
  ECU: { attack: 78, control: 79, defense: 77, setPieces: 73 },
  EGY: { attack: 78, control: 75, defense: 74, setPieces: 76 },
  ENG: { attack: 87, control: 84, defense: 83, setPieces: 85 },
  ESP: { attack: 86, control: 91, defense: 84, setPieces: 78 },
  FRA: { attack: 91, control: 88, defense: 86, setPieces: 83 },
  GER: { attack: 85, control: 85, defense: 79, setPieces: 81 },
  GHA: { attack: 75, control: 73, defense: 72, setPieces: 75 },
  HAI: { attack: 66, control: 64, defense: 65, setPieces: 68 },
  ITA: { attack: 81, control: 83, defense: 86, setPieces: 80 },
  JPN: { attack: 80, control: 84, defense: 78, setPieces: 74 },
  KOR: { attack: 78, control: 77, defense: 74, setPieces: 72 },
  MAR: { attack: 80, control: 79, defense: 86, setPieces: 81 },
  MEX: { attack: 75, control: 74, defense: 71, setPieces: 78 },
  NED: { attack: 85, control: 86, defense: 83, setPieces: 81 },
  NGA: { attack: 80, control: 74, defense: 73, setPieces: 76 },
  NZL: { attack: 63, control: 62, defense: 66, setPieces: 70 },
  PAR: { attack: 72, control: 71, defense: 76, setPieces: 78 },
  POR: { attack: 87, control: 85, defense: 81, setPieces: 83 },
  QAT: { attack: 68, control: 70, defense: 67, setPieces: 72 },
  RSA: { attack: 71, control: 70, defense: 72, setPieces: 75 },
  SCO: { attack: 72, control: 73, defense: 75, setPieces: 80 },
  SEN: { attack: 80, control: 77, defense: 79, setPieces: 78 },
  SUI: { attack: 79, control: 81, defense: 80, setPieces: 79 },
  TUN: { attack: 70, control: 71, defense: 77, setPieces: 76 },
  TUR: { attack: 75, control: 77, defense: 72, setPieces: 74 },
  URU: { attack: 84, control: 83, defense: 82, setPieces: 82 },
  URY: { attack: 84, control: 83, defense: 82, setPieces: 82 },
  USA: { attack: 79, control: 77, defense: 75, setPieces: 76 },
};

function teamRatings(team: FootballDataTeam): TeamRatings {
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
  venueSlug,
  context,
}: {
  homeTeam: FootballDataTeam;
  awayTeam: FootballDataTeam;
  homeRatings: TeamRatings;
  awayRatings: TeamRatings;
  venueSlug: string | null;
  context: ForecastContextRow | null;
}) {
  const homeVenueBoost = venueCountryBoost(homeTeam, venueSlug);
  const awayVenueBoost = venueCountryBoost(awayTeam, venueSlug);
  const homeBasePower = teamPower(homeRatings);
  const awayBasePower = teamPower(awayRatings);
  const weather = weatherForecastModifier(context, homeRatings, awayRatings);
  const referee = refereeForecastModifier(context, homeRatings, awayRatings);
  const spotlight = spotlightGravityModifier(homeTeam, awayTeam);
  const playerContext = forecastPlayerContexts(context);
  const availability = availabilityForecastModifier(playerContext);
  const fatigue = fatigueForecastModifier(playerContext, context);
  const homePower =
    homeBasePower +
    homeVenueBoost +
    weather.homePower +
    referee.homePower +
    spotlight.homePower -
    availability.homePenalty -
    fatigue.homePenalty;
  const awayPower =
    awayBasePower +
    awayVenueBoost +
    weather.awayPower +
    referee.awayPower +
    spotlight.awayPower -
    availability.awayPenalty -
    fatigue.awayPenalty;
  const powerGap = homePower - awayPower;
  const baseChaos =
    64 -
    Math.abs(powerGap) * 0.9 +
    Math.abs(homeRatings.attack - awayRatings.defense) * 0.05 +
    Math.abs(awayRatings.attack - homeRatings.defense) * 0.05;
  const chaos = clamp(
    Math.round(
      baseChaos +
        weather.chaosDelta +
        referee.chaosDelta +
        spotlight.chaosDelta +
        availability.chaosDelta +
        fatigue.chaosDelta,
    ),
    36,
    82,
  );
  const draw = clamp(
    Math.round(28 + (chaos - 58) * 0.09 - Math.abs(powerGap) * 0.4),
    15,
    34,
  );
  const nonDrawPool = 100 - draw;
  const homeShare = 1 / (1 + Math.exp(-powerGap / 10));
  let home = clamp(Math.round(nonDrawPool * homeShare), 8, 84);
  let away = 100 - draw - home;

  if (away < 8) {
    away = 8;
    home = 100 - draw - away;
  }

  if (home < 8) {
    home = 8;
    away = 100 - draw - home;
  }

  const homeXg = expectedGoals(
    homeRatings,
    awayRatings,
    homeVenueBoost,
    weather.xgDelta +
      referee.homeXgDelta -
      availability.homeXgPenalty -
      fatigue.homeXgPenalty,
  );
  const awayXg = expectedGoals(
    awayRatings,
    homeRatings,
    awayVenueBoost,
    weather.xgDelta +
      referee.awayXgDelta -
      availability.awayXgPenalty -
      fatigue.awayXgPenalty,
  );
  const tournamentReality = tournamentRealityScoreModifier({
    homeTeam,
    awayTeam,
    homeRatings,
    awayRatings,
    homePower,
    awayPower,
    homeProbability: home,
    awayProbability: away,
    chaos,
    context,
  });
  const projected = projectedScoreline({
    homeProbability: home,
    drawProbability: draw,
    awayProbability: away,
    homeXg,
    awayXg,
    tournamentReality,
  });
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
  const dynamicDrag =
    Math.abs(weather.chaosDelta) +
    Math.abs(referee.chaosDelta) +
    Math.abs(availability.chaosDelta) +
    Math.abs(fatigue.chaosDelta);
  const factors = [
    {
      label: favorite ? "Team profile signal" : "Balanced profile signal",
      weight: 1,
      explanation: favorite
        ? `${favorite.team.name} carry the stronger v3 profile at ${favorite.probability}%.`
        : "The v3 team profiles are close enough to keep the match balanced.",
    },
    weather.factor,
    referee.factor,
    spotlight.factor,
    availability.factor,
    fatigue.factor,
    tournamentReality.factor,
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
    confidence: clamp(
      Math.round(
        50 +
          Math.abs(powerGap) * 1.04 +
          (78 - chaos) * 0.08 -
          dynamicDrag * 0.24,
      ),
      45,
      80,
    ),
    chaos,
    projected,
    modifiers: {
      basePower: {
        home: roundModifier(homeBasePower),
        away: roundModifier(awayBasePower),
      },
      adjustedPower: {
        home: roundModifier(homePower),
        away: roundModifier(awayPower),
      },
      venue: {
        home: homeVenueBoost,
        away: awayVenueBoost,
      },
      weather: weather.payload,
      referee: referee.payload,
      spotlight: spotlight.payload,
      availability: availability.payload,
      fatigue: fatigue.payload,
      tournamentReality: tournamentReality.payload,
    },
    factors,
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

function weatherForecastModifier(
  context: ForecastContextRow | null,
  homeRatings: TeamRatings,
  awayRatings: TeamRatings,
) {
  const temperature = toOptionalNumber(context?.temperature_c);
  const wind = toOptionalNumber(context?.wind_kph);
  const summary = context?.weather_summary ?? null;
  let chaosDelta = 0;
  let xgDelta = 0;
  let homePower = 0;
  let awayPower = 0;
  const notes: string[] = [];

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

  if (wind !== null && wind >= 18) {
    chaosDelta += wind >= 28 ? 4 : 2;
    xgDelta -= wind >= 28 ? 0.12 : 0.06;
    notes.push("wind adds noise to diagonals and dead balls");
    const setPiecePower = setPieceModifier(homeRatings, awayRatings, wind >= 28 ? 0.55 : 0.3);
    homePower += setPiecePower.home;
    awayPower += setPiecePower.away;
  }

  const summaryText = summary?.toLowerCase() ?? "";

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

  const hasWeather = temperature !== null || wind !== null || summary !== null;
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
    factor,
    homePower,
    awayPower,
    xgDelta,
    payload: {
      temperatureC: temperature,
      windKph: wind,
      summary,
      homePower: roundModifier(homePower),
      awayPower: roundModifier(awayPower),
      chaosDelta,
      xgDelta: roundModifier(xgDelta),
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

function availabilityForecastModifier(players: ForecastPlayerContext[]) {
  const homeImpacts: Array<{ name: string; reason: string; penalty: number }> = [];
  const awayImpacts: Array<{ name: string; reason: string; penalty: number }> = [];
  let homePenalty = 0;
  let awayPenalty = 0;
  let homeXgPenalty = 0;
  let awayXgPenalty = 0;
  let chaosDelta = 0;

  for (const player of players) {
    const severity = availabilitySeverity(player);
    const cardRisk = playerCardRisk(player);

    if (severity === 0 && cardRisk === 0) {
      continue;
    }

    const impact = playerImpactScore(player);
    const penalty = clampNumber(severity * impact + cardRisk * impact, 0.15, 4.2);
    const xgPenalty = clampNumber(penalty * 0.04, 0.01, 0.24);
    const reason = playerAvailabilityReason(player, severity, cardRisk);
    const bucket = player.teamSide === "home" ? homeImpacts : awayImpacts;

    bucket.push({ name: player.name, reason, penalty });
    chaosDelta += severity >= 2 ? 2 : cardRisk > 0 ? 1 : 0;

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

  const impacted = [...homeImpacts, ...awayImpacts]
    .sort((a, b) => b.penalty - a.penalty)
    .slice(0, 3);
  const factor =
    impacted.length > 0
      ? {
          label: "Availability watch",
          weight: 0.65,
          explanation: `Key-player board moved: ${sentenceList(
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
            ? "availability-signals-active"
            : "watchlist-clear"
          : "pending-player-availability-feed",
      watchedPlayers: players.length,
      impactedPlayers: impacted.map((player) => ({
        name: player.name,
        reason: player.reason,
        penalty: roundModifier(player.penalty),
      })),
      homePenalty: roundModifier(homePenalty),
      awayPenalty: roundModifier(awayPenalty),
      homeXgPenalty: roundModifier(homeXgPenalty),
      awayXgPenalty: roundModifier(awayXgPenalty),
      chaosDelta,
    },
  };
}

function fatigueForecastModifier(
  players: ForecastPlayerContext[],
  context: ForecastContextRow | null,
) {
  const homeRestHours = toOptionalNumber(context?.home_rest_hours);
  const awayRestHours = toOptionalNumber(context?.away_rest_hours);
  const homeImpacts: Array<{ name: string; reason: string; penalty: number }> = [];
  const awayImpacts: Array<{ name: string; reason: string; penalty: number }> = [];
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
    const penalty = clampNumber(impact * minuteLoad * restStress * ageMultiplier, 0, 2.8);

    if (penalty < 0.18) {
      continue;
    }

    const reason =
      restHours === null
        ? "carries recent-minute fatigue"
        : `carries recent-minute fatigue on ${Math.round(restHours)}h rest`;
    const bucket = player.teamSide === "home" ? homeImpacts : awayImpacts;

    bucket.push({ name: player.name, reason, penalty });
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

  if (player.isSuspended || redCards > 0 || status.includes("suspend")) {
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

function playerCardRisk(player: ForecastPlayerContext) {
  const yellowCards = toOptionalNumber(player.yellowCards) ?? 0;

  if (yellowCards >= 2) {
    return 0.75;
  }

  if (yellowCards === 1) {
    return 0.3;
  }

  return 0;
}

function playerAvailabilityReason(
  player: ForecastPlayerContext,
  severity: number,
  cardRisk: number,
) {
  const status = normalizedPlayerStatus(player.availabilityStatus);

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

  return cardRisk >= 0.75
    ? "is close to suspension risk"
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
    underdogWeakness * 0.9 + favoriteStrength * 0.72 - surpriseCredit - chaosRelief,
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

const tournamentFloorProfilesByCode: Record<string, { power: number; tax: number }> = {
  CUW: { power: 49, tax: 0.42 },
  HAI: { power: 52, tax: 0.26 },
  NZL: { power: 50, tax: 0.52 },
  QAT: { power: 54, tax: 0.22 },
};

const tournamentFloorProfilesByName: Record<string, { power: number; tax: number }> = {
  curacao: tournamentFloorProfilesByCode.CUW,
  "new zealand": tournamentFloorProfilesByCode.NZL,
  haiti: tournamentFloorProfilesByCode.HAI,
  qatar: tournamentFloorProfilesByCode.QAT,
};

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

function projectedScoreline({
  homeProbability,
  drawProbability,
  awayProbability,
  homeXg,
  awayXg,
  tournamentReality,
}: {
  homeProbability: number;
  drawProbability: number;
  awayProbability: number;
  homeXg: number;
  awayXg: number;
  tournamentReality?: TournamentRealityModifier;
}) {
  const isDrawish =
    drawProbability >= Math.max(homeProbability, awayProbability) - 3;
  let homeGoals = goalsFromXg(homeXg);
  let awayGoals = goalsFromXg(awayXg);
  const probabilityGap = homeProbability - awayProbability;

  if (isDrawish) {
    const drawGoals = homeXg + awayXg >= 2.9 ? 2 : homeXg + awayXg <= 1.7 ? 0 : 1;

    return `${drawGoals}-${drawGoals}`;
  }

  if (probabilityGap >= 14 && homeGoals <= awayGoals) {
    homeGoals = awayGoals + 1;
  }

  if (probabilityGap <= -14 && awayGoals <= homeGoals) {
    awayGoals = homeGoals + 1;
  }

  if (probabilityGap >= 28 && awayGoals > 0 && homeXg - awayXg > 0.9) {
    awayGoals -= 1;
  }

  if (probabilityGap <= -28 && homeGoals > 0 && awayXg - homeXg > 0.9) {
    homeGoals -= 1;
  }

  if (tournamentReality?.side === "home") {
    homeGoals = applyFavoriteFloor(homeGoals, tournamentReality.favoriteMinGoals);
    awayGoals = applyUnderdogCap(awayGoals, awayXg, tournamentReality.underdogMaxGoals);

    if (tournamentReality.minMargin > 0 && homeGoals - awayGoals < tournamentReality.minMargin) {
      homeGoals = awayGoals + tournamentReality.minMargin;
    }
  }

  if (tournamentReality?.side === "away") {
    awayGoals = applyFavoriteFloor(awayGoals, tournamentReality.favoriteMinGoals);
    homeGoals = applyUnderdogCap(homeGoals, homeXg, tournamentReality.underdogMaxGoals);

    if (tournamentReality.minMargin > 0 && awayGoals - homeGoals < tournamentReality.minMargin) {
      awayGoals = homeGoals + tournamentReality.minMargin;
    }
  }

  homeGoals = clamp(homeGoals, 0, 5);
  awayGoals = clamp(awayGoals, 0, 5);

  return `${homeGoals}-${awayGoals}`;
}

function applyFavoriteFloor(goals: number, favoriteMinGoals: number) {
  return favoriteMinGoals > 0 ? Math.max(goals, favoriteMinGoals) : goals;
}

function applyUnderdogCap(
  goals: number,
  xg: number,
  underdogMaxGoals: number | null,
) {
  if (underdogMaxGoals === null) {
    return goals;
  }

  const capRelief = xg >= 1.18 ? 1 : 0;

  return Math.min(goals, underdogMaxGoals + capRelief);
}

function goalsFromXg(xg: number) {
  if (xg >= 2.45) {
    return 3;
  }

  if (xg >= 1.55) {
    return 2;
  }

  if (xg >= 0.65) {
    return 1;
  }

  return 0;
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
