/**
 * @jest-environment node
 */
import { detectImageType } from '@/lib/reports/photo';
import { dataUrlToBlob } from '@/lib/reports/dataUrl';
import { reportErrorMessage } from '@/lib/reports/messages';
import { reportFieldsSchema } from '@/lib/api/reportSchemas';
import { ApiRequestError } from '@/lib/services/apiClient';

const bytes = (...b: number[]) => new Uint8Array(b);
const ascii = (s: string) => new TextEncoder().encode(s);

describe('detectImageType (magic bytes)', () => {
  it('recognizes JPEG, PNG, and WebP', () => {
    expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xdb))).toEqual({ mime: 'image/jpeg', ext: 'jpg' });
    expect(detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toEqual({ mime: 'image/png', ext: 'png' });
    expect(detectImageType(ascii('RIFF\0\0\0\0WEBPVP8 '))).toEqual({ mime: 'image/webp', ext: 'webp' });
  });

  it.each([
    ['GIF', ascii('GIF89a')],
    ['HTML', ascii('<html><script>')],
    ['RIFF that is not WebP (WAV)', ascii('RIFF\0\0\0\0WAVEfmt ')],
    ['empty', bytes()],
    ['truncated JPEG', bytes(0xff, 0xd8)],
  ])('rejects %s', (_name, input) => {
    expect(detectImageType(input)).toBeNull();
  });
});

describe('reportFieldsSchema', () => {
  const base = { facilityId: '22222222-2222-4222-8222-222222222222', status: 'broken' };

  it('trims the note, strips control characters, and turns empty into null', () => {
    expect(reportFieldsSchema.parse({ ...base, note: '  Kran\u0007 bocor  ' }).note).toBe('Kran bocor');
    expect(reportFieldsSchema.parse({ ...base, note: '   ' }).note).toBeNull();
    expect(reportFieldsSchema.parse(base).note).toBeUndefined();
  });

  it('allows exactly 140 characters and rejects 141', () => {
    expect(reportFieldsSchema.safeParse({ ...base, note: 'a'.repeat(140) }).success).toBe(true);
    expect(reportFieldsSchema.safeParse({ ...base, note: 'a'.repeat(141) }).success).toBe(false);
  });

  it('accepts only the four reportable statuses', () => {
    for (const status of ['available', 'empty', 'broken', 'under_maintenance']) {
      expect(reportFieldsSchema.safeParse({ ...base, status }).success).toBe(true);
    }
    expect(reportFieldsSchema.safeParse({ ...base, status: 'unknown' }).success).toBe(false);
  });
});

describe('dataUrlToBlob', () => {
  it('decodes a base64 data URL with its MIME type', async () => {
    const blob = dataUrlToBlob(`data:image/jpeg;base64,${btoa('\xff\xd8\xff\xe0')}`);
    expect(blob.type).toBe('image/jpeg');
    expect(blob.size).toBe(4);
  });

  it('rejects anything that is not a base64 data URL', () => {
    expect(() => dataUrlToBlob('https://example.com/photo.jpg')).toThrow('Invalid photo data.');
  });
});

describe('reportErrorMessage', () => {
  it.each([
    ['RATE_LIMITED', 429, /5 laporan per jam/],
    ['UNSUPPORTED_MEDIA_TYPE', 415, /JPEG, PNG, atau WebP/],
    ['PAYLOAD_TOO_LARGE', 413, /maksimal 5 MB/],
    ['UNAUTHORIZED', 401, /masuk lagi/],
  ])('maps %s to a clear Indonesian message', (code, status, expected) => {
    expect(reportErrorMessage(new ApiRequestError(status, code, 'x'))).toMatch(expected);
  });

  it('falls back to a generic message', () => {
    expect(reportErrorMessage(new Error('boom'))).toMatch(/Gagal mengirim laporan/);
  });
});
