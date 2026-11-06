/**
 * src/lib/chatbot/identity.ts
 *
 * Rate-limit identity (docs/AI_TRACK.md §13): SHA-256 of the client IP plus RATE_LIMIT_SALT.
 * The raw IP is never stored or logged.
 */

import 'server-only';

import { createHash } from 'node:crypto';

// Only for local stub mode. Live mode must set RATE_LIMIT_SALT; this value is public in the repo.
const DEV_RATE_LIMIT_SALT = 'findtofill-dev-salt';

// Vercel sets x-forwarded-for to the real client IP; the first entry is the client.
function getClientIp(headers: Headers): string {
  const forwardedFor = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwardedFor || headers.get('x-real-ip')?.trim() || 'unknown';
}

export function getIdentityKey(headers: Headers): string {
  const salt = process.env.RATE_LIMIT_SALT || DEV_RATE_LIMIT_SALT;
  return createHash('sha256').update(`${getClientIp(headers)}|${salt}`).digest('hex');
}
