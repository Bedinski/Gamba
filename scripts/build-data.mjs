// Builds normalized per-set card JSON in src/data.
//   npm run data            → rebuild every set
//   npm run data -- RAD     → rebuild only the listed sets
// Most sets come from the community Riftcodex API (official card renders). Sets Riftcodex
// doesn't cover yet are built from TCGplayer's catalog via tcgcsv.com.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ext, getJson, groupFor, products } from './tcgcsv.mjs';

const RIFTCODEX = 'https://api.riftcodex.com';
const SOURCES = { OGN: 'riftcodex', SFD: 'riftcodex', UNL: 'riftcodex', VEN: 'tcgplayer', RAD: 'tcgplayer' };
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data');

const TIER_BY_RARITY = { Common: 'common', Uncommon: 'uncommon', Rare: 'rare', Epic: 'epic' };

/* ----------------------------------------------------------- Riftcodex */

async function riftcodexCards(setId) {
  const items = [];
  for (let page = 1; ; page++) {
    const j = await getJson(`${RIFTCODEX}/cards?set_id=${setId}&size=100&page=${page}`);
    items.push(...j.items);
    if (page >= j.pages) break;
  }
  // Collapse duplicate riftbound_ids (keeps the most recently updated entry).
  const byId = new Map();
  for (const c of items) {
    const prev = byId.get(c.riftbound_id);
    if (!prev || c.metadata.updated_on > prev.metadata.updated_on) byId.set(c.riftbound_id, c);
  }
  return [...byId.values()]
    .map((c) => ({ c, tier: riftcodexTier(c) }))
    .filter((x) => x.tier)
    .map(({ c, tier }) => ({
      id: c.riftbound_id,
      name: c.name,
      number: c.collector_number,
      tier,
      rarity: c.classification.rarity,
      type: c.classification.type,
      domains: c.classification.domain ?? [],
      tags: c.tags ?? [],
      image: c.media.image_url.split('?')[0], // sizing params are appended client-side
      artist: c.media.artist ?? null,
      landscape: c.orientation === 'landscape',
      text: c.text?.plain ?? null,
      flavour: c.text?.flavour ?? null,
    }));
}

function riftcodexTier(c) {
  const id = c.riftbound_id;
  if (/-t\d/.test(id) || /-sp\d/.test(id)) return null; // tokens / precon specials
  if (c.classification.type === 'Rune') return c.metadata.alternate_art || /a-/.test(id) ? 'altRune' : 'rune';
  if (/\(Ultimate\)/i.test(c.name)) return 'ultimate';
  if (c.metadata.signature || id.includes('*')) return 'signature';
  // The id suffix is not a reliable set size (Vendetta uses -166), so trust flags/names only.
  if (c.metadata.overnumbered || /\(Overnumbered\)/i.test(c.name)) return 'overnumbered';
  if (c.metadata.alternate_art || /^[a-z]+-\d+a-/.test(id)) return 'altArt';
  return TIER_BY_RARITY[c.classification.rarity] ?? null;
}

/* ----------------------------------------------------------- TCGplayer */

async function tcgplayerCards(setId) {
  const group = await groupFor(setId);
  const out = [];
  const seen = new Set();
  for (const p of await products(group.groupId)) {
    const rarity = ext(p, 'Rarity');
    const number = ext(p, 'Number');
    const rawType = ext(p, 'Card Type') ?? '';
    if (!rarity || !number || /Token/i.test(rawType)) continue;
    const tier = tcgplayerTier(p.name, rarity, rawType, number);
    if (!tier) continue;
    const [num, total] = number.split('/');
    let id = total ? `${setId.toLowerCase()}-${num.toLowerCase()}-${total}` : `${setId.toLowerCase()}-${num.toLowerCase()}`;
    if (seen.has(id)) id += `-${p.productId}`; // TCGplayer occasionally reuses a collector number
    seen.add(id);
    out.push({
      id,
      name: p.name,
      number: parseInt(num.replace(/\D/g, ''), 10) || 0,
      tier,
      rarity,
      type: rawType.replace(/^Champion |^Signature /, '').split(';')[0],
      domains: (ext(p, 'Domain') ?? '').split(';').filter(Boolean),
      tags: [],
      image: `https://tcgplayer-cdn.tcgplayer.com/product/${p.productId}`,
      tcgplayerId: p.productId,
      artist: null,
      landscape: false, // TCGplayer stores battlefields pre-rotated to portrait
      text: stripHtml(ext(p, 'Description')),
      flavour: stripHtml(ext(p, 'Flavor Text')),
    });
  }
  return out;
}

function tcgplayerTier(name, rarity, type, number) {
  if (type === 'Rune') return /^R\d+[a-z]$/i.test(number) ? 'altRune' : 'rune';
  // Variant names win over the listed rarity (some alt arts are listed as "Rare").
  if (/\(Ultimate\)/i.test(name)) return 'ultimate';
  if (/Signature\)/i.test(name)) return 'signature';
  if (/Overnumbered\)/i.test(name)) return 'overnumbered';
  if (/Alternate Art\)|Special Art/i.test(name)) return 'altArt';
  return TIER_BY_RARITY[rarity] ?? null;
}

function stripHtml(s) {
  return s ? s.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim() || null : null;
}

/* ----------------------------------------------------------- main */

const wanted = process.argv.slice(2).map((s) => s.toUpperCase());
const setIds = wanted.length ? wanted : Object.keys(SOURCES);
mkdirSync(outDir, { recursive: true });

const indexPath = join(outDir, 'sets.json');
const index = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, 'utf8')) : [];
const riftcodexSets = (await getJson(`${RIFTCODEX}/sets`)).items;

for (const setId of setIds) {
  const source = SOURCES[setId];
  if (!source) throw new Error(`Unknown set ${setId}`);
  const cards = (source === 'riftcodex' ? await riftcodexCards(setId) : await tcgplayerCards(setId)).sort(
    (a, b) => a.number - b.number || a.id.localeCompare(b.id),
  );
  writeFileSync(join(outDir, `${setId}.json`), JSON.stringify(cards));

  let info;
  if (source === 'riftcodex') {
    const meta = riftcodexSets.find((s) => s.set_id === setId);
    info = { id: setId, name: meta?.name ?? setId, releasedOn: meta?.published_on?.slice(0, 10) ?? null };
  } else {
    const g = await groupFor(setId);
    info = { id: setId, name: g.name, releasedOn: g.publishedOn?.slice(0, 10) ?? null };
  }
  const i = index.findIndex((s) => s.id === setId);
  if (i >= 0) index[i] = info;
  else index.push(info);

  const counts = {};
  for (const c of cards) counts[c.tier] = (counts[c.tier] ?? 0) + 1;
  console.log(setId, cards.length, JSON.stringify(counts));
}

index.sort((a, b) => (a.releasedOn ?? '').localeCompare(b.releasedOn ?? ''));
writeFileSync(indexPath, JSON.stringify(index, null, 2));
