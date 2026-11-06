/**
 * Converts a base64 data URL (the compressed photo from PhotoUploader's canvas) into a Blob
 * that can be sent as a multipart file. Throws on anything that is not a base64 data URL.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:([^;,]+);base64,([\s\S]*)$/.exec(dataUrl);
  if (!match) throw new Error('Invalid photo data.');
  const [, mime, base64] = match;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
