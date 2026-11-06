export const APP_CONFIG = {
  APP_NAME: 'FindToFill',
  TAGLINE: 'Find it. Fill it.',
  
  // Geolocation & Movement
  WALKING_SPEED_MPS: 1.2, // meters per second
  STATION_DETECTION_RADIUS_M: 800, // meters
  
  // Reporting rules
  ACTIVE_REPORT_WINDOW_DAYS: 7,
  ACTIVE_REPORT_WINDOW_MS: 7 * 24 * 60 * 60 * 1000,
  
  // Report photos are in a private bucket; links are short-lived signed URLs.
  SIGNED_PHOTO_URL_TTL_S: 60 * 60,
  // Server-side photo limit (the browser compresses to ~1280 px JPEG first).
  // Note: Vercel caps request bodies at ~4.5 MB, below this limit.
  MAX_PHOTO_BYTES: 5 * 1024 * 1024,
  REPORT_NOTE_MAX_CHARS: 140,
  RATE_LIMIT_WINDOW_MS: 60 * 60 * 1000,

  // Reviews: one per user per facility (editable). Each save embeds the comment.
  REVIEW_COMMENT_MAX_CHARS: 500,
  STATION_REVIEWS_LIMIT: 50,
  // Must match reviews.embedding vector(768) in supabase/migrations.
  EMBEDDING_DIMENSIONS: 768,
  EMBEDDING_TIMEOUT_MS: 3000,

  // Chatbot (Groq). SPEC: answer within 3 s in 90% of runs, hard timeout 10 s, then fallback.
  CHAT_TIMEOUT_MS: 10_000,

  // Rate Limits
  MAX_REPORTS_PER_HOUR: 5,
  // Not in SPEC: protects the free Gemini embedding quota from repeated edits.
  MAX_REVIEWS_PER_HOUR: 10,
  MAX_CHAT_PER_HOUR: 20,
  
  // Contact
  KAI_CONTACT_PHONE: '121',
  KAI_CONTACT_DISPLAY: '121 / 021-121 (Contact Center KAI)',
  
  // Pilot stations
  PILOT_STATION_NAMES: ['Manggarai', 'Tebet', 'Sudirman'] as const,
};
