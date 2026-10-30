export type UserRole = 'commuter' | 'admin';

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
}

export type FacilityType = 'water' | 'charging';

export type ReportStatus = 'available' | 'empty' | 'broken' | 'under_maintenance';

export type EffectiveStatus = ReportStatus | 'unknown';

export interface Station {
  id: string;
  name: string;
  lines: string[];
  latitude: number;
  longitude: number;
  isPilot: boolean;
  isDemoData?: boolean;
}

export interface StationLayout {
  id: string;
  stationId: string;
  level: string;
  imageUrl?: string;
  notes?: string;
}

export interface Facility {
  id: string;
  stationId: string;
  type: FacilityType;
  name: string;
  platform?: string;
  locationDetail?: string;
  level?: string;
  latitude: number;
  longitude: number;
  layoutX?: number; // 0 to 100 percent
  layoutY?: number; // 0 to 100 percent
  isActive: boolean;
  isDemoData?: boolean;
}

export interface Report {
  id: string;
  facilityId: string;
  userId: string;
  userName?: string;
  status: ReportStatus;
  photoUrl: string;
  note?: string;
  createdAt: string; // ISO string
  removedAt?: string | null;
  removedBy?: string | null;
}

export interface Review {
  id: string;
  facilityId: string;
  userId: string;
  userName?: string;
  rating: number; // 1 to 5
  comment: string;
  createdAt: string;
  removedAt?: string | null;
  removedBy?: string | null;
}

export interface Favorite {
  userId: string;
  stationId: string;
  createdAt: string;
}

export interface Stamp {
  userId: string;
  facilityId: string;
  stationId?: string;
  stampedAt: string;
}

export interface FacilityWithStatus extends Facility {
  currentStatus: EffectiveStatus;
  lastReportedAt: string | null;
  lastPhotoUrl: string | null;
  distanceMeters?: number;
  walkTimeMin?: number;
  activeReportCount: number;
}

export type QuickMessageId =
  | 'nearest_water'
  | 'nearest_charging'
  | 'facility_working'
  | 'time_to_refill'
  | 'review_summary';

export interface QuickMessage {
  id: QuickMessageId;
  text: string;
}

export interface ChatAnswerCard {
  facilityId: string;
  facilityName: string;
  stationName: string;
  locationDetail: string;
  distanceMeters: number;
  status: EffectiveStatus;
  lastReportedAt: string | null;
  photoUrl?: string;
}

export interface ChatResponse {
  outcome: 'answered' | 'fallback_no_data' | 'fallback_ai_unavailable' | 'rejected';
  message: string;
  card?: ChatAnswerCard;
  scheduleReminder?: boolean;
  detectedStation?: string;
  generatedAt: string;
}
