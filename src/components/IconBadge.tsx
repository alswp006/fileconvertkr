import type { ReactNode } from "react";

/**
 * 고정 크기 아이콘 칸 — CDN 에셋 없이 lucide 아이콘을 담는다(로딩 실패·alt 노출 없음).
 * ListRow left 슬롯과 EmptyState 아이콘에서 폭을 일정하게 맞추기 위해 쓴다.
 */
export function IconBadge({ children, size = 40 }: { children: ReactNode; size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: size / 4,
        backgroundColor: "var(--adaptiveGrey100)",
        color: "var(--adaptiveGrey700)",
      }}
    >
      {children}
    </span>
  );
}
