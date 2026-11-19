/**
 * src/lib/chatbot/clock.ts
 *
 * The clock seam (docs/AI_TRACK.md §3.3): tests and the eval pin the time, so report ages and
 * next departures are reproducible.
 */

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

export function fixedClock(time: Date): Clock {
  return { now: () => new Date(time.getTime()) };
}
