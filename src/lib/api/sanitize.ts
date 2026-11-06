// Shared cleanup for user-written text (report notes, review comments).
// Removes control characters except tab and newlines, then trims.

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function cleanText(value: string): string {
  return value.replace(CONTROL_CHARS, '').trim();
}
