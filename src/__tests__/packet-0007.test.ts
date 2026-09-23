/**
 * Packet 0007: 파일 선택 컴포넌트 — FilePickSection · SelectedFileList · MergeFileList · PdfSingleFilePicker
 *
 * TDD red phase — none of the source files exist yet. Tests define the expected
 * component contracts; the Coder implements src/components/*.tsx to satisfy them.
 *
 * Component contracts assumed by these tests (see packet description + spec.md F2/F4/F5):
 *
 * FilePickSection.tsx
 *   props: { tool: ToolType; selected: File[]; onAdd: (files: File[]) => void; label: string; multiple?: boolean }
 *   - renders a hidden `<input type="file" data-testid="file-input" />`, opened via a TDS Button labeled `label`
 *   - on change: merges [...selected, ...newFiles], runs validateFiles(merged, tool)
 *   - if validation produces any error: shows a TDS `Toast` (position="top") with the first error's message,
 *     does NOT call onAdd, and resets `input.value = ''`
 *   - if valid: calls onAdd(newFiles)
 *
 * SelectedFileList.tsx
 *   props: { files: File[]; onRemove: (index: number) => void }
 *   - renders one row per file (title = file.name)
 *   - each row has a "삭제" button; clicking row i calls onRemove(i)
 *   - the delete button's 44x44 hit-area wrapper carries `data-testid="file-delete-hitarea"`
 *     with inline style minWidth: '44px', minHeight: '44px'
 *
 * MergeFileList.tsx
 *   props: {
 *     files: File[];
 *     pageCounts: Array<number | null>; // null = page count not yet known
 *     onRemove: (index: number) => void;
 *     onMoveUp: (index: number) => void;
 *     onMoveDown: (index: number) => void;
 *   }
 *   - renders one row per file with "위로"/"아래로"/"삭제" buttons
 *   - first row's "위로" is disabled; last row's "아래로" is disabled; all others enabled
 *   - a row whose pageCounts[i] is null shows subtitle text "페이지 확인 중"
 *
 * PdfSingleFilePicker.tsx
 *   props: { tool: ToolType; selected: File | null; onPicked: (file: File) => void; label: string }
 *   - reuses FilePickSection internally (single-file mode) — exposes the same `data-testid="file-input"`
 *   - after a file passes validateFiles, calls `loadPdf` (from @/lib/pdf/render) to confirm it's readable
 *   - loadPdf rejecting with PdfRenderError(code: 'ENCRYPTED') → Toast "암호가 걸린 PDF는 변환할 수 없어요"
 *   - loadPdf rejecting with anything else → Toast "파일을 읽을 수 없어요. 다른 파일을 선택해주세요"
 *   - in both failure cases, onPicked is NOT called
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockTds, mockRouter } from "@/__tests__/__helpers__/mocks";

mockTds();
mockRouter();

vi.mock("@/lib/pdf/render", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pdf/render")>()),
  loadPdf: vi.fn(),
}));

function renderInRouter(ui: React.ReactElement) {
  return render(React.createElement(MemoryRouter, null, ui));
}

function makeFile(name: string, sizeBytes: number, type: string): File {
  return new File(["x".repeat(sizeBytes)], name, { type });
}

function fireFileChange(input: HTMLElement, files: File[]) {
  fireEvent.change(input, { target: { files } });
}

describe("파일 선택 컴포넌트: FilePickSection·SelectedFileList·MergeFileList·PdfSingleFilePicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("FilePickSection", () => {
    it("F2-AC-5[P1]: HEIC가 아닌 파일을 고르면 Toast를 띄우고 onAdd를 호출하지 않는다", async () => {
      const { FilePickSection } = await import("@/components/FilePickSection");
      const onAdd = vi.fn();

      renderInRouter(
        React.createElement(FilePickSection, {
          tool: "heic",
          selected: [],
          onAdd,
          label: "사진 선택",
        }),
      );

      const input = screen.getByTestId("file-input");
      const scanPdf = makeFile("scan.pdf", 1024, "application/pdf");
      fireFileChange(input, [scanPdf]);

      const toast = await screen.findByRole("status");
      expect(toast).toHaveTextContent("HEIC 파일만 선택할 수 있어요");
      expect(toast).toHaveAttribute("data-position", "top");
      expect(onAdd).not.toHaveBeenCalled();
      expect((input as HTMLInputElement).value).toBe("");
    });

    it("F4-AC-5[P1]: 이미 84MB가 선택된 상태에서 28MB를 더하면 합계 초과 Toast를 띄우고 onAdd를 호출하지 않는다", async () => {
      const { FilePickSection } = await import("@/components/FilePickSection");
      const onAdd = vi.fn();
      const MB = 1024 * 1024;
      const existing = [
        makeFile("a.pdf", 28 * MB, "application/pdf"),
        makeFile("b.pdf", 28 * MB, "application/pdf"),
        makeFile("c.pdf", 28 * MB, "application/pdf"),
      ];

      renderInRouter(
        React.createElement(FilePickSection, {
          tool: "pdf-merge",
          selected: existing,
          onAdd,
          label: "PDF 선택",
        }),
      );

      const input = screen.getByTestId("file-input");
      const newFile = makeFile("d.pdf", 28 * MB, "application/pdf");
      fireFileChange(input, [newFile]);

      const toast = await screen.findByRole("status");
      expect(toast).toHaveTextContent("전체 용량은 최대 100MB까지 가능해요");
      expect(onAdd).not.toHaveBeenCalled();
    }, 20000);
  });

  describe("SelectedFileList", () => {
    it("F2-AC-8[P2]: 2행 중 첫 행의 '삭제'를 누르면 onRemove(0)이 호출되고, 삭제 버튼 hit area는 44px", async () => {
      const { SelectedFileList } = await import("@/components/SelectedFileList");
      const onRemove = vi.fn();
      const files = [
        makeFile("IMG_0001.heic", 2_202_009, "image/heic"),
        makeFile("IMG_0002.heic", 1_887_437, "image/heic"),
      ];

      renderInRouter(React.createElement(SelectedFileList, { files, onRemove }));

      const deleteButtons = screen.getAllByRole("button", { name: "삭제" });
      expect(deleteButtons).toHaveLength(2);

      fireEvent.click(deleteButtons[0]);
      expect(onRemove).toHaveBeenCalledTimes(1);
      expect(onRemove).toHaveBeenCalledWith(0);

      const hitAreas = screen.getAllByTestId("file-delete-hitarea");
      expect(hitAreas[0].style.minWidth).toBe("44px");
      expect(hitAreas[0].style.minHeight).toBe("44px");
    });
  });

  describe("MergeFileList", () => {
    it("F4-AC-7[P2]: 첫 행 '위로'와 마지막 행 '아래로'만 disabled, pageCount null 행은 '페이지 확인 중'", async () => {
      const { MergeFileList } = await import("@/components/MergeFileList");
      const onRemove = vi.fn();
      const onMoveUp = vi.fn();
      const onMoveDown = vi.fn();
      const files = [
        makeFile("a.pdf", 100_000, "application/pdf"),
        makeFile("b.pdf", 200_000, "application/pdf"),
        makeFile("c.pdf", 300_000, "application/pdf"),
      ];

      renderInRouter(
        React.createElement(MergeFileList, {
          files,
          pageCounts: [3, 2, null],
          onRemove,
          onMoveUp,
          onMoveDown,
        }),
      );

      const upButtons = screen.getAllByRole("button", { name: "위로" });
      const downButtons = screen.getAllByRole("button", { name: "아래로" });
      expect(upButtons).toHaveLength(3);
      expect(downButtons).toHaveLength(3);

      expect(upButtons[0]).toBeDisabled();
      expect(upButtons[1]).not.toBeDisabled();
      expect(upButtons[2]).not.toBeDisabled();
      expect(downButtons[0]).not.toBeDisabled();
      expect(downButtons[1]).not.toBeDisabled();
      expect(downButtons[2]).toBeDisabled();

      expect(screen.getByText("페이지 확인 중")).toBeInTheDocument();

      fireEvent.click(upButtons[1]);
      expect(onMoveUp).toHaveBeenCalledWith(1);
    });
  });

  describe("PdfSingleFilePicker", () => {
    it("F5-AC-6[P1]: 암호화된 PDF는 Toast '암호가 걸린 PDF는 변환할 수 없어요'를 띄우고 onPicked를 호출하지 않는다", async () => {
      const { PdfSingleFilePicker } = await import("@/components/PdfSingleFilePicker");
      const { loadPdf, PdfRenderError } = await import("@/lib/pdf/render");
      vi.mocked(loadPdf).mockRejectedValueOnce(new PdfRenderError("ENCRYPTED"));

      const onPicked = vi.fn();
      renderInRouter(
        React.createElement(PdfSingleFilePicker, {
          tool: "pdf-to-image",
          selected: null,
          onPicked,
          label: "PDF 선택",
        }),
      );

      const input = screen.getByTestId("file-input");
      const secretPdf = makeFile("secret.pdf", 1024, "application/pdf");
      fireFileChange(input, [secretPdf]);

      const toast = await screen.findByRole("status");
      expect(toast).toHaveTextContent("암호가 걸린 PDF는 변환할 수 없어요");
      expect(onPicked).not.toHaveBeenCalled();
    });

    it("F5-AC-6[P1]: 손상된(그 밖의) PDF 실패는 Toast '파일을 읽을 수 없어요. 다른 파일을 선택해주세요'를 띄우고 onPicked를 호출하지 않는다", async () => {
      const { PdfSingleFilePicker } = await import("@/components/PdfSingleFilePicker");
      const { loadPdf } = await import("@/lib/pdf/render");
      vi.mocked(loadPdf).mockRejectedValueOnce(new Error("corrupt"));

      const onPicked = vi.fn();
      renderInRouter(
        React.createElement(PdfSingleFilePicker, {
          tool: "pdf-to-image",
          selected: null,
          onPicked,
          label: "PDF 선택",
        }),
      );

      const input = screen.getByTestId("file-input");
      const brokenPdf = makeFile("broken.pdf", 1024, "application/pdf");
      fireFileChange(input, [brokenPdf]);

      const toast = await screen.findByRole("status");
      expect(toast).toHaveTextContent("파일을 읽을 수 없어요. 다른 파일을 선택해주세요");
      expect(onPicked).not.toHaveBeenCalled();
    });
  });
});
