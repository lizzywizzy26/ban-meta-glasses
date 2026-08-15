# UX architecture: the LOCAL → NATIONAL → POLITICAL escalation

**Status: captured concept + research, not yet implemented.** This
document records a design direction from the campaign owner (developed
with a custom GPT, refined 15 Aug 2026) so it isn't lost before the build
gets further ahead, plus the national-escalation-contact research the
second message asked for. Nothing in `index.html`, `css/`, or `js/` has
changed as a result of this doc — current section order, lettering (A–F),
and behaviour are all untouched. Treat this as the brief for a future
build pass, not a spec already implemented.

## The core idea

The campaign's six actions can feel like an unordered list of things to
maybe do. The proposed fix: organise them as a visible three-stage
escalation, each stage a natural consequence of the last.

1. **LOCAL** — *Ask your nearest seller to stop.*
   Enter your postcode → see verified sellers nearby → send a personalised
   message to that branch.
2. **NATIONAL** — *Ask their head office to stop.*
   An individual branch may not control stocking policy — take the same
   demand to the organisation that can make a chain-wide decision.
3. **POLITICAL** — *Ask government to regulate.*
   Contact your MP → support the petition → demand regulation.

This maps directly onto language already used elsewhere in the campaign:
*"Ask retailers to stop selling them. Ask organisations to stop allowing
them. Ask government to regulate them."* The postcode finder stays the
hero of the page and the primary action — *enter your postcode, find who
sells them near you, ask them to stop* — with national and political
action unfolding naturally from it, not diluting it or requiring a visitor
to understand the whole campaign up front.

Proposed momentum prompts between stages (exact wording from the 15 Aug
brief):
- After the local action: *"You asked your local shop. Now take it to the
  top."*
- After the national action: *"Now ask government to act."*

## Where "ask organisations to stop allowing them" belongs

Direct answer to the open question: **it doesn't get replaced — it *is*
the NATIONAL stage.** Nothing about Section E (petition Ray-Ban) or
Section F (ask the retailers) needs to change in substance. What changes
is presentation and sequencing:

| Stage | Current section(s) | Why it fits |
|---|---|---|
| **1. LOCAL** | **A** — postcode finder <br> **B** — email your local optician | Both act on *this specific verified branch*, found by postcode. |
| **2. NATIONAL** | **E** — petition Ray-Ban directly (the manufacturer) <br> **F** — ask the retailers who sell them to stop (the sellers) | Both are asks of an *organisation*, not a single shop — "stop making/allowing this nationwide," not "stop stocking this in one branch." Ray-Ban (makes them) and the retailers (sell them) are the two organisational targets the existing campaign language already names. |
| **3. POLITICAL** | **C** — sign the petition <br> **D** — write to your MP | Both are asks of government/Parliament. |

So E+F together *are* the "ask organisations to stop allowing them"
strand — the national stage doesn't add a new ask, it gives the existing
one a clearer place in the journey and (per the research below) sharper,
more legitimate targets to aim F at.

## National targets: who F should actually name

Section F's current placeholder text names Currys, Argos, John Lewis,
Amazon, EE, O2. Cross-checked against `data/stockists/RETAILER-MATRIX.md`
(the retailer research already done for the stockist finder), all of
those are confirmed Ray-Ban Meta sellers — plus one that's missing from
F's current copy:

- **Currys** — confirmed, multiple product listings (Gen 1 + Gen 2)
- **Argos** — confirmed, multiple product listings
- **John Lewis** — confirmed, 29 models listed, "check in-store stock" +
  "selected shops" Click & Collect language
- **EE** — confirmed, dedicated Ray-Ban Meta page, sells with EE ID
- **O2** — confirmed, dedicated shop pages, Pay Monthly option
- **Amazon UK** — confirmed (per the campaign owner's earlier explicit
  decision to treat it as a national target, not a branch-level result)
- **Three** — confirmed via `accessories.three.co.uk/collections/ray-ban-meta`
  (established during Ray-Ban/Sunglass Hut research on 14–15 Aug) — **not
  currently named in Section F's copy**, worth adding

Vodafone and InMotion are explicitly *not* confirmed sellers (no evidence
found either time they were checked) — they shouldn't be added as national
targets without new evidence.

## National escalation contact research

**The constraint that shaped this:** this session runs behind a network
egress allowlist that blocks fetching arbitrary retailer web pages
directly (same restriction documented in `scripts/ingest/README.md` for
the stockist data — confirmed again here against `johnlewis.com` directly).
Web *search* worked, direct page fetches didn't. That matters for how much
to trust what follows: everything below is a search-result summary, not a
page I could open and read myself, so **verify the specific URL still
resolves and still says what's quoted here before it goes anywhere
public.**

