import {
  FILL_BUFFER_MIN,
  HARD_TIMEOUT_MS,
  RATE_LIMIT_CHAT,
  RATE_LIMIT_WINDOW_SEC,
  REPORT_WINDOW_DAYS,
  REVIEW_LIMIT,
  REVIEW_SNIPPET_MAX_CHARS,
  TIMEZONE,
  WALKING_SPEED_MPS,
} from '@/lib/chatbot/config';
import { APP_CONFIG } from '@/lib/config';

describe('chatbot config', () => {
  // If these drift, the chatbot and the Backend helpers it calls disagree (distances, limits,
  // schedule time checks, review snippets).
  it('agrees with the shared app config on the values both define', () => {
    expect(WALKING_SPEED_MPS).toBe(APP_CONFIG.WALKING_SPEED_MPS);
    expect(REPORT_WINDOW_DAYS).toBe(APP_CONFIG.ACTIVE_REPORT_WINDOW_DAYS);
    expect(RATE_LIMIT_WINDOW_SEC * 1000).toBe(APP_CONFIG.RATE_LIMIT_WINDOW_MS);
    expect(RATE_LIMIT_CHAT).toBe(APP_CONFIG.MAX_CHAT_PER_HOUR);
    expect(FILL_BUFFER_MIN).toBe(APP_CONFIG.REFILL_MINUTES);
    expect(HARD_TIMEOUT_MS).toBe(APP_CONFIG.CHAT_TIMEOUT_MS);
    expect(REVIEW_LIMIT).toBe(APP_CONFIG.REVIEW_SEARCH_LIMIT);
    expect(REVIEW_SNIPPET_MAX_CHARS).toBe(APP_CONFIG.REVIEW_SNIPPET_MAX_CHARS);
    expect(TIMEZONE).toBe(APP_CONFIG.TIMEZONE);
  });
});
