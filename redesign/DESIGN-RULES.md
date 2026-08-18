# Design rules — homepage prototype

Standing rules to check against on every future change to `index.html`, not just a one-time pass.

## No widows

A widow is a single word left alone on the final line of a text block (headline, subheadline, campaign statement, card title, or short body copy).

When one occurs:

1. First try a better line break or a slightly wider text measure, without changing the overall layout.
2. If that doesn't solve it, make a very small reduction in font size or letter-spacing until the final line holds two or more words.
3. Do not make substantial changes to container widths, grid dimensions, or page architecture just to fix a widow.
4. Do not insert manual line breaks that create worse wrapping at other responsive widths — a fix at one breakpoint must not create a widow at another.
5. Check independently at desktop, tablet, and mobile widths.

For large display headlines and campaign statements this is a strict rule: never leave one word alone on the final line.

For longer body copy, use judgement rather than shrinking text excessively — readability takes priority over eliminating every widow.

Verify by visually inspecting the rendered page at each breakpoint, not just by reading the CSS. If a widow can't be eliminated without damaging readability or layout, flag it to Liz rather than making a disproportionate design change.
