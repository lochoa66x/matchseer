# Sprint 9 - Venue Weather Sync

## What changed

- Added the 2026 World Cup host venue catalog with city and coordinates.
- Added an Open-Meteo provider for current venue weather.
- Added `/api/admin/sync-weather` for protected weather syncs.
- Football-data sync now keeps the venue catalog in Neon and uses provider venue fields when available.

## Environment

No weather API key is required for the current Open-Meteo bridge.

Required:

```bash
MATCHSEER_SYNC_SECRET=
DATABASE_URL=
```

## Readiness check

```bash
curl -s https://matchseer.com/api/admin/sync-weather
```

Expected shape:

```json
{
  "ready": true,
  "provider": "open-meteo",
  "envStatus": {
    "hasSyncSecret": true,
    "requiresWeatherToken": false
  },
  "requiredEnv": ["MATCHSEER_SYNC_SECRET"]
}
```

## Run weather sync

```bash
curl -s https://matchseer.com/api/admin/sync-weather \
  -X POST \
  -H "Authorization: Bearer YOUR_MATCHSEER_SYNC_SECRET"
```

If `matchesUpdated` is `0`, the weather bridge is healthy but the synced match rows do not have known stadium coordinates yet. Run the football-data sync again later when the provider includes venue fields, or add venue mapping rules for the fixture list.
