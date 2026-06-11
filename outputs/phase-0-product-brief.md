# Phase 0 Product Brief

## Working Title

Working name: **MatchSeer**

Name status:
- Confirmed for MVP.

Other name candidates:
- The Game Oracle
- The Cup Oracle
- The Cup Seer
- PitchSeer
- SquadSeer
- SquadSage

Current naming decision:
- Use **MatchSeer** as the app name for the MVP.
- Consider **The Game Oracle** if we want a broader AI sports-oracle identity.
- Consider **The Cup Seer** if we want a more magical, World Cup-specific launch name.
- Consider **The Cup Oracle** if we want a more mystical, World Cup-specific brand.
- Keep **PitchSeer** as the football-first alternative.
- Keep **SquadSeer** as the fantasy/player-comparison alternative.
- See `phase-0-naming-oracle-sports.md` for preliminary availability notes.
- See `phase-0-naming-round-3.md` for additional cup, seer, glory, and vision naming notes.

## One-Liner

MatchSeer is a multilingual World Cup companion that tracks matches, scores, teams, and players, then turns real statistics into fun, non-betting match forecasts.

## Product Thesis

Fans want more than scores. They want context, story, arguments, comparison, and a little sports-oracle chaos. MatchSeer gives them a fast way to understand each match: who is stronger, who is trending, what the conditions might change, and which players could tilt the game.

The product should feel smart but playful. It should never feel like a sportsbook.

## Core Positioning

MatchSeer is:
- A sports analytics app
- A match forecast playground
- A team and player comparison tool
- A multilingual World Cup companion
- An entertainment-first product using real statistics

MatchSeer is not:
- A betting product
- An odds board
- A gambling advice tool
- A subscription-first app
- A dry statistics dashboard

## Languages

Launch languages:
- English
- Spanish
- French

Language approach:
- Interface strings should use a structured translation file.
- Forecast explanations should be generated or translated with tone controls per language.
- The Spanish voice should feel natural, not literal.
- The French voice should feel confident and light, not overly formal.
- Match and player names should stay canonical across languages.

## Voice And Tone

The tone should feel like a playful weather forecast for football:
- Smart
- Slightly strange
- Confident but never absolute
- Funny without becoming unserious
- Analytical without becoming academic

Example in English:
> France enter with clean passing weather, a dangerous left side, and a 19% chance of full midfield thunder if the match gets messy.

Example in Spanish:
> Argentina llega con cielo despejado en ataque, presión alta y una nube pequeña de caos si el partido se rompe.

Example in French:
> Le Maroc avance avec un vent favorable en transition, une défense compacte et un petit risque d’orage sur coups de pied arrêtés.

## Experience Direction

MatchSeer should feel modern, fast, and fun to touch. The app should avoid heavy forms, crowded filters, and complicated input flows. Most interactions should be tap-based, card-based, or selection-based.

The first screen should be the product itself, not a marketing landing page:
- Today’s matches
- Live or upcoming status
- Forecast cards
- Quick team comparison entry points
- Language switcher

Design principles:
- Make match cards feel alive without overwhelming the user.
- Prefer simple controls: tabs, segmented controls, toggles, dropdowns, and search.
- Keep advanced details one tap away instead of visible everywhere.
- Use visual ratings, meters, and small charts instead of long tables.
- Use playful microcopy, but keep the core data easy to scan.
- Keep mobile as the primary experience.
- Make sharing feel natural from forecast and comparison cards.

Interaction style:
- Tap a match to open the forecast.
- Tap teams to compare.
- Tap players to compare.
- Swipe or switch tabs between forecast, teams, players, weather, and review.
- Use small, focused inputs only when search or comparison requires them.

The vibe should feel closer to a beautiful sports companion than a data-entry tool.

## Non-Betting Rules

Approved language:
- Forecast
- Projection
- Confidence
- Match outlook
- Upset risk
- Chaos meter
- Tactical edge
- Momentum
- Form
- Probability
- Scenario

Avoid language:
- Odds
- Bets
- Picks
- Locks
- Parlays
- Lines
- Wager
- Guaranteed
- Sure thing
- Value bet
- Bookmaker

Required disclaimer on forecast surfaces:
> Forecasts are for entertainment and sports analysis only. No betting advice.

## Primary Users

### Casual World Cup Fan

Wants to follow matches, understand who is favored, and sound smarter in group chats.

Needs:
- Simple match forecasts
- Easy scores and schedules
- Fun summaries
- Shareable cards

