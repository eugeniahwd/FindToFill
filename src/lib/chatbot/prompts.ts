/**
 * src/lib/chatbot/prompts.ts
 *
 * Fixed chatbot texts (docs/AI_TRACK.md §8). These are constants, never model output.
 * The system prompt arrives with the orchestrator in a later step.
 */

export const FALLBACK_MESSAGES = {
  aiUnavailable: 'Asisten sedang tidak tersedia. Lihat peta untuk fasilitas terdekat.',
  noData:
    'Aku belum menemukan data fasilitas untuk pertanyaan ini. Coba pilih stasiun lain atau lihat peta.',
  outsidePilotArea:
    'Kamu sepertinya tidak berada di stasiun pilot FindToFill. Pilih stasiun secara manual untuk melanjutkan.',
  // The request had no stationId: the browser could not detect a station and none was picked.
  noLocation: 'Lokasimu belum terdeteksi. Pilih stasiun secara manual untuk melanjutkan.',
  rejected: 'Pertanyaan tidak dikenali.',
  rateLimited: 'Terlalu banyak permintaan. Coba lagi nanti.',
} as const;
