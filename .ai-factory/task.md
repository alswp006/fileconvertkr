# TASK — FileConvertKR

**작업 구성 메모**
- 각 파일은 **한 작업만 수정**합니다. 여러 작업이 같은 화면에 기능을 더해야 할 때는 이렇게 나눕니다.
  - 기능마다 별도 컴포넌트 파일을 만듭니다.
  - 화면 파일(`src/pages/*.tsx`)을 조립하는 작업은 하나만 둡니다.
  - 표로 적으면 다음과 같습니다.

  | 파일 | 소유 작업 |
  |---|---|
  | `src/pages/ResultPage.tsx` | Task 3.6 |
  | `src/pages/HistoryPage.tsx` | Task 3.12 |
  | `package.json`, `vite.config.ts` | Task 1.2 |

- `RouteState`와 `ResultRouteState`는 `src/lib/types.ts`에 정의합니다.
  - SPEC이 가리키는 `src/lib/routes.ts`는 이 타입을 다시 내보냅니다(re-export).
  - `routes.ts`가 직접 정의하는 값은 `TOOL_ROUTES`뿐입니다.
- 모든 작업의 공통 완료 조건: `tsc --noEmit` 오류 0건, 앱 빌드 성공, 해당 작업의 테스트 통과.
- 테스트 러너는 템플릿에 있는 것을 씁니다(Vitest + Testing Library로 예상).
  - mock으로 대체하는 모듈: `heic2any`, `pdfjs-dist`, 캔버스 `toBlob`, `createImageBitmap`, `@apps-in-toss/web-framework`
  - `pdf-lib`은 mock하지 않습니다. 실제 라이브러리로 테스트용 PDF를 만듭니다.

---

## Epic 1. Data Layer (타입 → 저장소 → 상태 → 변환 엔진)

**Risk**
- Complexity: High. 변환 알고리즘 3종과 PDF 라이브러리 2종을 다룹니다.
- Risk factors:
  - ① 타입이 SPEC과 어긋나면 이후 모든 작업이 틀린 계약 위에 만들어집니다. 특히 조심할 곳:
    - `mimeType`에서 `'image/webp'`가 빠지는 경우
    - 성공했는데 `historySaveFailed: false`가 들어가는 경우
    - `ConvertPrefs`의 `id`·`createdAt`·`updatedAt`을 바깥에서 바꿀 수 있는 경우
  - ② jsdom에는 canvas `toBlob`과 `createImageBitmap`이 없습니다. 압축·렌더링 로직은 mock 없이 검증할 수 없습니다.
  - ③ pdfjs 비-legacy 빌드는 구형 WebView에서 동작하지 않습니다.
  - ④ `QuotaExceededError`를 처리하지 않으면 변환은 성공해도 결과 화면으로 넘어가지 못합니다.
  - ⑤ `heic2any`·`pdf-lib`·`pdfjs`가 첫 번들에 들어가면 홈 로딩이 느려집니다.
  - ⑥ `console.error` 가드를 늦게 넣으면 이미 만든 테스트가 한꺼번에 깨집니다.
- Mitigation:
  - 순서는 **타입(1.1) → 빌드 설정·가드(1.2) → 유틸(1.3~1.4) → 저장소(1.5~1.6) → 상태(1.7, 1.11) → 실행기·완료 처리(1.8~1.10) → 변환 엔진(1.12~1.18)**입니다.
  - 타입 작업에는 실행 코드가 없습니다. ①의 위험은 `@ts-expect-error` 타입 테스트로 컴파일 단계에서 막습니다.
  - 의존성 설치와 `vite.config.ts` 수정은 1.2에서 한 번에 끝냅니다. 이후 작업은 이 두 파일을 수정하지 않습니다.
  - 캔버스 탐색(1.13)과 입력 형식 판정(1.14)을 나눠서 mock 범위를 좁힙니다.
  - 변환 라이브러리는 모두 `import()`로만 불러옵니다. 첫 번들에 들어가지 않았는지는 Task 4.1에서 빌드 산출물로 확인합니다.

### Task 1.1 도메인 타입과 RouteState 정의
- Description: SPEC Data Models의 모든 타입을 `src/lib/types.ts`에 `export type`/`export interface`로만 정의합니다.
  - 대상:
    - `ToolType`, `JobOptions`, `InputFileMeta`, `OutputNote`
    - `ConversionOutput`(mimeType에 `'image/webp'` 포함), `ConversionFailure`, `ConversionJob`
    - `HistoryEntry`, `ConvertPrefs`, `ConvertPrefsValues`, `ValidationError`
  - 라우트 계약:
  ```ts
  export type ResultRouteState = { jobId: string; historySaveFailed?: true };
  export type RouteState = {
    '/': undefined; '/history': undefined;
    '/convert/heic': undefined; '/convert/compress': undefined;
    '/pdf/merge': undefined; '/pdf/to-image': undefined; '/pdf/split': undefined;
    '/result': ResultRouteState;
  };
  export type AppPath = keyof RouteState;
  ```
- DoD:
  - `types.ts`에 실행 코드(값을 내보내는 `export const`/`function`)가 0건입니다.
  - 타입 테스트 결과:
    - `const m: ConversionOutput['mimeType'] = 'image/webp'`가 컴파일됩니다.
    - `'image/heic'` 대입은 `@ts-expect-error`로 표시했고, 실제로 오류가 납니다.
    - `const s: ResultRouteState = { jobId: 'a', historySaveFailed: false }`는 `@ts-expect-error`로 표시했고, 실제로 오류가 납니다.
    - `ConvertPrefsValues`에 `id` 키가 없습니다(`@ts-expect-error`로 확인).
  - `tsc --noEmit` 오류 0건.
- Covers: [F3-AC-11(부분: 타입 오류 0건)]
- Files: `src/lib/types.ts`, `src/lib/types.typetest.ts`
- Depends on: none

### Task 1.2 빌드 설정, 변환 라이브러리 설치, 테스트 가드
- Description:
  - `heic2any`, `pdf-lib`, `pdfjs-dist`를 설치합니다. 이 작업에서는 설치만 하고 import하지 않습니다.
  - `vite.config.ts`:
    - `build.target = ['es2019', 'safari16']`로 설정합니다.
    - 테스트 `setupFiles`에 `src/test/setup.ts`를 등록합니다.
      - 템플릿이 별도 `vitest.config.ts`를 쓰면 그 파일에 등록합니다.
      - 이 경우 작업 결과 보고에 파일 경로를 적습니다.
  - `src/test/setup.ts`: 테스트 중 `console.error`가 호출되면 해당 테스트를 실패시키는 가드를 둡니다.
- DoD:
  - `package.json` dependencies에 세 패키지가 있습니다.
  - `vite.config.ts`의 `build.target`이 `['es2019', 'safari16']`입니다.
  - `console.error`를 일부러 호출하는 샘플 테스트는 실패합니다. 확인이 끝나면 `it.fails`로 고정합니다.
  - `vite build`가 성공합니다.
- Covers: [F5-AC-8(부분: build.target)]
- Files: `package.json`, `vite.config.ts`, `src/test/setup.ts`, `src/test/setup.test.ts`
- Depends on: Task 1.1

### Task 1.3 도구 메타·라우트·표기 유틸·ID 생성
- Description:
  - `toolMeta.ts`: `TOOL_META`를 SPEC 표 순서(heic, compress, pdf-merge, pdf-to-image, pdf-split)로 정의합니다.
    - 도구마다: route, 제목, 부제, accept, 최소·최대 파일 수
    - 파일당 용량 31,457,280B, 합계 용량 104,857,600B
  - `routes.ts`: `TOOL_ROUTES`를 정의하고 `export type { ResultRouteState, RouteState, AppPath } from './types'`로 다시 내보냅니다.
  - `format.ts`:
    - `formatBytes`
    - `formatDateTime`: 로컬 시간 `YYYY.MM.DD HH:mm`
    - `formatFileStamp`: `YYYYMMDD_HHmm`
    - `splitFileName`: `{ base, ext }`
  - `id.ts`: `createId()` = `Date.now().toString(36) + Math.random().toString(36).slice(2, 8)`
- DoD:
  - `formatBytes(509952) === '498KB'`, `formatBytes(626688) === '612KB'`, `formatBytes(7340032) === '7.0MB'`, `formatBytes(4194304) === '4.0MB'`
  - Asia/Seoul 기준 `formatDateTime('2026-09-24T05:30:00.000Z') === '2026.09.24 14:30'`
  - 2026-09-24 14:30(로컬)이면 `formatFileStamp(...) === '20260924_1430'`
  - `createId()`를 1,000회 호출해도 중복 0건입니다. 소스 전체에서 `randomUUID` 문자열 0건입니다.
  - `TOOL_META.map(t => t.title)`이 SPEC의 제목 5개와 같은 순서입니다.
- Covers: [F8-AC-1(부분: 도구 순서·제목), F8-AC-2(부분: 날짜·크기 표기), F4-AC-1(부분: 파일명 타임스탬프 형식)]
- Files: `src/lib/toolMeta.ts`, `src/lib/routes.ts`, `src/lib/format.ts`, `src/lib/id.ts`, `src/lib/format.test.ts`
- Depends on: Task 1.1

### Task 1.4 파일 검증 `validateFiles`
- Description: `validateFiles(files, tool)`을 구현합니다.
  - 판정 순서: 형식 → 파일당 용량 → 개수 → 합계 용량
  - 형식은 확장자(대소문자 무시)나 MIME으로 판정합니다. type이 `''`인 HEIC도 확장자로 통과합니다.
  - 개수와 합계는 앞에서부터 채우고, 넘치는 파일부터 거부합니다.
  - 화면은 "기존 선택 + 새로 고른 파일"을 합쳐서 호출합니다. 기존 파일이 앞에 있으므로 그대로 유지됩니다.
  - 오류 문구 상수는 `validateFiles.ts` 안에 둡니다. `toolMeta.ts`는 수정하지 않습니다.
