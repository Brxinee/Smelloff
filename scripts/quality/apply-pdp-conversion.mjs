import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const file = path.join(root, 'odorstrike.html');
const cssHref = '/assets/css/pdp-conversion.css?v=pdp-conv-1';
const START = '<!-- PDP-CONVERSION-LAYER:START -->';
const END = '<!-- PDP-CONVERSION-LAYER:END -->';

const conversionHtml = `${START}
<section class="pdp-conv" aria-labelledby="pdp-conv-problem">
  <div class="pdp-conv__inner">
    <p class="pdp-conv__eyebrow">The problem</p>
    <h2 id="pdp-conv-problem">Your shirt smells.<br>Fix the shirt.</h2>
    <p class="pdp-conv__sub">ODORSTRIKE is made for the gap between “freshly washed” and “I need this shirt to be fine again.” Fabric only. Pocket-sized. No perfume-style positioning.</p>
    <div class="pdp-conv__cards" aria-label="What ODORSTRIKE is for">
      <div class="pdp-conv__card"><strong>When</strong><span>Long commute, long office day, post-workout, travel, meetings or before a date.</span></div>
      <div class="pdp-conv__card"><strong>Where</strong><span>Shirts, tees, hoodies, jackets, blazers, jeans, trousers and similar clothing fabrics.</span></div>
      <div class="pdp-conv__card"><strong>What it isn't</strong><span>Not a body deodorant. Not a perfume. Not for skin. Not a replacement for washing.</span></div>
    </div>

    <p class="pdp-conv__eyebrow" style="margin-top:64px">The routine</p>
    <h2>One shirt.<br>One bad moment.<br>One quick reset.</h2>
    <div class="pdp-conv__steps" aria-label="ODORSTRIKE use flow">
      <div class="pdp-conv__step"><b>01</b><strong>Notice</strong><span>Your clothes picked up unwanted odor during the day.</span></div>
      <div class="pdp-conv__step"><b>02</b><strong>Spray</strong><span>Apply ODORSTRIKE to the fabric zones that need attention.</span></div>
      <div class="pdp-conv__step"><b>03</b><strong>Dry</strong><span>Let the fabric dry before wearing. Follow the product instructions.</span></div>
      <div class="pdp-conv__step"><b>04</b><strong>Go</strong><span>Get back to the plan without adding another body product.</span></div>
    </div>

    <div class="pdp-conv__proof">
      <div>
        <p class="pdp-conv__eyebrow">The promise</p>
        <h2>Control the smell on the fabric.</h2>
        <p class="pdp-conv__sub">The current approved performance language is simple: up to 8 hours of odor protection on fabric under normal office/commute conditions. No exaggerated “instant” guarantee.</p>
        <div class="pdp-conv__cta"><a href="#buy" data-track="pdp_conversion_cta">Buy ODORSTRIKE · ₹229</a><small>50ml · free shipping · COD available</small></div>
      </div>
      <div class="pdp-conv__proofbox">
        <strong>Built for confidence</strong>
        <ul class="pdp-conv__list">
          <li>Fabric only.</li>
          <li>50ml pocket format.</li>
          <li>Current active SKU: OS-001-50ML.</li>
          <li>₹229 prepaid. COD carries the disclosed handling charge.</li>
          <li>7-day return policy, subject to the stated policy conditions.</li>
        </ul>
      </div>
    </div>

    <p class="pdp-conv__eyebrow" style="margin-top:64px">Before you buy</p>
    <h2>Questions you shouldn't have to hunt for.</h2>
    <div class="pdp-conv__objections">
      <div class="pdp-conv__q"><strong>Will it replace washing?</strong><span>No. ODORSTRIKE is an in-between-wash fabric odor-control step, not a substitute for cleaning the garment.</span></div>
      <div class="pdp-conv__q"><strong>Can I spray it on my body?</strong><span>No. It is for fabric only. Never use it on skin, hair or your body.</span></div>
      <div class="pdp-conv__q"><strong>Is it a perfume?</strong><span>No. The product is positioned around fabric odor control, not as a fragrance product.</span></div>
      <div class="pdp-conv__q"><strong>What should I expect?</strong><span>Follow the usage directions on the product page, let the fabric dry, and judge the result on the garment itself.</span></div>
    </div>
  </div>
</section>
${END}`;

