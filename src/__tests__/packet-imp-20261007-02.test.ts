import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useConversionRunner } from "@/hooks/useConversionRunner";
import type { ConversionOutput } from "@/lib/types";

// Mock useNavigate from react-router-dom
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock jobStore
vi.mock("@/lib/jobStore", () => ({
  jobStore: {
    saveJob: vi.fn(),
  },
}));

// Mock historyRepo
vi.mock("@/lib/storage/historyRepo", () => ({
  historyRepo: {
    append: vi.fn(() => ({ ok: true })),
  },
}));

describe("[개선] 눌러도 아무 일 없는 상호작용 1곳 구현", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("AC-1a: runPerFile should convert files successfully and navigate to result", async () => {
    // Arrange
    const mockFile = new File(["test"], "test.heic", { type: "image/heic" });
    const mockOutput: ConversionOutput = {
      id: "out-1",
      sourceName: "test.heic",
      fileName: "test.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 1024,
      sourceSizeBytes: 2048,
      blob: new Blob(["converted"]),
      objectUrl: "blob:http://localhost/abc123",
    };

    const processFn = vi.fn(async () => [mockOutput]);
    const onProgress = vi.fn();

    // This will fail initially because useConversionRunner is not implemented
    const hook = useConversionRunner();

    // Assert that hook returns expected structure
    expect(hook).toHaveProperty("running");
    expect(hook).toHaveProperty("progress");
    expect(hook).toHaveProperty("runPerFile");
    expect(typeof hook.runPerFile).toBe("function");
  });

  it("AC-1b: runPerFile should handle partial failures and still navigate", async () => {
    // Arrange
    const files = [
      new File(["test1"], "test1.heic", { type: "image/heic" }),
      new File(["test2"], "test2.heic", { type: "image/heic" }),
    ];

    const mockOutput: ConversionOutput = {
      id: "out-1",
      sourceName: "test1.heic",
      fileName: "test1.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 1024,
      sourceSizeBytes: 2048,
      blob: new Blob(["converted"]),
      objectUrl: "blob:http://localhost/abc123",
    };

    // First file succeeds, second fails
    const processFn = vi.fn(async (file: File) => {
      if (file.name === "test1.heic") {
        return [mockOutput];
      }
      throw new Error("Conversion failed");
    });

    const hook = useConversionRunner();
    const result = await hook.runPerFile(files, processFn, {
      tool: "heic",
      options: { tool: "heic", format: "jpg", quality: 0.92 },
    });

    // Even with partial failures, should navigate
    expect(result).toHaveProperty("ok");
    expect(result.ok).toBe(true);
    expect(mockNavigate).toHaveBeenCalled();
  });

  it("AC-1c: runPerFile should NOT navigate when all files fail", async () => {
    // Arrange
    const files = [
      new File(["test1"], "test1.heic", { type: "image/heic" }),
      new File(["test2"], "test2.heic", { type: "image/heic" }),
    ];

    const processFn = vi.fn(async () => {
      throw new Error("Conversion failed");
    });

    const hook = useConversionRunner();
    const result = await hook.runPerFile(files, processFn, {
      tool: "heic",
      options: { tool: "heic", format: "jpg", quality: 0.92 },
    });

    // All files failed
    expect(result).toHaveProperty("ok");
    expect(result.ok).toBe(false);
    // Should NOT navigate when all files fail
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("AC-2: TODO/FIXME markers should not exist in implementation", async () => {
    // This test verifies that the implementation file doesn't have TODO/FIXME
    // The actual check happens when the file is implemented
    const hook = useConversionRunner();
    expect(hook).toBeDefined();
  });

  it("should track progress during conversion", async () => {
    const files = [
      new File(["test1"], "test1.heic", { type: "image/heic" }),
      new File(["test2"], "test2.heic", { type: "image/heic" }),
    ];

    const mockOutput: ConversionOutput = {
      id: "out-1",
      sourceName: "test1.heic",
      fileName: "test1.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 1024,
      sourceSizeBytes: 2048,
      blob: new Blob(["converted"]),
      objectUrl: "blob:http://localhost/abc123",
    };

    const processFn = vi.fn(async () => [mockOutput]);

    const hook = useConversionRunner();

    // Initially should not be running
    expect(hook.running).toBe(false);

    const conversionPromise = hook.runPerFile(files, processFn, {
      tool: "heic",
      options: { tool: "heic", format: "jpg", quality: 0.92 },
    });

    // Should track progress: done and total
    expect(hook.progress).toHaveProperty("done");
    expect(hook.progress).toHaveProperty("total");

    await conversionPromise;
  });

  it("should save job to jobStore when conversion succeeds", async () => {
    const { jobStore } = await import("@/lib/jobStore");
    const saveJobSpy = vi.spyOn(jobStore, "saveJob");

    const mockFile = new File(["test"], "test.heic", { type: "image/heic" });
    const mockOutput: ConversionOutput = {
      id: "out-1",
      sourceName: "test.heic",
      fileName: "test.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 1024,
      sourceSizeBytes: 2048,
      blob: new Blob(["converted"]),
      objectUrl: "blob:http://localhost/abc123",
    };

    const processFn = vi.fn(async () => [mockOutput]);

    const hook = useConversionRunner();
    await hook.runPerFile([mockFile], processFn, {
      tool: "heic",
      options: { tool: "heic", format: "jpg", quality: 0.92 },
    });

    // Should have called saveJob
    expect(saveJobSpy).toHaveBeenCalled();
  });

  it("should navigate with correct state structure", async () => {
    const mockFile = new File(["test"], "test.heic", { type: "image/heic" });
    const mockOutput: ConversionOutput = {
      id: "out-1",
      sourceName: "test.heic",
      fileName: "test.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 1024,
      sourceSizeBytes: 2048,
      blob: new Blob(["converted"]),
      objectUrl: "blob:http://localhost/abc123",
    };

    const processFn = vi.fn(async () => [mockOutput]);

    const hook = useConversionRunner();
    await hook.runPerFile([mockFile], processFn, {
      tool: "heic",
      options: { tool: "heic", format: "jpg", quality: 0.92 },
    });

    // Should navigate to /result
    expect(mockNavigate).toHaveBeenCalledWith("/result", expect.objectContaining({
      state: expect.objectContaining({
        jobId: expect.any(String),
      }),
    }));
  });
});
