// @vitest-environment jsdom
/**
 * ChangePasswordDialog: đổi MK gửi mật khẩu cũ/mới qua endpoint change-password,
 * đổi thành công thì đăng xuất + về trang chủ.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";

const lcmsChangePassword = vi.fn(async (_p: unknown) => {});
const clearLcmsMustChangePassword = vi.fn();
// vi.hoisted: factory của vi.mock được hoist lên đầu file nên không đọc được
// biến khai báo thường ở top-level.
const { FakeLcmsApiError } = vi.hoisted(() => ({
  FakeLcmsApiError: class FakeLcmsApiError extends Error {
    statusCode: number;
    constructor(statusCode: number, message: string) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));
vi.mock("@/core/api/lcmsAdapter", () => ({
  lcmsChangePassword: (p: unknown) => lcmsChangePassword(p as never),
  clearLcmsMustChangePassword: () => clearLcmsMustChangePassword(),
  LcmsApiError: FakeLcmsApiError,
}));

const logoutMock = vi.fn(async () => {});
vi.mock("@/core/auth/AuthContext", () => ({
  useAuth: () => ({ logout: logoutMock }),
}));

const navigateMock = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router-dom")>();
  return { ...mod, useNavigate: () => navigateMock };
});

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from "sonner";
import { ChangePasswordDialog } from "./ChangePasswordDialog";

const toastError = vi.mocked(toast.error);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ChangePasswordDialog", () => {
  it("đổi MK gửi mật khẩu cũ/mới rồi đăng xuất", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();

    render(<ChangePasswordDialog open onOpenChange={() => {}} />);

    await user.type(screen.getByLabelText("Mật khẩu hiện tại"), "matkhaucu");
    await user.type(screen.getByLabelText("Mật khẩu mới"), "matkhaumoi");
    await user.type(screen.getByLabelText("Xác nhận mật khẩu"), "matkhaumoi");
    await user.click(screen.getByRole("button", { name: /Cập nhật mật khẩu/ }));

    await waitFor(() => expect(lcmsChangePassword).toHaveBeenCalled());
    expect(lcmsChangePassword).toHaveBeenCalledWith(
      expect.objectContaining({
        oldPassword: "matkhaucu",
        newPassword: "matkhaumoi",
        confirmPassword: "matkhaumoi",
      }),
    );
    await waitFor(() => expect(logoutMock).toHaveBeenCalled());
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/"));
  });

  it("forced + presetOldPassword: ẩn ô mật khẩu cũ, gửi mật khẩu mặc định, xóa cờ, GIỮ phiên", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <ChangePasswordDialog
        open
        onOpenChange={onOpenChange}
        forced
        presetOldPassword="qazXSW@123"
      />,
    );

    // Ô "mật khẩu hiện tại" bị ẩn vì đã điền sẵn.
    expect(screen.queryByLabelText("Mật khẩu hiện tại")).toBeNull();

    await user.type(screen.getByLabelText("Mật khẩu mới"), "matkhaumoi");
    await user.type(screen.getByLabelText("Xác nhận mật khẩu"), "matkhaumoi");
    await user.click(screen.getByRole("button", { name: /Cập nhật mật khẩu/ }));

    await waitFor(() => expect(lcmsChangePassword).toHaveBeenCalled());
    expect(lcmsChangePassword).toHaveBeenCalledWith(
      expect.objectContaining({
        oldPassword: "qazXSW@123",
        newPassword: "matkhaumoi",
        confirmPassword: "matkhaumoi",
      }),
    );
    await waitFor(() => expect(clearLcmsMustChangePassword).toHaveBeenCalled());
    // Lần đầu KHÔNG đăng xuất (giữ phiên); modal đóng qua onOpenChange(false).
    expect(logoutMock).not.toHaveBeenCalled();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  // SBT_1308 (đỏ, dòng 57): mật khẩu mới sai quy tắc ATTT chỉ hiện toast
  // "LCMS API error 400" — vô nghĩa với học sinh.
  it("server 400 không kèm message → toast lỗi ĐỌC ĐƯỢC", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    lcmsChangePassword.mockRejectedValueOnce(
      new FakeLcmsApiError(400, "LCMS API error 400"),
    );

    render(<ChangePasswordDialog open onOpenChange={() => {}} />);
    await user.type(screen.getByLabelText("Mật khẩu hiện tại"), "matkhaucu");
    await user.type(screen.getByLabelText("Mật khẩu mới"), "123456789");
    await user.type(screen.getByLabelText("Xác nhận mật khẩu"), "123456789");
    await user.click(screen.getByRole("button", { name: /Cập nhật mật khẩu/ }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        expect.stringMatching(/yêu cầu an toàn/),
      ),
    );
    expect(toastError).not.toHaveBeenCalledWith(
      expect.stringMatching(/LCMS API error/),
    );
    expect(logoutMock).not.toHaveBeenCalled();
  });

  it("server 400 với message đã dịch từ mã lỗi → toast đúng câu tiếng Việt", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    lcmsChangePassword.mockRejectedValueOnce(
      new FakeLcmsApiError(
        400,
        "Mật khẩu không được chứa dãy ký tự liên tiếp (123, abc) hoặc lặp lại (aaa).",
      ),
    );

    render(<ChangePasswordDialog open onOpenChange={() => {}} />);
    await user.type(screen.getByLabelText("Mật khẩu hiện tại"), "matkhaucu");
    await user.type(screen.getByLabelText("Mật khẩu mới"), "Abcd@123456");
    await user.type(screen.getByLabelText("Xác nhận mật khẩu"), "Abcd@123456");
    await user.click(screen.getByRole("button", { name: /Cập nhật mật khẩu/ }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "Mật khẩu không được chứa dãy ký tự liên tiếp (123, abc) hoặc lặp lại (aaa).",
      ),
    );
  });

  it("mật khẩu mới quá ngắn → toast lỗi, không gọi API", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();

    render(<ChangePasswordDialog open onOpenChange={() => {}} />);
    await user.type(screen.getByLabelText("Mật khẩu hiện tại"), "matkhaucu");
    await user.type(screen.getByLabelText("Mật khẩu mới"), "123");
    await user.type(screen.getByLabelText("Xác nhận mật khẩu"), "123");
    await user.click(screen.getByRole("button", { name: /Cập nhật mật khẩu/ }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        expect.stringMatching(/tối thiểu 8 ký tự/),
      ),
    );
    expect(lcmsChangePassword).not.toHaveBeenCalled();
  });

  it("mất mạng (TypeError) → toast lỗi kết nối, không lộ chuỗi của trình duyệt", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    lcmsChangePassword.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    render(<ChangePasswordDialog open onOpenChange={() => {}} />);
    await user.type(screen.getByLabelText("Mật khẩu hiện tại"), "matkhaucu");
    await user.type(screen.getByLabelText("Mật khẩu mới"), "matkhaumoi");
    await user.type(screen.getByLabelText("Xác nhận mật khẩu"), "matkhaumoi");
    await user.click(screen.getByRole("button", { name: /Cập nhật mật khẩu/ }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        expect.stringMatching(/Không kết nối được máy chủ/),
      ),
    );
    expect(toastError).not.toHaveBeenCalledWith(
      expect.stringMatching(/Failed to fetch/),
    );
  });

  it("forced: nút Đăng xuất đăng xuất + về trang chủ", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();

    render(
      <ChangePasswordDialog
        open
        onOpenChange={() => {}}
        forced
        presetOldPassword="qazXSW@123"
      />,
    );

    await user.click(screen.getByRole("button", { name: /Đăng xuất/ }));
    await waitFor(() => expect(logoutMock).toHaveBeenCalled());
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/"));
  });
});
