/**
 * Canvas 기반 JPEG quality 이분 탐색 인코더.
 *
 * 캔버스를 흰 배경으로 채운 뒤 toBlob('image/jpeg', quality)로 목표 이하 후보 중
 * 가장 큰 것을 찾는다. 해상도 1단계당 최대 8회 인코딩하고, 목표 이하 후보가 없으면
 * 해상도를 줄여 재시도한다(최대 5회 축소).
 */

export interface EncodeToTargetResult {
  blob: Blob;
  sizeBytes: number;
  width: number;
  height: number;
  /** true면 목표 이하 후보를 찾음, false면 최소 결과(TARGET_NOT_REACHED)를 반환 */
  reached: boolean;
}

// 0.1 단위 리터럴 — 이분 탐색 mid가 항상 이 값들 중 하나에 정확히 떨어져야 한다
// (부동소수 연산으로 값을 만들면 0.1*6 !== 0.6 같은 오차가 생길 수 있다).
const QUALITY_LEVELS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
const MAX_QUALITY_STEPS = 8;
const MAX_DOWNSCALES = 5;
const DOWNSCALE_FACTOR = 0.75;

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('이미지를 불러올 수 없어요'));
    img.src = url;
  });
}

function drawToCanvas(img: HTMLImageElement, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
  }

  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('이미지 인코딩에 실패했어요'));
      },
      'image/jpeg',
      quality,
    );
  });
}

export async function encodeToTarget(
  blob: Blob,
  targetBytes: number,
): Promise<EncodeToTargetResult> {
  const img = await loadImage(blob);

  try {
    let width = img.naturalWidth;
    let height = img.naturalHeight;

    // 원시값(Blob|null + number)으로 추적 — 객체 유니언(`{...} | null`)을 루프 안에서
    // break와 함께 쓰면 TS 제어 흐름 분석이 다음 반복 진입 시점의 타입을 `never`로
    // 좁혀버린다(둘 다 null이어야만 루프를 계속하므로). 원시값은 이 함정이 없다.
    let bestBlob: Blob | null = null;
    let bestSize = -Infinity;
    let bestWidth = width;
    let bestHeight = height;

    let smallestBlob: Blob | null = null;
    let smallestSize = Infinity;
    let smallestWidth = width;
    let smallestHeight = height;

    for (let downscale = 0; downscale <= MAX_DOWNSCALES; downscale++) {
      const canvas = drawToCanvas(img, width, height);

      let lo = 0;
      let hi = QUALITY_LEVELS.length - 1;
      let resolutionBestBlob: Blob | null = null;
      let resolutionBestSize = -Infinity;

      for (let step = 0; step < MAX_QUALITY_STEPS && lo <= hi; step++) {
        const mid = Math.floor((lo + hi) / 2);
        const quality = QUALITY_LEVELS[mid];
        const candidate = await canvasToBlob(canvas, quality);
        const sizeBytes = candidate.size;

        if (sizeBytes < smallestSize) {
          smallestBlob = candidate;
          smallestSize = sizeBytes;
          smallestWidth = width;
          smallestHeight = height;
        }

        if (sizeBytes <= targetBytes) {
          resolutionBestBlob = candidate;
          resolutionBestSize = sizeBytes;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }

      if (resolutionBestBlob && resolutionBestSize > bestSize) {
        bestBlob = resolutionBestBlob;
        bestSize = resolutionBestSize;
        bestWidth = width;
        bestHeight = height;
      }

      if (bestBlob) break;

      width = Math.max(1, Math.round(width * DOWNSCALE_FACTOR));
      height = Math.max(1, Math.round(height * DOWNSCALE_FACTOR));
    }

    if (bestBlob) {
      return { blob: bestBlob, sizeBytes: bestSize, width: bestWidth, height: bestHeight, reached: true };
    }

    return {
      blob: smallestBlob!,
      sizeBytes: smallestSize,
      width: smallestWidth,
      height: smallestHeight,
      reached: false,
    };
  } finally {
    URL.revokeObjectURL(img.src);
  }
}
