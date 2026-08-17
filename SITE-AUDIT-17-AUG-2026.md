# Current site → required change audit (17 Aug 2026)

Diagnosis only — nothing implemented from this. Produced by reading the
live committed source (`index.html`, `css/style.css`, `js/finder.js`,
`js/main.js`) and rendering it locally (GitHub Pages itself wasn't
reachable from this environment, but it serves this exact committed
source with no build step, so a local render is equivalent) at both
desktop (1400px) and mobile (390px) widths.

## 1. Obsolete messaging

The entire page is currently built around **one specific BBC covert-
filming investigation**, not the locked campaign framing:

- `<title>`: "Stop the Sale — Smart Glasses Campaign"
- H1: "They shouldn't be able to film you without asking."
- Hero paragraph, `og:title`/`og:description`/Twitter meta tags, and the
  "What's actually been documented" evidence card are all specific to the
  BBC's covert-filming reporting (the "Alice" case, 50 women, 3bn+ views).

None of this contradicts the locked principles, but none of it expresses
them either — "Meta is the ringleader," "the problem is bigger than
Meta," "stop this before it becomes normal," and the industry-wide
smart-eyewear framing don't appear anywhere. The BBC evidence is real and
worth keeping as *supporting* evidence, but it currently **is** the
framing rather than *supporting* it.

## 2. Old email copy

Every email on the live site predates the four locked templates:

- **Section B (local optician)**, **Section D (MP)**, **Section E
  (Ray-Ban)**, **Section F (national retailers)**, and
  **`js/finder.js`'s dynamic per-branch message** (`buildMessageTemplate`)
  all contain different, older copy — none match Email 1–4.
- **There is no venues/leisure-centre section at all.** Email 1's
  audience (the ORGANISATIONS strand — see `UX-ARCHITECTURE.md`) isn't
  represented on the current site in any form.
- Per your standing instruction, none of this is being rewritten now —
  flagged only as: these five surfaces all need the swap-in once
  implementation starts, sourced from `outreach/EMAIL-TEMPLATES.md`
  (verbatim), not reconstructed from what's currently live.

## 3. Weak / duplicated CTAs

- **The "Visit branch page" bug is real and already live**: in
  `finder.js`'s `renderMessagePanel()`, when a selected branch's
  `contact.type` is `branch_page` (true for effectively every real record
  in the database right now — Vision Express, David Clulow, Ray-Ban, John
  Lewis all use this contact type), the secondary button reads **"Visit
  branch page ↗"** and is the *only* action offered alongside "Copy
  message." This is precisely the conversion problem you flagged.