- DoD:
  - F1 AC-3 입력의 `accepted`·`errors` 값과 문구가 SPEC과 같습니다.
  - F1 AC-4:
    - 21개 → 20개 accepted, `TOO_MANY_FILES` 1건
    - 25MB × 5개 → 4개 accepted, `TOTAL_TOO_LARGE`
  - `'pdf-merge'`에서 28MB PDF 3개에 28MB 1개를 더하면, 4번째만 `TOTAL_TOO_LARGE`이고 `accepted.length === 3`입니다.
  - `scan.pdf`를 `'heic'`로 검증하면 message가 `'HEIC 파일만 선택할 수 있어요'`입니다.
  - ⚠ compress·PDF 도구의 `UNSUPPORTED_TYPE` 문구는 SPEC에 없습니다. 임시 문구를 넣고 작업 결과 보고에 "확정 필요"로 적습니다.
- Covers: [F1-AC-3, F1-AC-4, F2-AC-5(부분), F4-AC-5(부분)]
- Files: `src/lib/validateFiles.ts`, `src/lib/validateFiles.test.ts`
- Depends on: Task 1.3

### Task 1.5 설정 저장소 `prefs`
- Description: key `fileconvertkr:prefs:v1`에 대해 `prefs.load()`와 `prefs.save(partial: Partial<ConvertPrefsValues>)`를 구현합니다.
  - `load()`는 파싱 실패나 범위 밖 필드만 기본값으로 바꿉니다.
    - 범위: `compressTargetKB`는 50~10240 정수, `pdfImageScale`은 1.5 또는 2
    - `id`가 `'prefs'`가 아니면 `'prefs'`로 바꿉니다.
    - `createdAt`·`updatedAt`이 `new Date(x).toISOString() === x`를 만족하지 않으면 `null`로 바꿉니다.
  - `save()`는 값이 바뀐 경우에만 `setItem`을 호출합니다.
    - 이때 `updatedAt`을 갱신합니다.
    - `createdAt`은 null일 때만 같은 시각으로 채웁니다.
- DoD:
  - F1 AC-11의 4단계(가짜 타이머)를 통과합니다. 같은 값으로 다시 저장할 때 `setItem` 호출은 0회입니다.
  - 저장된 `createdAt`이 `'not-a-date'`면 `load().createdAt === null`이고, 나머지 필드는 유지됩니다.
  - `prefs.save({ id: 'x' })`는 `@ts-expect-error`로 표시했고, 실제로 컴파일 오류가 납니다.
  - `JSON.parse`가 실패해도 예외가 없고 `console.error`는 0회입니다.
- Covers: [F1-AC-11]
- Files: `src/lib/storage/prefs.ts`, `src/lib/storage/prefs.test.ts`
- Depends on: Task 1.3

### Task 1.6 이력 저장소 `historyRepo`
- Description: key `fileconvertkr:history:v1`에 대해 다음을 구현합니다.
  - `append(entry: Omit<HistoryEntry, 'id' | 'createdAt'>)`
    - `id`·`createdAt`을 붙입니다.
    - 이름 목록을 정규화합니다: 최대 5개, 코드 포인트 기준 40자를 넘으면 앞 39자 + '…'.
    - 배열 맨 앞(index 0)에 넣습니다.
    - 100개를 넘으면 오래된 항목부터 버립니다.
    - `QuotaExceededError`가 나면 오래된 20개를 지우고 1회 재시도합니다.
  - `load()`: 배열이 아니거나 손상된 값이면 `[]`를 반환합니다.
  - `clear()`: `removeItem`을 호출합니다.
- DoD:
  - F1 AC-1을 통과합니다(`'updatedAt' in [0] === false` 포함).
  - F1 AC-2를 통과합니다(`'old-99'` 제거).
  - F1 AC-5를 통과합니다(`'{broken'` → `[]`, `console.error` 0회).
  - F1 AC-9를 통과합니다(😀 서로게이트 쌍 보존).
  - F1 AC-6의 저장소 부분:
    - 첫 `setItem`이 throw하면 재시도 배열이 20개 짧고, `{ ok: true }`를 반환합니다.
    - 재시도도 throw하면 `{ ok: false }`를 반환하고 예외는 없습니다.
  - `clear()` 뒤 `localStorage.getItem(key) === null`입니다.
- Covers: [F1-AC-1, F1-AC-2, F1-AC-5, F1-AC-6(부분: 저장소), F1-AC-9]
- Files: `src/lib/storage/historyRepo.ts`, `src/lib/storage/historyRepo.test.ts`
- Depends on: Task 1.3

### Task 1.7 메모리 jobStore (상태 관리 ①)
- Description: 모듈 스코프 `Map<string, ConversionJob>`로 `saveJob`과 `getJob`을 구현합니다.
  - 최대 3개까지 보관합니다.
  - 4번째가 들어오면 가장 오래된 job의 `outputs[].objectUrl`을 모두 `URL.revokeObjectURL`로 해제하고 지웁니다.
  - 수정 함수는 만들지 않습니다.
  - 테스트 전용 `_resetJobStore()`를 둡니다.
- DoD:
  - F1 AC-8을 통과합니다.
    - A가 제거되고, D는 조회됩니다.
    - A의 URL마다 revoke가 1회씩 호출됩니다.
    - `getJob('unknown-id') === undefined`
  - 내보내는 함수는 `saveJob`, `getJob`, `_resetJobStore` 3개뿐입니다.
- Covers: [F1-AC-8]
- Files: `src/lib/jobStore.ts`, `src/lib/jobStore.test.ts`
- Depends on: Task 1.1

### Task 1.8 변환 실행기 `runJob`
- Description: 입력 파일을 순차로 처리합니다.
  - 파일마다 `Promise.race`로 타임아웃을 겁니다(기본 60,000ms).
  - `AbortSignal`로 중단할 수 있습니다.
  - 파일 하나가 끝날 때마다(성공이든 실패든) `onProgress(done, total)`를 호출합니다.
  - 실패하면 `{ id: createId(), inputIndex, fileName, message }`를 만듭니다.
    - 타임아웃: `'변환 시간이 너무 오래 걸려서 중단했어요'`
    - 그 밖: `'파일을 읽을 수 없어요. 다른 파일을 선택해주세요'`
- DoD:
  - F1 AC-7을 통과합니다: outputs 2개, failures 값, onProgress `(1,3)(2,3)(3,3)`, 가짜 타이머 60,000ms에서 타임아웃 문구.
  - F1 AC-10을 통과합니다: 같은 이름 2개가 실패하면 `inputIndex`가 `[0, 2]`이고 `id`가 서로 다릅니다.
- Covers: [F1-AC-7, F1-AC-10]
- Files: `src/lib/runJob.ts`, `src/lib/runJob.test.ts`
- Depends on: Task 1.3

### Task 1.9 완료 처리 `buildJob`·`toHistoryEntry`·`finishJob`
- Description:
  - `buildJob({ tool, options, inputs, outputs, failures, durationMs })`: `jobId`, `createdAt`, `status`를 채웁니다. failures가 1개 이상이면 `'partial'`입니다.
  - `toHistoryEntry(job)`: 개수와 바이트 합계를 계산합니다. 이름 목록은 자르지 않고 전체를 넘깁니다(정규화는 historyRepo 담당).
  - `finishJob(job, navigate)`: `saveJob` → `append` 순서로 호출한 뒤 `navigate`를 정확히 1회 호출합니다.
- DoD:
  - append가 `{ ok: true }`면 navigate state는 `{ jobId }`이고, `'historySaveFailed' in state === false`입니다.
  - append가 `{ ok: false }`면 state는 `{ jobId, historySaveFailed: true }`입니다.
  - 두 경우 모두 navigate는 1회이고, `jobStore.getJob(jobId)`가 job을 반환합니다.
  - HEIC 입력 2개로 만든 `toHistoryEntry` 결과에 `{ tool: 'heic', inputCount: 2, outputCount: 2, failedCount: 0 }`이 들어 있습니다.
- Covers: [F1-AC-6(부분: navigate state), F2-AC-1(부분: 이력 인자)]
- Files: `src/lib/finishJob.ts`, `src/lib/finishJob.test.ts`
- Depends on: Task 1.6, Task 1.7

### Task 1.10 파일 저장 어댑터 `deliverFile`
- Description:
  - Blob을 FileReader로 base64로 바꾸고 `data:` 접두사를 뗍니다.
  - `saveBase64Data({ data, fileName, mimeType })`를 호출합니다.
  - 실패하면 objectURL + `<a download>` click으로 대체합니다.
  - 대체 경로도 throw하면 reject합니다.
- DoD:
  - 성공 경로에서 `saveBase64Data`는 1회 호출되고, `data`는 `data:`로 시작하지 않습니다.
  - `saveBase64Data`가 reject하면 앵커 click이 1회 일어나고 resolve합니다.
  - 두 경로가 모두 실패하면 reject합니다.
  - `mimeType: 'image/webp'`, `fileName: 'sticker_compressed.webp'` 출력은 그 값 그대로 전달됩니다.
  - 소스에 `window.open(` 0건.
- Covers: [F7-AC-3(부분: 호출 인자), F7-AC-4(부분: reject), F3-AC-11(부분: webp 전달)]
- Files: `src/lib/deliverFile.ts`, `src/lib/deliverFile.test.ts`
- Depends on: Task 1.1

### Task 1.11 도구 화면 공통 상태 훅 `useConversionRunner` (상태 관리 ②)
- Description: 도구 화면들이 함께 쓰는 변환 상태 훅입니다. 반환값은 `{ running, progress: { done, total } | null, runPerFile, runSingle }`입니다.
  - `runPerFile(inputs, process, options)`: heic·compress용입니다.
    - `runJob`을 실행합니다.
    - outputs가 0개면 job을 만들지 않고 `{ kind: 'all-failed' }`를 반환합니다.
    - 결과가 있으면 `buildJob` → `finishJob`을 호출합니다.
  - `runSingle(task: (onProgress) => Promise<ConversionOutput[]>, inputs, options)`: merge·to-image·split용입니다.
    - 전부 성공하거나 전부 실패합니다.
    - 실패하면 `{ kind: 'all-failed' }`를 반환합니다.
  - 화면이 언마운트되면 abort합니다.
  - Toast는 훅이 아니라 각 화면이 띄웁니다.
- DoD:
  - `renderHook`에서 5개 중 2개가 끝나면 `progress`가 `{ done: 2, total: 5 }`이고 `running === true`입니다.
  - 모두 실패하면 `navigate`와 `historyRepo.append`는 0회이고, `running`은 `false`로 돌아옵니다.
  - 성공하면 `finishJob`이 1회 호출됩니다.
- Covers: [F2-AC-4(부분), F2-AC-6(부분)]
- Files: `src/hooks/useConversionRunner.ts`, `src/hooks/useConversionRunner.test.ts`
- Depends on: Task 1.8, Task 1.9

