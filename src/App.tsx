import { vars } from './lib/css';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { loadSet, SETS, THEMES, type LoadedSet } from './lib/sets';
import { useCollection } from './lib/useCollection';
import { fx } from './lib/fx';
import { isMuted, setMuted } from './lib/sound';
import type { PulledCard } from './lib/types';
import { Home } from './components/Home';
import { Opening } from './components/Opening';
import { CollectionView } from './components/Collection';
import { Inspect } from './components/Inspect';
import { StatsView } from './components/Stats';

type Screen = { name: 'home' } | { name: 'open'; setId: string; nonce: number } | { name: 'collection'; setId: string } | { name: 'stats'; from?: string };

export default function App() {
  const [sets, setSets] = useState<LoadedSet[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [inspect, setInspect] = useState<{ pull: PulledCard; setId: string; count?: number } | null>(null);
  const [muted, setMutedState] = useState(isMuted());
  const { collection, ledger, record, resetLedger } = useCollection();
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    Promise.all(SETS.map((s) => loadSet(s.id)))
      .then(setSets)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => {
    if (!canvas.current) return;
    fx.attach(canvas.current);
    return () => fx.detach();
  }, []);

  const activeSet = screen.name === 'home' || screen.name === 'stats' ? null : screen.setId;
  const colors = activeSet ? THEMES[activeSet].colors : ['#241a4a', '#d9a441', '#9a7bff'];

  useEffect(() => {
    if (screen.name !== 'open') fx.setAmbient(colors[2], screen.name === 'stats' ? 0.08 : 0.35);
  }, [screen.name, colors[2]]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  const open = (setId: string) => setScreen({ name: 'open', setId, nonce: Date.now() });
  const stats = () => setScreen({ name: 'stats' });
  const setOfCard = (cardId: string) => sets?.find((s) => s.cards.some((c) => c.id === cardId))?.info.id ?? '';

  return (
    <div className="app" style={vars({ '--c0': colors[0], '--c1': colors[1], '--c2': colors[2] })}>
      <div className="bg">
        <div className="bg-nebula" />
        <div className="bg-rift" />
        <div className="bg-vignette" />
      </div>
      <canvas ref={canvas} className="fx-canvas" />

      <main>
        {error && (
          <div className="error">
            <h2>Couldn’t load card data</h2>
            <p>{error}</p>
          </div>
        )}
        {!sets && !error && (
          <div className="loading">
            <div className="spinner" />
            <p>Opening the rift…</p>
          </div>
        )}
        {sets && (
          <AnimatePresence mode="wait">
            <motion.div
              key={screen.name === 'open' ? `open-${screen.nonce}` : screen.name + (screen.name === 'collection' ? screen.setId : '')}
              className="screen"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {screen.name === 'home' && (
                <Home sets={sets} collection={collection} ledger={ledger} onOpen={open} onStats={stats} onCollection={(setId) => setScreen({ name: 'collection', setId })} />
              )}
              {screen.name === 'stats' && (
                <StatsView
                  sets={sets}
                  ledger={ledger}
                  onBack={() => setScreen({ name: 'home' })}
                  onOpen={open}
                  onReset={resetLedger}
                  onInspect={(pull) => setInspect({ pull, setId: setOfCard(pull.card.id), count: collection.cards[setOfCard(pull.card.id)]?.[pull.card.id] })}
                />
              )}
              {screen.name === 'open' && (
                <Opening
                  set={sets.find((s) => s.info.id === screen.setId)!}
                  collection={collection}
                  onRecord={record}
                  onExit={() => setScreen({ name: 'home' })}
                  onCollection={() => setScreen({ name: 'collection', setId: screen.setId })}
                  onStats={stats}
                  onInspect={(pull) => setInspect({ pull, setId: screen.setId, count: collection.cards[screen.setId]?.[pull.card.id] })}
                />
              )}
              {screen.name === 'collection' && (
                <CollectionView
                  sets={sets}
                  setId={screen.setId}
                  collection={collection}
                  onSet={(setId) => setScreen({ name: 'collection', setId })}
                  onBack={() => setScreen({ name: 'home' })}
                  onOpen={() => open(screen.setId)}
                  onInspect={(pull, count) => setInspect({ pull, setId: screen.setId, count })}
                />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <AnimatePresence>{inspect && <Inspect key="inspect" pull={inspect.pull} setId={inspect.setId} count={inspect.count} onClose={() => setInspect(null)} />}</AnimatePresence>

      <button
        className="mute"
        onClick={() => {
          setMuted(!muted);
          setMutedState(!muted);
        }}
        aria-label={muted ? 'Unmute sound' : 'Mute sound'}
        title={muted ? 'Unmute' : 'Mute'}
      >
        {muted ? '🔇' : '🔊'}
      </button>

      <footer className="disclaimer">Fan-made simulator · Not affiliated with Riot Games · Card data via Riftcodex &amp; TCGplayer · Prices are TCGplayer market prices · Card art © Riot Games</footer>
    </div>
  );
}