- **Two different `mailto:` builders exist and behave differently**:
  `js/main.js`'s `mailtoFromTemplate()` (used by the optician/Ray-Ban/
  retailer sections) builds `mailto:?subject=...&body=...` — **no
  recipient, ever**, even though a recipient parameter clearly belongs
  there. `js/finder.js`'s separate `mailtoUrl(text, recipient)` *does*
  support a recipient, but it's only reachable when `contact.type ===
  'email'`, which no real record currently has. Net effect: **right now,
  zero "Open in email app" buttons on the live site pre-fill a
  recipient**, anywhere on the site.
- **Section D (MP) is missing the "Open in email app" button** that
  every other email section has (Copy only) — a small, pre-existing
  inconsistency, unrelated to the redesign but worth fixing in the same
  pass.

## 4. Unnecessary steps

- **"Visit branch page" as the de facto primary contact action** (see
  above) — a branch's own page is evidence, not a way to send pressure.
- **Section B (static "Email your local optician") and the finder's own
  dynamic per-branch message panel are two separate, overlapping ways to
  contact a local optician** — one asks the visitor to type in a shop
  name manually with no verification behind it; the other is driven by a
  real verified branch the visitor just searched for. Once the finder
  becomes the primary local-optician path (per your locked UX decision),
  Section B's manual-entry version is likely redundant rather than a
  second complementary option — worth an explicit decision, not an
  assumption, when the IA is agreed.

## 5. Confusing information hierarchy

- The page is **very long**: 6,584px tall at desktop width, 7,873px at
  mobile width, largely because every email template is shown as a full,
  expanded, editable `<textarea>` inline in the page rather than behind
  a preview/expand step. A visitor scrolling through in order passes six
  full email drafts before reaching the bottom.
- The current **A–F lettered step structure doesn't map onto the
  five-strand model** already agreed in `UX-ARCHITECTURE.md`
  (LOCAL/NATIONAL/POLITICAL escalation + RAY-BAN + ORGANISATIONS as
  parallel targets). Right now it reads as six flat, equally-weighted
  steps with no visible escalation logic or indication that some actions
  matter more than others — the "You asked your local shop. Now take it
  to the top." momentum prompts documented in `UX-ARCHITECTURE.md` don't
  exist on the page at all yet.
- **The RAY-BAN strand's status is genuinely ambiguous** right now: it's
  one of the five strands in `UX-ARCHITECTURE.md`, but no locked email
  template was supplied for it among the four you gave me (venues/
  opticians/national retailers/MPs). Is Ray-Ban being retired as a
  separate action, kept with its current (old) copy for now, or does
  locked copy for it exist elsewhere? This needs your call, not an
  assumption — see the decisions list below.

## 6. A–F architecture vs. campaign strategy conflicts

| Current section | Locked strand it should become | Gap |
|---|---|---|
| A — Finder | LOCAL (opticians) | Message panel needs the new mailto architecture + Email 2 copy; branch name insertion logic already exists and is reusable |
| B — Static optician email | (folds into LOCAL via the finder, pending your decision above) | Old copy; manual/unverified shop name entry sits oddly alongside a verified finder |
| C — Petition | POLITICAL (petition half) | No copy issue — stays as-is |
| D — MP | POLITICAL (MP half) | Old copy; missing "Open in email app"; Email 4 needs a `{postcode}` value with nowhere on the page currently collecting one for this section |
| E — Ray-Ban | RAY-BAN | Old copy; strand's future status ambiguous (see above) |
| F — National retailers | NATIONAL | Old copy; needs per-retailer mailto once real chain-level contact routes are wired in, same pattern as the finder |
| *(none)* | ORGANISATIONS (venues) | Doesn't exist yet — new section needed for Email 1 |

## 7. Mobile/desktop UX concerns visible now

- No broken layout at 390px — cards, forms, and buttons stack cleanly,
  nothing overflows horizontally (confirmed via a real rendered
  screenshot, not assumed).
- The page-length problem (section 5) is worse on mobile in practice —
  7,873px of scroll, much of it large `<textarea>` blocks, before reaching
  later sections like the petition or MP action.
- Button rows (`.btn-row`) wrap acceptably at narrow widths already —
  this pattern doesn't need rework, just more content flowing through it.

## 8. Reusable design-system components

The visual language is clean, consistent, and token-based — most of it
should carry forward as-is:

- CSS custom properties already centralise the palette (`--ink`,
  `--paper`, `--panel`, `--signal`, `--signal-soft`, `--line`, `--muted`)
  — a redesign can restyle globally by changing these, not hunting
  through the file.
- Reusable component classes already exist and work well: `.card`,
  `.step-label`/`.step-letter` (the lettered-step visual pattern itself
  is fine as a *visual* device even if the letters get reordered/
  reframed), `.btn-row`/`.link-btn`/`.secondary`, `.copied-msg`,
  `.inline-stat`, `.source-note`, `.finder-card`/`.finder-results`/
  `.stockist-card`, `.verified-badge`.
- The counters/impact-panel wiring (`js/stats.js`, `#impactPanel`) is
  independent of any of this and doesn't need to change.

## 9. Components/sections likely to be replaced rather than patched

- The five static email `<textarea>` blocks (B, D, E, F, plus the
  finder's dynamic message builder) — copy and mailto logic both need
  replacing, not editing in place.
- The A–F lettered section framing — likely needs reorganising around
  the five-strand model rather than patched incrementally, per the IA
  discussion still to come.
- A new ORGANISATIONS/venues section needs building from scratch — no
  existing section to adapt.

No copy has been rewritten. No components have been changed. This is the
diagnosis you asked for before the IA/messaging discussion.
