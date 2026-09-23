import type { ConversionJob } from '@/lib/types';

const MAX_JOBS = 3;

const jobs = new Map<string, ConversionJob>();
const insertOrder: string[] = [];

function jobKey(job: ConversionJob): string {
  return job.jobId ?? (job as unknown as { id: string }).id;
}

function jobObjectUrls(job: ConversionJob): string[] {
  if (Array.isArray(job.outputs)) {
    return job.outputs.map((output) => output.objectUrl).filter(Boolean);
  }
  const legacyUrl = (job as unknown as { objectUrl?: string }).objectUrl;
  return legacyUrl ? [legacyUrl] : [];
}

function saveJob(job: ConversionJob): void {
  const key = jobKey(job);
  if (jobs.has(key)) {
    const idx = insertOrder.indexOf(key);
    if (idx !== -1) insertOrder.splice(idx, 1);
  }
  jobs.set(key, job);
  insertOrder.push(key);

  while (insertOrder.length > MAX_JOBS) {
    const oldestKey = insertOrder.shift();
    if (oldestKey === undefined) break;
    const oldestJob = jobs.get(oldestKey);
    jobs.delete(oldestKey);
    if (oldestJob) {
      for (const url of jobObjectUrls(oldestJob)) {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
      }
    }
  }
}

function getJob(jobId: string): ConversionJob | undefined {
  return jobs.get(jobId);
}

export const jobStore = { saveJob, getJob };
