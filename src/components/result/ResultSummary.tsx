import { SummaryHero } from "@/components/SummaryHero";
import { Amount } from "@/components/Amount";
import type { ConversionJob } from "@/lib/types";

/**
 * 결과 요약 히어로 — 도구별로 다른 핵심 숫자를 보여준다.
 * compress: 용량 절감률(%). 그 외: 변환된 파일 개수.
 */
export function ResultSummary({ job }: { job: ConversionJob }) {
  if (job.tool === "compress") {
    const inTotal = job.outputs.reduce((sum, o) => sum + o.sourceSizeBytes, 0);
    const outTotal = job.outputs.reduce((sum, o) => sum + o.sizeBytes, 0);
    const percent = inTotal > 0 ? Math.max(0, Math.round((1 - outTotal / inTotal) * 100)) : 0;

    return (
      <SummaryHero
        testId="result-summary"
        label="용량 절감"
        value={<Amount value={percent} unit="%" typography="t1" />}
      />
    );
  }

  return (
    <SummaryHero
      testId="result-summary"
      label="변환 완료"
      value={<Amount value={job.outputs.length} unit="개" typography="t1" />}
    />
  );
}
