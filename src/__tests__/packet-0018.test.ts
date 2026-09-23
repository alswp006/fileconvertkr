/**
 * Packet 0018: 변환 이력 화면 /history
 *
 * TDD red phase — src/pages/History.tsx is still the scaffold "준비 중" placeholder and
 * src/components/history/{HistorySummary,HistoryList,HistoryDetailSheet}.tsx do not exist
 * yet. These tests define the expected behavior of the /history screen as a whole (tested
 * through the page, not the not-yet-existing sub-components directly) so the Coder can
 * implement to satisfy them.
 *
 * Covers spec.md F8 (P8-b scope): AC-2, AC-3, AC-6, AC-4/AC-9, AC-5, AC-8, AC-10.
 * AC-1/AC-7 (홈 + FloatingTabBar 라우팅) belong to P8-a — out of scope here.
 *
 * Relies on the test runner's system timezone being Asia/Seoul (confirmed default in this
 * repo's environment) for the Asia/Seoul date-formatting assertions in AC-2.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockTds, mockAppsInToss, mockAnalytics, mockLogClick } from "@/__tests__/__helpers__/mocks";
import type { HistoryEntry } from "@/lib/types";

mockTds();
mockAppsInToss();
mockAnalytics();

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

import History from "@/pages/History";

const KEY = "fileconvertkr:history:v1";

function seed(entries: HistoryEntry[]) {
  localStorage.setItem(KEY, JSON.stringify(entries));
}

function renderHistory() {
  return render(React.createElement(MemoryRouter, null, React.createElement(History)));
}

let idCounter = 0;
function makeEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  idCounter += 1;
  return {
    id: `h-${idCounter}`,
    tool: "heic",
    createdAt: new Date().toISOString(),
    status: "success",
    inputCount: 1,
    outputCount: 1,
    failedCount: 0,
    inputTotalBytes: 1024 * 1024,
    outputTotalBytes: 1024 * 1024,
    inputNames: ["a.heic"],
    outputNames: ["a.jpg"],
    ...overrides,
  };
}

describe("변환 이력 화면 /history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    idCounter = 0;
  });

  it("F8-AC-2[P0]: 이력 2개가 최신순으로 표시되고 제목·부제가 형식대로이며 partial 항목엔 실패 개수가 붙는다", () => {
    const older = makeEntry({
      id: "h-old",
      createdAt: "2026-09-20T00:00:00.000Z",
      status: "partial",
      inputCount: 2,
      outputCount: 1,
      failedCount: 1,
      inputTotalBytes: 1024 * 1024,
      outputTotalBytes: 512 * 1024,
      inputNames: ["x.heic", "y.heic"],
      outputNames: ["x.jpg"],
    });
    const newer = makeEntry({
      id: "h-new",
      tool: "heic",
      createdAt: "2026-09-24T05:30:00.000Z",
      status: "success",
      inputCount: 3,
      outputCount: 3,
      failedCount: 0,
      inputTotalBytes: 7340032,
      outputTotalBytes: 4194304,
      inputNames: ["a.heic", "b.heic", "c.heic"],
      outputNames: ["a.jpg", "b.jpg", "c.jpg"],
    });
    // Storage order deliberately NOT newest-first — the screen must sort by createdAt itself.
    seed([older, newer]);

    renderHistory();

    const rows = screen.getAllByTestId("history-row");
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain("HEIC → JPG/PNG · 파일 3개");
    expect(rows[0].textContent).toContain("2026.09.24 14:30 · 7.0MB → 4.0MB");
    expect(rows[1].textContent).toContain("실패 1개");
  });

  it("F8-AC-3[P1]: 이력이 0개면 빈 상태만 보이고 '전체 삭제'·history-summary는 렌더되지 않으며, '파일 변환하러 가기'를 누르면 홈으로 이동한다", () => {
    seed([]);
    renderHistory();

    expect(screen.getByText("아직 변환한 파일이 없어요")).toBeInTheDocument();
    expect(screen.queryByTestId("history-summary")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "전체 삭제" })).not.toBeInTheDocument();
    expect(screen.queryAllByTestId("history-row")).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "파일 변환하러 가기" }));
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });

  it("F8-AC-6[P1]: 손상된 이력 데이터('{broken')는 빈 상태로 처리되고 console.error는 0회", () => {
    localStorage.setItem(KEY, "{broken");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    renderHistory();

    expect(screen.getByText("아직 변환한 파일이 없어요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "파일 변환하러 가기" })).toBeInTheDocument();
    expect(screen.queryAllByTestId("history-row")).toHaveLength(0);
    expect(errorSpy).not.toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it("F8-AC-4/AC-9[P1]: pdf-merge 행을 열면 BottomSheet에 잘린 파일명 목록·안내 문구가 뜨고, 재변환을 누르면 계측 후 이동한다", async () => {
    const entry = makeEntry({
      id: "h-pdf",
      tool: "pdf-merge",
      status: "success",
      inputCount: 7,
      outputCount: 1,
      inputTotalBytes: 5 * 1024 * 1024,
      outputTotalBytes: 3 * 1024 * 1024,
      inputNames: ["f1.pdf", "f2.pdf", "f3.pdf", "f4.pdf", "f5.pdf"],
      outputNames: ["a".repeat(39) + "…"],
    });
    seed([entry]);
    renderHistory();

    fireEvent.click(screen.getByTestId("history-row"));

    const sheet = await screen.findByRole("dialog");
    const sheetText = sheet.textContent ?? "";

    for (const name of ["f1.pdf", "f2.pdf", "f3.pdf", "f4.pdf", "f5.pdf"]) {
      expect(sheetText).toContain(name);
    }
    expect(sheetText).toContain("외 2개");
    expect(sheetText).toContain("a".repeat(39) + "…");
    // 출력 목록은 1/1개라 "외 N개"가 붙지 않는다 — 전체에서 정확히 1회(입력 목록분)만 나와야 한다.
    expect((sheetText.match(/외 \d+개/g) ?? []).length).toBe(1);
    expect(sheetText).toContain(
      "앱은 변환한 파일을 보관하지 않아요. 저장한 파일은 사진 앱 또는 파일 앱에서 확인해주세요",
    );

    fireEvent.click(within(sheet).getByRole("button", { name: "같은 도구로 다시 변환" }));

    expect(mockLogClick).toHaveBeenCalledWith("history_rerun");
    expect(mockNavigate).toHaveBeenCalledWith("/pdf/merge");
  });

  it("F8-AC-5[P1]: 전체 삭제 확인 — 취소하면 유지되고 삭제하면 저장소와 화면이 모두 비워진다", () => {
    seed([makeEntry({ id: "1" }), makeEntry({ id: "2" }), makeEntry({ id: "3" })]);
    renderHistory();

    expect(screen.getAllByTestId("history-row")).toHaveLength(3);

    fireEvent.click(screen.getByRole("button", { name: "전체 삭제" }));
    let dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText("변환 이력을 모두 삭제할까요?")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "취소" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("history-row")).toHaveLength(3);
    expect(localStorage.getItem(KEY)).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "전체 삭제" }));
    dialog = screen.getByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "삭제" }));

    expect(localStorage.getItem(KEY)).toBeNull();
    expect(screen.getByText("아직 변환한 파일이 없어요")).toBeInTheDocument();
  });

  it("F8-AC-8[P2]: 최근 7일 중 2일에 기록이 있으면 SummaryHero 합계가 8개이고 길이 7 Sparkline이 렌더된다", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-24T05:00:00.000Z")); // 2026-09-24 14:00 KST

    const today = makeEntry({
      id: "h-today",
      createdAt: "2026-09-24T05:00:00.000Z",
      outputCount: 3,
    });
    const threeDaysAgo = makeEntry({
      id: "h-3d",
      createdAt: "2026-09-21T05:00:00.000Z",
      outputCount: 5,
    });
    seed([today, threeDaysAgo]);

    renderHistory();

    const summary = screen.getByTestId("history-summary");
    await waitFor(() => {
      expect(within(summary).getByText(/8개/)).toBeInTheDocument();
    });

    const sparkline = screen.getByRole("img", { name: "추이 그래프" });
    const linePath = sparkline.querySelectorAll("path")[1];
    const points = (linePath?.getAttribute("d") ?? "").match(/[ML]/g) ?? [];
    expect(points).toHaveLength(7);

    vi.useRealTimers();
  });

  it("F8-AC-8[P2]: 기록이 있는 날이 1일뿐이면 Sparkline은 렌더되지 않는다", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-24T05:00:00.000Z"));

    seed([makeEntry({ id: "h-only", createdAt: "2026-09-24T05:00:00.000Z", outputCount: 4 })]);

    renderHistory();

    expect(screen.getByTestId("history-summary")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "추이 그래프" })).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it("F8-AC-10[P2]: 이력 100개를 페이지네이션 없이 렌더하고, getItem은 마운트당 1회만 호출되며 콘솔 에러 0회", () => {
    const entries: HistoryEntry[] = Array.from({ length: 100 }, (_, i) =>
      makeEntry({
        id: `e-${i}`,
        createdAt: new Date(Date.now() - i * 60000).toISOString(), // e-0 최신 ~ e-99 최고령
        inputCount: i + 1, // 행 식별용 고유 표식(마지막 행 = e-99 = "파일 100개")
        outputCount: i + 1,
        inputNames: [],
        outputNames: [],
      }),
    );
    seed(entries);

    const getItemSpy = vi.spyOn(Storage.prototype, "getItem");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { container } = renderHistory();

    const rows = screen.getAllByTestId("history-row");
    expect(rows).toHaveLength(100);
    expect(rows[0].textContent).toContain("파일 1개");
    expect(rows[99].textContent).toContain("파일 100개");

    const historyGetItemCalls = getItemSpy.mock.calls.filter(([key]) => key === KEY);
    expect(historyGetItemCalls).toHaveLength(1);

    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(screen.queryByText(/더 보기/)).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: /페이지/ })).not.toBeInTheDocument();

    const lastRow = rows[rows.length - 1];
    const [firstTab] = screen.getAllByRole("tab");
    const spacings = container.querySelectorAll("[data-spacing]");
    const hasSpacingBetween = Array.from(spacings).some((el) => {
      const afterRow = !!(lastRow.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
      const beforeTab = !!(el.compareDocumentPosition(firstTab) & Node.DOCUMENT_POSITION_FOLLOWING);
      return afterRow && beforeTab;
    });
    expect(hasSpacingBetween).toBe(true);

    expect(errorSpy).not.toHaveBeenCalled();

    getItemSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
