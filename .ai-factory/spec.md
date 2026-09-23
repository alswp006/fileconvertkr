I fixed the one mismatch using option (a): `'image/webp'` is now allowed in `ConversionOutput.mimeType`. The rest of the SPEC is unchanged, including every section the contract check marked as consistent.

**Why (a) and not (b):** F3 already promises that an image under the target size isn't re-encoded, and a small PNG already comes back as `image/png`. Adding WEBP to the allowed list keeps that promise for all three formats. Forcing WEBP to JPEG (option b) would break it, and the JPEG could come out bigger than the target, which needs extra fallback rules.

**What changed:**
1. **Data Models:** `ConversionOutput.mimeType` now also allows `'image/webp'`, with a note on where each value comes from.
2. **F3 description:** now says an image already under the target keeps its original format (JPG, PNG or WEBP). Only images that get compressed come out as JPG.
3. **F3 algorithm step 2:** the output format for non-HEIC files is now spelled out. If the browser gives no file type, the extension decides it: `.jpg`/`.jpeg` → `image/jpeg`, `.png` → `image/png`, `.webp` → `image/webp`. The file name keeps the original extension.
4. **F3 AC-11 (new, P1):** a WEBP under the target is returned as-is with `image/webp` and a `.webp` name, and saving it on `/result` works. A WEBP over the target is re-encoded to JPEG. The type check `tsc --noEmit` must pass with no errors.
5. **F3 packets:** P3-a now also covers AC-11.
6. **Open Question 9:** deleted, because it's answered.

**Checks you asked for:** the app has no backend API, database or foreign keys, so the field-to-column and foreign-key checks don't apply. The one list screen, `/history`, still reads its fixed maximum of 100 local entries in one go. That no-pagination decision and its reasons are unchanged (F8, Assumption 12, Open Question 8).

---

# SPEC — FileConvertKR

## Common Principles

**제품 원칙**
- 모든 변환은 **기기 안(브라우저 메모리)에서만** 처리한다. 파일 내용을 서버로 보내는 네트워크 호출(fetch, XMLHttpRequest, sendBeacon)은 없다. 외부 API 서버도 두지 않는다.
- 변환된 파일은 **메모리에만** 둔다(Blob + objectURL). localStorage에는 이력 메타데이터(파일명·크기·개수)만 저장한다.
- 결과 화면(`/result`)은 5개 도구가 함께 쓰는 **최종 payoff 화면 한 곳**이다. 리워드 광고 게이트와 배너 광고는 이 화면에만 둔다.
- 인증은 토스 앱 세션을 그대로 쓴다. 로그인 UI와 사용자 식별은 없다.
- 생성형 AI는 쓰지 않는다. 그래서 AI 고지 의무 AC는 **해당 없음**이다.

**기술 원칙**
- 스택: Vite + React + TypeScript, `@toss/tds-mobile`, `react-router-dom`, localStorage.
- 변환 라이브러리는 모두 **dynamic import(lazy load)**로 불러온다. 홈 첫 로드에는 포함하지 않는다.
  - HEIC 디코드: `heic2any`
  - PDF 합치기·나누기: `pdf-lib`
  - PDF 렌더링: `pdfjs-dist/legacy/build/pdf.mjs`. legacy 빌드를 써야 Android 7+ / iOS 16+에서 동작한다.
- 이미지 재인코딩은 `<canvas>`의 `toBlob(type, quality)`로 한다. PNG를 JPG로 바꿀 때는 캔버스 배경을 `rgb(255,255,255)`로 먼저 채운다. 캔버스 API 인자이므로 CSS 색상 하드코딩 금지 규칙과는 무관하다.
- ID 생성에 `crypto.randomUUID`를 쓰지 않는다(구형 WebView 호환). 대신 `Date.now().toString(36) + Math.random().toString(36).slice(2, 8)`을 쓴다.
- Vite `build.target = ['es2019', 'safari16']`.

**UI 원칙 (TDS)**
- 모든 화면은 `ScreenScaffold`(또는 `PageShell`)로 감싼다. raw div로 화면 골격을 만들지 않는다.
- 쓰는 컴포넌트: TDS `Top`, `ListRow`, `Button`, `TextField`, `Paragraph.Text`, `Chip`, `AlertDialog`, `BottomSheet`, `Toast`, `Spacing`, `Asset.ContentIcon`.
- 하단 탭은 템플릿의 `src/components/FloatingTabBar`를 쓴다.
- 1차 액션은 `SubmitFooter`(하단 고정) 또는 `display="block"` Button으로 둔다.
- 간격은 `Spacing size={n}`으로만 조절한다. TDS 컴포넌트의 padding/margin을 인라인 스타일로 덮어쓰지 않는다.
- 커스텀 CSS는 flex/grid 배치에만 쓴다. 색상은 `var(--tds-color-*)`만 쓴다(HEX 금지, 다크모드 대응).
- 인터랙티브 요소의 터치 영역은 최소 44×44px이다. 시각 크기가 작은 버튼은 flex 래퍼로 hit area를 44px 이상 확보한다.
- 숨김 `<input type="file">`은 TDS Button의 onClick에서 `inputRef.current.click()`으로 연다. change 처리가 끝나면 `input.value = ''`로 초기화해서 같은 파일을 다시 고를 수 있게 한다.

**공통 표기 규칙**
- 크기 표기(`formatBytes`):
  - 1,048,576B 미만은 KB 정수 반올림. 예: `498KB`
  - 그 이상은 MB 소수 첫째 자리. 예: `7.0MB`
- 날짜 표기: 로컬 시간 `YYYY.MM.DD HH:mm`. 예: `2026.09.24 14:30`
- 저장 동작은 모든 문구에서 "저장"이라고 쓴다. "다운로드"는 쓰지 않는다.

**도구 메타 (`src/lib/toolMeta.ts`, 단일 진실원)**

| tool | route | 제목 | 부제 | accept | 파일 수 | 용량 제한 |
|---|---|---|---|---|---|---|
| `heic` | `/convert/heic` | HEIC → JPG/PNG | 아이폰 사진을 어디서나 열리게 | `.heic,.heif,image/heic,image/heif` | 1~20 | 파일당 30MB, 합계 100MB |
| `compress` | `/convert/compress` | 이미지 용량 줄이기 | 원하는 용량으로 압축 | `image/jpeg,image/png,image/webp,.heic,.heif` | 1~20 | 파일당 30MB, 합계 100MB |
| `pdf-merge` | `/pdf/merge` | PDF 합치기 | 여러 PDF를 하나로 | `application/pdf,.pdf` | 2~20 | 파일당 30MB, 합계 100MB |
| `pdf-to-image` | `/pdf/to-image` | PDF → 이미지 | 페이지를 사진으로 저장 | `application/pdf,.pdf` | 1 | 30MB, 선택 페이지 최대 50 |
| `pdf-split` | `/pdf/split` | PDF 나누기 | 페이지별·범위별로 분할 | `application/pdf,.pdf` | 1 | 30MB, 결과 파일 최대 50 |

**라우트 목록**

| 경로 | 화면 | 담당 |
|---|---|---|
| `/` | 홈(도구 목록) | F8 |
| `/history` | 변환 이력 | F8 |
| `/convert/heic` | HEIC 변환 | F2 |
| `/convert/compress` | 이미지 압축 | F3 |
| `/pdf/merge` | PDF 합치기 | F4 |
| `/pdf/to-image` | PDF → 이미지 | F5 |
| `/pdf/split` | PDF 나누기 | F6 |
| `/result` | 변환 결과(공통) | F7 |

**공통 네비게이션 타입**
```ts
// src/lib/routes.ts
export type ResultRouteState = {
  jobId: string;
  historySaveFailed?: true;  // historyRepo.append가 { ok: false }일 때만 넣는다. 성공 시 키 자체를 넣지 않는다
};
export const TOOL_ROUTES: Record<ToolType, string> = {
  'heic': '/convert/heic',
  'compress': '/convert/compress',
  'pdf-merge': '/pdf/merge',
  'pdf-to-image': '/pdf/to-image',
  'pdf-split': '/pdf/split',
};
```
- `historySaveFailed`를 route state로 넘기는 이유: 도구 화면(F2~F6)에서 Toast를 띄우면 바로 이어지는 `/result` 이동으로 화면이 언마운트되어 Toast가 보이지 않는다. 그래서 이력 저장 실패 Toast는 `/result`가 표시한다(F7 AC-12).

**AC 우선순위 표기**
- `[P0]`: 릴리스 차단 조건. 이 SPEC만으로 객관적으로 검증할 수 있어야 한다.
- `[P1]`, `[P2]`: 릴리스 전 충족 목표. 실패해도 릴리스를 막지 않는다.
- `[잠정·OQ7]`: 템플릿 동작 중 아직 확인하지 않은 가정(Assumption 11 (a)(c))에 기대는 AC. 규칙은 F7의 "잠정 AC 규칙"에 있다.

---

## Data Models

### 레코드 수정 정책 (`updatedAt` 유무)
`updatedAt`이 없는 레코드는 **생성 뒤 수정되지 않도록 설계했다**. 필드를 빠뜨린 것이 아니다. 생성 뒤 값이 바뀌는 레코드는 `ConvertPrefs` 하나뿐이고, 이 레코드만 `updatedAt`을 둔다.

| 엔티티 | 저장 위치 | 생성 후 수정 | 식별자·타임스탬프 | 근거 |
|---|---|---|---|---|
| `ConversionJob` | 메모리(jobStore) | **없음(불변)** | `jobId`, `createdAt` | jobStore에는 `saveJob`(추가)과 `getJob`(조회)만 있고, 수정 API가 없다. 제거는 보관 상한 초과 시 통째로 한다 |
| `ConversionOutput` | 메모리(job 하위) | **없음(불변)** | `id`. 시각은 부모 `job.createdAt`을 따른다 | job과 함께 한 번에 만들어진다. 결과 화면의 "저장됨" 라벨은 컴포넌트 state이고, 레코드를 수정하지 않는다 |
| `ConversionFailure` | 메모리(job 하위) | **없음(불변)** | `id`. 시각은 부모 `job.createdAt`을 따른다 | runJob이 실패 시점에 한 번 만든다 |
| `HistoryEntry` | localStorage | **없음(append-only)** | `id`, `createdAt` | `historyRepo`에는 `append`·`load`·`clear`만 있고, 항목별 수정 API가 없다. 삭제는 100개 상한 초과 제거, 용량 초과 시 오래된 20개 제거, 전체 삭제뿐이다 |
| `ConvertPrefs` | localStorage | **있음** (`prefs.save`) | `id`(싱글턴 고정값), `createdAt`, `updatedAt` | 사용자가 옵션을 바꿀 때마다 수정된다. 마지막으로 값이 바뀐 시각을 알 수 있도록 `updatedAt`을 둔다 |

### ToolType / JobOptions — 도구 종류와 변환 옵션 (메모리 전용)
```ts
export type ToolType = 'heic' | 'compress' | 'pdf-merge' | 'pdf-to-image' | 'pdf-split';

export type JobOptions =
  | { tool: 'heic'; format: 'jpg' | 'png'; quality: 0.92 }
  | { tool: 'compress'; targetBytes: number }             // 51,200 ~ 10,485,760
  | { tool: 'pdf-merge' }
  | { tool: 'pdf-to-image'; format: 'jpg' | 'png'; scale: 1.5 | 2; pages: number[] } // 1-based, 오름차순, 중복 없음, 길이 1~50
  | { tool: 'pdf-split'; mode: 'each' | 'ranges'; groups: Array<{ start: number; end: number }> }; // 길이 1~50
```

### ConversionJob — 변환 작업 결과 (메모리 전용, jobStore)
```ts
export interface InputFileMeta {
  name: string;          // 원본 파일명
  sizeBytes: number;     // > 0
  mimeType: string;      // 빈 문자열 허용 (iOS HEIC는 type이 ''일 수 있음)
  pageCount?: number;    // PDF일 때만
}

export type OutputNote = 'ALREADY_UNDER_TARGET' | 'TARGET_NOT_REACHED';

// 불변 레코드. job과 함께 생성되고 수정되지 않는다(updatedAt 없음, 시각은 job.createdAt)
export interface ConversionOutput {
  id: string;
  sourceName: string;        // 이 결과를 만든 원본 파일명 (합치기는 첫 파일명)
  fileName: string;          // 저장될 파일명
  // 'image/webp'는 compress 도구에서 이미 목표 이하인 WEBP 입력을 원본 그대로 반환할 때만 나온다(F3 알고리즘 2단계).
  // 재인코딩 결과는 항상 'image/jpeg', HEIC 도구는 'image/jpeg' | 'image/png', PDF 도구는 'image/jpeg' | 'image/png' | 'application/pdf'
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';
  sizeBytes: number;
  sourceSizeBytes: number;   // 합치기는 입력 합계
  blob: Blob;
  objectUrl: string;         // URL.createObjectURL(blob) — 이미지 미리보기용
  width?: number;            // 이미지 결과만
  height?: number;
  pageCount?: number;        // PDF 결과만
  note?: OutputNote;         // compress 전용
}

// 불변 레코드. runJob이 실패 시점에 한 번 만든다(updatedAt 없음, 시각은 job.createdAt)
export interface ConversionFailure {
  id: string;                // 실패 레코드 고유 ID(공통 ID 생성 규칙). 같은 job 안에서 중복 없음. React key로 쓴다
  inputIndex: number;        // 0-based. runJob에 넘긴 inputs 배열에서의 위치(= 선택 목록 순서)
  fileName: string;
  message: string;           // 사용자 노출 문구
}

// 불변 레코드. saveJob 이후 수정되지 않는다(updatedAt 없음)
export interface ConversionJob {
  jobId: string;
  tool: ToolType;
  createdAt: string;         // ISO 8601
  options: JobOptions;
  inputs: InputFileMeta[];
  outputs: ConversionOutput[];   // 길이 ≥ 1 (0이면 job을 만들지 않음)
  failures: ConversionFailure[];
  durationMs: number;
  status: 'success' | 'partial'; // failures.length > 0 이면 'partial'
}
```
- 저장 위치: 모듈 스코프 `Map<string, ConversionJob>`(`src/lib/jobStore.ts`)
- 최대 3개까지 보관한다. 4번째가 들어오면 가장 오래된 job을 지우고, 그 job 출력 전부에 `URL.revokeObjectURL`을 호출한다.
- 앱을 새로고침하거나 종료하면 사라진다(의도된 동작).
- `ConversionFailure`는 `fileName`만으로 구분하지 않는다. 다른 폴더에서 고른 `photo.jpg` 2개처럼 이름이 같은 파일이 함께 실패할 수 있다. 이런 경우는 `id`(데이터·React key)와 `inputIndex`(사용자 표시)로 구분한다.

