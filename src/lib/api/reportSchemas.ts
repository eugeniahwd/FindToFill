import { z } from 'zod';
import { APP_CONFIG } from '@/lib/config';
import { cleanText } from './sanitize';

// Text fields of POST /api/reports (multipart form). The photo is validated separately.

export const reportFieldsSchema = z.object({
  facilityId: z.uuid(),
  status: z.enum(['available', 'empty', 'broken', 'under_maintenance']),
  note: z
    .string()
    .transform(cleanText)
    .pipe(z.string().max(APP_CONFIG.REPORT_NOTE_MAX_CHARS))
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
});

export type ReportFields = z.infer<typeof reportFieldsSchema>;
