import { ListRow, Button } from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { formatBytes } from "@/lib/utils";

function fireTickHaptic() {
  try {
    Promise.resolve(generateHapticFeedback({ type: "tickWeak" })).catch(() => {});
  } catch {
    /* WebView 밖(브라우저/검수자 PC/jsdom)에서는 throw — 무시 */
  }
}

export interface SelectedFileListProps {
  files: File[];
  onRemove: (index: number) => void;
  disabled?: boolean;
}

/**
 * 선택된 파일 목록. 행마다 파일명·용량 + 44px hit area 삭제 버튼.
 */
export function SelectedFileList({ files, onRemove, disabled }: SelectedFileListProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {files.map((file, index) => (
        <ListRow
          key={`${file.name}-${index}`}
          contents={<ListRow.Texts type="2RowTypeA" top={file.name} bottom={formatBytes(file.size)} />}
          right={
            <div
              data-testid="file-delete-hitarea"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", minWidth: "44px", minHeight: "44px" }}
            >
              <Button
                variant="weak"
                size="small"
                disabled={disabled}
                onClick={() => {
                  fireTickHaptic();
                  onRemove(index);
                }}
              >
                삭제
              </Button>
            </div>
          }
        />
      ))}
    </div>
  );
}
