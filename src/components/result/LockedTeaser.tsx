import { Paragraph, Spacing } from "@toss/tds-mobile";
import { Card } from "@/components/Card";

/**
 * 잠금 안내 카드 — TossRewardAd 바깥, 게이트가 열리기 전(①②③)에만 표시된다.
 * 결과 수치·파일명·미리보기는 넣지 않는다(그건 잠금 층의 몫).
 */
export function LockedTeaser({ outputsCount }: { outputsCount: number }) {
  const multi = outputsCount >= 2;

  return (
    <Card testId="locked-teaser">
      <Paragraph.Text typography="t5">
        {multi ? "파일별 상세 리포트 · 모두 저장" : "파일별 상세 리포트"}
      </Paragraph.Text>
      <Spacing size={4} />
      <Paragraph.Text typography="st11">
        {multi
          ? "아래 버튼으로 짧은 광고를 보면 파일마다 줄어든 용량과 해상도를 확인하고, 결과 파일을 한 번에 저장할 수 있어요"
          : "아래 버튼으로 짧은 광고를 보면 파일마다 줄어든 용량과 해상도를 확인할 수 있어요"}
      </Paragraph.Text>
    </Card>
  );
}
