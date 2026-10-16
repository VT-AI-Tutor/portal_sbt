// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach } from "vitest";
import { buildLevelInsights, SCORE_MIN_ATTEMPTS } from "./insights";
import { LevelLadder } from "./LevelLadder";

afterEach(cleanup);

const FRAMEWORK = [
  { code: "biet", label: "Nhận biết", rank: 1, description: "Nhớ, nhận ra kiến thức." },
  { code: "hieu", label: "Thông hiểu", rank: 2, description: "Giải thích, lập luận." },
  { code: "vandung", label: "Vận dụng", rank: 3, description: "Áp dụng vào tình huống mới." },
];
const mk = (rows: [string, number, number, number][]) =>
  buildLevelInsights(rows.map(([code, rank, attempted, correct]) => ({
    code, rank, attempted, correct,
    label: FRAMEWORK.find((f) => f.code === code)!.label,
    percent: attempted > 0 ? Math.round((correct / attempted) * 1000) / 10 : 0,
  })));

describe("LevelLadder", () => {
  it("mức thấp nằm DƯỚI (đọc lên như bậc thang)", () => {
    render(<LevelLadder insights={mk([["biet", 1, 10, 8], ["hieu", 2, 10, 5]])} />);
    const labels = screen.getAllByTestId("ladder-label").map((e) => e.textContent);
    expect(labels).toEqual(["Thông hiểu", "Nhận biết"]);
  });
  it("mức 1–2 câu: KHÔNG có %, có việc cần làm", () => {
    render(<LevelLadder insights={mk([["biet", 1, 10, 8], ["hieu", 2, 2, 1]])} />);
    expect(screen.getByText("Còn 1 câu nữa để đánh giá")).toBeTruthy();
    expect(screen.queryByText("50%")).toBeNull();
  });
  it("mức 3–7 câu: thanh sọc (data-provisional) + nhãn sơ bộ", () => {
    render(<LevelLadder insights={mk([["biet", 1, 5, 3]])} />);
    expect(screen.getByTestId("bar-biet").dataset.provisional).toBe("true");
    expect(screen.getByText("sơ bộ")).toBeTruthy();
  });
  it("mức ≥8 câu: thanh đặc có % đọc được", () => {
    render(<LevelLadder insights={mk([["biet", 1, 10, 7]])} />);
    expect(screen.getByText("70%")).toBeTruthy();
    expect(screen.getByTestId("bar-biet").dataset.provisional).toBe("false");
  });
  it("có vạch mốc 60% và chú thích cách đọc", () => {
    render(<LevelLadder insights={mk([["biet", 1, 10, 7]])} />);
    expect(screen.getAllByTestId("threshold-tick").length).toBeGreaterThan(0);
    expect(screen.getByText(/mốc thành thạo/i)).toBeTruthy();
  });

  // Finding #3 (review 2026-08-07): ladder từng tự suy "đủ mẫu để hiện %" từ
  // `status` thay vì gọi `isScored`. Hai cách diễn đạt CÙNG một luật ở hai nơi
  // là đất trôi — nâng SCORE_MIN_ATTEMPTS lên là ladder lệch khỏi phần còn lại
  // của màn ngay. Test này viết theo HẰNG SỐ, không phải số 3 đóng cứng, nên
  // nó vẫn đúng ý nghĩa (và vẫn canh được lỗi trôi) nếu ngưỡng đổi trong tương lai.
  it("hiện/ẩn % đúng NGAY tại biên SCORE_MIN_ATTEMPTS (không lệch khỏi isScored)", () => {
    render(
      <LevelLadder
        insights={mk([["biet", 1, SCORE_MIN_ATTEMPTS - 1, SCORE_MIN_ATTEMPTS - 1]])}
      />,
    );
    expect(screen.getByText(`Còn 1 câu nữa để đánh giá`)).toBeTruthy();
    expect(screen.queryByText(/%/)).toBeNull();
    cleanup();

    render(
      <LevelLadder
        insights={mk([["biet", 1, SCORE_MIN_ATTEMPTS, SCORE_MIN_ATTEMPTS]])}
      />,
    );
    expect(screen.getByText("100%")).toBeTruthy();
  });
});
