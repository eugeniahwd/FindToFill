import 'server-only';
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { ChatResponse, QuickMessageId } from '@/lib/types';

// chat_logs rows for the chatbot evaluation (docs/AI_CHATBOT.md, orchestration step 9).
// Only these fields exist, so coordinates, review text, and free text cannot be logged.

type AdminDb = SupabaseClient<Database>;

export interface ChatLogEntry {
  sessionId: string;
  /** 'unknown' for a rejected request: never log the raw id the client sent. */
  quickMessageId: QuickMessageId | 'unknown';
  /** Tool names in call order, e.g. ['get_user_location', 'get_nearest_facility']. */
  toolsCalled: string[];
  outcome: ChatResponse['outcome'];
  latencyMs: number;
  stationId: string | null;
}

const SESSION_ID = /^[A-Za-z0-9_-]{8,64}$/;
const TOOL_NAME = /^[a-z_]{1,40}$/;
const MAX_TOOLS = 20;

/** The client's anonymous session id if it looks like one, otherwise a fresh random id. */
export function normalizeSessionId(value: unknown): string {
  return typeof value === 'string' && SESSION_ID.test(value) ? value : randomUUID();
}

/**
 * Writes one chat_logs row with the service-role client (no client access to this table).
 * Never throws: a failed log must not turn an answer into an error.
 */
export async function logChat(admin: AdminDb, entry: ChatLogEntry): Promise<void> {
  try {
    const { error } = await admin.from('chat_logs').insert({
      session_id: normalizeSessionId(entry.sessionId),
      quick_message_id: entry.quickMessageId,
      tools_called: entry.toolsCalled.filter((name) => TOOL_NAME.test(name)).slice(0, MAX_TOOLS),
      outcome: entry.outcome,
      latency_ms: Math.max(0, Math.round(entry.latencyMs)),
      station_id: entry.stationId,
    });
    if (error) console.error('Chat log failed:', error.code ?? 'unknown');
  } catch (err) {
    console.error('Chat log failed:', err instanceof Error ? err.name : typeof err);
  }
}
