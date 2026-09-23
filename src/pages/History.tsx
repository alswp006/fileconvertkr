import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertDialog, Asset, Button, Paragraph, Spacing, Top } from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { EmptyState } from "@/components/StateView";
import { FloatingTabBar } from "@/components/FloatingTabBar";
import { HistorySummary } from "@/components/history/HistorySummary";
import { HistoryList } from "@/components/history/HistoryList";
import { HistoryDetailSheet } from "@/components/history/HistoryDetailSheet";
import { historyRepo } from "@/lib/storage/historyRepo";
import { toolMeta } from "@/lib/toolMeta";
import { logClick } from "@/lib/analytics";
import type { HistoryEntry } from "@/lib/types";

function haptic(type: "tickWeak" | "success") {
  try {
    Promise.resolve(generateHapticFeedback({ type })).catch(() => {});
  } catch {
    /* WebView 밖에서는 throw — 무시 */
  }
}

const TAB_ITEMS = [
  { label: "홈", path: "/" },
  { label: "이력", path: "/history" },
];

export default function History() {
  const navigate = useNavigate();
  // historyRepo.load()는 마운트당 1회(lazy initializer)만 호출한다 — 이후 변경은 state로만 반영.
  const [entries, setEntries] = useState<HistoryEntry[]>(() => historyRepo.load());
  const [selected, setSelected] = useState<HistoryEntry | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0)),
    [entries],
  );

  const handleSelect = (entry: HistoryEntry) => {
    haptic("tickWeak");
    setSelected(entry);
  };

  const handleRerun = (entry: HistoryEntry) => {
    haptic("success");
    logClick("history_rerun");
    setSelected(null);
    navigate(toolMeta[entry.tool].route);
  };

  const openConfirm = () => {
    haptic("tickWeak");
    setConfirmOpen(true);
  };

  const closeConfirm = () => setConfirmOpen(false);

  const handleDeleteAll = () => {
    haptic("success");
    historyRepo.clear();
    setEntries([]);
    setConfirmOpen(false);
  };

  const isEmpty = entries.length === 0;

  return (
    <ScreenScaffold
      top={
        <Top
          title={<Top.TitleParagraph>변환 이력</Top.TitleParagraph>}
          right={
            !isEmpty && (
              <Button variant="weak" size="small" onClick={openConfirm}>
                전체 삭제
              </Button>
            )
          }
        />
      }
    >
      {isEmpty ? (
        <EmptyState
          icon={<Asset.ContentIcon name="iconFolderRegular" alt="빈 이력" />}
          title="아직 변환한 파일이 없어요"
          action={
            <Button variant="weak" onClick={() => navigate("/")}>
              파일 변환하러 가기
            </Button>
          }
        />
      ) : (
        <>
          <HistorySummary entries={entries} />
          <Spacing size={24} />
          <Paragraph.Text typography="t5">최근 변환</Paragraph.Text>
          <Spacing size={12} />
          <HistoryList entries={sortedEntries} onSelect={handleSelect} />
        </>
      )}

      <Spacing size={80} />
      <FloatingTabBar items={TAB_ITEMS} />

      <HistoryDetailSheet entry={selected} onClose={() => setSelected(null)} onRerun={handleRerun} />

      <AlertDialog
        open={confirmOpen}
        title="변환 이력을 모두 삭제할까요?"
        alertButton={
          <>
            <AlertDialog.AlertButton onClick={closeConfirm}>취소</AlertDialog.AlertButton>
            <AlertDialog.AlertButton onClick={handleDeleteAll}>삭제</AlertDialog.AlertButton>
          </>
        }
        onClose={closeConfirm}
      />
    </ScreenScaffold>
  );
}
