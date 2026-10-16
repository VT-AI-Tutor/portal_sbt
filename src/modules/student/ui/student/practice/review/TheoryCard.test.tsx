// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { TheoryCard } from "./TheoryCard";
import { WeakPointsCard } from "./WeakPointsCard";

afterEach(cleanup);

const entry = {
  id: "t1",
  title: "Ôn lại thao tác tư duy",
  blocks: [{ type: "paragraph", text: "Muốn so sánh hai phân số cùng mẫu…" }],
};

describe("TheoryCard", () => {
  it("thu gọn mặc định, mở rộng khi bấm", async () => {
    render(<TheoryCard entry={entry} />);
    expect(screen.getByText("Ôn lại thao tác tư duy")).toBeTruthy();
    expect(screen.queryByText(/Muốn so sánh hai phân số/)).toBeNull();

    await userEvent.click(
      screen.getByRole("button", { name: /Đọc lý thuyết/i }),
    );
    expect(screen.getByText(/Muốn so sánh hai phân số/)).toBeTruthy();
  });
});

describe("WeakPointsCard + lý thuyết", () => {
  it("hiện thẻ lý thuyết dưới phần yếu", () => {
    render(
      <WeakPointsCard
        weakPoints={[
          {
            dimension: "component",
            code: "x",
            label: "Thao tác tư duy",
            wrong: 2,
            total: 3,
            theory: [entry],
          },
        ]}
      />,
    );
    expect(screen.getByText("Ôn lại thao tác tư duy")).toBeTruthy();
  });

  it("không có mục lý thuyết thì chỉ còn dòng nêu tên", () => {
    render(
      <WeakPointsCard
        weakPoints={[
          {
            dimension: "content",
            code: "y",
            label: "Phân số",
            wrong: 1,
            total: 2,
            theory: [],
          },
        ]}
      />,
    );
    expect(screen.getByText("Phân số")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Đọc lý thuyết/i })).toBeNull();
  });
});
