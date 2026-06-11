alter table teams add column if not exists record text;
alter table teams add column if not exists form text[] not null default '{}';
alter table teams add column if not exists attack integer check (attack between 0 and 100);
alter table teams add column if not exists control integer check (control between 0 and 100);
alter table teams add column if not exists defense integer check (defense between 0 and 100);
alter table teams add column if not exists set_pieces integer check (set_pieces between 0 and 100);

create unique index if not exists forecasts_match_version_idx
  on forecasts (match_id, version);

insert into competitions (slug, name, sport, season)
values ('world-cup-2026', 'World Cup', 'football', '2026')
on conflict (slug) do update set
  name = excluded.name,
  sport = excluded.sport,
  season = excluded.season;

insert into venues (slug, name, city, country)
values
  ('estadio-azteca', 'Estadio Azteca', 'Mexico City', 'Mexico'),
  ('metlife-stadium', 'MetLife Stadium', 'New Jersey', 'United States'),
  ('bmo-field', 'BMO Field', 'Toronto', 'Canada')
on conflict (slug) do update set
  name = excluded.name,
  city = excluded.city,
  country = excluded.country;

insert into referees (slug, name, cards_per_match, fouls_per_match)
values
  ('a-marciniak', 'A. Marciniak', 4.2, 24.1),
  ('m-oliver', 'M. Oliver', 3.6, 22.4),
  ('s-frappart', 'S. Frappart', 3.1, 20.8)
on conflict (slug) do update set
  name = excluded.name,
  cards_per_match = excluded.cards_per_match,
  fouls_per_match = excluded.fouls_per_match;

with competition as (
  select id from competitions where slug = 'world-cup-2026'
)
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
select
  competition.id,
  team.slug,
  team.name,
  team.code,
  team.color,
  team.country,
  team.record,
  team.form,
  team.attack,
  team.control,
  team.defense,
  team.set_pieces
from competition
cross join (
  values
    ('mexico', 'Mexico', 'MEX', '#11a36a', 'Mexico', '2W 1D 2L', array['W', 'D', 'L', 'W', 'L'], 74, 71, 69, 78),
    ('south-africa', 'South Africa', 'RSA', '#f5c542', 'South Africa', '3W 1D 1L', array['W', 'W', 'D', 'W', 'L'], 72, 70, 74, 76),
    ('brazil', 'Brazil', 'BRA', '#f5c542', 'Brazil', '3W 1D 1L', array['W', 'W', 'L', 'D', 'W'], 91, 86, 77, 72),
    ('japan', 'Japan', 'JPN', '#e83d52', 'Japan', '4W 0D 1L', array['W', 'W', 'W', 'L', 'W'], 79, 82, 80, 69),
    ('canada', 'Canada', 'CAN', '#e1251b', 'Canada', '2W 2D 1L', array['D', 'W', 'W', 'L', 'D'], 77, 73, 72, 75),
    ('morocco', 'Morocco', 'MAR', '#c1272d', 'Morocco', '3W 1D 1L', array['W', 'D', 'W', 'W', 'L'], 78, 79, 86, 80)
) as team(slug, name, code, color, country, record, form, attack, control, defense, set_pieces)
on conflict (slug) do update set
  competition_id = excluded.competition_id,
  name = excluded.name,
  code = excluded.code,
  color = excluded.color,
  country = excluded.country,
  record = excluded.record,
  form = excluded.form,
  attack = excluded.attack,
  control = excluded.control,
  defense = excluded.defense,
  set_pieces = excluded.set_pieces;