### HistoryEntry — 변환 이력 (localStorage)
```ts
// append-only 레코드. 생성 후 수정되지 않으므로 updatedAt을 두지 않는다
export interface HistoryEntry {
  id: string;
  tool: ToolType;
  createdAt: string;         // ISO 8601
  status: 'success' | 'partial';
  inputCount: number;        // ≥ 1 (잘리기 전 실제 개수)
  outputCount: number;       // ≥ 1 (잘리기 전 실제 개수)
  failedCount: number;       // ≥ 0
  inputTotalBytes: number;
  outputTotalBytes: number;
  inputNames: string[];      // 최대 5개, 각 40자 초과 시 앞 39자 + '…'
  outputNames: string[];     // 최대 5개, 동일 규칙
}
```
- key: `fileconvertkr:history:v1`
- shape: `HistoryEntry[]`(JSON). 최신 항목이 index 0이고, 최대 100개다.
- 용량 추정: 항목당 약 650자(UTF-16 약 1.3KB) × 100 ≈ **130KB**
- **이름 목록 정규화:** `historyRepo.append`가 저장 직전에 적용한다. 호출하는 쪽은 잘리지 않은 전체 목록을 넘겨도 된다.
  - 배열은 앞에서부터 5개만 남긴다.
  - 글자 수는 `Array.from(name).length`(코드 포인트) 기준으로 센다. 40자 이하면 그대로 두고, 40자를 넘으면 `Array.from(name).slice(0, 39).join('') + '…'`로 바꾼다. 그래서 잘린 결과는 정확히 40자이고, 이모지 서로게이트 쌍이 깨지지 않는다.
  - `inputCount`와 `outputCount`는 자르기 전 실제 개수를 유지한다. 화면은 이 값으로 "외 N개"를 계산한다(F8).

### ConvertPrefs — 마지막 선택 옵션 (localStorage)
```ts
// 수정되는 싱글턴 레코드(기기당 1개). 그래서 id·createdAt·updatedAt을 둔다
export interface ConvertPrefs {
  id: 'prefs';                     // 싱글턴 고정 ID
  createdAt: string | null;        // ISO 8601. 처음 저장된 시각. 저장된 적 없으면 null
  updatedAt: string | null;        // ISO 8601. 값이 마지막으로 바뀐 시각. 저장된 적 없으면 null
  heicFormat: 'jpg' | 'png';       // 기본 'jpg'
  compressTargetKB: number;        // 기본 500, 범위 50~10240
  pdfImageFormat: 'jpg' | 'png';   // 기본 'jpg'
  pdfImageScale: 1.5 | 2;          // 기본 1.5
}

export type ConvertPrefsValues = Pick<ConvertPrefs, 'heicFormat' | 'compressTargetKB' | 'pdfImageFormat' | 'pdfImageScale'>;
```
- key: `fileconvertkr:prefs:v1`
- 용량: 300B 미만
- 파싱에 실패하거나 필드가 범위를 벗어나면 해당 필드만 기본값으로 대체한다.
  - `id`가 `'prefs'`가 아니면 `'prefs'`로 대체한다.
  - `createdAt`·`updatedAt`이 `new Date(x).toISOString() === x`를 만족하지 않으면 `null`로 대체한다.
- **타임스탬프 갱신 규칙 (`prefs.save(partial: Partial<ConvertPrefsValues>)`):**
  - 호출하는 쪽은 `id`·`createdAt`·`updatedAt`을 넘길 수 없다. 타입상 `ConvertPrefsValues`의 필드만 받는다.
  - partial의 값이 하나라도 현재 값과 다를 때만 setItem을 호출한다.
    - 이때 `updatedAt = 현재 시각(ISO)`로 바꾼다.
    - `createdAt`이 null이면 같은 시각으로 채운다. null이 아니면 유지한다.
  - partial의 모든 값이 현재 값과 같으면 setItem을 호출하지 않고, `updatedAt`도 바뀌지 않는다.

**총 localStorage 사용량:** 약 131KB. 템플릿의 리뷰 요청 플래그 등을 포함해도 **1MB 미만**으로, 5MB 한도 안이다.

---

## Feature List

### F1. 공통 파일 처리 기반 (데이터·저장 계층)
- **Description:** 모든 도구(F2~F6)가 함께 쓰는 비-UI 계층이다. 제공하는 것은 다음과 같다.
  - 파일 검증
  - 변환 실행기(순차 처리·타임아웃·부분 성공)
  - 메모리 jobStore
  - 이력·설정 localStorage 저장소
  - 변환 완료 처리(`finishJob`)
  - 파일 저장 어댑터(`deliverFile`)

  화면은 없고 순수 함수·모듈과 단위 테스트만 있다.
- **Data:** ConversionJob, HistoryEntry, ConvertPrefs
- **API:** 없음 (외부 호출 없음)
- **Modules:**
  - `src/lib/toolMeta.ts`, `src/lib/routes.ts`, `src/lib/format.ts`
  - `validateFiles(files: File[], tool: ToolType): { accepted: File[]; errors: ValidationError[] }`
    - `ValidationError = { fileName: string; code: 'UNSUPPORTED_TYPE' | 'FILE_TOO_LARGE' | 'TOTAL_TOO_LARGE' | 'TOO_MANY_FILES'; message: string }`
  - `runJob<T>(inputs: File[], process: (file: File) => Promise<T[]>, opts: { onProgress(done: number, total: number): void; signal?: AbortSignal; timeoutMs?: number /* 기본 60000 */ }): Promise<{ outputs: T[]; failures: ConversionFailure[] }>`
    - 실패마다 `id`(공통 ID 생성 규칙)와 `inputIndex`(inputs 배열 위치)를 채운다.
  - `jobStore.saveJob(job)`, `jobStore.getJob(jobId): ConversionJob | undefined` (수정 API 없음)
  - `historyRepo.load()`, `historyRepo.append(entry): { ok: boolean }`, `historyRepo.clear()` (항목별 수정 API 없음)
    - `append`는 저장 전에 이름 목록 정규화(Data Models 참고)를 적용한다.
  - `prefs.load(): ConvertPrefs`, `prefs.save(partial: Partial<ConvertPrefsValues>): void`
    - `save`는 타임스탬프 갱신 규칙(Data Models 참고)을 적용한다.
  - `finishJob(job: ConversionJob, navigate: NavigateFunction): void` — F2~F6이 변환 성공 후 공통으로 호출한다. 다음 순서로 동작한다.
    1. `jobStore.saveJob(job)`
    2. `historyRepo.append(toHistoryEntry(job))`
    3. append 결과가 `{ ok: true }`면 `navigate('/result', { state: { jobId } })`를 호출한다.
    4. `{ ok: false }`면 `navigate('/result', { state: { jobId, historySaveFailed: true } })`를 호출한다.

    append가 실패해도 navigate는 반드시 1회 호출한다. 이력 저장 실패가 결과 이동을 막지 않는다.
  - `deliverFile(output: ConversionOutput): Promise<void>` — 동작 계약은 F7에 있다.
- **Requirements:**

AC-1 [E][P0]: Scenario: 이력 추가 저장
  Given localStorage에 `fileconvertkr:history:v1` 키가 없을 때
  When `historyRepo.append({ tool: 'heic', status: 'success', inputCount: 3, outputCount: 3, failedCount: 0, inputTotalBytes: 7340032, outputTotalBytes: 4194304, inputNames: ['IMG_0001.heic','IMG_0002.heic','IMG_0003.heic'], outputNames: ['IMG_0001.jpg','IMG_0002.jpg','IMG_0003.jpg'] })` 호출
  Then 반환값은 `{ ok: true }`
  And localStorage `fileconvertkr:history:v1`를 JSON.parse한 배열의 길이가 1이고, `[0].tool === 'heic'`
  And `[0].id`는 빈 문자열이 아니고, `[0].createdAt`은 `new Date(x).toISOString() === x`를 만족하는 ISO 문자열
  And `'updatedAt' in [0]`은 false다(append-only 레코드)

AC-2 [E][P1]: Scenario: 이력 100개 상한
  Given 이력이 100개 있고 가장 오래된 항목의 id가 `'old-99'`일 때
  When 새 항목 1개를 append
  Then 배열 길이는 100을 유지하고, `[0]`은 새 항목
  And id가 `'old-99'`인 항목은 배열에 없다

AC-3 [E][P0]: Scenario: 파일 형식·용량 검증
  Given tool이 `'heic'`일 때
  When `validateFiles([a.heic(2MB, type ''), b.jpg(1MB, 'image/jpeg'), c.HEIF(35MB, type '')], 'heic')` 호출
  Then `accepted`는 `[a.heic]`
  And `errors`는 다음 두 개다
    - `{ fileName: 'b.jpg', code: 'UNSUPPORTED_TYPE', message: 'HEIC 파일만 선택할 수 있어요' }`
    - `{ fileName: 'c.HEIF', code: 'FILE_TOO_LARGE', message: '파일당 최대 30MB까지 선택할 수 있어요' }`
  And 확장자는 대소문자를 구분하지 않고 판정한다

AC-4 [W][P1]: Scenario: 파일 개수·합계 초과 거부
  Given tool이 `'compress'`일 때
  When 1MB JPG 21개로 validateFiles 호출
  Then `accepted.length === 20`(앞에서부터 20개)
  And `errors`에 `{ code: 'TOO_MANY_FILES', message: '한 번에 최대 20개까지 선택할 수 있어요' }` 1개가 있다
  And 25MB JPG 5개(합계 125MB)로 호출하면 앞의 4개(100MB)만 accepted
  And 이때 `{ code: 'TOTAL_TOO_LARGE', message: '전체 용량은 최대 100MB까지 가능해요' }`가 포함된다

AC-5 [W][P1]: Scenario: 이력이 비었거나 손상된 경우
  Given localStorage `fileconvertkr:history:v1` 값이 없거나 `'{broken'`일 때
  When `historyRepo.load()` 호출
  Then `[]`를 반환하고 예외를 던지지 않는다
  And `console.error` 호출 횟수는 0

AC-6 [W][P1]: Scenario: localStorage 용량 초과
  Given `localStorage.setItem`이 첫 호출에서 `QuotaExceededError`(DOMException name `'QuotaExceededError'`)를 던질 때
  When append 호출
  Then 가장 오래된 20개를 제거한 배열로 setItem을 1회 재시도한다
  And 재시도가 성공하면 `{ ok: true }`를 반환한다
  And 재시도도 실패하면 `{ ok: false }`를 반환하고 예외를 던지지 않는다
  And `finishJob`은 `navigate('/result', { state: { jobId, historySaveFailed: true } })`를 호출하고, `/result`가 Toast `'이력을 저장하지 못했어요. 변환 파일은 그대로 저장할 수 있어요'`를 표시한다(도구 화면별 검증은 F2 AC-9, F3 AC-9, F4 AC-8, F5 AC-9, F6 AC-8, `/result` 쪽 검증은 F7 AC-12)

AC-7 [E][P0]: Scenario: 변환 실행기의 부분 성공과 타임아웃
  Given 입력 3개이고 두 번째 파일의 process가 `Error('decode')`로 reject할 때
  When runJob 실행
  Then outputs는 첫 번째와 세 번째 결과(2개)
  And failures는 `[{ id: <빈 문자열이 아닌 문자열>, inputIndex: 1, fileName: '<두 번째 파일명>', message: '파일을 읽을 수 없어요. 다른 파일을 선택해주세요' }]`
  And onProgress는 (1,3), (2,3), (3,3) 순으로 3회 호출된다
  And process가 60,000ms 안에 끝나지 않으면 해당 파일의 failure message는 `'변환 시간이 너무 오래 걸려서 중단했어요'`

AC-8 [E][P1]: Scenario: jobStore 보관 개수 제한과 조회
  Given jobStore에 job A, B, C가 순서대로 저장되어 있을 때
  When job D를 saveJob
  Then `getJob(A.jobId) === undefined`이고, `getJob(D.jobId)`는 D를 반환한다
  And A의 모든 `outputs[].objectUrl`에 대해 `URL.revokeObjectURL`이 1회씩 호출된다
  And `getJob('unknown-id')`는 undefined를 반환한다

AC-9 [E][P1]: Scenario: 이력 파일명 목록 자르기
  Given localStorage에 `fileconvertkr:history:v1` 키가 없을 때
  When 다음 항목으로 `historyRepo.append` 호출
    - `inputCount: 7`, `inputNames: ['f1.heic','f2.heic','f3.heic','f4.heic','f5.heic','f6.heic','f7.heic']`
    - `outputCount: 3`, `outputNames: ['a'.repeat(41) + '.jpg' /* 45자 */, 'b'.repeat(36) + '.jpg' /* 40자 */, '😀'.repeat(41) /* 41자, 코드 포인트 기준 */]`
  Then 저장된 `[0].inputNames`는 `['f1.heic','f2.heic','f3.heic','f4.heic','f5.heic']`(5개)이고, `[0].inputCount === 7`
  And `[0].outputNames[0] === 'a'.repeat(39) + '…'`이고, `Array.from(x).length === 40`
  And `[0].outputNames[1]`은 입력과 같다(40자는 자르지 않음)
  And `[0].outputNames[2] === '😀'.repeat(39) + '…'`이고, 이 문자열에 짝 없는 서로게이트(`/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/`)가 0건
  And `[0].outputCount === 3`

