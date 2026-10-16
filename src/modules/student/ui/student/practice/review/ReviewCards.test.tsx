// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TopicMasteryCard } from "./TopicMasteryCard";
import { WeakPointsCard } from "./WeakPointsCard";

afterEach(cleanup);

describe("TopicMasteryCard", () => {
  it("hiện tên chủ đề và phần trăm", () => {
    render(
      <TopicMasteryCard
        mastery={{
          dimension: "content",
          code: "c1",
          label: "Phân số",
          percent: 61.5,
          attempted: 26,
        }}
      />,
    );
    expect(screen.getByText("Phân số")).toBeTruthy();
    expect(screen.getByText(/61[.,]5%/)).toBeTruthy();
    expect(screen.getByText(/26 câu/)).toBeTruthy();
  });

  it("ẩn hoàn toàn khi phiên tổng hợp", () => {
    const { container } = render(<TopicMasteryCard mastery={null} />);
    expect(container.innerHTML).toBe("");
  });
});

describe("WeakPointsCard", () => {
  it("liệt kê phần yếu kèm số câu sai", () => {
    render(
      <WeakPointsCard
        weakPoints={[
          {
            dimension: "component",
            code: "x",
            label: "Thực hiện thao tác tư duy",
            wrong: 3,
            total: 4,
            theory: [],
          },
        ]}
      />,
    );
    expect(screen.getByText("Thực hiện thao tác tư duy")).toBeTruthy();
    expect(screen.getByText(/sai 3\/4 câu/)).toBeTruthy();
  });

  it("ẩn khi không có phần yếu nào", () => {
    const { container } = render(<WeakPointsCard weakPoints={[]} />);
    expect(container.innerHTML).toBe("");
  });
});