**The bigger finding, more important than any single contact: for every
retailer searched, the officially-published "press office" contact is
explicitly for journalists, not the public** (e.g. Currys' own page says
its `CorporatePR@currys.co.uk` address is "strictly for use by members of
the media... not for customer use"). Using a press inbox for a mass
consumer campaign risks being ignored or, worse, read as spam by the one
team whose job is press relations — not what a credibility-conscious
campaign wants. **So the recommended "route" per retailer below is each
company's own official public complaints/contact-escalation page, not a
press or named-individual email** — those pages exist precisely to receive
structured public correspondence, even if a stocking-policy ask isn't the
faulty-goods complaint they're mainly built for.

**Also excluded on principle, per "do not invent email addresses":** any
address that only appeared via an unofficial complaint-aggregator site
(resolver.co.uk, complaintinfo.com, pissedconsumer.com, and similar), a
"standard email format" guess from a sales-intelligence tool, or a named
individual staff member's personal address scraped from a press directory
(that's both an accuracy risk — people change roles — and not really a
"head office route," it's one person's inbox). None of those are used
below; where a retailer only turned up contacts like that, it's flagged as
unresolved rather than filled in with something unverifiable.

| Retailer | Recommended public route | Confidence | Source |
|---|---|---|---|
| **Currys** | [currys.co.uk/complaints.html](https://www.currys.co.uk/complaints.html) — official complaints/escalation page. Phone: 0344 561 1234 | High — official domain | [Complaints \| Currys](https://www.currys.co.uk/complaints.html) |
| **John Lewis** | [johnlewis.com/customer-services/escalated-complaints](https://www.johnlewis.com/customer-services/escalated-complaints) — explicitly the *escalated* tier, a strong match for "head office, not ordinary customer service" | High — official domain | [Escalated Complaints \| John Lewis & Partners](https://www.johnlewis.com/customer-services/escalated-complaints) |
| **O2** | [o2.co.uk/how-to-complain](https://www.o2.co.uk/how-to-complain) | High — official domain | [How to Complain \| Help \| O2](https://www.o2.co.uk/how-to-complain) |
| **Three** | [three.co.uk/support/complaints/how-to-complain](https://www.three.co.uk/support/complaints/how-to-complain) | High — official domain | [How to complain \| Support \| Three](https://www.three.co.uk/support/complaints/how-to-complain) |
| **Argos** | [corporate.sainsburys.co.uk/contact-us](https://corporate.sainsburys.co.uk/contact-us/) — Argos is a Sainsbury's subsidiary; this is the parent company's official contact page | Medium — official domain, but couldn't confirm it's the best-fit page for a non-Sainsbury's-branded query (vs. an argos.co.uk-specific page, which didn't surface) | [Contact us \| J Sainsbury plc](https://corporate.sainsburys.co.uk/contact-us/) |
| **EE** | [ee.co.uk/help/help-new/safety-and-security/protecting-your-information/complaints-code-of-practice](https://ee.co.uk/help/help-new/safety-and-security/protecting-your-information/complaints-code-of-practice) — official complaints process page, but it's the regulatory code-of-practice page, not a friendly "contact us" form | Medium — official domain, but a cleaner consumer-facing complaints page may exist and wasn't found | EE Complaints Code of Practice (ee.co.uk) |
| **Amazon UK** | Not resolved — no single official public complaints/escalation page surfaced (multiple sources note Amazon UK doesn't publish one the way the others do). Only press-only (`press.aboutamazon.com/uk/contact-us`) and unverified third-party-sourced emails came up | Low / unresolved | — |

**Recommendation:** treat this table as a first pass, not final copy. Before
anything goes into a live template: (1) open each "High confidence" URL to
confirm it still resolves and still describes the same route, (2) do a
fresh, more targeted search specifically for EE's and Amazon's
consumer-facing (not regulatory/press) contact routes, (3) decide whether
pointing a policy ask at a "complaints" page (built for individual
purchase disputes) is the right framing, or whether a differently-worded
message is needed to make sense arriving there.

## Proposed escalation mechanics (not yet built)

- Three numbered stages (1/2/3, or LOCAL/NATIONAL/POLITICAL) visible in the
  page's structure, replacing or overlaying the current A–F lettering.
- Progress shown as stages are completed — visually distinct from the
  existing per-action inline counters (those count *aggregate* interactions
  site-wide; this needs a *per-visitor* sense of "you've done stage 1,"
  which is new state the current site doesn't track anywhere).
- The two momentum prompts quoted above, shown after the relevant stage's
  action is taken.

## Open questions for whoever builds this (deliberately unresolved here)

- **Per-visitor progress needs new state.** The impact panel counts are
  aggregate and anonymous (see `js/stats.js`), not tied to a visitor
  session. Showing "you've completed stage 1" needs some client-side state
  (e.g. `localStorage` flags set when B, E/F, or C/D actions are taken) —
  worth deciding whether that's in scope for a first pass or a follow-up.
- **Does A+B truly need to happen together for "stage 1" to count?** The
  postcode finder (A) can be used without ever sending a message (B) —
  worth deciding what "local stage complete" actually requires.
- **Do E and F both need to happen for "stage 2" to count**, or does
  either one (Ray-Ban or a retailer) complete the national stage?
- **Relettering vs. renumbering vs. leaving letters alone and just adding
  a visual stage grouping around them** — the mapping above works with
  either; this doc doesn't take a position on the actual page mechanics.
- **Where the finder's "send a personalised message to the branch" flow
  (built in `js/finder.js`) fits relative to Action B** — the finder
  already produces a per-branch contact flow; check whether B (the
  generic optician email template) becomes redundant once someone's used
  the finder, or serves people who couldn't find a verified branch nearby.
- **Should Section F's retailer list be updated to add Three (confirmed
  seller, not currently named) before or independent of the escalation
  redesign** — this is a small, low-risk copy fix that doesn't depend on
  the bigger UX work.

## Source

Concept developed by the campaign owner using a custom GPT, shared and
refined in two messages on 15 Aug 2026. Captured here verbatim in intent,
lightly reformatted for this repo. National contact research added in
response to the second message's explicit ask.
