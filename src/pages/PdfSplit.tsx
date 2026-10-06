import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Chip, ChipItem, Paragraph, Spacing, Toast, Top } from "@toss/tds-mobile";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { SubmitFooter } from "@/components/BottomCTA";
import { PdfSingleFilePicker } from "@/components/PdfSingleFilePicker";
import { SelectedFileList } from "@/components/SelectedFileList";
import { KeyboardAwareTextField } from "@/components/KeyboardAwareTextField";
import { loadPdf } from "@/lib/pdf/render";
import { parseRangeGroups, type RangeGroup } from "@/lib/pdf/pageRanges";
import { splitPdf } from "@/lib/pdf/split";
import { buildJob } from "@/lib/runJob";
import { finishJob } from "@/lib/finishJob";
import { generateId, formatBytes } from "@/lib/utils";
import { toolMeta } from "@/lib/toolMeta";
import { logClick } from "@/lib/analytics";
import type { ConversionOutput } from "@/lib/types";

const MAX_FILES = 50;
const RANGE_INVALID = "페이지 범위를 확인해주세요 (예: 1-3, 5)";

export default function PdfSplit() {
  const navigate = useNavigate();
  const meta = toolMeta["pdf-split"];
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [mode, setMode] = useState<"each" | "ranges">("each");
  const [rangeText, setRangeText] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [toastText, setToastText] = useState<string | null>(null);

  const isSplitting = progress !== null;

  let groups: RangeGroup[] = [];
  let helpText: string | undefined;
  if (totalPages !== null) {
    if (mode === "each") {
      if (totalPages === 1) helpText = "1페이지 문서는 나눌 수 없어요";
      else groups = Array.from({ length: totalPages }, (_, i) => ({ start: i + 1, end: i + 1 }));
    } else if (rangeText.trim() !== "") {
      const parsed = parseRangeGroups(rangeText, totalPages);
      if (parsed.ok) groups = parsed.groups;
      else helpText = parsed.code === "OUT_OF_RANGE" ? `문서는 총 ${totalPages}페이지예요` : RANGE_INVALID;
    }
    if (!helpText && groups.length > MAX_FILES) {
      helpText =
        mode === "each"
          ? `한 번에 최대 ${MAX_FILES}개 파일로 나눌 수 있어요. 범위로 나눠주세요`
          : `한 번에 최대 ${MAX_FILES}개 파일로 나눌 수 있어요`;
    }
  }
  const canSplit = file !== null && totalPages !== null && groups.length > 0 && !helpText && !isSplitting;

  async function handlePicked(picked: File) {
    setChecking(true);
    try {
      const pdf = await loadPdf(picked);
      setFile(picked);
      setTotalPages(pdf.numPages);
    } catch {
      setToastText("파일을 읽을 수 없어요. 다른 파일을 선택해주세요");
    } finally {
      setChecking(false);
    }
  }

  function handleRemove() {
    setFile(null);
    setTotalPages(null);
    setRangeText("");
  }

  async function handleSplit() {
    if (!canSplit || !file || totalPages === null) return;
    logClick("convert_start_pdf_split");
    const startedAt = Date.now();
    setProgress({ done: 0, total: groups.length });

    try {
      const result = await splitPdf(file, groups, totalPages, (done, total) => setProgress({ done, total }));
      if (!result.ok) {
        setToastText(
          result.code === "ENCRYPTED" ? "암호가 걸린 PDF는 나눌 수 없어요" : "파일을 읽을 수 없어요. 다른 파일을 선택해주세요"
        );
        setProgress(null);
        return;
      }

      const outputs: ConversionOutput[] = result.outputs.map((out) => ({
        id: generateId(),
        sourceName: file.name,
        fileName: out.fileName,
        mimeType: "application/pdf",
        sizeBytes: out.blob.size,
        sourceSizeBytes: file.size,
        blob: out.blob,
        objectUrl: URL.createObjectURL(out.blob),
        pageCount: out.pageCount,
      }));

      const job = buildJob(
        generateId(),
        "pdf-split",
        { tool: "pdf-split", mode, groups },
        [{ name: file.name, sizeBytes: file.size, mimeType: file.type, pageCount: totalPages }],
        outputs,
        [],
        Date.now() - startedAt
      );
      await finishJob(job, navigate);
    } catch {
      setToastText("PDF를 나누지 못했어요. 다시 시도해주세요");
      setProgress(null);
    }
  }

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>{meta.title}</Top.TitleParagraph>} />}
      bottom={
        <SubmitFooter
          label="나누기"
          onClick={() => {
            void handleSplit();
          }}
          disabled={!canSplit}
          loading={isSplitting}
        />
      }
    >
      <Paragraph.Text typography="t6">페이지별·범위별로 PDF를 나눠요</Paragraph.Text>
      <Spacing size={16} />
      <PdfSingleFilePicker
        tool="pdf-split"
        selected={file}
        onPicked={(f) => void handlePicked(f)}
        label="PDF 선택"
        disabled={isSplitting || checking}
      />
      <Spacing size={16} />
      {checking && <Paragraph.Text typography="t6">PDF 확인 중</Paragraph.Text>}
      {!file && !checking && (
        <Paragraph.Text typography="t6" color="grey600">
          나눌 PDF를 선택해주세요
        </Paragraph.Text>
      )}
      {file && totalPages !== null && (
        <>
          <SelectedFileList files={[file]} onRemove={handleRemove} disabled={isSplitting} />
          <Paragraph.Text typography="st13" color="grey500">
            {totalPages}페이지 · {formatBytes(file.size)}
          </Paragraph.Text>
          <Spacing size={24} />
          <Paragraph.Text typography="t5">나누는 방법</Paragraph.Text>
          <Spacing size={12} />
          <div style={{ margin: "0 -20px" }}><Chip kind="select" wrap>
            <ChipItem selected={mode === "each"} onClick={() => setMode("each")}>
              페이지마다
            </ChipItem>
            <ChipItem selected={mode === "ranges"} onClick={() => setMode("ranges")}>
              범위로
            </ChipItem>
          </Chip></div>
          <Spacing size={12} />
          {mode === "ranges" && (
            <KeyboardAwareTextField
              label="나눌 범위"
              labelOption="sustain"
              placeholder="예: 1-3, 4-6"
              inputMode="text"
              value={rangeText}
              onChange={(e) => setRangeText(e.target.value)}
              hasError={Boolean(helpText)}
              help={helpText}
              disabled={isSplitting}
            />
          )}
          {mode === "each" && helpText && (
            <Paragraph.Text typography="st13" color="red500">
              {helpText}
            </Paragraph.Text>
          )}
          {groups.length > 0 && !helpText && (
            <>
              <Spacing size={12} />
              <Paragraph.Text typography="t6">{groups.length}개 파일로 나눠요</Paragraph.Text>
            </>
          )}
        </>
      )}
      {progress && (
        <>
          <Spacing size={16} />
          <Paragraph.Text typography="t6">
            {progress.done}/{progress.total} 파일 만드는 중
          </Paragraph.Text>
        </>
      )}
      <Spacing size={80} />
      <Toast open={toastText !== null} position="top" text={toastText ?? ""} onClose={() => setToastText(null)} />
    </ScreenScaffold>
  );
}
