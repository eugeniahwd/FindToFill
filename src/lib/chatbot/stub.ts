/**
 * src/lib/chatbot/stub.ts
 *
 * Canned ChatResponse objects for CHATBOT_MODE=stub, so the Frontend can integrate before the
 * orchestrator exists. Data: the Manggarai demo fixture from docs/AI_TRACK.md §10, not field data.
 *
 * - Any GPS position is treated as Stasiun Manggarai.
 * - stationId "station-manggarai" is a manual pick: same answers, distances approximate.
 * - Any other stationId gets the no-data fallback; no location at all gets the station-picker one.
 */

import type {
  ChatCard,
  ChatRequest,
  ChatResponse,
  DetectedStation,
  FacilityStatus,
  FacilityType,
} from './contract';
import { FILL_BUFFER_MIN, MAX_CARDS, REPORT_WINDOW_DAYS, WALKING_SPEED_MPS } from './config';
import { FALLBACK_MESSAGES } from './prompts';

export const STUB_STATION = { id: 'station-manggarai', name: 'Manggarai' } as const;

interface StubFacility {
  facilityId: string;
  name: string;
  type: FacilityType;
  platform: string | null;
  locationDetail: string | null;
  level: string | null;
  distanceM: number;
  status: FacilityStatus;
  minutesAgo: number | null;
}

const WATER_PLATFORM_3: StubFacility = {
  facilityId: 'fac-manggarai-water-p3',
  name: 'Water Station',
  type: 'water',
  platform: '3',
  locationDetail: 'Near the central stairs',
  level: 'L1',
  distanceM: 45,
  status: 'available',
  minutesAgo: 5,
};

const CHARGING_LOUNGE: StubFacility = {
  facilityId: 'fac-manggarai-charging-lounge',
  name: 'Charging Lounge',
  type: 'charging',
  platform: null,
  locationDetail: 'Concourse, next to the ticket gates',
  level: 'L2',
  distanceM: 70,
  status: 'available',
  minutesAgo: 2,
};

// The full §10 fixture, sorted by distance from the user.
const MANGGARAI_FACILITIES: readonly StubFacility[] = [
  WATER_PLATFORM_3,
  CHARGING_LOUNGE,
  {
    facilityId: 'fac-manggarai-water-exit-a',
    name: 'Water Refill',
    type: 'water',
    platform: null,
    locationDetail: 'Exit A',
    level: 'L1',
    distanceM: 110,
    status: 'empty',
    minutesAgo: 8,
  },
  {
    facilityId: 'fac-manggarai-charging-p7-8',
    name: 'Charging Hub',
    type: 'charging',
    platform: '7/8',
    locationDetail: null,
    level: 'L2',
    distanceM: 135,
    status: 'under_maintenance',
    minutesAgo: 20,
  },
  {
    facilityId: 'fac-manggarai-water-p1',
    name: 'Water Station',
    type: 'water',
    platform: '1',
    locationDetail: null,
    level: 'L1',
    distanceM: 180,
    status: 'broken',
    minutesAgo: 15,
  },
  {
    facilityId: 'fac-manggarai-hot-cold-p1-2',
    name: 'Hot and Cold Water',
    type: 'water',
    platform: '1-2',
    locationDetail: null,
    level: 'L1',
    distanceM: 210,
    status: 'unknown',
    minutesAgo: null,
  },
];

const NEXT_TRAIN = { line: 'Bogor', direction: 'Jakarta Kota', minutesUntil: 7 };
const REVIEWS = { count: 12, averageRating: '4,2', commonTheme: 'airnya dingin dan bersih' };