insert into players (team_id, slug, name, role, club, league, spark_rating, note)
select teams.id, player.slug, player.name, player.role, player.club, player.league, player.spark_rating, player.note
from (
  values
    ('mexico', 'santiago-gimenez', 'Santiago Gimenez', 'Forward', 'Feyenoord', 'Eredivisie', 76, 'Box gravity'),
    ('south-africa', 'teboho-mokoena', 'Teboho Mokoena', 'Midfielder', 'Mamelodi Sundowns', 'South African Premiership', 82, 'Long-range spark'),
    ('mexico', 'edson-alvarez', 'Edson Alvarez', 'Midfielder', 'West Ham', 'Premier League', 80, 'Duel anchor'),
    ('brazil', 'vinicius-junior', 'Vinicius Junior', 'Winger', 'Real Madrid', 'La Liga', 92, 'Left-lane lightning'),
    ('japan', 'takefusa-kubo', 'Takefusa Kubo', 'Creator', 'Real Sociedad', 'La Liga', 84, 'Pocket mischief'),
    ('brazil', 'bruno-guimaraes', 'Bruno Guimaraes', 'Midfielder', 'Newcastle', 'Premier League', 86, 'Tempo switch'),
    ('canada', 'alphonso-davies', 'Alphonso Davies', 'Wingback', 'Bayern Munich', 'Bundesliga', 90, 'Left-side ignition'),
    ('morocco', 'achraf-hakimi', 'Achraf Hakimi', 'Fullback', 'PSG', 'Ligue 1', 88, 'Two-way engine'),
    ('morocco', 'sofyan-amrabat', 'Sofyan Amrabat', 'Midfielder', 'Fenerbahce', 'Super Lig', 82, 'Midfield ballast')
) as player(team_slug, slug, name, role, club, league, spark_rating, note)
join teams on teams.slug = player.team_slug
on conflict (slug) do update set
  team_id = excluded.team_id,
  name = excluded.name,
  role = excluded.role,
  club = excluded.club,
  league = excluded.league,
  spark_rating = excluded.spark_rating,
  note = excluded.note;

insert into matches (
  external_id,
  competition_id,
  home_team_id,
  away_team_id,
  venue_id,
  referee_id,
  stage,
  group_name,
  starts_at,
  status,
  home_score,
  away_score
)
select
  match.external_id,
  competitions.id,
  home_team.id,
  away_team.id,
  venues.id,
  referees.id,
  match.stage,
  match.group_name,
  match.starts_at::timestamptz,
  match.status,
  match.home_score,
  match.away_score
from (
  values
    ('mx-rsa', 'mexico', 'south-africa', 'estadio-azteca', 'a-marciniak', 'Group stage', 'Group A', '2026-06-11 19:00:00+00', 'final', 2, 0),
    ('br-jp', 'brazil', 'japan', 'metlife-stadium', 'm-oliver', 'Group stage', 'Group C', '2026-06-12 21:00:00+00', 'scheduled', null, null),
    ('ca-ma', 'canada', 'morocco', 'bmo-field', 's-frappart', 'Group stage', 'Group F', '2026-06-12 00:00:00+00', 'scheduled', null, null)
) as match(external_id, home_slug, away_slug, venue_slug, referee_slug, stage, group_name, starts_at, status, home_score, away_score)
join competitions on competitions.slug = 'world-cup-2026'
join teams home_team on home_team.slug = match.home_slug
join teams away_team on away_team.slug = match.away_slug
join venues on venues.slug = match.venue_slug
join referees on referees.slug = match.referee_slug
on conflict (external_id) do update set
  competition_id = excluded.competition_id,
  home_team_id = excluded.home_team_id,
  away_team_id = excluded.away_team_id,
  venue_id = excluded.venue_id,
  referee_id = excluded.referee_id,
  stage = excluded.stage,
  group_name = excluded.group_name,
  starts_at = excluded.starts_at,
  status = excluded.status,
  home_score = excluded.home_score,
  away_score = excluded.away_score,
  updated_at = now();