### Task 1.12 HEIC 변환기와 이미지 크기 측정
- Description:
  - `convertHeic(file, format)`
    - `await import('heic2any')` 후 `{ blob, toType, quality: 0.92, multiple: false }`로 호출합니다.
    - `ConversionOutput`을 만듭니다: fileName `{base}.jpg|png`, objectUrl, width/height.
  - `measureImage(blob)`: `createImageBitmap`으로 크기를 잽니다. 실패하면 `undefined`를 반환합니다.
- DoD:
  - `IMG_0001.heic` + `'jpg'`:
    - heic2any 인자에 `toType: 'image/jpeg', quality: 0.92`가 들어갑니다.
    - 출력은 `fileName: 'IMG_0001.jpg'`, `mimeType: 'image/jpeg'`입니다.
  - `'png'`: 출력은 `'IMG_0001.png'`, `'image/png'`입니다.
  - 소스에서 `heic2any`를 정적 `import`하는 코드가 0건입니다.
- Covers: [F2-AC-1(부분), F2-AC-2(부분)]
- Files: `src/lib/convert/heic.ts`, `src/lib/convert/imageSize.ts`, `src/lib/convert/heic.test.ts`
- Depends on: Task 1.2, Task 1.3

### Task 1.13 캔버스 JPEG 목표 용량 탐색 `encodeToTarget`
- Description: F3 알고리즘 3~5단계를 구현합니다.
  - 캔버스를 `rgb(255,255,255)`로 먼저 채우고 이미지를 그립니다.
  - quality 0.1~0.92 구간을 해상도 단계마다 최대 8회 이분 탐색합니다(0.1도 포함).
  - 0.1에서도 목표를 넘으면 가로·세로 ×0.8로 줄이고 다시 탐색합니다(최대 5회).
  - 목표 이하 후보 중 가장 큰 것을 고릅니다.
  - 후보가 끝까지 없으면 가장 작은 결과를 고르고 `reached: false`로 표시합니다.
  - 반환값: `{ blob, width, height, reached }`
- DoD:
  - toBlob mock(quality에 비례한 크기)으로 F3 AC-2를 통과합니다.
    - 해상도 단계당 호출 8회 이하
    - 축소 5회 이하
    - 목표 이하 후보 중 최대 채택
  - mock상 최소 결과가 626,688B면 `reached === false`, `blob.size === 626688`입니다.
  - 배경 fillStyle은 `'rgb(255,255,255)'`입니다.
- Covers: [F3-AC-2, F3-AC-4(부분: 알고리즘)]
- Files: `src/lib/convert/canvasEncode.ts`, `src/lib/convert/canvasEncode.test.ts`
- Depends on: Task 1.3

### Task 1.14 압축 진입점 `compressToTarget`
- Description: F3 알고리즘 1~2단계를 구현하고, 필요하면 1.13을 호출합니다.
  - HEIC 판정(확장자 또는 MIME)이 참이면 `heic2any { toType: 'image/jpeg' }`로 1회 디코드합니다. 디코드 결과가 작업 Blob입니다.
  - 작업 Blob size가 목표 이하면 재인코딩하지 않습니다.
    - HEIC 입력: 디코드된 Blob을 `image/jpeg`, `.jpg`로 반환합니다.
    - 그 밖: 원본 Blob을 반환합니다.
      - mimeType은 `file.type`을 쓰고, 비어 있으면 확장자로 정합니다.
      - fileName은 원본 확장자를 유지합니다.
  - 목표를 넘으면 `encodeToTarget`을 호출합니다.
    - 결과: `image/jpeg`, `{base}_compressed.jpg`
    - `reached === false`면 `note: 'TARGET_NOT_REACHED'`를 붙입니다.
  - `sourceSizeBytes`는 항상 입력 File의 size입니다.
- DoD:
  - F3 AC-3: `small.jpg` 307,200B → 같은 바이트, `ALREADY_UNDER_TARGET`, `'small_compressed.jpg'`
  - F3 AC-10:
    - 716,800B로 디코드되면 toBlob 0회, `blob`은 heic2any 반환 객체 그대로, `sourceSizeBytes: 409600`
    - 1,258,291B로 디코드되면 toBlob 1회 이상, note는 `ALREADY_UNDER_TARGET`이 아님
  - F3 AC-11 단위 부분:
    - webp는 type이 `'image/webp'`여도 `''`여도 `image/webp`, `.webp`로 나옵니다.
    - 307,200B 파일을 목표 200KB로 압축하면 `image/jpeg`, `'sticker_compressed.jpg'`입니다.
  - `IMG_1.heic`를 목표 1MB로 압축하면 fileName은 `'IMG_1_compressed.jpg'`입니다.
- Covers: [F3-AC-3(부분: 로직), F3-AC-10, F3-AC-11(부분: 단위), F3-AC-8(부분: 로직)]
- Files: `src/lib/convert/compress.ts`, `src/lib/convert/compress.test.ts`
- Depends on: Task 1.12, Task 1.13

### Task 1.15 페이지 범위 파서와 번호 표기
- Description:
  - `parsePageRanges(input, total)`: 정렬하고, 중복을 없애고, 공백은 무시합니다. 반환값은 `{ ok: true, pages }` 또는 `{ ok: false, message }`입니다.
    - 문법 오류: `'페이지 범위를 확인해주세요 (예: 1-3, 5)'`
    - 범위 초과: `` `문서는 총 ${total}페이지예요` ``
  - `parseSplitGroups(input, total)`: 같은 문법을 쓰지만, 그룹을 입력 순서대로 유지하고 평탄화하지 않습니다.
  - `buildEachGroups(total)`: 페이지마다 그룹을 하나씩 만듭니다.
  - `formatPageNumber(n, total)`: `String(n).padStart(String(total).length, '0')`
- DoD:
  - F5 AC-3: `'1-3,5, 7-7'` → `[1,2,3,5,7]`, `'3,1-2,2'` → `[1,2,3]`
  - 6페이지 문서:
    - `3-1`, `0`, `a`, `1--2`, `''` → 문법 오류 문구
    - `8` → `'문서는 총 6페이지예요'`
  - 4페이지 문서의 `parseSplitGroups`:
    - `'2-1'` → 문법 오류
    - `'1-6'` → `'문서는 총 4페이지예요'`
    - `'1-2, 3'` → `[{1,2},{3,3}]`
  - `formatPageNumber(3, 12) === '03'`, `formatPageNumber(1, 4) === '1'`
- Covers: [F5-AC-3, F5-AC-4(부분), F5-AC-2(부분), F6-AC-2(부분), F6-AC-3(부분), F6-AC-9(부분)]
- Files: `src/lib/pdf/pageRanges.ts`, `src/lib/pdf/pageRanges.test.ts`
- Depends on: Task 1.3

### Task 1.16 PDF 페이지 수 읽기와 합치기 (pdf-lib)
- Description: `pdf-lib`은 dynamic import로 불러옵니다.
  - `readPdfPageCount(file)`: `{ ok: true, pageCount }` 또는 `{ ok: false, reason: 'ENCRYPTED' | 'UNREADABLE' }`를 반환합니다.
  - `mergePdfs(files, now, onProgress?)`: `copyPages`로 입력 순서대로 합칩니다.
    - fileName: `합친문서_${formatFileStamp(now)}.pdf`
    - `pageCount`: 전체 합계
    - `sourceName`: 첫 파일명
    - `sourceSizeBytes`: 입력 크기 합계
- DoD:
  - 페이지 크기가 서로 다른 a(3p)와 b(2p)를 만들어 합칩니다.
    - [a, b]: 5페이지이고 순서는 a1..a3, b1, b2입니다(페이지 크기로 확인).
    - [b, a]: 순서는 b1, b2, a1..a3입니다.
  - 2026-09-24 14:30에 합치면 fileName은 `'합친문서_20260924_1430.pdf'`입니다.
  - 암호화된 PDF(또는 EncryptedPDFError를 던지는 mock)는 `reason: 'ENCRYPTED'`입니다.
- Covers: [F4-AC-1(부분), F4-AC-2(부분), F4-AC-4(부분)]
- Files: `src/lib/pdf/merge.ts`, `src/lib/pdf/merge.test.ts`
- Depends on: Task 1.2, Task 1.3

### Task 1.17 PDF 렌더러 (pdfjs legacy)
- Description:
  - `loadPdf(file)`
    - `import('pdfjs-dist/legacy/build/pdf.mjs')`로 불러옵니다.
    - `GlobalWorkerOptions.workerSrc`에는 `?url`로 번들된 로컬 워커를 씁니다.
    - 반환값: `{ ok: true, doc, numPages }` 또는 `{ ok: false, reason: 'PASSWORD' | 'UNREADABLE' }`
  - `renderPageToOutput(doc, pageNo, { scale, format, baseName, totalPages })`
    - `getViewport({ scale })` 크기로 렌더합니다.
    - JPG는 흰 배경을 먼저 채웁니다.
    - fileName: `{base}_p{formatPageNumber}.{jpg|png}`
  - `vite.config.ts`는 수정하지 않습니다(1.2에서 끝남).
- DoD:
  - mock에서 `getViewport`가 `{ scale: 1.5 }`로 호출됩니다.
  - `계약서.pdf`(3p) 렌더 결과는 `계약서_p1.jpg`~`계약서_p3.jpg`이고, mimeType은 `image/jpeg`입니다.
  - `PasswordException`이면 `reason: 'PASSWORD'`, 그 밖의 reject는 `'UNREADABLE'`입니다.
  - 소스의 `pdfjs-dist` import 경로는 legacy뿐입니다. `workerSrc`에 `http`로 시작하는 URL은 0건입니다.
- Covers: [F5-AC-8(부분: import 경로·workerSrc), F5-AC-1(부분), F5-AC-6(부분)]
- Files: `src/lib/pdf/render.ts`, `src/lib/pdf/render.test.ts`
- Depends on: Task 1.2, Task 1.15

### Task 1.18 PDF 분할 로직 `splitPdf`
- Description: `splitPdf(file, groups, totalPages, onProgress)`를 구현합니다.
  - pdf-lib로 그룹마다 PDF를 1개씩 만듭니다.
  - 파일명:
    - 한 페이지 그룹: `{base}_p{n}.pdf`
    - 여러 페이지 그룹: `{base}_{start}-{end}.pdf`
    - 번호는 모두 `formatPageNumber`로 만듭니다.
  - 파일 하나가 끝날 때마다 `onProgress(done, total)`를 호출합니다.
