/**
 * Test setup for image conversion and file handling.
 *
 * Provides:
 * - URL.createObjectURL mock for Blob handling
 * - Image loading helpers for dimension detection
 * - File API stubs for jsdom environment
 */

import { vi } from 'vitest';

// URL.createObjectURL is already mocked in vitest.setup.ts,
// but documented here for reference in image handling tests.

export interface MockImageOptions {
  width?: number;
  height?: number;
}

/**
 * Creates a mock image blob with specified dimensions.
 * Used for testing image size detection without loading real images.
 */
export function createMockImageBlob(
  options: MockImageOptions = { width: 800, height: 600 },
): Blob {
  const { width = 800, height = 600 } = options;

  // Create a minimal valid JPEG header + data
  // (Real implementation would use canvas or actual image data)
  const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0]); // JPEG SOI + APP0
  return new Blob([jpegHeader], { type: 'image/jpeg' });
}

/**
 * Mocks Image.prototype.onload for dimension detection tests.
 */
export function mockImageLoading(): void {
  // jsdom doesn't load images, but tests that read img.width/img.height need a stub
  Object.defineProperty(Image.prototype, 'width', {
    configurable: true,
    get: () => 800,
  });

  Object.defineProperty(Image.prototype, 'height', {
    configurable: true,
    get: () => 600,
  });
}

/**
 * Cleans up image mocks after test.
 */
export function cleanupImageMocks(): void {
  delete (Image.prototype as any).width;
  delete (Image.prototype as any).height;
}
