# Homepage design pass — 2026-11-02

Owner: "I like this Smelloff design but I need to improve it … use these 5
skills … you can remove or edit the homepage sections … deeply research what
works, what not … if you get any other skills from GitHub, take them too."

The Sep 19 look stays (Fraunces / Inter Tight / JetBrains Mono, lime on black,
"Your shirt smells. Fix it.", the "Your shirt remembers" scrubber). This pass
changes structure, copy, legibility and motion inside it.

## The skills, and how each was used
| Skill | Source | Used for |
|---|---|---|
| Taste skill v2.1.5 | github.com/Leonxlnx/taste-skill (MIT) | `inspect.mjs` in Chromium at 1280 and 390, before and after; its rules on headline length, labels, small text, pictures |
| Web design guidelines (Vercel) | github.com/vercel-labs/agent-skills + web-interface-guidelines (MIT) | rule-by-rule review of `index.html` (motion, touch, theming, focus, images) |
| Frontend design (Anthropic) | github.com/anthropics/skills (Apache-2.0) | "one action keeps one name", "remove one accessory", headings as titles |
| ui-ux-pro-max | github.com/nextlevelbuilder/ui-ux-pro-max-skill | its landing-pattern data: social proof right before the CTA, real screenshots/photos, verified ratings only |
| Playwright | preinstalled Playwright here; `playwright-cli` skill added for the owner's machine (github.com/microsoft/playwright-cli, Apache-2.0) | renders, section map, measurements, axe, CLS |
| Awesome design (VoltAgent/awesome-design-md) | read, not added | 84 DESIGN.md files of other brands; reference only. Copying another brand's system is not this site's direction |
| Image to code (abi/screenshot-to-code) | not added | a separate FastAPI + React app with its own model keys, not a skill. Screenshots → code is done directly in the session |

Where a skill's house style contradicts a recorded owner decision, the owner
wins: Taste skill bans monospace labels, three typefaces, cream text and lime
glow; Anthropic's skill calls black + acid green a default look. Those are the
Sep 19 brand (owner, 2026-11-01) and stay.

## No behaviour data
The owner, 2026-11-02: most of the site's first-party events are the owner's
own visits, and real traffic is small. **Design decisions here rest only on
published research and the skill audits, never on our own click or scroll
counts.** Don't cite `events` / `page_views` as evidence for a design change
until real traffic is large and owner devices are excluded.

## What the audit found (before)
| Finding | Source | Measured |
|---|---|---|
| Only 2 photos on the page (bottle cutout, studio shot), none of it in use | Taste `few-pictures`; NN/g eyetracking: people look at photos that carry information about the product and ignore decorative ones ([Photos as Web Content](https://www.nngroup.com/articles/photos-as-web-content/)) | 2 |
| Two strips scroll forever with no pause control (ticker, Hinglish marquee) | WCAG 2.2.2 Pause, Stop, Hide; Vercel "autoplay motion > 5 s needs pause" | 28 s / 30 s loops |
| 10 small labels above headings | Taste `eyebrow`; Anthropic "unnecessary labels above content" | 10 |
| Headings wrap to 3–4 lines | Taste `headline-lines` | 3 H2s at 390 and 1280 |
| 44 text blocks under 13px (9.5–11.5px mono) | Taste `small-text` | 44 |
| 20 font sizes | Taste `size-count` | 20 |
| Four names for one action: FIX MY SHIRT / Fix your shirt / GET ODORSTRIKE / GET ODORSTRIKE — ₹229 | Anthropic: "an action keeps the same name through the flow" | 4 |
| "Fabric only / Not for skin / Not perfume" badges a third time in the offer, plus a second trust line | repetition (layer-cake scanning) | — |
| Decorative 01–04 numbers on four layers that aren't a sequence | Taste `numbering`; Anthropic | 4 + 3 |
| No `color-scheme: dark`, no `touch-action`, no `scroll-margin-top` on sections | Vercel guidelines | — |

## What changed
1. **New "Spray the shirt, not you."** (`#in-use`) after the day story: four of
   the owner's photos (collar check on a commute, the mist on a collar, dried
   clear, the bottle going into a trouser pocket), each with one line of fact
   from `config/product.json`, and a "View product details" link (NN/g: product photos that show real use get looked at). Left out on
   purpose: the in-hand shot (an iPhone with its logo) and the jacket-lining
   shot (a bag on the hook).
2. **Ticker removed; the Hinglish line is still** (no marquee).
3. **Order:** hero → day story → in use → beta testers → offer → what's in the
   bottle → founders → FAQ → close. Contents now come before the founders, so
   "does it work?" is answered before "who made it?".
4. **Headings shortened** (titles, not sentences): "Your shirt remembers your
   day.", "What beta testers say", "What's in the bottle", "Built for 41°C
   days". Eyebrow labels removed from every section but the hero.
5. **One name for the buy action:** "Fix my shirt" everywhere on the page,
   including the offer box and the phone bar; the offer's secondary is "View
   product details" like the hero's.
6. **Offer box:** the third set of fabric-only badges, its eyebrow and the
   "Made in Hyderabad · Dries Clear · Non-Aerosol" line are gone; on phones the
   trust line drops its dots instead of wrapping with a dot at a line end.
7. **What's in the bottle:** no 01–04 numbers, a `<ul>` (the layers work
   together), shorter copy, tighter cards on phones; "Not perfume. Not body
   deodorant." moved into its first line.
8. **Legibility floor:** every label is ≥12px (44 blocks were 9.5–11.5px).
9. **Guidelines:** `color-scheme: dark`, `touch-action: manipulation`,
   `scroll-margin-top` on sections, balanced headings, `&nbsp;` in captions.

## Result (production build)
| | Before | After |
|---|---|---|
| Hero buy button, 390×844 | 665–716px | 665–716px |
| Hero buy button, 1280×800 | 668–719px | 669–720px |
| Photos on the page | 2 | 6 |
| Text under 12px | 44 blocks under 13px, smallest 9.5px | none under 12px |
| Labels above headings | 10 | 5 (hero pill, the hero chips, the scrubber's time) |
| Page height, phone / desktop | 9,269 / 6,872px | 9,368 / 6,866px |
| axe WCAG 2.2 AA at 320/390/768/1280 | 0 | 0 |
| CLS on throttled 4G, phone / desktop | 0.025 / 0.042 | 0.025 / 0.042 (unchanged; from the font swap) |
| Taste inspector | 12 FAIL, 7 WARN | 9 FAIL, 7 WARN: headline length, numbering and too-few-pictures pass; what remains is the brand's own mono labels, three faces, lime glow and hairlines (owner's Sep 19 look), the 12px mono floor (its rule is 13px) and the first-visit consent bar covering text |

`test/homepage-design-pass.test.mjs` pins it (all 7 tests fail on the page
before this pass).

## Measure later
Only once real traffic is in the hundreds of phone visits a week, with the
owner's devices excluded: reach of `home_sec_in-use` and homepage →
`/odorstrike?buy=1` sessions before/after 2026-11-02. Until then, judge the
page against the research above, not the numbers.
