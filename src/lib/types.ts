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
