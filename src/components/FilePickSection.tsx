import { useRef, useState, type ChangeEvent } from "react";
import { Button, Toast } from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { validateFiles } from "@/lib/validateFiles";
import { toolMeta } from "@/lib/toolMeta";
import type { ToolType } from "@/lib/types";

function fireTickHaptic() {
  try {
    Promise.resolve(generateHapticFeedback({ type: "tickWeak" })).catch(() => {});
  } catch {
    /* WebView 밖(브라우저/검수자 PC/jsdom)에서는 throw — 무시 */
  }
}

export interface FilePickSectionProps {
  tool: ToolType;
  selected: File[];
  onAdd: (files: File[]) => void;
  label: string;
  multiple?: boolean;
  disabled?: boolean;
}

/**
 * 숨김 input을 TDS Button으로 여는 파일 선택 섹션.
 * 기존 선택 + 새 파일을 합쳐 validateFiles로 검사하고, 실패하면 Toast(top)로 알린다.
 */
export function FilePickSection({ tool, selected, onAdd, label, multiple, disabled }: FilePickSectionProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [toastText, setToastText] = useState<string | null>(null);
  const meta = toolMeta[tool];

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const newFiles = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (newFiles.length === 0) return;

    const merged = [...selected, ...newFiles];
    const { errors } = validateFiles(merged, tool);
    if (errors.length > 0) {
      setToastText(errors[0].message);
      return;
    }
    onAdd(newFiles);
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        data-testid="file-input"
        accept={meta.accept}
        multiple={multiple ?? meta.maxFiles > 1}
        onChange={handleChange}
        style={{ display: "none" }}
      />
      <Button
        variant="weak"
        display="block"
        disabled={disabled}
        onClick={() => {
          fireTickHaptic();
          inputRef.current?.click();
        }}
      >
        {label}
      </Button>
      <Toast
        open={toastText !== null}
        position="top"
        text={toastText ?? ""}
        onClose={() => setToastText(null)}
      />
    </>
  );
}
