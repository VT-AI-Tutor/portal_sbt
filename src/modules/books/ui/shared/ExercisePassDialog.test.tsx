// @vitest-environment jsdom
/**
 * ExercisePassDialog: sai mật khẩu thì hành động bị chặn, đúng thì chạy tiếp và
 * cờ mở khoá nhớ theo TỪNG SÁCH (mở cuốn này không mở cuốn khác).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ExercisePassDialog,
  hasEnteredExercisePass,
} from "./ExercisePassDialog";

vi.mock("@/core/api/config", () => ({ getExercisePass: () => "7044" }));

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

async function enter(pass: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Mật khẩu thử nghiệm"), pass);
  await user.click(screen.getByRole("button", { name: "Xác nhận" }));
}

describe("ExercisePassDialog", () => {
  it("sai mật khẩu → không chạy hành động, không ghi cờ mở khoá", async () => {
    const onVerified = vi.fn();
    render(
      <ExercisePassDialog
        open
        bookKey="47"
        onOpenChange={() => {}}
        onVerified={onVerified}
      />,
    );

    await enter("1234");

    expect(onVerified).not.toHaveBeenCalled();
    expect(hasEnteredExercisePass("47")).toBe(false);
  });

  it("đúng mật khẩu → chạy hành động và mở khoá đúng cuốn sách đó", async () => {
    const onVerified = vi.fn();
    render(
      <ExercisePassDialog
        open
        bookKey="47"
        onOpenChange={() => {}}
        onVerified={onVerified}
      />,
    );

    await enter("7044");

    expect(onVerified).toHaveBeenCalledTimes(1);
    expect(hasEnteredExercisePass("47")).toBe(true);
    // Khoá dùng chung nhưng phải hỏi lại ở cuốn khác — nếu cờ vẫn là một biến
    // toàn cục như bản đầu thì mở một cuốn là mở sạch thư viện.
    expect(hasEnteredExercisePass("48")).toBe(false);
  });

  it("chưa biết là sách nào thì coi như chưa mở khoá", () => {
    expect(hasEnteredExercisePass(null)).toBe(false);
  });
});
