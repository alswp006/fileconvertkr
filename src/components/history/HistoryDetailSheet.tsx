import { BottomSheet, Button, Paragraph, Spacing } from "@toss/tds-mobile";
import type { HistoryEntry } from "@/lib/types";

function NameList({ names, count }: { names: string[]; count: number }) {
  const extra = count - names.length;
  return (
    <>
      {names.map((name, idx) => (
        <Paragraph.Text key={`${idx}-${name}`} typography="t6">
          {name}
        </Paragraph.Text>
      ))}
      {extra > 0 && <Paragraph.Text typography="t6">외 {extra}개</Paragraph.Text>}
    </>
  );
}

/**
 * 이력 상세 바텀시트 — 원본·결과 파일명 목록 + '같은 도구로 다시 변환'.
 */
export function HistoryDetailSheet({
  entry,
  onClose,
  onRerun,
}: {
  entry: HistoryEntry | null;
  onClose: () => void;
  onRerun: (entry: HistoryEntry) => void;
}) {
  return (
    <BottomSheet open={!!entry} onClose={onClose}>
      {entry && (
        <>
          <Paragraph.Text typography="t5">원본 파일</Paragraph.Text>
          <Spacing size={8} />
          <NameList names={entry.inputNames} count={entry.inputCount} />
          <Spacing size={16} />
          <Paragraph.Text typography="t5">결과 파일</Paragraph.Text>
          <Spacing size={8} />
          <NameList names={entry.outputNames} count={entry.outputCount} />
          <Spacing size={16} />
          <Paragraph.Text typography="st13">
            앱은 변환한 파일을 보관하지 않아요. 저장한 파일은 사진 앱 또는 파일 앱에서 확인해주세요
          </Paragraph.Text>
          <Spacing size={16} />
          <Button variant="fill" size="large" display="block" onClick={() => onRerun(entry)}>
            같은 도구로 다시 변환
          </Button>
        </>
      )}
    </BottomSheet>
  );
}
