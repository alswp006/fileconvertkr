/**
 * PDF 분할 (pdf-lib). 그룹 하나당 결과 파일 하나를 만든다.
 *
 * pdf-lib는 런타임에 동적 import로만 불러온다(AC-5).
 */

import type { RangeGroup } from './pageRanges';
import { generateSplitFilenames } from './pageRanges';
import type { PdfErrorCode } from './merge';

export interface SplitOutput {
  blob: Blob;
  fileName: string;
  pageCount: number;
}

export type SplitResult = { ok: true; outputs: SplitOutput[] } | { ok: false; code: PdfErrorCode };

function stripExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? name : name.slice(0, dot);
}

export async function splitPdf(
  file: File | Blob,
  groups: RangeGroup[],
  totalPages: number,
  onProgress?: (done: number, total: number) => void
): Promise<SplitResult> {
  const { PDFDocument, EncryptedPDFError } = await import('pdf-lib');

  const baseName = file instanceof File ? stripExtension(file.name) : 'split';
  const filenames = generateSplitFilenames(baseName, groups, totalPages);

  try {
    const bytes = await file.arrayBuffer();
    const src = await PDFDocument.load(bytes);
    const outputs: SplitOutput[] = [];

    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      const pageIndices: number[] = [];
      for (let p = group.start; p <= group.end; p++) pageIndices.push(p - 1);

      const out = await PDFDocument.create();
      const copiedPages = await out.copyPages(src, pageIndices);
      copiedPages.forEach((page) => out.addPage(page));
      const outBytes = await out.save();

      outputs.push({
        blob: new Blob([new Uint8Array(outBytes)], { type: 'application/pdf' }),
        fileName: filenames[i],
        pageCount: group.end - group.start + 1,
      });

      onProgress?.(i + 1, groups.length);
    }

    return { ok: true, outputs };
  } catch (err) {
    if (err instanceof EncryptedPDFError) {
      return { ok: false, code: 'ENCRYPTED' };
    }
    return { ok: false, code: 'UNREADABLE' };
  }
}
