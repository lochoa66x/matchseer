delete from matches
where external_id = 'mx-fr';

delete from teams
where slug = 'france'
  and not exists (
    select 1
    from matches
    where matches.home_team_id = teams.id
       or matches.away_team_id = teams.id
  );
