# Phase 0 OpenAI Integration Plan

## Goal

Use OpenAI as the interpretation and narration layer for MatchSeer while keeping all statistics, probabilities, and source facts controlled by our own app.

Simple rule:

> The model calculates. OpenAI explains.

## What OpenAI Should Do

OpenAI should help with:
- Match forecast interpretation
- Team comparison summaries
- Player comparison summaries
- Multilingual copy in English, Spanish, and French
- Post-match forecast reviews
- Shareable forecast captions
- Missing-data explanations
- Tone control

## What OpenAI Should Not Do

OpenAI should not independently create:
- Match scores
- Win/draw/win probabilities
- Player stats
- Team stats
- Weather facts
- Referee facts
- Injury reports
- League rankings

If a fact is not in the input payload, OpenAI should say the data is missing or avoid mentioning it.

## Architecture

Recommended flow:

1. Data providers send match, team, player, weather, and referee data to our backend.
2. Our forecast engine calculates probabilities, projected score range, confidence, upset risk, and chaos meter.
3. Backend builds a compact forecast payload.
4. Backend sends that payload to OpenAI.
5. OpenAI returns structured interpretation data.
6. Backend validates the response.
7. Backend saves the approved interpretation.
8. Frontend displays the forecast card and explanation.

Recommended starting model:
- `gpt-5.5`

Why:
- Strong fit for grounded, customer-facing explanation workflows.
- Supports structured outputs and the Responses API flow we want for forecast interpretation.

## Why Backend Only

The OpenAI connection should live on the server because:
- API keys stay private.
- We can validate all model output.
- We can cache generated explanations.
- We can control cost.
- We can prevent the browser from sending unsafe or malformed prompts.
- We can audit forecasts after matches.

## Structured Output Shape

Suggested response fields:

```json
{
  "language": "en",
  "headline": "France carry the brighter sky",
  "summary": "France have the stronger attacking profile, but Morocco's compact defense keeps the upset risk alive.",
  "tone_line": "There is a small storm cloud hovering over set pieces.",
  "key_factors": [
    {
      "label": "Attack edge",
      "team": "France",
      "explanation": "France rate higher in chance creation and shot quality."
    }
  ],
  "missing_data_notes": [
    "Referee assignment is not available yet."
  ],
  "disclaimer": "Forecasts are for entertainment and sports analysis only. No betting advice."
}
```

## Prompt Principles

Every OpenAI request should include:
- The language to write in
- The approved tone rules
- The forecast numbers
- The data factors
- Missing data
- Restricted betting language
- Required disclaimer
- A strict instruction to avoid inventing facts

## Forecast Collaboration Model

V1:
- Our statistical model owns all forecast numbers.
- OpenAI only explains and localizes.

V2:
- OpenAI may suggest qualitative notes like “forecast confidence is fragile because injury data is missing.”
- Suggestions remain separate from the numeric forecast.

V3:
- OpenAI may help identify unusual factor combinations for human review.
- Numeric changes still require deterministic model rules or reviewed model updates.

## Safety And Quality Checks

Before showing AI output:
- Validate required fields.
- Check for restricted betting language.
- Check that numbers match the source forecast.
- Check that mentioned teams and players exist in the payload.
- Check that missing data is not described as known.
- Store input and output for audit.

## Cost Control

Cost controls:
- Generate explanations once per forecast update, not on every page load.
- Cache by match ID, forecast version, and language.
- Use shorter prompts with compact JSON payloads.
- Use smaller or faster models for routine localization if quality is good enough.
- Regenerate only when source data changes.

## Multilingual Strategy

Option A:
- Generate English first, then ask OpenAI for Spanish and French versions.

Option B:
- Generate each language directly from the same structured forecast payload.

Recommendation:
- Use Option B for launch so Spanish and French sound native instead of translated.

## Non-Betting Enforcement

Restricted terms:
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

Every AI endpoint should run a restricted-language check before saving output.

## First Implementation Task

Build a backend endpoint:

`POST /api/ai/forecast-interpretation`

Input:
- Match ID
- Language
- Forecast payload version

Output:
- Structured forecast interpretation

The endpoint should:
- Load forecast data from our backend
- Call OpenAI
- Validate the response
- Save the generated interpretation
- Return approved output to the frontend
