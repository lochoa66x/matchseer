# Phase 0.5 Setup Plan

## Goal

Before Sprint 1, set up the basic product rails so MatchSeer can move from planning into a real app without rework.

## Recommendation

Do **Phase 0.5** before the next build phase.

Order:
1. Secure the name and domain.
2. Create the GitHub repository.
3. Create the Neon database.
4. Create the Vercel project.
5. Add environment variables.
6. Start Sprint 1 with a prototype using sample data.

## Domain

Primary target:
- `matchseer.com`

Status:
- `matchseer.com` purchased.
- DNS connected to Vercel.
- First production deployment working.

Also consider:
- `matchseer.app`
- `matchseer.ai`

Recommendation:
- Primary domain secured.
- Buy `matchseer.app` if the price is reasonable.
- Only buy `matchseer.ai` if we want a strong AI-facing identity or it is inexpensive enough.

Important:
- Preliminary RDAP checks looked good, but registrar checkout is the real moment of truth.
- Domain purchase should happen before logo/design work.
- Formal trademark checks still need to happen before public launch.

## GitHub

Create repository:
- Suggested repo name: `matchseer`

Status:
- GitHub repository created.
- Repository connected to Vercel.

Use GitHub for:
- Source control
- Issues
- Pull requests
- Sprint backlog
- CI checks
- Release notes

Suggested starting labels:
- `phase-0`
- `sprint-1`
- `frontend`
- `data`
- `forecast-engine`
- `openai`
- `supabase`
- `non-betting-review`

## Neon

Create database project:
- Suggested project name: `matchseer`

Status:
- Neon database created.
- Neon connected to the Vercel `matchseer` project.

Use Neon for:
- Postgres database
- Forecast snapshots
- AI interpretation audits
- Match/team/player data
- Preview databases through Vercel integration if we enable it

MVP note:
- Do not require user login in the first version.
- If saved teams, alerts, or fantasy personalization need auth later, choose auth separately.
- If generated share card storage is needed later, choose storage separately.

## Vercel

Create project:
- Suggested project name: `matchseer`

Status:
- Vercel project created.
- GitHub repository connected.
- No production deployment yet.

Use Vercel for:
- Production hosting
- Preview deployments
- Environment variables
- Domain connection
- Future scheduled jobs if suitable

Recommended flow:
- GitHub repo connects to Vercel.
- Main branch deploys to production.
- Pull requests get preview deployments.

## OpenAI

Use OpenAI from the backend only.

Status:
- OpenAI environment variables added in Vercel.

Environment variable:
- `OPENAI_API_KEY`

Optional model variable:
- `OPENAI_MODEL`

Recommended value:
- `OPENAI_MODEL=gpt-5.5`

Security rule:
- Never expose the OpenAI key to browser code.
- Do not prefix it with `NEXT_PUBLIC_`.
- Store it in `.env.local` locally and Vercel environment variables in hosted environments.

OpenAI role:
- Forecast explanations
- Team comparison summaries
- Player comparison summaries
- English, Spanish, and French copy
- Post-match forecast reviews

OpenAI should not own:
- Scores
- Player stats
- Weather facts
- Referee facts
- Final probabilities

## Environment Variables

Local development:
- Copy `.env.example` to `.env.local`.
- Add real values locally.
- Do not commit `.env.local`.

Vercel:
- Add environment variables in the Vercel project settings.
- Use separate values for preview and production if needed.

Status:
- `DATABASE_URL` added through Neon integration.
- `OPENAI_API_KEY` added.
- `OPENAI_MODEL` added.
- `NEXT_PUBLIC_APP_NAME` added.
- `NEXT_PUBLIC_APP_URL` added.

Required first variables:

```text
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.5
DATABASE_URL=
NEXT_PUBLIC_APP_NAME=MatchSeer
NEXT_PUBLIC_APP_URL=
```

Future variables:

```text
SPORTS_DATA_API_KEY=
WEATHER_API_KEY=
```

## Before Sprint 1

Ready when:
- Domain decision is made. Done.
- Domain DNS points to Vercel. Done.
- GitHub repo exists. Done.
- Neon database exists. Done.
- Vercel project exists. Done.
- `.env.example` exists. Done.
- `.gitignore` blocks local env files. Done.
- OpenAI key is ready to add to local and Vercel environments. Done for Vercel.
- We know whether Sprint 1 starts with mock data or a real sports data provider. Done: Sprint 1 started with mock data.

## Sprint 1 Start

Build with sample data first:
- Home screen
- Match cards
- Match detail
- Forecast card
- Language switcher
- Team comparison module
- Player comparison module

Then connect Neon and provider data after the UI feels right.
