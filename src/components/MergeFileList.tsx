import { ListRow, Button, Paragraph } from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { formatBytes } from "@/lib/utils";

function fireTickHaptic() {
  try {
    Promise.resolve(generateHapticFeedback({ type: "tickWeak" })).catch(() => {});
  } catch {
    /* WebView 밖(브라우저/검수자 PC/jsdom)에서는 throw — 무시 */
  }
}

export interface MergeFileListProps {
  files: File[];
  pageCounts: Array<number | null>;
  onRemove: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  disabled?: boolean;
}

const HIT_AREA_STYLE = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: "44px",
  minHeight: "44px",
} as const;

/**
 * 합치기용 파일 목록. 순번 + 위로/아래로/삭제 버튼 + 페이지 확인 상태.
 */
export function MergeFileList({ files, pageCounts, onRemove, onMoveUp, onMoveDown, disabled }: MergeFileListProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {files.map((file, index) => {
        const pageCount = pageCounts[index] ?? null;
        const subtitle = pageCount === null ? "페이지 확인 중" : `${pageCount}페이지 · ${formatBytes(file.size)}`;

        return (
          <ListRow
            key={`${file.name}-${index}`}
            left={
              <div style={HIT_AREA_STYLE}>
                <Paragraph.Text typography="t6">{index + 1}</Paragraph.Text>
              </div>
            }
            contents={<ListRow.Texts type="2RowTypeA" top={file.name} bottom={subtitle} />}
            right={
              <div style={{ display: "flex", gap: 4 }}>
                <div data-testid="file-moveup-hitarea" style={HIT_AREA_STYLE}>
                  <Button
                    variant="weak"
                    size="small"
                    disabled={disabled || index === 0}
                    onClick={() => {
                      fireTickHaptic();
                      onMoveUp(index);
                    }}
                  >
                    위로
                  </Button>
                </div>
                <div data-testid="file-movedown-hitarea" style={HIT_AREA_STYLE}>
                  <Button
                    variant="weak"
                    size="small"
                    disabled={disabled || index === files.length - 1}
                    onClick={() => {
                      fireTickHaptic();
                      onMoveDown(index);
                    }}
                  >
                    아래로
                  </Button>
                </div>
                <div data-testid="file-delete-hitarea" style={HIT_AREA_STYLE}>
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
              </div>
            }
          />
        );
      })}
    </div>
  );
}
