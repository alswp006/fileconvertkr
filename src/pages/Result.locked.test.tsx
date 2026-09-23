/**
 * 결과 화면 /result — 잠금 상태 통합 테스트 (F7-AC-9).
 * 실제 TossRewardAd 게이트: 광고 로드는 성공, 시청(showFullScreenAd)은 끝나지 않는 환경.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  mockAnalytics,
  mockAppsInToss,
  mockLogImpression,
  mockTds,
} from "@/__tests__/__helpers__/mocks";
import { jobStore } from "@/lib/jobStore";
import type { ConversionJob, ConversionOutput } from "@/lib/types";

mockTds();
mockAppsInToss();
mockAnalytics();

vi.mock("@/lib/deliverFile", () => ({ deliverFile: vi.fn() }));

import { deliverFile } from "@/lib/deliverFile";
import { showFullScreenAd } from "@apps-in-toss/web-framework";

function output(id: string): ConversionOutput {
  return {
    id,
    sourceName: `IMG_${id}.heic`,
    fileName: `IMG_${id}.jpg`,
    mimeType: "image/jpeg",
    sizeBytes: 1_363_149,
    sourceSizeBytes: 2_202_009,
    blob: new Blob(["x"], { type: "image/jpeg" }),
    objectUrl: `blob:${id}`,
  };
}

const lockedJob: ConversionJob = {
  jobId: "locked-1",
  tool: "heic",
  createdAt: new Date().toISOString(),
  options: { tool: "heic", format: "jpg", quality: 0.92 },
  inputs: [],
  outputs: [output("0001"), output("0002"), output("0003")],
  failures: [],
  durationMs: 2400,
  status: "success",
};

describe("Result 화면 — 광고 게이트 잠금 상태", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VITE_TOSS_AD_SLOT_ID", "test-slot");
    vi.mocked(showFullScreenAd).mockImplementation(() => () => {});
    errorSpy = vi.spyOn(console, "error");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("F7-AC-9: 광고를 보기 전엔 locked-tier가 없고 노출 로그도 없으며, 무료 저장은 광고와 무관하다", async () => {
    jobStore.saveJob(lockedJob);
    const { default: Result } = await import("@/pages/Result");
    const { container } = render(
      <MemoryRouter initialEntries={[{ pathname: "/result", state: { jobId: "locked-1" } }]}>
        <Result />
      </MemoryRouter>,
    );

    const teaser = await screen.findByTestId("locked-teaser");
    expect(within(teaser).getByText("파일별 상세 리포트 · 모두 저장")).toBeInTheDocument();
    expect(screen.queryByTestId("locked-tier")).not.toBeInTheDocument();
    expect(within(screen.getByTestId("locked-gate")).queryByText("모두 저장 (3개)")).toBeNull();
    expect(mockLogImpression).not.toHaveBeenCalledWith("result_locked_tier");

    const order = Array.from(container.querySelectorAll("[data-testid]"))
      .map((el) => el.getAttribute("data-testid") ?? "")
      .filter((id) =>
        ["free-tier", "ad-slot-mid", "locked-teaser", "locked-gate", "ad-slot-bottom"].includes(id),
      );
    expect(order).toEqual([
      "free-tier",
      "ad-slot-mid",
      "locked-teaser",
      "locked-gate",
      "ad-slot-bottom",
    ]);

    const [firstRow] = within(screen.getByTestId("free-tier")).getAllByTestId("output-row");
    fireEvent.click(within(firstRow).getByRole("button", { name: "저장" }));
    await waitFor(() => expect(deliverFile).toHaveBeenCalledTimes(1));
    expect(showFullScreenAd).not.toHaveBeenCalled();
    expect(screen.queryByTestId("locked-tier")).not.toBeInTheDocument();
  });
});
