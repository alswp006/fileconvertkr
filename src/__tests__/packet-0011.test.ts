/**
 * Packet 0011: 홈 화면 / (도구 목록)
 *
 * TDD red phase — src/pages/Home.tsx는 아직 골든 스캐폴드 예시(대시보드 템플릿)만 갖고 있고
 * 이 패킷이 요구하는 실제 도구 목록 화면으로 교체되지 않았다. 아래 테스트가 그 계약을 정의한다.
 *
 * 기대 계약 (packet 설명 + F8-AC):
 * - src/pages/Home.tsx
 *   - ScreenScaffold(top=Top '파일 변환') 안에 기기 내 처리 안내 문구 + toolMeta.TOOL_ORDER
 *     순서대로 도구 ListRow 5개(role="listitem") + 하단 FloatingTabBar(변환·이력)
 *   - 각 행 탭: generateHapticFeedback({type:'tickWeak'}) → logClick('tool_select_{tool}')
 *     → navigate(toolMeta[tool].route) 순서로 실행
 *   - 설치 유도 문구·외부 링크(<a href="http(s)://...">) 없음
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { screen, fireEvent } from "@testing-library/react";
import {
  mockTds,
  mockAppsInToss,
  mockRouter,
  mockAnalytics,
  mockNavigate,
  mockLogClick,
} from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";
import { toolMeta, TOOL_ORDER } from "@/lib/toolMeta";

mockTds();
mockAppsInToss();
mockRouter();
mockAnalytics();

import { generateHapticFeedback } from "@apps-in-toss/web-framework";

describe("홈 화면 / (도구 목록)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("F8-AC-1[P0]: 도구 ListRow 5개가 toolMeta.TOOL_ORDER 순서(제목)로 표시된다", async () => {
    const Home = (await import("@/pages/Home")).default;
    renderWithRouter(React.createElement(Home));

    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(5);

    const expectedTitles = TOOL_ORDER.map((tool) => toolMeta[tool].title);
    expect(expectedTitles).toEqual([
      "HEIC → JPG/PNG",
      "이미지 용량 줄이기",
      "PDF 합치기",
      "PDF → 이미지",
      "PDF 나누기",
    ]);

    rows.forEach((row, idx) => {
      expect(row.textContent).toContain(expectedTitles[idx]);
    });
  });

  it("F8-AC-1[P0]: 'HEIC → JPG/PNG' 행을 탭하면 tickWeak 햅틱 → logClick('tool_select_heic') → navigate('/convert/heic') 순서로 호출된다", async () => {
    const Home = (await import("@/pages/Home")).default;
    renderWithRouter(React.createElement(Home));

    const rows = screen.getAllByRole("listitem");
    fireEvent.click(rows[0]);

    expect(generateHapticFeedback).toHaveBeenCalledWith({ type: "tickWeak" });
    expect(mockLogClick).toHaveBeenCalledWith("tool_select_heic");
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith(toolMeta.heic.route);
    expect(toolMeta.heic.route).toBe("/convert/heic");

    const hapticOrder = vi.mocked(generateHapticFeedback).mock.invocationCallOrder[0];
    const clickOrder = mockLogClick.mock.invocationCallOrder[0];
    const navOrder = mockNavigate.mock.invocationCallOrder[0];
    expect(hapticOrder).toBeLessThan(clickOrder);
    expect(clickOrder).toBeLessThan(navOrder);
  });

  it("F8-AC-7[P0]: 설치 유도 문구가 없고, http(s):// 외부 링크 <a>가 0개다", async () => {
    const Home = (await import("@/pages/Home")).default;
    const { container } = renderWithRouter(React.createElement(Home));

    const text = container.textContent ?? "";
    expect(text).not.toMatch(/설치/);
    expect(text).not.toMatch(/다운로드/);
    expect(text).not.toMatch(/App Store/);
    expect(text).not.toMatch(/Play\s*스토어/);

    const externalLinks = Array.from(container.querySelectorAll("a")).filter((a) =>
      /^https?:\/\//.test(a.getAttribute("href") ?? ""),
    );
    expect(externalLinks).toHaveLength(0);
  });

  it("F8-AC-?[P1]: FloatingTabBar의 '이력' 탭을 누르면 navigate('/history')가 호출된다", async () => {
    const Home = (await import("@/pages/Home")).default;
    renderWithRouter(React.createElement(Home));

    const historyTab = screen.getByRole("tab", { name: "이력" });
    fireEvent.click(historyTab);

    expect(mockNavigate).toHaveBeenCalledWith("/history");
  });
});
