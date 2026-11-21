# Riftbound Pack Opener

A virtual booster-pack opening experience for the Riftbound TCG: pick a set, choose a pack,
swipe to tear it open, and flip through your pulls one card at a time.

```
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests (pack collation, odds, validation, collection)
npm run build    # production build in dist/
npm run data     # re-fetch card data from the Riftcodex API into src/data/
```

## Sets

Origins, Spiritforged, Unleashed and Vendetta — every set sold in booster packs.
Card data and official card art come from the community [Riftcodex API](https://api.riftcodex.com);
`scripts/build-data.mjs` normalises it (dedupes entries, drops tokens/precon specials and
classifies each card's pack tier) and writes one JSON file per set.

## Pack collation

Each pack is 14 cards, per Riot's published layout:

| Slot | Contents |
| --- | --- |
| 7 | Commons (no duplicates within a pack) |
| 3 | Uncommons |
| 1 | Rune slot — basic rune, sometimes foil, rarely alt-art (Origins) |
| 1 | Foil slot — usually a common/uncommon, can upgrade to rare or epic |
| 2 | Rare-or-better (always foil) |

Rates (one display box = 24 packs): Epic ≈ 1 in 4 packs · Alternate Art ≈ 2 per box ·
Overnumbered ≈ 1 per 3 boxes · Signature ≈ 1 in 10 overnumbers · Ultimate (Unleashed) < 0.1% of packs.
These live in `src/lib/packs.ts` and are checked statistically in `src/lib/packs.test.ts`.

## Dev tip

Append `?force=altArt` (or `epic`, `overnumbered`, `signature`, `ultimate`) to the URL in dev mode to
guarantee that tier as the last card and preview its reveal effects.

---

Fan-made simulator, not affiliated with or endorsed by Riot Games. Card art © Riot Games.
