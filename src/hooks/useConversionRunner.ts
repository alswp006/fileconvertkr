/**
 * useConversionRunner: React hook for managing file conversion execution.
 *
 * Returns:
 * - running: boolean (true during conversion)
 * - progress: { done: number, total: number }
 * - runPerFile: Run conversion for multiple files
 * - runSingle: Run conversion for a single file
 *
 * - All files fail → { ok: false }, navigate/append not called
 * - Some files succeed → { ok: true }, navigate called with jobId
 * - Some files fail → status: 'partial', navigate called with jobId
 */
export function useConversionRunner() {
  // TODO: Implement
  throw new Error("useConversionRunner not yet implemented");
}
