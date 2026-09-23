# Sprint Contract: 진입점 라우팅 배선 + 플레이스홀더 (Wiring-First)

## 상태
라우팅 스캐폴드 **완료** — src/App.tsx 8개 라우트 등록됨, 모든 페이지 파일 존재.

## 남은 작업
1. **src/lib/toolMeta.ts·routes.ts 검증**: Home.tsx가 import하는 `toolMeta`, `TOOL_ORDER`, 다른 util들이 정의되고 export되는가. 없으면 그것만 추가 (기존 시그니처 유지)
2. **src/App.test.tsx 작성** (15–20줄):
   - 8개 경로의 Top 제목 검증 (toolMeta 참조)
   - `/unknown` → 홈 리다이렉트
   - `/result` state 없음 → 타임아웃/만료 화면 (Result.tsx의 초기 상태 동작 확인)

## 타입 & Import 목록
- `ToolType`, `ConversionJob`, `ConversionOutput`, `ConversionFailure`: src/lib/types.ts ✓
- `toolMeta`, `TOOL_ORDER`: src/lib/toolMeta.ts (필요시 추가)

## 검증 방법
```bash
npx tsc --noEmit         # 타입 검사
npx vitest run          # App.test.tsx + 기존 테스트
npx vite build          # 빌드 가능성
```
dev 서버 금지 — playwright 스모크(파이프라인) 전까지 build/test로만 확인.

## 절대 금지 사항
- main.tsx 수정 금지 (@AI:ANCHOR)
- App.tsx의 전역 Provider 배선 수정 금지
- 기존 페이지 파일 덮어쓰기 금지 (플레이스홀더는 이미 존재)

## 완료 기준
- tsc, vitest, vite build **모두 통과**
- App.test.tsx가 라우팅 + state 초기화 동작 검증
- 빌드 결과물 dist/ 생성 가능
