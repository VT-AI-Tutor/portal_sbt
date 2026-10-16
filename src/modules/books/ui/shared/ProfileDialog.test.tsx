// @vitest-environment jsdom
/**
 * ProfileDialog: ô "Ngày sinh" (date picker) nạp từ hồ sơ, hiển thị dd/MM/yyyy
 * và gửi ngày đã chọn (yyyy-MM-dd) khi "Lưu thông tin"; ảnh đại diện tải lên
 * trước, id ảnh chỉ vào hồ sơ khi bấm lưu.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";

const lcmsGetCurrentUser = vi.fn();
const lcmsListProvinces = vi.fn();
const lcmsUpdateProfile = vi.fn(async (_p: unknown) => {});
const lcmsUploadAvatar = vi.fn(async (_f: File) => "345413326815101010");
const lcmsFetchAvatarDataUrl = vi.fn(
  async (_id: string) => "data:image/png;base64,iVBORw0KGgo",
);

vi.mock("@/core/api/lcmsAdapter", () => ({
  lcmsGetCurrentUser: () => lcmsGetCurrentUser(),
  lcmsListProvinces: () => lcmsListProvinces(),
  lcmsUpdateProfile: (p: unknown) => lcmsUpdateProfile(p as never),
  lcmsUploadAvatar: (f: File) => lcmsUploadAvatar(f),
  lcmsFetchAvatarDataUrl: (id: string) => lcmsFetchAvatarDataUrl(id),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from "sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ProfileDialog } from "./ProfileDialog";
import { avatarWasRejected } from "./lcmsAvatarState";

afterEach(cleanup);
afterEach(() => vi.clearAllMocks());

/**
 * Hồ sơ giờ nằm trong cache react-query dùng chung với header. Mỗi ca một
 * QueryClient mới, tắt retry — không thì dữ liệu của ca trước rò sang ca sau và
 * lỗi được thử lại làm test chậm mà chẳng để làm gì.
 */
function renderDialog(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe("ProfileDialog — ngày sinh", () => {
  it("nạp birthDate, hiển thị dd/MM/yyyy và gửi ngày đã chọn khi lưu", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    lcmsGetCurrentUser.mockResolvedValue({
      id: "42",
      username: "hs",
      geoCode: "01",
      birthDate: "2010-05-02T00:00:00Z",
    });
    lcmsListProvinces.mockResolvedValue([{ code: "01", name: "Hà Nội" }]);

    renderDialog(<ProfileDialog open onOpenChange={() => {}} />);

    // Nút mở lịch hiển thị ngày đã seed theo dd/MM/yyyy.
    const trigger = await screen.findByLabelText("Ngày sinh");
    expect(trigger.textContent).toContain("02/05/2010");

    // Mở lịch (mặc định mở tháng 5/2010) và chọn ngày 15 (độc lập locale).
    await user.click(trigger);
    const day = await waitFor(() => screen.getByText("15"));
    await user.click(day);

    await user.click(screen.getByRole("button", { name: /Lưu thông tin/ }));

    await waitFor(() => expect(lcmsUpdateProfile).toHaveBeenCalled());
    expect(lcmsUpdateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ geoCode: "01", birthDate: "2010-05-15" }),
    );
  });
});

describe("ProfileDialog — chỉ đọc", () => {
  it("hiện tỉnh + ngày sinh đã khoá và không có nút lưu", async () => {
    lcmsGetCurrentUser.mockResolvedValue({
      id: "42",
      username: "hs",
      geoCode: "01",
      birthDate: "2010-05-02T00:00:00Z",
    });
    lcmsListProvinces.mockResolvedValue([{ code: "01", name: "Hà Nội" }]);

    renderDialog(<ProfileDialog open onOpenChange={() => {}} readOnly />);

    const province = (await screen.findByLabelText(
      "Tỉnh/Thành phố",
    )) as HTMLInputElement;
    await waitFor(() => expect(province.value).toBe("Hà Nội"));
    expect(province.disabled).toBe(true);

    const birthDate = screen.getByLabelText("Ngày sinh") as HTMLInputElement;
    expect(birthDate.value).toBe("02/05/2010");
    expect(birthDate.disabled).toBe(true);

    expect(screen.queryByRole("button", { name: /Lưu thông tin/ })).toBeNull();
    expect(screen.getByRole("heading", { name: "Hồ sơ" })).toBeTruthy();
  });
});

