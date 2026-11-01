import { z } from 'zod';
import { ApiError } from './apiError';

/** Route params of /api/.../[id]. Invalid ids become 400 VALIDATION_ERROR via handleRouteError. */
export const idParamsSchema = z.object({ id: z.uuid() });

export type IdRouteContext = { params: Promise<{ id: string }> };

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Request body must be valid JSON.');
  }
}