AC-10 [W][P1]: Scenario: 같은 이름 파일의 실패 구분
  Given inputs가 `[photo.jpg(1,048,576B), other.jpg(524,288B), photo.jpg(2,097,152B)]`이고, 이름이 `photo.jpg`인 두 파일의 process가 모두 reject할 때
  When runJob 실행
  Then outputs 길이는 1(`other.jpg` 결과)
  And failures 길이는 2이고, `inputIndex`는 순서대로 `[0, 2]`, 두 항목의 `fileName`은 모두 `'photo.jpg'`
  And 두 failure의 `id`는 둘 다 빈 문자열이 아니고, 서로 다르다

AC-11 [E][P1]: Scenario: 설정 레코드의 id·createdAt·updatedAt
  Given localStorage에 `fileconvertkr:prefs:v1` 키가 없고, 가짜 타이머로 현재 시각이 `2026-09-24T05:30:00.000Z`일 때
  When `prefs.load()` 호출
  Then 반환값은 `{ id: 'prefs', createdAt: null, updatedAt: null, heicFormat: 'jpg', compressTargetKB: 500, pdfImageFormat: 'jpg', pdfImageScale: 1.5 }`
  When `prefs.save({ heicFormat: 'png' })` 호출
  Then localStorage `fileconvertkr:prefs:v1`를 JSON.parse한 값은 `id: 'prefs'`, `heicFormat: 'png'`, `createdAt: '2026-09-24T05:30:00.000Z'`, `updatedAt: '2026-09-24T05:30:00.000Z'`
  When 60,000ms 뒤 `prefs.save({ compressTargetKB: 1024 })` 호출
  Then `createdAt`은 `'2026-09-24T05:30:00.000Z'` 그대로이고, `updatedAt === '2026-09-24T05:31:00.000Z'`, `heicFormat`은 `'png'` 유지
  When 다시 60,000ms 뒤 `prefs.save({ compressTargetKB: 1024 })`(같은 값) 호출
  Then 이 호출 중 `localStorage.setItem` 호출은 0회이고, `updatedAt`은 `'2026-09-24T05:31:00.000Z'` 그대로다
  And 저장된 `createdAt` 값이 `'not-a-date'`면 `prefs.load().createdAt === null`이고, 나머지 필드는 저장된 값을 유지한다

- **Packets (예상 2):**
  - P1-a: toolMeta, format, validateFiles, prefs(id·createdAt·updatedAt 규칙)
  - P1-b: runJob(failure id·inputIndex), jobStore, historyRepo(이름 정규화), finishJob, deliverFile 스켈레톤

---

### F2. HEIC → JPG/PNG 변환
- **Description:** 아이폰 HEIC/HEIF 사진을 최대 20장까지 골라 JPG(품질 0.92) 또는 PNG로 기기 안에서 변환한다. 변환이 끝나면 공통 결과 화면으로 이동한다. 파일 선택 영역(`FilePickSection`)과 선택 목록(`SelectedFileList`)은 여기서 만들고 F3~F6이 재사용한다.
- **Data:** ConversionJob(tool `'heic'`), HistoryEntry, ConvertPrefs.heicFormat
- **API:** 없음 (`heic2any`를 dynamic import해서 로컬 처리)
- **Screen: HEIC 변환 — `/convert/heic`**
  - TDS 구성(위에서 아래로):
    - `Top` 제목 "HEIC → JPG/PNG"
    - `Paragraph.Text` "아이폰 사진을 카톡·이메일에서 열리는 형식으로 바꿔요"
    - `Chip` 2개(JPG / PNG, 단일 선택)
    - `Button` "사진 선택"(variant weak, display block)
    - `SelectedFileList`: 파일마다 `ListRow` 1개. 제목은 파일명, 부제는 formatBytes, 우측에 "삭제" 버튼
    - `SubmitFooter` "변환하기"
  - Loading: 변환하기 Button `loading` 상태, 버튼 위 `Paragraph.Text` "2/5 변환 중". 사진 선택 Button과 Chip은 disabled
  - Empty: 선택 파일 0개일 때 `Paragraph.Text` "변환할 HEIC 사진을 선택해주세요", 변환하기 disabled
  - Error: 검증 실패와 변환 전체 실패는 `Toast`로 표시
  - 목록 스크롤: 최대 20행이라 가상 스크롤 없이 문서 스크롤. SubmitFooter 높이만큼 하단 `Spacing` 확보
  - 키보드: 텍스트 입력 없음
  - Touch: 삭제 버튼 hit area 44×44px, Chip 높이 44px 이상
  - Navigation
    - Incoming: 없음 (`location.state` 사용 안 함)
    - Outgoing: 변환 성공 → `finishJob(job, navigate)` → `navigate('/result', { state: { jobId } satisfies ResultRouteState })`. 이력 저장 실패 시 state는 `{ jobId, historySaveFailed: true }`
  - Instrumentation: 변환하기 Button → `logClick('convert_start_heic')`
- **Requirements:**

AC-1 [E][P0]: Scenario: HEIC → JPG 변환 성공
  Given prefs.heicFormat이 `'jpg'`이고 `IMG_0001.heic`(2,202,009B)와 `IMG_0002.heic`(1,887,437B)를 선택했을 때
  When 변환하기 탭
  Then heic2any가 파일마다 `{ toType: 'image/jpeg', quality: 0.92 }`로 1회씩 호출된다
  And 저장된 job은 `tool: 'heic'`, `outputs[].fileName = ['IMG_0001.jpg', 'IMG_0002.jpg']`, `mimeType: 'image/jpeg'`
  And historyRepo.append가 `{ tool: 'heic', inputCount: 2, outputCount: 2, failedCount: 0 }`로 1회 호출된다
  And `navigate('/result', { state: { jobId } })`가 호출된다

AC-2 [E][P0]: Scenario: PNG 형식 선택
  Given `/convert/heic`에 진입했을 때
  When `Chip` "PNG"를 탭하고 `IMG_0001.heic`로 변환
  Then localStorage `fileconvertkr:prefs:v1`의 heicFormat은 `'png'`
  And 결과는 `fileName: 'IMG_0001.png'`, `mimeType: 'image/png'`
  And 화면을 다시 열면 "PNG" Chip이 선택된 상태로 표시된다

AC-3 [S][P1]: Scenario: 선택 전 빈 상태
  Given 선택 파일이 0개일 때
  Then `Paragraph.Text` "변환할 HEIC 사진을 선택해주세요"가 표시된다
  And 변환하기 Button은 `disabled`

AC-4 [S][P1]: Scenario: 변환 중 로딩 상태
  Given 5개 파일 변환 중 2개가 끝났을 때
  Then 변환하기 Button은 `loading={true}`이고, 텍스트 "2/5 변환 중"이 표시된다
  And "사진 선택" Button, JPG/PNG Chip, 각 행의 삭제 버튼이 disabled

AC-5 [W][P1]: Scenario: HEIC가 아닌 파일 선택
  Given 선택 파일이 0개일 때
  When 파일 선택기에서 `scan.pdf`를 선택
  Then Toast "HEIC 파일만 선택할 수 있어요"가 표시된다
  And 선택 목록은 0개 그대로이고, 변환하기는 disabled

AC-6 [W][P1]: Scenario: 전체 변환 실패
  Given `broken.heic` 1개를 선택했고 heic2any가 reject할 때
  When 변환하기 탭
  Then 화면은 `/convert/heic`에 머무르고, Toast "변환에 실패했어요. 다른 파일로 시도해주세요"가 표시된다
  And navigate와 historyRepo.append는 호출되지 않는다
  And 선택 목록은 유지되고, 변환하기 Button은 다시 활성화된다

AC-7 [U][P0]: Scenario: 파일이 기기 밖으로 나가지 않음
  Given `window.fetch`, `XMLHttpRequest.prototype.open`, `navigator.sendBeacon`을 spy로 감쌌을 때
  When `IMG_0001.heic` 변환을 끝까지 실행
  Then 세 spy의 호출 횟수는 모두 0

AC-8 [E][P2]: Scenario: 선택 파일 삭제
  Given `IMG_0001.heic`, `IMG_0002.heic`를 선택했을 때
  When `IMG_0001.heic` 행의 "삭제" 탭
  Then 목록에는 `IMG_0002.heic` 1행만 남는다
  And 삭제 버튼 요소의 `getBoundingClientRect()` 너비·높이는 각각 44 이상

AC-9 [W][P1]: Scenario: 이력 저장 실패해도 결과로 이동
  Given `historyRepo.append`가 `{ ok: false }`를 반환하도록 mock했고, `/convert/heic`와 `/result`를 함께 등록한 MemoryRouter에서 `IMG_0001.heic`를 선택했을 때
  When 변환하기 탭
  Then `navigate('/result', { state: { jobId, historySaveFailed: true } })`가 정확히 1회 호출된다
  And `jobStore.getJob(jobId)`는 `outputs[0].fileName === 'IMG_0001.jpg'`인 job을 반환한다
  And `/result`에 Toast "이력을 저장하지 못했어요. 변환 파일은 그대로 저장할 수 있어요"가 1회 표시된다
  And `/result`의 `data-testid="output-row"` 1개가 있고, 그 "저장" Button은 enabled다
  And "변환에 실패했어요" Toast는 표시되지 않는다

- **Packets (예상 2):**
  - P2-a: FilePickSection·SelectedFileList 공통 컴포넌트
  - P2-b: HEIC 화면·변환 로직(finishJob 연동)

---

### F3. 이미지 용량 압축 (목표 용량 지정)
- **Description:** JPG/PNG/WEBP/HEIC 이미지를 사용자가 정한 목표 용량(KB) 이하의 JPG로 압축한다.
  - 품질을 이분 탐색하고, 부족하면 해상도를 단계적으로 줄인다.
  - 이미 목표 이하인 파일은 재인코딩하지 않고 그대로 쓴다. 이때 JPG·PNG·WEBP 입력은 원본 형식(`image/jpeg`·`image/png`·`image/webp`)을 유지한다. HEIC 입력은 JPEG로 디코드한 결과를 쓰고, 원본 HEIC는 결과가 되지 않는다.
  - 재인코딩한 결과는 입력 형식과 관계없이 항상 JPG(`image/jpeg`)다.
  - 목표에 못 미치면 달성한 최소 용량을 알린다.
- **Data:** ConversionJob(tool `'compress'`, `output.note`), ConvertPrefs.compressTargetKB
- **API:** 없음
- **Algorithm (`compressToTarget(file, targetBytes)`):**
  1. **작업 Blob을 정한다.**
     - HEIC/HEIF 입력(확장자 `.heic`/`.heif`, 대소문자 무시, 또는 type `image/heic`/`image/heif`)이면 heic2any `{ toType: 'image/jpeg' }`로 1회 디코드한다. 디코드된 JPEG Blob을 작업 Blob으로 쓰고, 이후 단계에서 원본 HEIC Blob은 쓰지 않는다.
     - 그 밖의 입력은 입력 File 자체가 작업 Blob이다.
  2. **작업 Blob의 `size ≤ targetBytes`면** 작업 Blob을 그대로 반환하고 `note: 'ALREADY_UNDER_TARGET'`. 캔버스 재인코딩(`toBlob`)은 하지 않는다.
     - HEIC 입력: 반환 Blob은 **디코드된 JPEG Blob**이다. `mimeType: 'image/jpeg'`, fileName은 `{base}_compressed.jpg`. 원본 HEIC Blob이나 `image/heic`·`image/heif` mimeType은 결과가 되지 않는다.
     - 그 밖의 입력(JPG·PNG·WEBP): 원본 Blob을 반환한다. fileName은 `{base}_compressed.{원본확장자}`
       - 출력 mimeType은 원본 형식에 따라 `'image/jpeg'`·`'image/png'`·`'image/webp'` 중 하나다. 셋 다 `ConversionOutput.mimeType`에 정의된 값이다.
       - `file.type`이 이 세 값 중 하나면 그 값을 쓴다. 비어 있으면 확장자로 정한다(대소문자 무시): `.jpg`/`.jpeg` → `image/jpeg`, `.png` → `image/png`, `.webp` → `image/webp`.
       - compress의 `validateFiles`는 이 세 형식과 HEIC만 받으므로 그 밖의 mimeType은 나오지 않는다.
     - 판정 기준은 원본 HEIC의 `file.size`가 아니라 **작업 Blob(디코드된 JPEG)의 size**다. 원본 HEIC가 목표 이하여도 디코드 결과가 목표를 넘으면 3단계로 간다.
     - `sourceSizeBytes`는 항상 입력 File의 size다(HEIC면 원본 HEIC 크기).
  3. 작업 Blob을 원본 해상도로 캔버스에 그리고 quality 0.1~0.92 구간을 최대 8회 이분 탐색한다(`toBlob('image/jpeg', q)`). 목표 이하 중 가장 큰 결과를 채택한다. 이 단계부터의 결과는 `mimeType: 'image/jpeg'`, fileName `{base}_compressed.jpg`
  4. quality 0.1에서도 목표 초과면 가로·세로 ×0.8 축소 후 3단계를 반복한다(최대 5회)
  5. 끝까지 목표 초과면 가장 작은 결과를 채택하고 `note: 'TARGET_NOT_REACHED'`
- **Screen: 이미지 압축 — `/convert/compress`**
  - TDS 구성:
    - `Top` "이미지 용량 줄이기"
    - `Paragraph.Text` "목표 용량"
    - `Chip` 5개: 200KB / 500KB / 1MB / 2MB / 직접 입력
    - (직접 입력일 때) `TextField` label "목표 용량(KB)", `inputMode="numeric"`, `enterKeyHint="done"`, 숫자만 허용
    - FilePickSection("이미지 선택"), SelectedFileList
    - `SubmitFooter` "압축하기"
  - Loading: 압축하기 Button loading, "1/3 압축 중". Chip·TextField·선택 버튼 disabled
  - Empty: "용량을 줄일 이미지를 선택해주세요", 압축하기 disabled
  - Error: TextField `hasError` + helperText, 변환 실패는 Toast
  - 키보드:
    - TextField focus 시 `scrollIntoView({ block: 'center' })`
    - Enter 키 → blur
    - 키보드가 올라와 있는 동안(visualViewport.height < window.innerHeight) SubmitFooter가 입력 필드를 가리지 않도록 스크롤 여백 `Spacing size={80}`을 확보
  - Touch: Chip 높이 44px 이상
  - Navigation
    - Incoming: 없음
    - Outgoing: 성공 → `finishJob(job, navigate)` → `navigate('/result', { state: { jobId } })`. 이력 저장 실패 시 `{ jobId, historySaveFailed: true }`
  - Instrumentation: 압축하기 → `logClick('convert_start_compress')`
