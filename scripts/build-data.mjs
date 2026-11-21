// Fetches card data from the community Riftcodex API and writes normalized
// per-set JSON files into src/data. Run with `npm run data`.
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const API = 'https://api.riftcodex.com';
const BOOSTER_SETS = ['OGN', 'SFD', 'UNL', 'VEN'];
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data');

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return res.json();
}

async function fetchSet(setId) {
  const items = [];
  for (let page = 1; ; page++) {
    const j = await getJson(`${API}/cards?set_id=${setId}&size=100&page=${page}`);
    items.push(...j.items);
    if (page >= j.pages) break;
  }
  return items;
}

/** Collapse duplicate riftbound_ids (keeps the most recently updated entry). */
function dedupe(items) {
  const byId = new Map();
  for (const c of items) {
    const prev = byId.get(c.riftbound_id);
    if (!prev || c.metadata.updated_on > prev.metadata.updated_on) byId.set(c.riftbound_id, c);
  }
  return [...byId.values()];
}

/** Derive the pack "tier" a card belongs to. Returns null for non-booster cards. */
function tierOf(c) {
  const id = c.riftbound_id;
  if (/-t\d/.test(id) || /-sp\d/.test(id)) return null; // tokens / precon specials
  const type = c.classification.type;
  if (type === 'Rune') return c.metadata.alternate_art || /a-/.test(id) ? 'altRune' : 'rune';
  if (/\(Ultimate\)/i.test(c.name)) return 'ultimate';
  if (c.metadata.signature || id.includes('*')) return 'signature';
  // The id suffix is not a reliable set size (Vendetta uses -166), so trust flags/names only.
  if (c.metadata.overnumbered || /\(Overnumbered\)/i.test(c.name)) return 'overnumbered';
  if (c.metadata.alternate_art || /^[a-z]+-\d+a-/.test(id)) return 'altArt';
  const r = c.classification.rarity;
  const map = { Common: 'common', Uncommon: 'uncommon', Rare: 'rare', Epic: 'epic' };
  return map[r] ?? null;
}

function imageUrl(u) {
  const base = u.split('?')[0];
  return base; // sizing params are appended client-side
}

const sets = (await getJson(`${API}/sets`)).items;
mkdirSync(outDir, { recursive: true });
const index = [];
for (const setId of BOOSTER_SETS) {
  const meta = sets.find((s) => s.set_id === setId);
  const raw = dedupe(await fetchSet(setId));
  const cards = raw
    .map((c) => ({ c, tier: tierOf(c) }))
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
      image: imageUrl(c.media.image_url),
      artist: c.media.artist ?? null,
      landscape: c.orientation === 'landscape',
      text: c.text?.plain ?? null,
      flavour: c.text?.flavour ?? null,
    }))
    .sort((a, b) => a.number - b.number || a.id.localeCompare(b.id));
  writeFileSync(join(outDir, `${setId}.json`), JSON.stringify(cards));
  const counts = {};
  for (const c of cards) counts[c.tier] = (counts[c.tier] ?? 0) + 1;
  index.push({ id: setId, name: meta?.name ?? setId, releasedOn: meta?.published_on?.slice(0, 10) ?? null });
  console.log(setId, cards.length, counts);
}
writeFileSync(join(outDir, 'sets.json'), JSON.stringify(index, null, 2));
