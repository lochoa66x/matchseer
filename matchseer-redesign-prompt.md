# MatchSeer Redesign — Implementation Brief

Use this prompt to pick up the redesign work in any future session.

---

## Context

You are helping Luis Ochoa Morales (Voynich Tech) improve **matchseer.com** — a World Cup football forecasting site built for entertainment, not betting. The stack is Next.js 14 (TypeScript), deployed on Vercel, with a Neon (PostgreSQL) database and OpenAI for the Seer forecast readouts.

GitHub repo: `lochoa66x/matchseer` (public)

Key files:
- `app/page.tsx` — 2,663 lines, single `"use client"` component. Everything lives here.
- `app/globals.css` — 3,596 lines, full custom CSS with design tokens.

The GitHub integration is **read-only** — you cannot create branches via MCP. Luis must run this in his terminal to create the working branch before you start:
```
git checkout -b redesign && git push -u origin redesign
```

---

## Design tokens already in globals.css

```css
--gold: #F5C518
--paper: #07090F
--panel: #0F1525
--surface: #111d35
--ink: #dfe7f7
--muted: #8fa2c4
--green: #10a36f
--chaos-orange: #FF6B35
--blue: #2563eb
--red: #ef4444
--line: rgba(30, 46, 82, 0.5)
--night: #0c111f
```

---

## What NOT to touch

- Group filter chips (A–H + All) and all match navigation — keep everything intact
- All match card data (scores, probabilities, team names, flags)
- i18n copy (EN/ES/FR via the `copy` object in page.tsx)
- Database connections, API calls, or OpenAI integration
- **Seer Scoreboard receipt cards** — the playful, Seer-voiced verdict text on each result card is the product's personality. Preserve it exactly. If anything, make the text slightly more readable (bump line-height slightly), but do not remove or shorten it.

---

## The 5 changes to make (in priority order)

### 1. Fix the hero column ratio (globals.css)

This is the biggest visual change. The Seer currently gets only ~28% of the hero width. We want it to be the dominant element.

Find:
```css
.hero-grid {
  grid-template-columns: minmax(0, 1.45fr) minmax(280px, 0.55fr);
```

Change to:
```css
.hero-grid {
  grid-template-columns: minmax(0, 0.8fr) minmax(320px, 1fr);
```

Effect: Match explorer stays usable on the left; Seer panel becomes the dominant right column.

---

### 2. Remove the duplicate "Ask the Seer" CTA (page.tsx)

There are two "Ask the Seer" buttons:
- One inside the **Seer Command Center** (the hero panel on the right) — **KEEP THIS ONE**
- One buried inside the **Oracle Signal** section under Supporting Details / the content-grid tab area — **REMOVE THIS ONE**

Search for the second instance and delete just that button (and any wrapper div that exists solely to contain it). The Seer should have exactly one home.

---

### 3. Shrink the H1 tagline (page.tsx + globals.css)

The `<h1>` with the tagline "Real stats, playful readouts, zero betting energy." is too dominant — it pushes all the actual content down the page before users see anything useful.

- Demote it from `<h1>` to a `<p>` or `<span>`
- Move it inline with or directly below the MatchSeer logo mark in the topbar
- Style it as a small eyebrow: ~11px, color `var(--muted)`, no bold

The brand name "MatchSeer" stays prominent. Only the tagline sentence shrinks.

---

### 4. Fix the group chip overflow (globals.css)

The Group A–H filter chips overflow horizontally off-screen on many viewports. Find the container that holds them and add:

```css
flex-wrap: wrap;
overflow-x: visible;
```

(Exact class name will depend on what you find in the CSS — search for the group filter chip container.)

---

### 5. Gold border on selected match card (globals.css)

When a match is selected/active in the match explorer, its card should get the gold border treatment to visually connect it to the Seer panel (which has a subtle gold border accent).

Find the active/selected state class for match cards and add:
```css
border-color: var(--gold);
border-width: 1.5px;
```

---

## Workflow

1. Confirm Luis has created the `redesign` branch and connected his local folder via Cowork
2. Make each change as a separate commit with a clear message
3. Push — Vercel will auto-generate a preview URL
4. Luis checks the preview before anything merges to `main`
5. Start with change #1 (column ratio) — it's the biggest visual win and lowest risk

---

## What the redesign looks like

- Match explorer (left, ~40%): full group/status filters, all match cards, same data as today
- Seer Command Centre (right, ~60%): large team names, live score, one big gold "Ask the Seer" button, probability bar, mini stats
- Seer Scoreboard (below, full width): metric cards + receipt cards with the full Seer-voiced verdict text preserved
- Topbar: compact logo + small eyebrow tagline + nav + language switcher

The goal is to make the Seer feel like the product's star — not an afterthought squeezed into 28% of the screen.
