/**
 * Image dimension detection utilities.
 *
 * Reads image width and height from a Blob without loading entire image into memory.
 * Uses canvas or img tag to measure dimensions.
 */

export interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Gets image dimensions from a Blob.
 * @param blob - Image blob (JPEG, PNG, etc.)
 * @returns Promise with width and height
 */
export async function getImageSize(blob: Blob): Promise<ImageDimensions> {
  // TODO: Implement per AC-6
  // 1. Create URL from blob: URL.createObjectURL(blob)
  // 2. Load image and measure:
  //    - Option A: Create <img>, read .width/.height after load
  //    - Option B: Create canvas, draw and measure
  // 3. Clean up: URL.revokeObjectURL()
  // 4. Return { width, height }
  return { width: 0, height: 0 };
}
