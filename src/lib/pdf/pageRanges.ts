/**
 * 페이지 범위 문자열 파서 및 분할 파일명 생성.
 *
 * 입력 예: "1-3,5, 7-7" → 정렬·중복 제거된 페이지 목록 [1,2,3,5,7]
 * 공백은 파싱 전에 전부 제거한다.
 */

export type RangeGroup = { start: number; end: number };

export type ParsePagesResult = { ok: true; pages: number[] } | { ok: false; code: 'INVALID' | 'OUT_OF_RANGE' };
export type ParseGroupsResult = { ok: true; groups: RangeGroup[] } | { ok: false; code: 'INVALID' | 'OUT_OF_RANGE' };

const SINGLE_RE = /^[1-9]\d*$/;
const RANGE_RE = /^([1-9]\d*)-([1-9]\d*)$/;

function splitSegments(input: string): string[] | null {
  const cleaned = input.replace(/\s+/g, '');
  if (cleaned === '') return null;
  return cleaned.split(',');
}

function parseSegment(
  segment: string,
  totalPages: number
): { ok: true; start: number; end: number } | { ok: false; code: 'INVALID' | 'OUT_OF_RANGE' } {
  if (segment === '') return { ok: false, code: 'INVALID' };

  if (SINGLE_RE.test(segment)) {
    const n = Number(segment);
    if (n > totalPages) return { ok: false, code: 'OUT_OF_RANGE' };
    return { ok: true, start: n, end: n };
  }

  const rangeMatch = RANGE_RE.exec(segment);
  if (rangeMatch) {
    const start = Number(rangeMatch[1]);
    const end = Number(rangeMatch[2]);
    if (start > end) return { ok: false, code: 'INVALID' };
    if (start > totalPages || end > totalPages) return { ok: false, code: 'OUT_OF_RANGE' };
    return { ok: true, start, end };
  }

  return { ok: false, code: 'INVALID' };
}

export function parsePageRanges(input: string, totalPages: number): ParsePagesResult {
  const segments = splitSegments(input);
  if (!segments) return { ok: false, code: 'INVALID' };

  const pages = new Set<number>();
  for (const segment of segments) {
    const result = parseSegment(segment, totalPages);
    if (!result.ok) return result;
    for (let p = result.start; p <= result.end; p++) pages.add(p);
  }

  return { ok: true, pages: Array.from(pages).sort((a, b) => a - b) };
}

export function parseRangeGroups(input: string, totalPages: number): ParseGroupsResult {
  const segments = splitSegments(input);
  if (!segments) return { ok: false, code: 'INVALID' };

  const groups: RangeGroup[] = [];
  for (const segment of segments) {
    const result = parseSegment(segment, totalPages);
    if (!result.ok) return result;
    groups.push({ start: result.start, end: result.end });
  }

  return { ok: true, groups };
}

function digitWidth(totalPages: number): number {
  return String(totalPages).length;
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

/** F6-AC-2/AC-9: 분할 파일명 — 범위는 "base_start-end.pdf", 단일 페이지는 "base_pNN.pdf" */
export function generateSplitFilenames(baseName: string, groups: RangeGroup[], totalPages: number): string[] {
  const width = digitWidth(totalPages);
  return groups.map((group) => {
    if (group.start === group.end) {
      return `${baseName}_p${pad(group.start, width)}.pdf`;
    }
    return `${baseName}_${pad(group.start, width)}-${pad(group.end, width)}.pdf`;
  });
}

export function generateSplitPageCounts(groups: RangeGroup[]): number[] {
  return groups.map((group) => group.end - group.start + 1);
}
