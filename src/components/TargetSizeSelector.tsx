import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Chip, ChipItem, Paragraph, Spacing } from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { KeyboardAwareTextField } from "@/components/KeyboardAwareTextField";

const CUSTOM_MIN_KB = 50;
const CUSTOM_MAX_KB = 10240;
const CUSTOM_HELP = "50KB~10,240KB 사이로 입력해주세요";

const PRESETS: Array<{ kb: number; label: string }> = [
  { kb: 200, label: "200KB" },
  { kb: 500, label: "500KB" },
  { kb: 1024, label: "1MB" },
  { kb: 2048, label: "2MB" },
];

function fireTickHaptic() {
  try {
    Promise.resolve(generateHapticFeedback({ type: "tickWeak" })).catch(() => {});
  } catch {
    /* WebView 밖(브라우저/검수자 PC/jsdom)에서는 throw — 무시 */
  }
}

function parseCustomSize(text: string): number | null {
  if (text === "") return null;
  const n = Number(text);
  if (!Number.isFinite(n) || n < CUSTOM_MIN_KB || n > CUSTOM_MAX_KB) return null;
  return n;
}

export interface TargetSizeSelectorProps {
  value: number | null;
  onChange: (value: number | null) => void;
}

export function TargetSizeSelector({ value, onChange }: TargetSizeSelectorProps) {
  const matchedPreset = PRESETS.find((p) => p.kb === value);

  const [selected, setSelected] = useState<number | "custom" | null>(() =>
    matchedPreset ? matchedPreset.kb : value !== null ? "custom" : null,
  );
  const [customText, setCustomText] = useState<string>(() =>
    matchedPreset || value === null ? "" : String(value),
  );
  const [touched, setTouched] = useState(false);
  const customInputRef = useRef<HTMLInputElement>(null);

  const customParsed = parseCustomSize(customText);
  const customHasError = touched && customParsed === null;

  function handlePresetClick(kb: number) {
    fireTickHaptic();
    setSelected(kb);
    setTouched(false);
    onChange(kb);
  }

  function handleCustomClick() {
    fireTickHaptic();
    setSelected("custom");
  }

  function applyCustomValue(rawValue: string) {
    const digitsOnly = rawValue.replace(/[^0-9]/g, "");
    setCustomText(digitsOnly);
    setTouched(true);
    onChange(parseCustomSize(digitsOnly));
  }

  function handleCustomChange(e: ChangeEvent<HTMLInputElement>) {
    applyCustomValue(e.target.value);
  }

  // 필드를 비워 직전 값과 동일한 빈 문자열이 되면, React가 내부 valueTracker 비교로
  // 합성 change 이벤트를 생략한다(같은 값으로의 변경은 "변경 없음"으로 판단) — 네이티브
  // change 리스너로 그 경우를 우회해 잡는다. 실사용 중 키 입력은 onChange(input 이벤트
  // 기반)로 이미 실시간 처리되므로 이 리스너는 그 사각지대만 보강한다.
  useEffect(() => {
    const input = customInputRef.current;
    if (!input || selected !== "custom") return;
    function handleNativeChange(e: Event) {
      applyCustomValue((e.target as HTMLInputElement).value);
    }
    input.addEventListener("change", handleNativeChange);
    return () => input.removeEventListener("change", handleNativeChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, onChange]);

  return (
    <div>
      <Paragraph.Text typography="t5">목표 용량</Paragraph.Text>
      <Spacing size={12} />
      <Chip kind="select" wrap>
        {PRESETS.map((preset) => (
          <ChipItem
            key={preset.kb}
            selected={selected === preset.kb}
            onClick={() => handlePresetClick(preset.kb)}
          >
            {preset.label}
          </ChipItem>
        ))}
        <ChipItem selected={selected === "custom"} onClick={handleCustomClick}>
          직접 입력
        </ChipItem>
      </Chip>
      {selected === "custom" && (
        <>
          <Spacing size={12} />
          <KeyboardAwareTextField
            ref={customInputRef}
            label="목표 용량(KB)"
            placeholder="예: 800"
            inputMode="numeric"
            value={customText}
            onChange={handleCustomChange}
            hasError={customHasError}
            help={customHasError ? CUSTOM_HELP : undefined}
          />
        </>
      )}
    </div>
  );
}