export function getStubChatResponse(request: ChatRequest, now: Date = new Date()): ChatResponse {
  const hasGps = request.lat !== undefined && request.lng !== undefined;
  if (request.stationId === undefined && !hasGps) {
    return stubFallback(FALLBACK_MESSAGES.noLocation, now);
  }
  if (request.stationId !== undefined && request.stationId !== STUB_STATION.id) {
    return stubFallback(FALLBACK_MESSAGES.noData, now);
  }

  // A stationId wins over GPS: it is a manual pick, so distances are from the station center.
  const manual = request.stationId !== undefined;
  const detectedStation: DetectedStation = {
    id: STUB_STATION.id,
    name: STUB_STATION.name,
    source: manual ? 'manual' : 'gps',
    needsConfirmation: false,
  };
  const station = `Stasiun ${STUB_STATION.name}`;
  const intro = manual ? `Kamu memilih ${station}.` : `Kamu terdeteksi di ${station}.`;
  const distance = (meters: number) =>
    manual ? `perkiraan ${meters} m dari titik tengah stasiun` : `sekitar ${meters} m dari kamu`;
  const toCards = (...facilities: StubFacility[]) =>
    facilities.map((facility) => toCard(facility, manual, now));
  const answered = (message: string, cards: ChatCard[], scheduleReminder = false): ChatResponse => ({
    outcome: 'answered',
    message,
    cards,
    scheduleReminder,
    needsStationSelection: false,
    detectedStation,
    generatedAt: now.toISOString(),
  });

  switch (request.quickMessageId) {
    case 'nearest_water': {
      const water = WATER_PLATFORM_3;
      return answered(
        [
          intro,
          `Dispenser air terdekat yang tersedia ada di ${place(water)}, ${distance(water.distanceM)}.`,
          `Laporan terakhir ${water.minutesAgo} menit lalu.`,
        ].join(' '),
        toCards(water),
      );
    }
    case 'nearest_charging': {
      const charging = CHARGING_LOUNGE;
      return answered(
        [
          intro,
          `Charging station terdekat yang tersedia ada di ${place(charging)}, ${distance(charging.distanceM)}.`,
          `Laporan terakhir ${charging.minutesAgo} menit lalu.`,
        ].join(' '),
        toCards(charging),
      );
    }
    case 'facility_working': {
      const available = MANGGARAI_FACILITIES.filter((f) => f.status === 'available').length;
      const unknown = MANGGARAI_FACILITIES.filter((f) => f.status === 'unknown').length;
      return answered(
        [
          `Di ${station}, ${available} dari ${MANGGARAI_FACILITIES.length} fasilitas berstatus tersedia.`,
          'Yang paling dekat ada di bawah.',
          `Ada ${unknown} fasilitas yang belum punya laporan dalam ${REPORT_WINDOW_DAYS} hari terakhir.`,
        ].join(' '),
        toCards(...MANGGARAI_FACILITIES.slice(0, MAX_CARDS)),
      );
    }
    case 'time_to_refill': {
      const water = WATER_PLATFORM_3;
      const [card] = toCards(water);
      const neededMin = 2 * card.walkTimeMin + FILL_BUFFER_MIN;
      const walk = manual
        ? `perkiraan ${card.walkTimeMin} menit jalan dari titik tengah stasiun`
        : `sekitar ${card.walkTimeMin} menit jalan`;
      const verdict =
        neededMin <= NEXT_TRAIN.minutesUntil ? 'jadi masih sempat' : 'jadi waktunya tidak cukup';
      return answered(
        [
          `Di ${station}, dispenser air terdekat yang tersedia ada di Platform ${water.platform}`,
          `(laporan ${water.minutesAgo} menit lalu), ${walk}.`,
          `Kereta tercepat berikutnya, Lin ${NEXT_TRAIN.line} arah ${NEXT_TRAIN.direction},`,
          `sekitar ${NEXT_TRAIN.minutesUntil} menit lagi dan kamu butuh sekitar ${neededMin} menit`,
          `pulang-pergi, ${verdict}.`,
          'Cek papan informasi stasiun untuk jadwal terbaru.',
        ].join(' '),
        [card],
        true,
      );
    }
    case 'review_summary':
      return answered(
        [
          `Ada ${REVIEWS.count} ulasan air di ${station} dengan rating rata-rata ${REVIEWS.averageRating} dari 5.`,
          `Yang paling sering disebut penumpang: ${REVIEWS.commonTheme}.`,
        ].join(' '),
        [],
      );
  }
}

function place(facility: StubFacility): string {
  return facility.platform ? `${facility.name}, Platform ${facility.platform}` : facility.name;
}

function toCard(facility: StubFacility, distanceIsApproximate: boolean, now: Date): ChatCard {
  const { minutesAgo } = facility;
  return {
    facilityId: facility.facilityId,
    name: facility.name,
    type: facility.type,
    platform: facility.platform,
    locationDetail: facility.locationDetail,
    level: facility.level,
    distanceM: facility.distanceM,
    distanceIsApproximate,
    // Same rule as get_nearest_facility (§7): max(1, ceil(distance / walking meters per minute)).
    walkTimeMin: Math.max(1, Math.ceil(facility.distanceM / (WALKING_SPEED_MPS * 60))),
    status: facility.status,
    lastReportedAt:
      minutesAgo === null ? null : new Date(now.getTime() - minutesAgo * 60_000).toISOString(),
    minutesAgo,
  };
}

function stubFallback(message: string, now: Date): ChatResponse {
  return {
    outcome: 'fallback_no_data',
    message,
    cards: [],
    scheduleReminder: false,
    needsStationSelection: true,
    detectedStation: null,
    generatedAt: now.toISOString(),
  };
}
