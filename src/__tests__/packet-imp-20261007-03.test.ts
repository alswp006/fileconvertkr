import { describe, it, expect, vi } from "vitest";
import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HistoryDetailSheet } from "@/components/history/HistoryDetailSheet";
import type { HistoryEntry } from "@/lib/types";

// 벤더 모양의 BottomSheet 목: header / cta / children(본문) 슬롯을 따로 렌더한다.
vi.mock("@toss/tds-mobile", () => {
  const BottomSheet = Object.assign(
    ({ children, open, header, cta }: any) =>
      open
        ? React.createElement(
            "div",
            { role: "dialog" },
            React.createElement("div", { "data-slot": "header" }, header),
            React.createElement("div", { "data-slot": "body" }, children),
            React.createElement("div", { "data-slot": "cta" }, cta),
          )
        : null,
    {
      Header: ({ children }: any) => React.createElement("h2", null, children),
      CTA: ({ children, onClick }: any) =>
        React.createElement("button", { onClick }, children),
    },
  );
  return {
    BottomSheet,
    Button: ({ children, onClick }: any) =>
      React.createElement("button", { onClick }, children),
    Paragraph: {
      Text: ({ children }: any) => React.createElement("span", null, children),
    },
    Spacing: () => React.createElement("div"),
  };
});

const entry = {
  id: "h1",
  inputNames: ["여행1.heic", "여행2.heic"],
  inputCount: 2,
  outputNames: ["여행1.jpg", "여행2.jpg"],
  outputCount: 2,
} as unknown as HistoryEntry;

function renderSheet(onRerun = vi.fn()) {
  render(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(HistoryDetailSheet, {
        entry,
        onClose: vi.fn(),
        onRerun,
      }),
    ),
  );
  const dialog = screen.getByRole("dialog");
  return {
    onRerun,
    header: dialog.querySelector('[data-slot="header"]') as HTMLElement,
    body: dialog.querySelector('[data-slot="body"]') as HTMLElement,
    cta: dialog.querySelector('[data-slot="cta"]') as HTMLElement,
  };
}

const source = readFileSync(
  resolve(__dirname, "../components/history/HistoryDetailSheet.tsx"),
  "utf8",
);

describe("[개선] TDS 컴포넌트 2곳을 벤더 모양대로 고치기", () => {
  it("AC-1/2: 재변환 버튼은 children이 아니라 cta 슬롯에 있다", () => {
    const { body, cta } = renderSheet();
    expect(within(cta).getByRole("button", { name: "같은 도구로 다시 변환" })).toBeTruthy();
    expect(within(body).queryByRole("button")).toBeNull();
  });

  it("AC-1/2: cta 버튼 클릭 시 onRerun(entry)이 호출된다", () => {
    const { cta, onRerun } = renderSheet();
    fireEvent.click(within(cta).getByRole("button", { name: "같은 도구로 다시 변환" }));
    expect(onRerun).toHaveBeenCalledTimes(1);
    expect(onRerun).toHaveBeenCalledWith(entry);
  });

  it("AC-5/6: 제목 '원본 파일'·'결과 파일'은 본문이 아니라 header 슬롯에 있다", () => {
    const { header, body } = renderSheet();
    expect(within(header).getByText("원본 파일")).toBeTruthy();
    expect(within(body).queryByText("원본 파일")).toBeNull();
    expect(within(body).queryByText("결과 파일")).toBeNull();
  });

  it("AC-2/6: 본문에는 파일명 목록과 보관 안내가 남는다", () => {
    const { body } = renderSheet();
    expect(within(body).getByText("여행1.heic")).toBeTruthy();
    expect(within(body).getByText("여행2.jpg")).toBeTruthy();
    expect(within(body).getByText(/변환한 파일을 보관하지 않아요/)).toBeTruthy();
  });

  it("AC-1/2: 소스는 cta={<BottomSheet.CTA>}와 header={<BottomSheet.Header>}를 쓴다", () => {
    expect(source).toMatch(/cta=\{\s*<BottomSheet\.CTA/);
    expect(source).toMatch(/header=\{\s*<BottomSheet\.Header/);
    expect(source).not.toMatch(/<Button\b/);
  });

  it("AC-3/7: TDS 컴포넌트에 as any / as unknown as 캐스트가 없다", () => {
    expect(source).not.toMatch(/as any/);
    expect(source).not.toMatch(/as unknown as/);
  });

  it("AC-4/8: 공용 목의 BottomSheet이 벤더 모양(header·cta 슬롯, CTA)을 따른다", () => {
    const mocks = readFileSync(
      resolve(__dirname, "./__helpers__/mocks.ts"),
      "utf8",
    );
    const start = mocks.indexOf("BottomSheet:");
    const block = mocks.slice(start, start + 900);
    expect(block).toMatch(/header/);
    expect(block).toMatch(/cta/);
    expect(block).toMatch(/CTA/);
  });
});
