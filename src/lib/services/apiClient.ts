import type { ApiErrorBody } from '../api/apiError';

/** Error thrown by apiRequest, carrying the { error: { code, message } } from the route handler. */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

function isApiErrorBody(body: unknown): body is ApiErrorBody {
  if (typeof body !== 'object' || body === null || !('error' in body)) return false;
  const { error } = body as { error: unknown };
  return typeof error === 'object' && error !== null && 'code' in error && 'message' in error;
}

/** Calls our own /api routes. Sends JSON when a body is given; session cookies go along automatically. */
export async function apiRequest<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: init.method ?? 'GET',
      cache: 'no-store',
      ...(init.body === undefined
        ? {}
        : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(init.body) }),
    });
  } catch {
    throw new ApiRequestError(0, 'NETWORK_ERROR', 'Cannot reach the server. Check your connection.');
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    // A non-JSON error (e.g. a Next.js HTML error page) has no { error } body: keep the HTTP status visible.
    const error = isApiErrorBody(body)
      ? body.error
      : { code: 'INTERNAL_ERROR', message: `Request failed (HTTP ${response.status}).` };
    throw new ApiRequestError(response.status, error.code, error.message);
  }
  return body as T;
}

/** 404, or 400 for an id that is not a UUID (for example an old mock id): the item does not exist. */
export function isMissing(err: unknown): boolean {
  return err instanceof ApiRequestError && (err.status === 404 || err.status === 400);
}
