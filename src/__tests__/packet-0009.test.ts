/**
 * Packet 0009: 결과 화면 무료 층 컴포넌트 — FreeTier · ResultSummary · OutputRow · FailedList · ExpiredView
 *
 * TDD red phase — none of the source files exist yet. Tests define the expected
 * component contracts; the Coder implements src/components/result/*.tsx to satisfy them.
 *
 * Assumed contracts (see packet description + spec.md F7):
 *
 * src/components/result/ResultSummary.tsx
 *   props: { job: ConversionJob }
 *   - renders SummaryHero (or Card testId="result-summary" wrapping SummaryHero) with
 *     testId="result-summary"
 *   - value/unit/label by tool (spec table):
 *       heic          → value=outputs.length, unit='개', label='변환 완료'
 *       compress      → value=max(0, round((1 - outTotal/inTotal) * 100)), unit='%'
 *       (inTotal/outTotal = sum of outputs[].sourceSizeBytes / outputs[].sizeBytes)
 *
 * src/components/result/OutputRow.tsx
 *   props: { output: ConversionOutput; onSaveSuccess?: () => void }
 *   - data-testid="output-row" wrapping a ListRow with title=output.fileName
 *   - right slot: TDS Button "저장" (enabled). Tapping it calls deliverFile(output).
 *     - success: Toast '사진을 저장했어요' (image/*) or '파일을 저장했어요' (application/pdf),
 *       button label becomes "저장됨", onSaveSuccess?.() is called
 *     - failure (deliverFile rejects): Toast '저장에 실패했어요. 다시 시도해주세요',
 *       button label stays "저장", onSaveSuccess is NOT called
 *   - if output.note === 'TARGET_NOT_REACHED', row shows
 *     `목표 용량까지 줄이지 못했어요 (최소 ${formatBytes(output.sizeBytes)})`
 *
 * src/components/result/FailedList.tsx
 *   props: { failures: ConversionFailure[] }
 *   - data-testid="failed-list" Card. Title: `변환하지 못한 파일 ${failures.length}개`
 *   - one data-testid="failed-row" ListRow per failure (React key = failure.id)
 *   - row title: failure.fileName, UNLESS >=2 failures share the same fileName, in which
 *     case those rows' titles become `${fileName} (${inputIndex + 1}번째 파일)`
 *   - row subtitle: failure.message
 *
 * src/components/result/FreeTier.tsx
 *   props: { job: ConversionJob }
 *   - data-testid="free-tier" wrapping: ResultSummary, one OutputRow per job.outputs,
 *     and (only when job.failures.length > 0) FailedList
 *   - owns a "first successful save this screen session" flag shared across all its
 *     OutputRows: the FIRST successful save (across any row) triggers requestReviewOnce()
 *     exactly once; subsequent successful saves in the same FreeTier instance do not
 *     call it again
 *
 * src/components/result/ExpiredView.tsx
 *   props: none
 *   - renders ONLY: Asset.ContentIcon, text '변환 결과가 만료됐어요', and a "처음으로" Button
 *   - tapping "처음으로" calls navigate('/', { replace: true })
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockTds, mockRouter, mockNavigate } from "@/__tests__/__helpers__/mocks";
import type { ConversionJob, ConversionOutput, ConversionFailure } from "@/lib/types";

mockTds();
mockRouter();

vi.mock("@/lib/deliverFile", () => ({
  deliverFile: vi.fn(),
}));

vi.mock("@/lib/review", () => ({
  requestReviewOnce: vi.fn(),
}));

import { deliverFile } from "@/lib/deliverFile";
import { requestReviewOnce } from "@/lib/review";

function renderInRouter(ui: React.ReactElement) {
  return render(React.createElement(MemoryRouter, null, ui));
}

function makeOutput(overrides: Partial<ConversionOutput> = {}): ConversionOutput {
  return {
    id: "out-1",
    sourceName: "IMG_0001.jpg",
    fileName: "IMG_0001.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 500_000,
    sourceSizeBytes: 3_000_000,
    blob: new Blob(["x"], { type: "image/jpeg" }),
    objectUrl: "blob:test-1",
    ...overrides,
  };
}

function makeJob(overrides: Partial<ConversionJob> = {}): ConversionJob {
  return {
    jobId: "job-1",
    tool: "heic",
    createdAt: new Date().toISOString(),
    options: { tool: "heic", format: "jpg", quality: 0.92 },
    inputs: [],
    outputs: [],
    failures: [],
    durationMs: 500,
    status: "success",
    ...overrides,
  };
}

describe("결과 화면 무료 층 컴포넌트: FreeTier·ResultSummary·OutputRow·FailedList·ExpiredView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("FreeTier + ResultSummary — SummaryHero 값 (F7-AC-1, F7-AC-6/AC-11)", () => {
    it("F7-AC-1[P0]: heic job(3개)이면 SummaryHero 값 3·단위 '개'·라벨 '변환 완료', output-row 3개 모두 저장 버튼 enabled", async () => {
      const { FreeTier } = await import("@/components/result/FreeTier");
      const job = makeJob({
        tool: "heic",
        outputs: [
          makeOutput({ id: "o1", fileName: "IMG_0001.jpg" }),
          makeOutput({ id: "o2", fileName: "IMG_0002.jpg" }),
          makeOutput({ id: "o3", fileName: "IMG_0003.jpg" }),
        ],
      });

      renderInRouter(React.createElement(FreeTier, { job }));

      const freeTier = screen.getByTestId("free-tier");
      const summary = within(freeTier).getByTestId("result-summary");
      expect(within(summary).getByText("3개")).toBeInTheDocument();
      expect(within(summary).getByText("변환 완료")).toBeInTheDocument();

      const rows = within(freeTier).getAllByTestId("output-row");
      expect(rows).toHaveLength(3);
      for (const row of rows) {
        const saveButton = within(row).getByRole("button", { name: "저장" });
        expect(saveButton).toBeEnabled();
      }
    });

    it("F7-AC-6/AC-11[P1]: compress job(in 3,145,728 / out 509,952) + failures 1개면 SummaryHero 84·'%', failed-list 제목 '변환하지 못한 파일 1개'", async () => {
      const { FreeTier } = await import("@/components/result/FreeTier");
      const job = makeJob({
        tool: "compress",
        options: { tool: "compress", targetBytes: 512_000 },
        outputs: [
          makeOutput({
            id: "o1",
            fileName: "photo_compressed.jpg",
            sizeBytes: 509_952,
            sourceSizeBytes: 3_145_728,
          }),
        ],
        failures: [
          { id: "f1", inputIndex: 1, fileName: "broken.jpg", message: "파일을 읽을 수 없어요. 다른 파일을 선택해주세요" },
        ],
        status: "partial",
      });

      renderInRouter(React.createElement(FreeTier, { job }));

      const summary = screen.getByTestId("result-summary");
      expect(within(summary).getByText("84%")).toBeInTheDocument();

      const failedList = screen.getByTestId("failed-list");
      expect(within(failedList).getByText("변환하지 못한 파일 1개")).toBeInTheDocument();
    });
  });

  describe("OutputRow — 저장 (F7-AC-3, F7-AC-4)", () => {
    it("F7-AC-3[P0]: 저장 성공(jpg)이면 deliverFile 1회 호출, Toast '사진을 저장했어요', 라벨 '저장됨'. FreeTier 세션 첫 성공에서만 requestReviewOnce 1회", async () => {
      vi.mocked(deliverFile).mockResolvedValue(undefined);
      const { FreeTier } = await import("@/components/result/FreeTier");
      const output1 = makeOutput({ id: "o1", fileName: "IMG_0001.jpg", mimeType: "image/jpeg" });
      const output2 = makeOutput({ id: "o2", fileName: "IMG_0002.jpg", mimeType: "image/jpeg" });
      const job = makeJob({ tool: "heic", outputs: [output1, output2] });

      renderInRouter(React.createElement(FreeTier, { job }));

      const rows = screen.getAllByTestId("output-row");
      fireEvent.click(within(rows[0]).getByRole("button", { name: "저장" }));

      await screen.findByText("사진을 저장했어요");
      expect(deliverFile).toHaveBeenCalledTimes(1);
      expect(deliverFile).toHaveBeenCalledWith(output1);
      await within(rows[0]).findByRole("button", { name: "저장됨" });
      expect(requestReviewOnce).toHaveBeenCalledTimes(1);

      // Second successful save in the SAME free-tier session must not ask again.
      fireEvent.click(within(rows[1]).getByRole("button", { name: "저장" }));
      await within(rows[1]).findByRole("button", { name: "저장됨" });
      expect(deliverFile).toHaveBeenCalledTimes(2);
      expect(requestReviewOnce).toHaveBeenCalledTimes(1);
    });

    it("F7-AC-3[P0]: PDF 결과 저장 성공이면 Toast '파일을 저장했어요'", async () => {
      vi.mocked(deliverFile).mockResolvedValue(undefined);
      const { OutputRow } = await import("@/components/result/OutputRow");
      const output = makeOutput({
        id: "o1",
        fileName: "merged.pdf",
        mimeType: "application/pdf",
      });

      renderInRouter(React.createElement(OutputRow, { output }));

      fireEvent.click(screen.getByRole("button", { name: "저장" }));

      await screen.findByText("파일을 저장했어요");
      expect(deliverFile).toHaveBeenCalledWith(output);
    });

    it("F7-AC-4[P1]: deliverFile이 reject하면 Toast '저장에 실패했어요. 다시 시도해주세요', 라벨은 '저장' 유지, onSaveSuccess 미호출", async () => {
      vi.mocked(deliverFile).mockRejectedValue(new Error("save failed"));
      const { OutputRow } = await import("@/components/result/OutputRow");
      const onSaveSuccess = vi.fn();
      const output = makeOutput({ id: "o1", fileName: "IMG_0001.jpg" });

      renderInRouter(React.createElement(OutputRow, { output, onSaveSuccess }));

      fireEvent.click(screen.getByRole("button", { name: "저장" }));

      await screen.findByText("저장에 실패했어요. 다시 시도해주세요");
      expect(screen.getByRole("button", { name: "저장" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "저장됨" })).not.toBeInTheDocument();
      expect(onSaveSuccess).not.toHaveBeenCalled();
      expect(requestReviewOnce).not.toHaveBeenCalled();
    });
  });

  describe("OutputRow — 목표 용량 미달 표기 (F3-AC-4/F7-AC-5)", () => {
    it("F3-AC-4/F7-AC-5[P1]: note가 TARGET_NOT_REACHED이고 크기 626,688B면 '목표 용량까지 줄이지 못했어요 (최소 612KB)' 표시", async () => {
      const { OutputRow } = await import("@/components/result/OutputRow");
      const output = makeOutput({
        id: "o1",
        fileName: "photo_compressed.jpg",
        sizeBytes: 626_688,
        note: "TARGET_NOT_REACHED",
      });

      renderInRouter(React.createElement(OutputRow, { output }));

      expect(
        screen.getByText("목표 용량까지 줄이지 못했어요 (최소 612KB)"),
      ).toBeInTheDocument();
    });
  });

  describe("FailedList — 중복 파일명 표기 (F7-AC-11)", () => {
    it("F7-AC-11[P1]: 같은 fileName 2개는 '(N번째 파일)'로 구분되고 부제는 각 message", async () => {
      const { FailedList } = await import("@/components/result/FailedList");
      const failures: ConversionFailure[] = [
        { id: "f-a", inputIndex: 0, fileName: "photo.jpg", message: "파일을 읽을 수 없어요. 다른 파일을 선택해주세요" },
        { id: "f-b", inputIndex: 2, fileName: "photo.jpg", message: "변환 시간이 너무 오래 걸려서 중단했어요" },
      ];

      renderInRouter(React.createElement(FailedList, { failures }));

      const list = screen.getByTestId("failed-list");
      expect(within(list).getByText("변환하지 못한 파일 2개")).toBeInTheDocument();

      const rows = within(list).getAllByTestId("failed-row");
      expect(rows).toHaveLength(2);
      expect(within(rows[0]).getByText("photo.jpg (1번째 파일)")).toBeInTheDocument();
      expect(within(rows[0]).getByText("파일을 읽을 수 없어요. 다른 파일을 선택해주세요")).toBeInTheDocument();
      expect(within(rows[1]).getByText("photo.jpg (3번째 파일)")).toBeInTheDocument();
      expect(within(rows[1]).getByText("변환 시간이 너무 오래 걸려서 중단했어요")).toBeInTheDocument();
    });
  });

  describe("ExpiredView (F7-AC-5)", () => {
    it("F7-AC-5[P1]: Asset.ContentIcon·'변환 결과가 만료됐어요'·'처음으로'만 렌더하고, 탭하면 navigate('/', { replace: true })", async () => {
      const { ExpiredView } = await import("@/components/result/ExpiredView");

      renderInRouter(React.createElement(ExpiredView, null));

      expect(screen.getByText("변환 결과가 만료됐어요")).toBeInTheDocument();
      expect(document.querySelector("[data-content-icon]")).toBeInTheDocument();
      expect(screen.queryByTestId("free-tier")).not.toBeInTheDocument();
      expect(screen.queryByTestId("locked-teaser")).not.toBeInTheDocument();

      const homeButton = screen.getByRole("button", { name: "처음으로" });
      fireEvent.click(homeButton);
      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });
  });
});
