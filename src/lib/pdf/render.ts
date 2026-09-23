/**
 * pdfjs-dist 로 PDF 페이지를 렌더링해 이미지 Blob으로 만든다.
 *
 * pdfjs-dist는 런타임에 동적 import로만 불러온다(AC-5) — legacy 빌드
 * ('pdfjs-dist/legacy/build/pdf.mjs')만 쓴다(Android 7+/iOS 16+ 호환).
 * workerSrc는 항상 로컬 번들 경로('?url' 동적 import)이고 CDN URL을 쓰지 않는다.
 */

import type { PDFDocumentProxy } from 'pdfjs-dist';

export type PdfRenderErrorCode = 'ENCRYPTED' | 'UNREADABLE';

export class PdfRenderError extends Error {
  code: PdfRenderErrorCode;
  constructor(code: PdfRenderErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'PdfRenderError';
    this.code = code;
  }
}

export type RenderFormat = 'jpeg' | 'png' | 'webp';

let workerConfigured = false;

async function getPdfjs() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  if (!workerConfigured) {
    const workerUrl = (await import('pdfjs-dist/legacy/build/pdf.worker.mjs?url')).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    workerConfigured = true;
  }
  return pdfjs;
}

function toRenderError(err: unknown, pdfjs: Awaited<ReturnType<typeof getPdfjs>>): PdfRenderError {
  if (err instanceof pdfjs.PasswordException) {
    return new PdfRenderError('ENCRYPTED', 'PDF에 암호가 걸려 있습니다');
  }
  return new PdfRenderError('UNREADABLE', 'PDF를 읽을 수 없습니다');
}

export async function loadPdf(blob: Blob): Promise<PDFDocumentProxy> {
  const pdfjs = await getPdfjs();
  try {
    const bytes = await blob.arrayBuffer();
    return await pdfjs.getDocument({ data: bytes }).promise;
  } catch (err) {
    throw toRenderError(err, pdfjs);
  }
}

const MIME_BY_FORMAT: Record<RenderFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export async function renderPageToBlob(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  scale: number,
  format: RenderFormat = 'jpeg',
  quality = 0.92
): Promise<Blob> {
  const pdfjs = await getPdfjs();
  try {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas context를 만들 수 없습니다');

    await page.render({ canvasContext: ctx, viewport, canvas }).promise;

    const mimeType = MIME_BY_FORMAT[format];
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, mimeType, quality);
    });
    if (!blob) throw new Error('이미지 생성에 실패했습니다');
    return blob;
  } catch (err) {
    throw toRenderError(err, pdfjs);
  }
}

/**
 * 계약(contract.ts) 표준 시그니처 — PDF 전체 페이지를 순서대로 렌더링해
 * { pages: [{ number, image }] } 형태로 반환한다. 실패는 PdfRenderError로 throw.
 */
export async function renderPdfToImages(
  blob: Blob,
  options: { scale?: number; format?: 'png' | 'jpeg'; quality?: number }
): Promise<{ pages: { number: number; image: Blob }[] }> {
  const scale = options.scale ?? 1.5;
  const format = options.format ?? 'jpeg';
  const quality = options.quality ?? 0.92;

  const pdf = await loadPdf(blob);
  const pages: { number: number; image: Blob }[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const image = await renderPageToBlob(pdf, pageNumber, scale, format, quality);
    pages.push({ number: pageNumber, image });
  }
  return { pages };
}
