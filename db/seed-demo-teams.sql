alter table teams add column if not exists record text;
alter table teams add column if not exists form text[] not null default '{}';
alter table teams add column if not exists attack integer check (attack between 0 and 100);
alter table teams add column if not exists control integer check (control between 0 and 100);
alter table teams add column if not exists defense integer check (defense between 0 and 100);
alter table teams add column if not exists set_pieces integer check (set_pieces between 0 and 100);

insert into competitions (slug, name, sport, season)
values ('world-cup-2026', 'World Cup', 'football', '2026')
on conflict (slug) do update set
  name = excluded.name,
  sport = excluded.sport,
  season = excluded.season;

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

delete from teams
where slug = 'france'
  and not exists (
    select 1
    from matches
    where matches.home_team_id = teams.id
       or matches.away_team_id = teams.id
  );
