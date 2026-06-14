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
        status = excluded.status,
        home_score = excluded.home_score,
        away_score = excluded.away_score,
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

    const forecast = baselineForecast({
      homeTeam,
      awayTeam,
      homeRatings,
      awayRatings,
      venueSlug: match.venueSlug,
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
          forecastEngine: "baseline-v2",
          homeRatings,
          awayRatings,
          note: "Baseline forecast from provider fixture state and starter team profiles. AI interpretation remains user-triggered.",
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
      projected: row.projected_score ?? "Pending",
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

function baselineForecast({
  homeTeam,
  awayTeam,
  homeRatings,
  awayRatings,
  venueSlug,
}: {
  homeTeam: FootballDataTeam;
  awayTeam: FootballDataTeam;
  homeRatings: TeamRatings;
  awayRatings: TeamRatings;
  venueSlug: string | null;
}) {
  const homeVenueBoost = venueCountryBoost(homeTeam, venueSlug);
  const awayVenueBoost = venueCountryBoost(awayTeam, venueSlug);
  const homePower = teamPower(homeRatings) + homeVenueBoost;
  const awayPower = teamPower(awayRatings) + awayVenueBoost;
  const powerGap = homePower - awayPower;
  const chaos = clamp(
    Math.round(
      64 -
        Math.abs(powerGap) * 0.9 +
        Math.abs(homeRatings.attack - awayRatings.defense) * 0.05 +
        Math.abs(awayRatings.attack - homeRatings.defense) * 0.05,
    ),
    38,
    76,
  );
  const draw = clamp(
    Math.round(29 + (chaos - 58) * 0.08 - Math.abs(powerGap) * 0.42),
    16,
    32,
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

  const homeXg = expectedGoals(homeRatings, awayRatings, homeVenueBoost);
  const awayXg = expectedGoals(awayRatings, homeRatings, awayVenueBoost);
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
        : "The venue profile stays close to neutral for this baseline read.";

  return {
    home,
    draw,
    away,
    confidence: clamp(Math.round(51 + Math.abs(powerGap) * 1.1 + (76 - chaos) * 0.08), 48, 78),
    chaos,
    projected,
    factors: [
      {
        label: favorite ? "Team profile signal" : "Balanced profile signal",
        weight: 1,
        explanation: favorite
          ? `${favorite.team.name} carry the stronger starter profile at ${favorite.probability}%.`
          : "The starter profiles are close enough to keep the match balanced.",
      },
      {
        label: "Attack and defense shape",
        weight: 0.7,
        explanation: `The sharpest early matchup is ${pressurePoint}.`,
      },
      {
        label: "Venue context",
        weight: 0.55,
        explanation: venueExplanation,
      },
      {
        label: "AI readout available",
        weight: 0.5,
        explanation: "Ask the Seer to generate a fresh interpretation from the current row.",
      },
    ],
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

function expectedGoals(
  attackingTeam: TeamRatings,
  defendingTeam: TeamRatings,
  venueBoost: number,
) {
  return clampNumber(
    1.08 +
      (attackingTeam.attack - defendingTeam.defense) * 0.026 +
      (attackingTeam.control - defendingTeam.control) * 0.01 +
      (attackingTeam.setPieces - defendingTeam.setPieces) * 0.008 +
      venueBoost * 0.035,
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
      headline: "Provider synced forecast",
      summary:
        "Fresh fixture data is in. Ask the Seer for a richer readout once team stats and weather are layered in.",
      toneLine: `Baseline projection sits at ${projected}.`,
    },
    es: {
      headline: "Pronóstico sincronizado",
      summary:
        "Ya entraron datos reales del calendario. Pregunta al Vidente para una lectura más rica cuando sumemos estadísticas y clima.",
      toneLine: `La proyección base queda en ${projected}.`,
    },
    fr: {
      headline: "Prévision synchronisée",
      summary:
        "Les données réelles du calendrier sont arrivées. Demande au voyant une lecture plus riche avec les stats et la météo.",
      toneLine: `La projection de base est ${projected}.`,
    },
  };

  return copy[language];
}
