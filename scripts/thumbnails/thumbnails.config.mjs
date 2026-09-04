/**
 * Smelloff blog visual system — source of truth.
 *
 * Photography-first. No overlay headlines. TEXT lives in HTML.
 * VISUAL is a real-life photograph (or a genuine science diagram used inline).
 *
 *   node scripts/thumbnails/build-thumbnails.mjs
 *   node scripts/thumbnails/apply-thumbnails.mjs
 *
 * `source` is a file in `.thumbnail-sources/` (generated editorial stills, or
 * a real ODORSTRIKE photograph). Original Adobe Stock ids are retired: Google
 * 2026 guidance prefers representative photographs over text-heavy cards, and
 * the overlay compositor is no longer the default renderer.
 */

export const CANVAS = { width: 1920, height: 1080 };

/** Widths emitted for the responsive srcset. The first is the canonical asset. */
export const WIDTHS = [1920, 1200];

/** Bump when encoded pixels change. `/blog/assets/*` is Cache-Control: immutable. */
export const CACHE_V = 5;

export function deliveryUrl(slug, ext, w) {
  const suffix = w && w !== WIDTHS[0] ? `@${w}` : '';
  return `/blog/assets/${slug}${suffix}.${ext}?v=${CACHE_V}`;
}

export function srcsetFor(slug, ext) {
  return WIDTHS.slice()
    .sort((a, b) => a - b)
    .map((w) => `${deliveryUrl(slug, ext, w)} ${w}w`)
    .join(', ');
}

export const FAMILIES = {
  'fabric-problems': 'Close fabric, collars, underarms, wear',
  laundry: 'Washing, drying, storage, humidity',
  'real-life': 'Office, commute, meeting, travel, evening',
  science: 'Fibres, mechanisms, comparisons',
  product: 'ODORSTRIKE in authentic clothing situations',
};

/**
 * One entry per published post. Extra index-only assets live in EXTRA_ASSETS.
 *
 * fit: 'cover' (default) or 'contain' (pad to 16:9 on #080808 — used for
 * portrait product photography so the 11cm bottle is not cropped into a giant).
 */
