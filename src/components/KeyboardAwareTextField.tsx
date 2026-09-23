import { forwardRef, type FocusEvent, type KeyboardEvent } from "react";
import { TextField, type TextFieldProps } from "@toss/tds-mobile";

export interface KeyboardAwareTextFieldProps
  extends Omit<TextFieldProps, "variant" | "enterKeyHint" | "onFocus" | "onKeyDown" | "placeholder"> {
  variant?: "box" | "line" | "big" | "hero";
  // box/line variant는 플로팅 라벨이라 빈 칸+비포커스에서 라벨이 위로 떠 숨는다 →
  // 안내 문구 없이는 빈 회색 박스가 된다. 항상 명시하도록 필수로 둔다.
  placeholder: string;
}

function handleFocus(e: FocusEvent<HTMLInputElement>) {
  e.target.scrollIntoView({ block: "center" });
}

function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === "Enter") {
    e.currentTarget.blur();
  }
}

/**
 * 모바일 키보드가 입력 필드를 가리지 않도록 focus 시 화면 중앙으로 스크롤하고,
 * Enter 입력을 제출이 아닌 포커스 해제로 처리하는 TDS TextField 래퍼.
 */
export const KeyboardAwareTextField = forwardRef<HTMLInputElement, KeyboardAwareTextFieldProps>(
  function KeyboardAwareTextField({ variant = "line", placeholder, ...props }, ref) {
    return (
      <TextField
        ref={ref}
        variant={variant}
        placeholder={placeholder}
        enterKeyHint="done"
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        {...props}
      />
    );
  },
);
