import { ChatResponse, QuickMessageId } from '../types';
import { MOCK_STATIONS } from '../mock/data';
import { stationService } from './stationService';
import { findNearestStation } from '../utils/geo';
import { reviewService } from './reviewService';

export const chatbotService = {
  // TODO(backend): Replace with POST /api/chat with Gemini function calling and tool orchestration
  async ask(
    quickMessageId: QuickMessageId,
    coords?: { latitude: number; longitude: number } | null,
    overrideStationId?: string,
    simulateFallback = false
  ): Promise<ChatResponse> {
    await new Promise((r) => setTimeout(r, 700));

    if (simulateFallback) {
      return {
        outcome: 'fallback_ai_unavailable',
        message:
          'Layanan AI sedang tidak tersedia. Silakan cek peta stasiun untuk mencari fasilitas terdekat secara langsung.',
        generatedAt: new Date().toISOString(),
      };
    }

    // Determine current station
    let targetStation = MOCK_STATIONS[0]; // default to Manggarai
    if (overrideStationId) {
      const match = MOCK_STATIONS.find((s) => s.id === overrideStationId);
      if (match) targetStation = match;
    } else if (coords) {
      const nearest = findNearestStation(
        coords.latitude,
        coords.longitude,
        MOCK_STATIONS
      );
      if (nearest) targetStation = nearest.station;
    }

    const stationFacilities = await stationService.getStationFacilities(
      targetStation.id,
      coords
    );

    const waterFacilities = stationFacilities.filter((f) => f.type === 'water');
    const chargingFacilities = stationFacilities.filter(
      (f) => f.type === 'charging'
    );

    switch (quickMessageId) {
      case 'nearest_water': {
        const best =
          waterFacilities.find((f) => f.currentStatus === 'available') ||
          waterFacilities[0];

        if (!best) {
          return {
            outcome: 'fallback_no_data',
            message: `Maaf, belum ada data dispenser air di Stasiun ${targetStation.name}.`,
            detectedStation: targetStation.name,
            generatedAt: new Date().toISOString(),
          };
        }

        const distanceM = best.distanceMeters ?? 45;
        return {
          outcome: 'answered',
          detectedStation: targetStation.name,
          message: `Dispenser air minum terdekat di Stasiun ${targetStation.name} berada di ${best.name} (${distanceM} m dari titik Anda). Kondisi terakhir dilaporkan ${best.currentStatus === 'available' ? 'berfungsi baik' : best.currentStatus}.`,
          card: {
            facilityId: best.id,
            facilityName: best.name,
            stationName: targetStation.name,
            locationDetail: best.locationDetail || best.platform || 'Area peron',
            distanceMeters: distanceM,
            status: best.currentStatus,
            lastReportedAt: best.lastReportedAt,
            photoUrl: best.lastPhotoUrl || undefined,
          },
          generatedAt: new Date().toISOString(),
        };
      }

      case 'nearest_charging': {
        const best =
          chargingFacilities.find((f) => f.currentStatus === 'available') ||
          chargingFacilities[0];

        if (!best) {
          return {
            outcome: 'fallback_no_data',
            message: `Maaf, belum ada data charging station di Stasiun ${targetStation.name}.`,
            detectedStation: targetStation.name,
            generatedAt: new Date().toISOString(),
          };
        }

        const distanceM = best.distanceMeters ?? 35;
        return {
          outcome: 'answered',
          detectedStation: targetStation.name,
          message: `Charging station terdekat di Stasiun ${targetStation.name} ada di ${best.name} (${distanceM} m). ${best.currentStatus === 'available' ? 'Port colokan siap digunakan.' : 'Saat ini dilaporkan berkendala.'}`,
          card: {
            facilityId: best.id,
            facilityName: best.name,
            stationName: targetStation.name,
            locationDetail: best.locationDetail || best.platform || 'Area peron',
            distanceMeters: distanceM,
            status: best.currentStatus,
            lastReportedAt: best.lastReportedAt,
            photoUrl: best.lastPhotoUrl || undefined,
          },
          generatedAt: new Date().toISOString(),
        };
      }

      case 'facility_working': {
        const workingCount = stationFacilities.filter(
          (f) => f.currentStatus === 'available'
        ).length;
        const best =
          stationFacilities.find((f) => f.currentStatus === 'available') ||
          stationFacilities[0];

        if (!best) {
          return {
            outcome: 'fallback_no_data',
            message: `Belum ada laporan aktif untuk fasilitas di Stasiun ${targetStation.name}.`,
            detectedStation: targetStation.name,
            generatedAt: new Date().toISOString(),
          };
        }

        return {
          outcome: 'answered',
          detectedStation: targetStation.name,
          message: `Di Stasiun ${targetStation.name}, terdapat ${workingCount} dari ${stationFacilities.length} fasilitas yang saat ini berstatus aktif dan berfungsi normal berdasarkan laporan 7 hari terakhir.`,
          card: {
            facilityId: best.id,
            facilityName: best.name,
            stationName: targetStation.name,
            locationDetail: best.locationDetail || best.platform || 'Area peron',
            distanceMeters: best.distanceMeters ?? 50,
            status: best.currentStatus,
            lastReportedAt: best.lastReportedAt,
            photoUrl: best.lastPhotoUrl || undefined,
          },
          generatedAt: new Date().toISOString(),
        };
      }

      case 'time_to_refill': {
        const best =
          waterFacilities.find((f) => f.currentStatus === 'available') ||
          waterFacilities[0];

        if (!best) {
          return {
            outcome: 'fallback_no_data',
            message: `Tidak ditemukan dispenser air aktif di Stasiun ${targetStation.name}.`,
            detectedStation: targetStation.name,
            generatedAt: new Date().toISOString(),
          };
        }

        const walkTime = best.walkTimeMin ?? 1;
        const totalNeeded = walkTime * 2 + 1; // 2x walk + 1 min refill

        return {
          outcome: 'answered',
          detectedStation: targetStation.name,
          scheduleReminder: true,
          message: `Estimasi jalan bolak-balik ke ${best.name} dan mengisi botol adalah sekitar ${totalNeeded} menit. Kereta berikutnya tiba dalam ~6 menit, waktu Anda cukup!`,
          card: {
            facilityId: best.id,
            facilityName: best.name,
            stationName: targetStation.name,
            locationDetail: best.locationDetail || best.platform || 'Area peron',
            distanceMeters: best.distanceMeters ?? 45,
            status: best.currentStatus,
            lastReportedAt: best.lastReportedAt,
            photoUrl: best.lastPhotoUrl || undefined,
          },
          generatedAt: new Date().toISOString(),
        };
      }

      case 'review_summary': {
        const reviews = await reviewService.getStationReviews(targetStation.id);
        const best = waterFacilities[0] || stationFacilities[0];

        const summaryText =
          reviews.length > 0
            ? `Pengguna menyatakan air di dispenser Stasiun ${targetStation.name} segar, bersih, dan dingin. Rata-rata rating ${((reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length) || 4.8).toFixed(1)}/5.`
            : `Dispenser air di Stasiun ${targetStation.name} dirawat secara berkala oleh petugas kebersihan KAI Commuter.`;

        return {
          outcome: 'answered',
          detectedStation: targetStation.name,
          message: summaryText,
          card: best
            ? {
                facilityId: best.id,
                facilityName: best.name,
                stationName: targetStation.name,
                locationDetail:
                  best.locationDetail || best.platform || 'Area peron',
                distanceMeters: best.distanceMeters ?? 45,
                status: best.currentStatus,
                lastReportedAt: best.lastReportedAt,
                photoUrl: best.lastPhotoUrl || undefined,
              }
            : undefined,
          generatedAt: new Date().toISOString(),
        };
      }

      default:
        return {
          outcome: 'rejected',
          message: 'Permintaan tidak dikenali.',
          generatedAt: new Date().toISOString(),
        };
    }
  },
};
