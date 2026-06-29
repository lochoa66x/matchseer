# Phase 0 Agile Roadmap

## Agile Style

Recommended approach: lightweight Scrum with two-week sprints.

Why:
- The product has a clear launch surface.
- The model and data quality will need iteration.
- Matchday behavior will teach us fast.
- We can protect the MVP from scope creep while still leaving room for fun.

## Product Goal

Launch a multilingual World Cup web app that helps fans follow matches, compare teams and players, and enjoy non-betting AI-assisted forecasts based on real statistics.

## MVP Goal

Users should be able to:
- See today’s and upcoming matches
- Open a match page
- View a fun forecast card
- Understand the factors behind the forecast
- Compare the teams
- Compare key players
- Switch between English, Spanish, and French
- Share a forecast or comparison card

## Epic 1: Match Tracker

User stories:
- As a fan, I want to see today’s matches so I know what is happening now.
- As a fan, I want to see scores and match status so I can follow the tournament quickly.
- As a fan, I want to open a match detail page so I can understand the matchup.

Acceptance criteria:
- Matches show date, time, teams, venue, and status.
- Scores appear for live or completed matches when available.
- Match detail pages have stable URLs.
- Data source timestamps are visible or available internally.

Priority: Must Have

## Epic 2: Forecast Cards

User stories:
- As a fan, I want a match forecast so I can understand the likely shape of the game.
- As a fan, I want to know why a forecast looks that way.
- As a fan, I want the forecast to feel fun without sounding like betting advice.

Acceptance criteria:
- Forecast card shows win/draw/win projection.
- Forecast card shows projected score range.
- Forecast card shows confidence and chaos indicators.
- Forecast card lists key factors.
- Forecast copy avoids restricted betting language.
- Disclaimer appears on forecast surfaces.

Priority: Must Have

## Epic 3: Multilingual Experience

User stories:
- As a user, I want to switch between English, Spanish, and French.
- As a multilingual fan, I want forecasts that sound natural in my language.

Acceptance criteria:
- Language switcher is visible and persistent.
- Core UI strings exist in English, Spanish, and French.
- Forecast explanations can be rendered in all three languages.
- Team and player names remain consistent.

Priority: Must Have

## Epic 4: Team Comparison

User stories:
- As a fan, I want to compare two teams so I can understand strengths and weaknesses.
- As a fan, I want quick visual ratings so I can scan the matchup fast.

Acceptance criteria:
- Compare attack, defense, midfield, form, discipline, and squad strength.
- Show a short explanation of the biggest edge.
- Comparison works from match detail page.
- Comparison can become a shareable card.

Priority: Should Have

## Epic 5: Player Comparison

User stories:
- As a fan, I want to compare players across teams.
- As a fan, I want to understand league level and role context.

Acceptance criteria:
- Compare position, club, league, form, availability, and impact.
- Support at least two selected players.
- Provide a short AI-assisted summary grounded in visible data.

Priority: Should Have

## Epic 6: Shareable Cards

User stories:
- As a fan, I want to share a forecast with friends.
- As a fan, I want the shared card to look good without needing an account.

Acceptance criteria:
- Forecast card has a share action.
- Team comparison card has a share action.
- Shared card includes app name, teams, forecast summary, and disclaimer.
- No betting language appears on shared assets.

Priority: Should Have

## Epic 7: Ads And Sponsorship

User stories:
- As the business, I want ad placements that monetize without hurting the product.
- As a user, I do not want ads to block live scores or forecasts.

Acceptance criteria:
- Ad slots exist in low-friction locations.
- Betting and casino categories are excluded.
- Forecasts cannot be sponsored in a way that changes predictions.
- Ad layout does not break mobile scanning.

Priority: Could Have For MVP, Must Have Before Scale

## Epic 8: Forecast Review

User stories:
- As a fan, I want to see what the app got right or wrong after a match.
- As the team, we want to measure model quality over time.

Acceptance criteria:
- Completed match can show prior forecast.
- Review explains outcome versus prediction.
- Store forecast snapshot before match starts.

Priority: Could Have

## Epic 9: OpenAI Interpretation Layer

User stories:
- As a fan, I want forecasts explained in clear, fun language.
- As a fan, I want the app to explain uncertainty instead of pretending every prediction is strong.
- As the product team, we want AI-generated copy to stay grounded in validated data.

Acceptance criteria:
- Backend can send a validated forecast payload to OpenAI.
- OpenAI returns structured forecast interpretation fields.
- Generated output exists in English, Spanish, and French.
- Output is checked for banned betting language before display.
- Output cannot invent or overwrite statistics.
- Forecast numbers and AI interpretation are stored separately.
- Missing data is surfaced in the explanation when relevant.

Priority: Must Have For Forecast MVP

## Sprint 0: Phase 0 Completion

Goal:
- Finish product definition and choose the build path.

Deliverables:
- Product brief
- Agile backlog
- MVP scope
- Data requirements
- Forecast model V1 spec
- Non-betting content rules
- Initial design direction
- Low-input interaction principles

Exit criteria:
- We know what we are building first.
- We know what we are intentionally not building.
- We have enough clarity to start the prototype.

## Sprint 0.5: Infrastructure Setup

Goal:
- Set up the basic product rails before prototype development.

Candidate tasks:
- Buy or reserve the MatchSeer domain.
- Create GitHub repository.
- Create Neon database.
- Create Vercel project.
- Add environment variable template.
- Add local secret safety through `.gitignore`.
- Add OpenAI, Neon, and app URL variables to Vercel when available.