### Football Nerd

Wants deeper team and player comparisons.

Needs:
- Team strength indicators
- Recent form
- Player comparisons
- Tactical context
- Model transparency

### Multilingual Fan Group

Friends or family following the tournament across English, Spanish, and French.

Needs:
- Fast language switching
- Native-feeling copy
- Shareable multilingual summaries

### Future Fantasy User

Will later use the same product style for NFL Fantasy.

Needs:
- Player projections
- Weather and matchup effects
- Start/sit style recommendations
- Clear confidence indicators

## MVP Feature Scope

### Match Tracker

Core features:
- Upcoming matches
- Live or recent scores
- Final scores
- Match detail page
- Group or tournament standings
- Team pages
- Basic player pages

### Forecast Cards

Each match should show:
- Win/draw/win projection
- Projected score range
- Confidence level
- Chaos meter
- Upset risk
- Key factors
- Short multilingual explanation

### Team Comparison

Compare two teams by:
- Attack
- Defense
- Midfield control
- Goalkeeper confidence
- Recent form
- Squad strength
- Discipline risk
- Set-piece danger

### Player Comparison

Compare players by:
- Position
- Club
- League level
- Recent minutes
- Goals/assists or role-based production
- Defensive contribution where relevant
- Availability status
- Impact rating

### Shareable Moments

Initial shareable surfaces:
- Match forecast card
- Team comparison card
- Player comparison card
- Post-match “forecast review”

## Out Of Scope For MVP

Not included at launch:
- User accounts
- Paid subscriptions
- Betting integrations
- Comments or social network features
- Complex fantasy sports tools
- Full historical data explorer
- Native mobile apps

## Data Needs

### Required For MVP

Match data:
- Teams
- Schedule
- Venue
- Status
- Score
- Group or bracket context

Team data:
- FIFA or Elo-style strength
- Recent results
- Goals for and against
- Squad list
- Injuries or availability when available

Player data:
- Name
- Position
- National team
- Club
- League
- Recent performance indicators
- Minutes or availability

Environment data:
- Venue location
- Weather
- Temperature
- Wind
- Rain probability
- Humidity if useful

Referee data:
- Referee assignment when available
- Cards per match
- Fouls per match
- Penalty frequency if available

### Data Principles

- Prefer official or reputable sources.
- Cache third-party data to control cost and reliability.
- Label forecasts clearly when data is missing.
- Keep a visible “why this forecast?” explanation so the model does not feel magical in a bad way.

## Platform Stack

Confirmed usual combo:
- Vercel for web hosting, preview deployments, and production deployment
- GitHub for source control, pull requests, issues, and CI workflow
- Neon for serverless Postgres and Vercel-friendly database workflows
- OpenAI for forecast interpretation, multilingual narration, and AI-assisted summaries

Platform principles:
- Build as a web app first.
- Keep frontend deployments fast through Vercel previews.
- Keep structured match, team, player, forecast, and AI audit data in Neon Postgres.
- Use GitHub issues or projects for sprint tracking.
- Avoid requiring auth in MVP unless a user-facing feature truly needs accounts.
- Keep OpenAI API calls on the backend only.

## Forecast Engine V1

The first model should be understandable and tunable rather than overly complex.

Inputs:
- Team strength rating
- Recent form
- Goals scored and conceded
- Strength of schedule
- Player availability
- Rest days
- Venue and travel context
- Weather and temperature
- Referee discipline profile
- Squad league quality

Outputs:
- Team A win probability
- Draw probability
- Team B win probability
- Projected score range
- Confidence level
- Upset risk
- Chaos meter
- Key reasons

Suggested approach:
- Start with a rules-weighted statistical model.
- Add model explainability from day one.
- Use AI for narration, localization, and summarization.
- Do not let AI invent statistics.
- Store forecast inputs and outputs so we can review accuracy after matches.

## AI Role

AI should:
- Explain forecasts in a fun voice
- Localize summaries into English, Spanish, and French
- Generate shareable copy
- Summarize team and player comparisons
- Produce post-match forecast reviews
- Help interpret model outputs and data signals in plain language
- Flag when a forecast has weak data or conflicting signals

AI should not:
- Create unsupported stats
- Present forecasts as certainties
- Use betting language
- Replace the statistical forecast model

## OpenAI Integration

MatchSeer should connect directly to OpenAI through our backend, not from the browser.

