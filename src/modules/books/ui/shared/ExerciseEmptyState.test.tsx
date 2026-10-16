// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExerciseEmptyState } from "./ExerciseEmptyState";

describe("ExerciseEmptyState", () => {
  afterEach(cleanup);

  it("gọi onClose khi bấm Đóng", async () => {
    const onClose = vi.fn();
    render(<ExerciseEmptyState onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Đóng" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("không có onClose thì không hiện nút Đóng", () => {
    render(<ExerciseEmptyState />);
    expect(screen.queryByRole("button", { name: "Đóng" })).toBeNull();
  });
});
