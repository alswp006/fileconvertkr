import { useState } from "react";
import { useNavigate, type NavigateFunction, type NavigateOptions } from "react-router-dom";
import { Chip, ChipItem, Paragraph, Spacing, Toast, Top } from "@toss/tds-mobile";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { SubmitFooter } from "@/components/BottomCTA";
import { FilePickSection } from "@/components/FilePickSection";
import { SelectedFileList } from "@/components/SelectedFileList";
import { convertHeic } from "@/lib/convert/heic";
import { runJob, buildJob } from "@/lib/runJob";
import { finishJob } from "@/lib/finishJob";
import { prefs } from "@/lib/storage/prefs";
import { generateId } from "@/lib/utils";
import { toolMeta } from "@/lib/toolMeta";
import { logClick } from "@/lib/analytics";
import type { ConversionOutput, InputFileMeta } from "@/lib/types";

type HeicFormat = "jpg" | "png";

export default function Heic() {
  const navigate = useNavigate();
  // 저장 후 이동 지점은 항상 결과 화면 — finishJob이 넘기는 state(jobId)만 그대로 전달한다
  const toResult = ((_to: unknown, options?: NavigateOptions) =>
    navigate("/result", options)) as NavigateFunction;
  const meta = toolMeta["heic"];
  const [files, setFiles] = useState<File[]>([]);
  const [format, setFormat] = useState<HeicFormat>(() => prefs.load().heicFormat);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [toastText, setToastText] = useState<string | null>(null);

  const isConverting = progress !== null;
  const canConvert = files.length >= meta.minFiles && !isConverting;

  function handleFormat(next: HeicFormat) {
    setFormat(next);
    prefs.save({ heicFormat: next });
  }

  async function handleConvert() {
    if (!canConvert) return;
    logClick("convert_start_heic");
    const startedAt = Date.now();
    setProgress({ done: 0, total: files.length });

    try {
      const { outputs, failures } = await runJob<ConversionOutput>(
        files,
        async (file) => {
          const result = await convertHeic(file, format);
          return [
            {
              id: generateId(),
              sourceName: file.name,
              fileName: result.fileName,
              mimeType: format === "png" ? "image/png" : "image/jpeg",
              sizeBytes: result.blob.size,
              sourceSizeBytes: file.size,
              blob: result.blob,
              objectUrl: URL.createObjectURL(result.blob),
            },
          ];
        },
        { onProgress: (done, total) => setProgress({ done, total }) }
      );

      if (outputs.length === 0) {
        setToastText("변환하지 못했어요. 다른 사진으로 다시 시도해 주세요");
        setProgress(null);
        return;
      }

      const inputs: InputFileMeta[] = files.map((file) => ({
        name: file.name,
        sizeBytes: file.size,
        mimeType: file.type,
      }));
      const job = buildJob(
        generateId(),
        "heic",
        { tool: "heic", format, quality: 0.92 },
        inputs,
        outputs,
        failures,
        Date.now() - startedAt
      );
      await finishJob(job, toResult);
    } catch {
      setToastText("변환하지 못했어요. 다시 시도해 주세요");
      setProgress(null);
    }
  }

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>{meta.title}</Top.TitleParagraph>} />}
      bottom={
        <SubmitFooter
          label="변환하기"
          onClick={() => {
            void handleConvert();
          }}
          disabled={!canConvert}
          loading={isConverting}
        />
      }
    >
      <Paragraph.Text typography="st11">아이폰 사진을 카톡·이메일에서 열리는 형식으로 바꿔요</Paragraph.Text>
      <Spacing size={16} />
      <Chip kind="select" wrap>
        <ChipItem selected={format === "jpg"} disabled={isConverting} onClick={() => handleFormat("jpg")}>
          JPG
        </ChipItem>
        <ChipItem selected={format === "png"} disabled={isConverting} onClick={() => handleFormat("png")}>
          PNG
        </ChipItem>
      </Chip>
      <Spacing size={16} />
      <FilePickSection
        tool="heic"
        selected={files}
        onAdd={(added) => setFiles((prev) => [...prev, ...added])}
        label="사진 선택"
        disabled={isConverting}
      />
      <Spacing size={16} />
      {isConverting && progress && (
        <>
          <Paragraph.Text typography="st11">
            {progress.done}/{progress.total} 변환 중
          </Paragraph.Text>
          <Spacing size={8} />
        </>
      )}
      {files.length === 0 ? (
        <Paragraph.Text typography="st11" color="var(--adaptiveGrey600)">
          변환할 HEIC 사진을 선택해주세요
        </Paragraph.Text>
      ) : (
        <SelectedFileList
          files={files}
          onRemove={(index) => setFiles((prev) => prev.filter((_, i) => i !== index))}
          disabled={isConverting}
        />
      )}
      <Spacing size={80} />
      <Toast open={toastText !== null} position="top" text={toastText ?? ""} onClose={() => setToastText(null)} />
    </ScreenScaffold>
  );
}
