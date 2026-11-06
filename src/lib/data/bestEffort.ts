import 'server-only';

/**
 * Runs a follow-up step after the main write succeeded (stamp, rate-limit event).
 * A failure is logged by error type only and replaced with `fallback`.
 */
export async function bestEffort<T>(label: string, task: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await task();
  } catch (err) {
    console.error(`${label} failed:`, err instanceof Error ? err.name : typeof err);
    return fallback;
  }
}