- DoD:
  - 4p 문서:
    - 페이지마다 → `보고서_p1..p4.pdf`, 각 `pageCount === 1`
    - `1-2, 3` → `['보고서_1-2.pdf', '보고서_p3.pdf']`, pageCount `[2, 1]`
  - 12p 문서:
    - 페이지마다 → `보고서_p01..p12.pdf`. 복사해서 `.sort()`해도 순서가 같습니다.
    - `1-3, 4-9, 10-12` → `['보고서_01-03.pdf', '보고서_04-09.pdf', '보고서_10-12.pdf']`, pageCount `[3, 6, 3]`
    - `5` → `['보고서_p05.pdf']`
- Covers: [F6-AC-1(부분), F6-AC-2(부분), F6-AC-9(부분: 로직)]
- Files: `src/lib/pdf/split.ts`, `src/lib/pdf/split.test.ts`
- Depends on: Task 1.15, Task 1.16

---

## Epic 2. API Routes — 해당 없음

이 앱은 서버 없이 모든 변환을 기기 안에서 처리합니다(SPEC 제품 원칙). 따라서 이 Epic에는 작업이 없습니다. 네트워크 호출이 0건인지는 Task 3.13과 Task 4.2에서 검증합니다.

**Risk**
- Complexity: Low
- Risk factors: 나중에 누군가 분석 SDK나 업로드 코드를 넣으면 "파일이 기기 밖으로 나가지 않음"(F2 AC-7) 원칙이 깨집니다.
- Mitigation: Task 4.2의 정적 검사와 네트워크 spy 테스트로 막습니다.

---

## Epic 3. UI Pages (공통 컴포넌트 → 결과 화면 → 홈·이력 → 도구 화면)

**Risk**
- Complexity: High
- Risk factors:
  - ① `/result`에는 무료 층, 리워드 게이트, 배너 2개, Toast가 모여 있습니다. 한 작업으로 만들면 10분을 넘기고, 여러 작업이 같은 파일을 고치게 됩니다.
  - ② `TossRewardAd`의 내부 동작은 아직 확인하지 않았습니다(OQ7).
  - ③ jsdom은 레이아웃을 계산하지 않습니다. 그래서 `getBoundingClientRect() ≥ 44`는 jsdom에서 항상 0이 나옵니다.
  - ④ React StrictMode에서는 effect가 두 번 실행되어, Toast·`logImpression`이 2회 호출될 수 있습니다.
  - ⑤ 도구 화면의 이력 저장 실패 테스트는 `/result`가 이미 있어야 합니다.
  - ⑥ `SummaryHero`·`MiniBar`·`Sparkline`·`SubmitFooter`·`ScreenScaffold`는 템플릿에 있다고 가정했습니다(Assumption 8).
- Mitigation:
  - ① **화면 파일은 조립 작업 하나만 수정합니다.**
    - 결과 화면: 무료 층(3.3), 만료·하단·알림(3.4), 잠금 섹션(3.5)을 각각 별도 컴포넌트 파일로 만듭니다. `src/pages/ResultPage.tsx`는 Task 3.6만 만듭니다.
    - 이력 화면: 같은 방식으로 3.10과 3.11이 컴포넌트를 만들고, `src/pages/HistoryPage.tsx`는 Task 3.12만 만듭니다.
  - ② AC-9(P0)는 앱이 만드는 요소만 검증합니다. 잠정 AC는 `[provisional:OQ7]` 이름을 붙여 별도 파일에 둡니다.
  - ③ 크기 단언은 `*.browser.test.tsx`로 분리합니다. 브라우저 러너를 쓸 수 없으면 "미검증"으로 보고하고, 통과로 처리하지 않습니다.
  - ④ 1회만 실행해야 하는 효과는 `useRef` 가드로 막습니다.
  - ⑤ 결과 화면 작업(3.3~3.8)을 도구 화면 작업(3.13~3.20)보다 먼저 둡니다.
  - ⑥ 템플릿에 없는 컴포넌트가 있으면 해당 작업을 멈추고 보고합니다. TDS 밖의 대체 UI는 만들지 않습니다.
- 공통 규칙:
  - 모든 화면은 `ScreenScaffold`로 감쌉니다.
  - 간격은 `Spacing size`로만 조절합니다.
  - 색상은 `var(--tds-color-*)`만 씁니다.
  - TDS 컴포넌트의 padding은 덮어쓰지 않습니다.

### Task 3.1 파일 선택 영역과 선택 목록 컴포넌트
- Description:
  - `FilePickSection`
    - 숨김 `<input type="file">`을 TDS `Button`(variant weak, display block)의 onClick에서 `inputRef.current.click()`으로 엽니다.
    - accept는 `TOOL_META`에서 가져옵니다.
    - 파일을 고르면 `validateFiles([...기존, ...새 파일])`를 호출하고, 첫 오류를 TDS Toast로 보여줍니다.
    - 처리가 끝나면 `input.value = ''`로 초기화합니다.
  - `SelectedFileList`
    - 파일마다 `ListRow` 1개(제목 파일명, 부제 formatBytes)를 둡니다.
    - 우측 "삭제" 버튼은 flex 래퍼로 터치 영역을 44×44px 이상 확보합니다.
    - key는 파일을 고를 때 부여한 `createId()`입니다.
    - `disabled` prop을 받으면 모든 삭제 버튼을 비활성화합니다.
- DoD:
  - `'heic'`에서 `scan.pdf`를 고르면 Toast "HEIC 파일만 선택할 수 있어요"가 뜨고, 목록은 0개입니다.
  - 같은 파일을 두 번 연속 골라도 change 이벤트가 두 번 모두 처리됩니다.
  - `IMG_0001.heic` 행을 삭제하면 `IMG_0002.heic` 1행만 남습니다.
  - 44×44px 단언은 `SelectedFileList.browser.test.tsx`에서 확인합니다. 실행 환경이 없으면 "미검증"으로 보고합니다.
- Covers: [F2-AC-8, F2-AC-5(부분)]
- Files: `src/components/FilePickSection.tsx`, `src/components/SelectedFileList.tsx`, `src/components/FilePickSection.test.tsx`, `src/components/SelectedFileList.browser.test.tsx`
- Depends on: Task 1.4

### Task 3.2 키보드 대응 입력 필드 `KeyboardAwareTextField`
- Description: TDS `TextField`를 감싼 입력 필드입니다.
  - focus되면 `scrollIntoView({ block: 'center' })`를 호출합니다.
  - Enter keydown이면 blur합니다.
  - `enterKeyHint="done"`이 기본값입니다. `inputMode`·`hasError`·`helperText`는 그대로 전달합니다.
  - `numericOnly` 옵션을 켜면 숫자가 아닌 문자를 걸러냅니다.
  - `visualViewport.height < window.innerHeight`면 `onKeyboardOpenChange(true)`를 호출합니다.
- DoD:
  - focus하면 `scrollIntoView`가 `{ block: 'center' }`로 1회 호출됩니다.
  - Enter를 누르면 `document.activeElement`가 입력 요소가 아닙니다.
  - `numericOnly`에서 `abc`를 입력해도 값에 반영되지 않습니다.
- Covers: [F3-AC-7(부분), F6-AC-7(부분)]
- Files: `src/components/KeyboardAwareTextField.tsx`, `src/components/KeyboardAwareTextField.test.tsx`
- Depends on: Task 1.1

### Task 3.3 결과 화면 컴포넌트: 무료 층
- Description: `job: ConversionJob`을 prop으로 받는 무료 층 컴포넌트입니다. 화면 파일은 만들지 않습니다.
  - `FreeTier`: `data-testid="free-tier"` 래퍼 안에 아래 세 컴포넌트를 둡니다.
  - `ResultSummary`: `result-summary` Card 안에 `SummaryHero`(도구별 표 기준)와 "7.0MB → 4.0MB"를 둡니다.
  - `OutputRow`: `output-row`
    - 좌측: 이미지 결과는 48×48 `img loading="lazy"`, PDF 결과는 ContentIcon
    - 부제: note가 있으면 해당 문구를 붙입니다.
    - "저장" 버튼
      - 탭하면 `logClick('result_save_file')` 후 deliverFile을 호출합니다.
      - 저장 중에는 `loading`, 성공하면 라벨이 "저장됨"으로 바뀝니다.
      - Toast: 이미지 "사진을 저장했어요", PDF "파일을 저장했어요", 실패 "저장에 실패했어요. 다시 시도해주세요"
      - 이 화면 세션의 첫 성공이면 `requestReviewOnce()`를 호출합니다. 가드는 `FreeTier` 안 ref입니다.
  - `FailedList`: `failed-list` 안에 `failed-row`를 둡니다.
    - key는 `failure.id`입니다.
    - 같은 fileName이 2개 이상이면 제목을 "`{name} ({inputIndex+1}번째 파일)`"로 표시합니다.
- DoD:
  - `<FreeTier job={heic 3개 job} />` 렌더 결과:
    - SummaryHero 값 `3`, 단위 "개", 라벨 "변환 완료"
    - `output-row` 3개가 각각 "저장" 버튼을 가집니다(F7 AC-1).
  - F7 AC-3을 통과합니다(`saveBase64Data` 인자, Toast, "저장됨", `requestReviewOnce` 1회).
  - F7 AC-4 단건 부분: 실패 Toast가 뜨고, 라벨은 "저장" 유지, `requestReviewOnce` 0회입니다.
  - F7 AC-11을 통과합니다(중복 이름 표기, `console.error` 0회).
  - note `TARGET_NOT_REACHED`, sizeBytes 626,688이면 부제에 "목표 용량까지 줄이지 못했어요 (최소 612KB)"가 표시됩니다.
- Covers: [F7-AC-1(부분: 무료 층 렌더), F7-AC-3, F7-AC-4(부분: 단건), F7-AC-11, F3-AC-4(부분: 결과 문구)]
- Files: `src/components/result/FreeTier.tsx`, `src/components/result/ResultSummary.tsx`, `src/components/result/OutputRow.tsx`, `src/components/result/FailedList.tsx`, `src/components/result/FreeTier.test.tsx`
- Depends on: Task 1.7, Task 1.10

