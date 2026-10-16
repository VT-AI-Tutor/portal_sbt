// @vitest-environment jsdom
/**
 * Form hồ sơ giờ phục vụ hai lối vào (hộp thoại ở header và khu sửa tại chỗ
 * trong trang Hồ sơ), nên đường lưu phải chắc: cắt khoảng trắng, KHÔNG gửi khoá
 * avatar khi người dùng không đụng tới nó, và chặn dữ liệu quá dài ngay tại form.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const updateProfile = vi.fn();
const user = {
  full_name: "Nguyễn Văn An",
  email: "student1@demo.local",
  province: "Hà Nội",
  school_name: "",
  class_name: "6A",
  level: "6",
};

vi.mock("@/core/auth/AuthContext", () => ({
  useAuth: () => ({ user, updateProfile }),
}));
// Chỉ thay useLevels (cần mạng); PROVINCES giữ hàng THẬT để test đếm đúng danh
// mục 34 đơn vị chứ không đếm một bản chép trong test.
vi.mock("@/core/reference", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/core/reference")>()),
  useLevels: () => ({ data: [{ code: "6", label: "Lớp 6" }] }),
}));
vi.mock("@/core/auth/AvatarPicker", () => ({
  AvatarPicker: () => <div data-testid="avatar-picker" />,
}));

const { ProfileEditForm } = await import("./ProfileEditForm");

afterEach(() => {
  cleanup();
  updateProfile.mockReset();
});

describe("ProfileEditForm", () => {
  it("nạp sẵn giá trị đang lưu của hồ sơ", () => {
    render(<ProfileEditForm />);
    expect(screen.getByLabelText("Tỉnh/Thành phố")).toHaveProperty(
      "value",
      "Hà Nội",
    );
    expect(screen.getByLabelText("Lớp (VD: 4A)")).toHaveProperty("value", "6A");
  });

  it("Tỉnh/Thành phố là danh mục 34 đơn vị, chọn được chứ không gõ tay", async () => {
    render(<ProfileEditForm />);
    const select = screen.getByLabelText("Tỉnh/Thành phố") as HTMLSelectElement;

    expect(select.tagName).toBe("SELECT");
    // 34 đơn vị + dòng nhắc "Chọn Tỉnh/Thành phố".
    expect(select.options).toHaveLength(35);

    await userEvent.selectOptions(select, "Cà Mau");
    expect(select.value).toBe("Cà Mau");
  });

  it("hồ sơ cũ giữ tên tỉnh đã sáp nhập: vẫn hiện, có chú thích, không bị xoá trắng", () => {
    user.province = "Bắc Giang";
    render(<ProfileEditForm />);
    const select = screen.getByLabelText("Tỉnh/Thành phố") as HTMLSelectElement;

    // Mất option tương ứng thì select rơi về rỗng và lần lưu sau xoá mất tỉnh.
    expect(select.value).toBe("Bắc Giang");
    expect(
      screen.getByRole("option", { name: "Bắc Giang (tên cũ — nên chọn lại)" }),
    ).toBeTruthy();
    user.province = "Hà Nội";
  });

  it("lưu: cắt khoảng trắng thừa và KHÔNG gửi avatar khi không ai đụng tới", async () => {
    updateProfile.mockResolvedValue(undefined);
    const onSaved = vi.fn();
    render(<ProfileEditForm onSaved={onSaved} />);

    const school = screen.getByLabelText("Trường");
    await userEvent.clear(school);
    await userEvent.type(school, "  TH Lê Quý Đôn  ");
    await userEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    await waitFor(() => expect(updateProfile).toHaveBeenCalledTimes(1));
    const payload = updateProfile.mock.calls[0][0];
    expect(payload.school_name).toBe("TH Lê Quý Đôn");
    // Gửi kèm `avatar: undefined` thì backend hiểu "không đổi", nhưng có mặt khoá
    // là mở đường cho lỗi gỡ ảnh ngoài ý muốn — khoá phải VẮNG hẳn.
    expect("avatar" in payload).toBe(false);
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  });

  it("dữ liệu quá dài thì báo lỗi tại form, không gọi lưu", async () => {
    render(<ProfileEditForm />);

    const cls = screen.getByLabelText("Lớp (VD: 4A)");
    await userEvent.clear(cls);
    // maxLength của ô chặn gõ tay ở 20 ký tự; nới ra để kiểm chính luật validate
    // (BE và thao tác dán vẫn có thể đẩy chuỗi dài hơn vào).
    cls.setAttribute("maxlength", "999");
    await userEvent.type(cls, "L".repeat(21));
    await userEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    expect(
      screen.getByText("Lớp quá dài (tối đa 20 ký tự)."),
    ).toBeTruthy();
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it("lưu lỗi thì hiện thông báo và KHÔNG đóng form", async () => {
    updateProfile.mockRejectedValue(new Error("Mất kết nối"));
    const onSaved = vi.fn();
    render(<ProfileEditForm onSaved={onSaved} />);

    await userEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    await waitFor(() => expect(screen.getByText("Mất kết nối")).toBeTruthy());
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("nút Huỷ chỉ hiện khi cha có chỗ để đóng, bấm là gọi onCancel", async () => {
    const onCancel = vi.fn();
    const { rerender } = render(<ProfileEditForm />);
    expect(screen.queryByRole("button", { name: "Huỷ" })).toBeNull();

    rerender(<ProfileEditForm onCancel={onCancel} />);
    await userEvent.click(screen.getByRole("button", { name: "Huỷ" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
