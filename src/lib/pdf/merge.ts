/**
 * PDF 페이지 수 읽기 및 병합 (pdf-lib).
 *
 * pdf-lib는 런타임에 동적 import로만 불러온다(AC-5) — 정적 import는 빌드 번들에
 * 무조건 포함되어 다른 도구(HEIC/압축)만 쓰는 사용자에게도 로드되므로 금지.
 */

export type PdfErrorCode = 'ENCRYPTED' | 'UNREADABLE';

export class PdfError extends Error {
  code: PdfErrorCode;
  constructor(code: PdfErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'PdfError';
    this.code = code;
  }
}

export type MergeResult = { ok: true; pageCount: number; blob: Blob } | { ok: false; code: PdfErrorCode };

async function loadPdfLib() {
  return import('pdf-lib');
}

export async function readPdfPageCount(blob: Blob): Promise<number> {
  const { PDFDocument, EncryptedPDFError } = await loadPdfLib();
  const bytes = await blob.arrayBuffer();
  try {
    const doc = await PDFDocument.load(bytes);
    return doc.getPageCount();
  } catch (err) {
    if (err instanceof EncryptedPDFError) {
      throw new PdfError('ENCRYPTED', 'PDF에 암호가 걸려 있습니다');
    }
    throw new PdfError('UNREADABLE', 'PDF를 읽을 수 없습니다');
  }
}

export async function mergePdfs(blobs: Blob[]): Promise<MergeResult> {
  const { PDFDocument, EncryptedPDFError } = await loadPdfLib();

  try {
    const merged = await PDFDocument.create();

    for (const blob of blobs) {
      const bytes = await blob.arrayBuffer();
      const src = await PDFDocument.load(bytes);
      const copiedPages = await merged.copyPages(src, src.getPageIndices());
      copiedPages.forEach((page) => merged.addPage(page));
    }

    const bytes = await merged.save();
    return {
      ok: true,
      pageCount: merged.getPageCount(),
      blob: new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }),
    };
  } catch (err) {
    if (err instanceof EncryptedPDFError) {
      return { ok: false, code: 'ENCRYPTED' };
    }
    return { ok: false, code: 'UNREADABLE' };
  }
}

/**
 * 계약(contract.ts) 표준 시그니처 — 성공 시 합쳐진 PDF Blob을 바로 반환하고
 * 실패는 PdfError로 throw한다(0003 runner 등 소비자가 try/catch로 처리).
 * keepBookmarks: pdf-lib는 아웃라인(북마크) 복사 API를 제공하지 않아 항상
 * 페이지만 복사한다 — 옵션은 시그니처 호환을 위해 받되 동작에 영향 없음.
 */
export async function mergePdfBlobs(blobs: Blob[], _options?: { keepBookmarks?: boolean }): Promise<Blob> {
  const result = await mergePdfs(blobs);
  if (!result.ok) {
    throw new PdfError(result.code);
  }
  return result.blob;
}
