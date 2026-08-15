# UX architecture: the LOCAL → NATIONAL → POLITICAL escalation

**Status: captured concept + research, not yet implemented.** This
document records a design direction from the campaign owner (developed
with a custom GPT, refined across three messages on 15 Aug 2026) so it
isn't lost before the build gets further ahead. Nothing in `index.html`,
`css/`, or `js/` has changed as a result of this doc — current section
order, lettering (A–F), and behaviour are all untouched. Treat this as the
brief for a future build pass, not a spec already implemented.

**Correction (15 Aug 2026, third message):** an earlier version of this
doc wrongly folded "ask organisations to stop allowing them" into the
NATIONAL stage. That was wrong and has been corrected below —
ORGANISATIONS is its own, separate campaign strand, not a stage in this
escalation.

**Correction (15 Aug 2026, fourth message):** this doc previously left
open where Section E (petition Ray-Ban) sits, floating the idea that it
might merge into NATIONAL. Resolved now: **Ray-Ban is its own separate
action target, not part of NATIONAL, and not merged with it.** Also
explicit: **no new "ask Meta directly" action should be built.** Meta is
judged fundamentally committed to the product, so asking them to stop is
not considered a worthwhile use of a visitor's attention — Ray-Ban (the
brand actually selling the glasses at retail) stays the target, exactly
as Section E already does today. Nothing about Section E's own content
needs to change; what changes is confirming it stays a distinct strand,
not folded into another one.

## The five campaign strands

The campaign has **five** separate asks. Three form a visible escalation
journey; two are additional targets that run alongside it, not through
it.

**The escalation (one continuous journey, encouraged not compulsory):**

1. **LOCAL** — *Ask your nearest seller to stop.*
   Find a verified local seller by postcode and ask that specific branch
   to stop selling them.
2. **NATIONAL** — *Ask major retailers/head offices to stop selling them
   nationwide.*
   Escalate from the local retailer to the people capable of making a
   nationwide stocking decision.
3. **POLITICAL** — *Ask government to regulate.*
   MP / petition / government action.

**Additional action targets (not compulsory stages, not sequenced
relative to the escalation):**

- **RAY-BAN** — *Ask Ray-Ban to stop selling them.* The manufacturer/brand
  target — distinct from NATIONAL (which is about retailers' stocking
  decisions, not the maker) and distinct from a "ask Meta" action (which
  this campaign has explicitly decided not to build).
- **ORGANISATIONS** — *Ask organisations to stop allowing them.* Schools,
  workplaces, venues, sports organisations and other premises adopting
  policies restricting or forbidding wearable recording hardware. **This
  is not a retailer-head-office action** — it's about places banning the
  glasses being *worn on their premises*, not about anyone's stocking
  policy.

