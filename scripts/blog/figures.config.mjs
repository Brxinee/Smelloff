/**
 * In-article figures, one entry per post: a photo and a diagram.
 * Rendered by scripts/blog/apply-figures.mjs (photos built by
 * build-figure-photos.mjs). Owner: "photos or diagrams in the blogs, for
 * engagement" (2026-10-18).
 *
 *   kind: 'photo'   pexels: <id> | file: 'assets/photos/…'  focal, alt, caption
 *   kind: 'diagram' type: steps | compare | zones | timeline | stats | scale
 *                         | decide | bars        (see apply-figures.mjs)
 *   after: the <h2> id (or a prefix of it) whose first paragraph it follows.
 *
 * Rules:
 *  - Diagram copy restates the post. Product facts only from
 *    config/product.json: 50ml, about 250 sprays / 100 refreshes, dries in
 *    15–30 s, up to 8 hours on fabric, ₹229 / 2 for ₹419, fabric only.
 *    test/claims-consistency.test.mjs scans the stamped HTML.
 *  - Photos follow the clothing-only rule: no spray on skin, no shoes,
 *    helmets, bags or gym gear in frame. Pexels licence: free commercial
 *    use, no attribution; no identifiable person shown in a bad light, so a
 *    caption describes the situation, never the person's smell.
 */

/** Bump when any inline photo's pixels change (/assets is immutable). */
export const PHOTO_V = 1;

const photo = (after, src, alt, caption, focal = '50% 50%') => ({
  kind: 'photo', after, ...(typeof src === 'number' ? { pexels: src } : { file: src }), alt, caption, focal,
});
const dia = (after, type, rest) => ({ kind: 'diagram', after, type, ...rest });

const SHIRT_ZONES = [
  { zone: 'collar', label: 'Inside collar', text: 'Neck oil and sweat build a band here every wear.' },
  { zone: 'underarms', label: 'Underarm panels', text: 'The warmest, wettest fabric on the shirt.' },
  { zone: 'upper back', text: 'Between the shoulder blades, pressed against a chair or seat.' },
];

