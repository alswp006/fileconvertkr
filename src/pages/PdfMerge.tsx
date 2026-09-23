import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Paragraph, Spacing, Toast, Top } from "@toss/tds-mobile";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { SubmitFooter } from "@/components/BottomCTA";
import { FilePickSection } from "@/components/FilePickSection";
import { MergeFileList } from "@/components/MergeFileList";
import { readPdfPageCount, mergePdfs, PdfError } from "@/lib/pdf/merge";
import { buildJob } from "@/lib/runJob";
import { finishJob } from "@/lib/finishJob";
import { generateId, formatBytes } from "@/lib/utils";
import { toolMeta } from "@/lib/toolMeta";
import { logClick } from "@/lib/analytics";
import type { ConversionOutput, InputFileMeta } from "@/lib/types";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function buildMergedFileName(now: Date): string {
  const y = now.getFullYear();
  const m = pad2(now.getMonth() + 1);
  const d = pad2(now.getDate());
  const hh = pad2(now.getHours());
  const mm = pad2(now.getMinutes());
  return `합친문서_${y}${m}${d}_${hh}${mm}.pdf`;
}

export default function PdfMerge() {
  const navigate = useNavigate();
  const meta = toolMeta["pdf-merge"];
  const [files, setFiles] = useState<File[]>([]);
  const [pageCounts, setPageCounts] = useState<Array<number | null>>([]);
  const [isMerging, setIsMerging] = useState(false);
  const [toastText, setToastText] = useState<string | null>(null);

  async function handleAdd(newFiles: File[]) {
    const startIndex = files.length;
    setFiles((prev) => [...prev, ...newFiles]);
    setPageCounts((prev) => [...prev, ...newFiles.map(() => null)]);

    for (let i = 0; i < newFiles.length; i++) {
      const file = newFiles[i];
      const index = startIndex + i;
      try {
        const pageCount = await readPdfPageCount(file);
        setPageCounts((prev) => {
          const next = [...prev];
          next[index] = pageCount;
          return next;
        });
      } catch (err) {
        const message =
          err instanceof PdfError && err.code === "ENCRYPTED"
            ? `암호가 걸린 PDF는 합칠 수 없어요: ${file.name}`
            : `PDF를 읽을 수 없어요: ${file.name}`;
        setToastText(message);
        setFiles((prev) => prev.filter((f) => f !== file));
        setPageCounts((prev) => prev.filter((_, idx) => idx !== index));
      }
    }
  }

  function handleRemove(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPageCounts((prev) => prev.filter((_, i) => i !== index));
  }

  function swap<T>(arr: T[], a: number, b: number): T[] {
    const next = [...arr];
    [next[a], next[b]] = [next[b], next[a]];
    return next;
  }

  function handleMoveUp(index: number) {
    if (index === 0) return;
    setFiles((prev) => swap(prev, index - 1, index));
    setPageCounts((prev) => swap(prev, index - 1, index));
  }

  function handleMoveDown(index: number) {
    if (index === files.length - 1) return;
    setFiles((prev) => swap(prev, index, index + 1));
    setPageCounts((prev) => swap(prev, index, index + 1));
  }

  const readingPages = pageCounts.some((count) => count === null);
  const canMerge = files.length >= meta.minFiles && !readingPages && !isMerging;

  async function handleMerge() {
    if (!canMerge) return;
    logClick("convert_start_pdf_merge");
    setIsMerging(true);
    const startedAt = Date.now();

    try {
      const result = await mergePdfs(files);
      if (!result.ok) {
        setToastText(
          result.code === "ENCRYPTED" ? "암호가 걸린 PDF는 합칠 수 없어요" : "PDF를 읽을 수 없어요"
        );
        setIsMerging(false);
        return;
      }

      const inputs: InputFileMeta[] = files.map((file, index) => ({
        name: file.name,
        sizeBytes: file.size,
        mimeType: file.type,
        pageCount: pageCounts[index] ?? undefined,
      }));
      const sourceSizeBytes = files.reduce((sum, file) => sum + file.size, 0);
      const output: ConversionOutput = {
        id: generateId(),
        sourceName: files[0].name,
        fileName: buildMergedFileName(new Date()),
        mimeType: "application/pdf",
        sizeBytes: result.blob.size,
        sourceSizeBytes,
        blob: result.blob,
        objectUrl: URL.createObjectURL(result.blob),
        pageCount: result.pageCount,
      };

      const job = buildJob(
        generateId(),
        "pdf-merge",
        { tool: "pdf-merge" },
        inputs,
        [output],
        [],
        Date.now() - startedAt
      );

      await finishJob(job, navigate);
    } catch {
      setToastText("PDF를 합치지 못했어요. 다시 시도해주세요");
      setIsMerging(false);
    }
  }

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>{meta.title}</Top.TitleParagraph>} />}
      bottom={
        <SubmitFooter
          label={isMerging ? "문서 합치는 중" : "합치기"}
          onClick={() => {
            void handleMerge();
          }}
          disabled={!canMerge}
          loading={isMerging}
        />
      }
    >
      <Paragraph.Text typography="st11">위에 있는 파일부터 순서대로 합쳐요</Paragraph.Text>
      <Spacing size={16} />
      <FilePickSection tool="pdf-merge" selected={files} onAdd={(f) => void handleAdd(f)} label="PDF 선택" disabled={isMerging} />
      <Spacing size={16} />
      {files.length === 0 ? (
        <Paragraph.Text typography="st11" color="grey600">
          합칠 PDF 파일을 2개 이상 선택해주세요
        </Paragraph.Text>
      ) : (
        <>
          <MergeFileList
            files={files}
            pageCounts={pageCounts}
            onRemove={handleRemove}
            onMoveUp={handleMoveUp}
            onMoveDown={handleMoveDown}
            disabled={isMerging}
          />
          {files.length === 1 && (
            <Paragraph.Text typography="st11" color="grey600">
              2개 이상 선택해주세요
            </Paragraph.Text>
          )}
          <Spacing size={4} />
          <Paragraph.Text typography="st13" color="grey500">
            총 {formatBytes(files.reduce((sum, f) => sum + f.size, 0))}
          </Paragraph.Text>
        </>
      )}
      <Toast open={toastText !== null} position="top" text={toastText ?? ""} onClose={() => setToastText(null)} />
    </ScreenScaffold>
  );
}
