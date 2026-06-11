select 'competitions' as table_name, count(*) from competitions
union all
select 'venues', count(*) from venues
union all
select 'referees', count(*) from referees
union all
select 'teams', count(*) from teams
union all
select 'players', count(*) from players
union all
select 'matches', count(*) from matches
union all
select 'weather_snapshots', count(*) from weather_snapshots
union all
select 'forecasts', count(*) from forecasts
union all
select 'forecast_factors', count(*) from forecast_factors
union all
select 'forecast_interpretations', count(*) from forecast_interpretations
order by table_name;
