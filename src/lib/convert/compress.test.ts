import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockHeic2Any = vi.fn();
vi.mock('heic2any', () => ({ default: mockHeic2Any }));

import { compressToTarget } from '@/lib/convert/compress';

describe('compressToTarget', () => {
  let mockCanvasToBlob: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCanvasToBlob = vi.fn();
    HTMLCanvasElement.prototype.toBlob = mockCanvasToBlob;
  });

  // F3-AC-2
  it('bounds toBlob calls (≤8/resolution, ≤5 downscales) and picks the largest candidate ≤ target', async () => {
    const qualityMap: Record<number, number> = {
      0.5: 300000,
      0.6: 360000,
      0.7: 420000,
      0.8: 480000,
      0.9: 540000,
    };

    mockCanvasToBlob.mockImplementation((callback: BlobCallback, type: string, quality?: number) => {
      const sizeBytes = quality && quality in qualityMap ? qualityMap[quality as keyof typeof qualityMap] : 600000;
      callback(new Blob([new Uint8Array(sizeBytes)], { type }));
    });

    const file = new File([new Uint8Array(800000)], 'image.jpg', { type: 'image/jpeg' });
    const result = await compressToTarget(file, 512000);

    expect(result.sizeBytes).toBe(480000);
    expect(result.blob).toBeInstanceOf(Blob);
    expect(mockCanvasToBlob.mock.calls.length).toBeLessThanOrEqual(40);
  });

  // F3-AC-3
  it('returns ALREADY_UNDER_TARGET without touching toBlob when already under target', async () => {
    const smallFile = new File([new Uint8Array(307200)], 'small.jpg', { type: 'image/jpeg' });
    const result = await compressToTarget(smallFile, 512000);

    expect(result.blob).toBe(smallFile);
    expect(result.note).toBe('ALREADY_UNDER_TARGET');
    expect(result.fileName).toBe('small_compressed.jpg');
    expect(result.mimeType).toBe('image/jpeg');
    expect(result.sizeBytes).toBe(307200);
    expect(result.sourceSizeBytes).toBe(307200);
    expect(mockCanvasToBlob).not.toHaveBeenCalled();
  });

  // F3-AC-4
  it('returns TARGET_NOT_REACHED with the minimum achievable size after max downscaling', async () => {
    mockCanvasToBlob.mockImplementation((callback: BlobCallback, type: string) => {
      callback(new Blob([new Uint8Array(626688)], { type }));
    });

    const hugeFile = new File([new Uint8Array(2000000)], 'huge.jpg', { type: 'image/jpeg' });
    const result = await compressToTarget(hugeFile, 512000);

    expect(result.sizeBytes).toBe(626688);
    expect(result.note).toBe('TARGET_NOT_REACHED');
  });

  // F3-AC-10
  it('decodes HEIC via heic2any and returns the decoded blob as-is when ≤ target', async () => {
    const decodedBlob = new Blob([new Uint8Array(716800)], { type: 'image/jpeg' });
    mockHeic2Any.mockResolvedValueOnce(decodedBlob);

    const heicFile = new File([new Uint8Array(409600)], 'IMG_2.heic', { type: '' });
    const result = await compressToTarget(heicFile, 1048576);

    expect(result.blob).toBe(decodedBlob);
    expect(result.mimeType).toBe('image/jpeg');
    expect(result.fileName).toBe('IMG_2_compressed.jpg');
    expect(result.sizeBytes).toBe(716800);
    expect(result.sourceSizeBytes).toBe(409600);
    expect(mockCanvasToBlob).not.toHaveBeenCalled();
  });

  // F3-AC-11
  it('detects WebP from extension when type is empty and returns as-is when ≤ target', async () => {
    const webpFile = new File([new Uint8Array(204800)], 'sticker.webp', { type: '' });
    const result = await compressToTarget(webpFile, 512000);

    expect(result.blob).toBe(webpFile);
    expect(result.mimeType).toBe('image/webp');
    expect(result.fileName).toBe('sticker_compressed.webp');
    expect(result.sizeBytes).toBe(204800);
    expect(result.sourceSizeBytes).toBe(204800);
    expect(mockHeic2Any).not.toHaveBeenCalled();
    expect(mockCanvasToBlob).not.toHaveBeenCalled();
  });
});
