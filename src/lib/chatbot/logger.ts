/**
 * src/lib/chatbot/logger.ts
 *
 * The chat log seam (docs/AI_TRACK.md §3.3). One entry per request, with only these fields:
 * never coordinates, review text, message text, or personal data. In supabase mode the route
 * writes entries to chat_logs with the Backend's logChat().
 */

import type { ChatOutcome, QuickMessageId } from './contract';
import type { ChatbotToolName } from './quickMessages';

export interface ChatLogEntry {
  sessionId: string;
  /** "unknown" for a rejected request: the raw id the client sent is never logged. */
  quickMessageId: QuickMessageId | 'unknown';
  toolsCalled: ChatbotToolName[];
  outcome: ChatOutcome;
  latencyMs: number;
  stationId: string | null;
}

export interface ChatLogger {
  log(entry: ChatLogEntry): Promise<void>;
}

export class InMemoryChatLogger implements ChatLogger {
  readonly entries: ChatLogEntry[] = [];

  async log(entry: ChatLogEntry): Promise<void> {
    this.entries.push(entry);
  }
}

/** One line per request for local development. */
export class ConsoleChatLogger implements ChatLogger {
  async log(entry: ChatLogEntry): Promise<void> {
    const tools = entry.toolsCalled.join(',') || '-';
    const latency = Math.round(entry.latencyMs);
    console.info(`[chat] ${entry.quickMessageId} ${entry.outcome} ${latency}ms tools=${tools}`);
  }
}
