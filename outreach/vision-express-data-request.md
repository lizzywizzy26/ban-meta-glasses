# Requesting Vision Express's official "selected stores" list

## Why

Vision Express's own Ray-Ban Meta page says the glasses are available "in
**selected** Vision Express stores," but their public store locator (as
used on that page) lists all 440 UK branches with no way to tell which are
actually the selected ones. The campaign's finder tool only shows a shop as
a verified Ray-Ban Meta seller when there's real evidence tied to that
specific branch — so right now, none of Vision Express's 440 stores can be
shown, even though the company clearly does sell the product somewhere.
Asking them directly for the real list is the fastest way to fix that,
faster than trying to reverse-engineer it from public pages.

## Where to send it

- **Primary: press/media inbox** — `PR@visionexpress.com` (their official
  press office channel, appropriate for a "can you confirm/share this for
  a piece of public-interest work" request — not a named individual's
  inbox)
- **Backup:** their general contact form at
  https://www.visionexpress.com/contact-us if the press inbox doesn't
  respond

## Draft message

```
Subject: Which stores carry Ray-Ban Meta? (building an accurate UK store finder)

Hello,

I'm building a small, independent tool that helps people find UK opticians
that stock Ray-Ban Meta smart glasses (the ones with a built-in camera),
so they can go and ask questions about them in person.

Your Ray-Ban Meta page says the glasses are available in "selected Vision
Express stores," but your public store locator doesn't distinguish which
of your ~440 UK branches are the selected ones. I don't want to guess or
imply that every Vision Express store carries them if that isn't accurate.

Could you share the official list of stores that currently stock/demo
Ray-Ban Meta? Happy to credit Vision Express as the source, and to update
the list whenever you tell me it's changed.

Thank you,
Liz Hunter
[project URL — add once the custom domain is live, or use
https://github.com/lizzywizzy26/ban-meta-glasses in the meantime]
```

## If they don't respond

No response, or a "we can't share that" response, isn't a dead end — it
just means Vision Express stays at `authorised_chain` in the dataset
(company confirmed to sell it, no branch-level list) until a different
signal turns up (an individual branch page, a demo-booking flow, or a
future refresh of their public site that does distinguish branches). See
`../scripts/ingest/README.md` for the other in-progress leads.
