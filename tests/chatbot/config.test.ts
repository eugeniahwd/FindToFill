import {
  RATE_LIMIT_CHAT,
  RATE_LIMIT_WINDOW_SEC,
  REPORT_WINDOW_DAYS,
  STATION_DETECTION_RADIUS_M,
  WALKING_SPEED_MPS,
} from '@/lib/chatbot/config';
import { APP_CONFIG } from '@/lib/config';

describe('chatbot config', () => {
  // If these drift, the Home page and the chatbot can disagree about the user's station.
  it('agrees with the shared app config on the values both define', () => {
    expect(STATION_DETECTION_RADIUS_M).toBe(APP_CONFIG.STATION_DETECTION_RADIUS_M);
    expect(WALKING_SPEED_MPS).toBe(APP_CONFIG.WALKING_SPEED_MPS);
    expect(REPORT_WINDOW_DAYS).toBe(APP_CONFIG.ACTIVE_REPORT_WINDOW_DAYS);
    expect(RATE_LIMIT_WINDOW_SEC).toBe(3600);
    expect(RATE_LIMIT_CHAT).toBe(APP_CONFIG.MAX_CHAT_PER_HOUR);
  });
});