- **Requirements:**

AC-1 [E][P0]: Scenario: 목표 500KB 압축 성공
  Given Chip "500KB"가 선택됐고 `photo.jpg`(3,145,728B, 4032×3024)를 선택했을 때
  When 압축하기 탭
  Then 결과 job의 `outputs[0]`은 `fileName: 'photo_compressed.jpg'`, `mimeType: 'image/jpeg'`, `sizeBytes ≤ 512000`
  And `note`는 undefined
  And `navigate('/result', { state: { jobId } })`가 호출된다

AC-2 [U][P0]: Scenario: 압축 알고리즘 탐색 한도
  Given canvas.toBlob mock이 quality에 비례한 크기를 반환할 때
  When `compressToTarget(file, 512000)` 실행
  Then 해상도 1단계당 toBlob 호출은 8회 이하이고, 해상도 축소는 5회 이하
  And 채택된 결과는 목표 이하 후보 중 sizeBytes가 가장 큰 것

AC-3 [E][P1]: Scenario: 이미 목표 이하인 파일
  Given 목표 500KB이고 `small.jpg`가 307,200B일 때
  When 압축하기 탭
  Then `outputs[0].blob`은 입력 File과 같은 바이트(size 307,200)이고, `note === 'ALREADY_UNDER_TARGET'`
  And fileName은 `'small_compressed.jpg'`

AC-4 [W][P1]: Scenario: 목표 용량 미달성
  Given 목표 200KB이고, mock상 5회 축소 후 최소 결과가 626,688B일 때
  When 압축 실행
  Then `outputs[0].sizeBytes === 626688`이고, `note === 'TARGET_NOT_REACHED'`
  And 결과 화면 해당 행에 "목표 용량까지 줄이지 못했어요 (최소 612KB)"가 표시된다

AC-5 [W][P1]: Scenario: 직접 입력값 범위 오류
  Given Chip "직접 입력"을 선택했을 때
  When TextField에 `30`을 입력
  Then TextField는 `hasError` 상태이고, helperText는 "50KB~10,240KB 사이로 입력해주세요"
  And 압축하기는 disabled
  And 빈 문자열이나 `20000`을 입력해도 같은 오류가 표시된다
  And `abc` 입력은 필드 값에 반영되지 않는다(숫자 외 문자 필터)

AC-6 [S][P1]: Scenario: 빈 상태와 로딩 상태
  Given 선택 파일이 0개일 때
  Then "용량을 줄일 이미지를 선택해주세요"가 표시되고, 압축하기는 disabled
  And 3개 압축 중 1개가 끝나면 "1/3 압축 중"이 표시되고, 압축하기 Button은 `loading={true}`

AC-7 [E][P1]: Scenario: 모바일 키보드 대응
  Given Chip "직접 입력"을 선택했을 때
  When 목표 용량 TextField에 focus
  Then 입력 요소의 `scrollIntoView`가 `{ block: 'center' }`로 호출된다
  And 입력 요소는 `inputMode="numeric"`, `enterKeyHint="done"` 속성을 가진다
  And Enter keydown 시 입력 요소가 blur된다

AC-8 [E][P0]: Scenario: HEIC 입력 압축
  Given 목표 1MB이고 `IMG_1.heic`(2,621,440B)를 선택했을 때
  When 압축하기 탭
  Then heic2any가 `{ toType: 'image/jpeg' }`로 1회 호출된 뒤 압축이 진행된다
  And `outputs[0].fileName === 'IMG_1_compressed.jpg'`, `sizeBytes ≤ 1048576`
  And prefs.compressTargetKB는 1024로 저장된다

AC-9 [W][P1]: Scenario: 이력 저장 실패해도 결과로 이동
  Given `historyRepo.append`가 `{ ok: false }`를 반환하도록 mock했고, `/convert/compress`와 `/result`를 함께 등록한 MemoryRouter에서 Chip "500KB", `photo.jpg`(3,145,728B)를 선택했을 때
  When 압축하기 탭
  Then `navigate('/result', { state: { jobId, historySaveFailed: true } })`가 정확히 1회 호출된다
  And `jobStore.getJob(jobId).outputs[0].fileName === 'photo_compressed.jpg'`
  And `/result`에 Toast "이력을 저장하지 못했어요. 변환 파일은 그대로 저장할 수 있어요"가 1회 표시된다
  And `/result`의 `data-testid="output-row"` 1개의 "저장" Button은 enabled다

AC-10 [E][P0]: Scenario: 이미 목표 이하인 HEIC 입력은 디코드된 JPEG로 반환
  Given 목표 1MB(1,048,576B)이고 `IMG_2.heic`(409,600B, type `''`)를 선택했을 때
  And heic2any mock이 size 716,800B, type `'image/jpeg'`인 Blob을 반환할 때
  When 압축하기 탭
  Then heic2any는 `{ toType: 'image/jpeg' }`로 1회 호출되고, canvas `toBlob` 호출은 0회
  And `outputs[0].blob`은 heic2any가 반환한 Blob과 같은 객체이고, size는 716,800
  And `outputs[0]`은 `mimeType: 'image/jpeg'`, `fileName: 'IMG_2_compressed.jpg'`, `note: 'ALREADY_UNDER_TARGET'`, `sourceSizeBytes: 409600`
  And `outputs[0].mimeType`과 `outputs[0].blob.type` 모두 `'image/heic'`·`'image/heif'`가 아니다
  And heic2any mock이 대신 1,258,291B JPEG Blob을 반환하면(원본 HEIC 409,600B는 목표 이하), toBlob 이분 탐색(알고리즘 3단계)이 1회 이상 실행되고 `note`는 `'ALREADY_UNDER_TARGET'`이 아니다

AC-11 [E][P1]: Scenario: 이미 목표 이하인 WEBP 입력은 원본 형식(image/webp) 유지
  Given 목표 500KB(512,000B)이고 `sticker.webp`(204,800B, type `'image/webp'`)를 선택했을 때
  When 압축하기 탭
  Then heic2any 호출은 0회이고, canvas `toBlob` 호출은 0회
  And `outputs[0].blob`은 입력 File과 같은 객체이고, size는 204,800
  And `outputs[0]`은 `mimeType: 'image/webp'`, `fileName: 'sticker_compressed.webp'`, `note: 'ALREADY_UNDER_TARGET'`, `sourceSizeBytes: 204800`
  And 같은 파일의 type이 `''`여도 `outputs[0].mimeType === 'image/webp'`다(확장자 `.webp`로 판정)
  And 프로젝트 전체 `tsc --noEmit` 결과 타입 오류 0건(`ConversionOutput.mimeType`에 `'image/webp'` 포함)
  And 이 job으로 `/result`에 진입해 `sticker_compressed.webp` 행의 "저장"을 탭하면 `saveBase64Data`가 `{ fileName: 'sticker_compressed.webp', mimeType: 'image/webp', data: <base64> }`로 1회 호출되고, 성공 시 Toast "사진을 저장했어요"가 표시된다
  And 목표가 200KB(204,800B 미만인 조건: `sticker.webp`를 307,200B로 바꿈)라서 재인코딩이 일어나면 `outputs[0].mimeType === 'image/jpeg'`이고 fileName은 `'sticker_compressed.jpg'`

- **Packets (예상 2):**
  - P3-a: compressToTarget 알고리즘(HEIC 작업 Blob 규칙·원본 형식 mimeType 판정 포함) + 단위 테스트(AC-2, AC-10, AC-11)
  - P3-b: 압축 화면(Chip·TextField·키보드, finishJob 연동)

---

### F4. PDF 합치기
- **Description:** PDF 2~20개를 골라 순서를 바꾼 뒤 하나의 PDF로 합친다(`pdf-lib`의 `copyPages`). 파일을 고르면 각 파일의 페이지 수를 읽어 보여준다. 합치기는 전부 성공하거나 전부 실패하는 작업이다.
- **Data:** ConversionJob(tool `'pdf-merge'`, outputs 1개)
- **API:** 없음
- **Screen: PDF 합치기 — `/pdf/merge`**
  - TDS 구성:
    - `Top` "PDF 합치기"
    - `Paragraph.Text` "위에 있는 파일부터 순서대로 합쳐요"
    - FilePickSection("PDF 선택")
    - 파일마다 `ListRow` 1개. 좌측 순번 "1", 제목은 파일명, 부제는 "3페이지 · 1.2MB". 우측에 "위로"·"아래로"·"삭제" 버튼
    - `SubmitFooter` "합치기"
  - Loading:
    - 페이지 수를 읽는 동안 해당 행 부제에 "페이지 확인 중"
    - 합치는 동안 합치기 Button loading과 "문서 합치는 중"
  - Empty: "합칠 PDF 파일을 2개 이상 선택해주세요", 합치기 disabled
  - Error: 암호화·손상 PDF와 합계 초과는 Toast
  - 목록 스크롤: 최대 20행이라 문서 스크롤
  - 키보드: 텍스트 입력 없음
  - Touch: 위로/아래로/삭제 각 hit area 44×44px
  - Navigation
    - Incoming: 없음
    - Outgoing: 성공 → `finishJob(job, navigate)` → `navigate('/result', { state: { jobId } })`. 이력 저장 실패 시 `{ jobId, historySaveFailed: true }`
  - Instrumentation: 합치기 → `logClick('convert_start_pdf_merge')`
- **Requirements:**

AC-1 [E][P0]: Scenario: PDF 2개 합치기 성공
  Given `a.pdf`(3페이지), `b.pdf`(2페이지)가 [a, b] 순서이고 현재 시각이 2026-09-24 14:30일 때
  When 합치기 탭
  Then `outputs[0].fileName === '합친문서_20260924_1430.pdf'`, `mimeType: 'application/pdf'`, `pageCount === 5`
  And 결과 PDF의 페이지 순서는 a1, a2, a3, b1, b2
  And `navigate('/result', { state: { jobId } })`가 호출된다

AC-2 [E][P0]: Scenario: 순서 변경
  Given [a.pdf, b.pdf] 순서일 때
  When `a.pdf` 행의 "아래로" 탭
  Then 목록은 [b.pdf, a.pdf]이고, 순번 표시는 b.pdf "1", a.pdf "2"
  And 합치기 결과의 페이지 순서는 b1, b2, a1, a2, a3

AC-3 [W][P1]: Scenario: 1개만 선택
  Given `a.pdf` 1개만 선택했을 때
  Then 합치기 Button은 disabled
  And `Paragraph.Text` "2개 이상 선택해주세요"가 표시된다

AC-4 [W][P1]: Scenario: 암호가 걸린 PDF
  Given `a.pdf`와 암호화된 `secret.pdf`(pdf-lib load 시 EncryptedPDFError)를 선택했을 때
  When 페이지 수 확인 단계에서 `secret.pdf`가 실패
  Then Toast "암호가 걸린 PDF는 합칠 수 없어요: secret.pdf"가 표시된다
  And `secret.pdf`는 목록에서 제거되고 `a.pdf`만 남는다

AC-5 [W][P1]: Scenario: 합계 용량 초과
  Given 이미 28MB PDF 3개(84MB)를 선택했을 때
  When 28MB PDF 1개를 추가 선택
  Then Toast "전체 용량은 최대 100MB까지 가능해요"가 표시되고, 목록은 3개 그대로다

AC-6 [S][P1]: Scenario: 빈 상태와 로딩 상태
  Given 선택 파일이 0개일 때
  Then "합칠 PDF 파일을 2개 이상 선택해주세요"가 표시된다
  And 파일을 고른 직후 페이지 수를 읽는 동안 해당 행 부제는 "페이지 확인 중"
  And 합치는 동안 합치기 Button은 `loading={true}`이고, "문서 합치는 중"이 표시된다

AC-7 [U][P2]: Scenario: 끝 행의 이동 버튼 비활성
  Given [a.pdf, b.pdf, c.pdf]일 때
  Then 첫 행 "위로"와 마지막 행 "아래로"는 disabled이고, 나머지 이동 버튼은 enabled

AC-8 [W][P1]: Scenario: 이력 저장 실패해도 결과로 이동
  Given `historyRepo.append`가 `{ ok: false }`를 반환하도록 mock했고, `/pdf/merge`와 `/result`를 함께 등록한 MemoryRouter에서 `a.pdf`(3페이지), `b.pdf`(2페이지)를 선택했을 때
  When 합치기 탭
  Then `navigate('/result', { state: { jobId, historySaveFailed: true } })`가 정확히 1회 호출된다
  And `jobStore.getJob(jobId).outputs[0].pageCount === 5`
  And `/result`에 Toast "이력을 저장하지 못했어요. 변환 파일은 그대로 저장할 수 있어요"가 1회 표시된다
  And `/result`의 `data-testid="output-row"` 1개의 "저장" Button은 enabled다

- **Packets (예상 1~2):**
  - P4-a: mergePdfs 로직 + 페이지 수 읽기
  - P4-b: 순서 변경 목록 UI(finishJob 연동)

---

