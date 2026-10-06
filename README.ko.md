🇰🇷 [English](./README.md)

# FileConvertKR — 휴대폰에서 빠르고 안전한 파일 변환

FileConvertKR은 App-in-Toss 미니앱으로, 기기 내에서 파일을 빠르게 변환합니다. iPhone 사진을 JPG/PNG로 변환하고, 이미지를 압축하며, PDF를 병합·분할하고, PDF를 이미지로 내보낼 수 있습니다. 모든 작업이 기기 내에서 처리되므로 파일이 서버에 업로드되지 않아 안전합니다.

## 기능

- 📷 **HEIC/HEIF을 JPG/PNG로 변환** — iPhone 사진을 범용 형식으로 변환 (1회에 1~20개 파일)
- 📦 **이미지 압축** — JPG, PNG, WEBP 이미지를 원하는 크기로 감소 (1~20개 파일 지원; JPEG, PNG, WEBP, HEIC/HEIF 포맷)
- 📄 **PDF 병합** — 2~20개의 PDF 파일을 하나로 합치기
- 🖼️ **PDF를 이미지로 변환** — PDF 페이지를 JPG/PNG 이미지로 내보내기 (최대 50페이지)
- ✂️ **PDF 분할** — PDF를 페이지 또는 범위별로 나누기 (최대 50개 파일)
- 📋 **변환 이력** — 최근 변환 내역 보기 및 재변환 (최대 100개 로컬 저장)

## 기술 스택

- **프레임워크:** Vite + React 18 + TypeScript
- **UI:** @toss/tds-mobile (Toss Design System)
- **라우팅:** react-router-dom
- **변환 라이브러리:** heic2any (HEIC 디코딩), pdf-lib (PDF 작업), pdfjs-dist (PDF 렌더링)
- **저장소:** localStorage (메타데이터만 저장; 파일 내용은 브라우저 메모리에 유지)
- **스타일링:** Emotion + CSS 변수 (다크 모드 지원)

## 시작하기

### 의존성 설치

```bash
npm install
```

### 프로덕션 빌드

```bash
npx vite build
```

### App-in-Toss에 배포하기

빌드 후 앱인토스 콘솔을 통해 배포합니다:

```bash
npx ait build
npx ait deploy --api-key <YOUR_API_KEY>
```

앱은 정적 번들로 토스 CDN에 호스팅됩니다. 백엔드 서버가 필요하지 않습니다.

## 환경 변수

`.env` 파일을 만들고 (`.env.example`에서 복사) 다음 선택적 값을 입력합니다:

| 변수 | 설명 | 필수 |
|---|---|---|
| `VITE_SHARE_OG_URL` | 공유 미리보기용 Open Graph 이미지 URL (카카오톡, SMS) | 아니오 |
| `VITE_TOSS_AD_SLOT_ID` | App-in-Toss 콘솔의 리워드 광고 슬롯 ID | 아니오 |
| `VITE_TOSS_IAP_SKU` | 콘솔의 인앱 결제 SKU | 아니오 |
| `VITE_TOSS_PROMOTION_CODE` | 콘솔의 프로모션 보상 코드 | 아니오 |

값을 생략하면 해당 기능이 조용히 비활성화됩니다 (오류 없음, 기능 사용 불가).

## 프로젝트 구조

```
src/
├── components/          # TDS 래퍼 및 UI 컴포넌트
├── lib/                 # 핵심 로직 (변환, 저장소, 계측, 라우팅)
├── pages/               # 라우트 페이지 (Home, Heic, Compress, PdfMerge 등)
├── hooks/               # 커스텀 React 훅
├── styles/              # 전역 스타일
├── __tests__/           # 단위 테스트 (vitest + @testing-library/react)
├── App.tsx              # 라우트 정의
└── main.tsx             # React 진입점
```

## 배포

### 빌드

```bash
npm run build
```

프로덕션 번들이 `dist/`에 생성됩니다. 포함 사항:
- 트리 셰이킹된 개발 코드 (개발 전용 라우트 제거)
- 지연 로딩되는 변환 라이브러리 (시작 시점에 번들되지 않음)
- 외부 API 호출 없음 (모든 처리가 브라우저에서 진행)

### App-in-Toss를 통한 배포

앱인토스 파이프라인이 배포를 처리합니다:

1. **빌드:** `npx ait build`는 `dist/` 폴더를 패키징합니다
2. **배포:** `npx ait deploy`는 토스 CDN에 업로드합니다
3. **검수:** 토스 검수팀이 미니앱 가이드라인 검증 (만 19세 이상 나이 게이트, 외부 링크 없음, 콘솔 오류 0개, 다크 모드, CORS)

앱이 호스팅됩니다:
- **운영:** `https://{appName}.web.tossmini.com`
- **QR 테스트:** `https://{appName}.private-web.tossmini.com`

### 최소 플랫폼 지원

- Android 7+
- iOS 16+
- 토스 앱 v13.0 이상 필요

## 라이선스

MIT