export const POSTS = [
  {
    slug: 'why-shirt-zones-smell-after-washing',
    family: 'fabric-problems',
    source: 'why-shirt-zones-smell-after-washing.jpg',
    focal: '50% 45%',
    alt: 'Close-up of a white office shirt on a hanger, inner collar band faintly yellowed and the underarm panel worn',
  },
  {
    slug: 'why-washing-machine-makes-clothes-smell',
    family: 'laundry',
    source: 'why-washing-machine-makes-clothes-smell.jpg',
    focal: '55% 50%',
    alt: 'Open front-loading washing machine in a compact Indian bathroom with a damp shirt hanging from the drum',
  },
  {
    slug: 'remove-incense-agarbatti-dhoop-smell',
    family: 'real-life',
    source: 'remove-incense-agarbatti-dhoop-smell.jpg',
    focal: '45% 50%',
    alt: 'Agarbatti smoke drifting past a hanging cotton kurta in a warm Indian living room',
  },
  {
    slug: 'remove-cooking-smell-from-clothes',
    family: 'real-life',
    source: 'remove-cooking-smell-from-clothes.jpg',
    focal: '40% 45%',
    alt: 'Tadka in a steel kadhai sending oil haze toward a pale office shirt hanging on a nearby chair',
  },
  {
    slug: 'why-traffic-fumes-cling-to-clothes',
    family: 'real-life',
    source: 'why-traffic-fumes-cling-to-clothes.jpg',
    focal: '55% 40%',
    alt: 'A formal shirt catching dust and exhaust haze inside an auto-rickshaw in Indian city traffic',
  },
  {
    slug: 'spray-to-remove-sweat-smell-from-clothes-quickly',
    family: 'real-life',
    source: 'spray-to-remove-sweat-smell-from-clothes-quickly.jpg',
    focal: '50% 40%',
    alt: 'Hands straightening a rumpled white office shirt in a washroom mirror before a meeting',
  },
  {
    slug: 'why-sweat-smells-stronger-on-some-shirts',
    family: 'fabric-problems',
    source: 'why-sweat-smells-stronger-on-some-shirts.jpg',
    focal: '50% 50%',
    alt: 'A glossy polyester gym tee hanging beside a matte cotton oxford, showing two very different fibre surfaces',
  },
  {
    slug: 'why-clothes-smell-in-wardrobe-even-when-clean',
    family: 'laundry',
    source: 'why-clothes-smell-in-wardrobe-even-when-clean.jpg',
    focal: '50% 50%',
    alt: 'Interior of a packed Indian wooden almirah with hanging formals in covers and folded stacks on the shelf',
  },
  {
    slug: 'damp-clothes-musty-smell-monsoon-fix',
    family: 'laundry',
    source: 'damp-clothes-musty-smell-monsoon-fix.jpg',
    focal: '50% 45%',
    alt: 'Still-damp shirts hanging on an indoor rack beside a rain-streaked window during monsoon',
  },
  {
    slug: 'why-water-makes-clothing-odor-louder',
    family: 'science',
    source: 'why-water-makes-clothing-odor-louder.jpg',
    focal: '50% 50%',
    alt: 'Macro of dark cotton fabric with water droplets soaking into the weave',
  },
  {
    slug: 'keep-clothes-fresh-without-washing-machine',
    family: 'laundry',
    source: 'keep-clothes-fresh-without-washing-machine.jpg',
    focal: '50% 55%',
    alt: 'A hostel room with a bucket wash, a wrung shirt on a chair, and clothes hanging from a wall rope',
  },
  {
    slug: 'remove-cigarette-smoke-smell-from-clothes',
    family: 'real-life',
    source: 'remove-cigarette-smoke-smell-from-clothes.jpg',
    focal: '50% 40%',
    alt: 'A dark jacket hanging on an Indian apartment balcony at night with city lights behind it',
  },
  {
    slug: 'keep-office-trousers-fresh-without-washing',
    family: 'real-life',
    source: 'keep-office-trousers-fresh-without-washing.jpg',
    focal: '50% 45%',
    alt: 'Navy tailored office trousers hanging beside a belt and a worn commuter shirt at the end of the day',
  },
  {
    slug: 'keep-clothes-fresh-while-travelling',
    family: 'real-life',
    source: 'keep-clothes-fresh-while-travelling.jpg',
    focal: '50% 55%',
    alt: 'Open suitcase on a hotel bed with folded shirts and a worn one kept separate in a bag',
  },
  {
    slug: 'how-to-pack-sweaty-clothes-without-bag-smell',
    family: 'real-life',
    source: 'how-to-pack-sweaty-clothes-without-bag-smell.jpg',
    focal: '50% 50%',
    alt: 'A damp gym t-shirt being rolled into a separate wet bag on a locker-room bench',
  },
  {
    slug: 'wedding-festive-wear-odor-guide',
    family: 'real-life',
    source: 'wedding-festive-wear-odor-guide.jpg',
    focal: '50% 40%',
    alt: 'An embroidered festive sherwani hanging in a dark bedroom with marigolds on a nearby chair',
  },
  {
    slug: 'why-clothes-smell-stale-in-ac-room',
    family: 'laundry',
    source: 'why-clothes-smell-stale-in-ac-room.jpg',
    focal: '50% 45%',
    alt: 'A pale shirt hanging motionless in a closed air-conditioned Indian bedroom',
  },
  {
    slug: 'vinegar-baking-soda-fabric-softener',
    family: 'laundry',
    source: 'vinegar-baking-soda-fabric-softener.jpg',
    focal: '50% 50%',
    alt: 'Vinegar, baking soda and fabric softener on a dark counter beside a crumpled grey t-shirt',
  },
  {
    slug: 'how-often-to-wash-jeans-india',
    family: 'fabric-problems',
    source: 'how-often-to-wash-jeans-india.jpg',
    focal: '50% 45%',
    alt: 'A worn pair of indigo jeans hanging from a hook, waistband and coin pocket in focus',
  },
  {
    slug: 'deodorant-perfume-on-fabric',
    family: 'fabric-problems',
    source: 'deodorant-perfume-on-fabric.jpg',
    focal: '55% 45%',
    alt: 'A deodorant stick and perfume bottle on a bathroom shelf with a sweat-damp office shirt hanging behind them',
  },
  {
    slug: 'how-odor-neutralizer-works-on-fabric',
    family: 'science',
    source: 'how-odor-neutralizer-works-on-fabric.jpg',
    focal: '50% 50%',
    alt: 'Fine mist droplets settling into the weave of a dark shirt, the contact surface where odor control actually happens',
  },
  {
    slug: 'how-to-freshen-clothes-stored-for-months',
    family: 'laundry',
    source: 'how-to-freshen-clothes-stored-for-months.jpg',
    focal: '50% 55%',
    alt: 'Hands lifting folded winter clothes from a stored steel trunk in a dim Indian storeroom',
  },
  {
    slug: 'wash-refresh-or-wear',
    family: 'real-life',
    source: 'wash-refresh-or-wear.jpg',
    focal: '50% 45%',
    alt: 'Three garments in one bedroom: one in a hamper, one airing on a chair, one being worn toward the door',
  },
  {
    slug: 'why-body-odor-comes-back-on-clothes-so-quickly',
    family: 'fabric-problems',
    source: 'why-body-odor-comes-back-on-clothes-so-quickly.jpg',
    focal: '50% 35%',
    alt: 'A once-crisp white shirt in a humid Indian office, collar open and the underarm panel darkened after a few hours',
  },
  {
    slug: 'why-clean-shirt-starts-smelling-within-hours',
    family: 'fabric-problems',
    source: 'why-clean-shirt-starts-smelling-within-hours.jpg',
    focal: '50% 40%',
    alt: 'A freshly ironed white shirt on a hanger in humid morning light, already slightly limp before it is worn',
  },
  {
    slug: 'why-clothes-smell-bad-after-drying',
    family: 'laundry',
    source: 'why-clothes-smell-bad-after-drying.jpg',
    focal: '50% 45%',
    alt: 'Washed clothes hanging limp on an indoor rack in a dim hallway with no sun, still faintly sour',
  },
  {
    slug: 'why-clothes-smell-bad-again-after-sweating',
    family: 'fabric-problems',
    source: 'why-clothes-smell-bad-again-after-sweating.jpg',
    focal: '50% 40%',
    alt: 'A cotton shirt clinging at the chest and underarm in a doorway after a humid walk',
  },
  {
    slug: 'why-clothes-smell-musty-after-being-stored',
    family: 'laundry',
    source: 'why-clothes-smell-musty-after-being-stored.jpg',
    focal: '50% 50%',
    alt: 'Folded clothes stacked on a plastic-covered almirah shelf, grey at the folds from closed storage',
  },
  {
    slug: 'which-fabrics-hold-odor-most',
    family: 'science',
    source: 'which-fabrics-hold-odor-most.jpg',
    focal: '50% 50%',
    alt: 'Overhead still life of cotton, polyester, denim, wool and silk swatches on dark wood',
  },
  {
    slug: 'gym-clothes-smell-after-washing',
    family: 'laundry',
    source: 'gym-clothes-smell-after-washing.jpg',
    focal: '50% 50%',
    alt: 'A washed black polyester gym t-shirt sitting damp in a laundry basket',
  },
  {
    slug: 'does-fabric-spray-stain-clothes',
    family: 'product',
    source: 'does-fabric-spray-stain-clothes.jpg',
    focal: '50% 50%',
    alt: 'A white cotton t-shirt on a dark table with a small wet mist patch being checked for a drying ring',
  },
  {
    slug: 'how-to-use-odorstrike',
    family: 'product',
    source: 'how-to-use-odorstrike.webp',
    fit: 'contain',
    focal: '50% 50%',
    alt: 'ODORSTRIKE 50ml being misted onto a shirt collar — fabric only, bottle at real pocket scale',
  },
  {
    slug: 'odorstrike-review-30-day-india-test',
    family: 'product',
    source: 'odorstrike-review-30-day-india-test.jpg',
    focal: '50% 50%',
    alt: 'Four test garments in a row: office cotton, gym polyester, indigo jeans and festive wear',
  },
  {
    slug: 'why-i-built-odorstrike',
    family: 'real-life',
    source: 'why-i-built-odorstrike.jpg',
    focal: '50% 40%',
    alt: 'A formal shirt in the back of a hot Indian cab, collar damp from a long un-air-conditioned ride',
  },
  {
    slug: 'fabric-deodorizer-spray-india-guide-2026',
    family: 'real-life',
    source: 'fabric-deodorizer-spray-india-guide-2026.jpg',
    focal: '50% 45%',
    alt: 'Hands comparing two hanging shirts on a clothing rail in a small Indian shop',
  },
  {
    slug: 'ambi-pur-vs-odorstrike',
    family: 'real-life',
    source: 'ambi-pur-vs-odorstrike.jpg',
    focal: '50% 50%',
    alt: 'A large room-freshener aerosol aimed at empty air beside a crumpled office shirt that actually holds the smell',
  },
  {
    slug: 'why-polyester-holds-odor-longer-than-cotton',
    family: 'science',
    source: 'why-polyester-holds-odor-longer-than-cotton.jpg',
    focal: '50% 50%',
    alt: 'Macro of polyester knit fibres with an oily sheen next to a more matte cotton weave',
  },
  {
    slug: 'dry-air-clothes-indian-home',
    family: 'laundry',
    source: 'dry-air-clothes-indian-home.jpg',
    focal: '50% 40%',
    alt: 'A ceiling fan above an indoor clothes horse of shirts in a tiled Indian hallway',
  },
  {
    slug: 'remove-mothball-almirah-smell-from-clothes',
    family: 'laundry',
    source: 'remove-mothball-almirah-smell-from-clothes.jpg',
    focal: '50% 55%',
    alt: 'White mothballs in a steel katori on a wooden almirah shelf beside folded woolens',
  },
  {
    slug: 'odorstrike-vs-febreze-india',
    family: 'real-life',
    source: 'odorstrike-vs-febreze-india.jpg',
    focal: '50% 45%',
    alt: 'A living-room air-freshener can on a table while a hanging shirt by the window holds the actual odor',
  },
  {
    slug: 'deodorant-vs-fabric-mist',
    family: 'fabric-problems',
    source: 'deodorant-vs-fabric-mist.jpg',
    focal: '50% 40%',
    alt: 'A man lifting a white t-shirt to his face to smell the fabric rather than his skin',
  },
  {
    slug: 'zinc-pca-fabric-odor-ingredient-guide',
    family: 'science',
    source: 'zinc-pca-fabric-odor-ingredient-guide.jpg',
    focal: '50% 50%',
    alt: 'Zinc-coloured mineral crystal and a clear solution in a beaker beside a folded cotton swatch',
  },
  {
    slug: 'odor-on-clothes-vs-odor-in-clothes',
    family: 'science',
    source: 'odor-on-clothes-vs-odor-in-clothes.jpg',
    focal: '50% 50%',
    alt: 'A white shirt folded back so the clean outer chest and the soiled inner collar band are both visible',
  },
  {
    slug: 'hpbcd-cyclodextrin-fabric-odor',
    family: 'science',
    source: 'hpbcd-cyclodextrin-fabric-odor.jpg',
    focal: '50% 50%',
    alt: 'Ring-shaped laboratory glass on dark slate beside a cotton swatch, standing in for a cyclodextrin trap',
  },
  {
    slug: 'odorstrike-ingredients',
    family: 'product',
    source: 'odorstrike-ingredients.webp',
    fit: 'contain',
    focal: '50% 50%',
    alt: 'The real ODORSTRIKE 50ml bottle on dark stone, photographed at true pocket scale',
  },
  {
    slug: 'what-is-fabric-odor-eliminator',
    family: 'product',
    source: 'what-is-fabric-odor-eliminator.webp',
    focal: '50% 50%',
    alt: 'ODORSTRIKE 50ml lying with a shirt, wallet and keys, showing pocket scale next to everyday objects',
  },
  {
    slug: 'best-deodorant-spray-for-clothes-not-skin',
    family: 'fabric-problems',
    source: 'best-deodorant-spray-for-clothes-not-skin.jpg',
    focal: '50% 50%',
    alt: 'A pale office shirt laid collar-up on a dark desk so the inside collar and both underarm panels are visible',
  },
  {
    slug: 'best-fabric-odor-spray-india-2026-body-odor',
    family: 'real-life',
    source: 'best-fabric-odor-spray-india-2026-body-odor.jpg',
    focal: '55% 40%',
    alt: 'A pale formal shirt on a motorbike in Indian summer traffic, fabric darkened with heat and city dust',
  },
];

