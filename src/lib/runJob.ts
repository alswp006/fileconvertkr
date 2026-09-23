import type { ConversionOutput, ConversionFailure, ConversionJob, InputFileMeta, JobOptions, ToolType, HistoryEntry } from "./types";

/**
 * runJob: Process input files sequentially with per-file timeout and partial failure support.
 *
 * - Process each file through the process function
 * - Call onProgress(done, total) after each file
 * - Capture failures with id, inputIndex, message
 * - Timeout at timeoutMs (default 60000)
 * - Return { outputs, failures }
 */
export async function runJob<T extends ConversionOutput>(
  inputs: File[],
  process: (file: File) => Promise<T[]>,
  opts: {
    onProgress: (done: number, total: number) => void;
    signal?: AbortSignal;
    timeoutMs?: number;
  }
): Promise<{ outputs: T[]; failures: ConversionFailure[] }> {
  // TODO: Implement
  throw new Error("runJob not yet implemented");
}

/**
 * buildJob: Construct a ConversionJob from processing results.
 */
export function buildJob(
  jobId: string,
  tool: ToolType,
  options: JobOptions,
  inputs: InputFileMeta[],
  outputs: ConversionOutput[],
  failures: ConversionFailure[],
  durationMs: number
): ConversionJob {
  // TODO: Implement
  throw new Error("buildJob not yet implemented");
}

/**
 * toHistoryEntry: Convert ConversionJob to append-only HistoryEntry.
 */
export function toHistoryEntry(job: ConversionJob): HistoryEntry {
  // TODO: Implement
  throw new Error("toHistoryEntry not yet implemented");
}
