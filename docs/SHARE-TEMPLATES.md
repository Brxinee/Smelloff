# Share templates — the research, and what it made us do (2026-08-03)

Every blog post has share buttons. Until now every one of them sent the same
thing: the page title and the URL. This document is why that was the wrong text,
what the evidence says the right text looks like, and where the platforms stop
us from using it at all.

Source of truth for the copy: **`scripts/share/share-templates.config.mjs`**.

```
node scripts/share/apply-share-templates.mjs          # stamp copy into posts
node scripts/share/apply-share-templates.mjs --check  # dry run, exits 1 if stale
```

---

## The finding that changed the copy

A headline and a share message are written for two different acts.

A headline is written to be clicked **in a feed, by a stranger, in competition
with forty other headlines**. A share is one person handing a thing to one other
person they already know, usually with an implied "this is relevant to you
specifically". Sending the headline as the share text answers the wrong question.

The New York Times' *Psychology of Sharing* study — ethnographies, focus groups
and a survey of 2,500 medium-to-heavy sharers — found:

| Finding | Share |
|---|---|
| Carefully consider how useful the content will be **to the recipient** | **94%** |
| Share to give people a better sense of who they are and what they care about | **68%** |
| Share to stay in touch with people they otherwise wouldn't | **78%** |
| Share to meet others with shared interests | **73%** |

94% is the number that matters. It says the sender is already asking "why am I
sending this to *you*" — and a title dump gives them nothing to answer with.

So the WhatsApp line on each post is written as the sentence a friend would
actually type. Not:

> Why Clothes Smell Musty in Monsoon (And How to Fix It)

but:

> That musty smell in monsoon isn't the wash — it's clothes taking 8 hours to
> dry. Explains a lot, and there's a fix that isn't re-washing.

The second names the recipient's problem, gives away the answer, and reads like
a person. The first reads like a CMS.

---

## What travels, and what doesn't

Berger & Milkman, *What Makes Online Content Viral?* (Journal of Marketing
Research, 2012) analysed every New York Times article over three months:

- **High-arousal emotion travels.** Awe, anger and anxiety all raise
  transmission.
- **Low-arousal emotion does not.** Sadness *lowers* it.
- **Practical utility is independently positive**, and the emotion effect holds
  even after controlling for it.

These are problem-solving posts, so the lever available to us is **utility plus a
small jolt of surprise** — "it's the same compound that's in certain cheeses",
"the freezer does nothing" — and never manufactured outrage. Anger travels, but
a fabric-care brand generating anger is a brand with a different problem.

This is also why the X copy leads with the *mechanism* rather than the fix. On a
public timeline the sender is doing identity work (the 68% above): the payoff is
looking like someone who knows why a thing happens. On WhatsApp they're being
useful to one friend, so the fix leads.

---

## Where the shares actually happen

Roughly **84% of sharing happens in private channels** — WhatsApp, DMs, email,
groups — that carry no referrer, so analytics files them as "direct". In India
that channel is overwhelmingly WhatsApp.

That has two consequences and both are load-bearing:

1. **WhatsApp copy is the highest-value text on the page.** It is seen by more
   people than the article is, and it's the one surface where we control every
   character.
2. **You will not see it working in GA.** Traffic from a WhatsApp forward
   arrives as direct. Judge this by whether the copy reads like a human, not by
   waiting for a referrer report that will never populate.

---

## What cannot be templated — platform limits, not oversights

This is the part most "add share buttons" guides get wrong.

| Network | Pre-filled text? | Reality |
|---|---|---|
| **WhatsApp** | ✅ Full control | `wa.me/?text=` is one blob. We own every character. |
| **X** | ✅ Full control | `intent/tweet?text=&url=` — both honoured. |
| **Telegram** | ✅ Full control | `t.me/share/url?url=&text=` — both honoured. |
| **Facebook** | ❌ **Impossible** | `sharer.php` takes `u` only. The old `quote` param is dead and pre-filling a caption is against Meta's platform policy. |
| **LinkedIn** | ❌ **Impossible** | `/sharing/share-offsite/` takes `url` only. The older `shareArticle` `title`/`summary`/`source` params are deprecated and ignored. |

