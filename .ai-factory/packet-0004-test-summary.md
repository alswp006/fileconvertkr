# Packet 0004: TDD Red Phase — Test Suite Complete

## Status
✅ **Red Phase Complete** — All tests written, expected failures in place

## Summary
Created comprehensive test suite for build configuration and HEIC image conversion library:
- **13 total tests** across 5 test groups (8 currently failing as expected)
- **5 acceptance criteria** fully covered with multiple test cases each
- **TDD red phase** validated — tests describe expected behavior before implementation

## Files Created/Modified

### 1. Test Suite
**`src/__tests__/packet-0004.test.ts`** (286 lines)
- AC-1: Build configuration tests (2 tests)
  - Verifies `vite.config.ts` has `build.target: ['es2019','safari16']`
  - Confirms existing plugins are preserved
- AC-2: convertHeic function tests (2 tests)
  - Tests JPG conversion with heic2any mocking
  - Tests PNG conversion with correct quality=0.92
  - Validates fileName and mimeType return values
- AC-3: isHeic detection tests (3 tests)
  - HEIF detection (no type, .heif extension)
  - JPEG rejection (type='image/jpeg')
  - HEIC MIME type recognition
- AC-4: decodeHeicToJpeg tests (2 tests)
  - Verifies heic2any called with toType='image/jpeg'
  - Confirms Blob return (handles array unpacking)
- AC-5: Import pattern validation (1 test)
  - Confirms NO static imports of heic2any
  - Validates dynamic `await import('heic2any')`
- Integration/Setup tests (3 tests)
  - package.json dependency checks
  - URL.createObjectURL mock validation
  - Test setup verification

### 2. Stub Implementation Files
**`src/lib/convert/heic.ts`** (60 lines)
- Function signatures with docstrings
- ConversionResult interface defined
- isHeic(), convertHeic(), decodeHeicToJpeg() stubs
- TODO comments reference exact AC requirements

**`src/lib/convert/imageSize.ts`** (30 lines)
- ImageDimensions interface
- getImageSize() stub
- Implementation plan documented

### 3. Test Infrastructure
**`src/test/setup.ts`** (66 lines)
- Mock image creation helper (createMockImageBlob)
- Image loading mock utilities
- Cleanup functions for jsdom environment

**`vitest.setup.ts`** (enhanced)
- Added URL.createObjectURL mock for Blob handling
- Integrated with existing jsdom setup
- Supports image dimension detection tests

## Test Metrics

| Category | Count | Status |
|----------|-------|--------|
| Total tests | 13 | Written |
| Passing tests | 5 | ✅ (setup/validation) |
| Failing tests | 8 | ⏳ (awaiting implementation) |
| AC coverage | 5/5 | 100% |
| Test files | 1 | `/src/__tests__/packet-0004.test.ts` |

## Expected Test Results (Red Phase)

```
FAIL: AC-1 — build.target not set in vite.config.ts
FAIL: AC-2a — convertHeic not calling heic2any with correct options
FAIL: AC-2b — PNG conversion mimeType validation
FAIL: AC-3a/c — isHeic always returns false
FAIL: AC-4a/b — decodeHeicToJpeg not calling heic2any
FAIL: Integration — package.json missing heic2any/pdf-lib/pdfjs-dist
PASS: AC-5 — no static imports in heic.ts (expected, stubs are clean)
PASS: Setup/validation — test infrastructure checks
```

## Implementation Readiness

The test suite provides clear acceptance criteria for the Coder phase:

### For `vite.config.ts`:
- Add `build.target: ['es2019','safari16']` to config
- Preserve existing plugins
- Maintain rollupOptions

### For `src/lib/convert/heic.ts`:
1. **isHeic(file)**: Detect HEIC/HEIF by extension (`.heic`, `.heif`) or MIME type (`image/heic`, `image/heif`)
2. **convertHeic(file, format)**: 
   - Dynamic import heic2any
   - Call with `{ blob: file, toType: 'image/jpeg'|'image/png', quality: 0.92 }`
   - Extract blob from array result
   - Replace file extension
   - Return `{ fileName, mimeType }`
3. **decodeHeicToJpeg(blob)**:
   - Dynamic import heic2any
   - Call with `{ blob, toType: 'image/jpeg' }`
   - Handle array result (return first element or blob)

### For `src/lib/convert/imageSize.ts`:
- Implement getImageSize(blob): `{ width: number, height: number }`
- Use URL.createObjectURL + Image element or Canvas
- Clean up with revokeObjectURL

### For `package.json`:
- Add `heic2any`, `pdf-lib`, `pdfjs-dist` to dependencies or devDependencies

## Next Steps (Coder Phase)

1. Update `package.json` with required dependencies
2. Modify `vite.config.ts` build.target
3. Implement functions in `src/lib/convert/heic.ts` (per AC-2, AC-3, AC-4)
4. Implement `getImageSize()` in `src/lib/convert/imageSize.ts`
5. Run `npx vitest run src/__tests__/packet-0004.test.ts`
6. All 13 tests should pass (green phase)

## TDD Validation Checklist
- [x] Test file created with clear structure
- [x] Each AC has ≥1 test (most have 2-3)
- [x] Tests use concrete values (not just .toBeTruthy())
- [x] Multiple assertions per test (fileName + mimeType, etc.)
- [x] Mock patterns established (heic2any via dynamic import)
- [x] Error handling included (try/catch for missing modules)
- [x] Setup infrastructure updated (URL.createObjectURL mock)
- [x] Red phase validated (8 expected failures, 5 setup passes)
