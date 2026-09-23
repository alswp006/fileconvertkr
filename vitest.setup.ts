/**
 * Vitest setup — runs before each test file.
 *
 * Handles:
 *  - localStorage isolation between tests (prevents cross-test pollution)
 *  - requestAnimationFrame shim for jsdom (needed for animate/countup utilities)
 *  - sessionStorage isolation
 *  - console.error filtering (React Router warnings etc.)
 */

import { beforeEach, afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

// ── jest 전역 셈 (waitFor + vi.useFakeTimers 교착 방지) ──
// @testing-library/react의 waitFor(asyncWrapper)는 마이크로태스크를 비우려고 `typeof jest`로
// fake timer 사용 여부를 판정한다(vitest의 `vi`를 모른다). 이 프로젝트는 jest globals를 주입하지
// 않으므로 그 판정이 항상 false가 되고, 배출용 `setTimeout(...,0)`이 vi.useFakeTimers() 아래에서는
// 절대 발화하지 않는 가짜 타이머로 걸려 waitFor가 영원히 멈춘다(실측: packet-0018 F8-AC-8, 20s 타임아웃).
// `jest.advanceTimersByTime`만 있으면 되므로 `vi`를 그대로 별칭한다.
if (typeof (globalThis as unknown as { jest?: unknown }).jest === "undefined") {
  (globalThis as unknown as { jest: typeof vi }).jest = vi;
}

// ── localStorage / sessionStorage isolation ──
// jsdom's storage persists between tests by default. Clear it to prevent pollution.
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

// ── requestAnimationFrame shim for jsdom ──
// jsdom does NOT implement rAF natively, so animate/countup code hangs forever.
// Shim that immediately invokes callback with a monotonic timestamp.
if (typeof globalThis.requestAnimationFrame !== "function") {
  let now = 0;
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    now += 16;
    return setTimeout(() => cb(now), 0) as unknown as number;
  }) as typeof globalThis.requestAnimationFrame;
  globalThis.cancelAnimationFrame = ((id: number) => clearTimeout(id)) as typeof globalThis.cancelAnimationFrame;
}

// ── URL.createObjectURL mock for image/file handling ──
// jsdom doesn't implement URL.createObjectURL, needed for image dimension detection
if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = vi.fn((blob: Blob) => `blob:${Math.random()}`);
}

// ── afterEach reset ──
afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers(); // in case a test used fake timers
});
