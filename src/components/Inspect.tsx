import { vars } from '../lib/css';
import { motion } from 'framer-motion';
import { useEffect } from 'react';
import type { PulledCard } from '../lib/types';
import { TIER_STYLE } from '../lib/rarity';
import { CardView } from './CardView';
import { cardPrice, money, tcgplayerUrl } from '../lib/prices';

export function Inspect({ pull, setId, count, onClose }: { pull: PulledCard; setId: string; count?: number; onClose: () => void }) {
  const { card } = pull;
  const style = TIER_STYLE[card.tier];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <motion.div className="inspect" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} role="dialog" aria-label={card.name}>
      <motion.div
        className="inspect-body"
        initial={{ scale: 0.85, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 22 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="inspect-card">
          <CardView card={card} foil={pull.foil} res={744} tilt />
        </div>
        <div className="inspect-info" style={vars({ '--tier': style.color })}>
          <span className="pill">{style.label}{pull.foil ? ' · Foil' : ''}</span>
          <h2>{card.name}</h2>
          <p className="meta">
            {card.type}
            {card.domains.length > 0 && ` · ${card.domains.join(' / ')}`} · #{card.number}
          </p>
          {card.text && <p className="rules">{card.text.replace(/\)(?=\S)/g, ') ')}</p>}
          {card.flavour && <p className="flavour">“{card.flavour}”</p>}
          <div className="inspect-prices">
            <div>
              <span className="ph-label">Market</span>
              <span className="inspect-price">{money(cardPrice(setId, card.id, false))}</span>
            </div>
            <div>
              <span className="ph-label">Foil</span>
              <span className="inspect-price">{money(cardPrice(setId, card.id, true))}</span>
            </div>
            {tcgplayerUrl(setId, card.id) && (
              <a className="link" href={tcgplayerUrl(setId, card.id)!} target="_blank" rel="noopener noreferrer">
                View on TCGplayer ↗
              </a>
            )}
          </div>
          {card.artist && <p className="meta">Illustrated by {card.artist}</p>}
          {count !== undefined && <p className="meta">Copies owned: {count}</p>}
          <button className="secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
