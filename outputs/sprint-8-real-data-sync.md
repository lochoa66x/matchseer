# Sprint 8 Real Data Sync

MatchSeer now has a protected real-data sync endpoint for football-data.org.

## Environment Variables

Add these in Vercel for Production and Preview:

```bash
FOOTBALL_DATA_API_TOKEN=your_football_data_token
FOOTBALL_DATA_COMPETITION=WC
MATCHSEER_SYNC_SECRET=make_a_long_random_secret
```

`DATABASE_URL` must already be present from Neon.

## Sync Endpoint

```bash
curl -s https://matchseer.com/api/admin/sync-football-data \
  -X POST \
  -H "Authorization: Bearer YOUR_MATCHSEER_SYNC_SECRET"
```

## What It Does

- Fetches competition teams from football-data.org.
- Fetches competition matches from football-data.org.
- Upserts the competition, teams, matches, and a placeholder venue into Neon.
- Creates or updates a baseline forecast row per synced match.
- Adds basic EN/ES/FR forecast copy so the UI still works before a user asks the Seer.

## Notes

- This is the provider bridge, not the full paid-data layer.
- Venue details, weather, referee assignments, lineups, and advanced player stats are Sprint 9+.
- The endpoint requires `MATCHSEER_SYNC_SECRET`; without it, sync returns 503 or 401.