insert into weather_snapshots (match_id, temperature_c, wind_kph, rain_probability, humidity, summary)
select matches.id, weather.temperature_c, weather.wind_kph, weather.rain_probability, weather.humidity, weather.summary
from (
  values
    ('mx-rsa', 23, 11, 12, 48, 'Thin air, fast counters, late legs.'),
    ('br-jp', 26, 8, 8, 55, 'Warm, clean, friendly to first touch.'),
    ('ca-ma', 18, 17, 18, 61, 'Cool breeze, cross-heavy, set-piece friendly.')
) as weather(external_id, temperature_c, wind_kph, rain_probability, humidity, summary)
join matches on matches.external_id = weather.external_id
where not exists (
  select 1 from weather_snapshots existing
  where existing.match_id = matches.id
);

with forecast_input as (
  select *
  from (
    values
      ('mx-rsa', 1, 57, 24, 19, '2-0', 74, 52),
      ('br-jp', 1, 53, 23, 24, '2-1', 72, 47),
      ('ca-ma', 1, 31, 30, 39, '1-1 / 1-2', 59, 66)
  ) as forecast(external_id, version, home_win_probability, draw_probability, away_win_probability, projected_score, confidence, chaos)
)
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
select
  matches.id,
  forecast_input.version,
  forecast_input.home_win_probability,
  forecast_input.draw_probability,
  forecast_input.away_win_probability,
  forecast_input.projected_score,
  forecast_input.confidence,
  forecast_input.chaos,
  jsonb_build_object('source', 'MatchSeer demo seed', 'forecastOnly', true)
from forecast_input
join matches on matches.external_id = forecast_input.external_id
on conflict (match_id, version) do update set
  home_win_probability = excluded.home_win_probability,
  draw_probability = excluded.draw_probability,
  away_win_probability = excluded.away_win_probability,
  projected_score = excluded.projected_score,
  confidence = excluded.confidence,
  chaos = excluded.chaos,
  source_payload = excluded.source_payload;

insert into forecast_factors (forecast_id, label, team_id, weight, explanation)
select forecasts.id, factor.label, teams.id, factor.weight, factor.explanation
from (
  values
    ('mx-rsa', 'Host rhythm', 'mexico', 0.42, 'Mexico carry the host rhythm and cleaner territory control.'),
    ('mx-rsa', 'South Africa transition', 'south-africa', 0.31, 'South Africa can still flash through midfield transitions.'),
    ('mx-rsa', 'Altitude spark', 'mexico', 0.27, 'The Azteca altitude keeps late legs in the story.'),
    ('br-jp', 'Shot creation', 'brazil', 0.41, 'Brazil lead in shot creation and individual spark.'),
    ('br-jp', 'Midfield tempo', 'japan', 0.28, 'Japan narrow the midfield gap with tempo.'),
    ('br-jp', 'Clean weather', null, 0.31, 'Weather looks clean enough for a technical match.'),
    ('ca-ma', 'Defensive structure', 'morocco', 0.39, 'Morocco rate higher in defensive structure.'),
    ('ca-ma', 'Wide pace', 'canada', 0.31, 'Canada wide pace lifts surprise risk.'),
    ('ca-ma', 'Open draw lane', null, 0.30, 'The draw lane is unusually open.')
) as factor(external_id, label, team_slug, weight, explanation)
join matches on matches.external_id = factor.external_id
join forecasts on forecasts.match_id = matches.id and forecasts.version = 1
left join teams on teams.slug = factor.team_slug
where not exists (
  select 1 from forecast_factors existing
  where existing.forecast_id = forecasts.id
    and existing.label = factor.label
);

