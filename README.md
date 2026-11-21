# Riftbound Pack Opener

**Play it:** https://bedinski.github.io/Gamba/

A virtual booster-pack opening experience for the Riftbound TCG: pick a set, choose a pack,
swipe to tear it open, and flip through your pulls one card at a time — with real TCGplayer
market prices, a live pack-value meter, and a profit & loss dashboard.

```
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests (collation, odds, prices, P/L stats, validation)
npm run build    # production build in dist/
npm run preview  # serve the production build at http://localhost:4173/Gamba/
npm run data     # rebuild card data (all sets, or e.g. `npm run data -- RAD`)
npm run prices   # refresh TCGplayer market prices into src/data/prices.json
```

## Deployment

Every push to `main` refreshes prices, runs the tests, builds, and deploys to GitHub Pages via
`.github/workflows/deploy.yml`. To pick up new prices without a code change, run the workflow
manually from the repo's **Actions** tab ("Run workflow").

## Sets

Origins, Spiritforged, Unleashed, Vendetta and Radiance — every set sold in booster packs.

- **Origins, Spiritforged, Unleashed** — card data and official renders from the community
  [Riftcodex API](https://api.riftcodex.com).
- **Vendetta, Radiance** — built from TCGplayer's catalog via [tcgcsv.com](https://tcgcsv.com)
  (Riftcodex has Vendetta incompletely and Radiance not at all).

`scripts/build-data.mjs` normalises both sources (dedupes entries, drops tokens and precon
specials, classifies each card's pack tier) and writes one JSON file per set.

## Prices & profit

`scripts/fetch-prices.mjs` pulls TCGplayer market prices (normal and foil) for every card and
the sealed booster pack price for every set from tcgcsv.com, matching cards by collector number.

- Each pulled card is valued at its foil price if it came out foil, otherwise its normal price.
- A pack "costs" the current booster pack market price.
- Every opened pack is logged (value, cost, best card) in the browser, priced at the moment it
  was opened, which drives the **Stats** screen: net profit, ROI, profitable-pack rate,
  streaks, running profit over time, return by set, and a pack-value histogram.
- Cards worth $5+ get coin effects, $20+ arrive face-down, and $75+ trigger a jackpot reveal.

A unit test simulates thousands of packs per set and checks the expected pack value stays
within a sane multiple of the pack price — a quick tripwire for mis-tiered card data.

## Pack collation

Each pack is 14 cards, per Riot's published layout:

| Slot | Contents |
| --- | --- |
| 7 | Commons (no duplicates within a pack) |
| 3 | Uncommons |
| 1 | Rune slot — basic rune, sometimes foil, rarely alt-art |
| 1 | Foil slot — usually a common/uncommon, can upgrade to rare or epic |
| 2 | Rare-or-better (always foil) |

Rates (one display box = 24 packs): Epic ≈ 1 in 4 packs · Alternate Art ≈ 2 per box ·
Overnumbered ≈ 1 per 3 boxes · Signature ≈ 1 in 10 overnumbers · Ultimate < 0.1% of packs.
These live in `src/lib/packs.ts` and are checked statistically in `src/lib/packs.test.ts`.

## Dev tip

Append `?force=altArt` (or `epic`, `overnumbered`, `signature`, `ultimate`) to the URL in dev mode to
guarantee that tier as the last card and preview its reveal effects.

---

Fan-made simulator, not affiliated with or endorsed by Riot Games or TCGplayer. Card art © Riot Games.
