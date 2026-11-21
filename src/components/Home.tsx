import { vars } from '../lib/css';
import { motion } from 'framer-motion';
import { coverCards, THEMES, type LoadedSet } from '../lib/sets';
import { ownedCount, type Collection } from '../lib/collection';
import { PackArt } from './PackArt';
import { sfx } from '../lib/sound';
import { computeStats, type LedgerEntry } from '../lib/ledger';
import { money, packPrice, signedMoney, signedPct } from '../lib/prices';

interface Props {
  sets: LoadedSet[];
  collection: Collection;
  ledger: LedgerEntry[];
  onOpen: (id: string) => void;
  onStats: () => void;
  onCollection: (id: string) => void;
}

export function Home({ sets, collection, ledger, onOpen, onStats, onCollection }: Props) {
  const stats = computeStats(ledger);
  const win = stats.net >= 0;
  return (
    <div className="home">
      <motion.header className="hero" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
        <div className="hero-emblem" aria-hidden />
        <h1>
          <span className="title-main">RIFTBOUND</span>
          <span className="title-sub">Pack Opening</span>
        </h1>
        <p className="tagline">Choose a set. Tear it open. Chase the rift.</p>
        {stats.packs > 0 && (
          <motion.button className={`pl-strip ${win ? 'win' : 'loss'}`} onClick={onStats} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <span className="pl-net">
              {win ? '▲' : '▼'} {signedMoney(stats.net)}
            </span>
            <span className="pl-sep" />
            <span>{signedPct(stats.roi)} ROI</span>
            <span className="pl-sep" />
            <span>{stats.packs.toLocaleString()} packs</span>
            <span className="pl-go">Stats →</span>
          </motion.button>
        )}
      </motion.header>

      <div className="set-row">
        {sets.map((s, i) => {
          const theme = THEMES[s.info.id];
          const owned = ownedCount(collection, s.info.id);
          const pct = Math.round((owned / s.cards.length) * 100);
          const cover = coverCards(s, 1)[0];
          return (
            <motion.div
              key={s.info.id}
              className="set-tile"
              style={vars({ '--c0': theme.colors[0], '--c1': theme.colors[1], '--c2': theme.colors[2] })}
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.1, type: 'spring', stiffness: 120, damping: 16 }}
            >
              <motion.button
                className="set-pack"
                onClick={() => {
                  sfx.tap();
                  onOpen(s.info.id);
                }}
                whileHover={{ y: -14, rotate: i % 2 ? 2 : -2, scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                animate={{ y: [0, -6, 0] }}
                transition={{ y: { duration: 3.5, repeat: Infinity, delay: i * 0.5, ease: 'easeInOut' } }}
                aria-label={`Open ${s.info.name}`}
              >
                <PackArt set={s.info} cover={cover} tilt />
              </motion.button>
              <div className="set-info">
                <h3>{s.info.name}</h3>
                <p className="set-tag">{theme.tagline}</p>
                <p className="set-price">
                  <b>{money(packPrice(s.info.id))}</b> / pack
                </p>
                <div className="progress" title={`${owned} of ${s.cards.length} cards collected`}>
                  <div className="progress-bar" style={{ width: `${pct}%` }} />
                </div>
                <div className="set-meta">
                  <span>
                    {owned}/{s.cards.length} collected
                  </span>
                  <button className="link" onClick={() => onCollection(s.info.id)}>
                    Collection →
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
