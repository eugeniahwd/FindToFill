'use client';

import { useEffect, useState } from 'react';

/** The current time, refreshed every `intervalMs` (default 5 s) while the component is mounted. */
export function useNow(intervalMs = 5000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