function apply() {
  let html = fs.readFileSync(file, 'utf8');

  const before = html;
  html = html.replace(/\n?<!-- PDP-CONVERSION-LAYER:START -->[\s\S]*?<!-- PDP-CONVERSION-LAYER:END -->\n?/g, '\n');

  if (!html.includes(`href="${cssHref}"`)) {
    html = html.replace('</head>', `  <link rel="stylesheet" href="${cssHref}">\n</head>`);
  }

  html = html.replace('</main>', `\n${conversionHtml}\n</main>`);
  if (!html.includes(START)) {
    html = html.replace('</body>', `\n${conversionHtml}\n</body>`);
  }

  const replacements = [
    ['<title>ODORSTRIKE Fabric Odor Spray for Clothes ₹229 | Smelloff</title>', '<title>ODORSTRIKE Fabric Odor Control for Clothes ₹229 | Smelloff</title>'],
    ['<meta name="description" content="Pocket fabric odor spray for clothes — not a perfume, not a deo. Kills sweat smell in seconds, up to 8 hours protection. 50ml · ₹229 · COD across India.">', '<meta name="description" content="Pocket-sized fabric odor control for clothes. Not a perfume, not a deodorant, not for skin. 50ml · ₹229 · up to 8 hours odor protection on fabric.">'],
    ['Pocket fabric odor spray for clothes. Not perfume. Not deodorant. Not body spray. Kills sweat smell in seconds — up to 8 hours odor protection on fabric.', 'Pocket-sized fabric odor control for clothes. Not perfume. Not deodorant. Not body spray. Up to 8 hours odor protection on fabric.'],
    ['A pocket-sized fabric odor remover spray. 50ml mist that kills sweat smell, gym odor, and shirt stink in seconds — HPβCD (cyclodextrin) traps odor molecules, Zinc PCA neutralizes them, Triethyl Citrate prevents new odor, and Zinc Gluconate stops regrowth. Up to 8 hours odor protection on fabric. Glycerine-free, zero residue, dries fast. Not a perfume. Not a deodorant. Fabric-only. Works on cotton, polyester, denim, and wool.', 'A pocket-sized fabric odor-control mist for clothes. 50ml. HPβCD (cyclodextrin) and Zinc PCA are part of the approved product language. up to 8 hours of odor protection on fabric under normal office/commute conditions. Not a perfume. Not a deodorant. Fabric-only.'],
    ['"material":"HPβCD (Cyclodextrin), Zinc PCA, Triethyl Citrate, Zinc Gluconate"', '"material":"HPβCD (Cyclodextrin), Zinc PCA"'],
    ['"name": "How to Eliminate Odor from Clothes Instantly"', '"name": "How to Use ODORSTRIKE on Clothes"'],
    ['"description": "Step-by-step guide to applying ODORSTRIKE fabric spray to eliminate sweat and food smells from clothing."', '"description": "Step-by-step guide to applying ODORSTRIKE to clothing as an in-between-wash fabric odor-control step."'],
    ['"Is the fragrance strong?"','"Is it a fragrance product?"'],
    ['"Very subtle. The fragrance is designed to be barely noticeable — just enough to signal freshness without announcing itself. It fades within a minute, leaving your clothes smelling neutral."','"ODORSTRIKE is positioned around fabric odor control, not as a fragrance product. Do not use it on skin, hair or the body."'],
    ['about 30 seconds', 'long enough for the fabric to dry before wearing'],
    ['~30 seconds', 'after the fabric dries'],
    ['in 30 seconds', 'without promising an exact time'],
    ['in 10 seconds', 'without promising an exact time'],
    ['in seconds', 'without promising an exact time'],
    ['instantly', 'without an instant-performance guarantee'],
    ['Instantly', 'Without an instant-performance guarantee']
  ];
  for (const [from, to] of replacements) html = html.split(from).join(to);

  if (html === before) throw new Error('PDP conversion layer made no changes.');
  fs.writeFileSync(file, html);
}

function check() {
  const html = fs.readFileSync(file, 'utf8');
  const count = (html.match(/<!-- PDP-CONVERSION-LAYER:START -->/g) || []).length;
  if (count !== 1) throw new Error(`Expected exactly one PDP conversion layer, found ${count}.`);
  if (!html.includes(`href="${cssHref}"`)) throw new Error('PDP conversion stylesheet is not linked.');
  if (!html.includes('Your shirt smells.<br>Fix the shirt.')) throw new Error('PDP conversion hero message missing.');
  if (/kills sweat smell in seconds|eliminate odor from clothes instantly/i.test(html)) {
    throw new Error('Legacy instant-performance language remains on the PDP.');
  }
  if (/Triethyl Citrate prevents new odor|Zinc Gluconate stops regrowth/i.test(html)) {
    throw new Error('Unapproved formulation language remains on the PDP.');
  }
  console.log('ODORSTRIKE PDP conversion layer check passed.');
}

const checkOnly = process.argv.includes('--check');
if (checkOnly) check(); else apply();
