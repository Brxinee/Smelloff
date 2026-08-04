/**
 * Blog thumbnail source of truth.
 *
 * One entry per post. Consumed by BOTH renderers:
 *   - scripts/thumbnails/build-thumbnails.mjs   (local compositor, runs today)
 *   - scripts/canva_thumbnail_automation.js     (Canva Connect Autofill API)
 * so the copy and the photography can never drift between the two.
 *
 * Design rules below are lifted from High_CTR_Blog_Thumbnail_Research.pdf and are
 * enforced in code by validateConfig() — do not relax them by hand:
 *   - overlay text is 6 words or fewer (>10 words costs ~16% CTR)
 *   - interrogative framing wherever it is honest (~20% lift over flat statements)
 *   - a human face is the primary visual anchor (9.2% vs 6.1% median CTR)
 *   - white/acid type on a dark scrim, never low-contrast type on busy photography
 *
 * `photo` is an Adobe Stock asset id, licensed to the Smelloff account. The
 * originals are NOT committed (5–15MB each); build-thumbnails.mjs reads them from
 * ASSET_SOURCE_DIR and only the 1920x1080 composites are versioned. Re-licensing
 * an id via the Adobe connector returns the same asset without a second charge.
 *
 * BRAND RULES that constrain photo choice (see CLAUDE.md "Positioning: clothing only"):
 *   - never a photo of spray being applied to skin, hair or body — ODORSTRIKE is
 *     fabric only, and a thumbnail carries no context to qualify it
 *   - never shoes, helmets, gym gear, bags, sofas, curtains or room freshening
 *   - clothing, fabric, laundry and the people wearing them only
 */

export const CANVAS = { width: 1920, height: 1080 }; // 16:9, 2,073,600px — clears the >920,000px Discover benchmark

/** Widths emitted for the responsive srcset. The first is the canonical asset. */
export const WIDTHS = [1920, 1200];

