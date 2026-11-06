import { z } from 'zod';
import { APP_CONFIG } from '@/lib/config';

// Text fields of POST /api/reports (multipart form). The photo is validated separately.

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export const reportFieldsSchema = z.object({
  facilityId: z.uuid(),
  status: z.enum(['available', 'empty', 'broken', 'under_maintenance']),
  note: z
    .string()
    .transform((v) => v.replace(CONTROL_CHARS, '').trim())
    .pipe(z.string().max(APP_CONFIG.REPORT_NOTE_MAX_CHARS))
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
});

export type ReportFields = z.infer<typeof reportFieldsSchema>;
