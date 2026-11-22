// Pulls TCGplayer market prices (via tcgcsv.com) for every card and booster pack,
// writing src/data/prices.json. Run with `npm run prices`; CI runs it before each deploy.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { groups, keyFromCardId, keyFromProduct, prices, products } from './tcgcsv.mjs';

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data');
const sets = JSON.parse(readFileSync(join(dataDir, 'sets.json'), 'utf8'));
const allGroups = await groups();

const cents = (n) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null);
const best = (p) => cents(p?.marketPrice) ?? cents(p?.midPrice) ?? cents(p?.lowPrice);

const out = { updatedAt: new Date().toISOString(), source: 'TCGplayer market price via tcgcsv.com', sets: {} };

for (const set of sets) {
  const group = allGroups.find((g) => g.abbreviation === set.id);
  if (!group) {
    console.warn(`${set.id}: no TCGplayer group, skipping`);
    continue;
  }
  const [prods, priceRows] = await Promise.all([products(group.groupId), prices(group.groupId)]);
  const priceBy = new Map();
  for (const row of priceRows) {
    const entry = priceBy.get(row.productId) ?? {};
    entry[row.subTypeName] = row;
    priceBy.set(row.productId, entry);
  }
  const productByKey = new Map();
  for (const p of prods) {
    const k = keyFromProduct(p);
    if (k && !productByKey.has(k)) productByKey.set(k, p);
  }

  const pack = prods.find((p) => p.name === `${group.name} - Booster Pack`) ?? prods.find((p) => /- Booster Pack$/.test(p.name));
  const packRow = pack ? priceBy.get(pack.productId) : null;
  // A "Booster Display" is the 24-pack box.
  const box = prods.find((p) => p.name === `${group.name} - Booster Display`) ?? prods.find((p) => /- Booster Display$/.test(p.name));
  const boxRow = box ? priceBy.get(box.productId) : null;

  const cards = JSON.parse(readFileSync(join(dataDir, `${set.id}.json`), 'utf8'));
  const cardPrices = {};
  let matched = 0;
  for (const c of cards) {
    const product = (c.tcgplayerId && prods.find((p) => p.productId === c.tcgplayerId)) || productByKey.get(keyFromCardId(c.id));
    if (!product) continue;
    const row = priceBy.get(product.productId) ?? {};
    const normal = best(row.Normal);
    const foil = best(row.Foil);
    if (normal === null && foil === null) continue;
    cardPrices[c.id] = [normal, foil, product.productId];
    matched++;
  }

  out.sets[set.id] = {
    pack: best(packRow?.Normal) ?? null,
    packProductId: pack?.productId ?? null,
    box: best(boxRow?.Normal) ?? null,
    boxProductId: box?.productId ?? null,
    cards: cardPrices,
  };
  console.log(`${set.id}: ${matched}/${cards.length} cards priced, pack ${out.sets[set.id].pack ?? 'n/a'}, box ${out.sets[set.id].box ?? 'n/a'}`);
}

writeFileSync(join(dataDir, 'prices.json'), JSON.stringify(out));
