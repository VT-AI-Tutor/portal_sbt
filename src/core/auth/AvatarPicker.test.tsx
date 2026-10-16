// @vitest-environment jsdom
/**
 * I.3.2 — đổi ảnh đại diện.
 *
 * Component dùng CHUNG cho hai màn hồ sơ (khu học sinh + luồng sách bài tập),
 * nên hành vi phải khoá ở đây một lần thay vì test hai chỗ.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { AvatarPicker } from "./AvatarPicker";
import * as api from "@/core/auth/api";

vi.mock("@/core/auth/api", () => ({
  supportsAvatarUpload: vi.fn(() => true),
  uploadAvatar: vi.fn(async () => "/storage/avatars/moi.png"),
}));

vi.mock("@/core/auth/storage", () => ({
  getStoredSession: () => ({ accessToken: "tok" }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mocked = api as unknown as {
  supportsAvatarUpload: ReturnType<typeof vi.fn>;
  uploadAvatar: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  mocked.supportsAvatarUpload.mockReturnValue(true);
  mocked.uploadAvatar.mockResolvedValue("/storage/avatars/moi.png");
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function pngFile(name = "toi.png", type = "image/png", size = 1024) {
  const f = new File(["x"], name, { type });
  Object.defineProperty(f, "size", { value: size });
  return f;
}

describe("AvatarPicker", () => {
  it("chưa có ảnh → hiện chữ cái tên, nút là 'Chọn ảnh', không có nút gỡ", () => {
    render(<AvatarPicker displayName="Nguyễn Văn An" onChange={() => {}} />);

    expect(screen.getByText("A")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Chọn ảnh/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Gỡ ảnh/ })).toBeNull();
  });

  it("tải ảnh xong thì báo url mới lên cha", async () => {
    const onChange = vi.fn();
    render(<AvatarPicker displayName="An" onChange={onChange} />);

    await userEvent.upload(screen.getByTestId("avatar-input"), pngFile());

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith("/storage/avatars/moi.png"),
    );
    expect(mocked.uploadAvatar).toHaveBeenCalledWith("tok", expect.any(File));
  });

  it("gỡ ảnh báo null — khác hẳn 'không đụng tới'", async () => {
    const onChange = vi.fn();
    render(
      <AvatarPicker
        displayName="An"
        avatarUrl="/storage/avatars/cu.png"
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Gỡ ảnh/ }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  /** Chặn sớm để khỏi tốn một vòng mạng rồi mới nhận 422 từ server. */
  it("chặn tệp không phải ảnh và ảnh quá lớn, không gọi API", async () => {
    const onChange = vi.fn();
    render(<AvatarPicker displayName="An" onChange={onChange} />);
    const input = screen.getByTestId("avatar-input");

    await userEvent.upload(input, pngFile("bai.pdf", "application/pdf"));
    await userEvent.upload(
      input,
      pngFile("to.png", "image/png", 6 * 1024 * 1024),
    );

    expect(mocked.uploadAvatar).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("provider chưa hỗ trợ → vô hiệu và nói rõ lý do", () => {
    mocked.supportsAvatarUpload.mockReturnValue(false);
    render(<AvatarPicker displayName="An" onChange={() => {}} />);

    expect(
      (screen.getByRole("button", { name: /Chọn ảnh/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(screen.getByText(/chưa hỗ trợ đổi ảnh đại diện/i)).toBeTruthy();
  });

  it("tải thất bại thì KHÔNG báo thay đổi lên cha", async () => {
    mocked.uploadAvatar.mockRejectedValue(new Error("Mạng lỗi"));
    const onChange = vi.fn();
    render(<AvatarPicker displayName="An" onChange={onChange} />);

    await userEvent.upload(screen.getByTestId("avatar-input"), pngFile());

    await waitFor(() => expect(mocked.uploadAvatar).toHaveBeenCalled());
    expect(onChange).not.toHaveBeenCalled();
  });

  it("413 → câu về dung lượng, KHÔNG phải lỗi thô của gateway", async () => {
    // Đúng shape AuthApiError của đường legacy: câu mặc định nó dựng ra là
    // "Đã xảy ra lỗi khi đăng nhập (mã 413)" — vừa lộ mã, vừa sai ngữ cảnh.
    const err = Object.assign(
      new Error("Đã xảy ra lỗi khi đăng nhập (mã 413). Vui lòng thử lại."),
      { status: 413 },
    );
    mocked.uploadAvatar.mockRejectedValue(err);
    render(<AvatarPicker displayName="An" onChange={() => {}} />);

    await userEvent.upload(screen.getByTestId("avatar-input"), pngFile());

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("File quá lớn, em thử lại nhé!"),
    );
  });

  it("mã khác 413 giữ NGUYÊN câu cũ — câu dung lượng không được lan ra", async () => {
    const err = Object.assign(new Error("Máy chủ đang bận."), { status: 500 });
    mocked.uploadAvatar.mockRejectedValue(err);
    render(<AvatarPicker displayName="An" onChange={() => {}} />);

    await userEvent.upload(screen.getByTestId("avatar-input"), pngFile());

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Máy chủ đang bận."),
    );
  });
});
