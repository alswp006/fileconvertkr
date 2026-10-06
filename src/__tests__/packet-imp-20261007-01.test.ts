import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockTds, mockAppsInToss, mockNavigate } from "@/__tests__/__helpers__/mocks";
import Home from "@/pages/Home";

mockTds();
mockAppsInToss();
vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual<typeof import("react-router-dom")>("react-router-dom")),
  useNavigate: () => mockNavigate,
}));

const PAGES_DIR = path.resolve(__dirname, "../pages");
const read = (f: string) => fs.readFileSync(path.join(PAGES_DIR, f), "utf8");
const APP = fs.readFileSync(path.resolve(__dirname, "../App.tsx"), "utf8");

// 진입점 후보 화면(자기 자신 제외)의 소스에 경로 리터럴이 navigate()/Link to로 박혀 있어야 한다
const ENTRY_FILES = ["Home.tsx", "Compress.tsx", "Heic.tsx"];
function hasEntryTo(route: string, self?: string): boolean {
  const esc = route.replace(/[/]/g, "\\/");
  const re = new RegExp(`(navigate\\(\\s*|to=\\{?\\s*)["'\`]${esc}["'\`]`);
  return ENTRY_FILES.filter((f) => f !== self).some((f) => re.test(read(f)));
}

const TOOL_ROUTES = [
  ["AC-4/5", "/convert/heic", "heic", "HEIC"],
  ["AC-7/8", "/convert/compress", "compress", "이미지 용량"],
  ["AC-10/11", "/pdf/merge", "pdf-merge", "PDF 합치기"],
  ["AC-13/14", "/pdf/to-image", "pdf-to-image", "PDF → 이미지"],
  ["AC-16/17", "/pdf/split", "pdf-split", "PDF 나누기"],
] as const;

describe("[개선] 갈 수 없는 화면 6개에 진입점 만들기", () => {
  beforeEach(() => mockNavigate.mockClear());

  for (const [ac, route, , label] of TOOL_ROUTES) {
    it(`${ac}: 홈의 도구 목록에서 '${label}'을 누르면 ${route}로 이동한다`, () => {
      render(React.createElement(MemoryRouter, null, React.createElement(Home)));
      fireEvent.click(screen.getByText(new RegExp(label)));
      expect(mockNavigate).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith(route);
    });

    it(`${ac}: ${route} 진입 navigate/Link가 소스에 리터럴 경로로 존재한다`, () => {
      expect(hasEntryTo(route)).toBe(true);
      expect(read("Home.tsx")).toContain(route);
    });
  }

  it("AC-1/2: /result로 가는 navigate/Link가 변환 화면(Heic 또는 Compress)에 있다", () => {
    expect(hasEntryTo("/result", "Home.tsx")).toBe(true);
    expect(read("Heic.tsx") + read("Compress.tsx")).toMatch(/["'`]\/result["'`]/);
  });

  it("AC-3/6/9/12/15/18: 라우트를 지우지 않았다", () => {
    for (const r of ["/result", "/convert/heic", "/convert/compress", "/pdf/merge", "/pdf/to-image", "/pdf/split"]) {
      expect(APP).toContain(`path="${r}"`);
    }
  });
});
