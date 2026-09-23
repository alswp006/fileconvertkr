import { useState } from "react";
import { Asset, Button, ListRow, Toast } from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { deliverFile } from "@/lib/deliverFile";
import { formatBytes } from "@/lib/utils";
import type { ConversionOutput } from "@/lib/types";

function fireSuccessHaptic() {
  try {
    Promise.resolve(generateHapticFeedback({ type: "success" })).catch(() => {});
  } catch {
    /* WebView 밖(브라우저/검수자 PC/jsdom)에서는 throw — 무시 */
  }
}

type SaveStatus = "idle" | "saving" | "saved";

/**
 * 결과 파일 1건 — 저장 버튼을 눌러 deliverFile을 호출한다.
 * onSaveSuccess는 저장 성공마다 호출된다(리뷰 요청 트리거는 상위 FreeTier가 담당).
 */
export function OutputRow({
  output,
  onSaveSuccess,
}: {
  output: ConversionOutput;
  onSaveSuccess?: () => void;
}) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [toastText, setToastText] = useState<string | null>(null);
  const isImage = output.mimeType.startsWith("image/");

  const handleSave = async () => {
    setStatus("saving");
    try {
      await deliverFile(output);
      setStatus("saved");
      setToastText(isImage ? "사진을 저장했어요" : "파일을 저장했어요");
      fireSuccessHaptic();
      onSaveSuccess?.();
    } catch {
      setStatus("idle");
      setToastText("저장에 실패했어요. 다시 시도해주세요");
    }
  };

  const bottomText =
    output.note === "TARGET_NOT_REACHED"
      ? `목표 용량까지 줄이지 못했어요 (최소 ${formatBytes(output.sizeBytes)})`
      : `${formatBytes(output.sourceSizeBytes)} → ${formatBytes(output.sizeBytes)}`;

  return (
    <div data-testid="output-row">
      <ListRow
        left={
          isImage ? (
            <img
              src={output.objectUrl}
              alt=""
              style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover" }}
            />
          ) : (
            <Asset.ContentIcon name="iconFilePdfRegular" alt="PDF" />
          )
        }
        contents={<ListRow.Texts type="2RowTypeA" top={output.fileName} bottom={bottomText} />}
        right={
          <Button
            variant="weak"
            size="small"
            disabled={status !== "idle"}
            onClick={handleSave}
          >
            {status === "saved" ? "저장됨" : "저장"}
          </Button>
        }
      />
      <Toast
        open={toastText !== null}
        text={toastText ?? ""}
        position="top"
        onClose={() => setToastText(null)}
      />
    </div>
  );
}
