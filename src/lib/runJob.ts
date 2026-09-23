import type { ConversionOutput, ConversionFailure, ConversionJob, InputFileMeta, JobOptions, ToolType, HistoryEntry } from "./types";
import { generateId } from "./utils";

const DEFAULT_TIMEOUT_MS = 60000;
const TIMEOUT_MESSAGE = "변환 시간이 너무 오래 걸려서 중단했어요";
const GENERIC_ERROR_MESSAGE = "파일을 읽을 수 없어요. 다른 파일을 선택해주세요";

class RunJobTimeoutError extends Error {}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new RunJobTimeoutError()), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

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
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const total = inputs.length;
  const outputs: T[] = [];
  const failures: ConversionFailure[] = [];

  for (let i = 0; i < total; i++) {
    const file = inputs[i];
    try {
      const results = await withTimeout(process(file), timeoutMs);
      outputs.push(...results);
    } catch (err) {
      const message = err instanceof RunJobTimeoutError ? TIMEOUT_MESSAGE : GENERIC_ERROR_MESSAGE;
      failures.push({ id: generateId(), inputIndex: i, fileName: file.name, message });
    }
    opts.onProgress(i + 1, total);
  }

  return { outputs, failures };
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
  return {
    jobId,
    tool,
    createdAt: new Date().toISOString(),
    options,
    inputs,
    outputs,
    failures,
    durationMs,
    status: failures.length > 0 ? "partial" : "success",
  };
}

/**
 * toHistoryEntry: Convert ConversionJob to append-only HistoryEntry.
 */
export function toHistoryEntry(job: ConversionJob): HistoryEntry {
  return {
    id: job.jobId,
    tool: job.tool,
    createdAt: job.createdAt,
    status: job.status,
    inputCount: job.inputs.length,
    outputCount: job.outputs.length,
    failedCount: job.failures.length,
    inputTotalBytes: job.inputs.reduce((sum, input) => sum + input.sizeBytes, 0),
    outputTotalBytes: job.outputs.reduce((sum, output) => sum + output.sizeBytes, 0),
    inputNames: job.inputs.map((input) => input.name),
    outputNames: job.outputs.map((output) => output.fileName),
  };
}
