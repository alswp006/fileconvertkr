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
export type SelectedFileListFn = (props: { files: File[]; onRemove: (index: number) => void }) => JSX.Element;

/** 압축 크기 선택기. 0014(Compress)가 필요 (구현: 패킷 0008) */
export type TargetSizeSelectorFn = (props: { value: number; onChange: (kb: number) => void; disabled?: boolean }) => JSX.Element;

/** 결과 요약. 0012(Result)에서 사용 (구현: 패킷 0009) */
export type ResultSummaryFn = (props: { result: ConversionResult; toolType: ToolType }) => JSX.Element;

/** 결과 파일 행. 0012(Result)에서 사용 (구현: 패킷 0009) */
export type OutputRowFn = (props: { file: { name: string; size: number; url: string }; onDownload?: () => void }) => JSX.Element;

/** 라우팅 상수. 0019(App), 페이지들이 참조 (구현: 패킷 0001) */
export type ROUTES = { home: '/'; convert: { heic: '/convert/heic'; compress: '/convert/compress' }; pdf: { merge: '/pdf/merge'; split: '/pdf/split'; toImage: '/pdf/to-image' }; result: '/result'; history: '/history' };

/** 파일 크기 포맷. 0007-0009(components), 0012+(pages)가 사용 (구현: 패킷 0001) */
export type formatFileSizeFn = (bytes: number) => string;

/** 작업 ID 생성. 0003(runner), 0002(store)가 호출 (구현: 패킷 0001) */
export type generateJobIdFn = () => string;

/** 결과 화면 알림. 0012(Result)에서 필요 (구현: 패킷 0010) */
export type useResultNoticesFn = () => { notices: { type: 'success' | 'warning' | 'error'; message: string }[]; dismiss: (index: number) => void };
