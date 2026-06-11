import type { Language, MatchStatus, MatchSummary } from "./domain";
import { sampleMatches } from "./sample-data";

export type DataSourceStatus = "sample" | "database" | "database-unavailable";
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

type NeonQuery = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<DatabaseMatchRow[]>;

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

const fallbackNote =
  "Using sample data because Neon is not available in this runtime.";

async function loadNeon() {
  try {
    const dynamicImport = new Function(
      "specifier",
      "return import(specifier)",
    ) as (specifier: string) => Promise<NeonModule>;

    return {
      module: await dynamicImport("@neondatabase/serverless"),
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
    return sampleResult("missing-database-url");
  }

  if (connection.sql) {
    try {
      const rows = await fetchMatchRows(connection.sql);
      const matches = rows.map(toMatchSummary);

      if (matches.length > 0) {
        return {
          source: "database" satisfies DataSourceStatus,
          reason: "database",
          matches,
        };
      }

      return sampleResult("empty-database-result");
    } catch (error) {
      console.error("MatchSeer database read failed", error);
      return sampleResult("database-query-failed");
    }
  }

  return sampleResult(connection.reason);
}

export async function getMatch(matchId: string) {
  const result = await listMatches();

  return {
    source: result.source,
    reason: result.reason,
    match: result.matches.find((match) => match.id === matchId) ?? null,
  };
}

export function getDatabaseReadiness() {
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

  return {
    hasDatabaseUrl,
    driver: hasDatabaseUrl
      ? "@neondatabase/serverless"
      : "waiting-for-database-url",
    note: hasDatabaseUrl
      ? "The API tries Neon first and falls back to sample data if the driver or database is unavailable."
      : fallbackNote,
  };
}

function sampleResult(reason: DataSourceReason): MatchListResult {
  return {
    source: "sample",
    reason,
    matches: sampleMatches,
  };
}

async function fetchMatchRows(sql: NeonQuery) {
  return sql`
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
  `;
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
    group: row.group_name ?? "Group",
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
    players: (row.players ?? []).map((player) => ({
      name: player.name,
      team: player.team,
      role: player.role,
      club: player.club ?? "Club pending",
      league: player.league ?? "League pending",
      spark: toNumber(player.spark),
      note: player.note ?? "Spark pending",
    })),
  };
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
