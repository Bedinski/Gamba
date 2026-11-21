import { vars } from '../lib/css';
import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { THEMES, type LoadedSet } from '../lib/sets';
import { ownedCount, type Collection } from '../lib/collection';
import { TIER_RANK } from '../lib/packs';
import { TIER_STYLE } from '../lib/rarity';
import type { PulledCard, Tier } from '../lib/types';
import { CardView } from './CardView';
import { PriceTag } from './Money';
import { cardPrice, money } from '../lib/prices';

interface Props {
  sets: LoadedSet[];
  setId: string;
  collection: Collection;
  onSet: (id: string) => void;
  onBack: () => void;
  onOpen: () => void;
  onInspect: (p: PulledCard, count: number) => void;
}

type Filter = 'all' | 'owned' | 'missing' | Tier;

export function CollectionView({ sets, setId, collection, onSet, onBack, onOpen, onInspect }: Props) {
  const set = sets.find((s) => s.info.id === setId)!;
  const owned = collection.cards[setId] ?? {};
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<'number' | 'value'>('number');
  const tiers = useMemo(() => [...new Set(set.cards.map((c) => c.tier))].sort((a, b) => TIER_RANK[a] - TIER_RANK[b]), [set]);
  // Rares and up only ever come foil out of a pack, so value them at the foil price.
  const priceOfCard = (c: (typeof set.cards)[number]) => cardPrice(setId, c.id, TIER_RANK[c.tier] >= TIER_RANK.rare);
  const worth = set.cards.reduce((a, c) => a + (owned[c.id] ?? 0) * priceOfCard(c), 0);
  const cards = set.cards
    .filter((c) => {
      if (filter === 'all') return true;
      if (filter === 'owned') return owned[c.id];
      if (filter === 'missing') return !owned[c.id];
      return c.tier === filter;
    })
    .sort((a, b) => (sort === 'value' ? priceOfCard(b) - priceOfCard(a) : 0));
  const count = ownedCount(collection, setId);
  const theme = THEMES[setId];

  return (
    <div className="collection" style={vars({ '--c1': theme.colors[1], '--c2': theme.colors[2] })}>
      <header className="topbar">
        <button className="ghost" onClick={onBack}>
          ← Sets
        </button>
        <div className="tabs">
          {sets.map((s) => (
            <button key={s.info.id} className={`tab ${s.info.id === setId ? 'active' : ''}`} onClick={() => onSet(s.info.id)}>
              {s.info.name}
            </button>
          ))}
        </div>
        <button className="primary small" onClick={onOpen}>
          Open Packs
        </button>
      </header>

      <div className="collection-head">
        <h2>{set.info.name}</h2>
        <div className="progress big">
          <div className="progress-bar" style={{ width: `${(count / set.cards.length) * 100}%` }} />
        </div>
        <p className="hint">
          {count} / {set.cards.length} cards · {collection.packsOpened[setId] ?? 0} packs opened
        </p>
        <p className="collection-worth">
          Collection value <b>{money(worth)}</b>
        </p>
        <div className="filters">
          <button className={`chip sort ${sort === 'value' ? 'active' : ''}`} onClick={() => setSort(sort === 'value' ? 'number' : 'value')}>
            {sort === 'value' ? '💰 Sorted by value' : '# Sorted by number'}
          </button>
          {(['all', 'owned', 'missing'] as Filter[]).concat(tiers).map((f) => (
            <button
              key={f}
              className={`chip ${filter === f ? 'active' : ''}`}
              style={TIER_STYLE[f as Tier] ? vars({ '--tier': TIER_STYLE[f as Tier].color }) : undefined}
              onClick={() => setFilter(f)}
            >
              {TIER_STYLE[f as Tier]?.label ?? f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="collection-grid">
        {cards.map((c, i) => {
          const n = owned[c.id] ?? 0;
          return (
            <motion.button
              key={c.id}
              className={`collection-card ${n ? 'owned' : 'missing'}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.012, 0.6) }}
              onClick={() => n && onInspect({ card: c, foil: TIER_RANK[c.tier] >= TIER_RANK.rare, slot: 'rare' }, n)}
              disabled={!n}
              title={n ? c.name : 'Not yet collected'}
            >
              <CardView card={c} res={300} dim={!n} />
              {n > 1 && <span className="count">×{n}</span>}
              {(n > 0 || sort === 'value') && <PriceTag value={priceOfCard(c)} className="on-card small" />}
              <span className="num">#{c.number}</span>
            </motion.button>
          );
        })}
        {cards.length === 0 && <p className="hint">Nothing here yet — go open some packs!</p>}
      </div>
    </div>
  );
}
