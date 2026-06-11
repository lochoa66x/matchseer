# Sprint 2 Data Foundation

## Goal

Move MatchSeer from a pure mockup toward a real data-backed app while keeping the live prototype stable.

## Delivered

- Neon-oriented SQL schema in `db/schema.sql`
- Initial seed SQL in `db/seed.sql`
- Shared domain types in `lib/domain.ts`
- Shared sample match data in `lib/sample-data.ts`
- Data access adapter in `lib/database.ts`
- API route for match lists: `GET /api/matches`
- API route for match detail: `GET /api/matches/:matchId`
- API route for forecast interpretation: `POST /api/ai/forecast-interpretation`

## Current Data Mode

The UI still renders from its local Sprint 1 sample data so the live page remains stable.

The new API routes use shared seeded data and are ready to be swapped to Neon reads after the Neon driver package is installed.

## OpenAI Endpoint Status

The forecast interpretation endpoint currently returns a seeded fallback interpretation.

Why:
- It lets the frontend contract exist now.
- It keeps generated text grounded in known forecast facts.
- It runs the restricted betting-language guard.
- The npm registry was unreachable during Sprint 2, so the OpenAI SDK was not installed.

Next implementation step:
- Use the built-in `fetch` Responses API call or install the OpenAI SDK once npm registry access is healthy.

## Database Next Step

Run `db/schema.sql` in Neon.

Then run `db/seed.sql`.

After that:
- Install `@neondatabase/serverless` when npm registry access is available.
- Replace the seeded adapter in `lib/database.ts` with Neon queries.
- Keep the seeded fallback for local development and demos.

