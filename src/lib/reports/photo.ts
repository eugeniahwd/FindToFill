import { ApiError } from '../api/apiError';
import { APP_CONFIG } from '../config';

export interface ImageType {
  mime: 'image/jpeg' | 'image/png' | 'image/webp';
  ext: 'jpg' | 'png' | 'webp';
}

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  bytes.length >= offset + signature.length && signature.every((b, i) => bytes[offset + i] === b);

/**
 * Detects the image type from the file's first bytes (magic numbers), ignoring the file name
 * and the client-declared MIME type. Returns null for anything that is not JPEG, PNG, or WebP.
 */
export function detectImageType(bytes: Uint8Array): ImageType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { mime: 'image/jpeg', ext: 'jpg' };
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: 'image/png', ext: 'png' };
  // "RIFF" <size> "WEBP"
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return { mime: 'image/webp', ext: 'webp' };
  }
  return null;
}

/** Validates the `photo` form field: required, at most MAX_PHOTO_BYTES, real JPEG/PNG/WebP content. */
export async function readPhotoField(
  value: FormDataEntryValue | null,
): Promise<{ bytes: Uint8Array; type: ImageType }> {
  if (!(value instanceof Blob) || value.size === 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'A photo is required.');
  }
  if (value.size > APP_CONFIG.MAX_PHOTO_BYTES) {
    throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Photo must be 5 MB or smaller.');
  }
  const bytes = new Uint8Array(await value.arrayBuffer());
  const type = detectImageType(bytes);
  if (!type) {
    throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Photo must be a JPEG, PNG, or WebP image.');
  }
  return { bytes, type };
}
