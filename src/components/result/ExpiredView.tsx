import { useNavigate } from "react-router-dom";
import { Button } from "@toss/tds-mobile";
import { AlertCircle } from "lucide-react";
import { IconBadge } from "@/components/IconBadge";
import { EmptyState } from "@/components/StateView";

/**
 * 저장된 objectUrl이 만료돼 더 이상 볼 수 없는 결과 화면 대체 뷰.
 */
export function ExpiredView() {
  const navigate = useNavigate();

  return (
    <EmptyState
      icon={<IconBadge size={56}><AlertCircle size={28} /></IconBadge>}
      title="변환 결과가 만료됐어요"
      action={
        <Button display="block" onClick={() => navigate("/", { replace: true })}>
          처음으로
        </Button>
      }
    />
  );
}
