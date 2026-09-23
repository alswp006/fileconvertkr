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
// Domain types — add your app-specific types here
export {};

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
  lib/
    analytics.ts
    review.ts
    share.ts
    storage.ts
    types.ts
    utils.ts
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
  types/
  vite-env.d.ts

### Exports (src/lib/)
- analytics.ts: export type LogFields = Record<string, string | number | boolean | null>; export const DWELL_MS = 3000; export function fireAndForget(call: () => unknown): void; export function logScreen(page: string, extra?: LogFields): void; export function logClick(name: string, extra?: LogFields): void; export function logImpression(name: string, extra?: LogFields): void; export function useScreenLog(page: string): void
- review.ts: export function requestReviewOnce(key: string = REVIEW_REQUESTED_KEY): void
- share.ts: export interface ShareAppOptions; export async function shareApp(opts: ShareAppOptions): Promise<void>
- storage.ts: export function getItem<T>(key: string): T | null; export function setItem<T>(key: string, value: T): void; export function removeItem(key: string): void
- utils.ts: export function cn(...classes: (string | boolean | undefined | null)[]): string; export function formatNumber(n: number): string; export function formatCurrency(n: number, currency = 'KRW'): string

### Components (src/components/)
- AdSlot.tsx: AdSlot
- Amount.tsx: Amount
- BottomCTA.tsx: SubmitFooter, ButtonStack
- Card.tsx: Card
- CountUp.tsx: CountUp
- FloatingTabBar.tsx: FloatingTabBar
- MiniBar.tsx: MiniBar
- PageShell.tsx: PageShell
- ScreenScaffold.tsx: ScreenScaffold
- Sparkline.tsx: Sparkline
- StateView.tsx: EmptyState, LoadingState
- SummaryHero.tsx: SummaryHero
- TossPurchase.tsx: TossPurchase
- TossRewardAd.tsx: TossRewardAd
CRITICAL: Before creating any new function, type, or component, check the list above. If something similar exists, import and use it.