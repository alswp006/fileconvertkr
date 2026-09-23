/**
 * HEIC/HEIF image conversion utilities.
 *
 * Converts HEIC/HEIF images to JPG or PNG format using heic2any library.
 * Uses dynamic import to avoid a hard dependency in environments where it's unneeded.
 */

export interface ConversionResult {
  fileName: string;
  mimeType: string;
  blob: Blob;
}

const HEIC_MIME_TYPES = ['image/heic', 'image/heif'];
const HEIC_EXTENSIONS = ['.heic', '.heif'];

function replaceExtension(fileName: string, newExt: string): string {
  const dotIndex = fileName.lastIndexOf('.');
  const base = dotIndex === -1 ? fileName : fileName.slice(0, dotIndex);
  return `${base}.${newExt}`;
}

function firstBlob(result: Blob | Blob[]): Blob {
  return Array.isArray(result) ? result[0] : result;
}

/**
 * Checks if a file is HEIC/HEIF format by extension or MIME type.
 */
export function isHeic(file: File): boolean {
  const type = file.type.toLowerCase();
  if (HEIC_MIME_TYPES.includes(type)) return true;

  const name = file.name.toLowerCase();
  return HEIC_EXTENSIONS.some((ext) => name.endsWith(ext));
}

/**
 * Converts a HEIC/HEIF file to JPG or PNG format.
 */
export async function convertHeic(
  file: File,
  format: 'jpg' | 'png',
): Promise<ConversionResult> {
  const heic2any = (await import('heic2any')).default;
  const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';

  const result = (await heic2any({
    blob: file,
    toType: mimeType,
    quality: 0.92,
  })) as Blob | Blob[];

  return {
    fileName: replaceExtension(file.name, format),
    mimeType,
    blob: firstBlob(result),
  };
}

/**
 * Decodes a HEIC/HEIF blob to JPEG.
 */
export async function decodeHeicToJpeg(blob: Blob): Promise<Blob> {
  return heicToJpeg(blob);
}

/**
 * Converts a HEIC/HEIF blob to a JPEG blob. Contract-level entry point used
 * by the conversion runner (packet 0003) and the HEIC screen (packet 0013).
 */
export async function heicToJpeg(blob: Blob, quality = 0.92): Promise<Blob> {
  const heic2any = (await import('heic2any')).default;

  const result = (await heic2any({
    blob,
    toType: 'image/jpeg',
    quality,
  })) as Blob | Blob[];

  return firstBlob(result);
}
