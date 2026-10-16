// @vitest-environment jsdom
/**
 * Hai loại câu duy nhất còn thiếu đường lộ đáp án sau khi màn "Xem lại bài làm"
 * lên: #22 Nối điểm và #35 Trò chơi ghép hình (khảo sát ULNL 1/8).
 *
 * Cả hai đều phải tôn trọng `revealCorrect`: bề mặt đang làm bài (mặc định
 * false ở web — BUG-03) KHÔNG được lộ, chỉ màn xem lại mới lộ.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GradeModeContext, type GradeModeValue } from "./shared";
import { ConnectPointsTask } from "../tasks/ConnectPointsTask";
import { JigsawPlayer } from "./JigsawPlayer";

vi.mock("../tasks/AudioUtils", () => ({
  playSuccess: vi.fn(),
  playError: vi.fn(),
}));

beforeEach(() => {
  // ConnectPointsTask đo khung bằng ResizeObserver — jsdom không có.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function withGrade(node: React.ReactElement, grade: GradeModeValue) {
  return render(
    <GradeModeContext.Provider value={grade}>{node}</GradeModeContext.Provider>,
  );
}

const points = [
  { id: "p1", label: "A", x: 0.1, y: 0.3 },
  { id: "p2", label: "B", x: 0.1, y: 0.6 },
  { id: "p3", label: "1", x: 0.9, y: 0.4 },
  { id: "p4", label: "2", x: 0.9, y: 0.7 },
];

function connectPoints(submitted: boolean) {
  return (
    <ConnectPointsTask
      title="Nối các điểm"
      points={points}
      correctConnections={[
        { from: "p1", to: "p3" },
        { from: "p2", to: "p4" },
      ]}
      onComplete={() => {}}
      submitted={submitted}
    />
  );
}

describe("#22 Nối điểm — ConnectPointsTask", () => {
  it("revealCorrect → hiện 'Đáp án đúng' theo NHÃN điểm, không phải id thô", () => {
    withGrade(connectPoints(true), {
      mode: "parent",
      result: "incorrect",
      revealCorrect: true,
    });

    expect(screen.getByText("Đáp án đúng")).toBeTruthy();
    const box = screen.getByText("Đáp án đúng").parentElement!;
    expect(box.textContent).toContain("A — 1");
    expect(box.textContent).toContain("B — 2");
    // Không được rò id nội bộ ra cho học sinh.
    expect(box.textContent).not.toContain("p1");
  });

  it("revealCorrect=false (đang làm bài) → KHÔNG lộ", () => {
    withGrade(connectPoints(true), {
      mode: "parent",
      result: "incorrect",
      revealCorrect: false,
    });
    expect(screen.queryByText("Đáp án đúng")).toBeNull();
  });

  it("chưa nộp → KHÔNG lộ dù revealCorrect bật", () => {
    withGrade(connectPoints(false), { mode: "parent", revealCorrect: true });
    expect(screen.queryByText("Đáp án đúng")).toBeNull();
  });
});

describe("#35 Trò chơi ghép hình — JigsawPlayer", () => {
  it("revealCorrect → hiện HÌNH GỐC làm đáp án", () => {
    withGrade(
      <JigsawPlayer
        title="Ghép hình"
        imageUrl="https://cdn.example.com/tranh.png"
        rows={2}
        cols={2}
        submitted
      />,
      { mode: "parent", result: "incorrect", revealCorrect: true },
    );

    expect(screen.getByText("Đáp án đúng")).toBeTruthy();
    const img = screen.getByAltText("Hình hoàn chỉnh") as HTMLImageElement;
    expect(img.src).toContain("tranh.png");
  });

  it("không có ảnh → nói bằng lời, không render khung rỗng", () => {
    withGrade(<JigsawPlayer title="Ghép hình" rows={2} cols={2} submitted />, {
      mode: "parent",
      result: "incorrect",
      revealCorrect: true,
    });

    expect(screen.getByText(/tạo lại hình ban đầu/)).toBeTruthy();
    expect(screen.queryByAltText("Hình hoàn chỉnh")).toBeNull();
  });

  it("revealCorrect=false → KHÔNG lộ", () => {
    withGrade(
      <JigsawPlayer
        title="Ghép hình"
        imageUrl="https://cdn.example.com/tranh.png"
        rows={2}
        cols={2}
        submitted
      />,
      { mode: "parent", result: "incorrect", revealCorrect: false },
    );
    expect(screen.queryByText("Đáp án đúng")).toBeNull();
  });
});
