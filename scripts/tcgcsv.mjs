// Helpers for tcgcsv.com — a free daily mirror of TCGplayer's catalog and prices.
export const TCGCSV = 'https://tcgcsv.com/tcgplayer';
export const RIFTBOUND_CATEGORY = 89;

export async function getJson(url, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'riftbound-pack-opener/1.0', Accept: 'application/json' } });
      if (!res.ok) throw new Error(`${res.status} for ${url}`);
      return await res.json();
    } catch (e) {
      if (i >= tries) throw e;
      await new Promise((r) => setTimeout(r, 1000 * i));
    }
  }
}

export async function groups() {
  return (await getJson(`${TCGCSV}/${RIFTBOUND_CATEGORY}/groups`)).results;
}

export async function groupFor(abbreviation) {
  const g = (await groups()).find((x) => x.abbreviation === abbreviation);
  if (!g) throw new Error(`No TCGplayer group for ${abbreviation}`);
  return g;
}

export async function products(groupId) {
  return (await getJson(`${TCGCSV}/${RIFTBOUND_CATEGORY}/${groupId}/products`)).results;
}

export async function prices(groupId) {
  return (await getJson(`${TCGCSV}/${RIFTBOUND_CATEGORY}/${groupId}/prices`)).results;
}

export function ext(product, name) {
  return (product.extendedData ?? []).find((e) => e.name === name)?.value ?? null;
}

// Collector-number key shared by both data sources:
//   card id "ogn-007-298", "ogn-229*-219", "rad-r02a"  →  "7", "229*", "r02a"
//   TCGplayer Number "007/298", "229* / 219", "R02a"    →  same keys
export function keyFromCardId(id) {
  const m = id.match(/^[a-z]+-([^-]+)/i);
  return m ? normKey(m[1]) : null;
}

export function keyFromProduct(product) {
  const n = ext(product, 'Number');
  return n ? normKey(n.split('/')[0]) : null;
}

function normKey(k) {
  return k.toLowerCase().replace(/^0+(?=\d)/, '');
}