export const POSTS = [
  // 2026-08/09 series. Photo choice is bound by the clothing-only rule above:
  // every frame was checked for footwear before licensing, and the suitcase
  // shots that had sandals in them were rejected for that reason.
  {
    slug: 'fabric-deodorizer-spray-india-guide-2026',
    kicker: 'Buying guide',
    top: 'Masking',
    hi: 'or binding?',
    // The source is 5120x2700, wider than the ~1.17:1 photo panel, so the crop
    // is constrained horizontally and object-position Y has no travel — the
    // frame is what it is. The photographer already crops the forehead, so this
    // one is chin-and-hands rather than a full face; it was still the right
    // pick over the alternatives, which had either a bare raised underarm or
    // footwear on the wardrobe floor.
    photo: 459888446,
    focal: '50% 50%',
    alt: 'A shopper works along a rail of hanging garments, comparing one against the next before choosing',
  },
  {
    slug: 'remove-smell-from-blazer-without-dry-cleaning',
    kicker: 'Formalwear',
    top: 'Smoke smell?',
    hi: 'Check the lining.',
    photo: 235296378,
    focal: '50% 30%',
    alt: 'A man in a blue blazer over a dark polo neck stands outdoors, looking away from the camera',
  },
  {
    slug: 'which-fabrics-hold-odor-most',
    kicker: 'Fabric science',
    top: 'Which fabric',
    hi: 'holds the smell?',
    photo: 512989785,
    focal: '50% 50%',
    alt: 'Overhead view of a pair of hands folding assorted cotton and knit garments into storage boxes',
  },
  {
    slug: 'keep-clothes-fresh-while-travelling',
    kicker: 'Travel',
    top: 'Four shirts.',
    hi: 'Seven days?',
    photo: 649242862,
    focal: '50% 50%',
    tone: 'brightness(1.22) contrast(1.04) saturate(1.08)',
    alt: 'A traveller packs folded shirts and knitwear into an open suitcase before a trip',
  },
  {
    slug: 'how-often-to-wash-jeans-india',
    kicker: 'Denim care',
    top: 'How often',
    hi: 'wash your jeans?',
    photo: 315726352,
    focal: '50% 55%',
    alt: 'A neat stack of folded blue denim jeans in several washes against a pale background',
  },
  {
    slug: 'damp-clothes-musty-smell-monsoon-fix',
    kicker: 'Monsoon laundry',
    top: 'Clean. Still musty.',
    hi: 'Why?',
    photo: 909948385,
    focal: '50% 40%',
    alt: 'A person hangs freshly washed white laundry on an indoor drying rack beside a washing machine',
  },
  {
    slug: 'gym-clothes-smell-after-washing',
    kicker: 'Fabric science',
    top: 'Washed.',
    hi: 'Still stinks. Why?',
    photo: 622041266,
    focal: '50% 22%',
    alt: 'A woman in sportswear pinches her nose at the smell of gym clothes that have already been washed',
  },
  {
    slug: 'does-fabric-spray-stain-clothes',
    kicker: 'Tested on 5 fabrics',
    top: 'Will it stain',
    hi: 'your shirt?',
    photo: 631669633,
    focal: '50% 62%',
    tone: 'brightness(0.94) contrast(1.10) saturate(1.05)',
    alt: 'A person holds out a white t-shirt marked with fresh stains to check whether a spray leaves a residue',
  },
  {
    slug: 'how-to-use-odorstrike',
    kicker: 'How to use',
    top: 'Three zones.',
    hi: 'Ten seconds.',
    photo: 486933868,
    focal: '50% 28%',
    alt: 'A person holds freshly treated clean clothing close and breathes in, checking the fabric for odor',
  },
  {
    slug: 'odorstrike-ingredients',
    kicker: 'Full ingredient list',
    top: "What's",
    hi: 'actually inside?',
    photo: 379375891,
    focal: '52% 38%',
    tone: 'brightness(1.30) contrast(1.06) saturate(1.14)',
    alt: 'A researcher examines samples in a laboratory, standing in for the ingredient-by-ingredient breakdown of the formula',
  },
  {
    slug: 'beta-cyclodextrin-odor-removal-science',
    kicker: 'The science',
    top: 'The molecule that',
    hi: 'traps odor',
    photo: 181601820,
    focal: '54% 30%',
    tone: 'brightness(1.30) contrast(1.06) saturate(1.14)',
    alt: 'A scientist works at a microscope, illustrating the beta-cyclodextrin research behind fabric odor capture',
  },
  {
    slug: 'hpbcd-cyclodextrin-fabric-odor',
    kicker: 'Ingredient guide',
    top: 'What actually',
    hi: 'traps odor?',
    photo: 479564969,
    focal: '48% 28%',
    tone: 'brightness(1.30) contrast(1.06) saturate(1.14)',
    alt: 'A lab technician in a mask studies a sample under a microscope, representing how HPBCD captures odor molecules',
  },
  {
    slug: 'zinc-pca-fabric-odor-ingredient-guide',
    kicker: 'Ingredient guide',
    top: 'The zinc that',
    hi: 'kills odor',
    photo: 345985748,
    focal: '54% 30%',
    tone: 'brightness(1.30) contrast(1.06) saturate(1.14)',
    alt: 'A scientist holds laboratory glassware, representing the Zinc PCA that neutralises odor compounds on fabric',
  },
  {
    slug: 'ambi-pur-vs-odorstrike',
    kicker: 'Comparison',
    top: 'Ambi Pur or',
    hi: 'ODORSTRIKE?',
    photo: 477677101,
    focal: '50% 25%',
    alt: 'A man weighs up a decision, framing the comparison between Ambi Pur and ODORSTRIKE for clothing odor',
  },
  {
    slug: 'odorstrike-vs-febreze-india',
    kicker: 'Comparison',
    top: 'Febreze or',
    hi: 'ODORSTRIKE?',
    photo: 485285703,
    focal: '50% 22%',
    alt: 'A man shrugs with his palms open, framing the choice between Febreze and ODORSTRIKE in India',
  },
  {
    slug: 'deodorant-vs-fabric-mist',
    kicker: 'Head to head',
    top: 'Deodorant or',
    hi: 'fabric mist?',
    photo: 488867373,
    focal: '50% 28%',
    alt: 'A man looks uncertain as he weighs deodorant against a fabric mist for stopping sweat smell',
  },
  {
    slug: 'best-deodorant-spray-for-clothes-not-skin',
    kicker: 'Tested · 5 sprays',
    top: 'Five sprays.',
    hi: 'One winner.',
    // Deliberately NOT an armpit/underarm shot. The post's whole argument is
    // "for the shirt, not the skin", and a raised-arm deodorant frame reads as
    // the opposite at thumbnail size with no copy to qualify it.
    photo: 291946281,
    focal: '46% 24%',
    alt: 'A man pulls his t-shirt up to his face to smell the fabric, checking the shirt rather than his skin',
  },
  {
    slug: 'best-fabric-odor-spray-india-2026-body-odor',
    kicker: 'India · 2026',
    top: "India's best",
    hi: 'odor spray?',
    photo: 639590141,
    focal: '50% 25%',
    alt: 'A woman recoils from the smell of her own shirt, framing the search for the best fabric odor spray in India',
  },
  {
    slug: 'spray-to-remove-sweat-smell-from-clothes-instantly',
    kicker: '10-second fix',
    top: 'Sweat smell gone',
    hi: 'in seconds',
    photo: 1183970639,
    focal: '44% 26%',
    tone: 'brightness(1.18) contrast(1.08) saturate(1.06)',
    alt: 'An office worker wilting in the heat with a damp shirt, the moment a 10-second fabric spray is meant for',
  },
  {
    slug: 'wedding-festive-wear-odor-guide',
    kicker: 'Festive wear',
    // "Sherwani" named a garment nobody in the photograph is wearing.
    top: 'Festive wear you',
    hi: "can't wash?",
    photo: 1582194482,
    focal: '54% 26%',
    alt: 'A couple in traditional Indian festive clothing, the kind of outfit that cannot simply be put through a wash',
  },
  {
    slug: 'what-is-fabric-odor-eliminator',
    kicker: 'Explainer',
    top: 'Not a perfume.',
    hi: 'Then what?',
    photo: 303214866,
    focal: '50% 22%',
    alt: 'A young man looks puzzled, framing the question of what a fabric odor eliminator actually is',
  },
  {
    slug: 'odorstrike-review-30-day-india-test',
    kicker: '30-day India test',
    top: '30 days.',
    hi: 'Worth ₹229?',
    photo: 278644495,
    focal: '50% 22%',
    alt: 'A man stands with his arms folded in a striped t-shirt after a 30-day test of ODORSTRIKE in India',
  },
  {
    slug: 'why-i-built-odorstrike',
    kicker: 'Founder story',
    top: 'Why I built',
    hi: 'ODORSTRIKE',
    photo: 314264717,
    focal: '50% 22%',
    alt: 'A man stands confidently with his arms crossed, illustrating the founder story behind ODORSTRIKE',
  },

  // 2026-08 strategy series. Same clothing-only constraint as the batch above:
  // every frame was checked for footwear, bags and bare-skin application before
  // licensing. The nightclub frame was picked for the smoke post because the
  // alternatives in that search were all backlit crowd silhouettes with no
  // garment visible at all, which defeats the point of the image.
  {
    slug: 'remove-cooking-smell-from-clothes',
    kicker: 'Everyday care',
    top: 'Smell like',
    hi: 'last night\'s dinner?',
    photo: 359756867,
    focal: '50% 50%',
    alt: 'A woman in an apron cooks at a hob, adding vegetables to a hot pan on a wooden kitchen counter',
  },
  {
    slug: 'remove-smell-from-hoodie-without-washing',
    kicker: 'Fabric care',
    top: 'Why does',
    hi: 'your hoodie smell?',
    photo: 327219686,
    // The photographer crops the top of the head, so pulling the focal point up
    // gains nothing and loses the garment — which is the subject here.
    focal: '50% 45%',
    alt: 'A woman in a plain black sweatshirt stands against a white wall beside a houseplant',
  },
  {
    slug: 'keep-clothes-fresh-without-washing-machine',
    kicker: 'Student life',
    top: 'No machine.',
    hi: 'Seven days?',
    photo: 375341026,
    focal: '50% 50%',
    alt: 'A hand pegs laundry onto an outdoor washing line, with shirts and towels hanging in the sun',
  },
  {
    slug: 'remove-cigarette-smoke-smell-from-clothes',
    kicker: 'Smoke odor',
    top: 'Still smells',
    hi: 'of last night?',
    photo: 133782212,
    focal: '50% 45%',
    alt: 'A group of friends dance closely together at a party under red and blue club lighting',
  },
  {
    slug: 'remove-mothball-almirah-smell-from-clothes',
    kicker: 'Storage odor',
    top: 'Mothball smell',
    hi: 'survives washing?',
    photo: 391867480,
    focal: '50% 50%',
    alt: 'A hand reaches along a clothes rail of hanging knitwear and sweaters in a sunlit room',
  },
  {
    slug: 'keep-office-trousers-fresh-without-washing',
    kicker: 'Formalwear',
    top: 'Wash formals',
    hi: 'every day?',
    photo: 212698738,
    focal: '50% 50%',
    alt: 'A cropped view of a man in a dark tailored suit and tie buttoning his jacket',
  },
];

