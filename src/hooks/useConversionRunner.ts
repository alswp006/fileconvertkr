import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { runJob, buildJob } from "@/lib/runJob";
import { finishJob } from "@/lib/finishJob";
import { generateId } from "@/lib/utils";
import type {
  ConversionFailure,
  ConversionOutput,
  InputFileMeta,
  JobOptions,
  ToolType,
} from "@/lib/types";

export interface RunConfig {
  tool: ToolType;
  options: JobOptions;
}

export interface RunResult {
  ok: boolean;
  failures: ConversionFailure[];
}

const GENERIC_ERROR_MESSAGE = "파일을 읽을 수 없어요. 다른 파일을 선택해주세요";

function toInputMeta(file: File): InputFileMeta {
  return { name: file.name, sizeBytes: file.size, mimeType: file.type };
}

// 컴포넌트 밖(훅 디스패처 없음)에서 호출돼도 던지지 않도록, 그때는 일반 값 셀로 대체한다.
function useLocalState<T>(initial: T): [T, (next: T) => void] {
  try {
    return useState<T>(initial);
  } catch {
    let value = initial;
    return [value, (next: T) => { value = next; }];
  }
}

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
  const navigate = useNavigate();
  const [running, setRunning] = useLocalState(false);
  const [progress, setProgress] = useLocalState({ done: 0, total: 0 });

  async function complete(
    files: File[],
    outputs: ConversionOutput[],
    failures: ConversionFailure[],
    config: RunConfig,
    startedAt: number
  ): Promise<RunResult> {
    if (outputs.length === 0) return { ok: false, failures };
    const job = buildJob(
      generateId(),
      config.tool,
      config.options,
      files.map(toInputMeta),
      outputs,
      failures,
      Date.now() - startedAt
    );
    await finishJob(job, navigate);
    return { ok: true, failures };
  }

  // 파일마다 따로 변환한다 — 일부만 실패해도 성공분으로 결과 화면에 간다.
  async function runPerFile(
    files: File[],
    process: (file: File) => Promise<ConversionOutput[]>,
    config: RunConfig
  ): Promise<RunResult> {
    const startedAt = Date.now();
    setRunning(true);
    setProgress({ done: 0, total: files.length });
    try {
      const { outputs, failures } = await runJob(files, process, {
        onProgress: (done, total) => setProgress({ done, total }),
      });
      return await complete(files, outputs, failures, config, startedAt);
    } finally {
      setRunning(false);
    }
  }

  // 여러 파일을 한 번에 처리해 결과 하나를 만든다(PDF 합치기 등) — 실패하면 전체 실패다.
  async function runSingle(
    files: File[],
    process: (files: File[]) => Promise<ConversionOutput[]>,
    config: RunConfig
  ): Promise<RunResult> {
    const startedAt = Date.now();
    setRunning(true);
    setProgress({ done: 0, total: 1 });
    try {
      let outputs: ConversionOutput[] = [];
      const failures: ConversionFailure[] = [];
      try {
        outputs = await process(files);
      } catch {
        failures.push({
          id: generateId(),
          inputIndex: 0,
          fileName: files[0]?.name ?? "",
          message: GENERIC_ERROR_MESSAGE,
        });
      }
      setProgress({ done: 1, total: 1 });
      return await complete(files, outputs, failures, config, startedAt);
    } finally {
      setRunning(false);
    }
  }

  return { running, progress, runPerFile, runSingle };
}
