/**
 * 결과 화면 /result — 조립·만료·이력 저장 실패 알림 (F7-AC-1/5/6/12).
 * slot ID 미설정 환경이므로 실제 TossRewardAd 게이트가 fail-open으로 열린다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockAnalytics, mockAppsInToss, mockTds } from "@/__tests__/__helpers__/mocks";
import { jobStore } from "@/lib/jobStore";
import type { ConversionJob, ConversionOutput } from "@/lib/types";

mockTds();
mockAppsInToss();
mockAnalytics();

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("@/lib/deliverFile", () => ({ deliverFile: vi.fn() }));

const HISTORY_SAVE_FAILED_TEXT = "이력을 저장하지 못했어요. 변환 파일은 그대로 저장할 수 있어요";

function output(id: string, overrides: Partial<ConversionOutput> = {}): ConversionOutput {
  return {
    id,
    sourceName: `IMG_${id}.heic`,
    fileName: `IMG_${id}.jpg`,
    mimeType: "image/jpeg",
    sizeBytes: 1_363_149,
    sourceSizeBytes: 2_202_009,
    blob: new Blob(["x"], { type: "image/jpeg" }),
    objectUrl: `blob:${id}`,
    ...overrides,
  };
}

function job(jobId: string, overrides: Partial<ConversionJob> = {}): ConversionJob {
  return {
    jobId,
    tool: "heic",
    createdAt: new Date().toISOString(),
    options: { tool: "heic", format: "jpg", quality: 0.92 },
    inputs: [],
    outputs: [output("0001"), output("0002"), output("0003")],
    failures: [],
    durationMs: 2400,
    status: "success",
    ...overrides,
  };
}

async function renderResult(state: unknown) {
  const { default: Result } = await import("@/pages/Result");
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/result", state }]}>
      <Result />
    </MemoryRouter>,
  );
}

const PAYOFF_IDS = [
  "free-tier",
  "locked-teaser",
  "locked-gate",
  "locked-tier",
  "ad-slot-mid",
  "ad-slot-bottom",
];

describe("Result 화면", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    errorSpy = vi.spyOn(console, "error");
  });

  afterEach(() => {
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("F7-AC-1: heic job이면 SummaryHero가 3개 변환 완료, 저장 버튼 3개가 enabled", async () => {
    jobStore.saveJob(job("r-ac1"));
    await renderResult({ jobId: "r-ac1" });

    const freeTier = await screen.findByTestId("free-tier");
    expect(within(freeTier).getByText("변환 완료")).toBeInTheDocument();
    expect(within(freeTier).getByText("3개")).toBeInTheDocument();
    const rows = within(freeTier).getAllByTestId("output-row");
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(within(row).getByRole("button", { name: "저장" })).toBeEnabled();
    }
  });

  it.each([[null], [{ jobId: "expired-1" }]])(
    "F7-AC-5: state=%j이면 만료 화면만 렌더한다",
    async (state) => {
      await renderResult(state);

      expect(await screen.findByText("변환 결과가 만료됐어요")).toBeInTheDocument();
      for (const id of PAYOFF_IDS) {
        expect(screen.queryByTestId(id)).not.toBeInTheDocument();
      }
      fireEvent.click(screen.getByRole("button", { name: "처음으로" }));
      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    },
  );

  it("F7-AC-6: compress job이면 84% 절감·실패 1개, 광고 슬롯은 free-tier 밖에 순서대로 놓인다", async () => {
    jobStore.saveJob(
      job("r-ac6", {
        tool: "compress",
        options: { tool: "compress", targetBytes: 500_000 },
        status: "partial",
        outputs: [output("c1", { sourceSizeBytes: 3_145_728, sizeBytes: 509_952 })],
        failures: [
          { id: "f1", inputIndex: 1, fileName: "broken.jpg", message: "파일을 읽을 수 없어요" },
        ],
      }),
    );
    const { container } = await renderResult({ jobId: "r-ac6" });

    const summary = await screen.findByTestId("result-summary");
    expect(within(summary).getByText("84%")).toBeInTheDocument();
    expect(
      within(screen.getByTestId("failed-list")).getByText("변환하지 못한 파일 1개"),
    ).toBeInTheDocument();

    const freeTier = screen.getByTestId("free-tier");
    expect(within(freeTier).queryByTestId("ad-slot-mid")).not.toBeInTheDocument();
    expect(within(freeTier).queryByTestId("ad-slot-bottom")).not.toBeInTheDocument();

    await screen.findByTestId("locked-tier");
    const order = Array.from(container.querySelectorAll("[data-testid]"))
      .map((el) => el.getAttribute("data-testid") ?? "")
      .filter((id) => ["free-tier", "ad-slot-mid", "locked-tier", "ad-slot-bottom"].includes(id));
    expect(order).toEqual(["free-tier", "ad-slot-mid", "locked-tier", "ad-slot-bottom"]);
  });

  it("F7-AC-12: historySaveFailed면 Toast 1회 + state 정리 navigate 1회, 저장은 enabled", async () => {
    jobStore.saveJob(job("r-ac12"));
    await renderResult({ jobId: "r-ac12", historySaveFailed: true });

    await screen.findByText(HISTORY_SAVE_FAILED_TEXT);
    expect(screen.getAllByText(HISTORY_SAVE_FAILED_TEXT)).toHaveLength(1);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/result", {
      replace: true,
      state: { jobId: "r-ac12" },
    });
    const [firstRow] = within(screen.getByTestId("free-tier")).getAllByTestId("output-row");
    expect(within(firstRow).getByRole("button", { name: "저장" })).toBeEnabled();
  });

  it("Layout: 하단에 공유(1차)·다른 파일 변환하기(2차) CTA가 있다", async () => {
    jobStore.saveJob(job("r-layout"));
    await renderResult({ jobId: "r-layout" });

    expect(await screen.findByRole("button", { name: "공유하기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다른 파일 변환하기" })).toBeInTheDocument();
    expect(screen.getAllByTestId("ad-slot-mid")).toHaveLength(1);
    expect(screen.getAllByTestId("ad-slot-bottom")).toHaveLength(1);
  });
});
