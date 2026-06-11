# Phase 0 Technical Stack

## Confirmed Stack

MatchSeer will use the usual combo:
- **Vercel** for hosting, preview deployments, production deployment, and edge-friendly web delivery
- **GitHub** for source control, pull requests, issues, sprint tracking, and CI
- **Neon** for serverless Postgres and Vercel-friendly database workflows
- **OpenAI** for forecast interpretation, multilingual narration, comparison summaries, and post-match reviews

## Recommended App Stack

Frontend:
- Next.js
- TypeScript
- Tailwind CSS
- Responsive, mobile-first UI

Backend:
- Next.js server routes or route handlers
- Neon Postgres
- Scheduled data refresh jobs
- OpenAI API calls from backend only

Data:
- Neon Postgres for core structured data
- Separate object storage later only if we need generated share cards or uploaded assets
- Cached provider data for scores, weather, teams, players, and referees

## Deployment Flow

Recommended flow:

1. Code lives in GitHub.
2. Every pull request gets a Vercel preview deployment.
3. Neon provides Postgres database environments.
4. Environment variables live in Vercel and local `.env` files.
5. Production deploys from the main branch.

## Neon Role

Neon should store:
- Teams
- Players
- Matches
- Venues
- Referees
- Weather snapshots
- Forecasts
- Forecast factors
- Forecast interpretations
- AI request audits
- Share card metadata

Auth:
- Not required for MVP.
- Choose separately later if saved teams, personalized alerts, or NFL Fantasy features need accounts.

## Vercel Role

Vercel should handle:
- Web hosting
- Preview deployments
- Production deployment
- Environment variables
- Scheduled jobs if suitable for data refresh
- Performance and analytics options if we choose to enable them

## GitHub Role

GitHub should handle:
- Repository
- Pull requests
- Code review
- Issues
- Sprint backlog
- CI checks
- Release notes

## OpenAI Role

OpenAI should run through backend endpoints only.

Use it for:
- Forecast explanations
- Team comparison summaries
- Player comparison summaries
- Multilingual copy
- Share captions
- Post-match reviews

Do not use it for:
- Storing secret keys in the browser
- Inventing source stats
- Overwriting deterministic forecast outputs
- Generating betting-style language

## Environment Variables

Expected variables:

```text
OPENAI_API_KEY=
DATABASE_URL=
OPENAI_MODEL=gpt-5.5
NEXT_PUBLIC_APP_NAME=MatchSeer
NEXT_PUBLIC_APP_URL=
```

Additional provider keys will be added after choosing sports, weather, and referee data providers.

## MVP Technical Principle

Keep infrastructure boring so the product can be fun.
