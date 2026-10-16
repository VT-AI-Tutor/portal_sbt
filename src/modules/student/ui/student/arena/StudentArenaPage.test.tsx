// @vitest-environment jsdom
/**
 * StudentArenaPage (Task 12) — mock arenaHooks + useAuth, không gọi API thật.
 * 4 case theo brief task-12: đủ 4 thẻ hành trình; nút "Vào thi" khi còn lượt;
 * disabled "Hết lượt thi" khi hết lượt; hướng dẫn cập nhật hồ sơ khi 422 profile.
 * Task 12 fixes: difficulty ratio không tính unknown; start error toast.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type {
  ArenaOverview,
  ArenaRoundCard,
  ArenaAttempt,
} from "@/modules/student/api/arenaApi";
import { ArenaApiError } from "@/modules/student/api/arenaApi";

const navigateMock = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router-dom")>();
  return { ...mod, useNavigate: () => navigateMock };
});

const toastErrorMock = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: toastErrorMock },
}));

vi.mock("@/core/auth/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "hs@example.com", level: "4" },
  }),
}));

const useArenaOverviewMock = vi.fn();
const useArenaRoundMock = vi.fn();
const useArenaLeaderboardMock = vi.fn();
const startAttemptMutateMock = vi.fn();
const useStartArenaAttemptMock = vi.fn();

vi.mock("@/modules/student/api/arenaHooks", () => ({
  useArenaOverview: () => useArenaOverviewMock(),
  useArenaRound: (id: string | undefined) => useArenaRoundMock(id),
  useArenaLeaderboard: (id: string | undefined) => useArenaLeaderboardMock(id),
  useStartArenaAttempt: () => useStartArenaAttemptMock(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function weekRound(overrides: Partial<ArenaRoundCard> = {}): ArenaRoundCard {
  return {
    id: "round-week-1",
    tier: "week",
    period_key: "Tuần 30/2026",
    starts_at: "2026-07-20T00:00:00Z",
    ends_at: "2026-07-26T23:59:59Z",
    status: "open",
    question_count: 20,
    duration_minutes: 30,
    max_attempts: 3,
    attempts_used: 1,
    my_best: null,
    locked: false,
    lock_reason: null,
    current_attempt_id: null,
    ...overrides,
  };
}

function makeOverview(
  overrides: Partial<ArenaOverview["rounds"]> = {},
): ArenaOverview {
  return {
    grade: "4",
    rounds: {
      week: weekRound(),
      month: {
        ...weekRound({ id: "round-month-1", tier: "month" }),
        locked: true,
        lock_reason: "Mở khoá khi vào Top 10 Vòng Tuần",
        status: "published",
      },
      quarter: null,
      year: null,
      ...overrides,
    },
  };
}

function mockDefaults(overview: ArenaOverview, roundDetail?: unknown) {
  useArenaOverviewMock.mockReturnValue({
    data: overview,
    isLoading: false,
    isError: false,
    error: null,
  });
  useArenaRoundMock.mockReturnValue({
    data: roundDetail,
    isLoading: false,
    isError: false,
  });
  useArenaLeaderboardMock.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
  });
  useStartArenaAttemptMock.mockReturnValue({
    mutate: startAttemptMutateMock,
    isPending: false,
  });
}

async function renderPage() {
  const { StudentArenaPage } = await import("./StudentArenaPage");
  return render(
    <MemoryRouter>
      <StudentArenaPage />
    </MemoryRouter>,
  );
}

describe("StudentArenaPage", () => {
  it("hiện đủ 4 thẻ hành trình Tuần/Tháng/Quý/Năm", async () => {
    mockDefaults(makeOverview());
    await renderPage();

    expect(screen.getByText("Vòng Tuần")).toBeTruthy();
    expect(screen.getByText("Vòng Tháng")).toBeTruthy();
    expect(screen.getByText("Vòng Quý")).toBeTruthy();
    expect(screen.getByText("Vòng Năm")).toBeTruthy();
  });

  it("hiện nút Vào thi khi vòng tuần đang mở và còn lượt", async () => {
    mockDefaults(
      makeOverview({ week: weekRound({ attempts_used: 1, max_attempts: 3 }) }),
    );
    await renderPage();

    const btn = screen.getByRole("button", {
      name: /Vào thi Vòng Tuần/i,
    }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("disabled + 'Hết lượt thi' khi đã dùng hết lượt", async () => {
    mockDefaults(
      makeOverview({ week: weekRound({ attempts_used: 3, max_attempts: 3 }) }),
    );
    await renderPage();

    const btn = screen.getByRole("button", {
      name: /Hết lượt thi/i,
    }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("hướng dẫn cập nhật hồ sơ khi overview lỗi 422 ARENA_PROFILE_INCOMPLETE", async () => {
    useArenaOverviewMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new ArenaApiError(
        422,
        "ARENA_PROFILE_INCOMPLETE",
        "Missing level",
      ),
    });
    useArenaRoundMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    });
    useArenaLeaderboardMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    });
    useStartArenaAttemptMock.mockReturnValue({
      mutate: startAttemptMutateMock,
      isPending: false,
    });

    await renderPage();

    expect(screen.getByText(/cập nhật khối lớp trong hồ sơ/i)).toBeTruthy();
  });

  it("hiển thị tỉ lệ độ khó 25% mỗi loại khi unknown > 0 (không tính vào mẫu số)", async () => {
    const overview = makeOverview();
    const roundDetail = {
      round: {
        id: "round-week-1",
        difficulty_ratio: {
          biet: 1,
          hieu: 1,
          vandung: 1,
          vandungcao: 1,
          unknown: 4,
        },
      },
      attempts: [],
    };

    mockDefaults(overview, roundDetail);
    await renderPage();

    // Mẫu số = 1+1+1+1 = 4 (không tính unknown=4)
    // Mỗi loại: 1/4 = 25%
    expect(screen.getByText(/Nhận biết 25%/)).toBeTruthy();
    expect(screen.getByText(/Thông hiểu 25%/)).toBeTruthy();
    expect(screen.getByText(/Vận dụng 25%/)).toBeTruthy();
    expect(screen.getByText(/Vận dụng cao 25%/)).toBeTruthy();
  });

  it("toast lỗi khi startAttempt mutate gọi onError", async () => {
    const overview = makeOverview();
    mockDefaults(overview);

    const user = userEvent.setup();
    await renderPage();

    // Setup mock để gọi onError callback
    startAttemptMutateMock.mockImplementation(
      (_id: string, { onError }: { onError: (e: unknown) => void }) => {
        onError(new Error("Server error: 500"));
      },
    );

    const startBtn = screen.getByRole("button", {
      name: /Vào thi Vòng Tuần/i,
    });
    await user.click(startBtn);

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Server error: 500");
    });
  });

  it("toast mặc định khi startAttempt onError nhận non-Error object", async () => {
    const overview = makeOverview();
    mockDefaults(overview);

    const user = userEvent.setup();
    await renderPage();

    // Setup mock để gọi onError với object không phải Error
    startAttemptMutateMock.mockImplementation(
      (_id: string, { onError }: { onError: (e: unknown) => void }) => {
        onError({ statusCode: 500 });
      },
    );

    const startBtn = screen.getByRole("button", {
      name: /Vào thi Vòng Tuần/i,
    });
    await user.click(startBtn);

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        "Không vào được vòng thi, em thử lại nhé.",
      );
    });
  });
});
