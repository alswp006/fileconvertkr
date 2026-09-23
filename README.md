# FileConvertKR

앱인토스 (Vite + React + TDS) 아이폰 사진이 카톡에서 안 열려요? HEIC→JPG, PDF 합치기·압축 3초 변환 아이폰 HEIC 사진을 카카오톡·이메일·회사 시스템에 올리면 열리지 않거나, PDF 용량이 커서 제출이 안 되는 문제를 거의 매주 겪는다. 웹 검색으로 찾은 무료 변환 사이트는 광고가 심하거나 원본 파일을 서버에 업로드해야 해 찜찜하다.

## Tech Stack

- React 18.0.0
- TypeScript
- Vitest

## Routes

| Path | Description |
|------|-------------|
| `/Compress` | Compress |
| `/Heic` | Heic |
| `/History` | History |
| `/Home` | Home |
| `/PdfMerge` | PdfMerge |
| `/PdfSplit` | PdfSplit |
| `/PdfToImage` | PdfToImage |
| `/Result.locked.test` | Resultlockedtest |
| `/Result.test` | Resulttest |
| `/Result` | Result |

## Getting Started

```bash
pnpm install
pnpm dev
```

## Development

```bash
pnpm typecheck    # Type checking
pnpm test         # Run tests
pnpm build        # Production build
```

## Design Documents

See `.ai-factory/` directory for full design artifacts:
- `prd.md` — Product Requirements Document
- `spec.md` — Technical Specification
- `task.md` — Epic/Task Breakdown

---
Built with [AI Factory](https://github.com/alswp006/ai-factory) · Last synced: 2026-09-23
