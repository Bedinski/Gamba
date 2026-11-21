import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { computeStats, histogram, type LedgerEntry } from '../lib/ledger';
import { money, PRICES, signedMoney, signedPct } from '../lib/prices';
import { THEMES, type LoadedSet } from '../lib/sets';
import { TIER_STYLE } from '../lib/rarity';
import { vars } from '../lib/css';
import type { Card, PulledCard } from '../lib/types';
import { CardView } from './CardView';
import { AnimatedMoney } from './Money';
import { Histogram, NetLineChart, RoiBars } from './charts';

interface Props {
  sets: LoadedSet[];
  ledger: LedgerEntry[];
  onBack: () => void;
  onOpen: (setId: string) => void;
  onReset: () => void;
  onInspect: (p: PulledCard) => void;
}

export function StatsView({ sets, ledger, onBack, onOpen, onReset, onInspect }: Props) {
  const [filter, setFilter] = useState<string>('all');
  const setName = (id: string) => sets.find((s) => s.info.id === id)?.info.name ?? id;
  const findCard = (setId: string, id: string): Card | undefined => sets.find((s) => s.info.id === setId)?.cards.find((c) => c.id === id);

  const stats = useMemo(() => computeStats(ledger, filter === 'all' ? undefined : filter), [ledger, filter]);
  const entries = useMemo(() => (filter === 'all' ? ledger : ledger.filter((e) => e.set === filter)), [ledger, filter]);
  const bins = useMemo(() => histogram(entries.map((e) => e.value), 14), [entries]);
  const avgCost = stats.packs ? stats.spent / stats.packs : 0;
  const win = stats.net >= 0;
  const hitCard = stats.biggestHit ? findCard(stats.biggestHit.set, stats.biggestHit.id) : undefined;
  const bestPackCard = stats.bestPack ? findCard(stats.bestPack.set, stats.bestPack.best.id) : undefined;
  const updated = PRICES.updatedAt ? new Date(PRICES.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'unknown';
  const usedSets = new Set(ledger.map((e) => e.set));

  return (
    <div className="stats">
      <header className="topbar">
        <button className="ghost" onClick={onBack}>
          ← Sets
        </button>
        <div className="topbar-title">
          <span>Profit &amp; Loss</span>
        </div>
        <button className="ghost danger" onClick={() => window.confirm('Reset all profit stats? Your card collection is kept.') && onReset()} disabled={!ledger.length}>
          Reset
        </button>
      </header>

      <div className="stats-body">
        <div className="filters">
          {['all', ...sets.map((s) => s.info.id)].map((id) => (
            <button
              key={id}
              className={`chip ${filter === id ? 'active' : ''}`}
              style={id !== 'all' ? vars({ '--tier': THEMES[id].colors[2] }) : undefined}
              onClick={() => setFilter(id)}
              disabled={id !== 'all' && !usedSets.has(id)}
            >
              {id === 'all' ? 'All sets' : setName(id)}
            </button>
          ))}
        </div>

        {stats.packs === 0 ? (
          <div className="empty">
            <p className="prompt">No packs opened yet</p>
            <p className="hint">Rip some packs and your profit, ROI and best pulls show up here.</p>
            <button className="primary" onClick={() => onOpen(filter === 'all' ? sets[sets.length - 1].info.id : filter)}>
              Open a pack
            </button>
          </div>
        ) : (
          <>
            <motion.section className={`net-hero ${win ? 'win' : 'loss'}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <span className="ph-label">Net profit</span>
              <span className="net-value">
                {win ? '▲' : '▼'} <AnimatedMoney value={stats.net} from={0} duration={1200} signed />
              </span>
              <span className={`net-roi ${win ? 'good' : 'bad'}`}>{signedPct(stats.roi)} return</span>
            </motion.section>

            <div className="tiles">
              <Tile label="Packs opened" value={stats.packs.toLocaleString()} />
              <Tile label="Spent" value={money(stats.spent, true)} />
              <Tile label="Pulled value" value={money(stats.value, true)} />
              <Tile label="Avg pack value" value={money(stats.avgValue)} sub={`vs ${money(avgCost)} cost`} />
              <Tile label="Profitable packs" value={`${Math.round(stats.winRate * 100)}%`} sub={`${Math.round(stats.winRate * stats.packs)} of ${stats.packs}`} />
              <Tile label="Best streak" value={`${stats.bestStreak} 🔥`} sub={stats.streak ? `current: ${stats.streak}` : 'profitable packs in a row'} />
            </div>

            <div className="panels">
              <section className="panel wide">
                <h3>Running profit</h3>
                <p className="panel-sub">Net after each pack opened (pulled value minus pack cost).</p>
                <NetLineChart
                  points={stats.cumulative.map((c) => ({ i: c.i, net: c.net, label: setName(c.entry.set), value: c.entry.value, cost: c.entry.cost }))}
                />
              </section>

              <section className="panel">
                <h3>Return by set</h3>
                <p className="panel-sub">Pulled value vs. spent, per set.</p>
                <RoiBars rows={stats.bySet.map((b) => ({ key: b.set, label: setName(b.set), roi: b.roi, net: b.net, packs: b.packs }))} />
              </section>

              <section className="panel">
                <h3>Pack values</h3>
                <p className="panel-sub">How many packs landed in each value range.</p>
                <Histogram bins={bins} marker={avgCost} markerLabel={`cost ${money(avgCost)}`} />
              </section>

              {stats.biggestHit && hitCard && (
                <section className="panel hit-panel">
                  <h3>Biggest hit</h3>
                  <button className="hit-card" onClick={() => onInspect({ card: hitCard, foil: true, slot: 'rare' })}>
                    <CardView card={hitCard} foil res={400} shimmer />
                  </button>
                  <div className="hit-info">
                    <span className="hit-price">{money(stats.biggestHit.value)}</span>
                    <span className="hit-name">{hitCard.name}</span>
                    <span className="pill" style={vars({ '--tier': TIER_STYLE[hitCard.tier].color })}>
                      {TIER_STYLE[hitCard.tier].label}
                    </span>
                    <span className="hint">{setName(stats.biggestHit.set)}</span>
                  </div>
                </section>
              )}

              {stats.bestPack && (
                <section className="panel hit-panel">
                  <h3>Best pack</h3>
                  {bestPackCard && (
                    <button className="hit-card" onClick={() => onInspect({ card: bestPackCard, foil: true, slot: 'rare' })}>
                      <CardView card={bestPackCard} foil res={400} shimmer />
                    </button>
                  )}
                  <div className="hit-info">
                    <span className="hit-price good">▲ {signedMoney(stats.bestPack.value - stats.bestPack.cost)}</span>
                    <span className="hit-name">
                      {money(stats.bestPack.value)} pulled from a {money(stats.bestPack.cost)} pack
                    </span>
                    <span className="hint">
                      {setName(stats.bestPack.set)} · {new Date(stats.bestPack.t).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </div>
                </section>
              )}

              <section className="panel wide">
                <h3>Recent packs</h3>
                <div className="table-wrap">
                  <table className="recent">
                    <thead>
                      <tr>
                        <th>When</th>
                        <th className="hide-sm">Set</th>
                        <th>Top card</th>
                        <th className="num">Value</th>
                        <th className="num hide-sm">Cost</th>
                        <th className="num">Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries
                        .slice(-15)
                        .reverse()
                        .map((e, i) => {
                          const net = e.value - e.cost;
                          return (
                            <tr key={`${e.t}-${i}`}>
                              <td>{new Date(e.t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</td>
                              <td className="hide-sm">{setName(e.set)}</td>
                              <td className="ellipsis">{findCard(e.set, e.best.id)?.name ?? '—'}</td>
                              <td className="num">{money(e.value)}</td>
                              <td className="num muted hide-sm">{money(e.cost)}</td>
                              <td className={`num ${net >= 0 ? 'good' : 'bad'}`}>
                                {net >= 0 ? '▲' : '▼'} {signedMoney(net)}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </>
        )}
        <p className="hint small">
          Values use TCGplayer market prices (updated {updated}). Each pack is priced when you open it.
        </p>
      </div>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="tile">
      <span className="ph-label">{label}</span>
      <span className="tile-value">{value}</span>
      {sub && <span className="tile-sub">{sub}</span>}
    </div>
  );
}
