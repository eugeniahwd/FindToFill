import { z } from 'zod';
import { ApiError } from './apiError';

/** Route params of /api/.../[id]. Invalid ids become 400 VALIDATION_ERROR via handleRouteError. */
export const idParamsSchema = z.object({ id: z.uuid() });

export type IdRouteContext = { params: Promise<{ id: string }> };

/** Query string -> plain object for a zod schema; empty values count as "not set". */
export function queryParams(request: Request): Record<string, string> {
  const params = new URL(request.url).searchParams;
  return Object.fromEntries([...params.entries()].filter(([, v]) => v !== ''));
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Request body must be valid JSON.');
  }
}
