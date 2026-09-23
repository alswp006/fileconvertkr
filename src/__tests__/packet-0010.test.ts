/**
 * Packet 0010: 결과 화면 잠금 섹션 · 하단 버튼 · 결과 알림 훅
 *
 * TDD red phase — none of the source files exist yet. Tests define the expected
 * component/hook contracts; the Coder implements the files below to satisfy them.
 *
 * Assumed contracts (see packet description + spec.md F7):
 *
 * src/components/result/LockedSection.tsx
 *   props: { job: ConversionJob }
 *   - renders locked-teaser (data-testid="locked-teaser") while the ad gate is closed
 *   - renders `<div data-testid="locked-gate">` wrapping
 *     `<TossRewardAd slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID}><LockedTier job={job} onUnlocked={...} /></TossRewardAd>`
 *   - when the gate opens (locked-tier mounts), locked-teaser is removed from the DOM
 *
 * src/components/result/LockedTeaser.tsx
 *   props: { outputsCount: number }
 *   - data-testid="locked-teaser" Card with title/body per spec (outputs>=2 vs ===1)
 *
 * src/components/result/LockedTier.tsx
 *   props: { job: ConversionJob; onUnlocked?: () => void }
 *   - data-testid="locked-tier"
 *   - on mount: calls logImpression('result_locked_tier') exactly once, calls onUnlocked?.() once
 *   - one report row per output: "{formatBytes(sourceSizeBytes)} → {formatBytes(sizeBytes)} · −{pct}%" + MiniBar
 *   - "총 소요 시간 {(durationMs/1000).toFixed(1)}초 · 원본 {totalSource} → 결과 {totalOutput}"
 *   - (outputs.length >= 2) Button display="block" "모두 저장 ({outputs.length}개)"
 *     - tapping it calls deliverFile(output) once per output, sequentially, with >=300ms between calls
 *     - all succeed → Toast "{N}개 파일을 저장했어요"
 *     - partial failure → Toast "{success}개 저장, {fail}개 실패"
 *
 * src/components/result/ResultFooter.tsx
 *   props: { job: ConversionJob }
 *   - ButtonStack: primary "다른 파일 변환하기" (navigate(toolMeta[job.tool].route)),
 *     secondary "공유하기" (logClick('result_share') then shareApp())
 *
 * src/hooks/useResultNotices.ts
 *   - reads useLocation().state as ResultRouteState | null
 *   - if state?.historySaveFailed === true: returns { toastOpen: true, toastText: '이력을 저장하지 못했어요. 변환 파일은 그대로 저장할 수 있어요' }
 *     exactly once (guarded against StrictMode double-invoke), and calls
 *     navigate(location.pathname, { replace: true, state: { jobId: state.jobId } }) exactly once
 *   - otherwise returns { toastOpen: false, toastText: '' }, navigate is not called
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  mockTds,
  mockAppsInToss,
  mockAnalytics,
  mockLogImpression,
  mockLogClick,
  mockShareApp,
} from "@/__tests__/__helpers__/mocks";
import type { ConversionJob, ConversionOutput } from "@/lib/types";
import { toolMeta } from "@/lib/toolMeta";

mockTds();
mockAppsInToss();
mockAnalytics();

// react-router-dom: only override useNavigate — keep the real useLocation/MemoryRouter so
// route state (ResultRouteState) actually flows through for useResultNotices tests.
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("@/lib/deliverFile", () => ({
  deliverFile: vi.fn(),
}));

import { deliverFile } from "@/lib/deliverFile";

function renderInRouter(ui: React.ReactElement) {
  return render(React.createElement(MemoryRouter, null, ui));
}

const SRC_BYTES = 2202009; // formatBytes → "2.1MB"
const OUT_BYTES = 1363149; // formatBytes → "1.3MB" (−38%)

function makeOutput(overrides: Partial<ConversionOutput> = {}): ConversionOutput {
  return {
    id: "o1",
    sourceName: "IMG_0001.jpg",
    fileName: "IMG_0001.jpg",
    mimeType: "image/jpeg",
    sizeBytes: OUT_BYTES,
    sourceSizeBytes: SRC_BYTES,
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
    durationMs: 2400,
    status: "success",
    ...overrides,
  };
}

function threeOutputsJob(): ConversionJob {
  return makeJob({
    outputs: [
      makeOutput({ id: "o1", fileName: "IMG_0001.jpg" }),
      makeOutput({ id: "o2", fileName: "IMG_0002.jpg" }),
      makeOutput({ id: "o3", fileName: "IMG_0003.jpg" }),
    ],
  });
}

describe("결과 화면 잠금 섹션·하단 버튼·결과 알림 훅", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("LockedSection — 게이트 열림 (F7-AC-2)", () => {
    it("F7-AC-2[P1]: 게이트가 열리면 locked-tier에 리포트 3행('2.1MB → 1.3MB · −38%' + MiniBar)·소요시간·모두 저장이 뜨고 locked-teaser는 사라진다", async () => {
      const { LockedSection } = await import("@/components/result/LockedSection");
      const job = threeOutputsJob();

      renderInRouter(React.createElement(LockedSection, { job }));

      const lockedTier = await screen.findByTestId("locked-tier");
      expect(screen.queryByTestId("locked-teaser")).not.toBeInTheDocument();

      const rows = within(lockedTier).getAllByText((content) =>
        content.includes("2.1MB") && content.includes("1.3MB") && content.includes("38%"),
      );
      expect(rows).toHaveLength(3);
      expect(within(lockedTier).getAllByRole("progressbar")).toHaveLength(3);

      expect(within(lockedTier).getByText(/총 소요 시간 2\.4초/)).toBeInTheDocument();
      expect(
        within(lockedTier).getByRole("button", { name: "모두 저장 (3개)" }),
      ).toBeInTheDocument();
    });
  });

  describe("LockedTier — 모두 저장 (F7-AC-2/AC-4)", () => {
    it("F7-AC-2[P1]: 모두 저장을 누르면 deliverFile이 3회 순차 호출되고(간격 ≥300ms), Toast '3개 파일을 저장했어요'가 뜬다", async () => {
      const { LockedTier } = await import("@/components/result/LockedTier");
      const timestamps: number[] = [];
      (deliverFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        timestamps.push(Date.now());
      });

      const job = threeOutputsJob();
      renderInRouter(React.createElement(LockedTier, { job }));

      fireEvent.click(screen.getByRole("button", { name: "모두 저장 (3개)" }));

      await waitFor(() => expect(deliverFile).toHaveBeenCalledTimes(3), { timeout: 5000 });
      expect(timestamps[1] - timestamps[0]).toBeGreaterThanOrEqual(290);
      expect(timestamps[2] - timestamps[1]).toBeGreaterThanOrEqual(290);

      await screen.findByText("3개 파일을 저장했어요");
    });

    it("F7-AC-4[P1]: 3개 중 1개가 실패하면 Toast는 '2개 저장, 1개 실패'", async () => {
      const { LockedTier } = await import("@/components/result/LockedTier");
      let callCount = 0;
      (deliverFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        callCount += 1;
        if (callCount === 2) throw new Error("save failed");
      });

      const job = threeOutputsJob();
      renderInRouter(React.createElement(LockedTier, { job }));

      fireEvent.click(screen.getByRole("button", { name: "모두 저장 (3개)" }));

      await waitFor(() => expect(deliverFile).toHaveBeenCalledTimes(3), { timeout: 5000 });
      await screen.findByText("2개 저장, 1개 실패");
    });
  });

  describe("LockedTier — 노출 로그", () => {
    it("LockedTier는 마운트될 때만 logImpression('result_locked_tier')을 1회 호출한다(다른 컴포넌트가 떠 있어도 0회)", async () => {
      const { LockedTier } = await import("@/components/result/LockedTier");
      const { LockedTeaser } = await import("@/components/result/LockedTeaser");

      renderInRouter(React.createElement(LockedTeaser, { outputsCount: 3 }));
      expect(mockLogImpression).not.toHaveBeenCalledWith("result_locked_tier");

      const job = makeJob({ outputs: [makeOutput({ id: "o1" })] });
      renderInRouter(React.createElement(LockedTier, { job }));

      expect(mockLogImpression).toHaveBeenCalledTimes(1);
      expect(mockLogImpression).toHaveBeenCalledWith("result_locked_tier");
    });
  });

  describe("ResultFooter — 공유 · 재변환 (F7-AC-7)", () => {
    it("F7-AC-7[P1]: '공유하기' 탭하면 logClick('result_share') 후 shareApp() 1회, '다른 파일 변환하기' 탭하면 navigate(toolMeta[job.tool].route)", async () => {
      const { ResultFooter } = await import("@/components/result/ResultFooter");
      const job: ConversionJob = makeJob({
        tool: "pdf-merge",
        options: { tool: "pdf-merge" },
      });

      renderInRouter(React.createElement(ResultFooter, { job }));

      fireEvent.click(screen.getByRole("button", { name: "공유하기" }));
      expect(mockLogClick).toHaveBeenCalledWith("result_share");
      expect(mockShareApp).toHaveBeenCalledTimes(1);
      const logOrder = mockLogClick.mock.invocationCallOrder[0];
      const shareOrder = mockShareApp.mock.invocationCallOrder[0];
      expect(logOrder).toBeLessThan(shareOrder);

      fireEvent.click(screen.getByRole("button", { name: "다른 파일 변환하기" }));
      expect(mockNavigate).toHaveBeenCalledWith(toolMeta["pdf-merge"].route);
    });
  });

  describe("useResultNotices — 이력 저장 실패 알림 (F7-AC-12)", () => {
    it("F7-AC-12[P1]: historySaveFailed:true면 Toast 텍스트가 1회만 노출되고 navigate('/result', {replace:true, state:{jobId}})가 1회 호출된다(StrictMode에서도 1회)", async () => {
      const { useResultNotices } = await import("@/hooks/useResultNotices");

      function Harness() {
        const { toastOpen, toastText } = useResultNotices();
        return toastOpen ? React.createElement("div", { role: "status" }, toastText) : null;
      }

      render(
        React.createElement(
          React.StrictMode,
          null,
          React.createElement(
            MemoryRouter,
            {
              initialEntries: [
                { pathname: "/result", state: { jobId: "job-1", historySaveFailed: true } },
              ],
            },
            React.createElement(Harness),
          ),
        ),
      );

      await screen.findByText("이력을 저장하지 못했어요. 변환 파일은 그대로 저장할 수 있어요");
      expect(
        screen.getAllByText("이력을 저장하지 못했어요. 변환 파일은 그대로 저장할 수 있어요"),
      ).toHaveLength(1);
      expect(mockNavigate).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith("/result", {
        replace: true,
        state: { jobId: "job-1" },
      });
    });

    it("F7-AC-12[P1]: historySaveFailed 플래그가 없으면 Toast·navigate 모두 0회", async () => {
      const { useResultNotices } = await import("@/hooks/useResultNotices");

      function Harness() {
        const { toastOpen, toastText } = useResultNotices();
        return toastOpen ? React.createElement("div", { role: "status" }, toastText) : null;
      }

      render(
        React.createElement(
          MemoryRouter,
          { initialEntries: [{ pathname: "/result", state: { jobId: "job-1" } }] },
          React.createElement(Harness),
        ),
      );

      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });
});