describe("avatarWasRejected", () => {
  const me = (avatarId?: string) => ({ id: "42", avatarId }) as never;

  it("chỉ kết luận từ chối khi máy chủ trả về id KHÁC id vừa gửi", () => {
    expect(avatarWasRejected("111", me("222"))).toBe(true);
    expect(avatarWasRejected("111", me("111"))).toBe(false);
  });

  it("thiếu bằng chứng thì không kết luận", () => {
    expect(avatarWasRejected("111", me(undefined))).toBe(false);
    expect(avatarWasRejected(null, me("222"))).toBe(false);
  });
});

describe("ProfileDialog — ảnh đại diện", () => {
  it("tải ảnh lên rồi gửi kèm id ảnh khi lưu hồ sơ", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:picked"),
      revokeObjectURL: vi.fn(),
    });
    lcmsGetCurrentUser.mockResolvedValue({
      id: "42",
      username: "hs",
      geoCode: "01",
    });
    lcmsListProvinces.mockResolvedValue([{ code: "01", name: "Hà Nội" }]);

    renderDialog(<ProfileDialog open onOpenChange={() => {}} />);

    const input = (await screen.findByTestId(
      "avatar-input",
    )) as HTMLInputElement;
    await user.upload(
      input,
      new File(["x"], "avatar.png", { type: "image/png" }),
    );
    await waitFor(() => expect(lcmsUploadAvatar).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: /Lưu thông tin/ }));
    await waitFor(() =>
      expect(lcmsUpdateProfile).toHaveBeenCalledWith(
        expect.objectContaining({ avatar: "345413326815101010" }),
      ),
    );
  });

  it("máy chủ không giữ ảnh vừa gửi thì báo thẳng, không toast 'đã lưu'", async () => {
    // Triệu chứng QA 25/08: lưu xong toast xanh nhưng hồ sơ vẫn ảnh cũ. Đọc lại
    // /current là cách duy nhất biết update-new-user có ghi avatar hay không.
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:picked"),
      revokeObjectURL: vi.fn(),
    });
    lcmsGetCurrentUser.mockResolvedValue({
      id: "42",
      username: "hs",
      geoCode: "01",
      avatarId: "111111111111111111", // ảnh CŨ — máy chủ không nhận id mới
    });
    lcmsListProvinces.mockResolvedValue([{ code: "01", name: "Hà Nội" }]);

    renderDialog(<ProfileDialog open onOpenChange={() => {}} />);
    const input = (await screen.findByTestId(
      "avatar-input",
    )) as HTMLInputElement;
    await user.upload(
      input,
      new File(["x"], "avatar.png", { type: "image/png" }),
    );
    await waitFor(() => expect(lcmsUploadAvatar).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: /Lưu thông tin/ }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("chưa nhận ảnh đại diện mới"),
      ),
    );
    expect(toast.success).not.toHaveBeenCalledWith("Đã lưu thông tin.");
  });

  it("máy chủ giữ đúng ảnh vừa gửi thì báo lưu thành công", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:picked"),
      revokeObjectURL: vi.fn(),
    });
    lcmsGetCurrentUser.mockResolvedValue({
      id: "42",
      username: "hs",
      geoCode: "01",
      avatarId: "345413326815101010",
    });
    lcmsListProvinces.mockResolvedValue([{ code: "01", name: "Hà Nội" }]);

    renderDialog(<ProfileDialog open onOpenChange={() => {}} />);
    const input = (await screen.findByTestId(
      "avatar-input",
    )) as HTMLInputElement;
    await user.upload(
      input,
      new File(["x"], "avatar.png", { type: "image/png" }),
    );
    await waitFor(() => expect(lcmsUploadAvatar).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: /Lưu thông tin/ }));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Đã lưu thông tin."),
    );
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("bị từ chối rồi lưu lại vẫn gửi ĐÚNG id ảnh mới, không rơi về id cũ", async () => {
    // Ca này bao lỗi: sau khi từ chối, nếu state lấy id CŨ của máy chủ đè lên id
    // vừa tải lên thì lần lưu thứ hai gửi id cũ — ảnh mới mất mà lại báo thành công.
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:picked"),
      revokeObjectURL: vi.fn(),
    });
    lcmsGetCurrentUser.mockResolvedValue({
      id: "42",
      username: "hs",
      geoCode: "01",
      avatarId: "111111111111111111", // máy chủ khăng khăng giữ ảnh cũ
    });
    lcmsListProvinces.mockResolvedValue([{ code: "01", name: "Hà Nội" }]);

    renderDialog(<ProfileDialog open onOpenChange={() => {}} />);
    await user.upload(
      (await screen.findByTestId("avatar-input")) as HTMLInputElement,
      new File(["x"], "avatar.png", { type: "image/png" }),
    );
    await waitFor(() => expect(lcmsUploadAvatar).toHaveBeenCalled());

    const save = screen.getByRole("button", { name: /Lưu thông tin/ });
    await user.click(save);
    await waitFor(() => expect(toast.error).toHaveBeenCalled());

    await user.click(save);
    await waitFor(() => expect(lcmsUpdateProfile).toHaveBeenCalledTimes(2));
    expect(lcmsUpdateProfile.mock.calls.at(-1)?.[0]).toMatchObject({
      avatar: "345413326815101010",
    });
    // Lần hai vẫn bị từ chối → vẫn phải báo đỏ, không được lẳng lặng báo thành công.
    expect(toast.success).not.toHaveBeenCalledWith("Đã lưu thông tin.");
  });

  it("lưu xong chỉ đọc lại /current ĐÚNG MỘT lượt", async () => {
    // Trước đây: một lượt lúc mở, một lượt để đối chiếu, một lượt nữa do cache
    // header bị invalidate. Giờ fetchQuery làm cả hai việc sau bằng một lượt.
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    lcmsGetCurrentUser.mockResolvedValue({
      id: "42",
      username: "hs",
      geoCode: "01",
    });
    lcmsListProvinces.mockResolvedValue([{ code: "01", name: "Hà Nội" }]);

    renderDialog(<ProfileDialog open onOpenChange={() => {}} />);
    await user.click(
      await screen.findByRole("button", { name: /Lưu thông tin/ }),
    );
    await waitFor(() => expect(lcmsUpdateProfile).toHaveBeenCalled());
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Đã lưu thông tin."),
    );
    expect(lcmsGetCurrentUser).toHaveBeenCalledTimes(2); // mở + đối chiếu
  });

  it("máy chủ không trả id ảnh thì IM LẶNG, không vu cho nó là chưa lưu", async () => {
    // Thiếu id là thiếu bằng chứng, không phải bằng chứng phản chứng — báo lỗi
    // ở đây là báo sai.
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:picked"),
      revokeObjectURL: vi.fn(),
    });
    lcmsGetCurrentUser
      .mockResolvedValueOnce({ id: "42", username: "hs", geoCode: "01" })
      .mockResolvedValue({ id: "42", username: "hs", geoCode: "01" });
    lcmsListProvinces.mockResolvedValue([{ code: "01", name: "Hà Nội" }]);

    renderDialog(<ProfileDialog open onOpenChange={() => {}} />);
    await user.upload(
      (await screen.findByTestId("avatar-input")) as HTMLInputElement,
      new File(["x"], "avatar.png", { type: "image/png" }),
    );
    await waitFor(() => expect(lcmsUploadAvatar).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: /Lưu thông tin/ }));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Đã lưu thông tin."),
    );
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("hồ sơ chưa lưu ảnh thì KHÔNG gửi khoá avatar", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    lcmsGetCurrentUser.mockResolvedValue({
      id: "42",
      username: "hs",
      geoCode: "01",
    });
    lcmsListProvinces.mockResolvedValue([{ code: "01", name: "Hà Nội" }]);

    renderDialog(<ProfileDialog open onOpenChange={() => {}} />);

    await user.click(
      await screen.findByRole("button", { name: /Lưu thông tin/ }),
    );
    await waitFor(() => expect(lcmsUpdateProfile).toHaveBeenCalled());
    expect(lcmsUpdateProfile.mock.calls.at(-1)?.[0]).not.toHaveProperty(
      "avatar",
    );
  });
});
