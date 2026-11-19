/**
 * src/lib/chatbot/validation.ts
 *
 * Request validation for POST /api/chat (docs/AI_TRACK.md §9 step 1). Rejected: unknown ids and
 * any extra field, such as free text or lat/lng (GPS never reaches the server).
 *
 * Answer validation (§9 step 7): the model's final JSON is only used when every facility id and
 * every number comes from this request's tool results and no broken facility is called working.
 */

import { z } from 'zod';
import { MAX_CARDS, MAX_MESSAGE_CHARS } from './config';
import { QUICK_MESSAGE_IDS, type QuickMessageId } from './contract';
import type { Evidence } from './tools/types';

// Supabase station ids are UUIDs and demo ids are slugs; both match.
const STATION_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export const ChatRequestSchema = z
  .object({
    quickMessageId: z.enum(QUICK_MESSAGE_IDS),
    stationId: z.string().regex(STATION_ID_PATTERN).optional(),
    // Chat logs will store the session id, so only a random UUID is accepted, never personal data.
    sessionId: z.string().uuid().optional(),
  })
  .strict();

// ─── Answer validation ────────────────────────────────────────────────────────

export interface ParsedAnswer {
  message: string;
  facilityIds: string[];
}

const FinalAnswerSchema = z.object({
  message: z.string(),
  facility_ids: z.array(z.string()).optional(),
});

/** The {message, facility_ids} JSON in the model's text (code fences or extra text allowed). */
export function parseFinalAnswer(text: string | null | undefined): ParsedAnswer | null {
  if (!text) return null;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let json: unknown;
  try {
    json = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  const parsed = FinalAnswerSchema.safeParse(json);
  if (!parsed.success) return null;
  return { message: parsed.data.message.trim(), facilityIds: parsed.data.facility_ids ?? [] };
}

export type AnswerProblem =
  | 'empty_message'
  | 'too_long'
  | 'url'
  | 'markdown'
  | 'emoji'
  | 'too_many_sentences'
  | 'unknown_facility_id'
  | 'ungrounded_number'
  | 'status_claim';

export interface AnswerCheck {
  ok: boolean;
  problems: AnswerProblem[];
  /** The ids to build cards from: known, deduplicated, at most MAX_CARDS. */
  facilityIds: string[];
}

const URL_PATTERN = /\bhttps?:\/\/|\bwww\./i;
const MARKDOWN_PATTERN = /[*_#`|]|\[[^\]]*\]\([^)]*\)|^\s*[-•]\s/m;
// Built at runtime: the ES2017 target does not allow Unicode property escapes in literals.
const EMOJI_PATTERN = new RegExp('\\p{Extended_Pictographic}', 'u');
const WORD_PATTERN = new RegExp('\\p{L}+', 'gu');
const NUMBER_PATTERN = /\d+(?:[.,]\d+)?/g;
const NUMBER_WORDS: Record<string, number> = {
  nol: 0,
  satu: 1,
  dua: 2,
  tiga: 3,
  empat: 4,
  lima: 5,
  enam: 6,
  tujuh: 7,
  delapan: 8,
  sembilan: 9,
  sepuluh: 10,
};
// Tool result keys whose values are ids or timestamps, not facts the message may repeat.
const NON_FACT_KEYS = new Set(['facility_id', 'station_id', 'id', 'last_reported_at']);
const WORKING_PATTERN =
  /\b(tersedia|berfungsi|bisa dipakai|bisa digunakan|siap dipakai|siap digunakan|normal|lancar)\b/i;
const NEGATIONS = new Set(['tidak', 'belum', 'tak', 'bukan', 'nggak', 'gak', 'enggak', 'tanpa']);

export function checkAnswer(
  answer: ParsedAnswer,
  quickMessageId: QuickMessageId,
  evidence: Evidence,
): AnswerCheck {
  const problems = new Set<AnswerProblem>();
  const message = answer.message;

  if (message.length === 0) problems.add('empty_message');
  if (message.length > MAX_MESSAGE_CHARS) problems.add('too_long');
  if (URL_PATTERN.test(message)) problems.add('url');
  if (MARKDOWN_PATTERN.test(message)) problems.add('markdown');
  if (EMOJI_PATTERN.test(message)) problems.add('emoji');
  if (sentenceCount(message) > 3) problems.add('too_many_sentences');

  const facilityIds =
    quickMessageId === 'review_summary' ? [] : [...new Set(answer.facilityIds)];
  if (facilityIds.some((id) => !evidence.facilities.has(id))) problems.add('unknown_facility_id');

  const allowed = groundedNumbers(evidence.results);
  if (messageNumbers(message).some((n) => !allowed.has(n))) problems.add('ungrounded_number');
  if (claimsWorking(message, evidence)) problems.add('status_claim');

  return {
    ok: problems.size === 0,
    problems: [...problems],
    facilityIds: facilityIds.filter((id) => evidence.facilities.has(id)).slice(0, MAX_CARDS),
  };
}

function sentenceCount(message: string): number {
  const ends = message.match(/[.!?](?=\s|$)/g)?.length ?? 0;
  return /[.!?]\s*$/.test(message) ? ends : ends + 1;
}

/** Every number in tool results, except inside ids and timestamps. */
function groundedNumbers(results: unknown[]): Set<number> {
  const numbers = new Set<number>();
  const visit = (value: unknown, key?: string) => {
    if (key !== undefined && NON_FACT_KEYS.has(key)) return;
    if (typeof value === 'number') {
      numbers.add(value);
    } else if (typeof value === 'string') {
      for (const n of value.match(NUMBER_PATTERN) ?? []) numbers.add(toNumber(n));
    } else if (Array.isArray(value)) {
      value.forEach((item) => visit(item));
    } else if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) visit(v, k);
    }
  };
  results.forEach((result) => visit(result));
  return numbers;
}

