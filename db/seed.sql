insert into competitions (slug, name, sport, season)
values ('world-cup-2026', 'World Cup', 'football', '2026')
on conflict (slug) do nothing;

insert into venues (slug, name, city, country)
values
  ('estadio-azteca', 'Estadio Azteca', 'Mexico City', 'Mexico'),
  ('metlife-stadium', 'MetLife Stadium', 'New Jersey', 'United States'),
  ('bmo-field', 'BMO Field', 'Toronto', 'Canada')
on conflict (slug) do nothing;

insert into referees (slug, name, cards_per_match, fouls_per_match)
values
  ('a-marciniak', 'A. Marciniak', 4.2, 24.1),
  ('m-oliver', 'M. Oliver', 3.6, 22.4),
  ('s-frappart', 'S. Frappart', 3.1, 20.8)
on conflict (slug) do nothing;

