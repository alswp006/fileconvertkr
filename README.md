🇺🇸 [한국어](./README.ko.md)

# FileConvertKR — Fast, private file conversion on your phone

FileConvertKR is an App-in-Toss mini app that converts and transforms files directly on your device. Convert HEIC photos to JPG/PNG, compress images, merge and split PDFs, and export PDFs as images — all without uploading to a server. Your files stay on your phone.

## Features

- 📷 **HEIC/HEIF to JPG/PNG** — Convert iPhone photos to universal formats (supports 1–20 files per batch)
- 📦 **Image Compression** — Reduce JPG, PNG, or WEBP size to your target (supports JPEG, PNG, WEBP, HEIC/HEIF; 1–20 files)
- 📄 **PDF Merge** — Combine 2–20 PDFs into a single file
- 🖼️ **PDF to Image** — Export PDF pages as JPG/PNG images (up to 50 pages)
- ✂️ **PDF Split** — Divide PDFs by page or range (up to 50 output files)
- 📋 **Conversion History** — View and re-convert recent transformations (up to 100 entries stored locally)

## Tech Stack

- **Framework:** Vite + React 18 + TypeScript
- **UI:** @toss/tds-mobile (Toss Design System)
- **Routing:** react-router-dom
- **Conversion libraries:** heic2any (HEIC decode), pdf-lib (PDF ops), pdfjs-dist (PDF rendering)
- **Storage:** localStorage (metadata only; file contents stay in browser memory)
- **Styling:** Emotion + CSS variables (dark mode support)

## Getting Started

### Install dependencies

```bash
npm install
```

### Build for production

```bash
npx vite build
```

### Deployment to Toss App-in-Toss

After building, deploy via the Apps-in-Toss console using:

```bash
npx ait build
npx ait deploy --api-key <YOUR_API_KEY>
```

The app is deployed as a static bundle to the Toss CDN. No backend server required.

## Environment Variables

Create a `.env` file (copy from `.env.example`) with the following optional values:

| Variable | Description | Required |
|---|---|---|
| `VITE_SHARE_OG_URL` | Open Graph image URL for share previews (KakaoTalk, SMS) | No |
| `VITE_TOSS_AD_SLOT_ID` | Reward ad slot ID from Apps-in-Toss console | No |
| `VITE_TOSS_IAP_SKU` | In-app purchase SKU from console | No |
| `VITE_TOSS_PROMOTION_CODE` | Promotion reward code from console | No |

If a value is omitted, that feature degrades gracefully (no error, feature simply unavailable).

## Project Structure

```
src/
├── components/          # TDS wrappers and UI components
├── lib/                 # Core logic (conversion, storage, analytics, routing)
├── pages/               # Route pages (Home, Heic, Compress, PdfMerge, etc.)
├── hooks/               # Custom React hooks
├── styles/              # Global styles
├── __tests__/           # Unit tests (vitest + @testing-library/react)
├── App.tsx              # Route definitions
└── main.tsx             # React entry point
```

## Deployment

### Build

```bash
npm run build
```

The production bundle is output to `dist/`. It includes:
- Tree-shaken dev code (dev-only routes removed)
- Lazy-loaded conversion libraries (not bundled at startup)
- No external API calls (all processing in-browser)

### Deploy via Apps-in-Toss

Apps-in-Toss pipeline handles deployment:

1. **Build:** `npx ait build` packages your `dist/` folder
2. **Deploy:** `npx ait deploy` uploads to Toss CDN
3. **Review:** Toss review team validates against mini app guidelines (19+ age gate, no external links, zero console.error, dark mode, CORS)

Your app will be hosted at:
- **Production:** `https://{appName}.web.tossmini.com`
- **QR Test:** `https://{appName}.private-web.tossmini.com`

### Minimum Platform Support

- Android 7+
- iOS 16+
- Requires Toss app v13.0+

## License

MIT
