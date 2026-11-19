import { ApiRequestError } from '../services/apiClient';

/** Indonesian toast text for a failed admin action, based on the API error code. */
export function adminErrorMessage(err: unknown, fallback = 'Aksi gagal. Coba beberapa saat lagi.'): string {
  if (!(err instanceof ApiRequestError)) return fallback;
  switch (err.code) {
    case 'UNAUTHORIZED':
      return 'Sesi login berakhir. Silakan masuk lagi.';
    case 'FORBIDDEN':
      return 'Akun ini bukan admin.';
    case 'NOT_FOUND':
      return 'Data tidak ditemukan. Muat ulang halaman.';
    case 'CONFLICT':
      return 'Data dengan nama ini sudah ada.';
    case 'VALIDATION_ERROR':
      // The server names the field, e.g. "departureTime: Use HH:MM (24-hour), e.g. 05:30."
      return `Data belum valid (${err.message})`;
    case 'NETWORK_ERROR':
    case 'SERVICE_UNAVAILABLE':
      return 'Server atau database tidak dapat dihubungi. Coba lagi sebentar.';
    default:
      return fallback;
  }
}