export const FIGURES = {
  'alternative-to-deodorant-for-clothes-smell': [
    photo('what-counts-as-a-true-alternative', 7695498,
      'Close-up of a man fastening the top button of a white shirt',
      'The skin product goes on before the shirt. The shirt needs its own fix.', '50% 40%'),
    dia('when-you-still-need-deodorant', 'compare', {
      kicker: 'Two jobs', title: 'Deodorant and a fabric mist do different work',
      cols: [
        { name: 'Deodorant', tag: 'Skin', lines: ['Goes on clean, dry underarms', 'Controls skin odor and, as antiperspirant, wetness', 'Cannot reach odor already in the shirt'] },
        { name: 'Fabric odor mist', tag: 'Clothes', pick: true, lines: ['Goes on the fabric, never on skin', 'Works on odor held in collar, underarms and back', 'Does not replace washing'] },
      ],
      note: 'Use both: deodorant on skin in the morning, a fabric mist on the shirt.',
    }),
  ],

  'ambi-pur-vs-odorstrike': [
    photo('what-is-ambi-pur-built-for', 6480707,
      'A bright living room with a leather sofa, cushions and long curtains',
      'Sofas, curtains and car seats: the surfaces a home fabric refresher is made for.'),
    dia('how-do-they-compare-head-to-head', 'compare', {
      kicker: 'Head to head', title: 'Home refresher or pocket clothing mist?',
      cols: [
        { name: 'Ambi Pur fabric spray', tag: 'Home', lines: ['Large bottle that stays at home', 'Fragrance-forward, for furnishings', 'Sofas, curtains, mattresses, car interiors'] },
        { name: 'ODORSTRIKE', tag: 'Clothes', pick: true, lines: ['50ml, fits a pocket', 'Light scent that fades', 'Shirts and other clothes, before or between wears'] },
      ],
    }),
  ],

  'are-fabric-sprays-safe-label-check-india': [
    photo('what-claims-should-make-you-suspicious', 'assets/photos/pdp-size-in-hand.webp',
      'A hand holds the ODORSTRIKE bottle beside a phone, its label facing the camera',
      'Turn the bottle over. What it does, and who made it, should be there in plain words.'),
    dia('what-must-a-fabric-spray-label-show-in-india', 'decide', {
      kicker: 'Label check', title: 'Read the back before you buy',
      rows: [
        ['Maker or marketer’s name and address', 'Must show', 'ok'],
        ['Net quantity and MRP', 'Must show', 'ok'],
        ['Consumer care contact', 'Must show', 'ok'],
        ['Kills 99.9% of germs, medical cures', 'Be suspicious', 'stop'],
        ['Named active ingredient for odor', 'Good sign', 'refresh'],
        ['“For fabric only, not skin” in the directions', 'Good sign', 'refresh'],
      ],
      note: 'Packaged goods in India fall under the Legal Metrology (Packaged Commodities) Rules, 2011.',
    }),
  ],

  'attar-on-clothes-vs-fabric-odor-spray': [
    photo('what-is-attar-and-why', 5206892,
      'Shelves of small glass perfume and attar bottles lit from behind',
      'Attar is fragrance carried in oil, so it evaporates slowly and clings to cloth.', '50% 40%'),
    dia('how-do-you-wear-attar-on-a-shirt', 'steps', {
      kicker: 'Order matters', title: 'Neutralise first, scent second',
      items: [
        ['Clear the odor', 'Treat collar, underarms and back with a fabric odor mist.'],
        ['Let it dry', 'Wait until the fabric is fully dry.'],
        ['Add attar', 'A small amount on a clean spot, or on the lining of festive wear.'],
        ['Air if you can', 'Ten minutes in moving air settles it.'],
      ],
      note: 'Attar is an oil and can mark light silk, chiffon and polyester. Test a hidden spot.',
    }),
  ],

  'best-body-odor-remover-spray-for-men-india': [
    photo('what-a-real-men-s-body-odor-spray', 7580640,
      'A smiling man in a light blue office shirt presents to colleagues',
      'An office day: AC, a commute and a shirt that has to last till evening.', '50% 30%'),
    dia('the-use-case-playbook', 'timeline', {
      kicker: 'Office day', title: 'Where each product goes in the day',
      items: [
        ['Morning', 'Deodorant on dry skin. Fabric mist on the shirt before you wear it.'],
        ['Commute', 'Ride or travel with the shirt as dry as you can keep it.'],
        ['After lunch', 'Mid-day reset: collar, underarm fabric, upper back.'],
        ['Evening', 'Hang the shirt open the moment you change.'],
      ],
    }),
  ],

  'best-deodorant-spray-for-clothes-not-skin': [
    photo('what-a-clothes-only-spray-should-do', 7755387,
      'A tight row of colourful polo shirts hanging on a rail',
      'A clothes spray is judged on fabric, not skin.'),
    dia('how-to-use-a-clothes-deodorant-spray-right', 'zones', {
      kicker: 'Where to spray', title: 'Three zones do most of the work', garment: 'shirt',
      zones: SHIRT_ZONES,
      note: 'Hold 15–20 cm away, 2–3 light sprays per zone, let it dry 15–30 seconds.',
    }),
  ],

  'best-fabric-odor-spray-india-2026-body-odor': [
    photo('the-five-things-i-would-check', 4440574,
      'A person holds a neat stack of folded clothes against their chest',
      'Clean, folded and still at risk of smelling after one warm wear.', '50% 45%'),
    dia('fabric-odor-spray-vs-perfume-vs-body-deodorant', 'compare', {
      kicker: 'Different jobs', title: 'Fabric spray, perfume or body deodorant?',
      cols: [
        { name: 'Body deodorant', tag: 'Skin', lines: ['Applied to the body', 'Manages skin odor', 'Not made for fabric'] },
        { name: 'Perfume / cologne', tag: 'Scent', lines: ['Adds a fragrance', 'Can mask for a while', 'Sweat smell can return under it'] },
        { name: 'Fabric odor spray', tag: 'Clothes', pick: true, lines: ['Made for fabric', 'Works on odor held in the cloth', 'Light scent, if any'] },
      ],
    }),
  ],

  'bike-commute-sweat-smell-office': [
    photo('why-does-a-two-wheeler-commute', 'assets/photos/pdp-commute-collar.webp',
      'A commuter tugs at the collar of his black shirt on a crowded train',
      'Heat, traffic and a pressed-on back: the commute does more to a shirt than the office.', '50% 35%'),
    dia('what-is-the-5-minute-reset', 'steps', {
      kicker: 'At the office door', title: 'The 5-minute reset, in order',
      items: [
        ['Cool down', 'Two or three minutes in AC or shade.'],
        ['Dry off', 'Dab neck, back and underarms with a towel.'],
        ['Change', 'Swap the riding layer or vest for the office shirt.'],
        ['Treat', 'Mist collar, underarm fabric and upper back.'],
        ['Let it dry', '15–30 seconds before you sit down.'],
      ],
      note: 'Spraying a shirt you are still sweating into is wasted effort. Cool down first.',
    }),
  ],

  'clothes-perfume-spray-vs-fabric-odor-spray': [
    photo('what-does-a-clothes-perfume-spray', 31707005,
      'A hand presses a small perfume atomiser, a fine mist against a dark background',
      'A clothes perfume puts fragrance on the fabric. The sweat underneath stays.'),
    dia('how-can-you-tell-them-apart', 'compare', {
      kicker: 'Read the verbs', title: 'How to tell them apart on the label',
      cols: [
        { name: 'Clothes perfume spray', tag: 'Adds a smell', lines: ['“Long-lasting fragrance”, “luxury scent”', 'Sold by its notes: oud, aqua, citrus woody', 'Fragrance is the main ingredient'] },
        { name: 'Fabric odor spray', tag: 'Removes a smell', pick: true, lines: ['“Neutralises”, “traps odor”, “odor control”', 'Named actives: cyclodextrin (HPβCD), zinc compounds', 'Light scent, if any'] },
      ],
      note: 'Buy by the problem: a smell you want to add, or a smell you want gone.',
    }),
  ],

  'damp-clothes-musty-smell-monsoon-fix': [
    photo('why-is-indoor-drying-in-high-humidity', 16673332,
      'Rain streaks a tall gridded window with wet green trees outside',
      'When the air outside is already wet, laundry inside has nowhere to put its water.'),
    dia('a-monsoon-routine', 'steps', {
      kicker: 'Monsoon routine', title: 'Five habits that shorten the wet window',
      items: [
        ['Hang at once', 'Within minutes of the cycle ending, not after dinner.'],
        ['Space it out', 'Overlapping clothes dry as one thick item.'],
        ['Fan on the rack', 'Moving air beats warm, still air.'],
        ['Skip softener', 'Through the wet months it works against you.'],
        ['Door open', 'Let the drum and gasket dry between loads.'],
      ],
      note: 'Then treat only what you are about to wear: collar, underarms, upper back.',
    }),
  ],

  'deodorant-perfume-on-fabric': [
    photo('alcohol-is-a-flash-not-a-fix', 20594351,
      'A hand holds up an aerosol can spraying a plume against a blue sky',
      'The alcohol in an aerosol throws fragrance into the air, then leaves.'),
    dia('the-emergency-is-not-spray-more', 'steps', {
      kicker: 'Four minutes', title: 'The emergency is not “spray more”',
      items: [
        ['Stop spraying', 'Put the deodorant and the perfume down.'],
        ['Get air in', 'Unbutton and pull the shirt off your skin.'],
        ['Dry it', 'Moving air or a dry towel on the wet zones.'],
        ['Treat cloth as cloth', 'A fabric odor mist on dry collar and underarm fabric.'],
      ],
      note: 'Deodorant goes on skin. A second coat on the shirt is how a stain and a smell mash end up in the same panel.',
    }),
  ],

  'deodorant-vs-fabric-mist': [
    photo('what-a-fabric-mist-is-actually-for', 9899486,
      'A man in a white shirt adjusts his collar in front of a mirror',
      'Two surfaces: the skin under the shirt, and the shirt itself.', '50% 30%'),
    dia('what-a-good-fabric-routine-looks-like', 'timeline', {
      kicker: 'A good routine', title: 'Skin in the morning, cloth through the day',
      items: [
        ['Morning', 'Shower. Deodorant on clean, dry skin. Clean shirt on.'],
        ['Before you leave', 'Mist the shirt per its directions, if you want an extra layer.'],
        ['Mid-day', 'Reset collar and underarm fabric after the commute or lunch.'],
        ['Night', 'Hang the shirt open; wash it when it needs washing.'],
      ],
    }),
  ],

  'does-fabric-spray-stain-clothes': [
    photo('why-the-odorstrike-carrier', 6276008,
      'A crisp white cotton shirt laid flat, its pocket and buttons in sharp detail',
      'Stains come from what stays on the fibre after the liquid has gone.', '50% 40%'),
    dia('how-to-spray-so-you-never-get-a-water-mark', 'decide', {
      kicker: 'No water marks', title: 'Distance and movement, not quantity',
      rows: [
        ['15–20 cm from the fabric, hand moving', 'Do this', 'refresh'],
        ['2–3 light passes per zone', 'Do this', 'refresh'],
        ['Closer than 15 cm, bottle held still', 'Wet patch', 'stop'],
        ['Silk, wool, zari, heavy embroidery', 'Spot-test first', 'air'],
        ['Anything labelled dry-clean only', 'Spot-test first', 'air'],
      ],
      note: 'ODORSTRIKE is a fast-drying water base with no oils, dyes or glycerine. It dries clear in 15–30 seconds.',
    }),
  ],

  'does-food-change-sweat-smell-garlic-methi': [
    photo('does-methi-fenugreek-make-sweat-smell', 32144888,
      'A ring of whole spices, seeds and garlic cloves arranged on a dark surface',
      'Garlic, onion and methi can show up in sweat. Kitchen smoke on your shirt is usually the bigger source.'),
    dia('so-why-does-your-shirt-smell-after-a-meal', 'compare', {
      kicker: 'Where the smell comes from', title: 'Usually where you ate, not what you ate',
      cols: [
        { name: 'Food in sweat', tag: 'Smaller source', lines: ['Sulphur compounds from garlic and onion', 'Sotolon from methi, a maple-like note', 'Fades as your body clears it'] },
        { name: 'Smoke on fabric', tag: 'Bigger source', pick: true, lines: ['Tadka, frying and tandoor smoke', 'Settles straight onto the shirt front', 'Air it, then treat the fabric'] },
        { name: 'Ordinary body odor', tag: 'Every day', lines: ['Skin bacteria breaking down sweat', 'Builds at collar, underarms, back', 'Same, whatever you ate'] },
      ],
    }),
  ],

  'does-ironing-remove-smell-from-clothes': [
    photo('does-a-garment-steamer-remove-odor', 9594948,
      'A handheld garment steamer passes over a sage-green shirt on a hanger',
      'Steam lifts a little odor with it, and adds moisture the shirt then has to lose.', '50% 40%'),
    dia('what-is-the-right-order', 'steps', {
      kicker: 'Right order', title: 'Treat, dry, then iron',
      items: [
        ['Sniff', 'Collar, underarms and upper back. A mark or sour smell means wash.'],
        ['Mist', '2–3 sprays per zone from 15–20 cm, 4–5 for a full shirt.'],
        ['Let it dry', '15–30 seconds, longer on thick cotton or in humid weather.'],
        ['Iron', 'As usual, on the setting the label allows.'],
      ],
      note: 'Ironing over damp spray just steams it off before it has done its job.',
    }),
  ],

  'dry-air-clothes-indian-home': [
    photo('spacing-so-the-pits-do-not-overlap', 10565663,
      'Hands spread a damp white shirt along the bars of a folding drying rack',
      'A finger of air at the chest and underarms, not only at the hem.', '50% 45%'),
    dia('the-indoor-drying-protocol', 'steps', {
      kicker: 'Spin cycle to almirah', title: 'The indoor drying protocol',
      items: [
        ['Empty at once', 'Hang within minutes, not after dinner.'],
        ['Shake and hang', 'Shirts on hangers, inside out for the underarm panels.'],
        ['Space it', 'If the rod is full, split the load.'],
        ['Move the air', 'Ceiling or pedestal fan across the hangers.'],
        ['Dry to the seam', 'Collar band, underarms and waistbands dry last. Check them.'],
      ],
    }),
  ],

  'fabric-deodorizer-spray-india-guide-2026': [
    photo('masking-versus-binding', 10557498,
      'A hand reaches into a caddy of plain spray bottles on a white counter',
      'Most disappointment in this category comes from buying a masking product and expecting binding.', '50% 50%'),
    dia('which-category-should-you-buy', 'decide', {
      kicker: 'Match the format', title: 'Four sprays, four situations',
      rows: [
        ['Clothes, away from home, a mid-day reset', 'Pocket fabric mist', 'refresh'],
        ['Sofas, curtains, mattresses at home', 'Large trigger refresher', 'ok'],
        ['Fast coverage of a whole room', 'Aerosol room spray', 'ok'],
        ['A scent you like on stored linen', 'Perfume-led linen mist', 'ok'],
      ],
      note: 'Masking adds a smell. Binding removes one.',
    }),
  ],

  'firecracker-smoke-smell-out-of-clothes-diwali': [
    photo('why-does-firecracker-smoke-smell-stick', 7686378,
      'Sparklers throw bright trails and drifting smoke into the dark on Diwali night',
      'Cracker smoke arrives as fine particles, and fabric is a very good particle filter.', '50% 45%'),
    dia('which-parts-of-an-outfit-hold-the-most-smoke', 'zones', {
      kicker: 'Where smoke settles', title: 'Treat four zones, not the whole kurta', garment: 'kurta',
      zones: [
        { zone: 'chest', label: 'Front panel and chest', text: 'You face the anar and the chakri, so the front takes the plume.' },
        { zone: 'cuffs', label: 'Sleeves and cuffs', text: 'The hand lighting the phuljhadi is closest to the source.' },
        { zone: 'shoulders', label: 'Dupatta, stole or shawl', text: 'The most surface area. Often the worst piece next day.' },
        { zone: 'neckline', text: 'Smoke rises, and the neckline sits in it.' },
      ],
      note: 'Next morning: brush, air, then 2–3 sprays per zone from 15–20 cm. Patch-test silk and zari first.',
    }),
  ],

  'freshen-up-after-work-before-going-out': [
    photo('why-treat-the-shirt-and-not-just-add-perfume', 34051351,
      'A warmly lit restaurant window glows from a balcony at night',
      'By evening, most of the smell is in the shirt, not on you.'),
    dia('what-is-the-10-minute-washroom-routine', 'timeline', {
      kicker: 'Washroom, 10 minutes', title: 'Office to dinner, in order',
      items: [
        ['0–2 min', 'Shirt off, on the door hook. Wash face and neck.'],
        ['2–4 min', 'Dab underarms dry, deodorant on dry skin, fresh vest on.'],
        ['4–5 min', 'Treat the shirt: inside collar, underarms, upper back.'],
        ['5–8 min', 'Let it dry while you fix your hair.'],
        ['8–10 min', 'Shirt on, collar check. Perfume on skin, if you wear it.'],
      ],
    }),
  ],

  'gifts-for-men-under-500-india': [
    photo('what-makes-a-cheap-gift-feel-thoughtful', 6102576,
      'Hands tie a red ribbon around white gift boxes stacked on a table',
      'At this price, the gift that gets used every morning beats the one in a padded box.', '50% 50%'),
    dia('which-everyday-gifts-work-under-500', 'bars', {
      kicker: 'Typical spend', title: 'Everyday gifts under ₹500',
      items: [
        ['Pocket fabric odor spray (2 for ₹419)', 229, '₹229', true],
        ['Cotton handkerchief set', 400, '₹200–400'],
        ['Pocket notebook and a good pen', 450, '₹200–450'],
        ['Insulated steel water bottle', 500, '₹300–500'],
        ['Grooming travel pouch with a comb', 500, '₹250–500'],
      ],
      note: 'Bars show the top of each price range. The spray is for clothes, not skin, and is not a perfume.',
    }),
  ],

  'gym-clothes-smell-after-washing': [
    photo('why-do-dri-fit-shirts-smell', 8580730,
      'A woven laundry basket overflowing with worn t-shirts and towels',
      'A sealed, damp bundle is where tomorrow’s smell starts.'),
    dia('what-does-a-normal-wash-miss', 'decide', {
      kicker: 'Find the stage', title: 'What a normal wash can miss',
      rows: [
        ['Shirt sat wet in the hamper', 'Hang it first', 'air'],
        ['Cold or short wash on oily fabric', 'Wash warmer, longer', 'wash'],
        ['Heavy softener on technical fabric', 'Skip it', 'stop'],
        ['Slow drying in still air', 'Dry faster', 'air'],
        ['Clean when dry, smells once warm', 'Treat between wears', 'refresh'],
      ],
    }),
  ],

  'how-long-does-fabric-odor-spray-last': [
    photo('why-doesn-t-the-protection-last-forever', 5833807,
      'Three small desk clocks on a white office desk beside a notepad and pen',
      'Your body keeps making new odor all day, so protection is measured in hours, not days.'),
    dia('what-makes-it-last-longer-or-shorter', 'decide', {
      kicker: 'Up to 8 hours', title: 'What makes it last longer or shorter',
      rows: [
        ['Clean, dry shirt; collar, underarms and back targeted', 'Longer', 'refresh'],
        ['Cotton or wool', 'Longer', 'refresh'],
        ['Sprayed onto a damp, sweaty shirt', 'Shorter', 'stop'],
        ['Polyester and poly-blends', 'Shorter', 'wash'],
        ['Heavy sweating, heat, humidity', 'Shorter', 'wash'],
        ['New smoke or cooking smell later', 'Treat again', 'air'],
      ],
      note: 'Up to 8 hours of odor protection on fabric under normal office or commute conditions.',
    }),
  ],

  'how-many-times-wear-shirt-before-washing': [
    photo('how-do-you-decide-if-a-shirt-can-be-worn-again', 7621036,
      'A man holds a checked shirt on a hanger at arm’s length and looks it over',
      'Three checks before a second wear: the sniff, the collar band, and the day it had.', '50% 35%'),
    dia('how-many-wears-does-each-garment-get', 'bars', {
      kicker: 'Indian summer, humid months', title: 'Wears before washing, upper limits',
      items: [
        ['T-shirt, vest, innerwear', 1, '1'],
        ['Formal shirt, no vest', 1, '1'],
        ['Formal shirt over a cotton vest', 2, '1–2'],
        ['Cotton kurta', 1, '1'],
        ['Formal trousers, chinos', 3, '2–3', true],
        ['Jeans', 3, '3', true],
      ],
      note: 'Upper limits, not targets. Cooler months and an AC office stretch each by about one wear.',
    }),
  ],

  'how-odor-neutralizer-works-on-fabric': [
    photo('neutralise-on-fabric-means', 33653656,
      'Extreme close-up of a dark woven fabric, every thread of the weave visible',
      'Odor is a small molecule leaving a fibre. Neutralising means it stops reaching your nose.'),
    dia('cover-is-not-a-mechanism', 'compare', {
      kicker: 'Cover vs stack', title: 'Covering a smell is not removing it',
      cols: [
        { name: 'Cover', tag: 'Fragrance', lines: ['Keeps your nose busy with a louder smell', 'The sweat acids are still in the cloth', 'When the scent fades, the smell is back'] },
        { name: 'Stack', tag: 'Neutralise', pick: true, lines: ['Trap: HPβCD holds odor molecules', 'Quiet: Zinc PCA binds the volatile acids', 'Slow: Triethyl Citrate helps hold back new odor'] },
      ],
    }),
  ],

  'how-often-to-wash-jeans-india': [
    photo('why-does-frequent-washing-ruin-denim', 4109759,
      'Close-up of folded dark indigo jeans, seams and pocket stitching visible',
      'Every wash takes a little cotton, a little indigo and a little stretch.', '50% 50%'),
    dia('what-actually-works-between-washes', 'decide', {
      kicker: 'Between washes', title: 'What each method does to the smell',
      rows: [
        ['Hang them overnight', 'A little', 'air'],
        ['Air in direct sun', 'Helps, fades indigo', 'air'],
        ['The freezer', 'Nothing lasting', 'stop'],
        ['Perfume or body spray on the denim', 'Masks, can mark', 'stop'],
        ['Fabric odor mist on waistband and seams', 'Works on the fibre', 'refresh'],
      ],
      note: 'Wash on condition, not on count: dirt, a stain, or a smell that will not reset.',
    }),
  ],

  'how-to-freshen-clothes-stored-for-months': [
    photo('step-1-empty-the-storage-space', 4498143,
      'A hand lifts folded jeans out of an open cardboard storage box',
      'Take everything out first. The box needs air as much as the clothes do.'),
    dia('step-2-inspect-before-spraying', 'steps', {
      kicker: 'Five steps', title: 'Freshen stored clothes without washing everything',
      items: [
        ['Empty', 'Take it all out and let the box or wardrobe breathe.'],
        ['Inspect', 'Damp spots, mould, stains or soil mean clean first.'],
        ['Air', 'Hang or spread so air reaches seams, cuffs and collars.'],
        ['Decide', 'Wash what is dirty. Clean but stale can be refreshed.'],
        ['Treat', 'Mist the strongest zones and let it dry before folding.'],
      ],
    }),
  ],

  'how-to-pack-sweaty-clothes-without-bag-smell': [
    photo('what-is-the-best-packing-order', 7368261,
      'A person sits on the floor packing folded clothes into an open suitcase',
      'Clean in one compartment, worn in another, and nothing damp on top.', '50% 45%'),
    dia('can-you-spray-sweaty-clothes-before-packing', 'steps', {
      kicker: 'Packing order', title: 'Air, separate, then pack',
      items: [
        ['Air first', 'Hang worn clothes until they are dry enough to pack.'],
        ['Treat', 'A fabric mist only once they are dry, never on a soaked garment.'],
        ['Separate', 'Worn clothes in a breathable, washable pouch.'],
        ['Unpack fast', 'Hang them the moment you arrive and wash when you can.'],
      ],
      note: 'Spraying a soaked garment and sealing it in a bag locks the moisture in.',
    }),
  ],

  'how-to-smell-good-all-day-men-india': [
    photo('why-do-you-smell-fine-in-the-morning', 32770762,
      'A young man in a pale pink shirt stands on a narrow city street',
      'Fine in the morning, not by evening: sweat collects in the shirt all day.', '60% 40%'),
    dia('what-are-the-three-jobs', 'compare', {
      kicker: 'Three jobs', title: 'Skin, clothes and scent are different products',
      cols: [
        { name: 'Skin', tag: 'Deodorant', lines: ['Reduces underarm sweat', 'Controls skin odor', 'Cannot clear odor in your shirt'] },
        { name: 'Clothes', tag: 'Fabric odor spray', pick: true, lines: ['Traps and neutralises odor in fabric', 'Not for skin', 'Does not replace washing'] },
        { name: 'Scent', tag: 'Perfume, attar', lines: ['Adds a smell you choose', 'Sits on top', 'Does not remove odor'] },
      ],
    }),
  ],

  'how-to-use-odorstrike': [
    photo('distance-technique-and-dry-time', 'assets/photos/pdp-step-02-spray.webp',
      'A fine mist from the ODORSTRIKE bottle lands on the collar of a black shirt',
      'Fifteen to twenty centimetres, hand moving, two or three light passes.', '50% 45%'),
    dia('how-many-sprays-per-garment', 'bars', {
      kicker: 'Sprays per garment', title: 'Coverage of the right zones beats volume',
      items: [
        ['Shirt or t-shirt: inside collar, underarms, upper back', 5, '4–5', true],
        ['Jacket, blazer or hoodie: lining, collar band, underarms', 6, '5–6'],
        ['Kurta or formal wear: inside collar and lining', 5, '4–5'],
        ['Jeans or trousers: inside waistband', 3, '2–3'],
      ],
      note: 'Spot-test silk and zari first. Fabric only, never skin.',
    }),
  ],

  'hpbcd-cyclodextrin-fabric-odor': [
    photo('what-is-hp-cd', 9629686,
      'Clear laboratory flasks and test tubes on a white bench, one holding red liquid',
      'HPβCD starts as a ring of seven glucose units: a tiny bucket with a hollow centre.'),
    dia('why-does-the-hydroxypropyl-form-matter', 'compare', {
      kicker: 'Why HPβCD', title: 'What the hydroxypropyl form changes in a spray',
      cols: [
        { name: 'Plain β-cyclodextrin', tag: 'Parent molecule', lines: ['Lower water solubility', 'Harder to keep in a fine, clear mist', 'Same hollow ring for trapping odor'] },
        { name: 'HPβCD', tag: 'In ODORSTRIKE', pick: true, lines: ['Dissolves completely in water', 'Sprays as a fine, even mist', 'Dries with no stiff residue'] },
      ],
    }),
  ],

  'is-fabric-odor-spray-worth-it-india': [
    photo('what-does-a-wash-really-cost', 8774416,
      'A person loads white laundry into the drum of a washing machine',
      'A top-loader may use up to 23 litres of water per kg of laundry, per cycle.', '50% 45%'),
    dia('what-does-a-fabric-odor-spray-cost-per-use', 'stats', {
      kicker: 'From the bottle', title: 'What one bottle works out to',
      items: [
        ['₹229', 'for 50ml (2 for ₹419)'],
        ['~250', 'sprays per bottle'],
        ['~₹2.29', 'per refresh of one garment'],
        ['~₹0.92', 'per spray'],
      ],
      note: 'A refresh is the zones that hold smell, not a soaked garment: about 2–3 sprays per zone.',
    }),
  ],

  'keep-clothes-fresh-while-travelling': [
    photo('why-do-clothes-smell-faster-on-a-trip', 37171699,
      'Passengers sit by the open window of an Indian train compartment in daylight',
      'More heat, more hours, less airflow and no drying window: travel stacks all of it.', '50% 45%'),
    dia('which-garments-can-you-actually-re-wear', 'bars', {
      kicker: 'Distance from skin decides', title: 'Realistic wears before washing on a trip',
      items: [
        ['Blazer, jacket, overshirt', 10, '5–10', true],
        ['Jeans, chinos', 8, '4–8', true],
        ['Cotton shirt or kurta (zones treated)', 2, '2'],
        ['Cotton t-shirt', 2, '1–2'],
        ['Synthetic activewear', 1, '1'],
      ],
    }),
  ],

  'keep-clothes-fresh-without-washing-machine': [
    photo('why-do-hostel-clothes-smell-even-when', 7969102,
      'Two people chat by a bunk bed in a small shared hostel room',
      'In a shared room the smell usually comes from how long clothes took to dry.', '50% 45%'),
    dia('what-is-the-nightly-routine', 'steps', {
      kicker: 'Ninety seconds a night', title: 'The hostel and PG routine',
      items: [
        ['Hang it', 'On a hanger or hook, opened out, the moment it comes off.'],
        ['Sort it', 'Re-wear on the rail, wash into the bag.'],
        ['Treat three zones', 'Collar, underarms and upper back of the re-wear pile.'],
        ['Leave it in air', 'Overnight, where air moves.'],
      ],
    }),
  ],

  'keep-linen-shirts-cotton-kurtas-fresh-summer': [
    photo('how-do-you-refresh-a-kurta-or-linen-shirt', 6850574,
      'A white linen shirt on a hanger catches the sunlight outdoors',
      'Hang it open the moment it comes off, in moving air or under a fan.', '50% 40%'),
    dia('where-does-a-kurta-start-to-smell-first', 'zones', {
      kicker: 'Where it starts', title: 'Where a kurta starts to smell first', garment: 'kurta',
      zones: [
        { zone: 'underarms', text: 'Touch skin and stay damp longest.' },
        { zone: 'neckline', text: 'Sweat and neck oil, and a white kurta shows the line.' },
        { zone: 'upper back', text: 'Where it sticks to you in the heat.' },
        { zone: 'lower back', text: 'Long kurtas collect sweat where you sit.' },
      ],
      note: 'Loose cuts smell later than fitted ones: more air between you and the cloth.',
    }),
  ],

  'keep-office-trousers-fresh-without-washing': [
    photo('what-does-washing-formals-daily-actually-cost', 1682699,
      'Office shirts in coral, grey and black hang close together in a wardrobe',
      'Every wash costs colour, edges, structure and crease, a little at a time.', '50% 50%'),
    dia('which-zones-actually-hold-it', 'zones', {
      kicker: 'All on the inside', title: 'Where trousers actually hold smell', garment: 'trousers',
      zones: [
        { zone: 'waistband', label: 'Inside waistband', text: 'The highest-value zone, and the one almost nobody treats.' },
        { zone: 'inner thighs', label: 'Upper inner thigh seams', text: 'Warm, enclosed, high friction, slow to dry.' },
      ],
      note: 'On the shirt, the inside collar and cuffs. The seat, knees and outer legs are not where the smell lives.',
    }),
  ],

  'keep-work-uniform-fresh-between-washes': [
    photo('why-do-uniforms-smell-faster', 8629106,
      'A chef in a white jacket cooks over the stove in a busy commercial kitchen',
      'Long shifts, synthetic blends and too few sets: uniforms usually have all three.', '50% 40%'),
    dia('how-many-uniform-sets-do-you-need', 'compare', {
      kicker: 'Sets', title: 'How many uniform sets do you need?',
      cols: [
        { name: 'Three sets', tag: 'Comfortable', pick: true, lines: ['Wash after every wear', 'One drying, one ready', 'Shirts last longer'] },
        { name: 'Two sets', tag: 'Needs a routine', lines: ['Never the same set two days running', 'Wash each set every second wear at most', 'Every wear in summer'] },
      ],
    }),
  ],

  'mumbai-humidity-sweat-smell-survival-guide': [
    photo('why-mumbai-is-the-worst-indian-city', 28867945,
      'Mumbai’s Chhatrapati Shivaji Terminus under heavy monsoon clouds, the road wet',
      'Mumbai averages 75–85% relative humidity from June through October.', '50% 45%'),
    dia('the-5-tool-mumbai-survival-kit', 'timeline', {
      kicker: 'Tool 1, three times a day', title: 'A pocket fabric mist on a Mumbai day',
      items: [
        ['Morning', 'Before wear: 2–3 pumps on collar and underarm fabric.'],
        ['Mid-day', 'A 30-second washroom stop at the office.'],
        ['Evening', 'Again before evening plans.'],
      ],
      note: 'Pair it with cotton or linen over polyester for office wear.',
    }),
  ],

  'odor-on-clothes-vs-odor-in-clothes': [
    photo('why-does-heat-and-moisture-bring', 35150391,
      'Macro view of a pale blue shirt collar and its buttons against grey fabric',
      'A collar that smells neutral on the hanger can change after minutes of body heat.'),
    dia('what-does-it-mean-for-odor-to-be-in-a-fabric', 'compare', {
      kicker: 'On or in', title: 'Odor on the cloth vs odor in the fibre',
      cols: [
        { name: 'On the cloth', tag: 'Airs off', lines: ['Picked up from smoke, cooking or a room', 'Sits on the surface', 'Moving air removes much of it'] },
        { name: 'In the fibre', tag: 'Comes back', pick: true, lines: ['Retained by the fibre after wear', 'Returns with heat and moisture', 'Needs washing or a fabric treatment'] },
      ],
    }),
  ],

  'odorstrike-ingredients': [
    photo('what-is-deliberately-left-out', 'assets/photos/pdp-step-01-hold.webp',
      'A hand holds the ODORSTRIKE bottle over a stack of folded t-shirts',
      'Three key actives do the work. Eight supporting ingredients keep them stable and sprayable.', '50% 45%'),
    dia('the-key-actives-in-formula-v3-1', 'steps', {
      kicker: 'Formula v3.1', title: 'Three key actives, three jobs',
      items: [
        ['HPβCD · Trap', 'A ring-shaped molecule that cages odor compounds.'],
        ['Zinc PCA · Neutralise', 'Binds the volatile acids behind sweat smell.'],
        ['Triethyl Citrate · Prevent', 'Slows the breakdown of fresh sweat into new odor.'],
        ['+ 8 more', 'Supporting ingredients that keep it stable, sprayable and lightly scented.'],
      ],
      note: 'Exact concentrations are proprietary. For an allergy check, email info@smelloff.in.',
    }),
  ],

  'odorstrike-review-30-day-india-test': [
    photo('the-stain-test-done-separately', 'assets/photos/pdp-step-03-dried-clear.webp',
      'The collar of a black shirt shortly after spraying, dried clear',
      'The founder’s own test, in Hyderabad heat in April 2026.', '50% 50%'),
    dia('the-30-day-test-setup', 'timeline', {
      kicker: 'One bottle, 30 days', title: 'Four garments, four weeks',
      items: [
        ['Day 1–7', 'Office shirt: 8-hour days, AC and a bike commute.'],
        ['Day 8–14', 'Gym polyester, the hardest fabric for odor.'],
        ['Day 15–21', 'Denim jacket worn seven days running without a wash.'],
        ['Day 22–30', 'Kurta and sherwani through a 12-hour wedding day.'],
      ],
      note: 'A first-person test by the founder, not a lab study.',
    }),
  ],

  'odorstrike-vs-febreze-india': [
    photo('where-does-odorstrike-win', 'assets/photos/pocket-trousers.webp',
      'The ODORSTRIKE bottle tucked into the pocket of a pair of trousers',
      'The pocket problem: a fix for the shirt you are wearing has to come with you.', '50% 50%'),
    dia('what-s-the-verdict-for-an-indian-buyer', 'compare', {
      kicker: 'Head to head', title: 'Febreze or ODORSTRIKE?',
      cols: [
        { name: 'Febreze', tag: 'Home surfaces', lines: ['250–370 ml bottle on a shelf', 'Strong fragrance options', 'Couches, curtains, car upholstery'] },
        { name: 'ODORSTRIKE', tag: 'Clothes you are wearing', pick: true, lines: ['50ml, jeans or shirt pocket', 'Light scent that fades', 'Dries in 15–30 seconds on cotton'] },
      ],
      note: 'If the problem is at home, Febreze is still the answer. If it is the shirt on you, carry a pocket mist.',
    }),
  ],

  'office-ac-trap-why-rewear-shirts-smell-worse': [
    photo('why-this-hits-polyester-hardest', 38084058,
      'An office building facade lined with rows of air-conditioner units',
      'Every move between the street and the AC office restarts the cycle in the fabric.', '50% 50%'),
    dia('the-sequence-that-creates-the-ac-trap', 'steps', {
      kicker: 'The AC trap', title: 'How a re-worn shirt gets louder',
      items: [
        ['Sweat', 'Bacteria turn sweat into odor molecules in the fibre.'],
        ['AC dries it', 'The water leaves. The odor molecules stay and concentrate.'],
        ['Wash or hang', 'A wash lifts the surface load; polyester keeps some.'],
        ['Slow drying', 'Humid indoor drying gives bacteria a window.'],
        ['Re-wear', 'Heat and new sweat bring it all back out.'],
      ],
    }),
  ],

  'perfume-plus-sweat-chemical-reaction': [
    photo('what-s-actually-in-cologne', 10945075,
      'An amber cologne bottle with a gold cap, lit against a black background',
      'Top notes leave first. What stays behind meets the sweat compounds in the shirt.'),
    dia('the-right-sequence', 'steps', {
      kicker: 'If you wear cologne', title: 'The right sequence on a long day',
      items: [
        ['Shower', 'Lowers the bacterial load on skin.'],
        ['Deodorant', 'On dry skin.'],
        ['Shirt treated', 'A fabric odor mist on the shirt before wear.'],
        ['Cologne on skin', 'Wrist, neck, behind the ear. Never on clothing.'],
        ['Mid-day', 'Reset the shirt only. Don’t re-apply cologne over sweat.'],
      ],
    }),
  ],

  'remove-cigarette-smoke-smell-from-clothes': [
    photo('why-does-smoke-smell-survive', 6530922,
      'A man in profile stands in a dim room filled with drifting smoke',
      'Smoke leaves residue in the fabric, and the residue keeps releasing.', '50% 25%'),
    dia('how-do-you-reset-a-garment-the-same-night', 'zones', {
      kicker: 'Smoke arrives from above', title: 'Where smoke settles on what you wore', garment: 'jacket',
      zones: [
        { zone: 'shoulders', label: 'Shoulders and upper back', text: 'Upward-facing surfaces collect the most.' },
        { zone: 'chest', label: 'Chest and front panel', text: 'Faces the room and the smoke.' },
        { zone: 'collar', label: 'Collar area', text: 'Also catches what comes off your hair.' },
      ],
      note: 'Isolate, brush, air, then treat these zones. Sleeves and lower back take noticeably less.',
    }),
  ],

  'remove-cooking-smell-from-clothes': [
    photo('why-does-cooking-smell-cling-to-clothes', 13413393,
      'Sliced onions and green chillies fry in hot oil in a steel kadai',
      'Hot oil throws droplets into the air, and they land on your shirt.', '50% 50%'),
    dia('which-cooking-methods-put-the-most', 'bars', {
      kicker: 'Peak VOCs, Indoor Air 2024', title: 'Hot oil puts the most on your clothes',
      items: [
        ['Pan-frying', 260, '~260 ppb', true],
        ['Deep-frying', 230, '~230 ppb', true],
        ['Stir-frying', 110, '~110 ppb'],
        ['Boiling', 30, '~30 ppb'],
        ['Air-frying', 20, '~20 ppb'],
      ],
      note: 'Peak volatile organic compound concentrations measured across cooking methods in a controlled setting.',
    }),
  ],

  'remove-incense-agarbatti-dhoop-smell': [
    photo('why-incense-is-not-a-room-odor', 11465621,
      'Two lit incense sticks send thin trails of smoke up from a holder',
      'Agarbatti and dhoop smoulder, and the particles land on whatever is in the room.', '50% 50%'),
    dia('how-do-you-get-agarbatti-smell-out', 'steps', {
      kicker: 'After the puja', title: 'Get agarbatti smell out, in order',
      items: [
        ['Leave the room', 'Get the garment out of the smoky room.'],
        ['Air it', '30–60 minutes in moving air takes the light end.'],
        ['Sun for cotton', 'Shade for silk; sun is rough on silk and dyes.'],
        ['Mist what is left', 'On clean, dry cloth: shoulders, drape, collar.'],
        ['Wash if thick', 'Heavy smoke on a washable garment: wash it.'],
      ],
    }),
  ],

  'remove-mothball-almirah-smell-from-clothes': [
    photo('how-do-you-actually-clear-it', 18337478,
      'The carved wooden doors of an old almirah in warm low light',
      'A cupboard closed through a monsoon holds humid air against textiles for weeks.', '50% 50%'),
    dia('what-is-actually-in-an-almirah-smell', 'compare', {
      kicker: 'Three smells, three causes', title: 'What “almirah smell” is made of',
      cols: [
        { name: 'Moth repellent', tag: 'Sharp, chemical', lines: ['Naphthalene or camphor vapour', 'Has had months to get everywhere', 'Clears with airing, slowly'] },
        { name: 'Oxidised skin oils', tag: 'Stale, rancid', lines: ['Sebum left in when it was put away', 'Oxidises over a season', 'Wash properly before storing'] },
        { name: 'Dampness', tag: 'Musty', lines: ['Humid air held against cloth', 'Microbes grow on damp fabric', 'Dry fully, store breathable'] },
      ],
    }),
  ],

  'remove-smell-from-blazer-without-dry-cleaning': [
    photo('how-do-you-air-a-jacket-properly', 37524688,
      'A pale mint blazer hangs on a wooden hanger against a warm wall',
      'Open, spaced and in moving air. A closed wardrobe is the one place airing cannot work.', '50% 35%'),
    dia('which-three-zones-do-you-actually-treat', 'zones', {
      kicker: 'All on the inside', title: 'Three zones inside a blazer', garment: 'jacket',
      zones: [
        { zone: 'back lining', text: 'Sits against your shirt across the widest area.' },
        { zone: 'underarm lining', label: 'Underarm lining', text: 'The highest-concentration zone on any garment.' },
        { zone: 'collar', label: 'Inside collar', text: 'Takes what comes off your neck and hairline.' },
      ],
      note: 'Open the jacket fully and work on the inside. Nothing touches the face of the wool.',
    }),
  ],

  'remove-smell-from-clothes-without-washing': [
    photo('why-doesn-t-airing-alone-get-the-smell-out', 3215941,
      'White cotton clothes hang on a line, lit from behind by low sun',
      'Airing removes the loose part of a smell. Odor held in the fibre needs more.', '50% 45%'),
    dia('how-do-you-refresh-clothes-between-washes', 'steps', {
      kicker: 'Between washes', title: 'Refresh a clean garment in four steps',
      items: [
        ['Decide', 'Refresh if it is clean but smells. Wash if stained, soiled or damp.'],
        ['Air it', 'Hang it open in moving air for 20–30 minutes.'],
        ['Treat the zones', 'Collar, underarms, upper back: 2–3 sprays each.'],
        ['Let it dry', '15–30 seconds before you wear it.'],
      ],
    }),
  ],

  'remove-smell-from-hoodie-without-washing': [
    photo('why-does-a-hoodie-smell-before', 7479825,
      'Two people seen from behind with the hoods of black and cream hoodies up',
      'Fleece has an enormous inner surface, and it grips skin oils.', '50% 40%'),
    dia('how-do-you-refresh-a-hoodie-between-washes', 'zones', {
      kicker: 'Inside out first', title: 'Four zones where a hoodie holds smell', garment: 'hoodie',
      zones: [
        { zone: 'underarms', text: 'The highest-concentration point on any garment.' },
        { zone: 'hood', label: 'Collar and hood lining', text: 'Takes what comes off your neck and hairline.' },
        { zone: 'cuffs', text: 'Pushed up and pulled down all day.' },
        { zone: 'kangaroo pocket', label: 'Front pocket', text: 'A warm pouch your hands live in.' },
      ],
      note: 'Turn it inside out and air it 20–30 minutes before you treat it.',
    }),
  ],

  'remove-smell-from-sweater-without-washing': [
    photo('how-do-you-air-a-sweater-properly', 30161705,
      'A smiling man in a striped wool sweater stands outdoors on a cool day',
      'Air it the same evening: flat or on a wide hanger, inside out.', '50% 35%'),
    dia('how-often-should-you-actually-wash-a-sweater', 'compare', {
      kicker: 'Washing', title: 'How often to wash a sweater',
      cols: [
        { name: 'Wool and merino', tag: 'Resists odor', pick: true, lines: ['A few times a season', 'Or when visibly dirty', 'Hand or wool cycle, dry flat in shade'] },
        { name: 'Acrylic and polyester', tag: 'Holds odor', lines: ['Every 5–7 wears', 'Refresh between wears', 'Never tumble-dry or hang wet'] },
      ],
      note: 'A shirt or vest underneath takes the sweat and lets any sweater go longer.',
    }),
  ],

  'remove-smell-from-thrifted-clothes': [
    photo('what-causes-the-smell-on-second-hand', 14789186,
      'Racks of second-hand jackets and coats fill a bright thrift store',
      'Thrift finds often can’t go in the machine. Air, brush, treat the lining, repeat.', '50% 50%'),
    dia('how-do-you-deal-with-jackets-blazers-and-wool', 'steps', {
      kicker: 'Jackets, blazers, wool', title: 'Thrift finds you can’t machine-wash',
      items: [
        ['Air a full day', 'On a wide hanger, in moving air.'],
        ['Brush', 'Lift dust and loose particles from the outside.'],
        ['Treat the lining', 'Underarm lining, back lining, inside collar.'],
        ['Repeat', 'A second round if it still smells. After two full rounds, let it go.'],
      ],
    }),
  ],

  'spray-to-remove-sweat-smell-from-clothes-quickly': [
    photo('why-does-odorstrike-win-on-speed', 'assets/photos/home-02-mist-on-shirt.webp',
      'A fine mist from the ODORSTRIKE bottle lands on the fabric of a shirt',
      'A fast-drying water base carries the actives into the fibre, then leaves.', '50% 40%'),
    dia('how-do-you-use-a-sweat-smell-spray-properly', 'zones', {
      kicker: 'Use it properly', title: 'Where the sprays go', garment: 'tee',
      zones: [
        { zone: 'underarms', label: 'Underarm fabric', text: '2–3 pumps each side.' },
        { zone: 'collar', text: '1–2 pumps inside the collar.' },
        { zone: 'upper back', label: 'Back panel', text: 'Between the shoulder blades.' },
      ],
      note: '15–20 cm from the fabric. Closer makes a wet patch; further wastes spray into the air.',
    }),
  ],

  'stay-fresh-in-heatwave-north-india': [
    photo('why-do-clothes-smell-worse-in-a-dry-heat', 29639330,
      'Low sun lights a tree-lined Indian street with a bus and an auto-rickshaw',
      'In dry heat sweat evaporates fast, and what dries on the fabric is the part that smells.', '50% 45%'),
    dia('what-is-the-heatwave-day-routine', 'timeline', {
      kicker: 'Heatwave day', title: 'Staying fresh from morning to home',
      items: [
        ['Morning', 'Fresh vest; a shirt that passes the sniff test.'],
        ['Commute', 'Over-layer on a two-wheeler; sit away from the sun in a cab.'],
        ['Arrival', 'Cool down 3–5 minutes, dry off, then 4–5 sprays on collar, underarms, back.'],
        ['Lunch', 'Dry off; treat the same zones after any time outdoors.'],
        ['Evening', 'Change the vest, treat the shirt once more.'],
        ['Home', 'Hang open, then wash. Heatwave clothes rarely earn a second wear.'],
      ],
      note: 'Smelling fresh comes second to staying safe: drink water and avoid the sun between noon and 3 pm.',
    }),
  ],

  'stop-sweat-smell-job-interview': [
    photo('how-do-you-handle-the-commute', 8459996,
      'A bright, empty office waiting area with blue chairs and a reception desk',
      'Arrive fifteen minutes early so the five minutes before you walk in exist.', '50% 50%'),
    dia('what-should-you-do-in-the-five-minutes', 'steps', {
      kicker: 'Five minutes before', title: 'The pre-interview reset',
      items: [
        ['Cool down', 'AC or shade; a cold bottle on your wrists; slow your breathing.'],
        ['Dry off', 'Dab face, neck and underarms. Change a damp vest.'],
        ['Treat the shirt', 'Inside collar and underarm fabric, never your skin.'],
        ['Let it dry', '15–30 seconds, then shirt back on.'],
      ],
    }),
  ],

  'vinegar-baking-soda-fabric-softener': [
    photo('what-vinegar-actually-does-in-the-laundry', 4202482,
      'A scrubbing brush, a bamboo toothbrush, cotton buds, soap and a bowl of white powder on marble',
      'Three household additives, three different jobs, and none of them is a sweat-odor eliminator.'),
    dia('three-additives-three-jobs', 'compare', {
      kicker: 'The job table', title: 'Hire them for their real jobs',
      cols: [
        { name: 'White vinegar', tag: 'Acid rinse', lines: ['Cuts alkaline detergent leftover', 'Not a degreaser or a sebum treatment', '**Never mix with bleach:** chlorine gas'] },
        { name: 'Baking soda', tag: 'Mild alkali', lines: ['Some buffering, some abrasion as a paste', 'Will not emulsify neck oil', 'Unkind to wool, silk, some dyes'] },
        { name: 'Fabric softener', tag: 'Cationic film', lines: ['Slick feel, anti-static, perfume', 'The perfume is a cover', 'Films build up with hard water'] },
      ],
      note: 'Mixed together, vinegar and baking soda cancel each other out. The fizz is not cleaning.',
    }),
  ],

  'wash-clothes-less-save-water-india': [
    photo('how-else-can-you-cut-water-in-the-wash', 8751911,
      'A white plastic water pipe and brass tap against a weathered wall',
      'Full loads, the right programme and a clean machine all cut water.', '50% 45%'),
    dia('how-much-water-does-washing-clothes-use', 'bars', {
      kicker: 'BEE star-label limits', title: 'Maximum water per kg of laundry, per cycle',
      items: [
        ['Top-loader or semi-automatic', 23, 'up to 23 L/kg', true],
        ['Front-loader', 9, 'up to 9 L/kg'],
      ],
      note: 'Every garment you can rewear is one less in the load.',
    }),
  ],

  'wash-refresh-or-wear': [
    photo('three-clocks-one-shirt', 35750806,
      'A row of men’s shirts in checks and solids on wooden hangers',
      'Morning, a panic before a meeting, a long day: three clocks, one shirt.', '50% 45%'),
    dia('wash-or-refresh-this-shirt-the-morning-decision', 'decide', {
      kicker: 'On a hanger, in daylight', title: 'The morning decision',
      rows: [
        ['Yellow, grey or stiff collar band or underarms', 'Wash', 'wash'],
        ['You flinch when you smell a zone at 10 cm', 'Wash', 'wash'],
        ['Cool-damp from last night’s indoor dry', 'Air it first', 'air'],
        ['Dry, unstained, a little present at the underarms', 'Mist, then wear', 'refresh'],
        ['Dry, unstained and quiet on the hanger', 'Wear it', 'ok'],
      ],
    }),
  ],

  'wedding-festive-wear-odor-guide': [
    photo('why-six-hour-functions-are-the-worst-case', 38147801,
      'Close-up of a groom’s embroidered cream sherwani beside a bride’s red and gold outfit',
      'Layered heavy fabric, no break to reapply, and hours of stress sweat.', '50% 45%'),
    dia('the-pre-event-routine', 'timeline', {
      kicker: 'Wedding day', title: 'Before and during the function',
      items: [
        ['Night before', 'Air the outfit on a wide hanger. Spot-test silk, zari or brocade on an inside seam.'],
        ['Before you leave', 'Inside collar, underarm panels, upper back: 2–3 light passes from 15–20 cm.'],
        ['Hour four', 'Collar reset in the washroom: two sprays along the inside band, one per underarm.'],
      ],
      note: 'Spray the inner layer, never the face of silk or zari.',
    }),
  ],

  'what-is-fabric-odor-eliminator': [
    photo('how-does-masking-differ-from-neutralizing', 'assets/photos/hero-spray-collar.webp',
      'A fine mist from the ODORSTRIKE bottle lands on the collar of a black shirt',
      'On the fabric, not the skin: a fabric odor eliminator acts on the compounds in the cloth.', '50% 45%'),
    dia('what-is-a-fabric-odor-eliminator-and-what-isn-t-it', 'compare', {
      kicker: 'What it is not', title: 'Four products that get confused',
      cols: [
        { name: 'Fabric odor eliminator', tag: 'Clothes', pick: true, lines: ['Misted onto fabric', 'Acts on odor compounds'] },
        { name: 'Perfume', tag: 'Scent', lines: ['Adds a smell on top', 'The odor stays under it'] },
        { name: 'Room spray', tag: 'Air', lines: ['Freshens the air', 'Not made for clothes'] },
        { name: 'Deodorant', tag: 'Skin', lines: ['Goes on the body', 'Cannot reach the shirt'] },
      ],
    }),
  ],

  'where-to-buy-odorstrike-india': [
    photo('payment-options-upi-and-cod', 'assets/photos/offer-in-hand-black.webp',
      'A hand holds the ODORSTRIKE 50ml bottle against a black background',
      'Sold direct at smelloff.in, shipped from Hyderabad.', '50% 50%'),
    dia('shipping-across-india', 'stats', {
      kicker: 'Buying direct', title: 'Price, shipping and returns at a glance',
      items: [
        ['₹229', '50ml bottle · 2 for ₹419'],
        ['Free', 'shipping on prepaid orders; Cash on Delivery available'],
        ['48 h', 'dispatch from Hyderabad after confirmation'],
        ['7 days', 'to return from delivery'],
      ],
    }),
  ],

  'which-fabrics-hold-odor-most': [
    photo('why-does-cotton-behave-differently', 6766232,
      'Hands hold up checked and plain fabric swatches side by side',
      'Same sweat, different fibre, very different afternoon.', '50% 50%'),
    dia('where-do-wool-silk-and-blends-fit', 'scale', {
      kicker: 'Fibre and odor', title: 'From least to most odor held',
      left: 'Holds less', right: 'Holds more',
      items: [
        ['Wool and merino', 10, 'Moves moisture as vapour; worn for days on treks.'],
        ['Cotton and linen', 38, 'Absorbs watery sweat and gives most of it back in the wash.'],
        ['Blends', 66, 'Behave like their worst component.'],
        ['Polyester', 90, 'Repels water, attracts oil: the worst case against skin.'],
      ],
      note: 'Silk is delicate rather than smelly: handle it gently and spot-test.',
    }),
  ],

  'why-body-odor-comes-back-on-clothes-so-quickly': [
    photo('why-does-the-smell-return-as-soon-as', 4719922,
      'A man in a dark t-shirt wipes his head with a towel in a leafy park on a hot day',
      'Body heat and moisture wake up odor that a dry shirt kept quiet.', '50% 40%'),
    dia('is-the-odor-coming-from-your-body-or-the-shirt', 'compare', {
      kicker: 'Two sources', title: 'Is it you, or the shirt?',
      cols: [
        { name: 'Your body', tag: 'Skin', lines: ['Sweat, skin chemistry and microbes', 'A shower resets it', 'Deodorant manages it'] },
        { name: 'The shirt', tag: 'Fabric', pick: true, lines: ['Retains odorants after repeated wear', 'A shower doesn’t touch it', 'Wash, or treat clean fabric between wears'] },
      ],
    }),
  ],

  'why-clean-shirt-starts-smelling-within-hours': [
    photo('why-do-some-people-notice-it-sooner', 7251095,
      'A commuter in a brown coat walks through metro ticket gates',
      'Commute, humidity, the fibre itself: each one moves the clock.', '50% 45%'),
    dia('why-do-underarms-and-collars-go-first', 'zones', {
      kicker: 'First to go', title: 'Why underarms and collars go first', garment: 'shirt',
      zones: [
        { zone: 'collar', text: 'High contact with neck oil and sweat all day.' },
        { zone: 'underarms', text: 'High moisture and friction.' },
        { zone: 'upper back', text: 'Pressed against chairs and seats, slow to dry.' },
      ],
    }),
  ],

  'why-clothes-smell-bad-after-drying': [
    photo('does-slow-drying-make-fabric-odor-worse', 9602506,
      'A line of washed clothes dries in a narrow yard between brick walls',
      'A garment that stays damp for hours gives microbes and residues more time.', '50% 45%'),
    dia('what-should-you-change-in-the-drying-step', 'steps', {
      kicker: 'Drying step', title: 'What to change after the wash',
      items: [
        ['Out at once', 'Move wet laundry out of the washer quickly.'],
        ['Shake open', 'Leave space between items.'],
        ['More airflow', 'A fan or a window, not a closed room.'],
        ['Dry to the seam', 'Seams, cuffs, collars and underarms dry last.'],
      ],
    }),
  ],

  'why-clothes-smell-bad-again-after-sweating': [
    photo('is-the-new-sweat-itself-the-whole-problem', 13086949,
      'A man in a black t-shirt walks down a tree-lined city street on a warm day',
      'New sweat wakes up the residue the shirt was already holding.', '50% 22%'),
    dia('what-part-of-the-shirt-should-you-treat-first', 'zones', {
      kicker: 'Treat first', title: 'The zones that get warm and damp', garment: 'tee',
      zones: [
        { zone: 'underarms', text: 'Warmest and wettest.' },
        { zone: 'chest', label: 'Upper chest', text: 'Takes sweat on a hot walk.' },
        { zone: 'collar', text: 'Neck oil and sweat.' },
        { zone: 'upper back', text: 'Sticks to you, slow to dry.' },
      ],
      note: 'A focused, light treatment. You do not need to soak the whole garment.',
    }),
  ],

  'why-clothes-smell-in-wardrobe-even-when-clean': [
    photo('does-overpacking-a-wardrobe-make-the-problem-worse', 6601769,
      'An open wardrobe packed with shirts and jackets on hangers',
      'Tightly packed clothes have less air around the fibres.', '50% 15%'),
    dia('what-is-the-best-wardrobe-reset', 'steps', {
      kicker: 'Wardrobe reset', title: 'Fix the space, then the clothes',
      items: [
        ['Empty it', 'Take out the affected section.'],
        ['Check', 'Look for damp or visible mould.'],
        ['Clean and air', 'Wipe shelves if needed; let the space ventilate.'],
        ['Air the clothes', 'Treat any clean garment that still carries odor.'],
        ['Return loosely', 'Leave room between hangers.'],
      ],
    }),
  ],

  'why-clothes-smell-musty-after-being-stored': [
    photo('why-do-winter-clothes-smell-after-months', 9186212,
      'A woman presses the air out of a vacuum storage bag of folded clothes',
      'Months compressed with little ventilation: the smell is waiting when the bag opens.', '50% 45%'),
    dia('how-do-you-freshen-stored-clothes', 'decide', {
      kicker: 'After storage', title: 'Air, wash or treat?',
      rows: [
        ['Clean but smells stored', 'Air, then treat', 'refresh'],
        ['Visible mould or dampness', 'Wash', 'wash'],
        ['Sweat, body-oil buildup or stains', 'Wash', 'wash'],
        ['Smell gone after a day of airing', 'Wear it', 'ok'],
      ],
      note: 'Never pack clothes while cuffs, collars or seams are still damp.',
    }),
  ],

  'why-clothes-smell-stale-in-ac-room': [
    photo('closed-cool-air-is-not-clean-air', 38788452,
      'A white wall-mounted split air conditioner high on a pale wall',
      'Most Indian bedroom and cabin ACs recirculate the same air.', '50% 50%'),
    dia('room-note-versus-fibre-note', 'compare', {
      kicker: 'Name the note', title: 'Room note or fibre note?',
      cols: [
        { name: 'Room note', tag: 'The cabin', lines: ['Recycled air, coil, curtain', 'A faint sweet-stale on every cloth', 'Fades in another room'] },
        { name: 'Fibre note', tag: 'The shirt', pick: true, lines: ['Sits at the underarms and collar', 'Stays when you move the shirt', 'Wash it, or treat the fabric'] },
      ],
      note: 'A clothing mist is a contact treatment for fibre. It does not deodorise a room.',
    }),
  ],

  'why-deodorant-stops-working-after-3-hours': [
    photo('what-deodorant-actually-does', 20050353,
      'A simple black-and-white wall clock with Roman numerals on a pale wall',
      'Deodorant does its job on skin. The clock that matters by afternoon is the shirt’s.', '50% 45%'),
    dia('the-hour-by-hour-reality', 'timeline', {
      kicker: 'Hour by hour', title: 'Where the smell is building',
      items: [
        ['7 am', 'Deodorant on dry skin. You walk out fresh.'],
        ['9 am', 'Commute sweat starts moving into the underarm fabric.'],
        ['11 am', 'AC office. Odor molecules develop in the shirt, unnoticed.'],
        ['1 pm', 'Lunch outdoors: a new round of sweat into loaded fabric.'],
        ['3 pm', 'The drop: skin product past its window, shirt full of odor.'],
      ],
      note: 'The 3 pm problem is a fabric problem: treat the shirt in the morning and again mid-day.',
    }),
  ],

  'why-i-built-odorstrike': [
    photo('what-was-the-realization', 'assets/photos/home-01-collar-check.webp',
      'A man in a grey office shirt lifts his collar to check how it smells',
      'By 3 pm the smell lives in the shirt fibres, not on the skin.', '50% 30%'),
    dia('why-this-price', 'stats', {
      kicker: 'The brief', title: 'Built to be an everyday habit',
      items: [
        ['50ml', 'pocket size'],
        ['~250', 'sprays per bottle'],
        ['15–30 s', 'to dry on fabric'],
        ['₹229', 'per bottle'],
      ],
    }),
  ],

  'why-polyester-holds-odor-longer-than-cotton': [
    photo('why-does-polyester-smell-more-after-a-workout', 32033155,
      'A smiling man in a red and black sports t-shirt and cap against a white wall',
      'Synthetic sportswear: comfortable to sweat in, harder to get the smell out of.', '50% 30%'),
    dia('what-did-researchers-actually-find', 'compare', {
      kicker: 'Callewaert et al.', title: 'Polyester vs cotton after a spinning session',
      cols: [
        { name: 'Polyester shirts', tag: 'After incubation', lines: ['Rated more intense', 'Rated less pleasant', 'Different bacterial growth'] },
        { name: 'Cotton shirts', tag: 'After incubation', pick: true, lines: ['Rated less intense', 'Still smell when worn repeatedly or left damp', 'Release more in the wash'] },
      ],
      note: '26 healthy people, cotton and synthetic shirts, published in Applied and Environmental Microbiology.',
    }),
  ],

  'why-shirt-zones-smell-after-washing': [
    photo('why-the-collar-still-smells-after-washing', 7561904,
      'Black-and-white close-up of a man’s open-collar white shirt',
      'A collar is a sebum ring. The inner band sits against neck oil all day.', '50% 40%'),
    dia('band-fold-placket-three-collar-soils', 'steps', {
      kicker: 'One collar, three soils', title: 'Band, fold, placket',
      items: [
        ['Inner band', 'Touches the neck; sebum soaks in with nowhere to rinse to.'],
        ['Fold', 'The crease is a capillary: soil wicks up and sits in a line.'],
        ['Placket', 'Two overlapping layers: a pocket the rinse does not always empty.'],
      ],
      note: 'Treat the collar as one stain and you will keep missing it.',
    }),
  ],

  'why-sweat-smells-stronger-on-some-shirts': [
    photo('fibre-is-a-layer-not-a-verdict', 250288,
      'A rail of button-down shirts in blue, green and mustard',
      'Same sweat, different shirt, different afternoon.', '50% 50%'),
    dia('the-loudness-stack', 'compare', {
      kicker: 'The loudness stack', title: 'What makes one shirt louder than another',
      cols: [
        { name: 'Louder', tag: 'Two or three at once', lines: ['Oil-loving synthetic, dense knit', 'Clogged wicking coat or softener film', 'Slim fit, jacket on all afternoon', 'Last week’s residue, quick wash'] },
        { name: 'Quieter', tag: 'What you can change', pick: true, lines: ['A fibre that wets and rinses well', 'An open finish, no softener', 'Ease in the armhole, air moving', 'A proper wash and a real dry'] },
      ],
    }),
  ],

  'why-traffic-fumes-cling-to-clothes': [
    photo('particles-plus-volatiles', 16980153,
      'A busy Indian road under a flyover, packed with autos, cars and two-wheelers',
      'Exhaust is particles plus vapour, and the outside of your shirt meets both.', '50% 50%'),
    dia('outer-face-of-the-commute-shirt', 'zones', {
      kicker: 'Outside job', title: 'Where traffic lands on a commute shirt', garment: 'shirt',
      zones: [
        { zone: 'chest', label: 'Chest and front panel', text: 'Faces the plume on a two-wheeler.' },
        { zone: 'outer sleeves', text: 'Outer arms take road air the whole ride.' },
        { zone: 'collar', label: 'Collar edge', text: 'Dust and grey film show here first.' },
        { zone: 'cuffs', text: 'Hands on the handlebar, cuffs in the stream.' },
      ],
      note: 'Sweat is an inside job; traffic is an outside one. Air the outer face first.',
    }),
  ],

  'why-washing-machine-makes-clothes-smell': [
    photo('the-gasket-is-a-dark-wet-fold', 4440652,
      'Clothes spill out of the open door of a front-loading washing machine',
      'A front-loader’s rubber boot holds a ring of water in its folds after every cycle.', '50% 45%'),
    dia('a-maintenance-protocol-that-actually-holds', 'steps', {
      kicker: 'After every wash', title: 'A machine routine that holds',
      items: [
        ['Hang at the beep', 'If you can’t hang now, don’t start the cycle.'],
        ['Wipe the gasket', 'Peel back the folds; dry the ring, lint and film.'],
        ['Door ajar', 'Non-negotiable on a front-loader.'],
        ['Rinse the drawer', 'Weekly. Residue is food.'],
        ['Dose right', 'Detergent to the load and water hardness; skip softener.'],
      ],
    }),
  ],

  'why-water-makes-clothing-odor-louder': [
    photo('what-water-actually-does-to-an-odor-molecule', 30125446,
      'A person with a red umbrella walks down a wet, lamp-lit street at night',
      'Rain, steam or new sweat: water loosens what was parked in the fibre.', '50% 45%'),
    dia('the-two-clocks-on-one-shirt', 'compare', {
      kicker: 'Two clocks', title: 'Why a wet or humid shirt gets louder',
      cols: [
        { name: 'Clock one: volatility', tag: 'Wet again', lines: ['Rain, sweat or bathroom steam', 'Stored odorants loosen and leave the fibre', 'Happens in minutes'] },
        { name: 'Clock two: humidity', tag: 'Bacteria get time', lines: ['Above about 70% relative humidity', 'Sweat lingers on skin and cloth', 'More of it turns into odor'] },
      ],
      note: 'First, stop adding water. Then dry the shirt before you treat it.',
    }),
  ],

  'zinc-pca-fabric-odor-ingredient-guide': [
    photo('how-does-zinc-pca-work-on-odor', 7722923,
      'A ball-and-stick molecule model beside a dropper on a pale grey surface',
      'Zinc ions bind volatile sweat compounds so they stop reaching the air.', '50% 50%'),
    dia('zinc-pca-vs-baking-soda-and-fragrance', 'compare', {
      kicker: 'Which works', title: 'Zinc PCA vs baking soda vs fragrance',
      cols: [
        { name: 'Baking soda', tag: 'Powder', lines: ['Absorbs a little moisture', 'Sits on the surface', 'Has to be brushed out'] },
        { name: 'Fragrance spray', tag: 'Cover', lines: ['Adds a smell on top', 'Pleasant for a while', 'Sweat returns under stale perfume'] },
        { name: 'Zinc PCA', tag: 'Binds', pick: true, lines: ['Binds volatile sweat compounds', 'Works in the fibre', 'Dries clear on fabric'] },
      ],
    }),
  ],

  // 2026-10-26: twenty guides chosen from Indian search demand (Google autocomplete, gl=in).
  'kapdon-se-pasine-ki-badbu-kaise-hataye': [
    photo('badbu-kapde-mein-kahan-rehti-hai', 21835293,
      'Clothes hang on a line to air outside a house, in daylight',
      'Hawa pehla kadam hai: ulta karke 20–30 minute.', '50% 50%'),
    dia('kapdon-mein-pasine-ki-badbu-kyon-aati-hai', 'zones', {
      kicker: 'Teen zones',
      title: 'Badbu poore shirt mein nahi, yahan rehti hai',
      garment: 'shirt',
      zones: [
        { zone: 'collar', label: 'Collar ka andar', text: 'Gardan ka tel aur pasina har baar.' },
        { zone: 'underarms', label: 'Bagal', text: 'Sabse garam aur geela kapda.' },
        { zone: 'upper back', label: 'Upar ki peeth', text: 'Kursi ya seat se dabta hai.' },
      ],
      note: 'Sirf in hisson par 2–3 spray, 15–20 cm door se.',
    }),
  ],

  'remove-smell-from-winter-jacket-without-washing': [
    photo('how-do-you-refresh-a-jacket-between-washes', 6045058,
      'A black padded winter jacket hangs alone on a metal clothes rack in a bright room',
      'Air it open on a wide hanger before you treat the lining.', '50% 45%'),
    dia('where-does-the-smell-sit-in-a-jacket', 'zones', {
      kicker: 'Four spots',
      title: 'Where a winter jacket holds smell',
      garment: 'jacket',
      zones: [
        { zone: 'collar', label: 'Inside collar', text: 'Neck and hair oil every day.' },
        { zone: 'underarm lining', label: 'Underarm lining', text: 'The warmest fabric in the jacket.' },
        { zone: 'back lining', label: 'Back lining', text: 'Pressed against seats for hours.' },
        { zone: 'cuffs', label: 'Cuffs', text: 'Hands, food and the bus rail.' },
      ],
      note: 'A whole jacket takes 5–6 sprays, on the lining only.',
    }),
  ],

  'remove-smell-from-saree-and-blouse-without-washing': [
    photo('how-do-you-remove-storage-smell-from-a-saree', 11733651,
      'A neat stack of folded olive-green fabric lengths in warm light',
      'Unfold, air in shade, refold along new lines.', '50% 50%'),
    dia('which-sarees-should-you-not-spray', 'decide', {
      kicker: 'Before you spray',
      title: 'Which fabric, which fix',
      rows: [
        ['Cotton, linen, georgette, chiffon, blends', 'Air, then treat inside', 'refresh'],
        ['Pure silk (Kanjivaram, Banarasi)', 'Air; patch-test or skip', 'air'],
        ['Zari or heavy embroidery', 'Spot-test or skip', 'air'],
        ['Labelled dry-clean only', 'Leave to the cleaner', 'stop'],
        ['Stained, oily or damp', 'Wash or clean', 'wash'],
      ],
    }),
  ],

  'why-does-sweat-smell-like-onions-vinegar-ammonia': [
    photo('why-does-sweat-smell-like-onions', 4197445,
      'A small ceramic bowl of brown onions on a white marble table',
      'The onion note in sweat is a sulphur compound, the same family that gives onions their smell.', '50% 50%'),
    dia('why-does-the-smell-stay-in-my-shirt-after-i-shower', 'compare', {
      kicker: 'Three smells',
      title: 'Three molecules, three sources',
      cols: [
        {
          name: 'Onion',
          tag: 'Thioalcohols',
          lines: ['Bacteria release sulphur compounds', 'From underarm (apocrine) sweat', 'Worse with stress'],
        },
        { name: 'Vinegar', tag: 'Fatty acids', lines: ['Acetic, propionic, isovaleric acid', 'Sour, cheesy notes', 'Cling to polyester'] },
        {
          name: 'Ammonia',
          tag: 'From the blood',
          lines: ['Rises with long, hard exercise', 'Volatile, fades from skin', 'Lingers in a shirt that dried sweaty'],
        },
      ],
      note: 'All three can stay in fabric after you shower.',
    }),
  ],

  'clothes-left-in-washing-machine-overnight-smell': [
    photo('how-do-you-save-a-load-that-smells-sour', 5591460,
      'A hand presses the controls of a front-loading washing machine with clothes in the drum',
      'Rewash warm, then get the load out the moment it finishes.', '50% 50%'),
    dia('why-do-clothes-smell-after-sitting-in-the-washing-machine', 'decide', {
      kicker: 'Sniff test',
      title: 'Rewash or just dry?',
      rows: [
        ['A few hours, smells clean or faintly damp', 'Rinse and spin, dry now', 'air'],
        ['Overnight, smells sour or musty', 'Rewash with detergent', 'wash'],
        ['A day or more, or visible spots', 'Rewash, check for mildew', 'wash'],
        ['Machine smells even when emptied on time', 'Clean the seal, drawer, filter', 'stop'],
      ],
    }),
  ],

  'remove-deodorant-marks-yellow-sweat-stains': [
    photo('why-do-white-shirts-get-yellow-underarm-stains', 6276005,
      'Close-up of a crisp white button-up shirt with its collar and metal buttons',
      'Yellowing builds up over many wears, fastest in white cotton.', '50% 50%'),
    dia('what-causes-white-deodorant-marks-on-dark-clothes', 'compare', {
      kicker: 'Two stains',
      title: 'White marks and yellow underarms are different problems',
      cols: [
        {
          name: 'White marks',
          tag: 'Dark clothes',
          lines: ['Undried antiperspirant on the surface', 'Rub or wipe off', 'Prevent: let it dry before dressing'],
        },
        {
          name: 'Yellow underarms',
          tag: 'White clothes',
          lines: [
            'Sweat proteins plus residue, over months',
            'Enzyme soak or baking soda paste',
            'Prevent: wash after sweaty wears',
          ],
        },
      ],
      note: 'A fabric odor spray treats smell, not stains.',
    }),
  ],

  'laundry-perfume-vs-fabric-odor-spray': [
    photo('what-do-laundry-perfume-conditioner-and-sanitiser-actually-d', 5591581,
      'A hand pours liquid from a measuring cap into the drawer of a washing machine',
      'Conditioner, perfume and sanitiser all go in here, on wash day.', '50% 50%'),
    dia('what-does-a-fabric-odor-spray-do-differently', 'compare', {
      kicker: 'Wash day vs wear day',
      title: 'What each product is for',
      cols: [
        { name: 'Fabric conditioner', tag: 'In the wash', lines: ['Softness, less static', 'Adds fragrance', 'Can reduce wicking on synthetics'] },
        {
          name: 'Laundry perfume',
          tag: 'In the wash',
          lines: ['Adds more fragrance', 'Covers stale smell for a while', 'Nothing for tomorrow\'s sweat'],
        },
        {
          name: 'Fabric odor spray',
          tag: 'On wear day',
          pick: true,
          lines: ['On a clean, dry shirt', 'Collar, underarms, upper back', 'Works on odor in the fabric'],
        },
      ],
      note: 'Dirty clothes still need a proper wash.',
    }),
  ],

  'how-to-tell-someone-they-have-body-odour': [
    photo('how-do-you-bring-it-up-without-hurting-them', 7156231,
      'Two colleagues talk across a desk in a quiet office, one holding a sheet of paper',
      'Private and short: one conversation, not a campaign.', '50% 45%'),
    dia('what-exactly-can-you-say', 'decide', {
      kicker: 'Who should say it',
      title: 'Pick the right person and the right setting',
      rows: [
        ['Close colleague or friend', 'You, privately, once', 'ok'],
        ['Peer you barely know', 'Their manager or HR', 'air'],
        ['Your team member', 'You, linked to policy, in private', 'ok'],
        ['Flatmate', 'You, about the laundry and the room', 'ok'],
        ['Anyone, by note or group chat', 'Don\'t', 'stop'],
      ],
    }),
  ],

  'how-to-know-if-you-smell-bad': [
    photo('where-does-the-smell-usually-come-from', 16664908,
      'A man in a white shirt adjusts his collar in a room with clothes on a rail behind him',
      'If you shower daily, the collar and underarms of your shirts are the usual suspects.', '50% 40%'),
    dia('how-can-you-check-your-own-smell', 'steps', {
      kicker: 'Five checks',
      title: 'Better than sniffing your own arm',
      items: [
        ['Shirt test', 'Away 15–20 minutes, then smell collar and underarms.'],
        ['Laundry pile', 'Yesterday\'s shirt is roughly you by evening.'],
        ['Second wear', 'A worn, hung-up shirt shows tomorrow\'s problem.'],
        ['Room test', 'Notice your car or cupboard after a few hours away.'],
        ['Ask one person', 'A direct question to someone honest.'],
      ],
    }),
  ],

  'dog-smell-on-clothes': [
    photo('why-does-dog-smell-stick-to-clothes', 10892514,
      'A small black curly-coated dog sits on a warm wooden floor, looking up',
      'Every cuddle moves hair and coat oils onto fabric.', '50% 55%'),
    dia('how-do-you-remove-dog-smell-before-you-leave-the-house', 'steps', {
      kicker: 'Before you leave',
      title: 'The one-minute pet-smell reset',
      items: [
        ['Hair off', 'Lint roller, tape or a damp rubber glove.'],
        ['Shake and air', 'At a window or outdoors.'],
        ['Treat contact zones', 'Chest, lap, forearms: 2–3 sprays each, 15–20 cm.'],
        ['Dry', '15–30 seconds, then go.'],
      ],
      note: 'Drool, mud or urine: wash it instead.',
    }),
  ],

  'teenage-son-body-odour-clothes-parents-guide': [
    photo('how-do-you-deal-with-the-bedroom-and-the-laundry-pile', 19881985,
      'Two laundry baskets full of clothes stand by a wooden door at home',
      'A basket the clothes can breathe in, not a bag and not the floor.', '50% 55%'),
    dia('what-daily-routine-actually-works-for-a-teenager', 'steps', {
      kicker: 'Five minutes',
      title: 'A routine a teenager will follow',
      items: [
        ['Shower', 'Daily, and after sport.'],
        ['Deodorant', 'On clean, dry underarms.'],
        ['Fresh vest and shirt', 'Every day.'],
        ['Sports kit to the wash', 'Same day, never back in the bag.'],
        ['Refresh the layers', 'Hoodie and blazer: collar and underarms.'],
      ],
    }),
  ],

  'should-you-wear-a-vest-under-your-shirt': [
    photo('which-vest-should-you-buy', 11612797,
      'An older man in a white cotton vest smiles on a sunny porch',
      'The cotton banian: an old answer to an old problem.', '50% 35%'),
    dia('what-does-a-vest-actually-do-under-a-shirt', 'bars', {
      kicker: 'ASTM D1909',
      title: 'How much moisture each fibre holds (commercial regain)',
      items: [['Cotton', 8.5, '8.5%', true], ['Polyester', 0.4, '0.4%']],
      note: 'Cotton next to the skin pulls sweat in; polyester leaves it on the surface.',
    }),
  ],

  'how-many-shirts-should-a-man-own-for-office': [
    photo('does-rotating-shirts-make-them-last-longer', 102129,
      'A long row of shirts on wooden hangers in warm, low light',
      'Rotation means fewer washes for every shirt on the rail.', '50% 50%'),
    dia('how-many-work-shirts-do-you-actually-need', 'bars', {
      kicker: 'Quick count',
      title: 'Office shirts for your week',
      items: [
        ['Five-day week, weekly wash', 7, '7'],
        ['Six-day week, weekly wash', 9, '8–9', true],
        ['Hot commute or field work', 11, '9–11'],
        ['Washing twice a week', 6, '5–6'],
      ],
      note: 'Working days plus two or three spares.',
    }),
  ],

  'remove-perfume-smell-from-clothes': [
    photo('how-do-you-get-perfume-out-without-washing', 1122167,
      'White clothes pegged on a line under a blue sky with trees behind',
      'Moving air and time do most of the work.', '50% 50%'),
    dia('why-does-perfume-cling-to-clothes', 'timeline', {
      kicker: 'Fragrance layers',
      title: 'Why perfume lingers on fabric',
      items: [
        ['Minutes', 'Top notes evaporate first: citrus, light florals.'],
        ['Hours', 'Middle notes carry the main character.'],
        ['A day or more', 'Base notes such as musks and resins cling, longest on synthetics and wool.'],
      ],
      note: 'Airing clears the top and middle; a wash clears most of the rest.',
    }),
  ],

  'new-clothes-chemical-smell-wash-before-wearing': [
    photo('which-new-clothes-need-washing-most', 12960395,
      'Close-up of a small white care label on a striped cotton t-shirt',
      'Non-iron, wrinkle-free, easy-care: wash these before the first wear.', '50% 45%'),
    dia('is-formaldehyde-in-clothes-a-concern', 'stats', {
      kicker: 'GAO-10-875, 2010',
      title: 'What a test of 180 textiles found',
      items: [
        ['180', 'items tested: 165 clothing, 15 bed linens'],
        ['10', 'exceeded the strictest industry limits'],
        ['206 ppm', 'the highest: a 100% cotton wrinkle-free dress shirt'],
      ],
      note: 'Washing before wearing often reduces formaldehyde levels.',
    }),
  ],

  'how-often-to-wash-pajamas-nightwear': [
    photo('how-do-you-keep-nightwear-fresh-between-washes', 18063446,
      'Laundry baskets with folded and loose clothes beside a bed in a bedroom',
      'Hang it up in the morning; folded warm under a pillow, it cannot dry.', '50% 55%'),
    dia('what-wear-count-fits-your-nightwear', 'decide', {
      kicker: 'Wear count',
      title: 'When to wash your nightwear',
      rows: [
        ['Cotton, AC, shower before bed', '3–4 wears', 'ok'],
        ['Cotton, fan only, summer', '1–2 wears', 'refresh'],
        ['Polyester or satin', '1–2 wears', 'refresh'],
        ['Heavy night sweats or unwell', 'Every night', 'wash'],
      ],
    }),
  ],

  'grooming-essentials-for-men-india': [
    photo('where-should-you-keep-each-item', 9456810,
      'A straight razor with a wooden handle lies open on a grey surface',
      'Skin and hair stay home; the clothes item travels with you.', '50% 50%'),
    dia('what-is-the-minimum-grooming-kit-for-indian-weather', 'compare', {
      kicker: 'Four jobs',
      title: 'The kit, by job',
      cols: [
        { name: 'Skin', tag: 'Morning and night', lines: ['Face wash', 'Sunscreen, SPF 30+', 'Gel moisturiser, lip balm'] },
        { name: 'Sweat', tag: 'At night', lines: ['Antiperspirant on dry skin', 'Cotton vest under the shirt'] },
        { name: 'Face and hair', tag: 'As needed', lines: ['Trimmer or razor', 'Comb and one product', 'Nail clippers'] },
        { name: 'Clothes', tag: 'In your pocket', pick: true, lines: ['Fabric odour spray', 'Collar and underarms', 'Never on skin'] },
      ],
    }),
  ],

  'return-gifts-for-men-indian-wedding': [
    photo('how-do-you-plan-quantity-and-delivery', 7410461,
      'Small kraft-paper gift boxes tied with pink and green ribbons on a white table',
      'A plain kraft box and a thank-you tag beat shiny packaging.', '50% 55%'),
    dia('what-are-good-return-gift-ideas-for-men', 'decide', {
      kicker: 'By budget',
      title: 'Return gift ideas for men',
      rows: [
        ['Under ₹200: handkerchiefs, dry fruits, notebook, small plant', 'Useful', 'ok'],
        ['₹200–500: travel pouch, card holder, pocket fabric spray', 'Useful', 'ok'],
        ['Names printed large on the item', 'Rarely used', 'air'],
        ['Glass, heavy boxes, strong perfume', 'Avoid', 'stop'],
      ],
    }),
  ],

  'secret-santa-gift-ideas-for-coworkers-india': [
    photo('how-do-you-wrap-and-present-it', 29873592,
      'Two presents wrapped in green and patterned blue paper, tied with white string',
      'Simple wrapping and a one-line note.', '50% 50%'),
    dia('what-should-you-avoid', 'decide', {
      kicker: 'Gift check',
      title: 'Safe or awkward?',
      rows: [
        ['Mug, plant, notebook, tea, cable organiser', 'Safe', 'ok'],
        ['Pocket fabric spray, with a "for the commute" note', 'Safe', 'ok'],
        ['Deodorant, soap or perfume as a joke', 'Awkward', 'stop'],
        ['Diet or appearance-related gifts', 'Awkward', 'stop'],
        ['Alcohol or religious items, if you do not know them', 'Risky', 'air'],
      ],
    }),
  ],

  'first-job-essentials-checklist-freshers-india': [
    photo('why-do-the-first-weeks-matter-so-much', 4308091,
      'Two young Indian colleagues work together at a desk with a laptop and notebook',
      'In the first weeks, impressions form in lifts, meetings and the canteen.', '50% 45%'),
    dia('what-should-you-keep-in-your-desk-drawer', 'steps', {
      kicker: 'Desk drawer',
      title: 'The fresher\'s drawer kit',
      items: [
        ['Work', 'Notebook, two pens, charger, power bank.'],
        ['Water', 'Bottle and mug.'],
        ['Fresh', 'Mints, handkerchief, comb.'],
        ['Shirt', 'Pocket fabric odour spray for the collar.'],
      ],
    }),
  ],
};

export default FIGURES;
