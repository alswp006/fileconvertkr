import { describe, it, expect } from "vitest";
describe("matchMedia check", () => {
  it("logs", () => {
    console.log(typeof window.matchMedia);
    if (typeof window.matchMedia === "function") {
      try {
        const r = window.matchMedia("(prefers-reduced-motion: reduce)");
        console.log("result", r);
      } catch (e) {
        console.log("threw", e);
      }
    }
    expect(true).toBe(true);
  });
});
