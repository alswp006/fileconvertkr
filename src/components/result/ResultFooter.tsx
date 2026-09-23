import { useNavigate } from "react-router-dom";
import { ButtonStack } from "@/components/BottomCTA";
import { logClick } from "@/lib/analytics";
import { shareApp } from "@/lib/share";
import { toolMeta } from "@/lib/toolMeta";
import type { ConversionJob } from "@/lib/types";

/**
 * 결과 화면 하단 CTA — 공유(1차) + 다른 파일 변환하기(2차).
 */
export function ResultFooter({ job }: { job: ConversionJob }) {
  const navigate = useNavigate();

  return (
    <ButtonStack
      primary={{
        label: "공유하기",
        onClick: () => {
          logClick("result_share");
          void shareApp({ message: "변환한 파일을 확인해보세요", path: "/result" });
        },
      }}
      secondary={{
        label: "다른 파일 변환하기",
        onClick: () => {
          logClick("result_convert_again");
          navigate(toolMeta[job.tool].route);
        },
      }}
    />
  );
}
