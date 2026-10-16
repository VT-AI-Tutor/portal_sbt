// @vitest-environment jsdom
/**
 * ForgotPasswordDialog rẽ hai nhánh theo provider: LCMS gửi mật khẩu mới qua email
 * (một bước, dừng ở màn "đã gửi" có lối quay lại đăng nhập), native cấp mã khôi phục
 * rồi mới nhập mật khẩu mới (hai bước).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

const forgotPassword = vi.fn(
  async (_email: string) => undefined as string | undefined,
);
const forgotPasswordEmailsNewPassword = vi.fn(() => true);
vi.mock("@/core/auth/api", () => ({
  forgotPassword: (email: string) => forgotPassword(email),
  forgotPasswordEmailsNewPassword: () => forgotPasswordEmailsNewPassword(),
  resetPassword: vi.fn(async () => undefined),
}));

import { ForgotPasswordDialog } from "./ForgotPasswordDialog";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  forgotPasswordEmailsNewPassword.mockReturnValue(true);
});

async function submitEmail(
  email: string,
  handlers: {
    onOpenChange?: (open: boolean) => void;
    onReset?: () => void;
  } = {},
) {
  const { userEvent } = await import("@testing-library/user-event");
  const user = userEvent.setup();
  render(
    <ForgotPasswordDialog
      open
      onOpenChange={handlers.onOpenChange ?? (() => {})}
      onReset={handlers.onReset}
    />,
  );
  await user.type(screen.getByLabelText("Email"), email);
  await user.click(
    screen.getByRole("button", { name: /Đặt lại mật khẩu|Gửi mã khôi phục/ }),
  );
  return user;
}

describe("ForgotPasswordDialog", () => {
  it("LCMS: gửi xong dừng ở màn 'đã gửi', KHÔNG hỏi mã khôi phục", async () => {
    await submitEmail("hoc-sinh@example.com");

    expect(forgotPassword).toHaveBeenCalledWith("hoc-sinh@example.com");
    expect(await screen.findByText(/Mật khẩu mới đã được gửi/)).toBeTruthy();
    expect(screen.queryByLabelText("Mã khôi phục")).toBeNull();
  });

  it("LCMS: màn 'đã gửi' có nút Đăng nhập mở lại hộp đăng nhập", async () => {
    const onOpenChange = vi.fn();
    const onReset = vi.fn();

    const user = await submitEmail("hoc-sinh@example.com", {
      onOpenChange,
      onReset,
    });
    await user.click(await screen.findByRole("button", { name: "Đăng nhập" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onReset).toHaveBeenCalled();
  });

  it("LCMS: nút Đóng chỉ đóng, KHÔNG mở lại hộp đăng nhập", async () => {
    const onReset = vi.fn();

    const user = await submitEmail("hoc-sinh@example.com", { onReset });
    await user.click(await screen.findByRole("button", { name: "Đóng" }));

    expect(onReset).not.toHaveBeenCalled();
  });

  it("LCMS: lỗi từ máy chủ hiện nguyên câu và giữ nguyên bước nhập email", async () => {
    forgotPassword.mockRejectedValueOnce(
      new Error("Không gửi được yêu cầu đặt lại mật khẩu. Vui lòng thử lại."),
    );

    await submitEmail("khong-ton-tai@example.com");

    expect(
      await screen.findByText("Không gửi được yêu cầu đặt lại mật khẩu. Vui lòng thử lại."),
    ).toBeTruthy();
    expect(screen.getByLabelText("Email")).toBeTruthy();
  });

  it("native: gửi xong chuyển sang bước nhập mã + mật khẩu mới", async () => {
    forgotPasswordEmailsNewPassword.mockReturnValue(false);

    await submitEmail("hoc-sinh@example.com");

    expect(await screen.findByLabelText("Mã khôi phục")).toBeTruthy();
    expect(screen.getByLabelText("Mật khẩu mới")).toBeTruthy();
  });
});
