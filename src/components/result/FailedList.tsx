import { ListRow, Paragraph, Spacing } from "@toss/tds-mobile";
import { Card } from "@/components/Card";
import type { ConversionFailure } from "@/lib/types";

/**
 * 변환하지 못한 파일 목록. 같은 파일명이 2개 이상이면 각 행에 몇 번째 파일인지 덧붙인다.
 */
export function FailedList({ failures }: { failures: ConversionFailure[] }) {
  const nameCounts = new Map<string, number>();
  for (const failure of failures) {
    nameCounts.set(failure.fileName, (nameCounts.get(failure.fileName) ?? 0) + 1);
  }

  return (
    <Card testId="failed-list">
      <Paragraph.Text typography="st11">
        변환하지 못한 파일 {failures.length}개
      </Paragraph.Text>
      <Spacing size={8} />
      {failures.map((failure) => {
        const title =
          (nameCounts.get(failure.fileName) ?? 0) >= 2
            ? `${failure.fileName} (${failure.inputIndex + 1}번째 파일)`
            : failure.fileName;

        return (
          <div data-testid="failed-row" key={failure.id}>
            <ListRow
              contents={<ListRow.Texts type="2RowTypeA" top={title} bottom={failure.message} />}
            />
          </div>
        );
      })}
    </Card>
  );
}
