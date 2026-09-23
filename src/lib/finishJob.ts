import type { NavigateFunction } from "react-router-dom";
import type { ConversionJob } from "./types";

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
  // TODO: Implement
  throw new Error("finishJob not yet implemented");
}
