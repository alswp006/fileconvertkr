import { useEffect, useRef, useState } from "react";
import { Button, ListRow, Paragraph, Spacing, Toast } from "@toss/tds-mobile";
import { Card } from "@/components/Card";
import { MiniBar } from "@/components/MiniBar";
import { deliverFile } from "@/lib/deliverFile";
import { logClick, logImpression } from "@/lib/analytics";
import { formatBytes } from "@/lib/utils";
import type { ConversionJob } from "@/lib/types";

const SAVE_ALL_GAP_MS = 300;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 잠금 층 — TossRewardAd의 children으로만 렌더된다(게이트가 열렸을 때만 마운트).
 * 마운트 시 노출 로그와 onUnlocked를 1회 호출한다(StrictMode 이중 호출 가드).
 */
export function LockedTier({
  job,
  onUnlocked,
}: {
  job: ConversionJob;
  onUnlocked?: () => void;
}) {
  const hasNotifiedRef = useRef(false);
  const [toastText, setToastText] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (hasNotifiedRef.current) return;
    hasNotifiedRef.current = true;
    logImpression("result_locked_tier");
    onUnlocked?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const outputs = job.outputs;
  const totalSource = outputs.reduce((sum, o) => sum + o.sourceSizeBytes, 0);
  const totalOutput = outputs.reduce((sum, o) => sum + o.sizeBytes, 0);
  const seconds = (job.durationMs / 1000).toFixed(1);

  const handleSaveAll = async () => {
    logClick("result_save_all");
    setSaving(true);
    let success = 0;
    let fail = 0;
    for (let i = 0; i < outputs.length; i++) {
      if (i > 0) await delay(SAVE_ALL_GAP_MS);
      try {
        await deliverFile(outputs[i]);
        success += 1;
      } catch {
        fail += 1;
      }
    }
    setSaving(false);
    setToastText(fail === 0 ? `${success}개 파일을 저장했어요` : `${success}개 저장, ${fail}개 실패`);
  };

  return (
    <div data-testid="locked-tier">
      <Card testId="locked-report">
        <Paragraph.Text typography="t5">파일별 상세 리포트</Paragraph.Text>
        <Spacing size={12} />
        {outputs.map((output, index) => {
          const pct = Math.round((1 - output.sizeBytes / output.sourceSizeBytes) * 100);
          const bottom = output.pageCount
            ? `${formatBytes(output.sourceSizeBytes)} → ${formatBytes(output.sizeBytes)} · −${pct}% · ${output.pageCount}페이지`
            : `${formatBytes(output.sourceSizeBytes)} → ${formatBytes(output.sizeBytes)} · −${pct}%`;

          return (
            <div key={output.id} data-testid="locked-report-row">
              {index > 0 ? <Spacing size={12} /> : null}
              <ListRow
                contents={<ListRow.Texts type="2RowTypeA" top={output.fileName} bottom={bottom} />}
              />
              <MiniBar ratio={output.sizeBytes / output.sourceSizeBytes} />
            </div>
          );
        })}
      </Card>
      <Spacing size={16} />
      <Paragraph.Text typography="st11">
        총 소요 시간 {seconds}초 · 원본 {formatBytes(totalSource)} → 결과 {formatBytes(totalOutput)}
      </Paragraph.Text>
      {outputs.length >= 2 ? (
        <>
          <Spacing size={16} />
          <Button variant="weak" display="block" disabled={saving} onClick={handleSaveAll}>
            {`모두 저장 (${outputs.length}개)`}
          </Button>
        </>
      ) : null}
      <Toast
        open={toastText !== null}
        text={toastText ?? ""}
        position="top"
        onClose={() => setToastText(null)}
      />
    </div>
  );
}