### F5. PDF → 이미지 낱장 추출
- **Description:** PDF 1개의 전체 페이지나 지정한 페이지를 JPG/PNG 이미지로 렌더링해 낱장으로 만든다(pdfjs-dist legacy 빌드). 페이지 범위 파서 `parsePageRanges`와 페이지 번호 표기 함수 `formatPageNumber`는 여기서 정의하고 F6이 재사용한다.
- **Data:** ConversionJob(tool `'pdf-to-image'`), ConvertPrefs.pdfImageFormat / pdfImageScale
- **API:** 없음
- **파일명 규칙:** `{base}_p{n}.{jpg|png}`
  - n은 `formatPageNumber(n, totalPages)`로 만든다. 구현은 `String(n).padStart(String(totalPages).length, '0')`이다.
  - 자릿수 기준은 원본 문서의 총 페이지 수다. 예: 3페이지 문서는 `계약서_p1.jpg`, 12페이지 문서는 `계약서_p01.jpg`
- **Screen: PDF → 이미지 — `/pdf/to-image`**
  - TDS 구성:
    - `Top` "PDF → 이미지"
    - FilePickSection("PDF 선택", 단일)
    - 선택된 파일 `ListRow`: 파일명, 부제 "12페이지 · 2.4MB", 우측 "삭제"
    - `Paragraph.Text` "형식" + `Chip` JPG/PNG
    - `Paragraph.Text` "화질" + `Chip` 보통/고화질(scale 1.5/2)
    - `Paragraph.Text` "페이지" + `Chip` 전체/범위 지정
    - (범위 지정일 때) `TextField` label "페이지 범위", placeholder "예: 1-3, 5", `inputMode="text"`, `enterKeyHint="done"`
    - `SubmitFooter` "이미지로 변환"
  - Loading: 파일을 고른 직후 "PDF 확인 중". 변환 중에는 "3/12 페이지 변환 중"과 Button loading
  - Empty: "이미지로 바꿀 PDF를 선택해주세요", 버튼 disabled
  - Error: 범위 오류는 TextField helperText, 파일 오류는 Toast
  - 키보드: focus 시 `scrollIntoView({ block: 'center' })`, Enter 시 blur
  - Touch: Chip·삭제 버튼 44px 이상
  - Navigation
    - Incoming: 없음
    - Outgoing: 성공 → `finishJob(job, navigate)` → `navigate('/result', { state: { jobId } })`. 이력 저장 실패 시 `{ jobId, historySaveFailed: true }`
  - Instrumentation: 이미지로 변환 → `logClick('convert_start_pdf_to_image')`
- **Requirements:**

AC-1 [E][P0]: Scenario: 전체 페이지 JPG 추출
  Given `계약서.pdf`(3페이지), 형식 JPG, 화질 보통, 페이지 "전체"일 때
  When 이미지로 변환 탭
  Then outputs의 fileName은 `['계약서_p1.jpg', '계약서_p2.jpg', '계약서_p3.jpg']`이고, 모두 `mimeType: 'image/jpeg'`
  And 각 페이지는 pdfjs `page.getViewport({ scale: 1.5 })` 크기로 렌더된다
  And `navigate('/result', { state: { jobId } })`가 호출된다

AC-2 [E][P0]: Scenario: 범위 지정 추출
  Given 6페이지 `report.pdf`이고 페이지 "범위 지정"일 때
  When TextField에 `1-2, 5`를 입력하고 변환
  Then outputs의 fileName은 `['report_p1.jpg', 'report_p2.jpg', 'report_p5.jpg']`

AC-3 [U][P0]: Scenario: 페이지 범위 파서
  Given `parsePageRanges(input, totalPages)`에 대해
  Then `parsePageRanges('1-3,5, 7-7', 10)`은 `{ ok: true, pages: [1,2,3,5,7] }`
  And `parsePageRanges('3,1-2,2', 10)`은 `{ ok: true, pages: [1,2,3] }`(정렬·중복 제거)
  And 공백은 무시한다

AC-4 [W][P1]: Scenario: 잘못된 범위 입력
  Given 6페이지 PDF이고 범위 지정일 때
  When 다음 값을 입력
    - `3-1`, `0`, `a`, `1--2`
    - `8`
  Then helperText는 다음과 같다
    - `3-1`, `0`, `a`, `1--2` → "페이지 범위를 확인해주세요 (예: 1-3, 5)"
    - `8` → "문서는 총 6페이지예요"
  And 이미지로 변환 Button은 disabled

AC-5 [W][P1]: Scenario: 50페이지 초과 선택
  Given 80페이지 PDF이고 페이지 "전체"일 때
  Then helperText "한 번에 최대 50페이지까지 변환할 수 있어요. 범위를 지정해주세요"가 표시된다
  And 이미지로 변환 Button은 disabled

AC-6 [W][P1]: Scenario: 암호화·손상 PDF
  Given pdfjs `getDocument().promise`가 `PasswordException`으로 reject할 때
  When PDF를 선택
  Then Toast "암호가 걸린 PDF는 변환할 수 없어요"가 표시되고, 선택 상태는 0개
  And 그 밖의 reject는 Toast "파일을 읽을 수 없어요. 다른 파일을 선택해주세요"

AC-7 [S][P1]: Scenario: 빈 상태와 로딩 상태
  Given PDF를 선택하지 않았을 때
  Then "이미지로 바꿀 PDF를 선택해주세요"가 표시되고, 버튼은 disabled
  And 12페이지 중 3페이지를 렌더한 시점에는 "3/12 페이지 변환 중"이 표시된다

AC-8 [U][P1]: Scenario: 구형 기기 호환 (검수)
  Given 프로덕션 빌드일 때
  Then pdfjs는 `pdfjs-dist/legacy/build/pdf.mjs`에서만 import한다(비-legacy 경로 import 0건)
  And `GlobalWorkerOptions.workerSrc`는 Vite `?url`로 번들된 로컬 경로다(외부 CDN URL이 아님)
  And `vite.config.ts`의 `build.target`은 `['es2019', 'safari16']`

AC-9 [W][P1]: Scenario: 이력 저장 실패해도 결과로 이동
  Given `historyRepo.append`가 `{ ok: false }`를 반환하도록 mock했고, `/pdf/to-image`와 `/result`를 함께 등록한 MemoryRouter에서 `계약서.pdf`(3페이지), 형식 JPG, 페이지 "전체"를 선택했을 때
  When 이미지로 변환 탭
  Then `navigate('/result', { state: { jobId, historySaveFailed: true } })`가 정확히 1회 호출된다
  And `jobStore.getJob(jobId).outputs.length === 3`
  And `/result`에 Toast "이력을 저장하지 못했어요. 변환 파일은 그대로 저장할 수 있어요"가 1회 표시된다
  And `/result`의 `data-testid="output-row"` 3개의 "저장" Button은 모두 enabled다

- **Packets (예상 2):**
  - P5-a: parsePageRanges + formatPageNumber + pdfjs 렌더러
  - P5-b: PDF→이미지 화면(finishJob 연동)

---

### F6. PDF 파일 분할
- **Description:** PDF 1개를 "페이지마다"(페이지당 PDF 1개) 또는 "범위로"(`1-3, 4-6, 7` → 3개 파일) 나눈다(`pdf-lib`). 토큰 문법은 F5의 파서를 재사용하되, 그룹을 평탄화하지 않는 `parseSplitGroups`를 쓴다. 파일명의 페이지 번호도 F5의 `formatPageNumber`를 재사용한다.
- **Data:** ConversionJob(tool `'pdf-split'`)
- **API:** 없음
- **파일명 규칙:**
  - 한 페이지 그룹: `{base}_p{n}.pdf`
  - 여러 페이지 그룹: `{base}_{start}-{end}.pdf`
  - **0 채우기: F5 규칙을 그대로 쓴다.** `n`, `start`, `end` 모두 `formatPageNumber(x, totalPages)`로 만든다. 자릿수 기준은 원본 문서의 총 페이지 수이고, 결과 파일 수는 기준이 아니다.
    - 12페이지 문서의 3페이지 → `보고서_p03.pdf`
    - 12페이지 문서의 1-3 범위 → `보고서_01-03.pdf`
    - 9페이지 이하 문서는 자릿수가 1이라 채우지 않는다. 예: 4페이지 문서 → `보고서_p1.pdf`, `보고서_1-2.pdf`
  - 근거: 파일 앱은 파일명을 사전순으로 정렬한다. 0을 채우지 않으면 `p1, p10, p11, p12, p2…` 순서가 된다. F5 결과(이미지)와 F6 결과(PDF)가 같은 규칙을 따라야 사용자가 한 규칙만 익히면 된다.
- **Screen: PDF 나누기 — `/pdf/split`**
  - TDS 구성:
    - `Top` "PDF 나누기"
    - FilePickSection("PDF 선택", 단일)
    - 선택 파일 `ListRow`(부제 "4페이지 · 1.1MB")
    - `Chip` 페이지마다/범위로
    - (범위로일 때) `TextField` label "나눌 범위", placeholder "예: 1-3, 4-6", `enterKeyHint="done"`
    - `Paragraph.Text` 미리보기 "3개 파일로 나눠요"
    - `SubmitFooter` "나누기"
  - Loading: 파일을 고른 직후 "PDF 확인 중". 나누는 동안 Button loading과 "2/3 파일 만드는 중"
  - Empty: "나눌 PDF를 선택해주세요", 버튼 disabled
  - Error: 범위 오류는 helperText, 파일 오류는 Toast(F5 AC-6과 같은 문구에서 "변환할"을 "나눌"로 바꿈)
  - 키보드: focus 시 `scrollIntoView({ block: 'center' })`, Enter 시 blur
  - Touch: Chip·삭제 버튼 44px 이상
  - Navigation
    - Incoming: 없음
    - Outgoing: 성공 → `finishJob(job, navigate)` → `navigate('/result', { state: { jobId } })`. 이력 저장 실패 시 `{ jobId, historySaveFailed: true }`
  - Instrumentation: 나누기 → `logClick('convert_start_pdf_split')`
- **Requirements:**

AC-1 [E][P0]: Scenario: 페이지마다 나누기
  Given `보고서.pdf`(4페이지), 모드 "페이지마다"일 때
  When 나누기 탭
  Then outputs의 fileName은 `['보고서_p1.pdf', '보고서_p2.pdf', '보고서_p3.pdf', '보고서_p4.pdf']`이고, 모두 `pageCount === 1`
  And `navigate('/result', { state: { jobId } })`가 호출된다

AC-2 [E][P0]: Scenario: 범위로 나누기
  Given `보고서.pdf`(4페이지), 모드 "범위로"일 때
  When TextField에 `1-2, 3` 입력 후 나누기
  Then outputs는 `[{ fileName: '보고서_1-2.pdf', pageCount: 2 }, { fileName: '보고서_p3.pdf', pageCount: 1 }]`
  And 입력 직후 미리보기 텍스트는 "2개 파일로 나눠요"

AC-3 [W][P1]: Scenario: 잘못된 범위
  Given 4페이지 PDF, 모드 "범위로"일 때
  When `2-1`을 입력하면 "페이지 범위를 확인해주세요 (예: 1-3, 5)"
  And `1-6`을 입력하면 "문서는 총 4페이지예요"가 helperText로 표시된다
  Then 두 경우 모두 나누기 Button은 disabled

AC-4 [W][P1]: Scenario: 1페이지 문서
  Given 1페이지 PDF, 모드 "페이지마다"일 때
  Then helperText "1페이지 문서는 나눌 수 없어요"가 표시되고, 나누기는 disabled

AC-5 [W][P1]: Scenario: 결과 파일 50개 초과
  Given 80페이지 PDF, 모드 "페이지마다"일 때
  Then "한 번에 최대 50개 파일로 나눌 수 있어요. 범위로 나눠주세요"가 표시되고, 나누기는 disabled

AC-6 [S][P1]: Scenario: 빈 상태와 로딩 상태
  Given PDF를 선택하지 않았을 때
  Then "나눌 PDF를 선택해주세요"가 표시되고, 나누기는 disabled
  And 3개 중 2개를 만든 시점에는 "2/3 파일 만드는 중"이 표시되고, Button은 `loading={true}`

AC-7 [E][P1]: Scenario: 범위 입력 키보드 대응
  Given 모드 "범위로"일 때
  When 나눌 범위 TextField에 focus
  Then `scrollIntoView({ block: 'center' })`가 호출되고, `enterKeyHint="done"`
  And Enter keydown 시 blur된다

AC-8 [W][P1]: Scenario: 이력 저장 실패해도 결과로 이동
  Given `historyRepo.append`가 `{ ok: false }`를 반환하도록 mock했고, `/pdf/split`과 `/result`를 함께 등록한 MemoryRouter에서 `보고서.pdf`(4페이지), 모드 "페이지마다"를 선택했을 때
  When 나누기 탭
  Then `navigate('/result', { state: { jobId, historySaveFailed: true } })`가 정확히 1회 호출된다
  And `jobStore.getJob(jobId).outputs.length === 4`
  And `/result`에 Toast "이력을 저장하지 못했어요. 변환 파일은 그대로 저장할 수 있어요"가 1회 표시된다
  And `/result`의 `data-testid="output-row"` 4개의 "저장" Button은 모두 enabled다

AC-9 [E][P1]: Scenario: 10페이지 이상 문서의 파일명 0 채우기
  Given `보고서.pdf`(12페이지), 모드 "페이지마다"일 때
  When 나누기 탭
  Then outputs의 fileName은 ``Array.from({ length: 12 }, (_, i) => `보고서_p${String(i + 1).padStart(2, '0')}.pdf`)``다. 즉 `'보고서_p01.pdf'`부터 `'보고서_p12.pdf'`까지 12개이고, `'보고서_p1.pdf'`는 없다
  And fileName 배열을 복사해 `.sort()`한 결과가 outputs 순서와 같다
  And 모드 "범위로"에서 `1-3, 4-9, 10-12`를 입력하고 나누면 fileName은 `['보고서_01-03.pdf', '보고서_04-09.pdf', '보고서_10-12.pdf']`이고, pageCount는 `[3, 6, 3]`
  And 모드 "범위로"에서 `5`를 입력하고 나누면 fileName은 `['보고서_p05.pdf']`

- **Packets (예상 1~2):**
  - P6-a: parseSplitGroups + splitPdf(F5 formatPageNumber 재사용, AC-9)
  - P6-b: 분할 화면(finishJob 연동)

---

