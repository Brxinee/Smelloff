/**
 * Per-post share copy — the text that lands in the recipient's app.
 *
 * WHY THIS EXISTS
 * Before this, every share on every post sent the page title and the URL. That
 * is a headline, and a headline is written to be clicked in a feed by a
 * stranger. A share is a different act: one person handing a thing to one other
 * person they know. The copy below is written for that second act.
 *
 * THE RESEARCH IT IS BUILT ON (full write-up in docs/SHARE-TEMPLATES.md)
 *
 * 1. Write for the RECIPIENT, not the audience. In the New York Times'
 *    "Psychology of Sharing" study of 2,500 heavy sharers, 94% said they
 *    carefully consider how useful the thing will be to the person receiving
 *    it. So each line below answers "why am I sending this to you" rather than
 *    restating what the article is called.
 *
 * 2. Practical utility and high-arousal emotion both travel; low-arousal does
 *    not. Berger & Milkman (Journal of Marketing Research, 2012) found awe,
 *    anger and anxiety raise transmission while sadness lowers it, controlling
 *    for usefulness — and that usefulness is independently positive. These are
 *    problem-solving posts, so the lever here is utility plus a small jolt of
 *    surprise ("it is the same compound as in cheese"), never outrage.
 *
 * 3. Sharing is identity work. 68% of the same NYT sample share to give people
 *    a sense of who they are. The X copy therefore leads with the mechanism —
 *    it lets the sender look like someone who knows why a thing happens. The
 *    WhatsApp copy leads with the fix, because there the sender is being
 *    useful to one friend, not performing for a timeline.
 *
 * 4. WhatsApp is the surface that matters here, not the public networks.
 *    Roughly 84% of sharing happens in private channels that referrers cannot
 *    see, and in India WhatsApp is that channel. It also happens to be one of
 *    only three destinations that still accept pre-filled text at all.
 *
 * WHAT CANNOT BE TEMPLATED — and this is a platform limit, not an omission:
 *   - Facebook: sharer.php takes `u` (the URL) only. Pre-filling the caption is
 *     against Meta's platform policy and the old `quote` parameter is dead.
 *   - LinkedIn: /sharing/share-offsite/ takes `url` only. The older
 *     shareArticle endpoint's title/summary params are deprecated and ignored.
 * For those two the share card IS og:title + og:description + og:image. If you
 * want to change how a post looks on Facebook or LinkedIn, edit the OG tags.
 *
 * HOUSE RULES
 *   - Everything in CLAUDE.md's claims policy applies here too. This copy is
 *     seen by more people than the article. No "kills bacteria", no
 *     "permanently", no percentages, no skin claims, clothing only.
 *   - `wa` and `x` may use {url}; if the token is absent the URL is appended.
 *   - Keep `x` under ~200 characters. The URL is counted as 23 by X regardless
 *     of its real length, and the whole thing has to sit inside 280.
 *   - No hashtag stuffing. One is a topic marker; three is a spam signal.
 *   - Sentence case, no emoji spray. One emoji maximum, and only where a real
 *     person would use it.
 */

