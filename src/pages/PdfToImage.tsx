import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Chip, ChipItem, Paragraph, Spacing, Toast, Top } from "@toss/tds-mobile";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { SubmitFooter } from "@/components/BottomCTA";
import { PdfSingleFilePicker } from "@/components/PdfSingleFilePicker";
import { SelectedFileList } from "@/components/SelectedFileList";
import { KeyboardAwareTextField } from "@/components/KeyboardAwareTextField";
import { loadPdf, renderPageToBlob } from "@/lib/pdf/render";
import { parsePageRanges, formatPageNumber } from "@/lib/pdf/pageRanges";
import { buildJob } from "@/lib/runJob";
import { finishJob } from "@/lib/finishJob";
import { prefs } from "@/lib/storage/prefs";
import { generateId, formatBytes } from "@/lib/utils";
import { toolMeta } from "@/lib/toolMeta";
import { logClick } from "@/lib/analytics";
import type { ConversionOutput } from "@/lib/types";

const MAX_PAGES = 50;
const RANGE_INVALID = "페이지 범위를 확인해주세요 (예: 1-3, 5)";

function stripExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? name : name.slice(0, dot);
}

export default function PdfToImage() {
  const navigate = useNavigate();
  const meta = toolMeta["pdf-to-image"];
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [format, setFormat] = useState<"jpg" | "png">(() => prefs.load().pdfImageFormat);
  const [scale, setScale] = useState<1.5 | 2>(() => prefs.load().pdfImageScale);
  const [mode, setMode] = useState<"all" | "range">("all");
  const [rangeText, setRangeText] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [toastText, setToastText] = useState<string | null>(null);

  const isConverting = progress !== null;

  let pages: number[] = [];
  let helpText: string | undefined;
  if (totalPages !== null) {
    if (mode === "all") {
      pages = Array.from({ length: totalPages }, (_, i) => i + 1);
    } else if (rangeText.trim() !== "") {
      const parsed = parsePageRanges(rangeText, totalPages);
      if (parsed.ok) pages = parsed.pages;
      else helpText = parsed.code === "OUT_OF_RANGE" ? `문서는 총 ${totalPages}페이지예요` : RANGE_INVALID;
    }
    if (!helpText && pages.length > MAX_PAGES) {
      helpText = `한 번에 최대 ${MAX_PAGES}페이지까지 변환할 수 있어요. 범위를 지정해주세요`;
    }
  }
  const canConvert = file !== null && totalPages !== null && pages.length > 0 && !helpText && !isConverting;

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

  async function handleConvert() {
    if (!canConvert || !file || totalPages === null) return;
    logClick("convert_start_pdf_to_image");
    const startedAt = Date.now();
    setProgress({ done: 0, total: pages.length });

    try {
      const pdf = await loadPdf(file);
      const base = stripExtension(file.name);
      const mimeType = format === "png" ? "image/png" : "image/jpeg";
      const outputs: ConversionOutput[] = [];
      for (let i = 0; i < pages.length; i++) {
        const blob = await renderPageToBlob(pdf, pages[i], scale, format === "png" ? "png" : "jpeg");
        outputs.push({
          id: generateId(),
          sourceName: file.name,
          fileName: `${base}_p${formatPageNumber(pages[i], totalPages)}.${format}`,
          mimeType,
          sizeBytes: blob.size,
          sourceSizeBytes: file.size,
          blob,
          objectUrl: URL.createObjectURL(blob),
        });
        setProgress({ done: i + 1, total: pages.length });
      }

      const job = buildJob(
        generateId(),
        "pdf-to-image",
        { tool: "pdf-to-image", format, scale, pages },
        [{ name: file.name, sizeBytes: file.size, mimeType: file.type, pageCount: totalPages }],
        outputs,
        [],
        Date.now() - startedAt
      );
      await finishJob(job, navigate);
    } catch {
      setToastText("이미지로 바꾸지 못했어요. 다시 시도해주세요");
      setProgress(null);
    }
  }

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>{meta.title}</Top.TitleParagraph>} />}
      bottom={
        <SubmitFooter
          label="이미지로 변환"
          onClick={() => {
            void handleConvert();
          }}
          disabled={!canConvert}
          loading={isConverting}
        />
      }
    >
      <Paragraph.Text typography="st11">페이지를 사진으로 저장해요</Paragraph.Text>
      <Spacing size={16} />
      <PdfSingleFilePicker
        tool="pdf-to-image"
        selected={file}
        onPicked={(f) => void handlePicked(f)}
        label="PDF 선택"
        disabled={isConverting || checking}
      />
      <Spacing size={16} />
      {checking && <Paragraph.Text typography="st11">PDF 확인 중</Paragraph.Text>}
      {!file && !checking && (
        <Paragraph.Text typography="st11" color="grey600">
          이미지로 바꿀 PDF를 선택해주세요
        </Paragraph.Text>
      )}
      {file && totalPages !== null && (
        <>
          <SelectedFileList files={[file]} onRemove={handleRemove} disabled={isConverting} />
          <Paragraph.Text typography="st13" color="grey500">
            {totalPages}페이지 · {formatBytes(file.size)}
          </Paragraph.Text>
          <Spacing size={24} />
          <Paragraph.Text typography="t5">형식</Paragraph.Text>
          <Spacing size={12} />
          <div style={{ margin: "0 -20px" }}><Chip kind="select" wrap>
            <ChipItem
              selected={format === "jpg"}
              onClick={() => {
                setFormat("jpg");
                prefs.save({ pdfImageFormat: "jpg" });
              }}
            >
              JPG
            </ChipItem>
            <ChipItem
              selected={format === "png"}
              onClick={() => {
                setFormat("png");
                prefs.save({ pdfImageFormat: "png" });
              }}
            >
              PNG
            </ChipItem>
          </Chip></div>
          <Spacing size={24} />
          <Paragraph.Text typography="t5">화질</Paragraph.Text>
          <Spacing size={12} />
          <div style={{ margin: "0 -20px" }}><Chip kind="select" wrap>
            <ChipItem
              selected={scale === 1.5}
              onClick={() => {
                setScale(1.5);
                prefs.save({ pdfImageScale: 1.5 });
              }}
            >
              보통
            </ChipItem>
            <ChipItem
              selected={scale === 2}
              onClick={() => {
                setScale(2);
                prefs.save({ pdfImageScale: 2 });
              }}
            >
              고화질
            </ChipItem>
          </Chip></div>
          <Spacing size={24} />
          <Paragraph.Text typography="t5">페이지</Paragraph.Text>
          <Spacing size={12} />
          <div style={{ margin: "0 -20px" }}><Chip kind="select" wrap>
            <ChipItem selected={mode === "all"} onClick={() => setMode("all")}>
              전체
            </ChipItem>
            <ChipItem selected={mode === "range"} onClick={() => setMode("range")}>
              범위 지정
            </ChipItem>
          </Chip></div>
          <Spacing size={12} />
          {mode === "range" && (
            <KeyboardAwareTextField
              label="페이지 범위"
              labelOption="sustain"
              placeholder="예: 1-3, 5"
              inputMode="text"
              value={rangeText}
              onChange={(e) => setRangeText(e.target.value)}
              hasError={Boolean(helpText)}
              help={helpText}
              disabled={isConverting}
            />
          )}
          {mode === "all" && helpText && (
            <Paragraph.Text typography="st13" color="red500">
              {helpText}
            </Paragraph.Text>
          )}
        </>
      )}
      {progress && (
        <>
          <Spacing size={16} />
          <Paragraph.Text typography="st11">
            {progress.done}/{progress.total} 페이지 변환 중
          </Paragraph.Text>
        </>
      )}
      <Spacing size={80} />
      <Toast open={toastText !== null} position="top" text={toastText ?? ""} onClose={() => setToastText(null)} />
    </ScreenScaffold>
  );
}