/** Index-only photography (cards that currently have assets but no HTML guide). */
export const EXTRA_ASSETS = [
  {
    slug: 'remove-smell-from-hoodie-without-washing',
    family: 'fabric-problems',
    source: 'remove-smell-from-hoodie-without-washing.jpg',
    focal: '50% 50%',
    alt: 'A charcoal hoodie turned inside-out, showing the large brushed-fleece inner surface that holds odor',
  },
  {
    slug: 'remove-smell-from-blazer-without-dry-cleaning',
    family: 'real-life',
    source: 'remove-smell-from-blazer-without-dry-cleaning.jpg',
    focal: '50% 40%',
    alt: 'A navy blazer hanging on a wooden valet after an evening out, lining slightly open',
  },
];

export function validateConfig(posts = POSTS) {
  const errors = [];
  const seenSlug = new Set();

  for (const p of posts) {
    const where = p.slug || '(missing slug)';
    if (!p.slug) errors.push('a post is missing "slug"');
    else if (seenSlug.has(p.slug)) errors.push(`${where}: duplicate slug`);
    seenSlug.add(p.slug);

    if (p.top || p.hi || p.kicker) {
      errors.push(`${where}: overlay copy is forbidden — text belongs in HTML, not in the image`);
    }
    if (!p.source) errors.push(`${where}: missing "source"`);
    if (!p.family || !FAMILIES[p.family]) errors.push(`${where}: missing or unknown family`);
    if (!p.alt) errors.push(`${where}: missing "alt"`);
    else if (p.alt.length < 40) errors.push(`${where}: alt is too terse to describe the image`);
    else if (/\bbest fabric odor spray india\b/i.test(p.alt)) {
      errors.push(`${where}: alt looks keyword-stuffed`);
    }
  }

  if (errors.length) {
    throw new Error(`thumbnails.config.mjs failed validation:\n  - ${errors.join('\n  - ')}`);
  }
  return posts;
}

export default POSTS;