### Task 3.4 결과 화면 컴포넌트: 만료 화면·하단 버튼·결과 알림 훅
- Description: 화면 파일은 만들지 않습니다.
  - `ExpiredView`: `Asset.ContentIcon`, "변환 결과가 만료됐어요", "처음으로" Button만 둡니다. "처음으로"는 `navigate('/', { replace: true })`를 호출합니다.
  - `ResultFooter({ tool })`: `SubmitFooter`로 만듭니다.
    - 1차 버튼 "다른 파일 변환하기": `logClick('result_convert_again')` → `navigate(TOOL_ROUTES[tool])`
    - 보조 버튼 "공유하기": `logClick('result_share')` → `shareApp()`
  - `useResultNotices(job: ConversionJob | undefined, state: ResultRouteState | null)`
    - job이 있으면 `logImpression('result_free_tier')`를 1회 호출합니다.
    - job이 있고 `state?.historySaveFailed === true`면:
      - Toast "이력을 저장하지 못했어요. 변환 파일은 그대로 저장할 수 있어요"를 1회 띄웁니다.
      - `navigate(location.pathname, { replace: true, state: { jobId } })`를 호출합니다.
    - 모든 효과는 ref 가드로 1회만 실행합니다.
    - 화면이 조건 없이 먼저 호출할 수 있도록 job이 undefined여도 동작해야 합니다(hooks 규칙).
- DoD:
  - `ExpiredView`에서 "처음으로"를 탭하면 `navigate('/', { replace: true })`가 호출됩니다.
  - `ResultFooter tool="pdf-merge"`:
    - "공유하기"를 탭하면 `logClick('result_share')` → `shareApp()` 순서로 각 1회 호출됩니다.
    - "다른 파일 변환하기"를 탭하면 `navigate('/pdf/merge')`가 호출됩니다.
  - `useResultNotices`를 StrictMode + MemoryRouter에서 렌더합니다.
    - 플래그가 있으면 Toast 1회, replace navigate 1회, `logImpression('result_free_tier')` 1회입니다.
    - 플래그가 없으면 Toast 0회입니다.
    - job이 undefined면 Toast·navigate·logImpression 모두 0회입니다.
- Covers: [F7-AC-5(부분: 만료 화면), F7-AC-7(부분), F7-AC-12(부분: 훅), F1-AC-6(부분: 결과 화면 Toast)]
- Files: `src/components/result/ExpiredView.tsx`, `src/components/result/ResultFooter.tsx`, `src/hooks/useResultNotices.ts`, `src/hooks/useResultNotices.test.tsx`, `src/components/result/ResultFooter.test.tsx`
- Depends on: Task 1.3, Task 1.7

### Task 3.5 결과 화면 컴포넌트: 잠금 섹션 (안내·게이트·잠금 층)
- Description: `LockedSection({ job })` 하나가 아래 요소를 순서대로 렌더합니다. 화면 파일은 수정하지 않습니다.
  - `LockedTeaser`(`locked-teaser`)
    - `unlocked === false`일 때만 렌더합니다.
    - 제목과 본문은 outputs 개수(1개 / 2개 이상)에 따라 SPEC 문구를 씁니다.
  - `<div data-testid="locked-gate">`(style 없음) 안에 `<TossRewardAd slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID}>`를 둡니다.
    - 템플릿 `TossRewardAd` 소스를 읽고, 버튼 문구 prop이 있으면 "광고 보고 상세 리포트 열기"를 넘깁니다.
    - 템플릿 파일은 수정하지 않습니다(git diff 0줄).
  - 그 자식은 `LockedTier`(`locked-tier`)입니다.
    - 파일별 상세 행: 원본 → 결과 크기, 변화율, `MiniBar`(`data-testid="mini-bar"` 래퍼), 해상도 또는 페이지 수
    - "총 소요 시간 N.N초 · 원본 → 결과"
    - outputs가 2개 이상이면 "모두 저장 (N개)" 버튼을 둡니다.
      - 탭하면 `logClick('result_save_all')` 후 deliverFile을 순차 호출합니다. 호출 간격은 300ms 이상입니다.
      - 결과 Toast: "N개 파일을 저장했어요" 또는 "X개 저장, Y개 실패"
    - 마운트되면 `onUnlocked()`를 호출합니다. 그러면 `unlocked = true`가 되고, `logImpression('result_locked_tier')`가 ref 가드로 1회 호출됩니다.
- DoD:
  - slot ID가 없어 게이트가 자동으로 열리는 환경에서 F7 AC-2를 통과합니다.
    - 상세 행 3개
    - "모두 저장"이 deliverFile을 3회 호출하고 간격은 300ms 이상
    - Toast 표시
    - teaser 없음
  - F7 AC-4의 모두 저장 부분 실패("2개 저장, 1개 실패")를 통과합니다.
  - `vi.stubEnv('VITE_TOSS_AD_SLOT_ID', 'test-slot')` + 로드 성공 mock + 대기형 `showFullScreenAd` mock에서 `<LockedSection>`만 렌더합니다.
    - `locked-tier` 0개
    - gate 안의 `mini-bar`·"총 소요 시간"·"모두 저장" 모두 0개
    - teaser 문구가 SPEC과 같습니다.
    - teaser는 gate의 자손이 아니고, DOM 순서는 teaser → gate입니다.
    - `logImpression('result_locked_tier')` 0회
  - `TossRewardAd` 파일 diff 0줄.
- Covers: [F7-AC-2, F7-AC-4(부분: 모두 저장), F7-AC-9(부분: 잠금 섹션 내부)]
- Files: `src/components/result/LockedSection.tsx`, `src/components/result/LockedTeaser.tsx`, `src/components/result/LockedTier.tsx`, `src/components/result/LockedSection.test.tsx`
- Depends on: Task 1.10

### Task 3.6 결과 화면 조립 `/result` (ResultPage.tsx의 유일한 소유 작업)
- Description: `src/pages/ResultPage.tsx`를 만듭니다. 이 파일을 수정하는 작업은 이것뿐입니다.
  - **state를 받을 때는 캐스팅보다 null 확인을 먼저 합니다.** 훅은 early return보다 먼저 호출합니다.
    ```ts
    const state = (useLocation().state as RouteState['/result'] | null) ?? null;
    const job = state && typeof state.jobId === 'string' ? getJob(state.jobId) : undefined;
    useResultNotices(job, state);
    if (!job) return <ScreenScaffold><ExpiredView /></ScreenScaffold>;
    ```
  - 유효한 job이면 `ScreenScaffold` 안에 다음 순서로 렌더합니다.
    - `Top` "변환 완료". partial job이면 부제 "일부 파일은 변환하지 못했어요"
    - `FreeTier`
    - `<div data-testid="ad-slot-mid"><AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID} /></div>`
    - `LockedSection`
    - `<div data-testid="ad-slot-bottom"><AdSlot … /></div>`
    - `ResultFooter`
  - 이 작업에서는 라우터에 등록하지 않습니다(Task 4.1 담당).
- DoD:
  - F7 AC-1: 자동 열림 환경에서 heic job으로 진입하면 `free-tier` 안 SummaryHero가 `3`/"개"/"변환 완료"이고, `output-row` 3개의 저장 버튼이 enabled입니다.
  - F7 AC-5: **state가 null이거나 `{ jobId: 'expired-1' }`로 직접 들어와도 크래시 없이 만료 화면만 렌더합니다.**
    - free-tier, locked-teaser, locked-gate, locked-tier, ad-slot-mid, ad-slot-bottom은 모두 0개입니다.
  - F7 AC-6:
    - SummaryHero `84`/"%"
    - 실패 카드 제목 "변환하지 못한 파일 1개"
    - DOM 순서 free-tier → ad-slot-mid → locked-tier → ad-slot-bottom
    - 배너 2개는 free-tier 밖에 있습니다.
  - F7 AC-7(화면 통합): 공유와 재변환 버튼이 동작합니다.
  - F7 AC-12:
    - 플래그가 있으면 Toast 1회, `navigate('/result', { replace: true, state: { jobId } })` 1회
    - 플래그가 없으면 Toast 0회
    - 만료 job + 플래그면 만료 화면만 보이고 Toast 0회
  - StrictMode에서 렌더해도 Toast와 `logImpression('result_free_tier')`는 각각 1회입니다.
- Covers: [F7-AC-1, F7-AC-5, F7-AC-6, F7-AC-7, F7-AC-12, F1-AC-6(부분: 결과 화면 Toast)]
- Files: `src/pages/ResultPage.tsx`, `src/pages/ResultPage.test.tsx`
- Depends on: Task 3.3, Task 3.4, Task 3.5

### Task 3.7 결과 화면 잠금 상태 P0 통합 테스트 (F7 AC-9)
- Description: 실제 `ResultPage`로 F7 AC-9를 검증하는 테스트만 작성합니다. 제품 코드는 수정하지 않습니다.
  - 테스트 환경:
    - `vi.stubEnv('VITE_TOSS_AD_SLOT_ID', 'test-slot')`
    - `loadFullScreenAd`는 로드 성공 mock
    - `showFullScreenAd`는 대기형 mock
    - 보상 완료는 알리지 않습니다.
- DoD: F7 AC-9의 모든 단언을 통과합니다.
  - `locked-tier` 0개
  - gate 안 MiniBar 0개, "총 소요 시간" 0건, "모두 저장 (3개)" 0건
  - teaser의 제목과 본문이 SPEC과 같고, teaser는 gate의 자손이 아닙니다.
  - DOM 순서 free-tier → ad-slot-mid → locked-teaser → locked-gate → ad-slot-bottom
  - `logImpression('result_locked_tier')` 0회
  - free-tier의 `IMG_0001.jpg` "저장"을 탭하면 `saveBase64Data`가 1회 호출되고, 탭 전후 `showFullScreenAd` 누적 호출 수가 같습니다.
  - gate 안 button의 개수·크기·동작은 검증하지 않습니다(AC-13 담당).
  - 템플릿 `TossRewardAd`가 위 mock 방식으로 동작하지 않아 테스트를 구성할 수 없으면, 원인을 Task 3.8 문서에 적고 보고합니다.
- Covers: [F7-AC-9]
- Files: `src/pages/ResultPage.locked.test.tsx`
- Depends on: Task 3.6