export const POSTS = {
  /* ---- the 2026-08/09 series ---------------------------------------- */

  'damp-clothes-musty-smell-monsoon-fix': {
    wa: 'That musty smell in monsoon isn\'t the wash — it\'s clothes taking 8 hours to dry. Explains a lot, and there\'s a fix that isn\'t re-washing: {url}',
    x: 'The musty monsoon smell on clothes is 1-octen-3-ol and geosmin, produced while the fabric sits damp for hours. Re-washing in cold water makes it worse, and softener slows drying further.',
  },
  'how-often-to-wash-jeans-india': {
    wa: 'You were right, washing jeans every wear is wrecking them. Also the freezer trick does nothing — the smell comes straight back. Proper answer here: {url}',
    x: 'Denim forums say never wash. Your mother says every wear. Neither of them lives through an Indian summer. What washing actually does to indigo and fit, and why the freezer trick is a myth.',
  },
  'keep-clothes-fresh-while-travelling': {
    wa: 'For your trip — this is the packing thing I was talking about. Four shirts covers a week if you do one 90-second thing each night: {url}',
    x: 'Packing light only works if clothes survive a second wear. Which garments genuinely re-wear, why a suitcase makes everything worse by day four, and the end-of-day routine that makes it hold.',
  },
  'which-fabrics-hold-odor-most': {
    wa: 'This is why your polyester tee smells within minutes of putting it on and cotton doesn\'t. It\'s the fibre, not you: {url}',
    x: 'Polyester is oleophilic — it grips the skin lipids odor is produced from, and a cold wash doesn\'t dissolve them. Cotton absorbs far more sweat and gives up far more of it. Fibre by fibre.',
  },
  'remove-smell-from-blazer-without-dry-cleaning': {
    wa: 'Before you send the blazer to the cleaner again — the smell is in the lining, not the wool. Three zones and it\'s done: {url}',
    x: 'A blazer holds smoke and food smell in its lining, which is usually polyester, not in the wool outer. Which is why dry cleaning it every time is both expensive and hard on the cloth.',
  },
  'fabric-deodorizer-spray-india-guide-2026': {
    wa: 'If you\'re buying a fabric spray, read the five things that actually matter first. Written by a brand that sells one and says so up front: {url}',
    x: 'Masking adds a smell. Binding removes one. Almost every disappointment in the fabric-spray category comes from buying the first while expecting the second — and the ingredient list tells you which.',
  },

  /* ---- science and ingredients --------------------------------------- */

  'hpbcd-cyclodextrin-fabric-odor': {
    wa: 'The actual reason some sprays remove smell instead of covering it — the molecule gets trapped inside a ring and never reaches your nose: {url}',
    x: 'HPβCD is a sugar ring with a water-repelling cavity. Odor molecules are oily, they fit inside, and a molecule sitting in a ring is not travelling to your nose. That is binding, not masking.',
  },
  'beta-cyclodextrin-odor-removal-science': {
    wa: 'Cyclodextrin — this is the thing that traps odor on fabric rather than perfuming over it. Short read: {url}',
    x: 'Beta-cyclodextrin forms inclusion complexes with odor molecules on fabric. The mechanism is physical capture, not fragrance, which is why the smell doesn\'t return as the scent fades.',
  },
  'zinc-pca-fabric-odor-ingredient-guide': {
    wa: 'Zinc PCA — the second half of how fabric sprays work. Traps first, neutralises what\'s left: {url}',
    x: 'Zinc PCA neutralises odor compounds rather than trapping them, which is why a good fabric formula uses more than one mechanism. Odor is not one compound, so one active was never going to do it.',
  },
  'odorstrike-ingredients': {
    wa: 'Full ingredient list for ODORSTRIKE, including the three things deliberately left out and why each one failed: {url}',
    x: 'The whole ingredient list, in order, plus the three ingredients that were deliberately left out — glycerine among them, because on fabric a humectant leaves a tacky patch that then collects dust.',
  },
  'what-is-fabric-odor-eliminator': {
    wa: 'Turns out this is a third category — not deodorant, not perfume. Goes on the shirt, not on you: {url}',
    x: 'A fabric odor eliminator is a third spray: deodorant works on skin, perfume adds scent, this one works on the cloth. Confusing the three is why people buy the wrong thing and blame the category.',
  },

  /* ---- practical / how-to -------------------------------------------- */

  'gym-clothes-smell-after-washing': {
    wa: 'This is the gym clothes thing — they smell after washing because the wash never removed what causes it. Fix is a stripping wash: {url}',
    x: 'Gym clothes smell after washing because a cold cycle rinses away the odor compounds but leaves the skin lipids they are produced from. Body heat restarts the process from a head start.',
  },
  'does-fabric-spray-stain-clothes': {
    wa: 'Asked this before buying one — sprays mark when they carry oils, dyes or glycerine. Water-based ones dry clear. Fabric by fabric: {url}',
    x: 'Fabric sprays stain when they carry oils, dyes or a heavy fragrance load, because those are what stay on the fibre after the liquid goes. Water marks are an application problem, not a formula one.',
  },
  'how-to-use-odorstrike': {
    wa: 'Three zones, 15–20 cm, two light passes. Most people spray the whole garment and waste it: {url}',
    x: 'Inside collar, underarm panels, upper back. Those three carry most of what you smell, and spraying the rest of the garment achieves nothing except using the bottle faster.',
  },
  'wedding-festive-wear-odor-guide': {
    wa: 'For the function — sherwani and silk can\'t be washed, but there\'s a 30-second collar reset between events. Spot-test first though: {url}',
    x: 'Six-hour functions in Indian heat, in garments that cannot be washed. The pre-event routine, the mid-event collar reset, and which fabrics need a spot test before anything goes near them.',
  },
  'spray-to-remove-sweat-smell-from-clothes-instantly': {
    wa: 'For those days you realise at 4pm. Ten seconds on the collar and underarms and the shirt is wearable again: {url}',
    x: 'The 4pm problem: you don\'t smell, your shirt does, and you\'re nowhere near a change of clothes. What actually works on the fabric in the ten seconds you have.',
  },

  /* ---- comparisons and buyer intent ---------------------------------- */

  'odorstrike-vs-febreze-india': {
    wa: 'Febreze vs ODORSTRIKE, straight comparison — the honest difference is size, dry time and whether it masks or binds: {url}',
    x: 'Febreze and ODORSTRIKE solve different shapes of the same problem: a 370ml bottle for a room versus a 50ml one for the shirt you are wearing. Dry time is the difference people notice first.',
  },
  'ambi-pur-vs-odorstrike': {
    wa: 'Ambi Pur vs ODORSTRIKE on clothes specifically — not the same job as a room spray: {url}',
    x: 'A room and fabric spray and a pocket fabric mist are not competing products, they are answers to different questions. Which one you want depends on whether the problem is a room or a garment.',
  },
  'deodorant-vs-fabric-mist': {
    wa: 'Deodorant works on you, the smell is in the shirt. That\'s the whole thing, and it explains a lot: {url}',
    x: 'Deodorant treats skin. The smell you\'re noticing at 4pm is in the fabric, which the deodorant never touched. Two products, two surfaces — most people are only treating one of them.',
  },
  'best-deodorant-spray-for-clothes-not-skin': {
    wa: 'Five sprays for clothes compared. The one you want is whichever names a real odor active instead of just fragrance: {url}',
    x: 'Five clothing sprays compared. The single most useful filter: does the ingredient list name an odor active, or is it water, fragrance and preservative? One removes smell, the other adds one.',
  },
  'best-fabric-odor-spray-india-2026-body-odor': {
    wa: 'Fabric odor sprays in India, compared properly. Worth two minutes before you buy anything: {url}',
    x: 'Fabric odor sprays available in India, compared on the five things that decide whether one works: active chemistry, base, dry time, residue on dark fabric, and whether you can actually carry it.',
  },
  'odorstrike-review-30-day-india-test': {
    wa: 'Someone actually used it for 30 days in Indian summer and wrote up what happened, including what didn\'t work: {url}',
    x: 'Thirty days of ODORSTRIKE through an Indian summer, including the days it didn\'t hold and what was being asked of it when that happened. Long-run notes rather than a first-impression review.',
  },
  'why-i-built-odorstrike': {
    wa: 'The founder story behind ODORSTRIKE — started because deodorant kept solving the wrong half of the problem: {url}',
    x: 'Why I built a fabric odor spray: deodorant treats skin, and the smell everyone was actually noticing was in the shirt. Nobody in India was selling something you could carry for the second problem.',
  },

  /* ---- the 2026-08 strategy series ------------------------------------ */

  'remove-cooking-smell-from-clothes': {
    wa: 'Turns out kitchen smell lands on you as oil, not as air — which is exactly why airing the kurta on the balcony does nothing. Ten-minute fix: {url}',
    x: 'Cooking smell doesn\'t drift onto clothes, it lands on them. Hot oil throws a fine aerosol that settles as a film and holds the scent in place, which is why a shirt aired overnight still smells of dinner.',
  },
  'remove-smell-from-hoodie-without-washing': {
    wa: 'Your hoodie smells before it looks dirty because brushed fleece has a huge inner surface area. Also: stop washing it weekly, that\'s what flattens it: {url}',
    x: 'A hoodie is brushed fleece, which multiplies the inner surface area many times over, on a fibre that grips skin oils. It collects an enormous amount while looking exactly as clean as it did on day one.',
  },
  'keep-clothes-fresh-without-washing-machine': {
    wa: 'For the hostel situation — the clothes don\'t smell because they\'re dirty, they smell because nothing dries. Ninety-second nightly routine: {url}',
    x: 'Hostel clothes usually smell because of how long they took to dry, not how they were washed. Weekly laundry and a daily wardrobe is an arithmetic problem, and it is solved at night, not on laundry day.',
  },
  'remove-cigarette-smoke-smell-from-clothes': {
    wa: 'Why one evening out is still on the jacket three days later — smoke leaves residue that keeps releasing. Don\'t hang it in the wardrobe: {url}',
    x: 'A smoky shirt isn\'t holding a fixed amount of smell waiting to escape. It\'s a source, quietly emitting into whatever you hang it next to. Which is why one shirt becomes five.',
  },
  'remove-mothball-almirah-smell-from-clothes': {
    wa: 'Mothball smell survives washing because naphthalene goes solid straight to vapour and gets into every fold. Also stop putting the saree in the sun: {url}',
    x: 'Naphthalene sublimes — solid straight to vapour — so a closed almirah fills with it and it reaches every fold and seam. It\'s also barely water-soluble, which is why washing does so little.',
  },
  'keep-office-trousers-fresh-without-washing': {
    wa: 'Four zones on the inside of your formals carry almost all of it. Everyone responds by washing the whole trouser, which is what kills the waistband: {url}',
    x: 'Waistband, inner thigh seams, collar lining, cuffs. Four zones on the inside of formal wear produce nearly all the smell, and the standard response is to wash the entire garment every night.',
  },
};

