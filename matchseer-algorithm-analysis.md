# MatchSeer — deep analysis: algorithm & data opportunities

_Grounded in a read of `matchseerV3Forecast` (lib/database.ts), the cup model and probability code (app/page.tsx), and the data layer. Written 14 June 2026._

## How the engine works today (as built)

**Match forecast — `matchseer-v3.1`:**
- Base team power = `attack·0.32 + control·0.24 + defense·0.28 + setPieces·0.16` (from each team's stored ratings).
- Modifiers added to/subtracted from power: venue familiarity, weather, referee rhythm, spotlight gravity (popularity), player availability (injuries/suspensions), fatigue.
- `powerGap = homePower − awayPower`.
- Win split: logistic `1 / (1 + e^(−powerGap/10))` distributed across the non-draw pool.
- Draw: heuristic `28 + (chaos−58)·0.09 − |powerGap|·0.4`.
- Chaos: heuristic from power gap + attack-vs-defense mismatch + modifier deltas.
- Confidence: heuristic `50 + |powerGap|·1.04 + (78−chaos)·0.08 − drag·0.24`, clamped 45–80.
- Expected goals (xG) computed separately, then projected scoreline from xG + a "tournament reality" check.
- Versioned ledger with a fingerprint so identical inputs don't create new versions. Solid engineering.

This is already well beyond a toy model. The opportunities below are about **accuracy, consistency, and turning the data you already collect into a feedback loop.**

---

## The biggest opportunities (algorithm), in priority order

### 1. Close the loop: calibrate against your own receipts (highest leverage)
You already store every forecast and its outcome ("Did the Seer survive the whistle" — hits/misses/exact). **That's labelled training data you're currently only displaying.** Right now confidence and the model constants are hand-tuned guesses. With the receipts you can measure: when the Seer says 60%, does it happen ~60% of the time? If 60%-confidence calls only hit 50%, the model is overconfident and the logistic scale (`/10`) and confidence formula should be tuned. This converts a display gimmick into a self-improving system, and over a tournament you accumulate real ground truth. Start simple: a calibration check (predicted-vs-actual buckets), then nudge the constants.

### 2. Fix a real inconsistency: the match model ignores your curated priors and form
You maintain a hand-curated tournament-strength table (Argentina 93, Brazil 91, France 94…) and a form score — **but those only feed the "Cup Seer" view, not the actual match forecast.** The match forecast's strength rests entirely on the stored `attack/control/defense/setPieces` ratings. So if those ratings are noisy or synthetic, a Brazil-vs-minnow match can be mispriced even though you "know" Brazil is elite. Fix: blend the curated prior (or better, an Elo — see #4) into the match power as a Bayesian anchor, e.g. `power = 0.6·prior + 0.4·ratings`. Likely your single biggest accuracy gain for low effort.

### 3. Make expected goals the single source of truth (one consistent model)
Today the win/draw/away split (logistic on power) and the scoreline (from xG) are computed **separately** — they can quietly disagree (e.g. a 2-1 projected score that doesn't match the 1X2 split). A **bivariate Poisson** model derives 1X2, correct score, and over/under from one consistent set of expected goals. Fewer hand-tuned constants, internally consistent outputs, and it unlocks new content for free (correct-score odds, over/under, clean-sheet probability) — all very shareable.

### 4. Replace static priors with a self-updating Elo
Your curated priors are a snapshot that goes stale and needs manual upkeep. A simple Elo rating, updated after every result (you already ingest results), is the battle-tested base rate in football modelling: it self-calibrates, needs zero manual maintenance, and naturally captures "this team is on a run." Use it as the prior in #2.

---

## New data/variables worth adding (ranked by signal vs. effort)

1. **Recent form with recency weighting** — last 5–10 results, weighted toward recent, ideally by xG not just W/L. You have a `form` field but it's absent from the match model; wire it in. (Low effort, real signal.)
2. **Elo / world-ranking momentum** — see #4. (Medium effort, high signal, self-maintaining.)
3. **Key-player availability weighting** — you track availability, but losing a star ≠ losing a squad player. Weight by player importance / minutes. Lineups when published (~1h pre-kickoff) are gold. (Medium.)
4. **True fatigue: rest days + travel** — days since last match and travel distance between host cities (this is a sprawling, multi-city World Cup). Congestion and jet-lag are real edges. (Low–medium.)
5. **Match stakes / motivation** — dead rubbers and already-qualified teams rest players → high variance. Model qualification scenarios as a chaos/variance input. (Medium; very World-Cup-specific.)
6. **Head-to-head & style matchups** — some styles travel badly against others (e.g. low-block vs. possession). (Lower priority.)
7. **Crowd signal as a calibration anchor** — the market (Polymarket) is often the single best predictor. You already use it as a confidence/chaos nudge; consider blending it lightly into the probability itself — but keep it behind the curtain (never named), per the brand rule.
8. **Live in-play state** — for live matches (you already show "Live 2-2"), a live win-probability model using current score + red cards + minute is extremely sticky and shareable. Strong product bet.
9. **Ratings provenance** — the foundation. If `attack/control/defense/setPieces` are static seeds, the whole model inherits their error. Deriving them from real underlying stats (xG for/against, shot quality, possession-adjusted metrics) would lift everything above it.

---

## Product opportunities that leverage the algorithm

- **Public track-record / accuracy page.** You have the receipts — surface "the Seer's hit rate" publicly. Builds trust, it's shareable, and it's fresh SEO content. (Honest calibration also lets you say "the Seer is unsure here," which is on-brand for a fortune-teller and builds credibility.)
- **Correct score + over/under + clean sheet** — free outputs once you have the Poisson model (#3). More to read and share per match.
- **Live win-probability graph** during matches — the stickiest feature on this list; people return to watch the line move.
- **Per-match calibrated confidence** — tie confidence to real hit-rate-at-margin and data completeness (do we have lineups? recent form?), not just the power gap.

---

## Suggested sequence (avoid the rabbit hole)

1. **Build the calibration check first** (#1) — it's cheap and tells you where the model is actually wrong, so every later change is measured, not guessed.
2. **Blend a prior/Elo into the match power** (#2 + #4) — biggest accuracy gain.
3. **Unify on a Poisson xG model** (#3) — consistency + free new outputs.
4. **Layer the highest-signal new data** — form, fatigue, key-player availability.
5. **Then the product bets** — track-record page, live win probability.

Don't do all of this at once. #1 and #2 alone would likely be the most noticeable jump in quality, and #1 makes everything after it measurable.

---

## Round 2 — more variables to add (World Cup specific)

World-standing is now in. These next ones are tournament-specific, where the real edge lives. Ranked by signal vs effort.

1. **Stage awareness: group vs knockout (structural — do this).** The model treats every match like a league game, but knockouts behave differently: tighter, more cautious, lower-scoring, and they *cannot end in a draw* (extra time → penalties). The draw probability and chaos logic should branch on stage. High signal, and it fixes a correctness gap.

2. **Penalty / extra-time model for knockouts (WC-specific + shareable).** When a knockout is level, who survives a shootout? A small model from historical shootout record + keeper quality. Adds a fun, screenshot-worthy output ("if it goes to pens, the Seer leans X") and is uniquely World-Cup.

3. **Qualification stakes & motivation (group stage).** As the group unfolds, what a team *needs* changes behaviour: must-win → aggressive, more variance; already-qualified → rotation, low stakes, high chaos; dead rubber → coin-flip. Feed current group standings + "what each side needs" into the variance/chaos and even the lean. Very high signal late in groups.

4. **Altitude + heat acclimatization (2026 is built for this).** The 2026 venues span Mexico City altitude (~2,240m), desert heat, and cool northern cities. Altitude and extreme heat measurably sap teams not used to them. You already pull weather — add altitude and a heat-acclimatization factor by team origin. Concrete, measurable, very 2026-relevant.

5. **In-tournament form & xG trend.** How a team has actually looked *in this tournament so far* (goals, xG for/against over their played matches), recency-weighted. Updates live as the tournament progresses and captures teams catching fire or wobbling — something static ratings miss.

6. **Rest differential + extra-time hangover.** Days of rest between matches is uneven, and a team that just played 120 minutes + penalties is more fatigued than the rest-day figure alone shows. Make "fatigue" a concrete rest-days-differential plus an extra-time penalty.

7. **Diaspora / fan-presence home advantage.** Many "neutral" 2026 venues won't be neutral — Mexico, Argentina, etc. travel huge, and host-nation games are de facto home games. Extend venue familiarity into expected crowd support at specific host cities.

8. **Suspension accumulation.** Yellow-card build-up causes key players to miss the *next* match. Track tournament card accumulation and fold into availability for the upcoming fixture.

### Top picks to build next (after the calibration check)
- **#1 stage awareness** and **#3 qualification stakes** — biggest structural/behavioural signal, very WC-specific.
- **#4 altitude/heat** — concrete, measurable, perfectly suited to 2026's venue spread.
- **#2 penalty model** — smaller signal but a distinctive, shareable feature.

As before: build the **receipts calibration check first** so each addition is measured, not guessed. Adding variables without measuring can quietly make the model worse (more knobs, more noise).
