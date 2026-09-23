import { Top } from "@toss/tds-mobile";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { toolMeta } from "@/lib/toolMeta";

// 라우팅 배선용 자리 화면 — 이 도구의 화면 패킷이 파일을 통째로 교체한다.
export default function Heic() {
  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>{toolMeta["heic"].title}</Top.TitleParagraph>} />}
    >
      {null}
    </ScreenScaffold>
  );
}
