# Personal content source map (Nikhil Patil)

What the personal site (`personal-site/`, live at https://smelloff.in/NikhilPatil) may say, and where
each fact comes from. Checked 2 Nov 2026.

**This repository is public**, so this file names categories of private information, never the
details. The details stay in Nikhil's Notion.

## Sources checked

| Source | Access | Used for |
|---|---|---|
| Notion workspace (Brainee HQ): personal profile page, creator-studio pages, projects parking lot | Read through the Notion connector | Interests, work history, school, working style (only what he approved; see below) |
| smelloff.in `/about` and `/blog/why-i-built-odorstrike` (his byline) | Public | Founder role, co-founder, how they met, Zomato Everyday, the 41°C story |
| X `@NikhilxPatil` | Public profile metadata (posts need a login) | `sameAs`; bio says "Founder @Smelloffindia", Hyderabad, links smelloff.in |
| Product Hunt `@nikhilpatil` | Public | `sameAs`; headline "Founder at Smelloff". Its bio is out of date and is not quoted |
| LinkedIn `in/jogdhande` | Profile blocked to bots (HTTP 999). Smelloff's public company page lists him and links this URL | `sameAs`; listed as his. Confirm by opening it while logged in |
| GitHub `Brxinee` | Public | Not linked (no name/bio on the profile; side projects not approved) |
| Photos | Sent by Nikhil in chat, 2 Nov 2026 | Portrait, beach, yellow jacket, an early-jobs selfie (watermark cropped) |
| An older AI-generated draft of a founder site (private repo) | Read | Leads only (handles, LinkedIn URL). Its claims were not reused |

No connector exists for LinkedIn, Instagram or X in this session; nothing was logged into or bypassed.

## 1. Verified and published

- Name **Nikhil Patil**; full name **Jogdhande Nikhil Patil** (used publicly on smelloff.in, X, LinkedIn).
- Based in **Hyderabad, Telangana, India** (city level only).
- Self-taught; **school up to Class 10**, then learned on the job (approved 2 Nov 2026).
- Work journey, **no dates**: mobile shop counter, deliveries, cloud-kitchen operations at Zomato
  Everyday (~1.5 years, public), asked for a chance at the computer (registers, spreadsheets), team
  lead (approved 2 Nov 2026).
- Founder of **Smelloff**, his startup, with co-founder Vineeth Kumar Duggepogu (public on smelloff.in).
  Kept to one card and a line in About, on his instruction.
- Builds smelloff.in with AI coding tools (Claude Code, Gemini), from the repository itself.
- Dated log entries: taken from this repository's history and `CLAUDE.md`. No sales numbers.
- Interests: the anime he listed, Clash of Clans, stories about selling and strategy, trying new web
  and AI tools, punk-ish personal websites (from his own profile notes; low sensitivity).
- Profiles: X `@NikhilxPatil`, Instagram `@NikhilxPatil` (owner, 9 Nov 2026), LinkedIn `in/jogdhande`, Product Hunt `@nikhilpatil`.
- Contact: `info@smelloff.in` (his startup's inbox, forwarded to him).

## 2. Verified, waiting for his approval (not published)

- Side projects and parked ideas listed in his notes (he chose not to publish them, 2 Nov 2026).
- His creator nickname and planned creator handle (not approved).
- Other public profiles that exist but carry personal posts (left unlinked).
- Employer names beyond Zomato Everyday, and any dates for the jobs.
- A personal email address (none is published; the startup inbox is used).

## 3. Unverified (not published)

- Anything from the older AI-generated founder-site draft that has no other source.
- A live "online tools" site named in that draft: its domain does not resolve to a site.
- Product Hunt and search-engine snippets with old prices or claims.

## 4. Private: never published

- Health and wellbeing notes.
- Birth date, birthplace and family details.
- Journal entries, letters and anything about other people in his life.
- Exact address (the street address on smelloff.in is a legal requirement of the store, not repeated here).
- Formula details, costs, revenue and order counts.
- Other people's faces: the event photos he sent include third parties and were not used.

## How to change what the site says

Edit `personal-site/content/*.json` or add a Markdown note in `personal-site/content/notes/`, then
`node personal-site/build.mjs`. Add a fact only from category 1, or after he approves it.
`personal-site/test/site.test.mjs` fails on phone numbers, unknown emails, prices, percentages,
personal dates and the unapproved items above.
