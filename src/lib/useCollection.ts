import { useCallback, useEffect, useState } from 'react';
import { addPack, parseCollection, type Collection } from './collection';
import { appendEntry, entryFor, parseLedger, type LedgerEntry } from './ledger';
import type { PulledCard } from './types';

const KEY = 'rb-collection-v1';
const LEDGER_KEY = 'rb-ledger-v1';

function read<T>(key: string, parse: (raw: string | null) => T): T {
  try {
    return parse(localStorage.getItem(key));
  } catch {
    return parse(null);
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable — state lives in memory only */
  }
}

export function useCollection() {
  const [collection, setCollection] = useState<Collection>(() => read(KEY, parseCollection));
  const [ledger, setLedger] = useState<LedgerEntry[]>(() => read(LEDGER_KEY, parseLedger));

  useEffect(() => write(KEY, collection), [collection]);
  useEffect(() => write(LEDGER_KEY, ledger), [ledger]);

  /** Add a pack to the collection and the profit ledger (priced at today's market). `cost` overrides the pack price (box breaks). */
  const record = useCallback((setId: string, pack: PulledCard[], cost?: number) => {
    setCollection((c) => addPack(c, setId, pack));
    setLedger((l) => appendEntry(l, entryFor(setId, pack, Date.now(), undefined, cost)));
  }, []);

  const resetLedger = useCallback(() => setLedger([]), []);

  return { collection, ledger, record, resetLedger };
}