/** Digits (Indonesian decimal comma allowed) and number words, except "salah satu". */
function messageNumbers(message: string): number[] {
  const digits = (message.match(NUMBER_PATTERN) ?? []).map(toNumber);
  const words = message.toLowerCase().match(WORD_PATTERN) ?? [];
  const spelled = words
    .filter((word, i) => word in NUMBER_WORDS && !(word === 'satu' && words[i - 1] === 'salah'))
    .map((word) => NUMBER_WORDS[word]);
  return [...digits, ...spelled];
}

function toNumber(text: string): number {
  return Number(text.replace(',', '.'));
}

/** True when a clause calls a facility working although its status is not "available". */
function claimsWorking(message: string, evidence: Evidence): boolean {
  const statuses = [...evidence.statuses.values()];
  const noneAvailable = statuses.length > 0 && statuses.every((s) => s.status !== 'available');
  const notAll = statuses.some((s) => s.status !== 'available');
  const clauses = message.split(/[.!?;]+|,\s*(?:sedangkan|tapi|tetapi|namun)\b/i);

  return clauses.some((clause) => {
    if (!claimsInClause(clause)) return false;
    // "2 dari 6 fasilitas berstatus tersedia" is a count, not a claim about one facility.
    if (/\d+\s+dari\s+\d+/.test(clause)) return false;
    // No status was looked up (for example a review summary): a working claim has no source.
    if (statuses.length === 0) return true;
    if (noneAvailable) return true;
    if (notAll && /\bsemua\b/i.test(clause)) return true;
    for (const [id, facility] of evidence.facilities) {
      const status = evidence.statuses.get(id)?.status;
      if (status !== undefined && status !== 'available' && mentions(clause, facility)) return true;
    }
    return false;
  });
}

/** A working phrase in the clause that is not negated by one of the 6 words before it. */
function claimsInClause(clause: string): boolean {
  const match = WORKING_PATTERN.exec(clause);
  if (!match) return false;
  const before = clause.slice(0, match.index).toLowerCase().match(WORD_PATTERN) ?? [];
  return !before.slice(-6).some((word) => NEGATIONS.has(word));
}

function mentions(clause: string, facility: { name: string; platform: string | null }): boolean {
  const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = facility.platform
    ? new RegExp(`platform\\s+${escape(facility.platform)}(?![\\w/-])`, 'i')
    : new RegExp(escape(facility.name), 'i');
  return pattern.test(clause);
}
