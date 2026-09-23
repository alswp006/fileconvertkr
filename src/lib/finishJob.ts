import type { NavigateFunction } from "react-router-dom";
import type { ConversionJob } from "./types";
import { jobStore } from "./jobStore";
import { historyRepo } from "./storage/historyRepo";
import { toHistoryEntry } from "./runJob";

/**
 * finishJob: Save job and append to history, then navigate to result.
 *
 * - Call saveJob(job)
 * - Call appendHistory(toHistoryEntry(job))
 * - Navigate to /result with jobId and optional historySaveFailed flag
 * - navigate called exactly 1 time
 */
export async function finishJob(
  job: ConversionJob,
  navigate: NavigateFunction
): Promise<void> {
  jobStore.saveJob(job);
  const { ok } = historyRepo.append(toHistoryEntry(job));

  navigate("/result", {
    state: ok ? { jobId: job.jobId } : { jobId: job.jobId, historySaveFailed: true },
  });
}
