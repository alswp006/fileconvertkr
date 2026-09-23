import { useRef } from "react";
import { Spacing } from "@toss/tds-mobile";
import { requestReviewOnce } from "@/lib/review";
import type { ConversionJob } from "@/lib/types";
import { ResultSummary } from "./ResultSummary";
import { OutputRow } from "./OutputRow";
import { FailedList } from "./FailedList";

/**
 * 결과 화면 무료 층 — 요약 + 저장 가능한 결과 목록 + (있다면) 실패 목록.
 * 화면 세션에서 처음 저장이 성공한 순간에만 requestReviewOnce를 호출한다.
 */
export function FreeTier({ job }: { job: ConversionJob }) {
  const hasRequestedReviewRef = useRef(false);

  const handleAnySaveSuccess = () => {
    if (hasRequestedReviewRef.current) return;
    hasRequestedReviewRef.current = true;
    requestReviewOnce();
  };

  return (
    <div data-testid="free-tier">
      <ResultSummary job={job} />
      <Spacing size={24} />
      {job.outputs.map((output, index) => (
        <div key={output.id}>
          {index > 0 ? <Spacing size={12} /> : null}
          <OutputRow output={output} onSaveSuccess={handleAnySaveSuccess} />
        </div>
      ))}
      {job.failures.length > 0 ? (
        <>
          <Spacing size={24} />
          <FailedList failures={job.failures} />
        </>
      ) : null}
    </div>
  );
}
