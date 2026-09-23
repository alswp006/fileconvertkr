/**
 * HEIC/HEIF image conversion utilities.
 *
 * Converts HEIC/HEIF images to JPG or PNG format using heic2any library.
 * Uses dynamic import to avoid hard dependency in non-Apple environments.
 *
 * TODO: Implement isHeic, convertHeic, decodeHeicToJpeg per AC-2, AC-3, AC-4
 */

export interface ConversionResult {
  fileName: string;
  mimeType: string;
  blob?: Blob;
}

/**
 * Checks if a file is HEIC/HEIF format by extension or MIME type.
 * @param file - File to check
 * @returns true if file is HEIC/HEIF
 */
export function isHeic(file: File): boolean {
  // TODO: Implement per AC-3
  // Pattern: check file.type for 'image/heic' or 'image/heif'
  // AND check file.name for .heic, .heif extensions
  return false;
}

/**
 * Converts HEIC/HEIF file to JPG or PNG format.
 * @param file - HEIC file to convert
 * @param format - Output format: 'jpg' or 'png'
 * @returns Promise with fileName and mimeType
 */
export async function convertHeic(
  file: File,
  format: 'jpg' | 'png',
): Promise<ConversionResult> {
  // TODO: Implement per AC-2
  // 1. Dynamic import heic2any: const heic2any = (await import('heic2any')).default
  // 2. Call heic2any with { blob: file, toType: 'image/jpeg'|'image/png', quality: 0.92 }
  // 3. Extract blob from result array: [blob] = result
  // 4. Replace file extension: IMG_0001.heic → IMG_0001.jpg|.png
  // 5. Return { fileName, mimeType: 'image/jpeg'|'image/png' }
  return {
    fileName: '',
    mimeType: '',
  };
}

/**
 * Decodes HEIC blob to JPEG format.
 * @param blob - HEIC blob
 * @returns Promise<Blob> JPEG blob
 */
export async function decodeHeicToJpeg(blob: Blob): Promise<Blob> {
  // TODO: Implement per AC-4
  // 1. Dynamic import heic2any
  // 2. Call with { blob, toType: 'image/jpeg' }
  // 3. Handle array result: if Array, return first element; else return as-is
  return new Blob();
}
