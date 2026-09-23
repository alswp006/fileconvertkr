/**
 * Packet 0008: 입력 컴포넌트 — KeyboardAwareTextField · TargetSizeSelector
 *
 * TDD red phase — none of the source files exist yet. Tests define the expected
 * component contracts; the Coder implements src/components/*.tsx to satisfy them.
 *
 * Component contracts assumed by these tests (see packet description + spec.md F3 화면 정의):
 *
 * KeyboardAwareTextField.tsx
 *   props: same as TDS TextField (label, value, onChange, hasError?, help?, placeholder?, inputMode?, ...)
 *   - wraps TDS `TextField`
 *   - always sets `enterKeyHint="done"` on the rendered input
 *   - forwards `inputMode` prop through unchanged
 *   - on focus: calls `event.target.scrollIntoView({ block: 'center' })`
 *   - on keydown "Enter": calls `event.target.blur()`
 *
 * TargetSizeSelector.tsx
 *   props: { value: number | null; onChange: (value: number | null) => void }
 *   - renders 5 Chips: 200KB / 500KB / 1MB / 2MB / 직접입력 (spec F3 화면 정의)
 *   - tapping a preset Chip calls onChange(presetValueInKB) and marks that Chip selected
 *   - tapping "직접 입력" Chip reveals a KeyboardAwareTextField (label "목표 용량(KB)",
 *     inputMode="numeric") for free-form entry
 *   - the free-form field only accepts digit characters — non-digit keystrokes (e.g. "abc")
 *     do not change the field's value
 *   - when the free-form value parses to a number outside [50, 10240] (or is empty),
 *     the field shows hasError with help text "50KB~10,240KB 사이로 입력해주세요"
 *     and onChange(null) is called
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockTds, mockRouter } from "@/__tests__/__helpers__/mocks";

mockTds();
mockRouter();

function renderInRouter(ui: React.ReactElement) {
  return render(React.createElement(MemoryRouter, null, ui));
}

describe("입력 컴포넌트: KeyboardAwareTextField·TargetSizeSelector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("KeyboardAwareTextField (F6-AC-7 단독 렌더)", () => {
    it("F6-AC-7[P1]: focus 시 scrollIntoView({ block: 'center' })가 호출되고, inputMode/enterKeyHint가 설정되며 Enter로 blur된다", async () => {
      const { KeyboardAwareTextField } = await import("@/components/KeyboardAwareTextField");
      renderInRouter(
        React.createElement(KeyboardAwareTextField, {
          label: "나눌 범위",
          placeholder: "예: 1-3, 4-6",
          value: "",
          onChange: vi.fn(),
        }),
      );

      const input = screen.getByPlaceholderText("예: 1-3, 4-6") as HTMLInputElement;
      const scrollIntoView = vi.fn();
      input.scrollIntoView = scrollIntoView;

      fireEvent.focus(input);
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(scrollIntoView).toHaveBeenCalledWith({ block: "center" });
      expect(input.getAttribute("enterKeyHint") ?? input.getAttribute("enterkeyhint")).toBe("done");

      const blurSpy = vi.spyOn(input, "blur");
      fireEvent.keyDown(input, { key: "Enter" });
      expect(blurSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("TargetSizeSelector — 목표 용량 프리셋 (F3 화면 정의)", () => {
    it("AC-x[P0]: '500KB' Chip을 탭하면 onChange(500)이 호출되고 해당 Chip이 selected가 된다", async () => {
      const { TargetSizeSelector } = await import("@/components/TargetSizeSelector");
      const onChange = vi.fn();
      renderInRouter(
        React.createElement(TargetSizeSelector, { value: null, onChange }),
      );

      const chip500 = screen.getByText("500KB").closest("button") as HTMLButtonElement;
      fireEvent.click(chip500);

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(500);
      expect(chip500.getAttribute("aria-pressed")).toBe("true");
    });

    it("F3-AC-5[P1]: 직접 입력에 30을 입력하면 hasError이고 helperText가 정확히 표시되며 onChange(null)이 호출된다", async () => {
      const { TargetSizeSelector } = await import("@/components/TargetSizeSelector");
      const onChange = vi.fn();
      renderInRouter(
        React.createElement(TargetSizeSelector, { value: null, onChange }),
      );

      fireEvent.click(screen.getByText("직접 입력"));
      const input = screen.getByRole("textbox") as HTMLInputElement;

      fireEvent.change(input, { target: { value: "30" } });
      expect(screen.getByRole("alert")).toHaveTextContent("50KB~10,240KB 사이로 입력해주세요");
      expect(onChange).toHaveBeenCalledWith(null);
    });

    it("F3-AC-5[P1]: 직접 입력에 빈 문자열 또는 20000을 입력해도 같은 범위 오류와 onChange(null)이 발생한다", async () => {
      const { TargetSizeSelector } = await import("@/components/TargetSizeSelector");
      const onChange = vi.fn();
      renderInRouter(
        React.createElement(TargetSizeSelector, { value: null, onChange }),
      );

      fireEvent.click(screen.getByText("직접 입력"));
      const input = screen.getByRole("textbox") as HTMLInputElement;

      fireEvent.change(input, { target: { value: "" } });
      expect(screen.getByRole("alert")).toHaveTextContent("50KB~10,240KB 사이로 입력해주세요");

      fireEvent.change(input, { target: { value: "20000" } });
      expect(screen.getByRole("alert")).toHaveTextContent("50KB~10,240KB 사이로 입력해주세요");

      expect(onChange).toHaveBeenCalledWith(null);
      expect(onChange).not.toHaveBeenCalledWith(expect.any(Number));
    });

    it("F3-AC-5[P1]: 직접 입력 필드에 'abc'를 입력해도 필드 값이 바뀌지 않는다(숫자 외 문자 필터)", async () => {
      const { TargetSizeSelector } = await import("@/components/TargetSizeSelector");
      const onChange = vi.fn();
      renderInRouter(
        React.createElement(TargetSizeSelector, { value: null, onChange }),
      );

      fireEvent.click(screen.getByText("직접 입력"));
      const input = screen.getByRole("textbox") as HTMLInputElement;

      fireEvent.change(input, { target: { value: "abc" } });
      expect(input.value).toBe("");
      expect(onChange).not.toHaveBeenCalledWith(expect.any(Number));
    });

    it("F3-AC-7[P1]: 직접 입력 TextField에 focus하면 scrollIntoView center가 1회 호출되고 numeric/done 속성을 가지며 Enter로 blur된다", async () => {
      const { TargetSizeSelector } = await import("@/components/TargetSizeSelector");
      renderInRouter(
        React.createElement(TargetSizeSelector, { value: null, onChange: vi.fn() }),
      );

      fireEvent.click(screen.getByText("직접 입력"));
      const input = screen.getByRole("textbox") as HTMLInputElement;

      expect(input.getAttribute("inputMode") ?? input.getAttribute("inputmode")).toBe("numeric");
      expect(input.getAttribute("enterKeyHint") ?? input.getAttribute("enterkeyhint")).toBe("done");

      const scrollIntoView = vi.fn();
      input.scrollIntoView = scrollIntoView;
      fireEvent.focus(input);
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(scrollIntoView).toHaveBeenCalledWith({ block: "center" });

      const blurSpy = vi.spyOn(input, "blur");
      fireEvent.keyDown(input, { key: "Enter" });
      expect(blurSpy).toHaveBeenCalledTimes(1);
    });
  });
});
