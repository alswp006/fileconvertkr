/**
 * Packet heal-1-01: 진입점 라우팅 배선 + 미작성 페이지 플레이스홀더(단독 tsc·빌드 통과)
 *
 * TDD red phase — src/pages/Heic·Compress·PdfMerge·PdfToImage·PdfSplit.tsx are still the
 * "준비 중" wiring-first placeholders (PageShell + raw <h1>, no Top, no toolMeta title).
 * These tests define the expected contract:
 *   - each of the 5 tool placeholders renders ScreenScaffold(or PageShell) + TDS <Top> whose
 *     title text equals toolMeta[tool].title
 *   - App.tsx (already wired — do not add/remove routes) maps all 8 paths to the right screen
 *   - unknown paths redirect to Home
 *   - "/result" with no route state renders the expired view, and its CTA replaces to "/"
 *
 * AC-1 (tsc --noEmit 0 errors, vite build succeeds) is verified by the pipeline's
 * `npx tsc --noEmit` / `npx vite build` commands, not by a vitest assertion — vitest cannot
 * observe a TypeScript compiler exit code.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockAnalytics, mockAppsInToss, mockTds } from "@/__tests__/__helpers__/mocks";
import { toolMeta } from "@/lib/toolMeta";

mockTds();
mockAppsInToss();
mockAnalytics();

// Keep the real MemoryRouter/Routes/useLocation (route matching + /result state must flow
// through for real) — only useNavigate is overridden so we can assert navigation targets.
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

import App from "@/App";

const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

afterEach(() => {
  errorSpy.mockClear();
});

function renderAt(path: string, state?: unknown) {
  return render(
    React.createElement(
      MemoryRouter,
      { initialEntries: [state ? { pathname: path, state } : path] },
      React.createElement(App),
    ),
  );
}

describe("진입점 라우팅 배선 + 미작성 페이지 플레이스홀더(단독 tsc·빌드 통과)", () => {
  it("AC-2[P0]: 홈에서 'HEIC → JPG/PNG' ListRow를 탭하면 /convert/heic로 이동해 같은 제목의 Top이 보인다", () => {
    renderAt("/");
    const row = screen.getByText(toolMeta.heic.title);
    row.closest('[role="listitem"]')?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );

    expect(
      screen.getByRole("navigation").querySelector("h1")?.textContent,
    ).toBe(toolMeta.heic.title);
    expect(screen.getAllByText(toolMeta.heic.title).length).toBeGreaterThan(0);
  });

  it.each([
    ["/convert/heic", "heic"],
    ["/convert/compress", "compress"],
    ["/pdf/merge", "pdf-merge"],
    ["/pdf/to-image", "pdf-to-image"],
    ["/pdf/split", "pdf-split"],
  ] as const)(
    "AC-3[P0]: %s 진입 시 Top 제목이 toolMeta['%s'].title이고 console.error가 0회다",
    (path, tool) => {
      renderAt(path);
      const nav = screen.getByRole("navigation");
      expect(within(nav).getByText(toolMeta[tool].title)).toBeInTheDocument();
      expect(errorSpy).not.toHaveBeenCalled();
    },
  );

  it("AC-3[P0]: /history 진입 시 Top이 보이고 console.error가 0회다", () => {
    renderAt("/history");
    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("AC-4: 정의되지 않은 경로('/unknown')로 진입하면 홈(ListRow 목록)이 렌더된다", () => {
    renderAt("/unknown");
    expect(screen.getByText(toolMeta.heic.title)).toBeInTheDocument();
    expect(screen.getByText(toolMeta["pdf-split"].title)).toBeInTheDocument();
  });

  it("AC-5[P0]: state 없이 '/result'로 직접 진입하면 만료 안내와 '처음으로' 버튼이 보인다", () => {
    renderAt("/result");
    expect(screen.getByText("변환 결과가 만료됐어요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "처음으로" })).toBeInTheDocument();
  });

  it("AC-5[P0]: '처음으로' 버튼을 누르면 '/'로 replace 이동한다", () => {
    renderAt("/result");
    screen.getByRole("button", { name: "처음으로" }).click();

    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it("AC-6: 이미 존재하던 src/pages/Home.tsx·Result.tsx는 내용이 바뀌지 않는다 (toolMeta 기반 렌더 계속 동작)", () => {
    renderAt("/");
    // Home.tsx가 toolMeta/TOOL_ORDER를 그대로 매핑해 5개 도구 행을 렌더하는 계약이 유지된다.
    expect(screen.getByText(toolMeta.compress.title)).toBeInTheDocument();
    expect(screen.getByText(toolMeta["pdf-merge"].title)).toBeInTheDocument();
    expect(screen.getByText(toolMeta["pdf-to-image"].title)).toBeInTheDocument();
  });
});
