import { useState } from "react";
import { Toast } from "@toss/tds-mobile";
import { FilePickSection } from "@/components/FilePickSection";
import { loadPdf, PdfRenderError } from "@/lib/pdf/render";
import type { ToolType } from "@/lib/types";

export interface PdfSingleFilePickerProps {
  tool: ToolType;
  selected: File | null;
  onPicked: (file: File) => void;
  label: string;
  disabled?: boolean;
}

/**
 * 단일 PDF 선택기. FilePickSection(단일 모드)으로 고른 뒤 loadPdf로 암호·손상 PDF를 거른다.
 */
export function PdfSingleFilePicker({ tool, selected, onPicked, label, disabled }: PdfSingleFilePickerProps) {
  const [toastText, setToastText] = useState<string | null>(null);

  async function handleAdd(files: File[]) {
    const file = files[0];
    if (!file) return;

    try {
      await loadPdf(file);
      onPicked(file);
    } catch (err) {
      if (err instanceof PdfRenderError && err.code === "ENCRYPTED") {
        setToastText("암호가 걸린 PDF는 변환할 수 없어요");
      } else {
        setToastText("파일을 읽을 수 없어요. 다른 파일을 선택해주세요");
      }
    }
  }

  return (
    <>
      <FilePickSection
        tool={tool}
        selected={selected ? [selected] : []}
        onAdd={handleAdd}
        label={label}
        multiple={false}
        disabled={disabled}
      />
      <Toast
        open={toastText !== null}
        position="top"
        text={toastText ?? ""}
        onClose={() => setToastText(null)}
      />
    </>
  );
}
