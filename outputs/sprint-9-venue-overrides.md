# Sprint 9.1 - Venue Overrides

## What changed

- Added `/api/admin/venue-overrides` for protected venue mapping.
- Manual venue overrides survive future football-data syncs when the provider still has no venue.
- Once matches have venue coordinates, `/api/admin/sync-weather` can attach Open-Meteo weather snapshots.

## Check available venue slugs

```bash
curl -s https://matchseer.com/api/admin/venue-overrides
```

## Apply venue overrides

```bash
curl -s https://matchseer.com/api/admin/venue-overrides \
  -X POST \
  -H "Authorization: Bearer YOUR_MATCHSEER_SYNC_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "overrides": [
      {
        "matchId": "fd-123456",
        "venueSlug": "mexico-city-stadium"
      }
    ]
  }'
```

## Run weather after overrides

```bash
curl -s https://matchseer.com/api/admin/sync-weather \
  -X POST \
  -H "Authorization: Bearer YOUR_MATCHSEER_SYNC_SECRET"
```

## Venue slugs

- `mexico-city-stadium`
- `guadalajara-stadium`
- `monterrey-stadium`
- `toronto-stadium`
- `vancouver-stadium`
- `atlanta-stadium`
- `boston-stadium`
- `dallas-stadium`
- `houston-stadium`
- `kansas-city-stadium`
- `los-angeles-stadium`
- `miami-stadium`
- `new-york-new-jersey-stadium`
- `philadelphia-stadium`
- `san-francisco-bay-area-stadium`
- `seattle-stadium`
