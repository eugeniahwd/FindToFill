import { ApiRequestError } from '../services/apiClient';

/** Indonesian toast text for a failed report submission, based on the API error code. */
export function reportErrorMessage(err: unknown): string {
  if (!(err instanceof ApiRequestError)) return 'Gagal mengirim laporan. Coba beberapa saat lagi.';
  switch (err.code) {
    case 'RATE_LIMITED':
      return 'Batas 5 laporan per jam sudah tercapai. Coba lagi nanti.';
    case 'UNSUPPORTED_MEDIA_TYPE':
      return 'Format foto harus JPEG, PNG, atau WebP.';
    case 'PAYLOAD_TOO_LARGE':
      return 'Ukuran foto terlalu besar (maksimal 5 MB).';
    case 'UNAUTHORIZED':
      return 'Sesi login berakhir. Silakan masuk lagi.';
    case 'NOT_FOUND':
      return 'Fasilitas tidak ditemukan atau sudah tidak aktif.';
    case 'VALIDATION_ERROR':
      return 'Data laporan belum lengkap. Pilih kondisi dan lampirkan foto.';
    default:
      return 'Gagal mengirim laporan. Coba beberapa saat lagi.';
  }
}
