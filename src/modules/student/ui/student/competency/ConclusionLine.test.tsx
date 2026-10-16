// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ConclusionLine } from "./ConclusionLine";

afterEach(cleanup);

describe("ConclusionLine", () => {
  it("break: vững đến X, hụt ở Y", () => {
    render(<ConclusionLine conclusion={{ kind: "break", masteredLabel: "Nhận biết", breakLabel: "Thông hiểu", breakCode: "hieu" }} />);
    expect(screen.getByTestId("conclusion").textContent).toBe(
      "Em vững đến mức Nhận biết. Bắt đầu hụt ở Thông hiểu.",
    );
  });
  it("from_start", () => {
    render(<ConclusionLine conclusion={{ kind: "from_start", firstLabel: "Nhận biết", firstCode: "biet" }} />);
    expect(screen.getByTestId("conclusion").textContent).toBe("Em cần củng cố ngay từ mức Nhận biết.");
  });
  it("insufficient có mức vững", () => {
    render(<ConclusionLine conclusion={{ kind: "insufficient", masteredLabel: "Nhận biết", unscoredLabel: "Thông hiểu", unscoredCode: "hieu", remaining: 2 }} />);
    expect(screen.getByTestId("conclusion").textContent).toBe(
      "Em vững đến Nhận biết. Chưa đủ bài để đánh giá Thông hiểu.",
    );
  });
  it("insufficient không có mức vững", () => {
    render(<ConclusionLine conclusion={{ kind: "insufficient", masteredLabel: null, unscoredLabel: "Nhận biết", unscoredCode: "biet", remaining: 3 }} />);
    expect(screen.getByTestId("conclusion").textContent).toBe(
      "Chưa đủ bài để đánh giá Nhận biết — còn 3 câu nữa.",
    );
  });
  it("all_mastered", () => {
    render(<ConclusionLine conclusion={{ kind: "all_mastered" }} />);
    expect(screen.getByTestId("conclusion").textContent).toContain("vững");
  });
  it("empty -> không render", () => {
    const { container } = render(<ConclusionLine conclusion={{ kind: "empty" }} />);
    expect(container.innerHTML).toBe("");
  });
});
