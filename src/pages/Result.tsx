import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Spacing, Toast, Top } from "@toss/tds-mobile";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { AdSlot } from "@/components/AdSlot";
import { ExpiredView } from "@/components/result/ExpiredView";
import { FreeTier } from "@/components/result/FreeTier";
import { LockedSection } from "@/components/result/LockedSection";
import { ResultFooter } from "@/components/result/ResultFooter";
import { useResultNotices } from "@/hooks/useResultNotices";
import { jobStore } from "@/lib/jobStore";
import type { ResultRouteState } from "@/lib/types";

/**
 * 변환 결과 화면(공통 payoff).
 * route state의 jobId로 메모리 jobStore를 조회하고, 없으면 만료 화면만 보여준다.
 * 광고는 결과 콘텐츠 사이(mid)와 뒤(bottom)에만 둔다 — 화면 전체를 게이트로 감싸지 않는다.
 */
export default function Result() {
  const location = useLocation();
  const state = location.state as ResultRouteState | null;
  const jobId = typeof state?.jobId === "string" ? state.jobId : null;
  const job = jobId ? jobStore.getJob(jobId) : undefined;
  const { toastOpen, toastText } = useResultNotices();
  const [toastDismissed, setToastDismissed] = useState(false);

  if (!job) {
    return (
      <ScreenScaffold>
        <ExpiredView />
      </ScreenScaffold>
    );
  }

  const adGroupId = import.meta.env.VITE_TOSS_AD_GROUP_ID ?? "";

  return (
    <ScreenScaffold top={<Top title={<Top.TitleParagraph>변환 결과</Top.TitleParagraph>} />}>
      <Spacing size={16} />
      <FreeTier job={job} />
      <Spacing size={24} />
      <div data-testid="ad-slot-mid">
        <AdSlot adGroupId={adGroupId} />
      </div>
      <Spacing size={24} />
      <LockedSection job={job} />
      <Spacing size={24} />
      <div data-testid="ad-slot-bottom">
        <AdSlot adGroupId={adGroupId} />
      </div>
      <Spacing size={16} />
      <ResultFooter job={job} />
      <Toast
        open={toastOpen && !toastDismissed}
        position="top"
        text={toastText}
        onClose={() => setToastDismissed(true)}
      />
    </ScreenScaffold>
  );
}
