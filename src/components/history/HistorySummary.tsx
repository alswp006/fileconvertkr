import { Amount } from "@/components/Amount";
import { SummaryHero } from "@/components/SummaryHero";
import { Sparkline } from "@/components/Sparkline";
import type { HistoryEntry } from "@/lib/types";

const DAY_MS = 24 * 60 * 60 * 1000;
const dateKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" });

function seoulDateKey(iso: string): string {
  return dateKeyFmt.format(new Date(iso));
}

function last7DateKeys(now: Date): string[] {
  const keys: string[] = [];
  for (let i = 6; i >= 0; i--) {
    keys.push(dateKeyFmt.format(new Date(now.getTime() - i * DAY_MS)));
  }
  return keys;
}

/**
 * 이력 요약 카드 — 총 변환 파일 수(SummaryHero) + 최근 7일 추이(Sparkline, 기록 2일↑일 때만).
 */
export function HistorySummary({ entries }: { entries: HistoryEntry[] }) {
  const totalOutputCount = entries.reduce((sum, entry) => sum + entry.outputCount, 0);

  const dateKeys = last7DateKeys(new Date());
  const dailyOutputs = new Map<string, number>(dateKeys.map((key) => [key, 0]));
  const activeDays = new Set<string>();
  for (const entry of entries) {
    const key = seoulDateKey(entry.createdAt);
    if (!dailyOutputs.has(key)) continue;
    dailyOutputs.set(key, (dailyOutputs.get(key) ?? 0) + entry.outputCount);
    activeDays.add(key);
  }
  const showSparkline = activeDays.size >= 2;
  const daily7 = dateKeys.map((key) => dailyOutputs.get(key) ?? 0);

  return (
    <SummaryHero
      testId="history-summary"
      label="총 변환 파일"
      value={<Amount value={totalOutputCount} unit="개" typography="t1" />}
      action={showSparkline ? <Sparkline data={daily7} /> : undefined}
    />
  );
}
