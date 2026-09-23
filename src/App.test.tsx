/**
 * 진입점 라우팅 — 8개 경로의 Top 제목, 미정의 경로 → 홈, state 없는 /result 만료 화면.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockAnalytics, mockAppsInToss, mockTds } from "@/__tests__/__helpers__/mocks";
import { toolMeta } from "@/lib/toolMeta";

mockTds();
mockAppsInToss();
mockAnalytics();

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

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe("App 라우팅", () => {
  it("/ 는 홈(도구 목록)을 렌더한다", () => {
    renderAt("/");
    expect(within(screen.getByRole("navigation")).getByText("파일 변환")).toBeInTheDocument();
    expect(screen.getByText(toolMeta.heic.title)).toBeInTheDocument();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it.each([
    ["/convert/heic", "heic"],
    ["/convert/compress", "compress"],
    ["/pdf/merge", "pdf-merge"],
    ["/pdf/to-image", "pdf-to-image"],
    ["/pdf/split", "pdf-split"],
  ] as const)("%s 는 Top 제목 toolMeta['%s'].title을 렌더한다", (path, tool) => {
    renderAt(path);
    const nav = screen.getByRole("navigation");
    expect(within(nav).getByText(toolMeta[tool].title)).toBeInTheDocument();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("/history 는 Top을 렌더한다", () => {
    renderAt("/history");
    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("/result 에 state 없이 들어오면 만료 화면을 보이고 '처음으로'는 / 로 replace 이동한다", () => {
    renderAt("/result");
    expect(screen.getByText("변환 결과가 만료됐어요")).toBeInTheDocument();
    screen.getByRole("button", { name: "처음으로" }).click();
    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("홈에서 HEIC 행을 탭하면 /convert/heic 로 이동하고, 그 경로는 같은 제목의 Top을 렌더한다", () => {
    const { unmount } = renderAt("/");
    screen.getByText(toolMeta.heic.title).closest('[role="listitem"]')?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    expect(mockNavigate).toHaveBeenCalledWith("/convert/heic");
    unmount();
    renderAt("/convert/heic");
    expect(within(screen.getByRole("navigation")).getByText("HEIC → JPG/PNG")).toBeInTheDocument();
  });

  it("/unknown 은 홈으로 보낸다", () => {
    renderAt("/unknown");
    expect(screen.getByText(toolMeta.heic.title)).toBeInTheDocument();
    expect(screen.getByText(toolMeta["pdf-split"].title)).toBeInTheDocument();
  });
});
