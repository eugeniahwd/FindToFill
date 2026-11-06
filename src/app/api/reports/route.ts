import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/session';
import { submitReport } from '@/lib/data/reports';
import { reportFieldsSchema } from '@/lib/api/reportSchemas';
import { readPhotoField } from '@/lib/reports/photo';
import { APP_CONFIG } from '@/lib/config';
import { ApiError, handleRouteError } from '@/lib/api/errors';

export const dynamic = 'force-dynamic';

// Room for the text fields and multipart boundaries on top of the photo itself.
const MAX_BODY_BYTES = APP_CONFIG.MAX_PHOTO_BYTES + 64 * 1024;

/**
 * Submit a live report (multipart/form-data): facilityId, status, note (optional, max 140), photo (required).
 * Login required. 5 reports per user per hour. Returns 201 { report, stampAwarded }.
 */
export async function POST(request: Request) {
  try {
    if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
      throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Photo must be 5 MB or smaller.');
    }

    const db = await createSupabaseServerClient();
    const user = await requireUser(db);

    const form = await request.formData().catch(() => {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Request must be multipart form data.');
    });
    const fields = reportFieldsSchema.parse({
      facilityId: form.get('facilityId'),
      status: form.get('status'),
      note: form.get('note') ?? undefined,
    });
    const photo = await readPhotoField(form.get('photo'));

    const result = await submitReport(
      { db, admin: createSupabaseAdminClient() },
      { userId: user.id, fields, photo },
    );
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