### F7. 변환 결과 화면 & 파일 저장 (공통 payoff)
- **Description:** 5개 도구의 결과를 한 화면에서 보여주는 최종 화면이다.
  - 무료 층: 요약 수치와 파일별 저장 버튼을 제공한다.
  - 잠금 층: 파일별 상세 리포트와 "모두 저장"을 리워드 광고 게이트 뒤에 둔다.
  - 그 밖에 배너 광고 2개, 공유, 리뷰 요청, 이력 저장 실패 알림, 파일 저장 어댑터 `deliverFile`의 동작도 이 기능이 정의한다.
- **Data:** ConversionJob(jobStore에서 읽기 전용)
- **API:** 외부 API 없음
- **deliverFile 계약:**
  1. `saveBase64Data`(`@apps-in-toss/web-framework`)를 `{ data: <base64, data: 접두사 제외>, fileName, mimeType }`로 호출한다
  2. 실패(throw 또는 reject)하면 `URL.createObjectURL(blob)` + `<a download={fileName}>` click으로 대체한다. 같은 출처 blob URL이라 외부 이탈이 아니다
  3. 대체 경로도 throw하면 reject한다
- **SummaryHero 값(도구별):**

  | tool | value | unit | label |
  |---|---|---|---|
  | heic | outputs.length | 개 | 변환 완료 |
  | compress | `max(0, round((1 − outTotal/inTotal) × 100))` | % | 용량 절감 |
  | pdf-merge | outputs[0].pageCount | 페이지 | 하나의 PDF로 합쳤어요 |
  | pdf-to-image | outputs.length | 장 | 이미지 추출 |
  | pdf-split | outputs.length | 개 | PDF로 나눴어요 |

- **리워드 게이트 책임 분리 (누가 무엇을 만드는가):**

  | 담당 | 만드는 것 | 만들지 않는 것 |
  |---|---|---|
  | **`TossRewardAd`** (템플릿 제공, 재설계·수정 금지) | 광고 로드·표시(`loadFullScreenAd`/`showFullScreenAd`), 잠금 상태의 **게이트 트리거 버튼**(잠정, Assumption 11(a)), 보상 완료 판정, 광고를 띄울 수 없을 때 자동 열림, 열림 뒤 children 렌더 | — |
  | **앱** (F7) | 잠금 안내 카드 `locked-teaser`, 레이아웃용 래퍼 `<div data-testid="locked-gate">`(style 없음), 잠금 층 children `locked-tier`, 열림 감지(`locked-tier` 마운트 시 `onUnlocked()`) | 자체 광고 트리거 버튼, `loadFullScreenAd`/`showFullScreenAd` 직접 호출, 흐림 처리 미리보기 |

  - CTA 문구는 **"광고 보고 상세 리포트 열기"**로 정한다.
    - `TossRewardAd`가 버튼 문구 prop을 받으면 이 값을 넘긴다.
    - 받지 않으면 템플릿 기본 문구를 그대로 쓰고, `TossRewardAd`를 고치지 않는다(Open Question 7).
    - `locked-teaser` 본문이 "아래 버튼"을 가리키므로, 어느 경우든 사용자가 버튼의 목적을 알 수 있다.
  - 잠금 층 상태 (①③의 `locked-gate` 안 버튼 동작은 Assumption 11(a)(c)에 기댄 **잠정** 내용이다. OQ7 확인 전까지 AC-9(P0)는 이 열을 검증하지 않는다):

    | 상태 | 조건 | `locked-gate` 안 (TossRewardAd) | 앱 렌더 |
    |---|---|---|---|
    | ① 잠금·광고 준비됨 (프로덕션 기본) | slot ID 설정, 광고 로드 성공, 보상 전 | (잠정) 게이트 트리거 버튼 1개. 탭하면 `showFullScreenAd` 호출 | `locked-teaser` 표시. `locked-tier`는 DOM에 없음 |
    | ② 잠금·광고 로드 중 | 로드 대기 | 템플릿 기본 상태 그대로 | `locked-teaser` 표시 |
    | ③ 보상 없이 닫힘 | 사용자가 시청 도중 광고를 닫음 | (잠정) 게이트 트리거 버튼이 다시 활성(①로 복귀) | `locked-teaser` 유지. Toast 없음 |
    | ④ 열림 | 보상 완료 또는 자동 열림(slot ID 미설정·로드 실패·타임아웃) | children(`locked-tier`) 렌더 | `locked-tier` 마운트 → `onUnlocked()` → `locked-teaser` 제거, `logImpression('result_locked_tier')` 1회 |

- **Screen: 변환 결과 — `/result`**
  - 골격: `ScreenScaffold` + `Top` "변환 완료". partial일 때 부제 "일부 파일은 변환하지 못했어요"
  - **무료 층** `data-testid="free-tier"` (TossRewardAd **바깥**):
    - `Card` `data-testid="result-summary"`: `SummaryHero`(CountUp value, 위 표 기준, 강조 타이포 t2), 보조 텍스트 "7.0MB → 4.0MB"
    - `Card` "결과 파일": 출력마다 `ListRow` `data-testid="output-row"`
      - 좌측: 이미지 결과는 48×48 썸네일(`<img src={objectUrl} loading="lazy">`), PDF 결과는 `Asset.ContentIcon`
      - 제목: fileName
      - 부제: "3.0MB → 498KB". note가 있으면 "이미 목표 용량 이하예요" 또는 "목표 용량까지 줄이지 못했어요 (최소 612KB)"
      - 우측: TDS `Button` "저장"(저장 후 "저장됨")
    - (failures ≥ 1일 때) `Card` `data-testid="failed-list"`
      - 제목: "변환하지 못한 파일 N개"
      - 항목: 실패마다 `ListRow` `data-testid="failed-row"`. React key는 `failure.id`
      - 행 제목: 기본은 `fileName`. 이 job의 failures 안에 같은 `fileName`이 2개 이상이면 그 행들의 제목을 `` `${fileName} (${inputIndex + 1}번째 파일)` ``로 표시한다
      - 행 부제: `message`
  - `AdSlot` `data-testid="ad-slot-mid"`: 무료 층과 잠금 층 **사이**
  - **잠금 안내** `data-testid="locked-teaser"` (앱이 만든다. TossRewardAd **바깥**, `locked-gate` 바로 위. 상태 ①②③에서만 렌더):
    - `Card` 안 `Paragraph.Text` 제목: outputs ≥ 2면 "파일별 상세 리포트 · 모두 저장", outputs 1개면 "파일별 상세 리포트"
    - `Paragraph.Text` 본문
      - outputs ≥ 2: "아래 버튼으로 짧은 광고를 보면 파일마다 줄어든 용량과 해상도를 확인하고, 결과 파일을 한 번에 저장할 수 있어요"
      - outputs 1개: "아래 버튼으로 짧은 광고를 보면 파일마다 줄어든 용량과 해상도를 확인할 수 있어요"
    - 결과 수치, 파일명, MiniBar, 흐림 처리 미리보기는 넣지 않는다
  - **게이트 래퍼** `<div data-testid="locked-gate">` 안에 `<TossRewardAd slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID}>`
    - (잠정·OQ7) 상태 ①②③에서는 TossRewardAd의 게이트 트리거 버튼이 이 안, `locked-teaser` 바로 아래, `ad-slot-bottom` 위에 놓인다. hit area는 44×44px 이상
    - 상태 ①②③에서 `locked-gate` 안에는 MiniBar, "총 소요 시간", "모두 저장" 요소가 없다
  - **잠금 층** `data-testid="locked-tier"` (`<TossRewardAd>`의 **자식**, 상태 ④에서만 존재):
    - `Card` "파일별 상세 리포트": 출력마다 `ListRow`
      - 원본 크기 → 결과 크기, 변화율 "−84%"
      - `MiniBar`(결과/원본 비율)
      - 이미지는 해상도 "4032×3024 → 3226×2419", PDF는 "5페이지"
    - `Paragraph.Text` "총 소요 시간 2.4초 · 원본 7.0MB → 결과 4.0MB"
    - (outputs ≥ 2일 때) `Button display="block"` "모두 저장 (3개)"
    - 마운트 시 `onUnlocked()`를 1회 호출한다
  - **코드 구조 규칙:** 무료 층과 `locked-teaser`는 `<TossRewardAd>` 바깥에 둔다. 잠금 층만 그 자식이다. 화면 전체를 감싸지 않는다.
  - `AdSlot` `data-testid="ad-slot-bottom"`: 잠금 층 아래, 스크롤 콘텐츠 맨 끝. 두 배너 모두 `adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID}`를 쓰고, 어떤 카드와도 겹치지 않는다
  - `SubmitFooter`: 1차 "다른 파일 변환하기", 보조 Button "공유하기"
  - Loading: jobStore 조회는 동기라 로딩 상태가 없다. 저장 중에는 해당 행 Button이 `loading`
  - Empty/Error: job이 없으면 `Asset.ContentIcon` + `Paragraph.Text` "변환 결과가 만료됐어요" + "처음으로" Button만 렌더한다. 광고·게이트·`locked-teaser`는 렌더하지 않는다
  - 목록 스크롤: 출력 최대 50행, 문서 스크롤, 썸네일 `loading="lazy"`
  - Touch: 저장 버튼 hit area 44×44px
  - Navigation
    - Incoming: `location.state as ResultRouteState | null`. `{ jobId: string }`이고 jobStore에 존재해야 유효
      - `historySaveFailed === true`이고 job이 유효하면, 마운트 시 Toast "이력을 저장하지 못했어요. 변환 파일은 그대로 저장할 수 있어요"를 1회 표시한다
      - 그 직후 `navigate(location.pathname, { replace: true, state: { jobId } })`로 플래그를 제거한다. 뒤로가기나 재렌더로 Toast가 다시 뜨지 않게 하기 위해서다
    - Outgoing:
      - "다른 파일 변환하기" → `navigate(TOOL_ROUTES[job.tool])`(state 없음)
      - "처음으로" → `navigate('/', { replace: true })`
  - Instrumentation:
    - 저장 → `logClick('result_save_file')`
    - 모두 저장 → `logClick('result_save_all')`
    - 공유하기 → `logClick('result_share')` 후 `shareApp()`
    - 다른 파일 변환하기 → `logClick('result_convert_again')`
    - 유효한 job 렌더 시 `logImpression('result_free_tier')` 1회
    - 잠금 층 렌더 시(상태 ④ 진입) `logImpression('result_locked_tier')` 1회
    - 첫 저장 성공 직후 `requestReviewOnce()`
- **잠정 AC 규칙 (`[잠정·OQ7]`):**
  - 대상: AC-10, AC-13. 둘 다 `TossRewardAd`의 확인되지 않은 동작에 기댄다. AC-13은 Assumption 11(a) 자체 트리거 버튼, AC-10은 11(c) 보상 없이 닫힌 뒤 버튼 재표시다.
  - 우선순위는 P1로 둔다. Open Question 7이 해소되기 전까지 **릴리스 차단 조건이 아니다**.
  - 테스트는 작성한다. 테스트 이름에 `[provisional:OQ7]`을 붙이고, 실패하면 릴리스를 막는 대신 OQ7 해소 작업으로 넘긴다.
  - OQ7을 확인한 뒤:
    - 가정과 같으면 `[잠정·OQ7]` 표기를 지우고 우선순위를 다시 정한다. AC-13은 P0 승격 후보다.
    - 가정과 다르면 AC 문구를 템플릿 실제 동작에 맞게 고친 뒤 우선순위를 정한다.
  - AC-9(P0)는 앱이 만드는 요소(`locked-teaser`, `locked-gate` 배치, `locked-tier` 부재, 무료 저장과 광고의 분리)만 검증한다. 그래서 OQ7 결과와 무관하게 지금 검증할 수 있다.
- **Requirements:**

AC-1 [U][P0]: Scenario: 무료 층은 광고와 무관하게 보인다
  Given 광고가 한 번도 뜨지 않는 환경일 때(VITE_TOSS_AD_SLOT_ID 미설정·광고 로드 실패·타임아웃. 템플릿 TossRewardAd는 이때 게이트를 자동으로 연다)
  When 사용자가 heic job(outputs `IMG_0001.jpg`, `IMG_0002.jpg`, `IMG_0003.jpg`)의 jobId로 `/result`에 진입
  Then `data-testid="free-tier"` 안의 SummaryHero에 값 `3`, 단위 "개", 라벨 "변환 완료"가 표시된다
  And `data-testid="output-row"` 3개가 각각 "저장" Button을 가진다
  And 저장 버튼으로 3개 파일을 모두 저장할 수 있어 PRD 목표("HEIC→JPG 변환 후 저장")가 달성된다

AC-2 [E][P1]: Scenario: 더 깊은 층은 게이트 뒤에 있다
  Given `/result`의 `data-testid="locked-tier"` 영역이 TossRewardAd의 자식으로 렌더될 때
  When 광고 시청이 끝나거나, 광고를 띄울 수 없어 게이트가 자동으로 열림
  Then `data-testid="locked-tier"` 안에 "파일별 상세 리포트" 행 3개가 표시된다(각 "2.1MB → 1.3MB · −38%" 형식과 MiniBar)
  And "총 소요 시간 N.N초"와 "모두 저장 (3개)" Button이 표시된다
  And `data-testid="locked-teaser"` 요소는 존재하지 않는다
  And "모두 저장"을 탭하면 deliverFile이 3회 순차 호출되고(호출 간격 ≥ 300ms), Toast "3개 파일을 저장했어요"가 표시된다

AC-3 [E][P0]: Scenario: 파일 1개 저장 성공
  Given `/result`에 `IMG_0001.jpg`(image/jpeg) 행이 있을 때
  When 그 행의 "저장" 탭
  Then `saveBase64Data`가 `{ fileName: 'IMG_0001.jpg', mimeType: 'image/jpeg', data: <base64> }`로 1회 호출된다
  And 성공하면 Toast "사진을 저장했어요"가 표시되고(PDF는 "파일을 저장했어요"), 버튼 라벨이 "저장됨"으로 바뀐다
  And 이 화면 세션의 첫 성공이면 `requestReviewOnce`가 1회 호출된다

