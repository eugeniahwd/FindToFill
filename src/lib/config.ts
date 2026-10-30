export const APP_CONFIG = {
  APP_NAME: 'FindToFill',
  TAGLINE: 'Find it. Fill it.',
  
  // Geolocation & Movement
  WALKING_SPEED_MPS: 1.2, // meters per second
  STATION_DETECTION_RADIUS_M: 800, // meters
  
  // Reporting rules
  ACTIVE_REPORT_WINDOW_DAYS: 7,
  ACTIVE_REPORT_WINDOW_MS: 7 * 24 * 60 * 60 * 1000,
  
  // Rate Limits
  MAX_REPORTS_PER_HOUR: 5,
  MAX_CHAT_PER_HOUR: 20,
  
  // Contact
  KAI_CONTACT_PHONE: '121',
  KAI_CONTACT_DISPLAY: '121 / 021-121 (Contact Center KAI)',
  
  // Pilot stations
  PILOT_STATION_NAMES: ['Manggarai', 'Tebet', 'Sudirman'] as const,
};
