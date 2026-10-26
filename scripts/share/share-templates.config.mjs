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
  'fabric-deodorizer-spray-india-guide-2026': {
    wa: 'If you\'re buying a fabric spray, read the five things that actually matter first. Written by a brand that sells one and says so up front: {url}',
    x: 'Masking adds a smell. Binding removes one. Almost every disappointment in the fabric-spray category comes from buying the first while expecting the second — and the ingredient list tells you which.',
  },

  /* ---- science and ingredients --------------------------------------- */

  'hpbcd-cyclodextrin-fabric-odor': {
    wa: 'The actual reason some sprays remove smell instead of covering it — the molecule gets trapped inside a ring and never reaches your nose: {url}',
    x: 'HPβCD is a sugar ring with a water-repelling cavity. Odor molecules are oily, they fit inside, and a molecule sitting in a ring is not travelling to your nose. That is binding, not masking.',
  },
  'zinc-pca-fabric-odor-ingredient-guide': {
    wa: 'Zinc PCA — the second half of how fabric sprays work. Traps first, neutralises what\'s left: {url}',
    x: 'Zinc PCA neutralises odor compounds rather than trapping them, which is why a good fabric formula uses more than one mechanism. Odor is not one compound, so one active was never going to do it.',
  },
  'odorstrike-ingredients': {
    wa: 'The key actives in ODORSTRIKE, plus the three things deliberately left out and why each one failed: {url}',
    x: 'The three key actives in ODORSTRIKE, plus the three ingredients that were deliberately left out — glycerine among them, because on fabric a humectant leaves a tacky patch that then collects dust.',
  },
  'what-is-fabric-odor-eliminator': {
    wa: 'Turns out this is a third category — deodorant for clothes, not for your body, and not perfume. Goes on the shirt, not on you: {url}',
    x: 'A fabric odor eliminator is a third spray: body deodorant works on skin, perfume adds scent, this one works on the cloth. Confusing the three is why people buy the wrong thing and blame the category.',
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
  'remove-smell-from-clothes-without-washing': {
    wa: 'Sweat sits in the collar, curry and smoke sit on the front, musty smell is everywhere. Treat the right place and most clothes need no wash: {url}',
    x: 'Most clothes that smell are not dirty. Sweat soaks the collar and underarms from inside; food and smoke land on the outside front. Treat the zone, not the whole shirt.',
  },
  'keep-office-trousers-fresh-without-washing': {
    wa: 'Four zones on the inside of your formals carry almost all of it. Everyone responds by washing the whole trouser, which is what kills the waistband: {url}',
    x: 'Waistband, inner thigh seams, collar lining, cuffs. Four zones on the inside of formal wear produce nearly all the smell, and the standard response is to wash the entire garment every night.',
  },

  /* ---- the 2026-10-15 series: twenty guides for Indian buyers -------- */

  'firecracker-smoke-smell-out-of-clothes-diwali': {
    wa: 'Kurta smelling of crackers since last night? Air it, brush it, then treat four zones. Don\'t put perfume on top. Guide: {url}',
    x: 'Cracker smoke is mostly sulphur-carrying dust, and woven cotton or silk catches it like a filter. Shake and brush first, then treat what is left in the weave.',
  },
  'gifts-for-men-under-500-india': {
    wa: 'If you\'re stuck on a gift under ₹500 for Diwali or Bhai Dooj, this list is all daily-use stuff, no showpieces: {url}',
    x: 'The test for a cheap gift: will he touch it once a day for three months, and is it something he\'d never buy for himself? Most ₹500 gift boxes fail both.',
  },
  'how-many-times-wear-shirt-before-washing': {
    wa: 'Settles the "can I wear this shirt again" question for Indian weather, garment by garment: {url}',
    x: 'Wear-count charts were written for cool countries. In Indian humidity a formal shirt over a vest gets two wears at most, a t-shirt one, jeans about three.',
  },
  'stop-sweat-smell-job-interview': {
    wa: 'Interview coming up? This has the night-before routine and the 5-minute reset outside the room so you don\'t walk in smelling of sweat: {url}',
    x: 'Interview nerves trigger the apocrine glands, the ones whose sweat skin bacteria turn into the strongest smell. Antiperspirant the night before, cotton shirt, reset the collar before you walk in.',
  },
  'clothes-perfume-spray-vs-fabric-odor-spray': {
    wa: 'Before you buy another "cloth perfume": it just layers scent over the smell. This explains the difference from an odor spray: {url}',
    x: 'Clothes perfume and fabric odor sprays sit at the same price on the same shelf. One adds fragrance; the other traps the odor molecules already in the fabric. Read the verbs on the label.',
  },
  'attar-on-clothes-vs-fabric-odor-spray': {
    wa: 'Attar on a sweaty kurta just covers it. Clear the smell first, let it dry, then attar on the cuff. This explains why: {url}',
    x: 'Attar lasts so long because it is fragrance in oil, not alcohol. That also means it covers sweat odor without removing it, and it can leave an oil mark on silk.',
  },
  'does-ironing-remove-smell-from-clothes': {
    wa: 'That burst of sweat smell when you iron a worn shirt? Heat is releasing it, not removing it. Spray first, iron after: {url}',
    x: 'Ironing a worn shirt makes the smell louder because heat speeds up evaporation of what is already in the fibres. It fades, then comes back once you wear it.',
  },
  'remove-smell-from-thrifted-clothes': {
    wa: 'Got a thrift find that smells of someone else\'s cupboard? This tells you which smell it is and how to clear it: {url}',
    x: 'Thrifted clothes carry one of four smells: storage, the last owner\'s sweat, their perfume, or damp. Each needs a different fix, and polyester holds the sweat one longest.',
  },
  'keep-work-uniform-fresh-between-washes': {
    wa: 'If you wear a uniform six days a week with two sets, this routine keeps it fresh between washes: {url}',
    x: 'Uniforms smell faster than your own clothes for three reasons: polyester-viscose blends hold odor, ten-hour shifts, and two sets for a six-day week.',
  },
  'bike-commute-sweat-smell-office': {
    wa: 'For anyone who rides a bike or scooter to office: what to wear on the ride and a 5-min washroom reset so the shirt stays fresh: {url}',
    x: 'A two-wheeler commute hits your shirt with sun, engine heat, a pressed-on backpack, a damp helmet collar and exhaust. Keep the office shirt off your body for the ride.',
  },
  'is-fabric-odor-spray-worth-it-india': {
    wa: 'Did the maths on a fabric spray vs rewashing: about ₹2.29 per refresh, and when it\'s NOT worth buying: {url}',
    x: 'A ₹229 fabric spray works out to about ₹2.29 per refresh. A top-loader is allowed up to 23 litres of water per kg per cycle under BEE rules. Different jobs, but the gap is real.',
  },
  'how-long-does-fabric-odor-spray-last': {
    wa: 'Straight answer on how long a fabric spray lasts on a shirt, what shortens it, and how long the bottle lasts: {url}',
    x: '"Long-lasting" means nothing without conditions. A fabric odor spray deals with the odor present; your body keeps making new odor all day, so heat, sweat and polyester shorten the window.',
  },
  'are-fabric-sprays-safe-label-check-india': {
    wa: 'How to read a fabric spray label in India, and the claims that should make you suspicious: {url}',
    x: 'Every packaged spray sold in India must name its maker and address, net quantity, MRP, month of manufacture and a customer-care contact. No maker named, no purchase.',
  },
  'keep-linen-shirts-cotton-kurtas-fresh-summer': {
    wa: 'Why a cotton kurta or linen shirt can smell by evening even though it breathes, and how to keep it fresh: {url}',
    x: 'Linen takes up about 12% moisture, cotton about 8.5%, polyester under 1%. That is why natural fibres feel cool, and why they still hold sweat by evening.',
  },
  'stay-fresh-in-heatwave-north-india': {
    wa: 'For anyone in Delhi/Jaipur/Lucknow/Nagpur heat: why dry heat still makes shirts smell, and a day routine that works: {url}',
    x: 'In dry 45°C heat, sweat evaporates fast so you never feel wet, but its salts and oils stay in the shirt. That is why a shirt that never felt damp smells by 4 pm.',
  },
  'does-food-change-sweat-smell-garlic-methi': {
    wa: 'Does Indian food make your sweat smell? Methi does (it\'s a real compound called sotolon). Garlic surprised researchers: {url}',
    x: 'In a 2016 study, 82 raters scored men\'s armpit odor as MORE pleasant after the men ate more garlic. Methi is the food that really does come through sweat, via a compound called sotolon.',
  },
  'wash-clothes-less-save-water-india': {
    wa: 'Water is short in most Indian cities. Which clothes really need washing after every wear, and which don\'t: {url}',
    x: 'BEE star-label rules let a top-loader use up to 23 litres of water per kg of laundry per cycle. Jeans worn three hours in AC do not need that. Gym clothes do.',
  },
  'how-to-smell-good-all-day-men-india': {
    wa: 'Smelling good all day in Indian heat is three jobs: skin, clothes, scent. Most of us only do one. Full routine: {url}',
    x: 'Deodorant handles skin. Perfume adds a scent on top. Neither deals with the shirt, which is where the 4 pm smell usually comes from.',
  },
  'freshen-up-after-work-before-going-out': {
    wa: 'Going straight from office to dinner or a function? A 10-min washroom plan for your shirt, skin and hair: {url}',
    x: 'By evening, most of the smell is in your shirt, not on your skin. Perfume added on top just sits on it. Sort the shirt first, perfume last.',
  },
  'remove-smell-from-sweater-without-washing': {
    wa: 'Washing a sweater every few wears ruins it. How to keep it fresh through a north Indian winter without washing: {url}',
    x: 'Wool absorbs moisture vapour and resists body odor; most budget sweaters in India are acrylic, which holds it like polyester. That decides how often you refresh.',
  },

  // 2026-10-26: twenty guides chosen from Indian search demand (Google autocomplete, gl=in).
  'kapdon-se-pasine-ki-badbu-kaise-hataye': {
    wa: 'Kapdon se pasine ki badbu, bina dhoye kaise hataye — simple Hinglish mein 10 minute ka tareeka: {url}',
    x: 'Pasine ki badbu skin par nahi, kapde ke collar, bagal aur peeth mein baithti hai. Hawa do, sirf un zones ko treat karo, sukhne do.',
  },
  'remove-smell-from-winter-jacket-without-washing': {
    wa: 'If your winter jacket smells of the commute and dinner: the lining is the problem, not the shell. How to refresh it without washing: {url}',
    x: 'Jacket smell sits in four places: collar, underarm lining, back lining and cuffs. Air it inside out, treat the lining, let it dry before you zip up.',
  },
  'remove-smell-from-saree-and-blouse-without-washing': {
    wa: 'For anyone with a blouse that smells after one wear, or a saree that smells of the almirah: what to do without washing, and which silks to leave alone: {url}',
    x: 'Blouse smell is sweat, held tight against the underarms. Saree smell is usually storage air. Different fixes: treat the blouse panels, air the saree in shade.',
  },
  'why-does-sweat-smell-like-onions-vinegar-ammonia': {
    wa: 'Ever wondered why sweat sometimes smells like onions and sometimes like vinegar? Three different molecules, three reasons: {url}',
    x: 'Onion-smelling sweat is a thioalcohol bacteria release from underarm sweat. Vinegar is short-chain fatty acids. Ammonia rises with long, hard exercise. All three stick to polyester.',
  },
  'clothes-left-in-washing-machine-overnight-smell': {
    wa: 'Left a wash in the machine overnight? This tells you when you must rewash and how to stop the sour smell coming back: {url}',
    x: 'The "wet dishcloth" laundry smell has been traced to one bacterium, Moraxella osloensis, which survives drying and UV. A load left wet overnight is ideal for it.',
  },
  'how-to-tell-someone-they-have-body-odour': {
    wa: 'If you have ever needed to tell someone they smell and didn\'t know how: kind scripts for colleagues, flatmates and family: {url}',
    x: 'People usually cannot smell their own body odour: the nose adapts to constant smells. Telling them once, privately and kindly, is the considerate thing.',
  },
  'how-to-know-if-you-smell-bad': {
    wa: 'Can\'t tell if you smell? You are the worst person to judge, because your nose adapts. Five honest checks that actually work: {url}',
    x: 'You cannot reliably smell yourself: the nose habituates to constant odours. The better check is your shirt, after 15 minutes away from it.',
  },
  'dog-smell-on-clothes': {
    wa: 'For dog people: how to get the dog off your office clothes in a minute before you leave, and what needs a real wash: {url}',
    x: 'Dog smell travels on hair and coat oils, and is strongest when the dog is damp. Hair first, then air, then treat the chest and lap. Never spray the dog.',
  },
  'teenage-son-body-odour-clothes-parents-guide': {
    wa: 'For parents of teenage boys: why the smell starts, how to bring it up without a fight, and a 5-minute routine he will actually follow: {url}',
    x: 'Teenage body odour starts when puberty switches on the apocrine sweat glands. Most of the fix is the clothes: fresh vest daily, sports kit straight to the wash, hoodies aired.',
  },
  'should-you-wear-a-vest-under-your-shirt': {
    wa: 'The old banian advice holds up: a cotton vest takes the sweat before your shirt does. Which vest to buy and when to skip it: {url}',
    x: 'Cotton\'s moisture regain is about 8.5%; polyester\'s is 0.4%. That is why a cotton vest under a poly-blend shirt keeps the shirt drier and less smelly.',
  },
  'how-many-shirts-should-a-man-own-for-office': {
    wa: 'Running out of clean office shirts by Thursday? A simple way to count how many you need for Indian weather and your laundry day: {url}',
    x: 'Working days plus two or three spares. Spares cover the monsoon week, the stain and the tailor. Rotation also halves the washes on every good shirt.',
  },
  'remove-perfume-smell-from-clothes': {
    wa: 'Too much perfume on a shirt, or a jacket that smells of someone else\'s cologne? What actually gets it out: {url}',
    x: 'Perfume base notes are designed to cling, and on fabric they cling longer than on skin. Moving air, time and a wash without conditioner do the work. Another spray on top does not.',
  },
  'new-clothes-chemical-smell-wash-before-wearing': {
    wa: 'That sharp smell on new clothes is finishing chemicals, not the cotton. What a US government test of 180 garments found, and why to wash first: {url}',
    x: 'In a GAO test of 180 textiles, 10 exceeded the strictest industry formaldehyde limits; the highest was a 100% cotton wrinkle-free dress shirt. Wash new clothes before wearing.',
  },
  'how-often-to-wash-pajamas-nightwear': {
    wa: 'Same night suit all week? Here is a sensible wear count for Indian weather, and how to keep nightwear fresh between washes: {url}',
    x: 'The US cleaning industry says wash pajamas every 3–4 wears. In an Indian summer without AC, it is 1–2. Folding a warm night shirt under the pillow is the real mistake.',
  },
  'grooming-essentials-for-men-india': {
    wa: 'A short, honest grooming list for Indian weather: nine things, what each is for, and what to skip: {url}',
    x: 'Most men\'s grooming kits cover skin and hair and miss the clothes. In Indian heat, the afternoon smell is usually the shirt, not the man.',
  },
  'return-gifts-for-men-indian-wedding': {
    wa: 'Planning return gifts for the men at a wedding? Ideas they will actually use, by budget, and how to plan quantity and delivery: {url}',
    x: 'Gift research: givers focus on the unwrapping, recipients on how useful a gift is over time. For wedding return gifts, that means practical, everyday, decent quality.',
  },
  'secret-santa-gift-ideas-for-coworkers-india': {
    wa: 'Drew someone you barely know for office Secret Santa? Ten gifts under ₹500 that suit almost anyone, and what to avoid: {url}',
    x: 'Secret Santa rule: useful and neutral beats funny and personal. Recipients value how useful a gift is over time more than givers expect.',
  },
  'first-job-essentials-checklist-freshers-india': {
    wa: 'Joining your first office job soon? A practical checklist: documents, clothes, desk drawer, and how to stay fresh after a long commute: {url}',
    x: 'People judge competence and trustworthiness from a face seen for a tenth of a second. In your first weeks, looking put-together at 5 pm is part of the impression.',
  },
  'remove-sweat-smell-from-cap': {
    wa: 'If your cap smells sour inside: it is the sweatband. How to freshen it without washing, and how to wash it without wrecking the brim: {url}',
    x: 'Cap smell comes from one strip of fabric: the sweatband, which soaks up forehead sweat and hair oil and is hung up damp. Dry it first, then treat it.',
  },
  'why-do-sun-dried-clothes-smell-good': {
    wa: 'The sun-dried laundry smell is real chemistry: sunlight on wet fabric makes new scent molecules. What the study found, and which clothes to keep out of the sun: {url}',
    x: 'Copenhagen chemists dried towels in sun, shade and indoors. The sun-dried ones gave off aldehydes and ketones like octanal and nonanal: the "sunshine smell" is made, not uncovered.',
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
