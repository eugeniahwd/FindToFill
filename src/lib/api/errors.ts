import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { SupabaseConfigError } from '@/lib/supabase/env';
import { ApiError, type ApiErrorBody, type ApiErrorCode } from './apiError';

export { ApiError, type ApiErrorBody, type ApiErrorCode };

export function errorResponse(status: number, code: ApiErrorCode, message: string): NextResponse<ApiErrorBody> {
  return NextResponse.json({ error: { code, message } }, { status });
}

/** Maps any thrown value to { error: { code, message } } without leaking stack traces or internals. */
export function handleRouteError(err: unknown): NextResponse<ApiErrorBody> {
  if (err instanceof ApiError) {
    return errorResponse(err.status, err.code, err.message);
  }
  if (err instanceof ZodError) {
    const issue = err.issues[0];
    const path = issue?.path.join('.');
    const message = issue ? (path ? `${path}: ${issue.message}` : issue.message) : 'Invalid input.';
    return errorResponse(400, 'VALIDATION_ERROR', message);
  }
  if (err instanceof SupabaseConfigError) {
    return errorResponse(503, 'SERVICE_UNAVAILABLE', 'The server is not configured yet.');
  }

  // Log only the error type, never request data or personal data.
  console.error('Unhandled route error:', err instanceof Error ? err.name : typeof err);
  return errorResponse(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.');
}

/** Converts a Supabase/PostgREST error into an ApiError. Database details are not exposed. */
export function fromDatabaseError(error: { code?: string; message?: string }): ApiError {
  switch (error.code) {
    case '23505':
      return new ApiError(409, 'CONFLICT', 'This item already exists.');
    case '23503':
      return new ApiError(400, 'VALIDATION_ERROR', 'A referenced item does not exist.');
    case '23514':
    case '22P02':
      return new ApiError(400, 'VALIDATION_ERROR', 'Invalid input.');
    case '42501':
      return new ApiError(403, 'FORBIDDEN', 'You are not allowed to do this.');
    case 'PGRST116':
      return new ApiError(404, 'NOT_FOUND', 'Not found.');
    default:
      // Network failure or paused free-tier project.
      if (!error.code || error.message?.includes('fetch failed')) {
        return new ApiError(503, 'SERVICE_UNAVAILABLE', 'The database is unreachable right now. Please try again shortly.');
      }
      return new ApiError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.');
  }
}
