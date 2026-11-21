import { useCallback, useEffect, useState } from 'react';
import { addPack, parseCollection, type Collection } from './collection';
import type { PulledCard } from './types';

const KEY = 'rb-collection-v1';

function read(): Collection {
  try {
    return parseCollection(localStorage.getItem(KEY));
  } catch {
    return parseCollection(null);
  }
}

export function useCollection() {
  const [collection, setCollection] = useState<Collection>(read);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(collection));
    } catch {
      /* storage full or unavailable — collection lives in memory only */
    }
  }, [collection]);

  const record = useCallback((setId: string, pack: PulledCard[]) => {
    setCollection((c) => addPack(c, setId, pack));
  }, []);

  const reset = useCallback(() => setCollection(parseCollection(null)), []);

  return { collection, record, reset };
}
