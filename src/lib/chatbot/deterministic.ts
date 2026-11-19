/**
 * src/lib/chatbot/deterministic.ts
 *
 * Safe answers built only from tool outputs (docs/AI_TRACK.md §9 step 8): used when the model's
 * answer is missing, unparseable, or fails validation. Every number comes from a tool output.
 */

import { MAX_CARDS, MAX_MESSAGE_CHARS, REPORT_WINDOW_DAYS } from './config';
import type { FacilityStatus, FacilityType, QuickMessageId } from './contract';
import type { FacilityOutput, StatusOutputRow, ToolOutputs } from './tools/types';

export interface ComposedAnswer {
  outcome: 'answered' | 'fallback_no_data';
  message: string;
  facilityIds: string[];
}

const STATUS_LABEL: Record<FacilityStatus, string> = {
  available: 'tersedia',
  empty: 'kosong',
  broken: 'rusak',
  under_maintenance: 'sedang perawatan',
  unknown: 'belum ada laporan',
};

const NOUN: Record<FacilityType, string> = { water: 'dispenser air', charging: 'charging station' };
const BOARD = 'Cek papan informasi stasiun untuk jadwal terbaru.';

export function composeAnswer(
  quickMessageId: QuickMessageId,
  outputs: ToolOutputs,
  stationName: string,
): ComposedAnswer {
  const station = `Stasiun ${stationName}`;
  const answer = (() => {
    switch (quickMessageId) {
      case 'nearest_water':
        return nearestAnswer('water', outputs, station);
      case 'nearest_charging':
        return nearestAnswer('charging', outputs, station);
      case 'facility_working':
        return workingAnswer(outputs, station);
      case 'time_to_refill':
        return refillAnswer(outputs, station);
      case 'review_summary':
        return reviewAnswer(outputs, station);
    }
  })();
  return { ...answer, message: fitLength(answer.message) };
}

function nearestAnswer(type: FacilityType, outputs: ToolOutputs, station: string): ComposedAnswer {
  const facilities = facilitiesOf(outputs, type);
  if (facilities.length === 0) return noData(NOUN[type], station);
  const nearest = facilities[0];
  const available = facilities.find((f) => statusOf(outputs, f).status === 'available');

  if (!available) {
    return {
      outcome: 'answered',
      message:
        `Di ${station}, belum ada ${NOUN[type]} yang dilaporkan tersedia. ` +
        `${capitalize(place(nearest))} yang terdekat ${describe(statusOf(outputs, nearest))}.`,
      facilityIds: facilities.slice(0, 2).map((f) => f.facility_id),
    };
  }

  const where =
    `${place(available)}, perkiraan ${available.distance_m} m dari titik tengah stasiun`;
  const report = reportPhrase(statusOf(outputs, available));
  if (available === nearest) {
    return {
      outcome: 'answered',
      message:
        `Di ${station}, ${NOUN[type]} terdekat yang tersedia ada di ${where}. ` +
        `${capitalize(report)}.`,
      facilityIds: [available.facility_id],
    };
  }
  return {
    outcome: 'answered',
    message:
      `Di ${station}, ${NOUN[type]} yang terdekat, ${place(nearest)}, ` +
      `${describe(statusOf(outputs, nearest))}. Yang tersedia ada di ${where}, ${report}.`,
    facilityIds: [available.facility_id, nearest.facility_id],
  };
}

function workingAnswer(outputs: ToolOutputs, station: string): ComposedAnswer {
  const facilities = facilitiesOf(outputs, 'any');
  const summary = outputs.status?.summary;
  if (facilities.length === 0 || !summary) return noData('fasilitas', station);

  const unknown =
    summary.unknown > 0
      ? ` Ada ${summary.unknown} fasilitas yang belum punya laporan dalam ` +
        `${REPORT_WINDOW_DAYS} hari terakhir.`
      : '';
  return {
    outcome: 'answered',
    message:
      `Di ${station}, ${summary.available} dari ${summary.total} fasilitas berstatus tersedia. ` +
      `Yang paling dekat ada di bawah.${unknown}`,
    facilityIds: facilities.slice(0, MAX_CARDS).map((f) => f.facility_id),
  };
}