Proposed momentum prompts between escalation stages (exact wording from
the campaign owner's brief):
- After the local action: *"You asked your local shop. Now take it to the
  top."*
- After the national action: *"Now ask government to act."*

These prompts belong only to the LOCAL→NATIONAL→POLITICAL thread. RAY-BAN
and ORGANISATIONS don't get a "now do X next" prompt because neither is a
step in that sequence — both are things a visitor can do at any point.

## Where ORGANISATIONS actually stands today

It's **evidence, not yet an action.** The current site already documents
real venue bans — Wetherspoons (800+ pubs), Soho House, Jeremy King's
restaurants, and courts in England and Wales — in the Evidence section
(`index.html` line ~103) and in `meta_rayban_research.md` ("Institutional
and Commercial Prohibition: Venue and Corporate Bans"). But there is
**no action section today** that asks a visitor to do anything about their
own school/workplace/venue — no template, no call to action, nothing
equivalent to Sections B/D/E/F for this strand. Building it is new work,
not a relabelling of something that already exists (that was the mistake
in the earlier version of this doc). Flagged as its own item in "what's
new to build," below.

## The escalation mapped onto today's site

| Stage | Current section(s) | Fit |
|---|---|---|
| **LOCAL** | **A** — postcode finder <br> **B** — email your local optician | Discovery (A) plus the actual ask (B) — see the completion rule below, these aren't the same thing. |
| **NATIONAL** | **F** — ask the retailers who sell them to stop (Currys, Argos, John Lewis, Amazon, EE, O2) | This is already a head-office-level ask, not a specific-branch one — F's own copy already frames it that way ("highest-leverage place to apply pressure"). |
| **POLITICAL** | **C** — sign the petition <br> **D** — write to your MP | Both are asks of government/Parliament. |
| **RAY-BAN** *(additional target, not an escalation stage)* | **E** — petition Ray-Ban directly | Stays exactly as-is — the manufacturer/brand target, kept separate from NATIONAL's retailer-head-office framing. No "ask Meta" action to be built. |

## National targets: who NATIONAL/F should actually name

Cross-checked the priority list you gave (John Lewis, EE, Currys, O2,
Argos, Three) against `data/stockists/RETAILER-MATRIX.md` — all six are
confirmed Ray-Ban Meta sellers. **Update: Three has since been added to
Section F** (campaign owner explicitly confirmed 15 Aug 2026 via
`accessories.three.co.uk/collections/ray-ban-meta` — chain-level evidence
only, not a branch-level finder inclusion, per the usual verification
standard). Amazon is confirmed too but is a different kind of
target (no physical stores, already deliberately excluded from
branch-level results per your earlier decision) — worth deciding whether
it belongs in the same "head office" framing as the other five or needs
its own wording.

Vodafone and InMotion are **not** confirmed sellers (no evidence found
either time they were checked) — don't add them without new evidence.

## Head-office contact-route research (priority list: John Lewis, EE, Currys, O2, Argos, Three)

**The constraint that shaped this:** this session runs behind a network
egress allowlist that blocks fetching arbitrary retailer web pages
directly (confirmed again here against `johnlewis.com`) — web *search*
worked, direct page fetches didn't. So everything below is a search-result
summary, not a page I opened and read myself. **Verify each URL still
resolves and still says what's quoted here before it goes anywhere
public.**

**The finding that matters most, again:** every retailer's
officially-published "press office" contact is for journalists only, not
the public (Currys' own page says its press address is "strictly for use
by members of the media... not for customer use"). Recommending each
retailer's own official public complaints/contact page instead — not a
press or named-individual email.

**Excluded on principle, per "do not invent email addresses":** anything
that only surfaced via an unofficial complaint-aggregator site
(resolver.co.uk, complaintinfo.com, pissedconsumer.com and similar), a
"standard email format" guess, or a named staff member's personal address
scraped from a press directory. None of those appear below — where a
retailer only turned up contacts like that, it's flagged as unresolved.

| Retailer | Recommended public route | Confidence | Source |
|---|---|---|---|
| **John Lewis** | [johnlewis.com/customer-services/escalated-complaints](https://www.johnlewis.com/customer-services/escalated-complaints) — explicitly the *escalated* tier, a strong match for "head office, not ordinary customer service." Phone: 0345 604 9049 | High — official domain, consumer-facing | [Escalated Complaints \| John Lewis & Partners](https://www.johnlewis.com/customer-services/escalated-complaints) |
| **EE** | [ee.co.uk/help/contact-ee/complaint](https://ee.co.uk/help/contact-ee/complaint) — official consumer complaints page (not the business or regulatory-only page found in the first pass). Phone: 0800 956 6000 | High — official domain, consumer-facing | [Make a Complaint \| EE](https://ee.co.uk/help/contact-ee/complaint) |
| **Currys** | [currys.co.uk/complaints.html](https://www.currys.co.uk/complaints.html) — official complaints/escalation page. Phone: 0344 561 1234 | High — official domain, consumer-facing | [Complaints \| Currys](https://www.currys.co.uk/complaints.html) |
| **O2** | [o2.co.uk/how-to-complain](https://www.o2.co.uk/how-to-complain) | High — official domain, consumer-facing | [How to Complain \| Help \| O2](https://www.o2.co.uk/how-to-complain) |
| **Argos** | [help.argos.co.uk/help/contact-us](https://help.argos.co.uk/help/contact-us) — Argos-branded page (better fit than the Sainsbury's-parent corporate page found in the first pass). Phone: 0345 640 0800 | High — official domain, consumer-facing | [Contact us \| Argos Help](https://help.argos.co.uk/help/contact-us) |
| **Three** | [three.co.uk/support/complaints/how-to-complain](https://www.three.co.uk/support/complaints/how-to-complain) | High — official domain, consumer-facing | [How to complain \| Support \| Three](https://www.three.co.uk/support/complaints/how-to-complain) |
| **Amazon UK** *(not on the priority list — carried over from the first pass)* | Not resolved — no official public complaints/escalation page surfaced | Low / unresolved | — |

All six priority retailers now have a **High-confidence, official,
consumer-facing** route — an improvement on the first pass, where EE and
Argos only had weaker (regulatory-only / parent-company) results. Amazon
remains unresolved but wasn't on this round's priority list.

**Before this goes into a live template:** (1) open each URL to confirm it
still resolves and still describes the same route — these were found via
search snippets, not a page I could load myself; (2) decide whether
pointing a policy ask at a "complaints" page (built for individual
purchase disputes) is the right framing, or whether the message itself
needs to acknowledge that mismatch (e.g. "this isn't a faulty-goods
complaint, but there's no better public channel — please pass this to
whoever sets stocking policy").

## Your three open-question answers, incorporated

1. **Stage completion is not a gate.** No wizard, no locking NATIONAL
   until LOCAL is "done." The escalation is a suggested path shown to
   everyone, not an unlock sequence.
2. **LOCAL completes on the ask, not the search.** Finding results (A) is
   discovery. The LOCAL stage only counts as done when the visitor
   actually proceeds to contact/ask the branch (B, or the finder's own
   per-branch message flow — see the open question below on how those two
   relate). This matters for whatever "stage complete" state gets built —
   it should key off the send/copy/mailto action, not off search results
   rendering.
3. **Not optimising around A–F.** The proposed IA below doesn't reuse the
   current letters — it's a fresh structure; if it's approved, implementation
   labels (letters, numbers, whatever) can follow from it rather than
   the other way round.

## Proposed information architecture (new, not tied to A–F)

A page built around this would read as:

1. **Hero + postcode finder** — the primary entry point, not literally
   "step 1 of 3" (it's the thing everyone sees first, escalation or not).
2. **The escalation** (LOCAL → NATIONAL → POLITICAL), presented as one
   visible three-part journey, with the momentum prompts between parts.
3. **Ray-Ban** — a separate section for the manufacturer target, visually
   distinct from the escalation, not sequenced relative to it. This is
   Section E's existing content, unchanged.
4. **Organisations** — a separate section, visually distinct from the
   escalation, not sequenced relative to it. Needs new content built (see
   above) — currently only evidence exists, no action.
5. Impact panel / evidence / share, as today — not really "stages," stay
   where they are.

This is a shape, not a layout — spacing, visual treatment, and exact
component boundaries are implementation decisions for whenever this gets
built, not decided here.

## Remaining open questions (deliberately unresolved here)

- ~~Where Section E (Ray-Ban) sits~~ — resolved, 15 Aug 2026: its own
  separate action target, not part of NATIONAL.
- **Per-visitor progress needs new state.** The impact panel counts are
  aggregate and anonymous (`js/stats.js`), not tied to a visitor session.
  "You've completed the local stage" needs new client-side state (e.g.
  `localStorage` flags) — worth deciding if that's in scope for a first
  pass.
- **How the finder's own per-branch message flow (`js/finder.js`) relates
  to Section B's generic optician email template** — check whether B
  becomes redundant once someone's used the finder, or serves people who
  couldn't find a verified branch nearby.
- ~~Should F's retailer list get Three added now~~ — done, 15 Aug 2026.
- **Whether Amazon needs different wording** in the national ask, given
  it's a different kind of target (no physical stores, no resolved
  contact route yet).

## Source

Concept developed by the campaign owner using a custom GPT, shared and
refined across four messages on 15 Aug 2026, including two corrections:
where "ask organisations to stop allowing them" belongs, and where
Ray-Ban sits relative to NATIONAL (plus an explicit decision not to build
a separate "ask Meta" action). Captured here verbatim in intent, lightly
reformatted for this repo.