### Task 3.8 잠정 게이트 테스트와 OQ7 확인 기록
- Description:
  - 템플릿 `TossRewardAd` 소스를 읽고 OQ7 (a)~(d)의 확인 결과를 문서로 남깁니다.
  - F7 AC-10과 AC-13 테스트를 만듭니다. 테스트 이름에 `[provisional:OQ7]`을 붙입니다.
  - 제품 코드는 수정하지 않습니다. CTA prop 전달은 Task 3.5에서 끝났습니다.
- DoD:
  - `docs/oq7-tossrewardad.md`에 (a)~(d) 각각을 "가정과 일치 / 불일치 / 확인 불가" 중 하나로 기록하고, 근거가 된 코드 위치를 적습니다.
  - AC-13과 AC-10 테스트가 있습니다.
    - 44px 단언은 browser 테스트 파일에 둡니다.
    - 테스트가 실패해도 릴리스를 막지 않습니다. 실패 원인은 OQ7 기록과 연결해 보고합니다.
  - `TossRewardAd` 파일 diff 0줄.
- Covers: [F7-AC-10, F7-AC-13]
- Files: `src/pages/ResultPage.provisional.browser.test.tsx`, `docs/oq7-tossrewardad.md`
- Depends on: Task 3.6

### Task 3.9 홈 화면 `/`
- Description:
  - 구성: `Top` "파일 변환", 안내 `Paragraph.Text`, `TOOL_META` 순서의 `ListRow` 5개(좌측 `Asset.ContentIcon`, 우측 화살표)
  - 행을 탭하면 `logClick('tool_select_' + tool.replace(/-/g, '_'))` 후 `navigate(TOOL_ROUTES[tool])`를 호출합니다. state는 넘기지 않습니다.
  - route state를 받지 않습니다.
  - FloatingTabBar는 Task 4.1에서 연결합니다.
- DoD:
  - F8 AC-1을 통과합니다(5행 순서, heic 탭 시 logClick과 navigate).
  - 렌더된 텍스트에 "설치", "다운로드", "App Store", "Play 스토어"가 0건입니다.
  - href가 `http(s)://`로 시작하는 `<a>` 요소가 0개입니다.
- Covers: [F8-AC-1, F8-AC-7(부분: 홈)]
- Files: `src/pages/HomePage.tsx`, `src/pages/HomePage.test.tsx`
- Depends on: Task 1.3

### Task 3.10 이력 화면 컴포넌트: 요약·목록 행·빈 상태
- Description: 화면 파일은 만들지 않습니다.
  - `HistorySummary({ entries, now })`: `history-summary` Card입니다.
    - `SummaryHero`: Σ outputCount, 단위 "개"
    - 최근 7일 중 기록이 있는 날이 2일 이상이면 길이 7의 `Sparkline`을 표시합니다. 기록 없는 날은 0입니다.
  - `HistoryList({ entries, onSelect })`: 이력마다 `history-row` ListRow(텍스트 전용)를 둡니다.
    - 제목: "`{도구 제목}` · 파일 N개"
    - 부제: "날짜 · 입력 크기 → 출력 크기". partial이면 끝에 " · 실패 N개"
    - 마지막 행 뒤에 하단 `Spacing`을 둡니다.
  - `HistoryEmpty`: ContentIcon, "아직 변환한 파일이 없어요", "파일 변환하러 가기" 버튼(`navigate('/')`)
- DoD:
  - Asia/Seoul에서 F8 AC-2의 첫 행은 제목 "HEIC → JPG/PNG · 파일 3개", 부제 "2026.09.24 14:30 · 7.0MB → 4.0MB"입니다. partial 행 부제는 " · 실패 1개"로 끝납니다.
  - F8 AC-8: 합계 `8`, 길이 7 Sparkline. 기록이 1일뿐이면 Sparkline이 렌더되지 않습니다.
  - `HistoryEmpty`의 버튼을 탭하면 `navigate('/')`가 호출됩니다.
  - 100개 입력이면 `history-row` 100개, `<img>` 0개입니다.
- Covers: [F8-AC-2(부분: 행 문자열), F8-AC-3(부분: 빈 상태 컴포넌트), F8-AC-8]
- Files: `src/components/history/HistorySummary.tsx`, `src/components/history/HistoryList.tsx`, `src/components/history/HistoryEmpty.tsx`, `src/components/history/HistoryComponents.test.tsx`
- Depends on: Task 1.3

### Task 3.11 이력 화면 컴포넌트: 상세 BottomSheet
- Description: `HistoryDetailSheet({ entry, open, onClose })`를 만듭니다. 화면 파일은 수정하지 않습니다.
  - 원본·결과 파일명 목록을 순서대로 보여줍니다. `count > names.length`면 목록 끝에 "외 N개"를 붙입니다.
  - 안내 문구 "앱은 변환한 파일을 보관하지 않아요. 저장한 파일은 사진 앱 또는 파일 앱에서 확인해주세요"를 표시합니다.
  - "같은 도구로 다시 변환"을 탭하면 `logClick('history_rerun')` 후 `navigate(TOOL_ROUTES[entry.tool])`를 호출합니다.
- DoD:
  - F8 AC-4를 통과합니다(목록, 안내 문구, pdf-merge 항목이면 `navigate('/pdf/merge')`).
  - F8 AC-9를 통과합니다(원본 목록 끝 "외 2개", 결과 목록에는 "외" 텍스트 0건).
- Covers: [F8-AC-4(부분: 시트), F8-AC-9]
- Files: `src/components/history/HistoryDetailSheet.tsx`, `src/components/history/HistoryDetailSheet.test.tsx`
- Depends on: Task 1.3

### Task 3.12 이력 화면 조립 `/history` (HistoryPage.tsx의 유일한 소유 작업)
- Description: `src/pages/HistoryPage.tsx`를 만듭니다. 이 파일을 수정하는 작업은 이것뿐입니다.
  - 마운트 시 `historyRepo.load()`를 1회만 호출합니다(`useState` 초기화 함수). 합계는 `useMemo`로 계산합니다.
  - 이력이 있으면: `Top` 우측 "전체 삭제"(hit area 44px 이상), `HistorySummary`, `HistoryList`
  - 이력이 없으면: `HistoryEmpty`만 표시합니다. "전체 삭제"와 요약은 렌더하지 않습니다.
  - 행을 탭하면 `HistoryDetailSheet`가 열립니다.
  - "전체 삭제"를 탭하면 `AlertDialog` "변환 이력을 모두 삭제할까요?"가 "삭제"/"취소" 버튼과 함께 열립니다.
    - "삭제": `historyRepo.clear()` 후 목록 state를 `[]`로 바꿉니다.
  - 페이지네이션은 두지 않습니다. route state도 받지 않습니다.
- DoD:
  - F8 AC-2, AC-3, AC-6(`'{broken'`이면 빈 상태, `console.error` 0회)을 통과합니다.
  - F8 AC-4(화면 통합)를 통과합니다.
  - F8 AC-5: 삭제하면 key가 null이고 빈 상태가 보입니다. 취소하면 3행이 유지됩니다.
  - F8 AC-10을 통과합니다.
    - `history-row` 100개, 마지막 행 `'e-99'`
    - 해당 키 `getItem` 호출은 마운트당 1회
    - `<img>` 0개, 페이지 이동 컨트롤 0개
    - 마지막 행 뒤에 Spacing
    - `console.error` 0회
- Covers: [F8-AC-2, F8-AC-3, F8-AC-4, F8-AC-5, F8-AC-6, F8-AC-10]
- Files: `src/pages/HistoryPage.tsx`, `src/pages/HistoryPage.test.tsx`
- Depends on: Task 1.6, Task 3.10, Task 3.11

### Task 3.13 HEIC 변환 화면 `/convert/heic`
- Description:
  - 구성: `Top`, 설명 텍스트, JPG/PNG `Chip`, FilePickSection("사진 선택"), SelectedFileList, `SubmitFooter` "변환하기"
  - Chip의 초기값은 `prefs.heicFormat`이고, 탭하면 `prefs.save({ heicFormat })`를 호출합니다.
  - 변환하기: `logClick('convert_start_heic')` → `runPerFile(files, f => convertHeic(f, format).then(o => [o]), { tool: 'heic', format, quality: 0.92 })`
  - 변환 중:
    - 변환하기 Button은 loading이고, 위에 "N/M 변환 중"을 표시합니다.
    - 사진 선택, Chip, 삭제 버튼은 disabled입니다.
  - 모두 실패하면 Toast "변환에 실패했어요. 다른 파일로 시도해주세요"를 띄우고, 선택 목록은 유지합니다.
  - 빈 상태: "변환할 HEIC 사진을 선택해주세요"를 표시하고, 변환하기는 disabled입니다.
  - route state를 받지 않습니다.
- DoD:
  - F2 AC-1~AC-6을 통과합니다.
  - F2 AC-7: fetch, XHR open, sendBeacon spy가 모두 0회입니다.
  - F2 AC-9: `/convert/heic`과 `ResultPage`를 함께 등록한 MemoryRouter에서 Toast 1회, `output-row` 1개, 저장 버튼 enabled입니다.
- Covers: [F2-AC-1, F2-AC-2, F2-AC-3, F2-AC-4, F2-AC-5, F2-AC-6, F2-AC-7, F2-AC-9, F1-AC-6(부분)]
- Files: `src/pages/HeicPage.tsx`, `src/pages/HeicPage.test.tsx`
- Depends on: Task 1.5, Task 1.11, Task 1.12, Task 3.1, Task 3.6

### Task 3.14 목표 용량 선택 컴포넌트 `TargetSizeSelector`
- Description:
  - Chip 5개: 200KB, 500KB, 1MB(1024), 2MB(2048), 직접 입력
  - "직접 입력"을 고르면 `KeyboardAwareTextField`가 나타납니다(label "목표 용량(KB)", `inputMode="numeric"`, `numericOnly`).
  - 입력값이 빈 문자열이거나 50~10240 밖이면:
    - `hasError`와 helperText "50KB~10,240KB 사이로 입력해주세요"를 표시합니다.
    - `onChange(null)`을 호출합니다.
  - 초기값은 prefs 값입니다. 같은 값의 Chip이 있으면 그 Chip을 선택하고, 없으면 "직접 입력"에 값을 채웁니다.
  - `disabled`와 `onKeyboardOpenChange` prop을 받습니다.
