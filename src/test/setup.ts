/**
 * Test setup for image conversion and file handling (jsdom).
 *
 * jsdom implements neither URL.createObjectURL/revokeObjectURL nor real image
 * decoding, so utilities like getImageSize (src/lib/convert/imageSize.ts) would
 * hang forever waiting on <img> load/error events that jsdom never fires.
 */

import { vi } from 'vitest';

// ── URL.createObjectURL / revokeObjectURL mock ──
if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = vi.fn((_blob: Blob) => `blob:mock-${Math.random().toString(36).slice(2)}`);
}
if (typeof URL.revokeObjectURL !== 'function') {
  URL.revokeObjectURL = vi.fn();
}

// ── <img> load shim ──
// jsdom never loads the `src` resource, so onload/onerror never fire. Fake a
// successful load with fixed dimensions as soon as `src` is assigned.
const HTMLImageElementProto = globalThis.HTMLImageElement?.prototype;
if (HTMLImageElementProto) {
  const originalSrcDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElementProto, 'src');

  Object.defineProperty(HTMLImageElementProto, 'src', {
    configurable: true,
    get(this: HTMLImageElement) {
      return originalSrcDescriptor?.get?.call(this) ?? '';
    },
    set(this: HTMLImageElement, value: string) {
      originalSrcDescriptor?.set?.call(this, value);
      queueMicrotask(() => {
        this.onload?.(new Event('load'));
      });
    },
  });

  Object.defineProperty(HTMLImageElementProto, 'naturalWidth', {
    configurable: true,
    get: () => 800,
  });
  Object.defineProperty(HTMLImageElementProto, 'naturalHeight', {
    configurable: true,
    get: () => 600,
  });
}
