import { ListRow } from "@toss/tds-mobile";
import { toolMeta } from "@/lib/toolMeta";
import { formatBytes } from "@/lib/utils";
import type { HistoryEntry } from "@/lib/types";

const dateTimeFmt = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function fmtDate(iso: string): string {
  const parts = dateTimeFmt.formatToParts(new Date(iso)).reduce<Record<string, string>>((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.year}.${parts.month}.${parts.day} ${parts.hour}:${parts.minute}`;
}

/**
 * 최근 변환 이력 목록 — 최대 100행, 페이지네이션 없음(전달받은 entries를 그대로 렌더).
 */
export function HistoryList({
  entries,
  onSelect,
}: {
  entries: HistoryEntry[];
  onSelect: (entry: HistoryEntry) => void;
}) {
  return (
    <>
      {entries.map((entry) => {
        const top = `${toolMeta[entry.tool].title} · 파일 ${entry.inputCount}개`;
        const base = `${fmtDate(entry.createdAt)} · ${formatBytes(entry.inputTotalBytes)} → ${formatBytes(entry.outputTotalBytes)}`;
        const bottom = entry.status === "partial" ? `${base} · 실패 ${entry.failedCount}개` : base;
        return (
          <ListRow
            key={entry.id}
            data-testid="history-row"
            onClick={() => onSelect(entry)}
            contents={<ListRow.Texts type="2RowTypeA" top={top} bottom={bottom} />}
          />
        );
      })}
    </>
  );
}