- DoD:
  - F3 AC-5: `30`, `''`, `20000`은 오류, `abc`는 반영되지 않습니다.
  - F3 AC-7: `scrollIntoView`가 center로 호출되고, `inputMode`·`enterKeyHint` 속성이 있으며, Enter 시 blur됩니다.
- Covers: [F3-AC-5, F3-AC-7]
- Files: `src/components/TargetSizeSelector.tsx`, `src/components/TargetSizeSelector.test.tsx`
- Depends on: Task 1.5, Task 3.2

### Task 3.15 이미지 압축 화면 `/convert/compress`
- Description:
  - 구성: `Top`, "목표 용량" 텍스트, TargetSizeSelector, FilePickSection("이미지 선택"), SelectedFileList, `SubmitFooter` "압축하기"
  - 목표값이 null이거나 파일이 0개면 압축하기는 disabled입니다.
  - 압축하기: `logClick('convert_start_compress')` → `prefs.save({ compressTargetKB })` → `runPerFile(files, f => compressToTarget(f, kb * 1024).then(o => [o]), …)`
  - 압축 중: "N/M 압축 중"을 표시하고, Chip·TextField·선택 버튼은 disabled입니다.
  - 키보드가 올라와 있으면 `Spacing size={80}`을 확보합니다.
  - 빈 상태: "용량을 줄일 이미지를 선택해주세요"
  - route state를 받지 않습니다.
- DoD:
  - F3 AC-1, AC-3(화면 경유), AC-6, AC-8(HEIC 압축, prefs 1024 저장)을 통과합니다.
  - F3 AC-4: `/result` 행 부제에 "(최소 612KB)"가 표시됩니다.
  - F3 AC-9를 통과합니다(MemoryRouter + ResultPage).
  - F3 AC-11 전체를 통과합니다.
    - webp가 목표 이하면, `/result`에서 저장할 때 `saveBase64Data`가 `image/webp`로 호출되고 Toast "사진을 저장했어요"가 뜹니다.
    - 프로젝트 전체 `tsc --noEmit` 0건.
- Covers: [F3-AC-1, F3-AC-3, F3-AC-4, F3-AC-6, F3-AC-8, F3-AC-9, F3-AC-11]
- Files: `src/pages/CompressPage.tsx`, `src/pages/CompressPage.test.tsx`
- Depends on: Task 1.11, Task 1.14, Task 3.1, Task 3.6, Task 3.14

### Task 3.16 PDF 순서 변경 목록 `MergeFileList`
- Description:
  - 행마다: 좌측 순번, 제목 파일명, 부제 "N페이지 · 크기"(읽는 중이면 "페이지 확인 중")
  - 우측 "위로"·"아래로"·"삭제" 버튼은 각각 hit area를 44px 이상 확보합니다.
  - 첫 행 "위로"와 마지막 행 "아래로"는 disabled입니다.
  - `onMove(index, dir)`, `onRemove(id)` 콜백과 `disabled` prop을 받습니다.
- DoD:
  - F4 AC-7: 3행이면 끝 버튼 2개만 disabled입니다.
  - [a, b]에서 a의 "아래로"를 탭하면 [b, a]가 되고, 순번은 "1", "2"로 표시됩니다.
  - pending 상태인 행의 부제는 "페이지 확인 중"입니다.
- Covers: [F4-AC-7, F4-AC-2(부분), F4-AC-6(부분)]
- Files: `src/components/MergeFileList.tsx`, `src/components/MergeFileList.test.tsx`
- Depends on: Task 1.3

### Task 3.17 PDF 합치기 화면 `/pdf/merge`
- Description:
  - 파일을 고르면 파일마다 `readPdfPageCount`를 호출합니다.
    - 암호화: Toast "암호가 걸린 PDF는 합칠 수 없어요: {name}"을 띄우고 목록에서 제거합니다.
    - 손상: SPEC에 문구가 없습니다. F5 AC-6 문구를 재사용하고 "확정 필요"로 보고합니다.
  - 합치기 Button은 파일이 2개 이상이고 페이지 수 확인이 모두 끝났을 때만 enabled입니다.
  - 파일 1개면 "2개 이상 선택해주세요", 0개면 "합칠 PDF 파일을 2개 이상 선택해주세요"를 표시합니다.
  - 합치기: `logClick('convert_start_pdf_merge')` → `runSingle(() => mergePdfs(...))`. 합치는 동안 Button은 loading이고 "문서 합치는 중"을 표시합니다.
  - route state를 받지 않습니다.
- DoD:
  - F4 AC-1~AC-6을 통과합니다.
  - F4 AC-8을 통과합니다(MemoryRouter + ResultPage, `pageCount === 5`).
- Covers: [F4-AC-1, F4-AC-2, F4-AC-3, F4-AC-4, F4-AC-5, F4-AC-6, F4-AC-8]
- Files: `src/pages/PdfMergePage.tsx`, `src/pages/PdfMergePage.test.tsx`
- Depends on: Task 1.11, Task 1.16, Task 3.1, Task 3.6, Task 3.16

### Task 3.18 단일 PDF 선택 컴포넌트 `PdfSingleFilePicker`
- Description:
  - FilePickSection(단일)을 씁니다. 파일을 고르면 `loadPdf`로 페이지 수를 읽고, 읽는 동안 "PDF 확인 중"을 표시합니다.
  - 선택된 파일은 ListRow(부제 "N페이지 · 크기", 우측 "삭제")로 보여줍니다.
  - 오류 Toast:
    - 암호: "암호가 걸린 PDF는 {actionWord} 수 없어요". `actionWord`는 prop(`'변환할'` 또는 `'나눌'`)입니다.
    - 그 밖: "파일을 읽을 수 없어요. 다른 파일을 선택해주세요"
    - 오류가 나면 선택을 0개로 되돌립니다.
  - `onChange({ file, doc, pageCount } | null)`를 호출합니다.
- DoD:
  - F5 AC-6을 통과합니다(`PasswordException`과 그 밖의 reject, 선택 0개로 복귀).
  - `actionWord='나눌'`이면 "암호가 걸린 PDF는 나눌 수 없어요"가 표시됩니다.
- Covers: [F5-AC-6]
- Files: `src/components/PdfSingleFilePicker.tsx`, `src/components/PdfSingleFilePicker.test.tsx`
- Depends on: Task 1.17, Task 3.1

### Task 3.19 PDF → 이미지 화면 `/pdf/to-image`
- Description:
  - 구성:
    - PdfSingleFilePicker(`'변환할'`)
    - 형식 Chip(JPG/PNG), 화질 Chip(보통 1.5 / 고화질 2), 페이지 Chip(전체 / 범위 지정)
    - 범위 지정이면 `KeyboardAwareTextField`(label "페이지 범위", placeholder "예: 1-3, 5")
  - 형식·화질 Chip을 탭하면 prefs에 저장합니다.
  - 페이지 검증:
    - 범위는 `parsePageRanges`로 검증합니다.
    - 선택 페이지가 50을 넘으면 helperText "한 번에 최대 50페이지까지 변환할 수 있어요. 범위를 지정해주세요"를 표시합니다.
    - 오류가 있으면 버튼은 disabled입니다.
  - 변환: `logClick('convert_start_pdf_to_image')` → `runSingle`로 페이지를 순차 렌더합니다. 진행 중에는 "N/M 페이지 변환 중"과 loading을 표시합니다.
  - 빈 상태: "이미지로 바꿀 PDF를 선택해주세요"
  - route state를 받지 않습니다.
- DoD:
  - F5 AC-1, AC-2, AC-4, AC-5, AC-7을 통과합니다.
  - F5 AC-9를 통과합니다(MemoryRouter + ResultPage, `output-row` 3개).
- Covers: [F5-AC-1, F5-AC-2, F5-AC-4, F5-AC-5, F5-AC-7, F5-AC-9, F5-AC-6(화면 통합)]
- Files: `src/pages/PdfToImagePage.tsx`, `src/pages/PdfToImagePage.test.tsx`
- Depends on: Task 1.5, Task 1.11, Task 1.15, Task 1.17, Task 3.2, Task 3.6, Task 3.18

### Task 3.20 PDF 나누기 화면 `/pdf/split`
- Description:
  - 구성:
    - PdfSingleFilePicker(`'나눌'`)
    - 모드 Chip(페이지마다 / 범위로)
    - 범위로일 때 `KeyboardAwareTextField`(label "나눌 범위", placeholder "예: 1-3, 4-6")
    - 미리보기 "N개 파일로 나눠요"
  - 버튼이 disabled가 되는 조건과 문구:
    - 1페이지 문서: "1페이지 문서는 나눌 수 없어요"
    - 결과가 50개 초과: "한 번에 최대 50개 파일로 나눌 수 있어요. 범위로 나눠주세요"
    - 범위 오류: 파서 문구
  - 나누기: `logClick('convert_start_pdf_split')` → `runSingle(onProgress => splitPdf(...))`. 진행 중에는 "N/M 파일 만드는 중"과 loading을 표시합니다.
  - 빈 상태: "나눌 PDF를 선택해주세요"
  - route state를 받지 않습니다.
- DoD:
  - F6 AC-1~AC-7을 통과합니다.
  - F6 AC-9를 화면 경유로 통과합니다(12페이지 문서의 0 채우기).
  - F6 AC-8을 통과합니다(MemoryRouter + ResultPage, `output-row` 4개).
- Covers: [F6-AC-1, F6-AC-2, F6-AC-3, F6-AC-4, F6-AC-5, F6-AC-6, F6-AC-7, F6-AC-8, F6-AC-9]
- Files: `src/pages/PdfSplitPage.tsx`, `src/pages/PdfSplitPage.test.tsx`
- Depends on: Task 1.11, Task 1.18, Task 3.2, Task 3.6, Task 3.18

---

## Epic 4. Integration + Landing

**Risk**
- Complexity: Medium
- Risk factors:
  - ① 라우트 경로 문자열이 `RouteState` 키와 어긋날 수 있습니다.
  - ② 페이지 단위 테스트는 통과해도, 실제 App 라우터를 거치면 historySaveFailed 흐름이 깨질 수 있습니다.
  - ③ 검수 금지 패턴(HEX 색상, 외부 링크, 분석 SDK)이 나중에 추가된 코드에 섞일 수 있습니다.
  - ④ 변환 라이브러리가 첫 번들에 섞일 수 있습니다.
