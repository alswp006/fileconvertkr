# Shared Context (auto-generated — do NOT modify)


## 패킷 간 계약 (src/lib/contract.ts — 자동 생성, 수정 금지)
여기 선언된 이름·인자·반환 타입은 확정이다. 기반 패킷은 이대로 구현하고,
화면 패킷은 이대로 호출하라. 다르게 만들지 마라.

```typescript
/**
 * 패킷 간 인터페이스 계약 — 자동 생성. **수정하지 마라.**
 *
 * 기반 패킷은 여기 선언된 모양 그대로 구현하고, 화면 패킷은 여기 적힌 이름·인자·반환
 * 타입을 그대로 가정해도 된다. 추측이 어긋나 병합에서 무너지는 것을 막기 위한 파일이다.
 */

/** 변환 작업 엔티티. 0003(runner), 0002(store), 0012+(pages)가 필요 (구현: 패킷 0001) */
export type Job = { id: string; toolType: ToolType; status: 'pending' | 'processing' | 'done' | 'error'; createdAt: number; inputFiles: { name: string; size: number; blob: Blob }[]; progress?: number; error?: string };

/** 변환 완료 결과. 0003(runner), 0012+(pages), 0009+(result UI)가 필요 (구현: 패킷 0001) */
export type ConversionResult = { jobId: string; files: { name: string; size: number; url: string; mimeType: string }[]; failed?: { name: string; reason: string }[]; completedAt: number };

/** 도구 분류. 라우팅, 저장소, 페이지들이 참조 (구현: 패킷 0001) */
export type ToolType = 'heic-convert' | 'image-compress' | 'pdf-merge' | 'pdf-split' | 'pdf-to-image';

/** 변환 실행 엔진. 0013-0017(pages), 0012(result)이 호출 (구현: 패킷 0003) */
export type runJobFn = (job: Job, converters: Record<ToolType, (files: Blob[], opts: any) => Promise<Blob[]>>) => Promise<void>;

/** 변환 실행 훅. 모든 변환 페이지가 필요 (구현: 패킷 0003) */
export type useConversionRunnerFn = () => { runJob: (toolType: ToolType, files: File[], options: any) => Promise<string>; jobHistory: Job[]; currentJob?: Job };

/** 이력 저장소. 0018(History), 0012(Result), 0010(notification)이 필요 (구현: 패킷 0002) */
export type historyRepoFn = { list: () => Promise<{ jobId: string; toolType: ToolType; createdAt: number; status: 'done' | 'error' }[]>; get: (jobId: string) => Promise<Job & { result?: ConversionResult } | null>; save: (job: Job, result?: ConversionResult) => Promise<void> };

/** 사용자 설정 저장소. 압축 페이지, 결과 페이지가 필요 (구현: 패킷 0002) */
export type prefsStoreFn = { getTargetSize: () => Promise<number>; setTargetSize: (kb: number) => Promise<void>; getLastToolType: () => Promise<ToolType | null> };

/** 이미지 압축. 0014(Compress), 0003(runner)이 호출 (구현: 패킷 0005) */
export type compressToTargetFn = (blob: Blob, targetKb: number, options?: { quality?: number; maxWidth?: number }) => Promise<Blob>;

/** PDF 병합. 0015(PdfMerge), 0003(runner)이 호출 (구현: 패킷 0006) */
export type mergePdfBlobsFn = (blobs: Blob[], options?: { keepBookmarks?: boolean }) => Promise<Blob>;

/** PDF 분할. 0017(PdfSplit), 0003(runner)이 호출 (구현: 패킷 0006) */
export type splitPdfFn = (blob: Blob, ranges: { start: number; end: number }[]) => Promise<Blob[]>;

/** PDF→이미지 렌더링. 0016(PdfToImage), 0003(runner)이 호출 (구현: 패킷 0006) */
export type renderPdfToImagesFn = (blob: Blob, options: { scale?: number; format?: 'png' | 'jpeg'; quality?: number }) => Promise<{ pages: { number: number; image: Blob }[] }>;

/** HEIC 변환. 0013(Heic), 0003(runner)이 호출 (구현: 패킷 0004) */
export type heicToJpegFn = (blob: Blob, quality?: number) => Promise<Blob>;

/** 파일 선택 UI. 0013-0017(pages)이 재사용 (구현: 패킷 0007) */
export type FilePickSectionFn = (props: { accept: string; multiple?: boolean; onFilesSelected: (files: File[]) => void }) => JSX.Element;

/** 선택된 파일 목록. 변환 페이지들이 필요 (구현: 패킷 0007) */
expor
```

