/**
 * Copy generated editorial stills + real product photographs into
 * .thumbnail-sources/ using the slug filenames the encoder expects.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const DEST = path.join(REPO, '.thumbnail-sources');
const IMAGINE = '/workspace/artifacts/imagine_images';
const REFS = '/workspace/artifacts/smelloff-refs';

const MAP = {
  'why-shirt-zones-smell-after-washing.jpg': `${IMAGINE}/954aa24c-0296-4371-b1bc-85ae606b06db.jpg`,
  'why-washing-machine-makes-clothes-smell.jpg': `${IMAGINE}/2c0a5ae1-ec31-46a0-aa80-dd9a730e7d89.jpg`,
  'remove-incense-agarbatti-dhoop-smell.jpg': `${IMAGINE}/7e6075fe-5e71-4c90-9bfc-411f64d9793c.jpg`,
  'remove-cooking-smell-from-clothes.jpg': `${IMAGINE}/e7957782-e648-49ee-ac8a-ed4e6745cefb.jpg`,
  'why-traffic-fumes-cling-to-clothes.jpg': `${IMAGINE}/936c51f6-d869-4a1c-bb2d-ce860e8766ff.jpg`,
  'spray-to-remove-sweat-smell-from-clothes-quickly.jpg': `${IMAGINE}/74d2e071-baf2-4d35-9a99-635aba5ab79b.jpg`,
  'why-sweat-smells-stronger-on-some-shirts.jpg': `${IMAGINE}/a86af888-a2af-44f3-9f68-3dafb1e476a1.jpg`,
  'why-clothes-smell-in-wardrobe-even-when-clean.jpg': `${IMAGINE}/331bb0c5-02d6-4944-82fe-0275e74aec30.jpg`,
  'damp-clothes-musty-smell-monsoon-fix.jpg': `${IMAGINE}/706b1d09-0582-4a78-9a06-93f84d63820a.jpg`,
  'why-water-makes-clothing-odor-louder.jpg': `${IMAGINE}/d8c7bfb8-7d2f-4e41-ac75-3b60d8ac9a00.jpg`,
  'keep-clothes-fresh-without-washing-machine.jpg': `${IMAGINE}/820a1ed6-a9c8-43a2-ae40-da4d8615fa46.jpg`,
  'remove-cigarette-smoke-smell-from-clothes.jpg': `${IMAGINE}/33cd6f4a-d128-47d6-ad1d-88dbe456d2c3.jpg`,
  'keep-office-trousers-fresh-without-washing.jpg': `${IMAGINE}/2b07167c-2549-4d98-bc26-24566a0fa492.jpg`,
  'keep-clothes-fresh-while-travelling.jpg': `${IMAGINE}/587814ab-b768-4a03-a43f-6f8e2a2fff64.jpg`,
  'how-to-pack-sweaty-clothes-without-bag-smell.jpg': `${IMAGINE}/98e737ae-150b-4e2e-bb90-18a4d2a59176.jpg`,
  'wedding-festive-wear-odor-guide.jpg': `${IMAGINE}/f55f27b9-eb0c-4ae1-93d2-87ac382ef580.jpg`,
  'why-clothes-smell-stale-in-ac-room.jpg': `${IMAGINE}/fa61214f-c1f7-4e8f-abcd-475b2c3ed9ed.jpg`,
  'vinegar-baking-soda-fabric-softener.jpg': `${IMAGINE}/63fff457-b288-4198-b724-c5279b4748c3.jpg`,
  'how-often-to-wash-jeans-india.jpg': `${IMAGINE}/a13bd3ee-0140-4d05-8158-9984129f2d42.jpg`,
  'deodorant-perfume-on-fabric.jpg': `${IMAGINE}/6daea13b-c601-4372-91dd-e5a523863a7c.jpg`,
  'how-odor-neutralizer-works-on-fabric.jpg': `${IMAGINE}/616eee48-90e4-45ca-a212-b3e23dc18b7d.jpg`,
  'how-to-freshen-clothes-stored-for-months.jpg': `${IMAGINE}/8a5ddff2-9386-489b-b7ae-5eb69253ec11.jpg`,
  'wash-refresh-or-wear.jpg': `${IMAGINE}/f88497fb-440c-468e-92ed-9883a2fb1721.jpg`,
  'why-body-odor-comes-back-on-clothes-so-quickly.jpg': `${IMAGINE}/c366ca41-aa64-4d2e-9718-2c78ff7bdfb7.jpg`,
  'why-clean-shirt-starts-smelling-within-hours.jpg': `${IMAGINE}/a2b07741-146b-48a2-bc33-bbba9d52b4e3.jpg`,
  'why-clothes-smell-bad-after-drying.jpg': `${IMAGINE}/c3ab83a2-f057-4164-9a61-fa94311f3f17.jpg`,
  'why-clothes-smell-bad-again-after-sweating.jpg': `${IMAGINE}/10fe611f-7958-4795-90dc-269098f30f4a.jpg`,
  'why-clothes-smell-musty-after-being-stored.jpg': `${IMAGINE}/96c1f6d8-b064-4820-bafc-c57ed44ae16e.jpg`,
  'which-fabrics-hold-odor-most.jpg': `${IMAGINE}/8bf5574c-836f-4569-b132-d91641a20eec.jpg`,
  'gym-clothes-smell-after-washing.jpg': `${IMAGINE}/d4d30f41-58f8-4188-8fef-77c704a5de0c.jpg`,
  'does-fabric-spray-stain-clothes.jpg': `${IMAGINE}/0ff0223a-012a-471a-81fe-42863764e823.jpg`,
  'how-to-use-odorstrike.webp': path.join(REPO, 'assets/pdp-03-how-to-use.webp'),
  'odorstrike-review-30-day-india-test.jpg': `${IMAGINE}/a3f75a3f-1b58-470b-8c13-ff685c28aeeb.jpg`,
  'why-i-built-odorstrike.jpg': `${IMAGINE}/f8d0915e-acc6-4f54-85bb-93b2d85d215d.jpg`,
  'fabric-deodorizer-spray-india-guide-2026.jpg': `${IMAGINE}/cc4c4388-914f-40f5-9e1a-2c12f517de68.jpg`,
  'ambi-pur-vs-odorstrike.jpg': `${IMAGINE}/2eaef04b-808e-4da8-abd4-77aa5285305d.jpg`,
  'why-polyester-holds-odor-longer-than-cotton.jpg': `${IMAGINE}/aecc0749-e423-4d02-b1f3-7e5fc5efe4ee.jpg`,
  'dry-air-clothes-indian-home.jpg': `${IMAGINE}/a835649a-9b3d-4e0d-842e-8508e602b443.jpg`,
  'remove-mothball-almirah-smell-from-clothes.jpg': `${IMAGINE}/e25cc965-96fe-44a4-8aaa-59c9ab8a428a.jpg`,
  'odorstrike-vs-febreze-india.jpg': `${IMAGINE}/0a927609-4279-4134-b29c-81f600ac5f25.jpg`,
  'deodorant-vs-fabric-mist.jpg': `${IMAGINE}/7cc118cf-f7f2-4e86-bf43-4811557cc2ae.jpg`,
  'zinc-pca-fabric-odor-ingredient-guide.jpg': `${IMAGINE}/11d4e84d-2457-4c15-a229-d19cd5746f35.jpg`,
  'odor-on-clothes-vs-odor-in-clothes.jpg': `${IMAGINE}/d5aaa9b6-0e18-4c6a-8d6d-00e3af4eed9d.jpg`,
  'hpbcd-cyclodextrin-fabric-odor.jpg': `${IMAGINE}/b7b3bc7e-bf9a-4279-a21d-293106b9f747.jpg`,
  'odorstrike-ingredients.webp': path.join(REPO, 'assets/shot-studio.webp'),
  'what-is-fabric-odor-eliminator.webp': path.join(REPO, 'assets/shot-flatlay.webp'),
  'best-deodorant-spray-for-clothes-not-skin.jpg': `${IMAGINE}/46c9a337-d5ee-464f-8c42-6a9be2fc9b62.jpg`,
  'best-fabric-odor-spray-india-2026-body-odor.jpg': `${IMAGINE}/267e4a12-c8e6-4b1d-9979-d25629da002c.jpg`,
  'remove-smell-from-hoodie-without-washing.jpg': `${IMAGINE}/23db4ad8-26a0-4157-86f8-bb6ac36d148e.jpg`,
  'remove-smell-from-blazer-without-dry-cleaning.jpg': `${IMAGINE}/d90a986e-d231-482c-8b6d-42b58fe9ac52.jpg`,
};

fs.mkdirSync(DEST, { recursive: true });
let n = 0;
for (const [name, from] of Object.entries(MAP)) {
  if (!fs.existsSync(from)) {
    console.error(`MISSING ${from} -> ${name}`);
    process.exitCode = 1;
    continue;
  }
  fs.copyFileSync(from, path.join(DEST, name));
  n++;
}
console.log(`staged ${n} sources into ${DEST}`);