function refillAnswer(outputs: ToolOutputs, station: string): ComposedAnswer {
  const water = facilitiesOf(outputs, 'water');
  if (water.length === 0) return noData(NOUN.water, station);
  const available = water.find((f) => statusOf(outputs, f).status === 'available');
  if (!available) {
    return {
      outcome: 'answered',
      message:
        `Di ${station}, belum ada dispenser air yang dilaporkan tersedia, jadi waktu isi ulang ` +
        `belum bisa dihitung. ${BOARD}`,
      facilityIds: [water[0].facility_id],
    };
  }

  const first =
    `Di ${station}, dispenser air terdekat yang tersedia ada di ${place(available)} ` +
    `(${reportPhrase(statusOf(outputs, available))}), perkiraan ${available.walk_time_min} menit ` +
    'jalan dari titik tengah stasiun.';
  const trains = outputs.trains;
  const soonest = trains?.departures[0];
  let rest: string;
  if (!trains || !trains.data_available) {
    rest = 'Data jadwal belum tersedia, jadi aku tidak bisa menghitung waktunya.';
  } else if (!soonest) {
    rest = `Menurut jadwal, tidak ada lagi kereta yang berangkat hari ini. ${BOARD}`;
  } else if (trains.time_check) {
    const check = trains.time_check;
    const train = check.reference_departure;
    rest =
      `Kereta tercepat berikutnya (${train.line} arah ${train.direction}) sekitar ` +
      `${train.minutes_until} menit lagi dan kamu butuh sekitar ${check.needed_minutes} menit ` +
      `pulang-pergi, jadi ${check.enough_time ? 'masih sempat' : 'waktunya tidak cukup'}. ${BOARD}`;
  } else {
    rest =
      `Kereta tercepat berikutnya (${soonest.line} arah ${soonest.direction}) sekitar ` +
      `${soonest.minutes_until} menit lagi. ${BOARD}`;
  }
  return { outcome: 'answered', message: `${first} ${rest}`, facilityIds: [available.facility_id] };
}

function reviewAnswer(outputs: ToolOutputs, station: string): ComposedAnswer {
  const reviews = outputs.reviews;
  if (!reviews) {
    return {
      outcome: 'fallback_no_data',
      message: `Ulasan air untuk ${station} belum bisa dimuat sekarang. Coba lagi nanti.`,
      facilityIds: [],
    };
  }
  if (reviews.count === 0 || reviews.average_rating === null) {
    return {
      outcome: 'answered',
      message: `Belum ada ulasan air untuk ${station}.`,
      facilityIds: [],
    };
  }
  return {
    outcome: 'answered',
    message:
      `Ada ${reviews.count} ulasan air di ${station} dengan rating rata-rata ` +
      `${decimal(reviews.average_rating)} dari ${reviews.rating_scale}. ` +
      'Baca ulasan lengkapnya di halaman stasiun.',
    facilityIds: [],
  };
}

function noData(what: string, station: string): ComposedAnswer {
  return {
    outcome: 'fallback_no_data',
    message:
      `Aku belum menemukan data ${what} di ${station}. ` +
      'Coba pilih stasiun lain atau lihat peta.',
    facilityIds: [],
  };
}

function facilitiesOf(outputs: ToolOutputs, type: FacilityType | 'any'): FacilityOutput[] {
  return (outputs.nearest?.facilities ?? []).filter((f) => type === 'any' || f.type === type);
}

function statusOf(outputs: ToolOutputs, facility: FacilityOutput): StatusOutputRow {
  return (
    outputs.status?.statuses.find((s) => s.facility_id === facility.facility_id) ?? {
      facility_id: facility.facility_id,
      status: 'unknown',
      last_reported_at: null,
      minutes_ago: null,
      active_report_count: 0,
    }
  );
}

function place(facility: FacilityOutput): string {
  if (facility.platform) return `${facility.name}, Platform ${facility.platform}`;
  if (facility.location_detail) return `${facility.name} (${facility.location_detail})`;
  return facility.name;
}

function reportPhrase(row: StatusOutputRow): string {
  return row.minutes_ago === null
    ? `belum ada laporan dalam ${REPORT_WINDOW_DAYS} hari terakhir`
    : `laporan terakhir ${row.minutes_ago} menit lalu`;
}

/** "berstatus kosong, laporan terakhir 8 menit lalu", or "belum punya laporan dalam 7 hari ...". */
function describe(row: StatusOutputRow): string {
  if (row.status === 'unknown') {
    return `belum punya laporan dalam ${REPORT_WINDOW_DAYS} hari terakhir`;
  }
  return `berstatus ${STATUS_LABEL[row.status]}, ${reportPhrase(row)}`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Indonesian decimal comma: 4.2 -> "4,2", 4 -> "4". */
function decimal(value: number): string {
  return String(value).replace('.', ',');
}

/** Keeps whole sentences within MAX_MESSAGE_CHARS. */
function fitLength(message: string): string {
  if (message.length <= MAX_MESSAGE_CHARS) return message;
  const cut = message.slice(0, MAX_MESSAGE_CHARS);
  const end = cut.lastIndexOf('. ');
  return end > 0 ? cut.slice(0, end + 1) : cut.trimEnd();
}
