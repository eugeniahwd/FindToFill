// Shared cleanup for user-written text (report notes, review comments).
// Removes control characters except tab and newlines, then trims.

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function cleanText(value: string): string {
  return value.replace(CONTROL_CHARS, '').trim();
}

const URLS = /\b(?:https?:\/\/|www\.)\S+/gi;

/**
 * Review text for the chatbot: no URLs, no control characters, single spaces, cut to
 * `maxChars` with "...". Reviews are untrusted data and go to the model only like this.
 */
export function reviewSnippet(value: string, maxChars: number): string {
  const text = cleanText(value.replace(URLS, ' ')).replace(/\s+/g, ' ');
  return text.length <= maxChars ? text : `${text.slice(0, maxChars - 3).trimEnd()}...`;
}