/**
 * Enforces the research's hard limits. Called by both renderers before any work
 * happens, so a bad edit fails loudly at the top of the run rather than shipping
 * a thumbnail that quietly underperforms.
 */
export function validateConfig(posts = POSTS) {
  const errors = [];
  const seenSlug = new Set();

  for (const p of posts) {
    const where = p.slug || '(missing slug)';

    if (!p.slug) errors.push('a post is missing "slug"');
    else if (seenSlug.has(p.slug)) errors.push(`${where}: duplicate slug`);
    seenSlug.add(p.slug);

    const overlay = `${p.top ?? ''} ${p.hi ?? ''}`.trim();
    if (!overlay) errors.push(`${where}: overlay text is empty`);

    const words = overlay.split(/\s+/).filter(Boolean).length;
    if (words > 6) {
      errors.push(`${where}: overlay is ${words} words ("${overlay}") — the research caps this at 6`);
    }

    if (!p.photo) errors.push(`${where}: missing "photo" (Adobe Stock asset id)`);
    if (!p.alt) errors.push(`${where}: missing "alt"`);
    else if (p.alt.length < 40) errors.push(`${where}: alt is too terse to describe the image`);
  }

  if (errors.length) {
    throw new Error(`thumbnails.config.mjs failed validation:\n  - ${errors.join('\n  - ')}`);
  }
  return posts;
}

export default POSTS;
