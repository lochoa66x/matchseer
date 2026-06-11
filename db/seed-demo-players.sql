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