**For Facebook and LinkedIn the share template IS the Open Graph block.** The
card those two render is `og:title` + `og:description` + `og:image`, pulled live
from the page. If you want to change how a post looks when shared there, edit
the OG tags — there is no other lever, and any tool promising you one for
Facebook is either wrong or about to break.

Worth knowing alongside this: Meta discontinued the Facebook Like and Comment
social plugins on 10 February 2026. The share link still works; the surrounding
plugin ecosystem is being wound down.

---

## The rules the config enforces in code

`validateConfig()` throws rather than shipping a violation, because share copy is
seen by more people than the article and is the last place to be sloppy:

- **The full CLAUDE.md claims policy applies.** No "kills bacteria", no
  "permanently", no percentages, no skin claims, clothing only. Checked by regex.
- **X copy stays under 280** with the URL counted as **23 characters** — X counts
  every link as 23 regardless of real length, so the budget is 280 − 23 − 1.
- **Three or more hashtags fails.** One is a topic marker; three reads as spam.
- **Both `wa` and `x` are required** for any slug in the config.

Conventions that are not machine-checkable, so they live here:

- Sentence case. No title case, which reads as a headline again.
- At most one emoji, and only where a real person would use one. Emoji spray on
  a share line reads as automation, which is the opposite of the effect we want.
- `{url}` may be placed mid-sentence. WhatsApp honours the position; X and
  Telegram take the link in their own parameter, so `blog-share.js` strips the
  inline copy back out to avoid printing it twice.

---

## How it fits together

```
scripts/share/share-templates.config.mjs   copy for all 23 posts + validation
        │
        ▼
scripts/share/apply-share-templates.mjs    stamps <meta name="share:*"> between
        │                                  SF-SHARE:COPY markers (idempotent)
        ▼
blog/<slug>.html                           two meta tags in <head>
        │
        ▼
assets/js/blog-share.js                    reads them, builds the share URLs
```

A slug **missing** from the config is not an error — `blog-share.js` falls back
to the page title, which is what every post did before this existed. A slug in
the config with **no matching post** is an error, because it means copy was
written for a page that doesn't exist.

`npm run build` runs `--check`, so drift fails the build rather than shipping.

---

## Changing copy

1. Edit `wa` / `x` for the slug in the config.
2. `node scripts/share/apply-share-templates.mjs`
3. Commit the config **and** the stamped posts together.

**If you edit `assets/js/blog-share.js`, re-run `node scripts/apply-chrome.mjs`.**
That file is served `Cache-Control: immutable` for a year, so without a re-stamped
`?v=` content hash the change never reaches a returning visitor — the same trap
CLAUDE.md documents for the shared CSS layers.

---

## Sources

- Berger, J. & Milkman, K. *What Makes Online Content Viral?* Journal of
  Marketing Research, 2012. <https://journals.sagepub.com/doi/10.1509/jmr.10.0353>
- The New York Times Customer Insight Group. *The Psychology of Sharing: Why Do
  People Share Online?* (2,500 medium/heavy sharers).
  <https://www.slideshare.net/slideshow/why-do-peopleshareonline/27311627>
- Dark social share of total sharing (~84% via untracked private channels).
  <https://buffer.com/resources/dark-social/>
- Facebook pre-fill policy and `sharer.php` parameter deprecation.
  <https://developers.facebook.com/community/threads/2215109822081258/>
- Meta discontinuing the Like and Comment plugins, 10 Feb 2026.
  <https://alternativeto.net/news/2025/11/facebook-will-discontinue-its-external-like-and-comment-social-plugins-by-february-2026>
- LinkedIn share endpoints, and why `shareArticle` params no longer apply.
  <https://css-tricks.com/simple-social-sharing-links/>
- X Web Intents parameters (`text`, `url`, `via`, `hashtags`, `related`).
  <https://github.com/richhollis/twitter_web_intents>