## Shared Types Contract (IMPORT these, do NOT redefine)
```typescript
// Domain types — SPEC Data Models (.ai-factory/spec.md)

export type ToolType = 'heic' | 'compress' | 'pdf-merge' | 'pdf-to-image' | 'pdf-split';

export type JobOptions =
  | { tool: 'heic'; format: 'jpg' | 'png'; quality: 0.92 }
  | { tool: 'compress'; targetBytes: number }
  | { tool: 'pdf-merge' }
  | { tool: 'pdf-to-image'; format: 'jpg' | 'png'; scale: 1.5 | 2; pages: number[] }
  | { tool: 'pdf-split'; mode: 'each' | 'ranges'; groups: Array<{ start: number; end: number }> };

export interface InputFileMeta {
  name: string;
  sizeBytes: number;
  mimeType: string;
  pageCount?: number;
}

export type OutputNote = 'ALREADY_UNDER_TARGET' | 'TARGET_NOT_REACHED';

// 불변 레코드. job과 함께 생성되고 수정되지 않는다(updatedAt 없음, 시각은 job.createdAt)
export interface ConversionOutput {
  id: string;
  sourceName: string;
  fileName: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';
  sizeBytes: number;
  sourceSizeBytes: number;
  blob: Blob;
  objectUrl: string;
  width?: number;
  height?: number;
  pageCount?: number;
  note?: OutputNote;
}

// 불변 레코드. runJob이 실패 시점에 한 번 만든다(updatedAt 없음, 시각은 job.createdAt)
export interface ConversionFailure {
  id: string;
  inputIndex: number;
  fileName: string;
  message: string;
}

// 불변 레코드. saveJob 이후 수정되지 않는다(updatedAt 없음)
export interface ConversionJob {
  jobId: string;
  tool: ToolType;
  createdAt: string;
  options: JobOptions;
  inputs: InputFileMeta[];
  outputs: ConversionOutput[];
  failures: ConversionFailure[];
  durationMs: number;
  status: 'success' | 'partial';
}

// append-only 레코드. 생성 후 수정되지 않으므로 updatedAt을 두지 않는다
export interface HistoryEntry {
  id: string;
  tool: ToolType;
  createdAt: string;
  status: 'success' | 'partial';
  inputCount: number;
  outputCount: number;
  failedCount: number;
  inputTotalBytes: number;
  outputTotalBytes: number;
  inputNames: string[];
  outputNames: string[];
}

// 수정되는 싱글턴 레코드(기기당 1개)
export interface ConvertPrefs {
  id: 'prefs';
  createdAt: string | null;
  updatedAt: string | null;
  heicFormat: 'jpg' | 'png';
  compressTargetKB: number;
  pdfImageFormat: 'jpg' | 'png';
  pdfImageScale: 1.5 | 2;
}

export type ConvertPrefsValues = Pick<
  ConvertPrefs,
  'heicFormat' | 'compressTargetKB' | 'pdfImageFormat' | 'pdfImageScale'
>;

export type ValidationError = {
  fileName: string;
  type: 'UNSUPPORTED_TYPE' | 'FILE_TOO_LARGE' | 'TOTAL_TOO_LARGE' | 'TOO_MANY_FILES';
  message: string;
};

export type ResultRouteState = {
  jobId: string;
  historySaveFailed?: true;
};

```

## Existing Codebase (import and use these — do NOT recreate)
### File Tree (src/)
  App.tsx
  components/
    AdSlot.tsx
    Amount.tsx
    BottomCTA.tsx
    Card.tsx
    CountUp.tsx
    FloatingTabBar.tsx
    MiniBar.tsx
    PageShell.tsx
    ScreenScaffold.tsx
    Sparkline.tsx
    StateView.tsx
    SummaryHero.tsx
    TossPurchase.tsx
    TossRewardAd.tsx
  hooks/
    useConversionRunner.ts
  lib/
    analytics.ts
    contract.ts
    convert/
    deliverFile.ts
    finishJob.ts
    jobStore.ts
    pdf/
    review.ts
    runJob.ts
    share.ts
    storage/
    storage.ts
    toolMeta.ts
    types.ts
    utils.ts
    validateFiles.ts
  main.tsx
  pages/
    Compress.tsx
    Heic.tsx
    History.tsx
    Home.tsx
    PdfMerge.tsx
    PdfSplit.tsx
    PdfToImage.tsx
    Result.tsx
    __TdsGallery.tsx
  styles/
    globals.css
    reward-ad.css
  test/
    setup.ts
  types/
  vite-env.d.ts