insert into forecast_interpretations (
  forecast_id,
  language,
  headline,
  summary,
  tone_line,
  missing_data_notes,
  disclaimer
)
select forecasts.id, interpretation.language, interpretation.headline, interpretation.summary, interpretation.tone_line, interpretation.missing_data_notes, interpretation.disclaimer
from (
  values
    ('mx-rsa', 'en', 'Mexico vs South Africa', 'Mexico carry the host spark at Azteca, while South Africa bring transition danger and a loud opening-match memory.', 'The Seer leans Mexico, with the stadium pushing every touch.', array['Demo data until live providers are connected.'], 'Forecasts are for entertainment and sports analysis only. No betting advice.'),
    ('mx-rsa', 'es', 'Mexico vs Sudafrica', 'Mexico trae la chispa local en el Azteca, mientras Sudafrica amenaza en transiciones y memoria de partido inaugural.', 'El Vidente se inclina por Mexico, con el estadio empujando cada toque.', array['Datos demo hasta conectar proveedores en vivo.'], 'Pronosticos solo para entretenimiento y analisis deportivo. No son consejos de apuestas.'),
    ('mx-rsa', 'fr', 'Mexique vs Afrique du Sud', 'Le Mexique porte l elan local a l Azteca, tandis que l Afrique du Sud garde du danger en transition.', 'Le voyant penche Mexique, avec le stade derriere chaque touche.', array['Donnees demo jusqu a la connexion des fournisseurs live.'], 'Previsions a des fins de divertissement et d analyse sportive seulement. Aucun conseil de pari.'),
    ('br-jp', 'en', 'Brazil vs Japan', 'Brazil glow in attack, but Japan keep enough transition static to make the Seer sit forward.', 'Brazil lead, Japan keep the forecast awake.', array['Demo data until live providers are connected.'], 'Forecasts are for entertainment and sports analysis only. No betting advice.'),
    ('br-jp', 'es', 'Brasil vs Japon', 'Brasil brilla en ataque, pero Japon tiene suficiente electricidad en transicion para incomodar al Vidente.', 'Brasil lidera, Japon mantiene despierto el pronostico.', array['Datos demo hasta conectar proveedores en vivo.'], 'Pronosticos solo para entretenimiento y analisis deportivo. No son consejos de apuestas.'),
    ('br-jp', 'fr', 'Bresil vs Japon', 'Le Bresil brille devant, mais le Japon garde assez d electricite en transition pour reveiller le voyant.', 'Le Bresil mene, le Japon garde la prevision alerte.', array['Donnees demo jusqu a la connexion des fournisseurs live.'], 'Previsions a des fins de divertissement et d analyse sportive seulement. Aucun conseil de pari.'),
    ('ca-ma', 'en', 'Canada vs Morocco', 'Morocco bring the steadier defensive moon, but Canada have enough pace to make this forecast wobble.', 'Morocco are steadier, Canada keep the sprint lane open.', array['Demo data until live providers are connected.'], 'Forecasts are for entertainment and sports analysis only. No betting advice.'),
    ('ca-ma', 'es', 'Canada vs Marruecos', 'Marruecos trae una luna defensiva mas estable, pero Canada tiene velocidad suficiente para mover el pronostico.', 'Marruecos esta mas firme, Canada deja la banda encendida.', array['Datos demo hasta conectar proveedores en vivo.'], 'Pronosticos solo para entretenimiento y analisis deportivo. No son consejos de apuestas.'),
    ('ca-ma', 'fr', 'Canada vs Maroc', 'Le Maroc apporte une lune defensive plus stable, mais le Canada a assez de vitesse pour faire trembler la prevision.', 'Le Maroc est plus stable, le Canada garde la voie rapide ouverte.', array['Donnees demo jusqu a la connexion des fournisseurs live.'], 'Previsions a des fins de divertissement et d analyse sportive seulement. Aucun conseil de pari.')
) as interpretation(external_id, language, headline, summary, tone_line, missing_data_notes, disclaimer)
join matches on matches.external_id = interpretation.external_id
join forecasts on forecasts.match_id = matches.id and forecasts.version = 1
on conflict (forecast_id, language) do update set
  headline = excluded.headline,
  summary = excluded.summary,
  tone_line = excluded.tone_line,
  missing_data_notes = excluded.missing_data_notes,
  disclaimer = excluded.disclaimer;