Primary OpenAI jobs:
- Turn forecast model outputs into readable match analysis
- Generate short explanations in English, Spanish, and French
- Summarize team and player comparisons
- Produce post-match forecast reviews
- Create shareable forecast copy
- Help classify forecast factors into plain-language reasons

Suggested integration pattern:
- Backend gathers match, team, player, weather, referee, and forecast data.
- Backend sends a compact, validated payload to OpenAI.
- OpenAI returns structured JSON for title, summary, key factors, tone line, warnings, and localized copy.
- Backend validates the response before saving or showing it.
- Frontend only receives approved app data.

OpenAI should be allowed to influence:
- Interpretation
- Explanation
- Localization
- Tone
- Summary structure

OpenAI should not be allowed to independently decide:
- Final win/draw/win probabilities
- Final projected score
- Team ratings
- Player ratings
- Injury status
- Weather facts
- Referee facts

Forecast policy:
- The statistical model owns the numbers.
- OpenAI explains the numbers.
- If we later let OpenAI suggest forecast adjustments, those suggestions must be stored separately as model commentary and reviewed by deterministic guardrails before affecting user-facing forecasts.

Implementation guardrails:
- Use structured outputs for predictable response shapes.
- Use low-temperature settings for factual summaries.
- Include a banned-language check for betting terms.
- Include a missing-data field so uncertainty is visible.
- Store the exact input payload and generated output for audit and forecast review.
- Never send private user data unless a future personalized feature requires it and users consent.

## Key Pages

### Home

Purpose:
- Show today’s matches, live scores, and top forecast cards.

### Match Detail

Purpose:
- Give the full forecast, team comparison, weather, referee context, and key players.

### Teams

Purpose:
- Browse teams, form, squad, strengths, and upcoming matches.

### Players

Purpose:
- Browse or search players and compare impact.

### Compare

Purpose:
- Compare team vs team or player vs player.

### Forecast Review

Purpose:
- After a match, show what the forecast got right and wrong.

## Monetization

Primary model:
- Ads and sponsorships

Allowed ad categories:
- Sports gear
- Streaming services
- Food and drinks
- Travel
- Mobile games
- Watch party partners
- Collectibles
- General sports media

Avoid:
- Betting ads
- Casino ads
- Sportsbook sponsorships
- Any ad format that makes forecasts feel like gambling advice

Ad placement principles:
- Keep match cards readable.
- Avoid interrupting live-score scanning.
- Use sponsored sections sparingly.
- Never sell forecast influence.

## Analytics

Track:
- Match page views
- Forecast card opens
- Language switching
- Team comparisons
- Player comparisons
- Share clicks
- Ad impressions
- Forecast review views
- Returning users by matchday

Do not require accounts for MVP.

## Success Metrics

MVP success signals:
- Users return on multiple matchdays.
- Forecast cards get shared.
- Team comparison pages get meaningful usage.
- Users switch languages without friction.
- Ads can be shown without hurting the experience.
- The forecast engine can be reviewed after matches.

## Product Risks

### Data Quality

Risk:
- Missing or delayed data could make forecasts feel unreliable.

Mitigation:
- Cache data, show timestamps, and degrade gracefully.

### Betting Confusion

Risk:
- Probabilities can be misread as betting guidance.

Mitigation:
- Use non-betting language, disclaimer, and ad category restrictions.

### AI Hallucination

Risk:
- AI may invent facts.

Mitigation:
- Feed AI only validated forecast inputs and require factual grounding.

### Localization Quality

Risk:
- Translated tone may feel awkward.

Mitigation:
- Maintain language-specific tone examples and review core strings manually.

### Scope Creep

Risk:
- Trying to build every sports feature before launch.

Mitigation:
- Keep MVP focused on match tracking, forecast cards, and comparisons.

## Phase 0 Decisions

Confirmed:
- Build for World Cup first.
- Avoid betting entirely.
- Support English, Spanish, and French.
- Use ads, not subscriptions.
- Use real statistics with playful AI narration.
- Design the foundation so NFL Fantasy can be added later.

Open questions:
- Final product name
- Preferred data provider
- Whether launch starts as web-only or progressive web app
- Whether forecasts should require login later for personalization
- How playful the visual identity should be
- Whether to include sponsored content at launch or after initial traffic

## Phase 0 Definition Of Done

Phase 0 is complete when we have:
- Product brief
- MVP scope
- Non-betting rules
- Language strategy
- Data requirements
- Forecast model V1 scope
- Agile backlog
- Initial sprint plan
