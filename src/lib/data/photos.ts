import 'server-only';
import { APP_CONFIG } from '@/lib/config';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const REPORT_PHOTO_BUCKET = 'report-photos';

/**
 * Creates 1-hour signed URLs for report photos (private bucket). Uses the service role because
 * guests may view photos of active reports but cannot read the bucket directly.
 * Photo links are optional: on failure an empty map is returned and the list still loads.
 */
export async function signReportPhotos(paths: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths)];
  if (unique.length === 0) return new Map();

  const { data, error } = await createSupabaseAdminClient()
    .storage.from(REPORT_PHOTO_BUCKET)
    .createSignedUrls(unique, APP_CONFIG.SIGNED_PHOTO_URL_TTL_S);
  if (error || !data) return new Map();

  return new Map(
    data.flatMap((item) => (item.path && item.signedUrl && !item.error ? [[item.path, item.signedUrl] as const] : [])),
  );
}
