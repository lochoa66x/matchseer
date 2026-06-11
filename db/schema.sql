create table if not exists competitions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  sport text not null,
  season text not null,
  created_at timestamptz not null default now()
);

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid references competitions(id) on delete cascade,
  slug text not null unique,
  name text not null,
  code text not null,
  color text not null,
  country text,
  created_at timestamptz not null default now()
);

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade,
  slug text not null unique,
  name text not null,
  role text not null,
  club text,
  league text,
  spark_rating integer check (spark_rating between 0 and 100),
  note text,
  created_at timestamptz not null default now()
);

create table if not exists venues (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  city text not null,
  country text,
  latitude numeric,
  longitude numeric,
  created_at timestamptz not null default now()
);

create table if not exists referees (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  cards_per_match numeric,
  fouls_per_match numeric,
  created_at timestamptz not null default now()
);

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  competition_id uuid references competitions(id) on delete cascade,
  home_team_id uuid references teams(id),
  away_team_id uuid references teams(id),
  venue_id uuid references venues(id),
  referee_id uuid references referees(id),
  stage text,
  group_name text,
  starts_at timestamptz,
  status text not null default 'scheduled',
  home_score integer,
  away_score integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists weather_snapshots (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade,
  captured_at timestamptz not null default now(),
  temperature_c numeric,
  wind_kph numeric,
  rain_probability numeric,
  humidity numeric,
  summary text
);

create table if not exists forecasts (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade,
  version integer not null default 1,
  home_win_probability numeric not null,
  draw_probability numeric not null,
  away_win_probability numeric not null,
  projected_score text,
  confidence integer check (confidence between 0 and 100),
  chaos integer check (chaos between 0 and 100),
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists forecast_factors (
  id uuid primary key default gen_random_uuid(),
  forecast_id uuid references forecasts(id) on delete cascade,
  label text not null,
  team_id uuid references teams(id),
  weight numeric,
  explanation text not null
);

create table if not exists forecast_interpretations (
  id uuid primary key default gen_random_uuid(),
  forecast_id uuid references forecasts(id) on delete cascade,
  language text not null check (language in ('en', 'es', 'fr')),
  headline text not null,
  summary text not null,
  tone_line text not null,
  missing_data_notes text[] not null default '{}',
  disclaimer text not null,
  created_at timestamptz not null default now(),
  unique (forecast_id, language)
);

create table if not exists ai_request_audits (
  id uuid primary key default gen_random_uuid(),
  forecast_id uuid references forecasts(id) on delete set null,
  provider text not null default 'openai',
  model text not null,
  request_payload jsonb not null,
  response_payload jsonb,
  status text not null,
  created_at timestamptz not null default now()
);