AC-4 [W][P1]: Scenario: 저장 실패
  Given `saveBase64Data`가 reject하고 앵커 대체 경로의 `click`도 throw할 때
  When "저장" 탭
  Then Toast "저장에 실패했어요. 다시 시도해주세요"가 표시된다
  And 버튼 라벨은 "저장"을 유지하고, `requestReviewOnce`는 호출되지 않는다
  And "모두 저장" 중 1개가 실패하면 Toast는 "2개 저장, 1개 실패"

AC-5 [W][P1]: Scenario: 결과가 없거나 만료된 진입
  Given `location.state`가 null이거나 `{ jobId: 'expired-1' }`(jobStore에 없음)일 때
  When `/result`에 진입
  Then `Asset.ContentIcon`, "변환 결과가 만료됐어요", "처음으로" Button만 렌더된다
  And `data-testid="free-tier"`, `locked-teaser`, `locked-gate`, `locked-tier`, `ad-slot-mid`, `ad-slot-bottom` 요소는 존재하지 않는다
  And "처음으로"를 탭하면 `navigate('/', { replace: true })`가 호출된다

AC-6 [U][P1]: Scenario: 결과 레이아웃과 광고 배치
  Given 광고를 띄울 수 없어 게이트가 자동으로 열린 환경(AC-1과 같음)에서 compress job(inTotal 3,145,728B, outTotal 509,952B)과 failures 1개로 `/result`에 진입했을 때
  Then `data-testid="result-summary"` Card 안 SummaryHero 값은 `84`, 단위는 "%"
  And `data-testid="failed-list"` Card의 제목은 "변환하지 못한 파일 1개"
  And DOM 순서는 free-tier → ad-slot-mid → locked-tier → ad-slot-bottom
  And ad-slot-mid·ad-slot-bottom은 free-tier의 자손이 아니다

AC-7 [E][P1]: Scenario: 공유와 재변환
  Given 유효한 pdf-merge job으로 `/result`에 있을 때
  When "공유하기" 탭
  Then `logClick('result_share')` 다음에 `shareApp()`이 1회 호출된다
  And "다른 파일 변환하기"를 탭하면 `navigate('/pdf/merge')`가 호출된다

AC-8 [W][P0]: Scenario: 검수 — 색상 하드코딩·콘솔 에러·외부 이탈 금지
  Given 프로덕션 소스(`src/**/*.{ts,tsx,css}`)와 결과 화면 렌더 테스트가 있을 때
  Then CSS·style 속성에 `/#[0-9a-fA-F]{3,8}\b/` 패턴이 0건이고, 색상은 `var(--tds-color-*)`만 쓴다
  And AC-1~AC-7, AC-9, AC-11, AC-12 테스트 실행 중 `console.error` 호출은 0회. 잠정 AC(AC-10, AC-13)도 같은 조건을 검증하되, 잠정 AC 규칙에 따라 릴리스를 막지 않는다
  And 소스에 `window.open(`과 `http(s)://`로 시작하는 `location.href =` 대입이 0건

AC-9 [E][P0]: Scenario: 잠금 상태 — 앱이 만드는 요소 (템플릿 버튼 동작과 무관)
  Given `VITE_TOSS_AD_SLOT_ID='test-slot'`으로 설정했을 때
  And `@apps-in-toss/web-framework`의 `loadFullScreenAd`는 로드 성공을 알리도록, `showFullScreenAd`는 호출되면 테스트가 결과를 알릴 때까지 대기하도록 mock했고, 테스트는 보상 완료를 알리지 않을 때
  When heic job(outputs `IMG_0001.jpg`, `IMG_0002.jpg`, `IMG_0003.jpg`)의 jobId로 `/result`에 진입
  Then `data-testid="locked-tier"` 요소는 존재하지 않는다
  And `data-testid="locked-gate"` 안에 MiniBar 요소 0개, "총 소요 시간" 텍스트 0건, "모두 저장 (3개)" 텍스트 0건
  And `data-testid="locked-teaser"`에 제목 "파일별 상세 리포트 · 모두 저장"과 본문 "아래 버튼으로 짧은 광고를 보면 파일마다 줄어든 용량과 해상도를 확인하고, 결과 파일을 한 번에 저장할 수 있어요"가 표시된다
  And `data-testid="locked-teaser"`는 `locked-gate`의 자손이 아니다(TossRewardAd 바깥)
  And DOM 순서는 free-tier → ad-slot-mid → locked-teaser → locked-gate → ad-slot-bottom
  And `logImpression('result_locked_tier')` 호출은 0회
  When free-tier의 `IMG_0001.jpg` 행 "저장"을 탭
  Then `saveBase64Data`는 1회 호출된다
  And 탭 직전과 직후의 `showFullScreenAd` 누적 호출 횟수가 같다(무료 저장은 광고와 무관)
  And 이 AC는 `locked-gate` 안의 button 개수·크기·탭 동작을 검증하지 않는다(AC-13 담당)

AC-10 [W][P1][잠정·OQ7]: Scenario: 보상 없이 광고를 닫음
  Given AC-13 환경에서 `locked-gate` 안의 button을 탭해 `showFullScreenAd`가 1회 호출됐을 때
  When mock이 보상 없이 광고 닫힘을 알림
  Then `data-testid="locked-tier"` 요소는 존재하지 않고, `data-testid="locked-teaser"`는 그대로 표시된다
  And `locked-gate` 안의 button 1개가 enabled 상태로 다시 표시된다
  And Toast는 표시되지 않고, free-tier의 `output-row` 3개 "저장" Button은 모두 enabled다
  And button을 다시 탭하면 `showFullScreenAd` 누적 호출은 2회

AC-11 [W][P1]: Scenario: 같은 이름 파일의 실패 표시
  Given compress job의 inputs가 `[photo.jpg, other.jpg, photo.jpg]`이고, 다음 조건일 때
    - failures: `[{ id: 'f-a', inputIndex: 0, fileName: 'photo.jpg', message: '파일을 읽을 수 없어요. 다른 파일을 선택해주세요' }, { id: 'f-b', inputIndex: 2, fileName: 'photo.jpg', message: '변환 시간이 너무 오래 걸려서 중단했어요' }]`
    - outputs: `other_compressed.jpg` 1개
  When `/result`에 진입
  Then `data-testid="failed-list"` 제목은 "변환하지 못한 파일 2개"
  And `data-testid="failed-row"` 2개의 제목은 순서대로 "photo.jpg (1번째 파일)", "photo.jpg (3번째 파일)"이고, 부제는 각 message
  And 렌더 중 `console.error`(React 중복 key 경고 포함) 호출은 0회
  And failures가 `[{ id: 'f-c', inputIndex: 1, fileName: 'other.jpg', ... }]` 1개뿐이면 행 제목은 "other.jpg"(번째 표기 없음)

AC-12 [W][P1]: Scenario: 이력 저장 실패 알림은 결과 화면에서 1회
  Given jobStore에 유효한 heic job이 있을 때
  When `location.state = { jobId, historySaveFailed: true }`로 `/result`에 진입
  Then Toast "이력을 저장하지 못했어요. 변환 파일은 그대로 저장할 수 있어요"가 1회 표시된다
  And `navigate('/result', { replace: true, state: { jobId } })`가 1회 호출된다
  And 무료 층 `output-row`의 "저장" Button은 enabled다
  And `location.state = { jobId }`(플래그 없음)로 진입하면 이 Toast는 0회
  And `location.state = { jobId: 'expired-1', historySaveFailed: true }`(job 없음)면 만료 화면만 렌더되고 이 Toast는 0회

AC-13 [E][P1][잠정·OQ7]: Scenario: 게이트 트리거 버튼으로 광고 시청 후 열림
  Given AC-9와 같은 환경(`VITE_TOSS_AD_SLOT_ID='test-slot'`, 로드 성공 mock, 대기형 `showFullScreenAd` mock)에서 heic job(outputs 3개)으로 `/result`에 진입했을 때
  Then `data-testid="locked-gate"` 안에 button 요소가 정확히 1개 있고, 그 `getBoundingClientRect()` 너비·높이는 각각 44 이상
  When `locked-gate` 안의 button을 탭
  Then `showFullScreenAd`가 1회 호출된다
  When mock이 보상 완료를 알림
  Then `data-testid="locked-tier"`가 렌더되고, "파일별 상세 리포트" 행 3개와 "모두 저장 (3개)" Button이 표시된다
  And `data-testid="locked-teaser"` 요소는 존재하지 않는다
  And `logImpression('result_locked_tier')`는 1회 호출된다

- **Packets (예상 3):**
  - P7-a: deliverFile + 무료 층(요약·저장·실패 목록(id key·중복 이름 표기)·만료 상태)
  - P7-b: 잠금 안내 `locked-teaser` + 게이트 래퍼 + 잠금 층(상세 리포트·모두 저장) + 상태 ①~④ 테스트(AC-2, AC-9 P0, AC-10·AC-13 잠정)
  - P7-c: AdSlot 2개 + 공유·리뷰·계측 + 이력 저장 실패 Toast(AC-12)

---

### F8. 홈 & 변환 이력
- **Description:** 홈(`/`)과 이력(`/history`) 두 화면이다.
  - 홈은 5개 도구를 ListRow로 보여주는 시작점이다.
  - 이력은 localStorage의 변환 기록을 최신순으로 보여준다.
  - 두 화면은 FloatingTabBar(변환 / 이력)로 오간다.
  - 이력 항목을 탭하면 상세 BottomSheet가 열리고, 같은 도구로 다시 갈 수 있다.
  - 앱은 변환 파일을 보관하지 않는다는 점을 안내한다.
- **Data:** HistoryEntry
- **API:** 없음
- **Screen: 홈 — `/`**
  - TDS 구성:
    - `Top` "파일 변환"
    - `Paragraph.Text` "파일은 기기 안에서만 변환돼요. 서버로 올라가지 않아요."
    - `ListRow` 5개(toolMeta 순서: heic, compress, pdf-merge, pdf-to-image, pdf-split). 제목·부제는 toolMeta 표 기준, 좌측 `Asset.ContentIcon`, 우측 화살표
    - `FloatingTabBar`(변환 활성)
  - Loading/Empty/Error: 정적 목록이라 해당 없음
  - Touch: ListRow 전체 높이 56px 이상
  - Navigation
    - Outgoing: 도구 ListRow → `navigate(TOOL_ROUTES[tool])`(state 없음)
    - Incoming: 없음
  - Instrumentation: `logClick('tool_select_heic' | 'tool_select_compress' | 'tool_select_pdf_merge' | 'tool_select_pdf_to_image' | 'tool_select_pdf_split')`
- **Screen: 변환 이력 — `/history`**
  - TDS 구성:
    - `Top` "변환 이력", 우측 텍스트 Button "전체 삭제"(이력이 1개 이상일 때만)
    - `Card` `data-testid="history-summary"`: `SummaryHero`(총 변환 파일 수 = Σ outputCount, 단위 "개"). 최근 7일 중 기록이 있는 날이 2일 이상이면 일별 outputCount `Sparkline`
    - 이력마다 `ListRow` `data-testid="history-row"`(텍스트 전용, 이미지 없음)
    - `FloatingTabBar`(이력 활성)
  - 상세: `BottomSheet`
    - 원본 파일명 목록: `inputNames`를 순서대로 표시한다. `inputCount > inputNames.length`면 목록 끝에 "외 {inputCount − inputNames.length}개"를 붙인다
    - 결과 파일명 목록: `outputNames`와 `outputCount`에 같은 규칙을 적용한다
    - 안내 `Paragraph.Text`
    - `Button display="block"` "같은 도구로 다시 변환"
  - 삭제 확인: `AlertDialog`
  - Loading: localStorage 동기 읽기라 해당 없음
  - Empty: `Asset.ContentIcon` + "아직 변환한 파일이 없어요" + Button "파일 변환하러 가기"
  - Error: 손상 데이터는 Empty로 처리
  - **목록 조회·스크롤 방식 (페이지네이션을 두지 않는 결정):**
    - `/history`는 `{ items, total, page }` 형태의 목록 계약을 두지 않는다. 마운트 시 `historyRepo.load()`를 1회 호출해 `HistoryEntry[]` 전체(최대 100개)를 동기로 읽는다. 합계와 Sparkline도 이 배열 하나에서 계산한다(`useMemo`).
    - 페이지네이션·무한 스크롤·가상 스크롤은 MVP 범위 밖이다. 근거는 다음과 같다.
      1. 데이터가 기기 localStorage에만 있어 서버 왕복 비용이 없다.
      2. 개수 상한이 100개로 고정되어 있다(F1 AC-2).
      3. 전체 크기가 약 130KB라 `JSON.parse` 1회로 끝난다.
      4. 행이 이미지 없는 텍스트 `ListRow`라 DOM이 최대 100행에 그친다.
    - 이 결정의 한계: 저사양 Android WebView에서 100행 초기 렌더의 체감 지연은 실기기로 검증하지 않았다(Assumption 12, Open Question 8). 상한(100)을 올리거나 행에 이미지를 넣으면 이 결정을 다시 검토한다.
    - 문서 스크롤을 쓰고, FloatingTabBar 높이만큼 하단 `Spacing`을 확보한다.
  - Touch: ListRow 56px 이상, "전체 삭제" hit area 44px 이상
  - Navigation
    - Outgoing: "같은 도구로 다시 변환" → `navigate(TOOL_ROUTES[entry.tool])`, "파일 변환하러 가기" → `navigate('/')`
    - Incoming: 없음
  - Instrumentation: "같은 도구로 다시 변환" → `logClick('history_rerun')`
- **Requirements:**

AC-1 [E][P0]: Scenario: 홈에서 도구 선택
  Given `/`에 진입했을 때
  Then ListRow 5개가 "HEIC → JPG/PNG", "이미지 용량 줄이기", "PDF 합치기", "PDF → 이미지", "PDF 나누기" 순서로 표시된다
  When "HEIC → JPG/PNG" 행을 탭
  Then `logClick('tool_select_heic')`가 호출되고, `navigate('/convert/heic')`가 호출된다