### Exports (src/lib/)
- analytics.ts: export type LogFields = Record<string, string | number | boolean | null>; export const DWELL_MS = 3000; export function fireAndForget(call: () => unknown): void; export function logScreen(page: string, extra?: LogFields): void; export function logClick(name: string, extra?: LogFields): void; export function logImpression(name: string, extra?: LogFields): void; export function useScreenLog(page: string): void
- contract.ts: export type Job =; export type ConversionResult =; export type ToolType = 'heic-convert' | 'image-compress' | 'pdf-merge' | 'pdf-split' | 'pdf-to-image'; export type runJobFn = (job: Job, converters: Record<ToolType, (files: Blob[], opts: any) => Promise<Blob[]>>) => Promis; export type useConversionRunnerFn = () =>; export type historyRepoFn =; export type prefsStoreFn =; export type compressToTargetFn = (blob: Blob, targetKb: number, options?:
- convert/canvasEncode.ts: export interface EncodeToTargetResult; export async function encodeToTarget( blob: Blob, targetBytes: number, ): Promise<EncodeToTargetResult>
- convert/compress.ts: export interface CompressResult; export async function compressToTarget(file: File, targetBytes: number): Promise<CompressResult>
- convert/heic.ts: export interface ConversionResult; export function isHeic(file: File): boolean; export async function convertHeic( file: File, format: 'jpg' | 'png', ): Promise<ConversionResult>; export async function decodeHeicToJpeg(blob: Blob): Promise<Blob>; export async function heicToJpeg(blob: Blob, quality = 0.92): Promise<Blob>
- convert/imageSize.ts: export interface ImageDimensions; export async function getImageSize(blob: Blob): Promise<ImageDimensions>
- deliverFile.ts: export async function deliverFile(output: ConversionOutput): Promise<void>
- finishJob.ts: export async function finishJob( job: ConversionJob, navigate: NavigateFunction ): Promise<void>
- jobStore.ts: export const jobStore =
- pdf/merge.ts: export type PdfErrorCode = 'ENCRYPTED' | 'UNREADABLE'; export class PdfError extends Error; export type MergeResult =; export async function readPdfPageCount(blob: Blob): Promise<number>; export async function mergePdfs(blobs: Blob[]): Promise<MergeResult>; export async function mergePdfBlobs(blobs: Blob[], _options?:
- pdf/pageRanges.ts: export type RangeGroup =; export type ParsePagesResult =; export type ParseGroupsResult =; export function parsePageRanges(input: string, totalPages: number): ParsePagesResult; export function parseRangeGroups(input: string, totalPages: number): ParseGroupsResult; export function generateSplitFilenames(baseName: string, groups: RangeGroup[], totalPages: number): string[]; export function generateSplitPageCounts(groups: RangeGroup[]): number[]
- pdf/render.ts: export type PdfRenderErrorCode = 'ENCRYPTED' | 'UNREADABLE'; export class PdfRenderError extends Error; export type RenderFormat = 'jpeg' | 'png' | 'webp'; export async function loadPdf(blob: Blob): Promise<PDFDocumentProxy>; export async function renderPageToBlob( pdf: PDFDocumentProxy, pageNumber: number, scale: number, format: RenderFormat =; export async function renderPdfToImages( blob: Blob, options:
- pdf/split.ts: export interface SplitOutput; export type SplitResult =; export async function splitPdf( file: File | Blob, groups: RangeGroup[], totalPages: number, onProgress?: (done: number,
- review.ts: export function requestReviewOnce(key: string = REVIEW_REQUESTED_KEY): void
- runJob.ts: export async function runJob<T extends ConversionOutput>( inputs: File[], process: (file: File) => Promise<T[]>, opts:; export function buildJob( jobId: string, tool: ToolType, options: JobOptions, inputs: InputFileMeta[], outputs: Conversi; export function toHistoryEntry(job: ConversionJob): HistoryEntry
- share.ts: export interface ShareAppOptions; export async function shareApp(opts: ShareAppOptions): Promise<void>
- storage/historyRepo.ts: export type HistoryAppendInput = Pick<HistoryEntry, 'tool' | 'inputNames' | 'inputCount'> & Partial<Omit<HistoryEntry, '; export const historyRepo =
- storage/pre...
CRITICAL: Before creating any new function, type, or component, check the list above. If something similar exists, import and use it.

## Already Implemented (do NOT duplicate or overwrite)
- 0002: 저장소: validateFiles·prefs·historyRepo·jobStore (files: src/lib/validateFiles.ts, src/lib/storage/prefs.ts, src/lib/storage/historyRepo.ts, src/lib/jobStore.ts, src/lib/storage/storage.test.ts)
- 0004: 빌드 설정·변환 라이브러리 설치·HEIC 변환기 (files: package.json, vite.config.ts, src/test/setup.ts, src/lib/convert/heic.ts, src/lib/convert/imageSize.ts)
- 0005: 이미지 압축 엔진 encodeToTarget·compressToTarget (files: src/lib/convert/canvasEncode.ts, src/lib/convert/compress.ts, src/lib/convert/compress.test.ts)
- 0006: PDF 엔진: 범위 파서·합치기·나누기·렌더러 (files: src/lib/pdf/pageRanges.ts, src/lib/pdf/merge.ts, src/lib/pdf/split.ts, src/lib/pdf/render.ts, src/lib/pdf/pageRanges.test.ts)