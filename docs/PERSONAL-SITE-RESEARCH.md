# Personal site research (Nikhil Patil)

Research behind `personal-site/` (served at https://smelloff.in/NikhilPatil), done 2 Nov 2026.

**Method.** Headless Chromium (Playwright) at 1440×900 and 390×844, computed styles sampled in the
page, bytes from Chrome DevTools Protocol, screenshots looked at by eye. Lab timings came from a
datacentre through a proxy: treat them as relative. Screenshots were kept in the session scratchpad,
not committed. neal.fun answered every automated browser with Cloudflare's bot check (403), so it
was not studied first-hand, and the check was not bypassed.

What was used from here, and what was rejected, is in **section 5** at the end.

## 1. Jackie Hu — https://jackiehu.design/ (primary reference)

### What it is
A **single-page Framer site** (`<meta name="generator" content="Framer ed41f9e">`). The sitemap lists
only `/`; `/about` and `/work` return 404. There are **no inner project pages**: every project links
out (zenly.com, getjust.eu, a LinkedIn company page, a CMU capstone page, the Chrome Web Store,
Dribbble, a Google Drive file; one "Other Work" card has a `null` link). Title "Jackie Hu — Designer",
description "Product designer based in Paris, France". No JSON-LD.

Page structure (desktop, 3,072px tall; mobile 4,937px):
1. **Hero "Chaos"** (Framer layer name) — a full-viewport desk collage (1440×889).
2. **Currently cooking ☺︎** — one line about the app she's building ("The Little Things") with a
   sticker icon and a handwritten name, plus "Stay tuned for our TestFlight. ✈️".
3. **Recently Made ▶** — 4 list cards (JUST, Drigmo, Zenly (Snap. Inc), Discover Student Loans).
4. **Other Work ⁕** — 2×2 grid of flip cards (Alora, NBA Fan Zone, 100 Days of UI, Oddio).
5. **About ⌘** — four short mono paragraphs + "LinkedIn | Twitter (x) | E-mail: …".

### Type (computed, with where each face loads from)
| Role | Family | Size / weight / colour | Source |
|---|---|---|---|
| Name "Jackie Hu" | **Historia Sky Script** (script) | 85px desktop, 72px mobile, 400, `#3E3E42` | custom upload, framerusercontent.com (16.6KB woff2) |
| Everything else (tagline, section titles, card titles, body, About, footer) | **IBM Plex Mono** 400 / 400 italic / 500 / 600 | tagline 16/19.2 `#47443F`; section titles 20px/500 `#3E3E42` (About 24px); card titles 18px/600 `#69645E`; descriptions 16px `#69645E`; About body 18px/27px `#69645E`; meta 12px `#878686`; footer 14px `#8F8D8C` | Google Fonts (fonts.gstatic.com, ~15KB per subset file) |
| "The Little Things" (handwritten product name) | **Felt Tip Senior Regular** | 25px, `#242424` | custom upload (25KB) |
| Fake macOS UI ("Final_Final_Final" folder label, AirDrop dialog) | **SF Pro Variable** + **SF Pro Text Semibold** | 8–13px | custom uploads: a **6.1MB .ttf** and a **1.2MB .woff2** |
| Music-player time "1:13 / 3:32" | JetBrains Mono 500 | 9px | Fontshare via Framer |
| Multiplayer cursor tags | "You" = Inter 500 16px white on `#242424`; "Jackie" = Satoshi 700 16px white on `#F76240` | | Framer / Fontshare |

Text-node count by family: IBM Plex Mono 84, every other family 1–3. So the system is really **one
script face for the name + one mono for everything**, with other faces used only to imitate real
objects (macOS UI, a felt-tip label). Manrope is declared but never used. `font-display: swap` on the
custom faces; Plex Mono's `@font-face` has no font-display set.

### Palette (sampled computed values / pixels)
| Token | Hex | Use | Contrast on `#FFFAF5` |
|---|---|---|---|
| Paper | `#FFFAF5` | page background | — |
| Card | `#FDF8F4` / `#FCF7F2` | list + flip cards | — |
| Hairline / pressed | `#E7E6DE` | 1px card border, selected mode button | — |
| Ink (headings) | `#3E3E42` | name, section titles | 10.3:1 |
| Ink (tagline) | `#47443F` | hero tagline | 9.3:1 |
| Body | `#69645E` | card text, About | 5.65:1 (passes AA) |
| Meta | `#878686` | "Chrome extension \| 2020" (12px) | **3.5:1 (fails AA)** |
| Footer | `#8F8D8C` | social links (14px) | **3.18:1 (fails AA)** |
| Tiny label | `#8A8A8A` | "Souleance" (9px) | **3.33:1, and 9px type** |
| Accent | `#F76240` coral | "Jackie" cursor tag | white text on it 3.1:1 |
| Object colours | lamp `#572009`, vinyl label `#D4242E`, folder `#73CEF9`, Kodak yellow | all colour comes from the photographed objects | |

The UI itself is almost colourless (warm off-white + warm greys). **All saturation comes from
real-object photos**, which is why it feels warm and personal, not "designed".

### Layout and spacing
- Framer breakpoints: `min-width:1200px`, `810–1199.98px`, `max-width:809.98px`.
- Desktop: hero is exactly one viewport. Below it, content is left-aligned on an **80px gutter**
  (1280px content width at 1440); About is inset further (144px, 1152px wide).
- Recently Made: single column of **500×120 cards** (radius 16px, 1px `#E7E6DE` border, 80px app icon
  with ~10–11px radius, 16px gap). The **right ~60% of the row is deliberately empty** — it's where
  the hover preview and the cursors play.
- Other Work: 2-column grid of **512×218 cards** (radius 24px, padding 30/30/30/60, 130×150 image
  left, title, meta, a short 72px rule, description, link icon), ~16px gaps.
- Section titles carry a small glyph suffix as personality: ☺︎ ▶ ⁕ ⌘.
- Mobile: 24px gutter, everything single column; cards full width.
- No `<nav>`, no `<header>`, **zero `<h1>`/`<h2>`/`<h3>`**, `<html lang="">` empty, every `<img>` has
  `alt=""`.

### Interactions observed (screenshots in `shots/jh-sheet-0.png`, `-1`, `-2`, `jackiehu-int-*.png`)
1. **Desk collage of photographed cut-outs**, each slightly rotated: a Flowerpot-style lamp, paper
   clip + note, torn dictionary clipping ("Dreams /dri:m/"), Muji notebook, coffee-cup stain, Kodak
   Portra 400 film canister, Bic lighter, a pen, Blue Bottle hand-cream tube, a Doliprane box (French
   paracetamol), a pixel mouse cursor, a vinyl record music player ("Souleance — Jazz et thé vert",
   1:13 / 3:32 with a scrubber), a macOS folder named **"Final_Final_Final"**, an **AirDrop dialog
   "Jackie would like to share a photo"** with Decline / Accept, and a MacPaint-style tool palette.
   Each object is a tiny joke or a biographical clue (Paris pharmacy, film photography, designer file
   naming). This is the "who I am" — told through possessions, not a résumé.
2. **Hover the lamp → it switches on** (a warm glow appears under the shade).
3. **The vinyl spins continuously** (it keeps spinning with `prefers-reduced-motion: reduce`).
4. **Three-mode switcher** under the tagline (48×48 icon buttons: coffee cup / broom / pencil) with a
   black tooltip: **"chaos mode"** (default), **"cleaned-up mode"** (every object animates into a tidy
   grid, name moves right), **"notebook mode"** (objects arrange around an open notebook with the name
   written on it). A self-aware joke about designers' messy vs. tidy desks, and a genuine "make it calm"
   control.
5. **Per-object sound effects**, all 13 preloaded on page load from `raw.githubusercontent.com`
   (1.28MB): musicplayer.m4a, windows-xp.mp3, mouse-click, desk-lamp, paper-ripping, folder, water-drop,
   turnpage, writing-scribble (.wav), analog-camera, lighter (.wav), AirDrop.wav (500KB), pill.mp3.
6. Some objects are draggable (`cursor: grab`, `touch-action: none` on e.g. the Doliprane box). A drag
   on a non-draggable area selects text instead (blue selection over the photos).
7. **Figma-style multiplayer cursors** in "Recently Made": a "You" tag follows your pointer and a coral
   "Jackie" cursor drifts nearby — presence + "I live in Figma".
8. **Hover a Recently Made card → a fan of product screenshots pops out** beside it (App Store "App of
   the Day", chat cards, tags) — the empty right column becomes the preview stage.
9. **Other Work cards flip in 3D on hover** (Front/Back faces with `matrix3d(-1…)`), back = dark panel
   with 4 screenshots. They stay flipped after the pointer leaves until re-hovered.
10. Letter-by-letter spans on "Product Design" (stagger animation), a bouncing scroll chevron.
11. Microcopy tone: dictionary framing **"Product Design — Verb & Noun — a thoughtful process of
    crafting experiences that engage people, shape clarity, and spark delights."**; "Currently cooking
    ☺︎", "A fun lil app…", "Stay tuned for our TestFlight. ✈️", "I design to make people smile ☺."
    Lower-key, friendly, first person, short.

Keyboard: the mode buttons are `<div tabindex="0">` with **no role and no accessible name**; Enter does
switch modes and a dark focus outline is visible (`jackiehu-kb-enter-clean.png`). Links get only the
browser's thin default focus outline (`jackiehu-int-18-tab-focus.png`).

### Weight and performance (desktop, compressed bytes over the wire)
| | KB |
|---|---|
| **Total** | **~10,240** (mobile ~10,415) |
| Fonts | **7,362** (of which SF Pro: 6.1MB TTF + 1.2MB woff2, used for ~5 tiny labels) |
| Media (sounds) | 1,284 |
| Images (PNG cut-outs) | 799 (desktop) / 973 (mobile) |
| JS | 741 (Framer runtime, React, motion, a 1.5MB-uncompressed shared lib, gtag 543KB uncompressed) |
| HTML | 53 |

Lab LCP ≈ 0.9s (an image), CLS ≈ 0.001 on desktop through the proxy — fine on fast hardware, but
10MB is a lot for a phone on Indian 4G. Third parties: Framer events, Google Analytics, GitHub raw
for audio.

### Why it works (principles to extract, not things to copy)
1. **Identity through objects.** Each item is a specific, slightly funny clue about her life and taste
   (where she lives, what she listens to, how she names files). It answers "who is this person?"
   faster and warmer than a bio paragraph.
2. **Restraint around the play.** One script face for the name, one mono face for all words, warm
   off-white, warm greys. The colour and noise come from the objects only, so the play doesn't
   become chaos.
3. **Play is front-loaded and optional.** The hero is a toy; everything below the fold is a calm,
   scannable list (icon + title + one line). You never have to play to get information.
4. **A "tidy" control is part of the joke.** Chaos / cleaned-up / notebook modes give the visitor
   agency and a calmer view, framed as personality rather than as an accessibility setting.
5. **Rewards for curiosity are small and many**: lamp glow, sounds, cursors, hover previews, flips.
   None of them is required to navigate.
6. **Tone of voice is consistent with the visuals**: lowercase energy, emoji glyphs as punctuation,
   a dictionary-definition gag for the job title.
7. **"Currently cooking"** puts the present first — what she's making now — before past work.

### Usability problems found
- **Weight**: ~10MB per visit; 7.4MB of fonts to render ~5 labels; all 13 sounds preloaded even if
  never played.
- **Font licensing**: SF Pro is Apple's typeface; Apple's licence restricts how it may be used, and
  serving it as a web font from a personal site is not something we should replicate. Use open fonts.
- **No semantics**: no headings, no landmarks/nav, empty `lang`, empty alt on every image, mode
  buttons without role/name. Screen readers and search engines get a flat page.
- **Contrast**: meta (3.5:1), footer links (3.18:1), 9px labels (3.33:1) and white on coral (3.1:1)
  fail WCAG 1.4.3 AA for text of that size.
- **Motion**: the record spins forever and ignores `prefers-reduced-motion`; there is no
  `prefers-reduced-motion` rule in the CSS at all. Continuous motion with no pause control is a
  WCAG 2.2.2 risk.
- **Mobile**: the collage becomes ~1.1 screens of rotated objects; the name and tagline are printed
  rotated (~-25°) on the notebook, which is harder to read; hover previews, flips and cursors have no
  touch equivalent; the page grows to 4,937px.
- **No depth**: no case studies, projects leave the site immediately; one card links to `null`.
- Flip cards stay flipped after hover ends (state feels sticky/odd).

### Adapt vs. avoid (for Nikhil's site)
**Adapt:** objects-as-autobiography (his real objects from Hyderabad), one expressive display face +
one workhorse face, warm neutral UI with colour from photos only, a "Now / currently cooking" block
first, calm list below the play, a visitor-controlled "tidy" mode, small optional delights (one sound
per object, opt-in), hover previews that have a tap equivalent.
**Avoid:** Framer-scale JS, system fonts we don't have rights to, preloading audio, decorative motion
that ignores reduced motion, headless semantics, mystery-meat icon buttons without labels, low-contrast
meta text, rotated body text on phones, projects that only link away.

---

## 2. Other creative personal sites

Format per site: **Distinctive / Memorable interaction / Organisation / Intro / Why explore / Works /
Problems / Adapt / Avoid**. Weights are compressed transfer, desktop first load.

### 2.1 Bruno Simon — https://bruno-simon.com/  (partially observed)
Our headless Chromium (software GL) rendered **only the start/loader scene**: a glowing ring on a
blue-violet grid floor (`bruno-pair.png`, `bruno-drive.png`); the 3D driving world never drew, so the
car/world was **not observed**. The DOM confirms the product: buttons for "Interact", "Unstuck",
map trigger, "Teleports you to the closest respawn", "Resets every object", sound/effects toggles,
an achievements panel ("Unlock at 8 / 15 / 23 / 30 / 38", "Reset achievements"), control schemes for
"Mouse Keyboard / Mobile Tablet / Gamepad", and a "Your browser is not compatible with WebGL" fallback.
Fonts: Amatic SC, Nunito, Pally. Weight: **5.4MB desktop, 7.5MB mobile** (1.2MB JS incl. Rapier
physics; 4MB+ fetched 3D assets). No headings, no text content in the DOM.
- Distinctive: the portfolio *is* a game world. Memorable: driving a car into project signs; achievements.
- Organisation: spatial (places in a world). Intro: implicit (the world is the CV).
- Why explore: game loop + achievements. Works: unforgettable, shareable.
- Problems: needs WebGL/GPU, heavy, no readable content without it, no text alternative visible.
- Adapt: small achievement-like rewards for exploring. Avoid: WebGL as the only path to content.

### 2.2 Neal Agarwal — https://neal.fun/  — **failed to load**
Both Playwright and WebFetch received **HTTP 403 (Cloudflare "Performing security verification")**.
We did not bypass the bot check, so nothing about the live page is reported here.

### 2.3 Michael Kolesidis — https://michaelkolesidis.com/
Brutalist "playground": huge grotesk name, flat candy colours (`#3ECFC1`, `#FF90E8`, `#FFC900`,
`#FF7051`), hard black offset shadows, a **3D rubber duck** centre stage ("Use it for debugging"
handwritten in Caveat), a top **ticker of instructions** ("FEEL FREE TO PLAY WITH MY RUBBER DUCK",
"CLICK ON ANYTHING COLORFUL FOR A NEW COLOR", "TRY MOVING THINGS AROUND", "SMILEY IS YOUR FRIEND"),
Japanese vertical label "ラバーダック", a "DESIGN AWARD One Page Love" badge, mini "apps" (TV, Radio,
Pixel game with "20 moves left"), custom PNG cursor. Fonts: Karlsbader Grotesk, Caveat.
- Memorable: clicking colour blocks recolours them; draggable stickers; the duck.
- Organisation: one long page (12,566px) of project tiles with GitHub links. Intro: 3 short phrases
  ("Abolishing the static web through fluid motion and interactive storytelling").
- Works: the ticker *tells you how to play* — instructions as decoration.
- Problems: **55MB of images on first load**; on a 390px phone the layout is **1001px wide** (page
  zooms out, not responsive); 13 keyframe animations incl. an endless ticker, no reduced-motion rule.
- Adapt: "how to play" instructions written into the design. Avoid: animated GIF weight, fixed widths.

### 2.4 Maggie Appleton — https://maggieappleton.com/
Digital garden. Warm paper `#F6F5F1`, ink `#353534`, plum `#5F023E` and teal `#04A5BB` accents,
**Canela Deck** display serif + Lato. H1 is a sentence: "**Maggie** makes visual essays about
programming, design, and anthropology." Sub: "Designer, anthropologist, and mediocre developer".
- Memorable: leaf/logo wiggle animations (`leafWiggle`, `growthSprout`, `growthSway` keyframes in the
  CSS); visual essays; the "imperfect notes growing slowly over time" framing.
- Organisation: The Garden → Essays / Notes / Patterns / Smidgeons / Talks / Podcasts / Library, plus
  Now and About. Each list shows type + age ("Almost 2 Years Ago").
- Why explore: many small entry points; honest "imperfect notes" framing.
- Works: 433KB, reduced-motion rule present, WebSite JSON-LD graph, clear visible nav.
- Problems: mobile page is 10,271px (long lists); Canela is a commercial face.
- Adapt: name-in-a-sentence H1, typed content with dates, a Now page. Avoid: endless homepage lists.

### 2.5 Rafaël Rozendaal — https://www.newrafael.com/
Full-bleed **random artwork/exhibition photo on black** with only a hamburger icon; no visible text on
first view (the `<title>` changes with the image, e.g. "2016 Upstream Amsterdam - Exhibition").
Person + WebSite JSON-LD present. 2.5MB (images), 37KB JS.
- Memorable: every load is a different work. Organisation: hidden menu.
- Works: pure gallery feel, the work speaks. Problems: **mystery-meat navigation** — nothing tells
  a newcomer who he is or what to click; hidden navigation (NN/g: less discoverable).
- Adapt: "random item on each visit". Avoid: hiding identity and nav behind an icon.

### 2.6 Daniel Miessler — https://danielmiessler.com/
VitePress site with a **warm parchment palette** (`#EAE9DF` bg, `#2C1810` brown ink, `#4A2F1F`),
commercial MB Type faces (valkyrie-text body ~20px, concourse/heliotrope small-caps labels).
Homepage is a first-person manifesto ("Hi, My name is daniel miessler…") with a right rail of
icon+label buttons (YouTube, Blog, Newsletter, Podcast…, "Book a meeting").
- Memorable: idiosyncratic sections — "telos", "predictions", "daemon", "ideas".
- Intro: a letter, not a bio. Works: strong voice, visible nav, reduced-motion rule.
- Problems: 1MB JS for a text page; 10+ nav items; long text-first homepage.
- Adapt: a "predictions"/"beliefs" page as personality; letter-style intro. Avoid: nav sprawl.

### 2.7 Rauno Freiberg — https://rauno.me/
A **horizontal deck of slides** on grey `#EDEDED` (document is 6,648px wide on desktop), a slide-index
ruler at the top, giant sentence "Rauno Freiberg is an Estonian interaction designer working with
Vercel and Devouring Details" on a white card with a **huge yellow circle** (`#FFFF02`) and a crosshair.
Custom font "X". 645KB.
- Memorable: the sentence-as-hero, the deck metaphor, manifesto line "Make it fast. Make it beautiful…".
- Problems: horizontal scrolling (arrow key and wheel did not advance in our test), no headings
  beyond the H1, no reduced-motion rule.
- Adapt: a one-sentence identity statement set very large. Avoid: horizontal-only navigation.

### 2.8 Paco Coursey — https://paco.me/
Radically minimal: 16px Söhne on white, `#3A3A3A` text, an **italic serif accent** (Newsreader) on
key phrases ("*Crafting interfaces*.", "*everything around me is someone's life work*"). Three small
columns: Building / Projects / Writing, then **Now** and Connect. Links to his music playlists.
- Memorable: the restraint and a "command menu"/reader details; 20 small keyframes for dialogs.
- Works: 380KB, reduced-motion rule, everything visible in one screen. Problems: no headings
  hierarchy (H1 is 16px), React hydration error #418 in console.
- Adapt: italic accent words, a "Now" paragraph, music as personality. Avoid: H1 that's body-sized.

### 2.9 Josh W. Comeau — https://www.joshwcomeau.com/
Sky-blue clouds, a **3D mascot of Josh** sitting under an **editable generative rainbow** ("Edit the
generative art"), Wotfard + Cartograph CF, pink section labels `#E60067`. Header has search, **sound
toggle ("Disable sounds" → sound is on by default)**, dark mode, RSS.
- Memorable: playful sound and a lot of motion (54 CSS keyframe animations), with a reduced-motion rule.
- Organisation: classic blog — Articles, Browse by Category chips, Popular Content.
- Works: 972KB, visible labelled nav, skip link. Problems: sound on by default; lots of motion.
- Adapt: an editable/generative hero as a toy; mascot = person. Avoid: default-on sound.

### 2.10 Brittany Chiang — https://brittanychiang.com/
Dark navy `#0F172A`, slate text `#94A3B8`, teal `#5EEAD4` chips, Inter. **Sticky left column** (name,
title, one-liner, in-page nav ABOUT/EXPERIENCE/PROJECTS with growing line indicators, social icons);
right column scrolls About → Experience timeline → Projects. Skip link, reduced-motion rule.
- Memorable: the nav indicator line (longer for the current section), the "Korok seeds" Easter-egg
  link (split into per-letter spans; the CSS has a `wobble` keyframe — animation not filmed).
- Works: fast to scan, accessible. Problems: it's a template-famous layout (widely cloned); 1.1MB fonts.
- Adapt: sticky identity column on desktop. Avoid: looking like the thousand clones.

### 2.11 Emil Kowalski — https://emilkowal.ski/
Off-white `#FDFDFC`, two text tones (`#21201C`, `#63635E`), one variable sans at 14–16px. Sections:
"Today" (what he's doing now), Projects, Writing. A course banner at the top.
- Memorable: nothing flashy on the homepage — polish lives in the writing/components.
- Works: honest, current ("Currently taking a break from work"), reduced motion.
- Problems: **2MB for a text page** (1MB fonts, 0.9MB JS); no headings; React error #418.
- Adapt: "Today" block. Avoid: shipping a 1MB font for one weight range.

### 2.12 Linus Rogge — https://linusrogge.com/
**12px Fragment Mono** on white, name + "Design Engineer at SPACING", links to **Email, Are.na,
Cosmos, Letterboxd** (taste profiles, not just socials), and a **film strip of ~20 square photo
thumbnails** along the bottom edge, each linking to `/p/<id>`; an "[i]" info toggle. 501KB.
- Memorable: the photo strip as the whole portfolio; negative space.
- Problems: 12px type everywhere, no reduced-motion rule. Adapt: a photo strip of real life;
  linking taste profiles (Letterboxd etc.). Avoid: 12px body text.

### 2.13 Lee Robinson — https://leerob.com/
System serif ("Iowan Old Style" via `local()` — **zero font download**), `#282828` on white. H1
"@leerob", a **Bio toggle "Default / Long"** (tabs that switch the bio length), Notes (a list of
belief/opinion pages), Blogs with dates, and a large illustrated painting of SF + Iowa skylines
(where he lives / where he's from) with drift animations. Person JSON-LD. 591KB.
- Memorable: the bio-length toggle; the hometown illustration.
- Adapt: **short/long bio toggle**; an illustration of "here + where I'm from". Avoid: little.

### 2.14 Cassie Evans — https://cassie.codes/  (site retired)
Now a single **"Thanks for reading."** modal in Courier New over a flowing, liquid-distorted flower
image: she explains she stopped maintaining a personal site. Interesting as a tone lesson (honest,
personal), but no longer a portfolio to study.

### 2.15 Robin Rendle — https://robinrendle.com/
A **Finder/file-browser** site: left sidebar tree "Photos → 2026 → country-road.jpeg…", main pane photo
grid, header "Robin Rendle / v19.1.1", dark-mode toggle, back/forward, footer date + time "2:50 PM
PDT". Font "MD UI" variable. **No JavaScript at all**; 1.5MB (photos).
- Memorable: browsing a person like a file system; visible version number.
- Problems: content-type names as filenames are cute but cold; no reduced-motion needed (no motion).
- Adapt: version number + local time in the chrome; zero-JS approach. Avoid: filenames as titles.

### 2.16 Amelia Wattenberger — https://wattenberger.com/
**Huge Parclo serif name** (900 weight, with a dark-to-green gradient on "Wattenberger"), "Hi, I'm"
in a small tilted script line, bold-italic verbs ("I *create things on the web*, *explore novel
interfaces*…"), a **blue flower sticker with eyes: "this site is WIP — Go to the old one ↣"**, then
"I'm thinking about…" essays and a "What I'm currently noodling on" grid tagged AI / data viz / lasers.
- Memorable: the sticker honesty, giant type, project tags.
- Problems: **~31MB of video on first load** (33.8MB total), no reduced-motion rule, no headings H1.
- Adapt: WIP sticker as honesty; verb-led intro. Avoid: autoloading video thumbnails.

### 2.17 Poolsuite — https://poolsuite.net/  (a brand, not a person; included for the OS metaphor)
Retro Mac-OS-style windows on pink `#F6D5D5`: a TV/radio player window ("Kauai_Vacation_1991.mov",
"Poolsuite: ON AIR"), a fake date "MON 2 NOV 1997", a dock of icon+label apps (Player, Newsroom,
Mixtapes, Members, Events, Instagram, Vacation, Guestbook, Apps). Pixel fonts (Pixolde, ChiKareGo2).
- Memorable: the whole site is a toy computer with music. Works: icons always have text labels;
  mobile keeps the dock as a scrolling strip.
- Problems: 6MB desktop / **11.4MB mobile**, Facebook pixel + wallet SDKs, no reduced motion, no H1.
- Adapt: labelled-icon dock. Avoid: heavy media, third-party trackers.

### 2.18 Ryo Lu — https://ryo.lu/
Light, big type status sentence: **"Ryo is exploring Taipei."** + "LAST SEEN YESTERDAY, AT 饞食坊 IN
TAIPEI." in mono caps (nbintl / nbintl-mono), links Read journal / Explore ryOS, past work
(Cursor, Notion, Stripe, Asana), EN / 中 / 日 language switch. A **page-curl in the top-right
corner** opens **ryOS** — a full retro Mac OS X-style desktop (sand-garden wallpaper, dock, an
"Updating icons…" toast, and an assistant dog "Rover": "It looks like you're using ryOS! Need a hand
with anything?") (`ryo-rauno-sheet.png`).
- Memorable: a live, human status line; the peeled corner as a hidden door.
- Problems: **9.4MB and 132 script requests** on the homepage (ryOS assets load in the background);
  status depends on him updating it.
- Adapt: **"Nikhil is … in Hyderabad" status line** + a discoverable hidden door. Avoid: loading the
  easter egg before anyone opens it.

### 2.19 Lynn Fisher — https://lynnandtonic.com/
**v. XIX** (observed: a "v. XIX" link plus an ARCHIVE entry; that she redesigns roughly yearly is
general knowledge, not verified today). This version: a book's **title page + table of
contents** — "LYNN FISHER / Designer for the Web" in Hubano Rough, nav as ToC with dotted leaders and
roman numerals (ABOUT … I, WORK … II, THOUGHTS … III, ARCHIVE … IV, RSS … V, GIFS … VI), paper texture,
a sun icon "mode" toggle. Same layout at 600/900/1200px this version. 393KB, 6KB JS.
- Memorable: the metaphor is the navigation (a contents page), and the version number invites
  "what did last year look like?" (Archive).
- Problems: no reduced-motion rule (little motion anyway). Adapt: **nav as a familiar printed
  object** (contents page, menu card); versioned yearly redesign. Avoid: nothing major.

### 2.20 Dustin Brett — https://www.dustinbrett.com/  (daedalOS)
A Windows-like desktop in the browser: icons with labels (My PC, Public, Blog Posts, Doom, "Day in My
Life", "My Travel Story"), taskbar with π start button, search and clock; a WebGL galaxy wallpaper
(rendered on mobile, black on desktop in our headless run). 395KB initial.
- Memorable: it's a real working OS (apps run). Problems: **no readable content or headings on
  first view**, desktop metaphor on a phone, content hidden in windows.
- Adapt: labelled icons. Avoid: OS cosplay as the primary path to "who are you".

### 2.21 Henry Heffernan — https://henryheffernan.com/
A **BIOS boot screen** ("HHBIOS (C)2000 … Checking RAM : 14000 OK … Loaded keyboardKeydown3 … 63%")
then a "Click start to begin" gate with a START button; on mobile a yellow "WARNING: This experience
is best viewed on a desktop or laptop computer." 12.4MB (7.2MB media).
- Memorable: boot sequence as a loader. Problems: a gate before any content, desktop-only.
- Adapt: a loader that's also a joke (if one is ever needed). Avoid: start gates and mobile warnings.

---

## 3. Best-practice facts (authoritative sources)

**Core Web Vitals** (75th percentile of page loads, mobile and desktop separately):
- LCP good ≤ 2.5s, needs improvement 2.5–4.0s, poor > 4.0s — https://web.dev/articles/lcp
- INP good ≤ 200ms, needs improvement 200–500ms, poor > 500ms — https://web.dev/articles/inp
- CLS good ≤ 0.1, needs improvement 0.1–0.25, poor > 0.25 — https://web.dev/articles/cls
- Overview: https://web.dev/articles/vitals

**Font loading** — https://web.dev/articles/font-best-practices
- WOFF2 only ("Use only WOFF2 and forget about everything else"); ~30% smaller than WOFF.
- Inline the `@font-face` declarations in `<head>` so fonts are discovered early; don't inline the
  font files themselves.
- `preload` ignores `unicode-range`; preload only the one file the first paint needs.
- `font-display`: `swap` (no block, swap later), `fallback` (~100ms block, ~3s swap), `optional`
  (~100ms block, no swap — "most performant").
- Subset (remove unused glyphs; check the licence allows it) and use `unicode-range`.
- Variable fonts replace several static files but are larger than one style — worth it only when
  several weights are used.
- `size-adjust` (with ascent/descent overrides) on the fallback face to cut CLS at swap.
- Self-hosting is not automatically faster; it is, however, the only option for fonts not on a CDN
  and avoids a third-party connection (our Smelloff repo already self-hosts WOFF2s this way).

**View Transitions (cross-document / MPA)**
- Opt in on both pages: `@view-transition { navigation: auto; }`; same-origin only; pseudo-elements
  exist in the destination document; `pageswap` / `pagereveal` events; duplicate
  `view-transition-name`s skip the transition — https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API/Using
- Support: Chrome/Edge **126+**, Safari **18.2+**, **Firefox not supported** —
  https://developer.chrome.com/docs/web-platform/view-transitions/cross-document ; MDN marks
  `@view-transition` **"Limited availability" (not Baseline)** —
  https://developer.mozilla.org/en-US/docs/Web/CSS/@view-transition . So use it as progressive
  enhancement only: unsupported browsers just navigate normally.

**prefers-reduced-motion** — Baseline "Widely available" (since January 2020); values `no-preference`
/ `reduce` — https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion .
Pattern for us: put non-essential motion inside `@media (prefers-reduced-motion: no-preference)` and
check `matchMedia('(prefers-reduced-motion: reduce)')` in JS before starting loops.

**WCAG 2.2**
- 2.5.8 Target Size (Minimum), AA: targets ≥ 24×24 CSS px, with spacing / equivalent / inline /
  user-agent / essential exceptions — https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- 2.4.7 Focus Visible (AA) requires a visible indicator; 2.4.11 Focus Not Obscured (Minimum), AA:
  "When a user interface component receives keyboard focus, the component is not entirely hidden due
  to author-created content" — https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html
- 2.4.13 Focus Appearance (AAA): indicator area ≥ a 2px perimeter and 3:1 change contrast —
  https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html (good target even though AAA).
- 2.2.2 Pause, Stop, Hide (A): auto-starting motion lasting > 5s shown alongside other content needs
  a pause/stop/hide mechanism — https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html
- 2.3.3 Animation from Interactions (AAA): interaction-triggered motion can be disabled; honour the
  OS reduce-motion setting (techniques C39 / SCR40) —
  https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html

**Structured data (Google)**
- ProfilePage: for pages whose primary focus is one person affiliated with the site (blog "About Me"
  pages qualify). Required: `mainEntity` (Person) with `name`. Recommended: `dateCreated`,
  `dateModified`, and on the Person `alternateName`, `description`, `identifier`, `image` (real,
  crawlable; no placeholder), `sameAs` (other profiles), interaction statistics only from the hosting
  platform — https://developers.google.com/search/docs/appearance/structured-data/profile-page
- WebSite (site names): on the **homepage** (domain/subdomain root) only; required `name` and `url`;
  optional `alternateName` (list in order of preference) —
  https://developers.google.com/search/docs/appearance/site-names

**NN/g**
- Hidden navigation: on desktop, hidden menus were used in 27% of cases vs 48% visible; discoverability
  dropped > 20%; tasks took ≥ 39% longer. Recommendation: don't hide nav on desktop; on mobile show it
  if ≤ 4 top links — https://www.nngroup.com/articles/hamburger-menus/ (Pernice & Budiu, 2016)
- Icons: "a text label must be present alongside an icon"; labels visible at all times; no hover-only
  labels (fail on touch); the 5-second rule — https://www.nngroup.com/articles/icon-usability/ (Harley, 2014)
- Scrolljacking: causes disorientation and frustration, worse on mobile and with text; "scrolljacking
  leads to more user pain than benefits"; avoid horizontal scrolljacks — https://www.nngroup.com/articles/scrolljacking-101/ (Paul, 2023)
- About pages: users want what you do, where, origins/values, how to contact; authentic photos (not
  stock), plain language, storytelling, multiple contact options; tagline on the homepage + summary +
  details — https://www.nngroup.com/articles/about-us-information-on-websites/ (Kaley & Nielsen, 2019).
  For a person: a one-line "who/what/where" in the first screen, a real photo, and contact links.

---

## 4. Cross-site patterns worth keeping

| Pattern | Seen on | Use it? |
|---|---|---|
| Objects/photos as autobiography | Jackie Hu, Linus Rogge (photo strip), Lee Robinson (skyline art) | **Yes** — core idea |
| A present-tense status line ("Now", "Today", "currently cooking", "Ryo is exploring Taipei") | Jackie, Emil, Paco, Maggie, Ryo | **Yes** |
| Name inside a sentence as H1 | Maggie, Rauno, Ryo | Yes |
| Navigation as a familiar printed object (contents page) | Lynn Fisher | Yes (e.g. an Irani café menu card) |
| Short/long bio toggle | Lee Robinson | Yes |
| Visitor-controlled calm mode | Jackie (cleaned-up mode) | **Yes**, and default it on for reduced motion |
| Honest WIP / version stamps | Wattenberger sticker, Lynn "v. XIX", Rendle "v19.1.1" | Yes, small |
| Hidden door / easter egg | Ryo's page curl, Kolesidis apps, Comeau editable art | One, lazy-loaded |
| OS / game metaphors as the main UI | Dustin, Poolsuite, Henry, Bruno | No — heavy, hides content |
| Hidden or icon-only nav | newrafael, Jackie (no nav) | No |
| Endless tickers / autoplay sound or video | Kolesidis, Comeau (sound on), Wattenberger (31MB video) | No |

Observed weights (compressed, desktop): Rendle 1.5MB (0 JS), Lynn 0.39MB, Paco 0.38MB, Dustin 0.40MB,
Maggie 0.43MB, Rogge 0.50MB, leerob 0.59MB, Rauno 0.65MB, Comeau 0.97MB, Miessler 1.7MB, Emil 2.0MB,
newrafael 2.6MB, Chiang 2.9MB, Bruno 5.4MB, Poolsuite 6.2MB, Ryo 9.4MB, **Jackie Hu 10.2MB**,
Henry 12.4MB, Wattenberger 33.8MB, Kolesidis 55.5MB. The memorable ones are not necessarily the heavy
ones: Lynn Fisher, Linus Rogge and Lee Robinson are distinctive under 0.6MB.

---

## 5. Decision: a photocopied zine, not a desk or a café table

Three directions were written up during research (an Irani café table of his objects, a lab notebook,
a Hyderabad-local-time typographic page). The researcher's pick was the café table. It was **not**
built, for two reasons that come from the brief rather than taste:

1. **It would have invented facts.** Cutting chai, Osmania biscuits, a Metro card: nothing in his
   notes says these are his. A personal site that stages objects he doesn't own fails "do not
   invent personal stories" on the first screen.
2. **It needed a photo shoot** of objects that don't exist yet; the site would have launched with
   placeholders.

**Chosen: a photocopied DIY zine.** It is grounded in verified things: he is self-taught (school to
Class 10, then everything on the job, which he approved for publishing), his own notes say he likes
"retro/Y2K/punk personal websites with visual personality but without overwhelming noise", and a
zine is what self-taught people make. It also gives every playful element a reason:

| Element | Why it is there |
|---|---|
| Masthead in Archivo at 125% width, "Issue Nov 2026" strip | A zine cover; the issue date is the build date, so it is always true |
| Collage of his own photos + cut-outs (Wikimedia Commons, CC0) + one halftone of his product | Jackie Hu's lesson (identity through objects) with objects that are verifiably his: his face, Hyderabad, the anime he watches (glove = Hajime no Ippo, cassette = his anime list), the thing he makes |
| Rubber stamp tool, Tidy, Ring | Jackie Hu's tool palette and "cleaned-up mode", rebuilt as real buttons with keyboard paths; Ring plays the exact two notes his order dashboard plays (B5/E6) |
| Shop-shutter dark mode | A local object (Hyderabad shop shutters) doing a real job (theme toggle) |
| Time card ("Clocked in") | His work history (approved) as an attendance card: no dates, so nothing has to be invented |
| Self-taught syllabus | "School stopped at Class 10" turned into a report card of what he taught himself, each with proof |
| Visiting card with Accept / Decline | Jackie's AirDrop joke made useful: Accept downloads a real .vcf |
| /now page, dated log | Present-tense status (Ryo Lu, Maggie Appleton, nownownow.com) and build-in-public, from his own playbook |

**Taken from the references:** identity through objects (Jackie Hu); one display face + one mono +
one hand, not more (Jackie Hu); a calm "tidy" view (Jackie Hu); nav as a printed object, always
visible and labelled (Lynn Fisher; NN/g on hidden menus); a present-tense "now" line (Ryo Lu,
Emil Kowalski, Paco Coursey); small page weight (Lynn Fisher, Lee Robinson, Linus Rogge under 0.6MB).

**Avoided on purpose:** a fake desktop OS or 3D world that hides the content (Bruno Simon, Dustin
Brett, Henry Heffernan, Poolsuite); multi-megabyte fonts and video (Jackie Hu ~10MB, Kolesidis 55MB,
Wattenberger 34MB); motion that can't be paused or ignores reduced motion (Jackie Hu's record);
unlabelled `div` buttons and missing headings (Jackie Hu); rotated body text on phones.