AC-2 [E][P0]: Scenario: 이력 목록 표시
  Given localStorage에 이력 2개가 있을 때
    - `{ tool: 'heic', createdAt: '2026-09-24T05:30:00.000Z', inputCount: 3, inputTotalBytes: 7340032, outputTotalBytes: 4194304 }`
    - 그보다 이전 항목 1개
  When 로컬 타임존 Asia/Seoul에서 `/history`에 진입
  Then `data-testid="history-row"` 2개가 최신순으로 표시된다
  And 첫 행의 제목은 "HEIC → JPG/PNG · 파일 3개", 부제는 "2026.09.24 14:30 · 7.0MB → 4.0MB"
  And status가 'partial'인 행의 부제 끝에는 " · 실패 1개"가 붙는다

AC-3 [S][P1]: Scenario: 이력 빈 상태
  Given 이력이 0개일 때
  Then `Asset.ContentIcon`, "아직 변환한 파일이 없어요", "파일 변환하러 가기" Button이 표시된다
  And "전체 삭제" 버튼과 `data-testid="history-summary"`는 렌더되지 않는다
  And "파일 변환하러 가기"를 탭하면 `navigate('/')`가 호출된다

AC-4 [E][P1]: Scenario: 이력 상세와 재변환
  Given pdf-merge 이력 행이 있을 때
  When 그 행을 탭
  Then BottomSheet에 원본 파일명 목록, 결과 파일명 목록, 안내 문구 "앱은 변환한 파일을 보관하지 않아요. 저장한 파일은 사진 앱 또는 파일 앱에서 확인해주세요"가 표시된다
  And "같은 도구로 다시 변환"을 탭하면 `logClick('history_rerun')`과 `navigate('/pdf/merge')`가 호출된다

AC-5 [E][P1]: Scenario: 전체 삭제
  Given 이력이 3개 있을 때
  When "전체 삭제" 탭
  Then AlertDialog "변환 이력을 모두 삭제할까요?"가 "삭제"/"취소" 버튼과 함께 표시된다
  And "삭제"를 탭하면 localStorage `fileconvertkr:history:v1`는 null이 되고 빈 상태가 표시된다
  And "취소"를 탭하면 3개 행이 그대로 남는다

AC-6 [W][P1]: Scenario: 손상된 이력 데이터
  Given localStorage `fileconvertkr:history:v1` 값이 `'{broken'`일 때
  When `/history`에 진입
  Then AC-3의 빈 상태가 표시되고, 에러 바운더리 화면은 나타나지 않는다
  And `console.error` 호출은 0회

AC-7 [W][P0]: Scenario: 검수 — 앱 설치 유도·외부 링크·외부 로깅 금지
  Given `/`와 `/history`를 렌더했을 때
  Then 화면 텍스트에 "설치", "다운로드", "App Store", "Play 스토어"가 0건
  And `href`가 `http://` 또는 `https://`로 시작하는 `<a>` 요소가 0개
  And `package.json` 의존성과 소스에 `gtag`, `analytics`, `amplitude`, `mixpanel`, `firebase` 문자열이 0건

AC-8 [U][P2]: Scenario: 이력 요약 시각화
  Given 최근 7일 중 2일에 각각 outputCount 합계 3, 5인 이력이 있을 때
  When `/history`에 진입
  Then `data-testid="history-summary"` Card의 SummaryHero 값은 `8`, 단위는 "개"
  And 길이 7(기록 없는 날은 0)의 Sparkline이 렌더된다
  And 기록이 있는 날이 1일뿐이면 Sparkline은 렌더되지 않는다

AC-9 [E][P1]: Scenario: 잘린 파일명 목록 표시
  Given `historyRepo.append`로 저장한 heic 이력이 1개 있을 때
    - `inputCount: 7`, `inputNames: ['f1.heic','f2.heic','f3.heic','f4.heic','f5.heic']`
    - `outputCount: 1`, `outputNames: ['a'.repeat(39) + '…']`
  When 그 행을 탭해 BottomSheet를 연다
  Then 원본 파일명 목록에 `f1.heic`~`f5.heic` 5개가 순서대로 표시되고, 그 뒤에 "외 2개"가 표시된다
  And 결과 파일명 목록에는 `'a'.repeat(39) + '…'` 1개만 표시되고, "외 N개" 텍스트는 0건

AC-10 [U][P2]: Scenario: 최대 100개 이력 렌더 (페이지네이션 없음)
  Given localStorage에 이력 100개(모두 heic, 최신 id `'e-0'` ~ 가장 오래된 id `'e-99'`)가 있고, `localStorage.getItem`을 spy로 감쌌을 때
  When `/history`에 진입
  Then `data-testid="history-row"`는 정확히 100개이고, 마지막 행은 id `'e-99'` 항목이다
  And `'fileconvertkr:history:v1'` 키에 대한 `getItem` 호출은 마운트당 1회
  And 이력 목록 영역 안의 `<img>` 요소는 0개
  And "더 보기" 버튼이나 페이지 번호 같은 페이지 이동 컨트롤은 0개
  And 마지막 `history-row` 뒤, FloatingTabBar 앞에 하단 `Spacing` 요소가 있다
  And 렌더 중 `console.error` 호출은 0회

- **Packets (예상 2):**
  - P8-a: 홈 + FloatingTabBar 라우팅
  - P8-b: 이력 목록·상세("외 N개")·삭제·요약·100행 테스트

---

## Assumptions
1. **파일 저장 경로:** `saveBase64Data`가 `@apps-in-toss/web-framework`에 있고 토스 WebView에서 기기 저장을 지원한다고 가정한다. 사진 앨범에 들어가는지 파일 앱에 들어가는지는 확인되지 않았다(Open Question 1). 동작하지 않는 환경을 대비해 `<a download>` 대체 경로를 둔다.
2. **파일 선택:** 토스 WebView에서 `<input type="file" multiple accept=...>`가 사진 보관함과 파일 앱 선택을 모두 지원한다고 가정한다.
3. **처리 한도:** 파일당 30MB, 합계 100MB, PDF 이미지 50페이지, 분할 결과 50개, 파일당 타임아웃 60초는 모바일 WebView 메모리를 고려해 설계에서 정한 값이다. PRD에 근거가 있는 값은 아니며, 실기기 테스트 후 조정할 수 있다.
4. **HEIC 옵션:** JPG 품질 0.92는 설계 기본값이다. 사용자 조절 UI는 두지 않는다.
5. **투명 배경:** PNG/WEBP를 JPG로 압축하면 투명 영역은 흰색으로 채워진다. 이미 목표 이하라서 재인코딩하지 않은 PNG/WEBP는 원본 형식을 유지하므로 투명 영역도 유지된다.
6. **메타데이터:** 캔버스로 다시 인코딩하므로 결과 이미지에 EXIF 메타데이터가 포함되지 않는다고 가정한다. 이 내용을 UI 문구로 홍보하지는 않는다.
7. **이력 보관 범위:** 이력은 메타데이터만 보관한다. 이력에서 변환 파일을 다시 저장할 수는 없다(용량 제약). 이 점은 BottomSheet 안내 문구로 고지한다.
8. **계측 기준:** PRD에 Core Flow [전환] 표기가 없다. 그래서 "도구 선택 → 변환 실행 → 저장"을 전환 퍼널로 보고 계측 지점을 정했다. 템플릿이 제공한다고 가정하는 것은 다음과 같다.
   - 계측·공유·리뷰: `logClick`, `logImpression`, `shareApp`, `requestReviewOnce`
   - 화면 구성: `ScreenScaffold`/`PageShell`, `SubmitFooter`, `SummaryHero`, `MiniBar`, `Sparkline`
   - 광고: `AdSlot`(배너), `TossRewardAd`(리워드 게이트)
9. **생성형 AI:** 쓰지 않으므로 AI 고지 AC는 적용하지 않는다.
10. **프로모션:** PRD에 없어서 `grantPromotionReward`는 쓰지 않는다. 쓰지 않으므로 5,000원 한도 검증 AC도 해당 없다.
11. **TossRewardAd 동작:** 템플릿 `TossRewardAd`는 `loadFullScreenAd`/`showFullScreenAd`를 감싼 게이트이며, 다음과 같이 동작한다고 가정한다.
    - (a) 잠금 상태에서 자체 트리거 버튼을 렌더하고, 탭하면 광고를 띄운다
    - (b) 보상 완료 뒤에만 children을 렌더한다
    - (c) 보상 없이 닫히면 잠금 상태로 돌아가 버튼을 다시 보여준다
    - (d) slot ID 미설정·로드 실패·타임아웃이면 게이트를 자동으로 연다

    앱은 이 컴포넌트를 재설계하거나 수정하지 않는다. slot ID는 빌드 시점에 주입되므로(`import.meta.env.VITE_TOSS_AD_SLOT_ID`) 값이 바뀌면 재빌드·재배포가 필요하다. (a)~(c)는 템플릿 코드로 확인이 필요하다(Open Question 7). 이 SPEC 작성 환경에서는 템플릿 소스를 확인할 수 없었다. 그래서 (a)(c)에 기대는 F7 AC-10·AC-13은 `[잠정·OQ7]`(P1, 릴리스 비차단)으로 두고, P0인 AC-9는 앱이 만드는 요소만 검증하도록 범위를 좁혔다.
12. **이력 페이지네이션 미적용:** 이력은 기기 안 localStorage에만 있고 상한이 100개(약 130KB)라, 페이지 단위 조회 없이 전체를 한 번에 읽어 문서 스크롤로 보여줘도 된다고 가정한다. 저사양 WebView에서의 100행 렌더 성능은 실기기로 확인하지 않았다(Open Question 8).

## Open Questions
1. **저장 위치:** `saveBase64Data`로 저장한 JPG가 iOS·Android에서 사진 앱에 들어가는가, 파일 앱에 들어가는가? 결과에 따라 Toast 문구("사진을 저장했어요")와 이력 안내 문구를 확정해야 한다.
2. **iOS 자동 변환:** iOS에서 사진 보관함의 HEIC를 고르면 WebView가 JPEG로 자동 변환해 넘겨줄 수 있다. 이 경우 HEIC 도구에 `b.jpg`가 들어와 AC-5 오류("HEIC 파일만 선택할 수 있어요")가 난다.
   - 선택지 (a): 이미 JPG인 파일을 "이미 호환 형식"으로 결과에 그대로 포함한다.
   - 선택지 (b): 현재처럼 거부한다.
   - 실기기 확인 후 결정이 필요하다.
3. **PRD와 다르게 설계한 수익화:** PRD는 "배치 변환(여러 파일 동시)·워터마크 제거를 리워드 광고로 해제"라고 적었지만, 이 SPEC은 아래처럼 바꿨다.
   - **배치 입력:** 여러 파일 선택은 무료로 둔다. 입력 폼을 잠그는 것은 금지이기 때문이다. 대신 결과 화면 잠금 층에 "모두 저장"과 상세 리포트를 둔다. 무료 층의 파일별 저장만으로도 목적이 달성된다.
   - **워터마크:** 무료 결과에 워터마크를 넣으면 제출용 파일(핵심 답)이 훼손된다. 게다가 슬롯 ID가 없는 현재 빌드에서는 게이트가 자동으로 열려 의미도 없다. 그래서 MVP에서는 워터마크를 넣지 않는다.
   - 이 변경을 승인하는지 확인이 필요하다.
4. **PDF 압축:** One-liner에는 "PDF 합치기·압축"이 있지만 Core Features에는 PDF 압축이 없다. 이 SPEC은 Core Features 기준으로 이미지 압축만 포함했다. PDF 압축을 추가할지 결정이 필요하다. pdf-lib만으로는 이미지 재압축이 제한적이라 별도 기능(F9)이 된다.
5. **배너 위치:** PRD는 결과 화면 "상하단" 배너를 요구한다. 이 SPEC은 콘텐츠를 가리지 않도록 "무료 층과 잠금 층 사이"와 "콘텐츠 맨 끝"에 배치했다. 결과 위(Top 바로 아래) 배치를 원하는지 확인이 필요하다.
6. **HEIC 부가 이미지:** 연속 촬영이나 라이브 포토처럼 이미지가 여러 개 들어 있는 HEIC는 첫 이미지만 변환한다(`heic2any` `multiple: false`). 모든 프레임 추출이 필요한가?
7. **TossRewardAd 잠금 상태 UI 확인 (F7 AC-10·AC-13 잠정 해제 조건):** 템플릿 코드를 열어 아래를 확인해야 한다.
   - (a) 잠금 상태에서 트리거 버튼을 자체 렌더하는가? 광고를 마운트 즉시 자동으로 띄우는 방식이면 F7 상태 ①의 버튼 전제와 AC-13이 바뀐다.
   - (b) 버튼 문구 prop이 있는가? 있으면 "광고 보고 상세 리포트 열기"를 넘긴다.
   - (c) 광고 로드 중 상태를 어떻게 표시하는가?
   - (d) 보상 없이 닫힐 때 버튼을 다시 보여주는가?

   확인 후 처리는 다음과 같다.
   - (a)(d)가 가정과 같으면 AC-10·AC-13의 `[잠정·OQ7]` 표기를 지우고 우선순위를 다시 정한다(AC-13은 P0 승격 후보).
   - 가정과 다르면 AC-10·AC-13을 템플릿 동작에 맞게 고치고, 필요하면 템플릿 담당자와 게이트 UI 확장 여부를 논의한다.
   - AC-9(P0)는 앱이 만드는 요소만 검증하므로 이 확인 결과와 무관하게 유지된다.
8. **이력 100행 실기기 성능:** 저사양 Android WebView에서 `/history` 100행의 초기 렌더와 스크롤이 체감상 끊기는가? 끊긴다면 20개 단위 "더 보기"(TDS `Button`) 도입을 후속 작업으로 검토한다.

---

The claude.ai Canva connector still needs to be authorized in your claude.ai connector settings before it can be used. I didn't need it for this.