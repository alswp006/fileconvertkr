import { useState } from "react";
import { TossRewardAd } from "@/components/TossRewardAd";
import { LockedTeaser } from "./LockedTeaser";
import { LockedTier } from "./LockedTier";
import type { ConversionJob } from "@/lib/types";

/**
 * 잠금 섹션 — 잠금 안내는 게이트 바깥, 잠금 층(더 깊은 리포트)은 게이트 안.
 * 게이트가 열리면(locked-tier 마운트) 잠금 안내를 화면에서 지운다.
 * TossRewardAd 자체는 재설계·수정하지 않는다.
 */
export function LockedSection({ job }: { job: ConversionJob }) {
  const [unlocked, setUnlocked] = useState(false);

  return (
    <>
      {!unlocked ? <LockedTeaser outputsCount={job.outputs.length} /> : null}
      <div data-testid="locked-gate">
        <TossRewardAd
          slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID}
          buttonText="광고 보고 상세 리포트 열기"
        >
          <LockedTier job={job} onUnlocked={() => setUnlocked(true)} />
        </TossRewardAd>
      </div>
    </>
  );
}
