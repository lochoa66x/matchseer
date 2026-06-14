import { createHash } from "crypto";
import type {
  ForecastInterpretation,
  Language,
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
  }>;
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
  projected_score: string | null;
  confidence: number | null;
  chaos: number | null;
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
  status: string | null;
  home_score: number | null;
  away_score: number | null;
};

type ForecastContextRow = {
  referee_name: string | null;
  cards_per_match: string | number | null;
  temperature_c: string | number | null;
  wind_kph: string | number | null;
  weather_summary: string | null;
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
        timezone
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
        ${timezone}
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
        match_id
      from traffic_events
      order by occurred_at desc
      limit 12;
    `) as unknown as TrafficRecentRow[];

    return {
      source: "database",
      reason: "database",
      generatedAt,
      windows: {
        last24h: {
          views: toNumber(summaryRow?.views_24h ?? 0),
          visitors: toNumber(summaryRow?.visitors_24h ?? 0),
        },
        last7d: {
          views: toNumber(summaryRow?.views_7d ?? 0),
          visitors: toNumber(summaryRow?.visitors_7d ?? 0),
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
      timeline: fillTrafficTimeline(timelineRows),
      recent: recentRows.map((row) => ({
        occurredAt: new Date(row.occurred_at).toISOString(),
        path: row.path,
        referrer: row.referrer,
        device: row.device,
        language: row.language,
        matchId: row.match_id,
      })),
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
          timezone text
        );
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
    })().catch((error) => {
      trafficSchemaPromise = null;
      throw error;
    });
  }

  return trafficSchemaPromise;
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
    timeline: fillTrafficTimeline([]),
    recent: [],
  };
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
        matches.status,
        matches.home_score,
        matches.away_score
      from matches
      join forecasts
        on forecasts.match_id = matches.id
       and forecasts.version = 1
      where matches.external_id = ${match.externalId}
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
      with latest_weather as (
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
        latest_weather.summary as weather_summary
      from matches
      left join referees on referees.id = matches.referee_id
      left join latest_weather on latest_weather.match_id = matches.id
      where matches.external_id = ${match.externalId}
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
        1,
        ${forecast.home},
        ${forecast.draw},
        ${forecast.away},
        ${forecast.projected},
        ${forecast.confidence},
        ${forecast.chaos},
        ${JSON.stringify({
          provider: snapshot.provider,
          providerMatchId: match.providerId,
          fetchedAt: snapshot.fetchedAt,
          forecastEngine: "matchseer-v3",
          modelVersion: "matchseer-v3",
          homeRatings,
          awayRatings,
          modifiers: forecast.modifiers,
          note: "Dynamic forecast from team profiles, venue, weather, referee rhythm, and spotlight gravity. Player availability and fatigue hooks are ready for richer data.",
        })}::jsonb
      )
      on conflict (match_id, version) do update set
        home_win_probability = excluded.home_win_probability,
        draw_probability = excluded.draw_probability,
        away_win_probability = excluded.away_win_probability,
        projected_score = excluded.projected_score,
        confidence = excluded.confidence,
        chaos = excluded.chaos,
        source_payload = excluded.source_payload
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
        home_win_probability,
        draw_probability,
        away_win_probability,
        projected_score,
        confidence,
        chaos
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
      latest_forecast.projected_score,
      latest_forecast.confidence,
      latest_forecast.chaos,
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
      latest_forecast.projected_score,
      latest_forecast.confidence,
      latest_forecast.chaos,
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
  const projectedScore =
    publishedProjectedScoreCorrections[row.id] ?? row.projected_score ?? "Pending";

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
      home: toNumber(row.home_win_probability),
      draw: toNumber(row.draw_probability),
      away: toNumber(row.away_win_probability),
      confidence: toNumber(row.confidence),
      chaos: toNumber(row.chaos),
      projected: projectedScore,
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
  PAR: { attack: 72, control: 71, defense: 76, setPieces: 78 },
  POR: { attack: 87, control: 85, defense: 81, setPieces: 83 },
  QAT: { attack: 68, control: 70, defense: 67, setPieces: 72 },
  RSA: { attack: 71, control: 70, defense: 72, setPieces: 75 },
  SCO: { attack: 72, control: 73, defense: 75, setPieces: 80 },
  SEN: { attack: 80, control: 77, defense: 79, setPieces: 78 },
  SUI: { attack: 79, control: 81, defense: 80, setPieces: 79 },
  TUN: { attack: 70, control: 71, defense: 77, setPieces: 76 },
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
  const availability = availabilityForecastModifier();
  const fatigue = fatigueForecastModifier();
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
  const projected = projectedScoreline({
    homeProbability: home,
    drawProbability: draw,
    awayProbability: away,
    homeXg,
    awayXg,
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
  const dynamicDrag = Math.abs(weather.chaosDelta) + Math.abs(referee.chaosDelta);
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

function availabilityForecastModifier() {
  return {
    awayPenalty: 0,
    awayXgPenalty: 0,
    chaosDelta: 0,
    homePenalty: 0,
    homeXgPenalty: 0,
    payload: {
      status: "pending-player-availability-feed",
      homePenalty: 0,
      awayPenalty: 0,
      homeXgPenalty: 0,
      awayXgPenalty: 0,
      chaosDelta: 0,
    },
  };
}

function fatigueForecastModifier() {
  return {
    awayPenalty: 0,
    awayXgPenalty: 0,
    chaosDelta: 0,
    homePenalty: 0,
    homeXgPenalty: 0,
    payload: {
      status: "pending-minutes-age-travel-feed",
      homePenalty: 0,
      awayPenalty: 0,
      homeXgPenalty: 0,
      awayXgPenalty: 0,
      chaosDelta: 0,
    },
  };
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
}: {
  homeProbability: number;
  drawProbability: number;
  awayProbability: number;
  homeXg: number;
  awayXg: number;
}) {
  const isDrawish =
    drawProbability >= Math.max(homeProbability, awayProbability) - 3;
  let homeGoals = goalsFromXg(homeXg);
  let awayGoals = goalsFromXg(awayXg);
  const probabilityGap = homeProbability - awayProbability;

  if (isDrawish) {
    const drawGoals = homeXg + awayXg >= 2.9 ? 2 : homeXg + awayXg <= 1.7 ? 0 : 1;

    return drawGoals === 1 ? "1-1" : `${drawGoals}-${drawGoals} / 1-1`;
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

  const primary = `${homeGoals}-${awayGoals}`;
  const alternate =
    Math.abs(probabilityGap) < 18
      ? probabilityGap > 0
        ? `${Math.max(homeGoals - 1, 1)}-${awayGoals}`
        : `${homeGoals}-${Math.max(awayGoals - 1, 1)}`
      : probabilityGap > 0
        ? `${Math.max(homeGoals, 2)}-${Math.max(awayGoals, 1)}`
        : `${Math.max(homeGoals, 1)}-${Math.max(awayGoals, 2)}`;

  return alternate === primary ? primary : `${primary} / ${alternate}`;
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
