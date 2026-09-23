import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// localStorage mock
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(global, "localStorage", {
  value: localStorageMock,
  writable: true,
});

// Mock URL.revokeObjectURL
Object.defineProperty(global.URL, "revokeObjectURL", {
  value: vi.fn(),
  writable: true,
});

describe("저장소: validateFiles·prefs·historyRepo·jobStore", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe("validateFiles", () => {
    it("AC-3: should accept HEIC file and reject unsupported type HEIF", async () => {
      const { validateFiles } = await import("@/lib/validateFiles");

      const files = [
        new File(["x".repeat(2 * 1024 * 1024)], "a.heic", { type: "" }),
        new File(["x".repeat(1024 * 1024)], "b.jpg", { type: "image/jpeg" }),
        new File(["x".repeat(35 * 1024 * 1024)], "c.HEIF", { type: "image/heif" }),
      ];

      const result = validateFiles(files, "heic");

      expect(result.accepted).toHaveLength(1);
      expect(result.accepted[0]?.name).toBe("a.heic");
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: "UNSUPPORTED_TYPE",
          message: expect.stringContaining("HEIC"),
        })
      );
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: "FILE_TOO_LARGE",
          message: expect.stringContaining("30MB"),
        })
      );
    });

    it("AC-4: should limit total files (max 20) and total size (max 100MB)", async () => {
      const { validateFiles } = await import("@/lib/validateFiles");

      const jpgs = Array.from({ length: 21 }, (_, i) =>
        new File(["x".repeat(1024 * 1024)], `img${i}.jpg`, {
          type: "image/jpeg",
        })
      );

      const result = validateFiles(jpgs, "compress");

      expect(result.accepted).toHaveLength(20);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ type: "TOO_MANY_FILES" })
      );
    });

    it("AC-4: should fail if total size exceeds 100MB", async () => {
      const { validateFiles } = await import("@/lib/validateFiles");

      const largeFiles = Array.from({ length: 5 }, (_, i) =>
        new File(["x".repeat(25 * 1024 * 1024)], `large${i}.jpg`, {
          type: "image/jpeg",
        })
      );

      const result = validateFiles(largeFiles, "compress");

      expect(result.accepted).toHaveLength(4);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ type: "TOTAL_TOO_LARGE" })
      );
    });
  });

  describe("historyRepo", () => {
    it("AC-1: should append with { ok: true } and proper structure (no updatedAt)", async () => {
      const { historyRepo } = await import("@/lib/storage/historyRepo");

      const result = await historyRepo.append({
        tool: "heic",
        inputNames: [],
        inputCount: 1,
      });

      expect(result).toEqual({ ok: true });

      const loaded = await historyRepo.load();
      expect(loaded).toHaveLength(1);
      expect(loaded[0]!.tool).toBe("heic");
      expect(loaded[0]!.id).not.toBe("");
      expect(loaded[0]!.createdAt).toBeTruthy();
      expect(new Date(loaded[0]!.createdAt).toISOString()).toBe(
        loaded[0]!.createdAt
      );
      expect("updatedAt" in (loaded[0] ?? {})).toBe(false);
    });

    it("AC-2/AC-9: should maintain 100-item limit when appending to full history", async () => {
      const { historyRepo } = await import("@/lib/storage/historyRepo");

      // Pre-populate with 100 items
      const existing = Array.from({ length: 100 }, (_, i) => ({
        id: `old-${i}`,
        tool: "heic" as const,
        createdAt: new Date(Date.now() - (100 - i) * 1000).toISOString(),
        inputNames: [],
        inputCount: 1,
      }));
      localStorage.setItem(
        "fileconvertkr:history:v1",
        JSON.stringify(existing)
      );

      const result = await historyRepo.append({
        tool: "heic",
        inputNames: Array.from({ length: 7 }, (_, i) => `file${i}`),
        inputCount: 7,
      });

      expect(result.ok).toBe(true);

      const loaded = await historyRepo.load();
      expect(loaded).toHaveLength(100);
      expect(loaded.map((x) => x.id)).not.toContain("old-99");
      expect(loaded[0]!.inputCount).toBe(7);
    });

    it("AC-9: should normalize long input names to 40 code points with ellipsis", async () => {
      const { historyRepo } = await import("@/lib/storage/historyRepo");

      const longName = "a".repeat(41) + ".jpg";
      const result = await historyRepo.append({
        tool: "compress",
        inputNames: [longName],
        inputCount: 1,
      });

      expect(result.ok).toBe(true);

      const loaded = await historyRepo.load();
      const entry = loaded[0];
      expect(entry?.inputNames?.[0]).toBe("a".repeat(39) + "…");
    });

    it("AC-9: should keep only first 5 input names", async () => {
      const { historyRepo } = await import("@/lib/storage/historyRepo");

      const result = await historyRepo.append({
        tool: "heic",
        inputNames: ["f1", "f2", "f3", "f4", "f5", "f6", "f7"],
        inputCount: 7,
      });

      const loaded = await historyRepo.load();
      const entry = loaded[0];
      expect(entry?.inputNames).toHaveLength(5);
      expect(entry?.inputCount).toBe(7);
    });

    it("AC-5: should return [] when localStorage value is missing or corrupted", async () => {
      const { historyRepo } = await import("@/lib/storage/historyRepo");

      localStorage.setItem("fileconvertkr:history:v1", "{broken");
      const loaded = await historyRepo.load();

      expect(loaded).toEqual([]);
    });

    it("AC-5: should not throw console.error when loading corrupted data", async () => {
      const { historyRepo } = await import("@/lib/storage/historyRepo");
      const consoleErrorSpy = vi.spyOn(console, "error");

      localStorage.setItem("fileconvertkr:history:v1", "{broken");
      await historyRepo.load();

      expect(consoleErrorSpy).not.toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it("AC-6: should remove 20 oldest entries and retry on QuotaExceededError", async () => {
      const { historyRepo } = await import("@/lib/storage/historyRepo");

      // Pre-populate with 100 items
      const existing = Array.from({ length: 100 }, (_, i) => ({
        id: `old-${i}`,
        tool: "heic" as const,
        createdAt: new Date(Date.now() - (100 - i) * 1000).toISOString(),
        inputNames: [],
        inputCount: 1,
      }));
      localStorage.setItem(
        "fileconvertkr:history:v1",
        JSON.stringify(existing)
      );

      const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
      let callCount = 0;
      setItemSpy.mockImplementation((key: string, value: string) => {
        callCount++;
        if (callCount === 1) {
          const err = new Error("QuotaExceededError");
          err.name = "QuotaExceededError";
          throw err;
        }
        localStorageMock.setItem(key, value);
      });

      const result = await historyRepo.append({
        tool: "heic",
        inputNames: [],
        inputCount: 1,
      });

      expect(result).toEqual({ ok: true });
      expect(setItemSpy).toHaveBeenCalledTimes(2);
      setItemSpy.mockRestore();
    });

    it("AC-6: should return { ok: false } and not throw on persistent quota failure", async () => {
      const { historyRepo } = await import("@/lib/storage/historyRepo");

      const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
      setItemSpy.mockImplementation(() => {
        const err = new Error("QuotaExceededError");
        err.name = "QuotaExceededError";
        throw err;
      });

      const result = await historyRepo.append({
        tool: "heic",
        inputNames: [],
        inputCount: 1,
      });

      expect(result).toEqual({ ok: false });
      expect(() => {
        historyRepo.append({
          tool: "heic",
          inputNames: [],
          inputCount: 1,
        });
      }).not.toThrow();

      setItemSpy.mockRestore();
    });

    it("should clear history", async () => {
      const { historyRepo } = await import("@/lib/storage/historyRepo");

      await historyRepo.append({ tool: "heic", inputNames: [], inputCount: 1 });
      let loaded = await historyRepo.load();
      expect(loaded).toHaveLength(1);

      await historyRepo.clear();
      loaded = await historyRepo.load();
      expect(loaded).toEqual([]);
    });
  });

  describe("prefs", () => {
    it("AC-11: should load with default values when no stored data", async () => {
      const { prefs } = await import("@/lib/storage/prefs");

      const loaded = await prefs.load();

      expect(loaded).toEqual({
        id: "prefs",
        createdAt: null,
        updatedAt: null,
        heicFormat: "jpg",
        compressTargetKB: 500,
        pdfImageFormat: "jpg",
        pdfImageScale: 1.5,
      });
    });

    it("AC-8: should set both createdAt and updatedAt on first save", async () => {
      const { prefs } = await import("@/lib/storage/prefs");

      const before = Date.now();
      await prefs.save({ heicFormat: "png" });
      const after = Date.now();

      const loaded = await prefs.load();
      expect(loaded.heicFormat).toBe("png");
      expect(loaded.createdAt).not.toBeNull();
      expect(loaded.updatedAt).not.toBeNull();

      const createdMs = new Date(loaded.createdAt!).getTime();
      const updatedMs = new Date(loaded.updatedAt!).getTime();
      expect(createdMs).toBeGreaterThanOrEqual(before);
      expect(createdMs).toBeLessThanOrEqual(after);
      expect(updatedMs).toBeGreaterThanOrEqual(before);
      expect(updatedMs).toBeLessThanOrEqual(after);
    });

    it("AC-11: should preserve createdAt and update only updatedAt on second save", async () => {
      const { prefs } = await import("@/lib/storage/prefs");

      await prefs.save({ heicFormat: "png" });
      const first = await prefs.load();
      const createdAt1 = first.createdAt;
      const updatedAt1 = first.updatedAt;

      // Simulate 60 seconds later
      vi.useFakeTimers();
      vi.advanceTimersByTime(60 * 1000);

      await prefs.save({ compressTargetKB: 1024 });

      vi.useRealTimers();

      const second = await prefs.load();
      expect(second.compressTargetKB).toBe(1024);
      expect(second.heicFormat).toBe("png");
      expect(second.createdAt).toBe(createdAt1);
      expect(second.updatedAt).not.toBe(updatedAt1);
    });

    it("should not call setItem if all values are unchanged", async () => {
      const { prefs } = await import("@/lib/storage/prefs");
      const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

      await prefs.save({ heicFormat: "jpg", compressTargetKB: 500 });
      setItemSpy.mockClear();

      // Save same values
      await prefs.save({ heicFormat: "jpg", compressTargetKB: 500 });

      expect(setItemSpy).not.toHaveBeenCalled();
      setItemSpy.mockRestore();
    });
  });

  describe("jobStore", () => {
    it("AC-8: should maintain max 3 jobs and revoke oldest objectURL on 4th insert", async () => {
      const { jobStore } = await import("@/lib/jobStore");

      const jobs = [
        { id: "a", objectUrl: "blob:a", status: "pending" as const },
        { id: "b", objectUrl: "blob:b", status: "pending" as const },
        { id: "c", objectUrl: "blob:c", status: "pending" as const },
        { id: "d", objectUrl: "blob:d", status: "pending" as const },
      ];

      const revokeObjectURLSpy = vi.spyOn(URL, "revokeObjectURL");

      jobs.forEach((job) => jobStore.saveJob(job as any));

      expect(jobStore.getJob("a")).toBeUndefined();
      expect(jobStore.getJob("b")).toBeTruthy();
      expect(jobStore.getJob("c")).toBeTruthy();
      expect(jobStore.getJob("d")).toBeTruthy();
      expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:a");
      expect(revokeObjectURLSpy).toHaveBeenCalledTimes(1);

      revokeObjectURLSpy.mockRestore();
    });

    it("should retrieve saved job by id", async () => {
      const { jobStore } = await import("@/lib/jobStore");

      const job = {
        id: "test-job",
        objectUrl: "blob:test",
        status: "pending" as const,
      };
      jobStore.saveJob(job as any);

      const retrieved = jobStore.getJob("test-job");
      expect(retrieved).toEqual(job);
    });

    it("should return undefined for non-existent job", async () => {
      const { jobStore } = await import("@/lib/jobStore");

      const job = {
        id: "test-job",
        objectUrl: "blob:test",
        status: "pending" as const,
      };
      jobStore.saveJob(job as any);

      const retrieved = jobStore.getJob("non-existent");
      expect(retrieved).toBeUndefined();
    });
  });
});
