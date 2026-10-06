import { useState } from "react";
import { useNavigate, type NavigateFunction, type NavigateOptions } from "react-router-dom";
import { Paragraph, Spacing, Toast, Top } from "@toss/tds-mobile";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { SubmitFooter } from "@/components/BottomCTA";
import { FilePickSection } from "@/components/FilePickSection";
import { SelectedFileList } from "@/components/SelectedFileList";
import { TargetSizeSelector } from "@/components/TargetSizeSelector";
import { compressToTarget } from "@/lib/convert/compress";
import { runJob, buildJob } from "@/lib/runJob";
import { finishJob } from "@/lib/finishJob";
import { prefs } from "@/lib/storage/prefs";
import { generateId } from "@/lib/utils";
import { toolMeta } from "@/lib/toolMeta";
import { logClick } from "@/lib/analytics";
import type { ConversionOutput, InputFileMeta } from "@/lib/types";

export default function Compress() {
  const navigate = useNavigate();
  // 저장 후 이동 지점은 항상 결과 화면 — finishJob이 넘기는 state(jobId)만 그대로 전달한다
  const toResult = ((_to: unknown, options?: NavigateOptions) =>
    navigate("/result", options)) as NavigateFunction;
  const meta = toolMeta["compress"];
  const [files, setFiles] = useState<File[]>([]);
  const [targetKB, setTargetKB] = useState<number | null>(() => prefs.load().compressTargetKB);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [toastText, setToastText] = useState<string | null>(null);

  const isCompressing = progress !== null;
  const canCompress = files.length >= meta.minFiles && targetKB !== null && !isCompressing;

  function handleTarget(kb: number | null) {
    setTargetKB(kb);
    if (kb !== null) prefs.save({ compressTargetKB: kb });
  }

  async function handleCompress() {
    if (!canCompress || targetKB === null) return;
    logClick("convert_start_compress");
    const startedAt = Date.now();
    const targetBytes = targetKB * 1024;
    setProgress({ done: 0, total: files.length });

    try {
      const { outputs, failures } = await runJob<ConversionOutput>(
        files,
        async (file) => {
          const result = await compressToTarget(file, targetBytes);
          return [
            {
              id: generateId(),
              sourceName: file.name,
              fileName: result.fileName,
              mimeType: result.mimeType,
              sizeBytes: result.sizeBytes,
              sourceSizeBytes: result.sourceSizeBytes,
              blob: result.blob,
              objectUrl: URL.createObjectURL(result.blob),
              width: result.width,
              height: result.height,
              note: result.note,
            },
          ];
        },
        { onProgress: (done, total) => setProgress({ done, total }) }
      );

      if (outputs.length === 0) {
        setToastText("압축하지 못했어요. 다른 사진으로 다시 시도해 주세요");
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
        "compress",
        { tool: "compress", targetBytes },
        inputs,
        outputs,
        failures,
        Date.now() - startedAt
      );
      await finishJob(job, toResult);
    } catch {
      setToastText("압축하지 못했어요. 다시 시도해 주세요");
      setProgress(null);
    }
  }

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>{meta.title}</Top.TitleParagraph>} />}
      bottom={
        <SubmitFooter
          label="압축하기"
          onClick={() => {
            void handleCompress();
          }}
          disabled={!canCompress}
          loading={isCompressing}
        />
      }
    >
      <Paragraph.Text typography="t6">목표 용량 이하로 사진을 줄여요</Paragraph.Text>
      <Spacing size={16} />
      <TargetSizeSelector value={targetKB} onChange={handleTarget} />
      <Spacing size={16} />
      <FilePickSection
        tool="compress"
        selected={files}
        onAdd={(added) => setFiles((prev) => [...prev, ...added])}
        label="사진 선택"
        disabled={isCompressing}
      />
      <Spacing size={16} />
      {isCompressing && progress && (
        <>
          <Paragraph.Text typography="t6">
            {progress.done}/{progress.total} 압축 중
          </Paragraph.Text>
          <Spacing size={8} />
        </>
      )}
      {files.length === 0 ? (
        <Paragraph.Text typography="t6" color="var(--adaptiveGrey600)">
          줄일 사진을 선택해주세요
        </Paragraph.Text>
      ) : (
        <SelectedFileList
          files={files}
          onRemove={(index) => setFiles((prev) => prev.filter((_, i) => i !== index))}
          disabled={isCompressing}
        />
      )}
      <Spacing size={80} />
      <Toast open={toastText !== null} position="top" text={toastText ?? ""} onClose={() => setToastText(null)} />
    </ScreenScaffold>
  );
}
