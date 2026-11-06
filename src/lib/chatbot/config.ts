/**
 * src/lib/chatbot/config.ts
 *
 * Chatbot constants (docs/AI_TRACK.md §5), kept out of the shared src/lib/config.ts.
 * tests/chatbot/config.test.ts fails if the values both files define drift apart.
 */

// ─── Walking ──────────────────────────────────────────────────────────────────
// GPS stays in the browser, so station detection radii live in the shared config only.
export const WALKING_SPEED_MPS = 1.2;
export const FILL_BUFFER_MIN = 1;

// ─── Orchestrator limits ──────────────────────────────────────────────────────
export const MAX_TOOL_ITERATIONS = 6;
export const TOOL_TIMEOUT_MS = 3000;
export const HARD_TIMEOUT_MS = 10000;
export const RATE_LIMIT_CHAT = 20; // requests per RATE_LIMIT_WINDOW_SEC
export const RATE_LIMIT_WINDOW_SEC = 3600;

// ─── Output limits and data rules ─────────────────────────────────────────────
export const MAX_MESSAGE_CHARS = 400;
export const MAX_CARDS = 3;
export const REVIEW_SNIPPET_MAX_CHARS = 300;
export const REVIEW_LIMIT = 5;
export const REPORT_WINDOW_DAYS = 7;
export const TIMEZONE = 'Asia/Jakarta';

/** Official KAI Contact number. Stays null until the team verifies it; never guess it. */
export const KAI_CONTACT: string | null = null;

// ─── Route ────────────────────────────────────────────────────────────────────
export const CHATBOT_MODES = ['stub', 'fake', 'live'] as const;
export type ChatbotMode = (typeof CHATBOT_MODES)[number];
export const DEFAULT_CHATBOT_MODE: ChatbotMode = 'stub';
// A valid request body is under 300 bytes; anything larger is rejected unread.
export const MAX_REQUEST_BODY_BYTES = 2048;
