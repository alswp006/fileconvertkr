import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { ResultRouteState } from "@/lib/types";

const HISTORY_SAVE_FAILED_TEXT =
  "이력을 저장하지 못했어요. 변환 파일은 그대로 저장할 수 있어요";

/**
 * 결과 화면 알림 훅 — 이력 저장 실패 Toast를 1회만 띄우고, route state의
 * historySaveFailed 플래그를 제거한다(뒤로가기·재렌더로 Toast가 다시 뜨지 않게).
 */
export function useResultNotices(): { toastOpen: boolean; toastText: string } {
  const location = useLocation();
  const navigate = useNavigate();
  const [toastOpen, setToastOpen] = useState(false);
  const hasHandledRef = useRef(false);

  useEffect(() => {
    if (hasHandledRef.current) return;
    const state = location.state as ResultRouteState | null;
    if (!state?.historySaveFailed) return;
    hasHandledRef.current = true;
    setToastOpen(true);
    navigate(location.pathname, { replace: true, state: { jobId: state.jobId } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { toastOpen, toastText: toastOpen ? HISTORY_SAVE_FAILED_TEXT : "" };
}
