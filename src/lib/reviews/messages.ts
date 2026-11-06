import { ApiRequestError } from '../services/apiClient';

/** Indonesian toast text for a failed review submission, based on the API error code. */
export function reviewErrorMessage(err: unknown): string {
  if (!(err instanceof ApiRequestError)) return 'Gagal mengirim ulasan. Coba beberapa saat lagi.';
  switch (err.code) {
    case 'RATE_LIMITED':
      return 'Terlalu banyak ulasan dalam satu jam. Coba lagi nanti.';
    case 'UNAUTHORIZED':
      return 'Sesi login berakhir. Silakan masuk lagi.';
    case 'NOT_FOUND':
      return 'Fasilitas tidak ditemukan atau sudah tidak aktif.';
    case 'CONFLICT':
      return 'Ulasan Anda untuk fasilitas ini sudah dihapus moderator dan tidak bisa dikirim ulang.';
    case 'VALIDATION_ERROR':
      return 'Pilih fasilitas, beri bintang 1-5, dan tulis ulasan (maks 500 karakter).';
    default:
      return 'Gagal mengirim ulasan. Coba beberapa saat lagi.';
  }
}
