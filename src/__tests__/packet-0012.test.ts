/**
 * Packet 0012: 변환 결과 화면 /result (공통 payoff)
 *
 * TDD red phase — src/pages/Result.tsx is still the wiring-first placeholder.
 * These tests define the expected contract for the Coder to implement:
 *
 * src/pages/Result.tsx
 *   - reads useLocation().state as ResultRouteState or null
 *   - looks up jobStore.getJob(state.jobId); if job is missing, renders ONLY
 *     ScreenScaffold wrapping ExpiredView (no free-tier/locked-.../ad-slot-...)
 *   - if job exists, assembles (in DOM order), all inside ScreenScaffold:
 *       FreeTier, then a div[data-testid=ad-slot-mid] wrapping AdSlot, then LockedSection,
 *       then a div[data-testid=ad-slot-bottom] wrapping AdSlot, then ResultFooter
 *     The two ad-slot wrappers are NOT descendants of free-tier.
 *   - calls useResultNotices() and renders its Toast (open=toastOpen, text=toastText) only in
 *     the valid-job branch (so the expired branch never shows the history-save-failed toast
 *     even though the hook's own navigate side effect fires independently of job validity)
 *
 * F7-AC-9 (P0) is a full-page integration test against the real TossRewardAd gate (not the
 * mockTossRewardAd() auto-unlock stub), per the packet description.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  mockAnalytics,
  mockAppsInToss,
  mockLogImpression,
  mockTds,
} from "@/__tests__/__helpers__/mocks";
import { jobStore } from "@/lib/jobStore";
import type { ConversionFailure, ConversionJob, ConversionOutput } from "@/lib/types";

mockTds();
mockAppsInToss();
mockAnalytics();

// Keep the real useLocation/MemoryRouter (route state must flow through for
// useResultNotices + jobStore lookup) — only useNavigate is overridden for assertions.
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

// deliverFile's own contract (saveBase64Data call shape, anchor fallback) is covered by
// packet-0003/packet-0009 — here we only need to know Result.tsx wires the save button to it.
vi.mock("@/lib/deliverFile", () => ({
  deliverFile: vi.fn(),
}));

import { deliverFile } from "@/lib/deliverFile";
import { showFullScreenAd } from "@apps-in-toss/web-framework";

const HISTORY_SAVE_FAILED_TEXT =
  "이력을 저장하지 못했어요. 변환 파일은 그대로 저장할 수 있어요";

function makeOutput(overrides: Partial<ConversionOutput> = {}): ConversionOutput {
  return {
    id: "o1",
    sourceName: "IMG_0001.jpg",
    fileName: "IMG_0001.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 1_363_149,
    sourceSizeBytes: 2_202_009,
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

function heicJob(jobId: string): ConversionJob {
  return makeJob({
    jobId,
    outputs: [
      makeOutput({ id: "o1", fileName: "IMG_0001.jpg" }),
      makeOutput({ id: "o2", fileName: "IMG_0002.jpg" }),
      makeOutput({ id: "o3", fileName: "IMG_0003.jpg" }),
    ],
  });
}

function compressJobWithFailure(jobId: string): ConversionJob {
  const failures: ConversionFailure[] = [
    {
      id: "f1",
      inputIndex: 1,
      fileName: "broken.jpg",
      message: "파일을 읽을 수 없어요. 다른 파일을 선택해주세요",
    },
  ];
  return makeJob({
    jobId,
    tool: "compress",
    options: { tool: "compress", targetBytes: 500_000 },
    status: "partial",
    outputs: [
      makeOutput({
        id: "o1",
        fileName: "photo_compressed.jpg",
        sourceSizeBytes: 3_145_728, // inTotal
        sizeBytes: 509_952, // outTotal -> round((1-509952/3145728)*100) === 84
      }),
    ],
    failures,
  });
}

async function loadResult() {
  const mod = await import("@/pages/Result");
  return mod.default;
}

function renderResult(Result: React.ComponentType, state: unknown) {
  return render(
    React.createElement(
      MemoryRouter,
      { initialEntries: [{ pathname: "/result", state }] },
      React.createElement(Result),
    ),
  );
}

describe("변환 결과 화면 /result (공통 payoff)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("F7-AC-1[P0]: 광고 자동 열림 환경(slot ID 미설정)에서 heic job으로 진입하면 free-tier SummaryHero가 3/개/변환 완료이고 output-row 3개의 저장이 모두 enabled다", async () => {
    const Result = await loadResult();
    const job = heicJob("job-ac1");
    jobStore.saveJob(job);

    renderResult(Result, { jobId: "job-ac1" });

    const freeTier = await screen.findByTestId("free-tier");
    expect(within(freeTier).getByText("변환 완료")).toBeInTheDocument();
    expect(within(freeTier).getByText("3개")).toBeInTheDocument();

    const outputRows = within(freeTier).getAllByTestId("output-row");
    expect(outputRows).toHaveLength(3);
    for (const row of outputRows) {
      expect(within(row).getByRole("button", { name: "저장" })).toBeEnabled();
    }
  });

  it("F7-AC-5[P1]: location.state가 null이면 크래시 없이 만료 화면만 렌더되고 free-tier·locked-teaser·locked-gate·locked-tier·ad-slot-mid·ad-slot-bottom은 0개다", async () => {
    const Result = await loadResult();

    renderResult(Result, null);

    expect(await screen.findByText("변환 결과가 만료됐어요")).toBeInTheDocument();
    const homeButton = screen.getByRole("button", { name: "처음으로" });
    expect(homeButton).toBeInTheDocument();
    for (const testId of [
      "free-tier",
      "locked-teaser",
      "locked-gate",
      "locked-tier",
      "ad-slot-mid",
      "ad-slot-bottom",
    ]) {
      expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
    }

    fireEvent.click(homeButton);
    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });

  it("F7-AC-5[P1]: jobStore에 없는 jobId({ jobId: 'expired-1' })로 진입해도 크래시 없이 만료 화면만 렌더된다", async () => {
    const Result = await loadResult();

    renderResult(Result, { jobId: "expired-1" });

    expect(await screen.findByText("변환 결과가 만료됐어요")).toBeInTheDocument();
    for (const testId of [
      "free-tier",
      "locked-teaser",
      "locked-gate",
      "locked-tier",
      "ad-slot-mid",
      "ad-slot-bottom",
    ]) {
      expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
    }
  });

  it("F7-AC-6[P1]: compress job(in 3,145,728 / out 509,952, failures 1개)이면 SummaryHero는 84%, failed-list 제목은 '변환하지 못한 파일 1개'이고 DOM 순서는 free-tier→ad-slot-mid→locked-tier→ad-slot-bottom이며 광고 슬롯은 free-tier의 자손이 아니다", async () => {
    const Result = await loadResult();
    const job = compressJobWithFailure("job-ac6");
    jobStore.saveJob(job);

    const { container } = renderResult(Result, { jobId: "job-ac6" });

    const summary = await screen.findByTestId("result-summary");
    expect(within(summary).getByText("용량 절감")).toBeInTheDocument();
    expect(within(summary).getByText("84%")).toBeInTheDocument();

    const failedList = screen.getByTestId("failed-list");
    expect(within(failedList).getByText("변환하지 못한 파일 1개")).toBeInTheDocument();

    const freeTier = screen.getByTestId("free-tier");
    expect(within(freeTier).queryByTestId("ad-slot-mid")).not.toBeInTheDocument();
    expect(within(freeTier).queryByTestId("ad-slot-bottom")).not.toBeInTheDocument();

    await screen.findByTestId("locked-tier"); // slot ID unset → gate auto-opens, same env as AC-1
    const order = Array.from(container.querySelectorAll("[data-testid]"))
      .map((el) => el.getAttribute("data-testid"))
      .filter((id): id is string =>
        ["free-tier", "ad-slot-mid", "locked-tier", "ad-slot-bottom"].includes(id ?? ""),
      );
    expect(order).toEqual(["free-tier", "ad-slot-mid", "locked-tier", "ad-slot-bottom"]);
  });

  it("F7-AC-9[P0]: VITE_TOSS_AD_SLOT_ID='test-slot'이고 loadFullScreenAd는 로드 성공, showFullScreenAd는 대기(보상 미통지)인 환경에서 locked-tier는 0개이고 logImpression('result_locked_tier')도 0회이며 무료 저장은 광고와 무관하다", async () => {
    vi.stubEnv("VITE_TOSS_AD_SLOT_ID", "test-slot");
    // showFullScreenAd stays pending — the gate trigger button is never tapped in this AC
    // (its count/size/tap behavior belongs to AC-13), so it must not auto-resolve either.
    vi.mocked(showFullScreenAd).mockImplementation(() => () => {});

    const Result = await loadResult();
    const job = heicJob("job-ac9");
    jobStore.saveJob(job);

    const { container } = renderResult(Result, { jobId: "job-ac9" });

    const teaser = await screen.findByTestId("locked-teaser");
    expect(
      within(teaser).getByText("파일별 상세 리포트 · 모두 저장"),
    ).toBeInTheDocument();
    expect(
      within(teaser).getByText(
        "아래 버튼으로 짧은 광고를 보면 파일마다 줄어든 용량과 해상도를 확인하고, 결과 파일을 한 번에 저장할 수 있어요",
      ),
    ).toBeInTheDocument();

    expect(screen.queryByTestId("locked-tier")).not.toBeInTheDocument();
    const gate = screen.getByTestId("locked-gate");
    expect(within(gate).queryByRole("progressbar")).not.toBeInTheDocument(); // MiniBar absent
    expect(within(gate).queryByText(/총 소요 시간/)).not.toBeInTheDocument();
    expect(within(gate).queryByText("모두 저장 (3개)")).not.toBeInTheDocument();
    expect(within(gate).queryByTestId("locked-teaser")).not.toBeInTheDocument(); // teaser outside gate

    const order = Array.from(container.querySelectorAll("[data-testid]"))
      .map((el) => el.getAttribute("data-testid"))
      .filter((id): id is string =>
        ["free-tier", "ad-slot-mid", "locked-teaser", "locked-gate", "ad-slot-bottom"].includes(
          id ?? "",
        ),
      );
    expect(order).toEqual([
      "free-tier",
      "ad-slot-mid",
      "locked-teaser",
      "locked-gate",
      "ad-slot-bottom",
    ]);

    expect(mockLogImpression).not.toHaveBeenCalledWith("result_locked_tier");

    const beforeShowCount = vi.mocked(showFullScreenAd).mock.calls.length;
    const freeTier = screen.getByTestId("free-tier");
    const [firstRow] = within(freeTier).getAllByTestId("output-row");
    fireEvent.click(within(firstRow).getByRole("button", { name: "저장" }));

    // deliverFile wraps saveBase64Data (contract verified in packet-0003); here we only need
    // to know the free-tier save button is wired to it and unaffected by the ad gate.
    await waitFor(() => expect(deliverFile).toHaveBeenCalledTimes(1));
    expect(vi.mocked(showFullScreenAd).mock.calls.length).toBe(beforeShowCount);
  });

  it("F7-AC-12[P1]: state { jobId, historySaveFailed: true }로 진입하면 Toast가 1회 뜨고 navigate('/result', { replace: true, state: { jobId } })가 1회 호출되며 저장 버튼은 enabled다", async () => {
    const Result = await loadResult();
    const job = heicJob("job-ac12a");
    jobStore.saveJob(job);

    renderResult(Result, { jobId: "job-ac12a", historySaveFailed: true });

    await screen.findByText(HISTORY_SAVE_FAILED_TEXT);
    expect(screen.getAllByText(HISTORY_SAVE_FAILED_TEXT)).toHaveLength(1);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/result", {
      replace: true,
      state: { jobId: "job-ac12a" },
    });

    const freeTier = screen.getByTestId("free-tier");
    const [firstRow] = within(freeTier).getAllByTestId("output-row");
    expect(within(firstRow).getByRole("button", { name: "저장" })).toBeEnabled();
  });

  it("F7-AC-12[P1]: historySaveFailed 플래그가 없으면 이 Toast는 뜨지 않는다", async () => {
    const Result = await loadResult();
    const job = heicJob("job-ac12b");
    jobStore.saveJob(job);

    renderResult(Result, { jobId: "job-ac12b" });

    await screen.findByTestId("free-tier");
    expect(screen.queryByText(HISTORY_SAVE_FAILED_TEXT)).not.toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
