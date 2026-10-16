// @vitest-environment jsdom
/**
 * Trang landing luyện tập: bố cục 2 mục (hero + khu duyệt) theo trang tham khảo.
 *
 * Thay đổi lần này thuần layout nên các test đơn vị sẵn có (demo engine,
 * analytics) không phủ gì — đây là render test đầu tiên của module.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import type { ReferenceItem } from "@/core/reference";
import type { PracticeTopicItem } from "@/modules/catalog/api/types";

const trackLandingEvent = vi.fn();
const topicsState = {
  data: [] as PracticeTopicItem[],
  isLoading: false,
  isError: false,
};
const levelsState = {
  data: [] as ReferenceItem[],
  isLoading: false,
  isError: false,
};
const subjectsState = { data: [] as ReferenceItem[], isLoading: false };

vi.mock("@/core/auth/AuthContext", () => ({
  useAuth: () => ({ isAuthenticated: false, user: null }),
}));
vi.mock("@/core/reference", async (orig) => ({
  ...(await orig<typeof import("@/core/reference")>()),
  useLevels: () => ({ ...levelsState, refetch: vi.fn() }),
  useSubjects: () => subjectsState,
}));
vi.mock("@/modules/catalog/hooks/useCatalog", () => ({
  usePracticeTopics: () => ({ ...topicsState, refetch: vi.fn() }),
}));
vi.mock("@/modules/books/ui/public/RegisterDialog", () => ({
  RegisterDialog: () => null,
}));
vi.mock("@/modules/books/ui/public/StudentLoginDialog", () => ({
  StudentLoginDialog: () => null,
}));
vi.mock("./analytics", () => ({
  trackLandingEvent: (...a: unknown[]) => trackLandingEvent(...a),
}));

import { PracticeLandingPage } from "./PracticeLandingPage";

function topic(
  over: Partial<PracticeTopicItem> & { content_code: string },
): PracticeTopicItem {
  return {
    level: "1",
    subject_code: "toan",
    subject_name: "Toán",
    label: `Chủ đề ${over.content_code}`,
    question_available: 20,
    ...over,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <PracticeLandingPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  trackLandingEvent.mockClear();
  // Cố tình khai báo LỆCH thứ tự để chứng minh trang sắp theo `order`.
  levelsState.data = [
    { code: "10", label: "Lớp 10", order: 10 },
    { code: "2", label: "Lớp 2", order: 2 },
  ];
  levelsState.isLoading = false;
  levelsState.isError = false;
  subjectsState.data = [
    { code: "tieng-viet", label: "Tiếng Việt", order: 2 },
    { code: "toan", label: "Toán", order: 1 },
  ];
  subjectsState.isLoading = false;
  topicsState.data = [
    topic({ content_code: "A", level: "2" }),
    topic({
      content_code: "B",
      level: "2",
      subject_code: "tieng-viet",
      subject_name: "Tiếng Việt",
    }),
    topic({ content_code: "C", level: "10" }),
  ];
  topicsState.isLoading = false;
  topicsState.isError = false;
});

afterEach(cleanup);

describe("PracticeLandingPage", () => {
  it("vẽ đúng hai mục: hero và khu duyệt", () => {
    renderPage();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Bài tập số nâng cao toàn diện/,
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 2, name: "Bài tập số nâng cao" }),
    ).toBeTruthy();
  });

  it("chip lớp theo thứ tự order, không theo thứ tự chuỗi", () => {
    renderPage();
    const chips = screen
      .getAllByRole("button")
      .map((b) => b.textContent)
      .filter((t) => t === "Tất cả" || /^Lớp /.test(t ?? ""));
    expect(chips).toEqual(["Tất cả", "Lớp 2", "Lớp 10"]);
  });

  it("chọn môn ở sidebar thu hẹp lưới, bấm lại thì bỏ chọn", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    renderPage();

    expect(screen.getAllByText("Vào luyện tập →")).toHaveLength(3);

    const tiengViet = screen.getByRole("button", { name: /Tiếng Việt/ });
    await user.click(tiengViet);
    expect(screen.getAllByText("Vào luyện tập →")).toHaveLength(1);
    expect(tiengViet.getAttribute("aria-pressed")).toBe("true");

    await user.click(tiengViet);
    expect(screen.getAllByText("Vào luyện tập →")).toHaveLength(3);
  });

  it("đếm số bài luyện tập theo từng khối", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "Lớp 2" }));

    const heading = screen.getByRole("heading", { level: 3, name: "Lớp 2" });
    const block = heading.closest("div")?.parentElement as HTMLElement;
    expect(within(block).getByText("2 bài luyện tập")).toBeTruthy();
  });

  it("lọc không khớp thì hiện empty-state, không hiện thẻ lỗi", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    topicsState.data = [topic({ content_code: "A", level: "2" })];
    renderPage();

    await user.click(screen.getByRole("button", { name: "Lớp 10" }));
    expect(
      screen.getByText("Không tìm thấy bài luyện tập phù hợp"),
    ).toBeTruthy();
    expect(
      screen.queryByText("Không tải được danh sách bài luyện tập"),
    ).toBeNull();

    // "Xóa bộ lọc" reset cả lớp lẫn môn.
    await user.click(screen.getByRole("button", { name: "Xóa bộ lọc" }));
    expect(screen.getAllByText("Vào luyện tập →")).toHaveLength(1);
  });

  it("máy chủ lỗi thì báo lỗi chứ không đổ cho bộ lọc (GAP-121)", () => {
    topicsState.isError = true;
    topicsState.data = [];
    renderPage();
    expect(
      screen.getByText("Không tải được danh sách bài luyện tập"),
    ).toBeTruthy();
    expect(
      screen.queryByText("Không tìm thấy bài luyện tập phù hợp"),
    ).toBeNull();
  });

  it("CTA đăng ký ở hero và ở header đều bắn signup_from_landing", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /Đăng ký miễn phí/ }));
    await user.click(screen.getByRole("button", { name: "Đăng ký" }));

    const signups = trackLandingEvent.mock.calls.filter(
      (c) => c[0] === "signup_from_landing",
    );
    expect(signups).toHaveLength(2);
  });
});

describe("PracticeLandingPage — sidebar môn theo khối", () => {
  it("chọn khối thì sidebar chỉ còn môn có bài ở khối đó", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    renderPage();

    // "Tất cả": cả hai môn đều có bài.
    expect(screen.getByRole("button", { name: /Toán/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Tiếng Việt/ })).toBeTruthy();

    // Lớp 10 chỉ có Toán (xem dữ liệu mock ở beforeEach).
    await user.click(screen.getByRole("button", { name: "Lớp 10" }));
    expect(screen.getByRole("button", { name: /Toán/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Tiếng Việt/ })).toBeNull();
  });

  it("đổi sang khối không có môn đang chọn thì tự bỏ chọn môn", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /Tiếng Việt/ }));
    expect(screen.getAllByText("Vào luyện tập →")).toHaveLength(1);

    // Lớp 10 không có Tiếng Việt → bỏ chọn, hiện bài của Lớp 10 thay vì lưới trống.
    await user.click(screen.getByRole("button", { name: "Lớp 10" }));
    expect(
      screen.queryByText("Không tìm thấy bài luyện tập phù hợp"),
    ).toBeNull();
    expect(screen.getAllByText("Vào luyện tập →")).toHaveLength(1);
  });

  it("đổi sang khối VẪN có môn đang chọn thì giữ nguyên lựa chọn", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    renderPage();

    const toan = screen.getByRole("button", { name: /Toán/ });
    await user.click(toan);
    await user.click(screen.getByRole("button", { name: "Lớp 10" }));

    expect(
      screen.getByRole("button", { name: /Toán/ }).getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("tải chủ đề hỏng thì hiện đủ môn, không để sidebar trắng", () => {
    topicsState.isError = true;
    topicsState.data = [];
    renderPage();

    expect(screen.getByRole("button", { name: /Toán/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Tiếng Việt/ })).toBeTruthy();
  });
});

describe("PracticeLandingPage — không có dữ liệu chủ đề", () => {
  it("API trả rỗng (chưa seed / LCMS) thì vẫn hiện đủ môn, không làm trắng sidebar", () => {
    // Response THÀNH CÔNG mà RỖNG: trước đây lọt qua !isLoading && !isError nên
    // bộ lọc khả dụng xoá sạch sidebar.
    topicsState.data = [];
    topicsState.isLoading = false;
    topicsState.isError = false;
    renderPage();

    expect(screen.getByRole("button", { name: /Toán/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Tiếng Việt/ })).toBeTruthy();
    // Lưới trống là đúng — chỉ bộ lọc không được biến mất.
    expect(
      screen.getByText("Không tìm thấy bài luyện tập phù hợp"),
    ).toBeTruthy();
  });

  it("API trả rỗng thì đổi khối không xoá mất môn đang chọn", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    topicsState.data = [];
    renderPage();

    await user.click(screen.getByRole("button", { name: /Toán/ }));
    await user.click(screen.getByRole("button", { name: "Lớp 10" }));

    expect(
      screen.getByRole("button", { name: /Toán/ }).getAttribute("aria-pressed"),
    ).toBe("true");
  });
});