Definition of done:
- Domain decision is complete.
- Repository exists.
- Vercel is connected to GitHub.
- Neon database exists.
- Local `.env.example` exists without secrets.
- Real secrets are stored only in local `.env.local` and Vercel environment settings.
- Sprint 1 can start without infrastructure guessing.

## Sprint 1: Prototype And Visual System

Goal:
- Build the first clickable web prototype.

Candidate tasks:
- Create app shell
- Define navigation
- Build home match list
- Build match detail layout
- Build language switcher
- Create forecast card component
- Define initial visual identity
- Define low-input interaction patterns
- Create mobile-first match card and forecast card layouts

Definition of done:
- Prototype runs locally.
- Desktop and mobile layouts work.
- Core screens are visible with sample data.
- No betting language appears in UI.
- Main flows work through taps, tabs, and selections instead of heavy forms.

## Sprint 2: Real Match Data Foundation

Goal:
- Connect the app to match and team data.

Candidate tasks:
- Choose data provider
- Create data ingestion layer
- Normalize teams, matches, venues, and scores
- Add caching
- Add basic error states
- Add data freshness indicator

Definition of done:
- Match data appears from a real or provider-like source.
- App handles missing data cleanly.
- Team pages can be generated from normalized data.

## Sprint 3: Forecast Engine V1

Goal:
- Generate explainable forecasts.

Candidate tasks:
- Implement rating inputs
- Implement probability output
- Add projected score range
- Add confidence and chaos metrics
- Add forecast explanation payload
- Add forecast snapshots
- Add OpenAI interpretation endpoint
- Add structured output validation
- Add banned betting-language check

Definition of done:
- Every upcoming match can show a forecast.
- Forecast has visible reasons.
- Forecast output can be reviewed later.
- AI copy uses only provided model facts.

## Sprint 4: Comparisons And Sharing

Goal:
- Make the product sticky and social.

Candidate tasks:
- Team comparison page
- Player comparison page
- Match page comparison module
- Shareable forecast card
- Shareable team comparison card

Definition of done:
- Users can compare teams from a match.
- Users can compare key players.
- Share cards render cleanly on mobile.

## Sprint 5: Monetization And Launch Polish

Goal:
- Prepare for public traffic.

Candidate tasks:
- Add ad slots
- Exclude betting categories
- Add analytics events
- Improve performance
- Add SEO metadata
- Add final disclaimers
- Add launch checklist

Definition of done:
- App is launch-ready.
- Ads do not disrupt core match flows.
- Analytics can measure MVP success.
- Forecast pages clearly say they are not betting advice.

## Recommended Build Stack

Suggested web stack:
- Next.js
- TypeScript
- Tailwind CSS
- Neon Postgres
- Separate object storage later if shareable images or generated assets need persistence
- Vercel hosting and preview deployments
- GitHub source control, issues, pull requests, and CI
- Server-side API routes for data normalization
- Scheduled jobs for data refresh
- OpenAI narration and interpretation layer behind a backend API endpoint

Why this stack:
- Fast web MVP
- Good SEO for match pages
- Easy internationalization
- Clean preview links for every change
- Strong database foundation without heavy infrastructure work
- Strong path to future NFL Fantasy features

## Initial Data Model

Core objects:
- Sport
- Competition
- Season
- Team
- Player
- Match
- Venue
- Referee
- WeatherSnapshot
- Forecast
- ForecastFactor
- ForecastInterpretation
- AIRequestAudit
- Language
- ArticleOrRecap

Future NFL-ready objects:
- FantasyLeague
- FantasyRoster
- PlayerProjection
- InjuryReport
- WaiverCandidate
- StartSitDecision

## NFL Fantasy Utility Pipeline

Product principle:
- Fantasy Seer should feel like a smart friend helping a user win their league, not a glowing sports-trading terminal.
- Fantasy advice should be calm, original, trustworthy, and actionable.
- The best experience starts with the next useful move, then lets deeper users open the receipts.

Pipeline order:
- Redesign Fantasy Seer around Your Best Move as the default hero.
- Add Close Call as the second most important module.
- Add Trade/Waiver Idea as the third decision module.
- Move deeper analytics into Receipts / Model Lab.
- Add Roster Map with trust bands.
- Add League Strength Compare: my roster versus league, position by position.
- Add Pre-kickoff Checklist: injuries, weather, role, and opponent defense.
- Add Sleeper refresh loop so advice feels alive.

Design guardrails:
- Use the ChatGPT fantasy redesign as product-architecture inspiration, not final art direction.
- Keep the hierarchy: recommendation first, reason second, receipts third.
- Avoid fantasy-casino energy, heavy glow, stale player-photo theater, and overdecorated official-looking sports branding.
- Use player and team names as analysis references only, with MatchSeer remaining clearly independent.

## Definition Of Ready

A task is ready when:
- User value is clear.
- Required data is identified.
- UI state is understood.
- Acceptance criteria are written.
- Dependencies are known.

## Definition Of Done

A task is done when:
- It works on mobile and desktop.
- English, Spanish, and French strings are handled where relevant.
- No restricted betting language is introduced.
- Empty, loading, and error states are covered.
- Data source or mock source is clear.
- The change is reviewed against the product tone.

## Immediate Next Decisions

Before coding Sprint 1, decide:
- Final or temporary app name
- Visual direction
- Whether to build with mock data first or choose a real data provider immediately
- Vercel project setup
- Neon database setup
- GitHub repository setup
- Whether AI explanations should be generated live or precomputed per match
- The first set of playful UI patterns: forecast cards, chaos meter, team edge meter, player comparison chips

## Suggested Next Step

Create a clickable MVP prototype with sample data:
- Home
- Match detail
- Forecast card
- Team comparison
- Player comparison
- Language switcher