/**
 * Enforces the limits above so a bad edit fails loudly at the top of a run
 * rather than shipping copy that gets truncated in someone's tweet composer or
 * trips the claims policy on the most-seen surface the brand has.
 */
export function validateConfig(posts = POSTS) {
  const errors = [];

  // Same list as CLAUDE.md's claims policy. Share copy is not exempt from it.
  const BANNED = /\b(permanently|eliminates forever|erases|100% safe|zero risk|completely safe|kills bacteria|antibacterial|antimicrobial|saniti[sz]|disinfect|sterili[sz]|inhibits microbial)/i;

  for (const [slug, t] of Object.entries(posts)) {
    if (!t.wa) errors.push(`${slug}: missing "wa"`);
    if (!t.x) errors.push(`${slug}: missing "x"`);

    for (const key of ['wa', 'x']) {
      const copy = t[key];
      if (!copy) continue;
      if (BANNED.test(copy)) {
        errors.push(`${slug}.${key}: banned claim — "${copy.match(BANNED)[0]}"`);
      }
      if (/#\w+.*#\w+.*#\w+/.test(copy)) {
        errors.push(`${slug}.${key}: three or more hashtags reads as spam`);
      }
    }

    // X counts any URL as 23 characters no matter its real length, so the
    // budget is 280 minus 23 minus the space that joins them.
    const xLen = t.x ? t.x.replace(/\{url\}/g, '').trim().length + 24 : 0;
    if (xLen > 280) errors.push(`${slug}.x: ${xLen}/280 characters once the URL is counted`);
  }

  if (errors.length) {
    throw new Error(`share-templates.config.mjs failed validation:\n  - ${errors.join('\n  - ')}`);
  }
  return posts;
}

export default POSTS;
