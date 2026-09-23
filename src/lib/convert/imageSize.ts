/**
 * Image dimension detection utilities.
 *
 * Reads image width and height from a Blob via an offscreen <img> element.
 */

export interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Gets image dimensions from a Blob.
 */
export async function getImageSize(blob: Blob): Promise<ImageDimensions> {
  const url = URL.createObjectURL(blob);

  try {
    return await new Promise<ImageDimensions>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => {
        reject(new Error('이미지 크기를 읽을 수 없어요'));
      };
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
