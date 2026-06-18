# MatchSeer — header fix (phased, code-grounded prompt)

Paste this into the coding tool. Do the phases **one at a time**. After each phase: run the dev server, eyeball it, and confirm before moving to the next. Work on a branch — do not deploy/merge until I say so.

## Context (already verified in the repo)

- The header markup is in `app/page.tsx` and appears in **two places** that must stay consistent:
  - the empty/no-fixtures state (around line ~671) — has brand lockup + language switcher, **no nav**.
  - the main view (around line ~745) — has brand lockup + `.main-nav` + language switcher.
- The header is styled by CSS classes in `app/globals.css` (~6,900 lines). `.topbar`, `.brand-lockup`, `.main-nav`, `.language-switcher` are defined and overridden in **several places** (around lines 54, 954, 1924, 2568, plus media queries near 898, 1776, 2425, 3137, 3225, 3460). Any change must be reconciled across all of them and re-checked at mobile widths.
- The tagline is `<h1>{t.subtitle}</h1>` inside `.brand-lockup`. The brand name is `<p className="eyebrow">MatchSeer</p>`.
- Nav links and their anchors (keep these exactly): How it works → `#seer-lenses`, Forecasts → `#forecast-board`, Ask the Seer → `#ask-seer`, Cup Seer → `#cup-seer`. Labels come from `t.navHow`, `t.navForecasts`, `t.navSeer`, `t.navCup`.
- i18n lives in the `t` object with `en`/`es`/`fr` variants. If you add any new copy, add the key to **all three** languages.

## DO NOT TOUCH (must keep working exactly as now)

- The match board / `.hero-grid` / `.hero-matchroom` section (this is the match explorer — NOT the header; do not reuse the `.hero-grid` class name for the new tagline hero).
- The Seer command-center ~60% column ratio, the selected match card's gold border, the group filter chip row + its horizontal scroll, the model receipts and verdict text.
- The Oracle/Seer panel's own "Ask the Seer" button — leave it untouched.
- Language switching: the `setLanguage` handlers, the `.language-switcher`, and all `t` strings/logic.
- All existing nav anchor destinations.

---

## Phase 1 — safety baseline
Create a new branch. Run the production build and confirm it's green before changing anything. No code changes this phase.

**Stop. Confirm build passes.**

---

## Phase 2 — promote nav "Ask the Seer" to a button
In the main `.topbar` nav, make the `Ask the Seer` link (`#ask-seer`) read as a button, leaving its `href` and the other three links unchanged.

**IMPORTANT — do not change any button colours/gradients.** Reuse the EXISTING "Ask the Seer" gradient button style already used in the Seer/Oracle panel, verbatim — same gradient, same colours. The user likes the current gradient; do not recolour it or any other button anywhere. Just apply that existing button style to the nav link (e.g. add a dedicated class like `.main-nav .nav-cta` that reuses the existing button's rules) rather than overriding all `.main-nav a`.

**Acceptance:** nav Ask the Seer reads as a button using the existing gradient (unchanged colours), other links unchanged, clicking still jumps to the Ask the Seer section. **Stop and verify.**

---

## Phase 3 — shrink the tagline (CONSERVATIVE — no new hero)
Decision: conservative route. Do NOT build a tall hero section, do NOT add an orb, and do NOT push the match list down. The Seer panel stays the visual star and the match list stays exactly where it is and fully visible.

1. In **both** topbar blocks, keep the brand mark and make the brand name (`MatchSeer`) the wordmark.
2. Demote the big `<h1>{t.subtitle}</h1>` to a small, understated tagline line that sits quietly in/near the nav (similar weight to a sub-label) — it should stop dominating the top-left and stop crowding the nav. Keep the words; just shrink it.
3. Preserve heading semantics: keep exactly one `<h1>` on the page. If the visible tagline becomes small, make sure the page still has a single sensible `<h1>` (e.g. keep it as the `<h1>` but styled small, or move the `<h1>` role to the Seer/Match-explorer section heading — whichever keeps one clean `<h1>`).
4. Do not add new layout sections. No `.intro-hero`, no orb placeholder.

**Acceptance:** clean compact nav row, tagline no longer oversized, match list and Seer panel unchanged and in the same positions, empty-state view still fine. **Stop and verify.**

---

## Phase 4 — sticky slim nav
Make the `.topbar` stick to the top and shrink slightly on scroll. Reconcile with the existing `.topbar` rules and media queries so nothing shifts on mobile.

**Acceptance:** nav pins on scroll, no layout jump, content below isn't hidden behind it. **Stop and verify.**

---

## Phase 5 — mobile nav
At narrow widths, collapse `.main-nav` links into a hamburger menu. Keep the brand mark/wordmark and the Ask the Seer button visible; keep the language switcher reachable. Add minimal state for the menu toggle.

**Acceptance (≈390px):** hamburger opens/closes, nothing overflows, language toggle works, all four previously-fixed items unchanged. **Stop and verify.**

---

## Phase 6 — POSTPONED (do not build now)
The full hero section, the crystal-ball orb, and any larger page simplification are deliberately on hold. Conservative direction for now: keep the current page architecture (Seer primary, match list secondary but fully visible). Revisit only if explicitly asked.

---

## Final check before merge
- Desktop, scroll, and mobile (~390px) all behave per the acceptance notes.
- The four previously-fixed items + Oracle panel are visually and functionally unchanged.
- Language toggle still switches EN/ES/FR.
- Production build is green.
