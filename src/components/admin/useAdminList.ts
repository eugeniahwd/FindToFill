'use client';

import { useEffect, useState } from 'react';

export type LoadState = 'loading' | 'ready' | 'error';

/**
 * Loads a list whenever `key` changes (for example the selected filters) and ignores
 * responses for filters the admin already left. `reload()` fetches again.
 */
export function useAdminList<T>(load: () => Promise<T[]>, key: string) {
  const [items, setItems] = useState<T[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let isCurrent = true;
    async function run() {
      setState('loading');
      try {
        const result = await load();
        if (isCurrent) {
          setItems(result);
          setState('ready');
        }
      } catch {
        if (isCurrent) setState('error');
      }
    }
    run();
    return () => {
      isCurrent = false;
    };
    // `load` is recreated every render; `key` captures what it depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  return { items, setItems, state, reload: () => setAttempt((n) => n + 1) };
}
