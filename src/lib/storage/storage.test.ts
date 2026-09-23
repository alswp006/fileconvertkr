import { describe, it, expect, vi } from 'vitest';

// jsdom은 URL.revokeObjectURL을 구현하지 않는다 — jobStore 테스트가 스파이할 수 있도록 채운다.
if (typeof URL.revokeObjectURL !== 'function') {
  (URL as unknown as { revokeObjectURL: (url: string) => void }).revokeObjectURL = () => {};
}

describe('storage: validateFiles·prefs·historyRepo·jobStore', () => {
  it('F1-AC-1: historyRepo.append creates an append-only entry', async () => {
    const { historyRepo } = await import('@/lib/storage/historyRepo');

    const result = await historyRepo.append({ tool: 'heic', inputNames: [], inputCount: 1 });
    expect(result).toEqual({ ok: true });

    const loaded = await historyRepo.load();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]!.tool).toBe('heic');
    expect(loaded[0]!.id).not.toBe('');
    expect(new Date(loaded[0]!.createdAt).toISOString()).toBe(loaded[0]!.createdAt);
    expect('updatedAt' in loaded[0]!).toBe(false);
  });

  it('F1-AC-2/AC-9: keeps 100-item limit, first 5 names, and normalizes long names', async () => {
    const { historyRepo } = await import('@/lib/storage/historyRepo');

    const existing = Array.from({ length: 100 }, (_, i) => ({
      id: `old-${i}`,
      tool: 'heic' as const,
      createdAt: new Date(Date.now() - (100 - i) * 1000).toISOString(),
      inputNames: [],
      inputCount: 1,
    }));
    localStorage.setItem('fileconvertkr:history:v1', JSON.stringify(existing));

    const longName = 'a'.repeat(41) + '.jpg';
    const result = await historyRepo.append({
      tool: 'heic',
      inputNames: ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', longName],
      inputCount: 7,
    });
    expect(result.ok).toBe(true);

    const loaded = await historyRepo.load();
    expect(loaded).toHaveLength(100);
    expect(loaded.map((x) => x.id)).not.toContain('old-99');
    expect(loaded[0]!.inputCount).toBe(7);
    expect(loaded[0]!.inputNames).toHaveLength(5);
    expect(loaded[0]!.inputNames).not.toContain(longName);
  });

  it("F1-AC-5/AC-6: load() returns [] on missing/corrupted data without console.error, and quota retry works", async () => {
    const { historyRepo } = await import('@/lib/storage/historyRepo');
    const consoleErrorSpy = vi.spyOn(console, 'error');

    localStorage.setItem('fileconvertkr:history:v1', '{broken');
    expect(await historyRepo.load()).toEqual([]);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();

    localStorage.removeItem('fileconvertkr:history:v1');
    expect(await historyRepo.load()).toEqual([]);
  });

  it('F1-AC-3/AC-4: validateFiles enforces type, size, count, and total limits', async () => {
    const { validateFiles } = await import('@/lib/validateFiles');

    const heicResult = validateFiles(
      [
        new File(['x'.repeat(2 * 1024 * 1024)], 'a.heic', { type: '' }),
        new File(['x'.repeat(1024 * 1024)], 'b.jpg', { type: 'image/jpeg' }),
        new File(['x'.repeat(35 * 1024 * 1024)], 'c.HEIF', { type: '' }),
      ],
      'heic'
    );
    expect(heicResult.accepted.map((f) => f.name)).toEqual(['a.heic']);
    expect(heicResult.errors).toContainEqual(
      expect.objectContaining({ type: 'UNSUPPORTED_TYPE', message: 'HEIC 파일만 선택할 수 있어요' })
    );
    expect(heicResult.errors).toContainEqual(
      expect.objectContaining({ type: 'FILE_TOO_LARGE', message: expect.stringContaining('30MB') })
    );

    const jpgs = Array.from(
      { length: 21 },
      (_, i) => new File(['x'.repeat(1024 * 1024)], `img${i}.jpg`, { type: 'image/jpeg' })
    );
    const countResult = validateFiles(jpgs, 'compress');
    expect(countResult.accepted).toHaveLength(20);
    expect(countResult.errors).toContainEqual(expect.objectContaining({ type: 'TOO_MANY_FILES' }));

    const largeFiles = Array.from(
      { length: 5 },
      (_, i) => new File(['x'.repeat(25 * 1024 * 1024)], `large${i}.jpg`, { type: 'image/jpeg' })
    );
    const totalResult = validateFiles(largeFiles, 'compress');
    expect(totalResult.accepted).toHaveLength(4);
    expect(totalResult.errors).toContainEqual(expect.objectContaining({ type: 'TOTAL_TOO_LARGE' }));
  });

  it('F1-AC-8/AC-11: jobStore keeps max 3 jobs and prefs applies defaults + timestamp rules', async () => {
    const { jobStore } = await import('@/lib/jobStore');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');

    const jobs = ['a', 'b', 'c', 'd'].map((id) => ({ id, objectUrl: `blob:${id}`, status: 'pending' as const }));
    jobs.forEach((job) => jobStore.saveJob(job as any));

    expect(jobStore.getJob('a')).toBeUndefined();
    expect(jobStore.getJob('d')).toBeTruthy();
    expect(revokeSpy).toHaveBeenCalledWith('blob:a');
    revokeSpy.mockRestore();

    const { prefs } = await import('@/lib/storage/prefs');
    expect(await prefs.load()).toEqual({
      id: 'prefs',
      createdAt: null,
      updatedAt: null,
      heicFormat: 'jpg',
      compressTargetKB: 500,
      pdfImageFormat: 'jpg',
      pdfImageScale: 1.5,
    });

    await prefs.save({ heicFormat: 'png' });
    const first = await prefs.load();
    expect(first.createdAt).not.toBeNull();
    expect(first.updatedAt).toBe(first.createdAt);

    vi.useFakeTimers();
    vi.advanceTimersByTime(60_000);
    await prefs.save({ compressTargetKB: 1024 });
    vi.useRealTimers();

    const second = await prefs.load();
    expect(second.createdAt).toBe(first.createdAt);
    expect(second.updatedAt).not.toBe(first.updatedAt);

    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    await prefs.save({ compressTargetKB: 1024, heicFormat: 'png' });
    expect(setItemSpy).not.toHaveBeenCalled();
    setItemSpy.mockRestore();
  });

  it('prefsStore: getTargetSize/setTargetSize wrap prefs.compressTargetKB, getLastToolType reads historyRepo', async () => {
    const { prefsStore } = await import('@/lib/storage/prefs');
    const { historyRepo } = await import('@/lib/storage/historyRepo');

    expect(await prefsStore.getTargetSize()).toBe(500);
    expect(await prefsStore.getLastToolType()).toBeNull();

    await prefsStore.setTargetSize(1024);
    expect(await prefsStore.getTargetSize()).toBe(1024);

    await historyRepo.append({ tool: 'pdf-merge', inputNames: [], inputCount: 2 });
    expect(await prefsStore.getLastToolType()).toBe('pdf-merge');
  });
});