- Mitigation:
  - ① 경로를 `AppPath` 타입으로 고정합니다.
  - ② App 전체를 렌더하는 회귀 테스트를 둡니다.
  - ③ 소스 전체를 정적 검사합니다.
  - ④ 빌드 산출물을 직접 검사합니다.

### Task 4.1 라우팅 연결, FloatingTabBar, 번들 확인
- Description:
  - 템플릿 라우터(`src/App.tsx`)에 8개 경로를 등록합니다. 경로 문자열은 `AppPath` 타입으로 검사합니다.
  - 템플릿 `src/components/FloatingTabBar`(변환 `/`, 이력 `/history`)는 `/`와 `/history`에서만 표시합니다.
- DoD:
  - App 전체 렌더:
    - 홈에서 "HEIC → JPG/PNG"를 탭하면 `/convert/heic`의 Top이 보입니다.
    - 탭바 "이력"을 누르면 `/history`로 이동합니다.
    - `/history`에서 마지막 `history-row` 뒤, FloatingTabBar 앞에 Spacing이 있습니다.
    - `/result`에 state 없이 직접 들어가도 크래시 없이 "변환 결과가 만료됐어요"만 보입니다.
  - `vite build` 후 첫 진입 청크에 `heic2any`, `pdf-lib`, `pdfjs` 식별 문자열이 0건입니다.
- Covers: [F8-AC-1(통합), F7-AC-5(통합: 직접 진입)]
- Files: `src/App.tsx`, `src/App.test.tsx`
- Depends on: Task 3.6, Task 3.9, Task 3.12, Task 3.13, Task 3.15, Task 3.17, Task 3.19, Task 3.20

### Task 4.2 검수 정적 검사 스위트
- Description: 검수 반려 조건을 소스 전체에서 검사하는 테스트입니다.
  - `src/**/*.{ts,tsx,css}`에서 HEX 색상 `/#[0-9a-fA-F]{3,8}\b/`
  - 소스의 `window.open(`과 `http(s)://`로 시작하는 `location.href =` 대입
  - `package.json`과 소스의 `gtag`, `analytics`, `amplitude`, `mixpanel`, `firebase` 문자열
  - pdfjs가 legacy 경로로만 import되는지, `build.target`이 `['es2019', 'safari16']`인지
  - 5개 도구 화면 모두 네트워크 spy를 건 채로 변환을 끝까지 실행
- DoD:
  - 위 검사가 모두 0건이고, 설정값이 SPEC과 같습니다.
  - 5개 도구 모두 fetch, XHR, sendBeacon 호출이 0회입니다.
  - F7 AC-8 대상 테스트가 Task 1.2의 `console.error` 가드 아래에서 통과합니다. 잠정 AC 테스트가 실패하면 따로 보고합니다.
  - F8 AC-7을 통과합니다(`/`와 `/history`의 금지 텍스트, 외부 링크).
- Covers: [F7-AC-8, F8-AC-7, F2-AC-7, F5-AC-8]
- Files: `src/__tests__/audit.test.ts`, `src/__tests__/noNetwork.test.tsx`
- Depends on: Task 4.1

### Task 4.3 이력 저장 실패 흐름 통합 회귀 테스트
- Description: 실제 App 라우터로 5개 도구의 흐름을 검증합니다.
  - mock 경로: `historyRepo.append`가 `{ ok: false }`를 반환하게 합니다.
    - 흐름: 도구 화면 → 변환 → `/result` → Toast 1회 → 플래그 제거(replace) → 저장 버튼 enabled
  - 실제 경로 1건: mock 없이 `localStorage.setItem`이 두 번 연속 `QuotaExceededError`를 던지게 합니다.
- DoD:
  - 5개 도구 모두 navigate가 `historySaveFailed: true` state로 1회 호출됩니다.
  - `/result`의 Toast 문구가 SPEC과 같고 1회만 뜹니다. "변환에 실패했어요" Toast는 0회입니다.
  - `output-row` 개수: HEIC 1, compress 1, merge 1, to-image 3, split 4
- Covers: [F1-AC-6, F2-AC-9, F3-AC-9, F4-AC-8, F5-AC-9, F6-AC-8]
- Files: `src/__tests__/historySaveFailed.flow.test.tsx`
- Depends on: Task 4.1

---

## AC Coverage
- **Total ACs in SPEC: 80**
  - F1 11 · F2 9 · F3 11 · F4 8 · F5 9 · F6 9 · F7 13 · F8 10
- **Covered by tasks: 80.** **굵은 번호**는 해당 AC를 끝까지 검증하는 작업입니다.

| Feature | AC → Task |
|---|---|
| F1 | AC-1 **1.6** · AC-2 **1.6** · AC-3 **1.4** · AC-4 **1.4** · AC-5 **1.6** · AC-6 1.6/1.9/3.4/3.6/3.13/**4.3** · AC-7 **1.8** · AC-8 **1.7** · AC-9 **1.6** · AC-10 **1.8** · AC-11 **1.5** |
| F2 | AC-1 1.9/1.12/**3.13** · AC-2 1.12/**3.13** · AC-3 **3.13** · AC-4 1.11/**3.13** · AC-5 1.4/3.1/**3.13** · AC-6 1.11/**3.13** · AC-7 **3.13**/4.2 · AC-8 **3.1** · AC-9 **3.13**/4.3 |
| F3 | AC-1 **3.15** · AC-2 **1.13** · AC-3 1.14/**3.15** · AC-4 1.13/3.3/**3.15** · AC-5 **3.14** · AC-6 **3.15** · AC-7 3.2/**3.14** · AC-8 1.14/**3.15** · AC-9 **3.15**/4.3 · AC-10 **1.14** · AC-11 1.1/1.10/1.14/**3.15** |
| F4 | AC-1 1.3/1.16/**3.17** · AC-2 1.16/3.16/**3.17** · AC-3 **3.17** · AC-4 1.16/**3.17** · AC-5 1.4/**3.17** · AC-6 3.16/**3.17** · AC-7 **3.16** · AC-8 **3.17**/4.3 |
| F5 | AC-1 1.17/**3.19** · AC-2 1.15/**3.19** · AC-3 **1.15** · AC-4 1.15/**3.19** · AC-5 **3.19** · AC-6 1.17/**3.18**/3.19 · AC-7 **3.19** · AC-8 1.2/1.17/**4.2** · AC-9 **3.19**/4.3 |
| F6 | AC-1 1.18/**3.20** · AC-2 1.15/1.18/**3.20** · AC-3 1.15/**3.20** · AC-4 **3.20** · AC-5 **3.20** · AC-6 **3.20** · AC-7 3.2/**3.20** · AC-8 **3.20**/4.3 · AC-9 1.15/1.18/**3.20** |
| F7 | AC-1 3.3/**3.6** · AC-2 **3.5** · AC-3 1.10/**3.3** · AC-4 1.10/3.3/**3.5** · AC-5 3.4/**3.6**/4.1 · AC-6 **3.6** · AC-7 3.4/**3.6** · AC-8 **4.2** · AC-9 3.5/**3.7** · AC-10 **3.8**(잠정) · AC-11 **3.3** · AC-12 3.4/**3.6** · AC-13 **3.8**(잠정) |
| F8 | AC-1 1.3/**3.9**/4.1 · AC-2 3.10/**3.12** · AC-3 3.10/**3.12** · AC-4 3.11/**3.12** · AC-5 **3.12** · AC-6 **3.12** · AC-7 3.9/**4.2** · AC-8 **3.10** · AC-9 **3.11** · AC-10 **3.12** |

- **Uncovered: 0**

**작업 결과 보고 때 확인할 항목** (AC는 모두 배정했지만 검증 방식에 조건이 붙은 것)
- **브라우저 환경이 필요:** F2 AC-8과 F7 AC-13의 44px 단언은 브라우저 모드 테스트에서만 실제로 검증됩니다. jsdom에서는 크기가 항상 0입니다.
- **SPEC에 문구가 없음:** 아래는 임시 문구를 넣고 "확정 필요"로 보고합니다.
  - compress와 PDF 도구의 `UNSUPPORTED_TYPE` 문구(Task 1.4)
  - PDF 합치기에서 손상된 PDF의 Toast 문구(Task 3.17)

---

검증 오류 3건을 모두 고쳤습니다. 작업은 총 41개입니다(Epic 1에 18개, Epic 3에 20개, Epic 4에 3개).

**1. `ResultPage.tsx`를 세 작업이 수정하던 문제**
- 결과 화면을 컴포넌트 파일 3개로 나눴습니다.
  - 무료 층: Task 3.3
  - 만료 화면·하단 버튼·알림 훅: Task 3.4
  - 잠금 섹션: Task 3.5
- `ResultPage.tsx`는 이제 조립 작업인 Task 3.6만 만듭니다.
- AC-9(P0) 통합 테스트(3.7)와 잠정 AC 테스트(3.8)는 테스트 파일만 추가하고, 화면 파일은 건드리지 않습니다.

**2. `HistoryPage.tsx`를 두 작업이 수정하던 문제**
- 요약·목록·빈 상태 컴포넌트(3.10)와 상세 시트(3.11)를 먼저 만듭니다.
- `HistoryPage.tsx`는 조립 작업인 Task 3.12만 만듭니다.

**3. Epic 순서 오류**
- Epic 제목을 템플릿 순서(Data Layer → API Routes → UI Pages → Integration + Landing)에 맞췄습니다.
- 타입 작업(1.1)은 Epic 1 Data Layer의 첫 작업으로 옮겼습니다. 타입, 저장소, 상태 관리는 여전히 서로 다른 작업입니다.
- 서버가 없으므로 Epic 2 API Routes는 "해당 없음"으로 남겨 뒀습니다.
- 맨 위 메모에서 API Routes를 언급하던 문장은 지웠습니다.

**추가 수정: 같은 종류의 파일 충돌을 미리 막음**
- 이전 버전에서는 `package.json`을 세 작업이, `vite.config.ts`를 두 작업이 고쳤습니다. 둘 다 Task 1.2 한 곳으로 모았습니다.
- `validateFiles`의 오류 문구 상수는 `toolMeta.ts`가 아니라 `validateFiles.ts` 안에 둡니다.
- 이제 모든 파일을 한 작업만 수정합니다.

참고로 claude.ai Canva 커넥터는 아직 인증되지 않았습니다. 이번 작업에는 필요하지 않았지만, 쓰려면 claude.ai 커넥터 설정에서 먼저 인증해야 합니다.