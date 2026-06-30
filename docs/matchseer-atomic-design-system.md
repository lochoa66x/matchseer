# MatchSeer Atomic Design System

This pass adapts Brad Frost's Atomic Design method for MatchSeer: build the interface from small reusable parts, combine them into useful product modules, and let pages become composed states instead of one-off screens.

Reference: https://atomicdesign.bradfrost.com/

## Design Intent

MatchSeer should feel like a premium analysis desk with a playful voice, not a sportsbook, a stock terminal, or a generic AI dashboard.

Core qualities:

- Clear first read: the user should know the lean, best move, or next action in the first few seconds.
- Calm density: show data, but only after the page has established the primary decision.
- Independent sports language: no official league branding, official marks, player photos, or team logos.
- Friendly intelligence: football games can keep the Seer mythology; fantasy advice should sound like a sharp friend.
- Receipts without clutter: model evidence belongs in compact panels, drawers, or secondary rooms.

## Atoms

Atoms are the smallest visual decisions we reuse everywhere.

- Buttons: 36-40px high, pill or 10-12px radius, one clear verb, icon when it helps recognition.
- Chips: compact status labels for phase, week, confidence, context, source health, and view filters.
- Badges: short semantic labels like `Live`, `Fallback`, `Preseason`, `Lean not lock`, `Watch`.
- Team marks: text initials and generic non-official color accents only.
- Player marks: generic silhouette/initial/avatar only; no real portraits, official helmets, or league/team marks.
- Bars/meters: muted track, single meaningful fill, visible label, no stacked rainbow unless comparison is the point.
- Microcopy: one-line helper text under controls; avoid explaining the whole app inside the UI.

## Molecules

Molecules are small reusable clusters.

- Source truth strip: source count plus provider pills, capped at one scan line on desktop where possible.
- Match lean row: team labels, probability bar, and a plain-English confidence label.
- Metric cell: label, value, optional one-line explanation.
- Decision card: action, player/team target, confidence, why, fallback.
- Trade lane preview: target, offer idea, walk-away line.
- Roster strength cell: position, band, and one short note.
- Ask chips: preset questions such as `Why this lean?`, `What flips it?`, `Explain like a friend`.

## Organisms

Organisms are the major product sections.

- Pro Football Game Card: faceoff, lean, projected score, confidence, favorite edge, underdog path, flip factors, receipts.
- Match Explorer: phase/week/group filters plus compact matchup list.
- Fantasy Command Center: selected league, selected team, compare target, source truth, shortcuts.
- Best Move Panel: the top fantasy action with why, confidence, fallback, and pre-kickoff reminder.
- League Strength Compare: my roster vs another roster, position by position.
- Trade Builder: target, surplus offer, overpay line, and fit explanation.
- World Cup Knockout Room: next round first, venue/travel/fatigue/extra-time/penalty path.
- Admin Console: provider health, sync actions, data freshness, and import diagnostics.

## Templates

Templates define layout rules before content is inserted.

- Pro Football Seer: left selection rail, right Game Card, secondary scenario/DNA sections below.
- Fantasy Seer: command center first, best move hero, then tabbed rooms for roster, league, trades, players, rookies, and compare.
- World Cup MatchSeer: match explorer first, selected forecast, knockout path and receipts, completed groups lower.
- Admin: utility-first grid, source cards, sync actions, compact logs.

## Page States

Every major page needs designed states.

- Live data: real schedule/imports are connected and source-truth is explicit.
- Fallback data: demo/seeded/partial data is labeled without making the page feel broken.
- Empty state: never a blank product; show offseason/preseason/demo context and next action.
- Mobile: primary decision first, controls collapsed or stacked, metrics reduced to the strongest few.
- Error: plain message, what failed, what still works, and the next retry action.

## Density Rules

- First screen gets one hero decision, not every metric.
- Repeated cards use smaller type, shorter text, and stable min-height.
- Metric rows should be 2-4 columns on desktop, 1-2 on mobile.
- Status strips should use one quiet background and no more than two accent colors.
- Cards should use 8-16px radius. Avoid nested card-on-card unless it is a framed tool or repeated item.
- Do not use viewport-scaled typography. Use responsive layout and explicit mobile sizes instead.

## Color Rules

Current identity: carbon base, brass primary, powder/live secondary, clay/risk for alerts.

- Carbon owns the page.
- Brass marks the primary action or active state.
- Powder marks live data, comparison, or source health.
- Clay marks risk and blockers.
- Avoid neon green as a dominant fantasy color.
- Team accents support local comparison only; they should not recolor the whole page.

## Implementation Notes

The CSS layer named `MatchSeer Atomic System Pass` is the current practical bridge. Future UI work should prefer those tokens and density rules before adding new one-off styles.
