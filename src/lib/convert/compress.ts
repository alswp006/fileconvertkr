/**
 * 이미지 압축 엔진: 파일을 targetBytes 이하로 압축한다.
 *
 * HEIC는 먼저 JPEG로 디코드한다. 디코드 결과(또는 원본)가 이미 목표 이하면
 * 재인코딩 없이 원래 형식 그대로 ALREADY_UNDER_TARGET으로 반환하고, 초과할 때만
 * encodeToTarget으로 JPEG 재인코딩한다.
 */

import { isHeic, decodeHeicToJpeg } from '@/lib/convert/heic';
import { encodeToTarget } from '@/lib/convert/canvasEncode';
import type { OutputNote } from '@/lib/types';

type ImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

export interface CompressResult {
  blob: Blob;
  fileName: string;
  mimeType: ImageMime;
  sizeBytes: number;
  sourceSizeBytes: number;
  width?: number;
  height?: number;
  note?: OutputNote;
}

const EXT_TO_MIME: Record<string, ImageMime> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

function getExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex === -1 ? '' : fileName.slice(dotIndex + 1).toLowerCase();
}

function getBaseName(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex === -1 ? fileName : fileName.slice(0, dotIndex);
}

function detectMimeType(file: File): ImageMime {
  if (file.type) return file.type as ImageMime;
  return EXT_TO_MIME[getExtension(file.name)] ?? 'image/jpeg';
}

export async function compressToTarget(file: File, targetBytes: number): Promise<CompressResult> {
  const sourceSizeBytes = file.size;
  const baseName = getBaseName(file.name);

  let workingBlob: Blob = file;
  let workingMimeType: ImageMime = detectMimeType(file);
  let outputExt = getExtension(file.name) || 'jpg';

  if (isHeic(file)) {
    workingBlob = await decodeHeicToJpeg(file);
    workingMimeType = 'image/jpeg';
    outputExt = 'jpg';
  }

  if (workingBlob.size <= targetBytes) {
    return {
      blob: workingBlob,
      fileName: `${baseName}_compressed.${outputExt}`,
      mimeType: workingMimeType,
      sizeBytes: workingBlob.size,
      sourceSizeBytes,
      note: 'ALREADY_UNDER_TARGET',
    };
  }

  const encoded = await encodeToTarget(workingBlob, targetBytes);

  return {
    blob: encoded.blob,
    fileName: `${baseName}_compressed.jpg`,
    mimeType: 'image/jpeg',
    sizeBytes: encoded.sizeBytes,
    sourceSizeBytes,
    width: encoded.width,
    height: encoded.height,
    note: encoded.reached ? undefined : 'TARGET_NOT_REACHED',
  };
}
