// @vitest-environment jsdom
/**
 * Regression 2 bug resume/autosave của luyện tập (repro live 2026-07-24):
 *
 * 1. Autosave đuôi sau submit: sau khi nộp bài thành công, cleanup unmount của
 *    PracticeRunner vẫn flush PUT /answers vào phiên đã completed → BE 409 →
 *    toast "Chưa đồng bộ được..." hiện oan. Sau fix: không còn PUT nào sau
 *    lượt flush-trước-submit (submit lỗi thì autosave phải hoạt động lại).
 *
 * 2. Resume cùng phiên SPA không khôi phục đáp án: cache react-query giữ bản
 *    phiên lúc TẠO (answers rỗng); StudentPracticeSessionPage mount runner
 *    ngay với bản stale trong khi refetch chạy nền → useState(() => ...) của
 *    runner init một lần với answers rỗng. Sau fix: chờ fetch tươi sau mount
 *    rồi mới mount runner.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PracticeSession } from "@/modules/student/api/practiceApi";

const session: PracticeSession = {
  id: "s1",
  mode: "practice",
  source: "topic",
  subject_code: "toan",
  level: "4",
  framework_key: "gdpt-2018",
  ref: null,
  time_limit_seconds: null,
  status: "in_progress",
  started_at: "2026-07-24T00:00:00Z",
  questions: [
    {
      id: "q1",
      order: 0,
      question_text: "1+1?",
      question_type: "single_choice",
      payload: {
        options: [
          { id: "A", content: "1" },
          { id: "B", content: "2" },
        ],
        correctAnswer: "B",
        score: 1,
      },
      level_code: "biet",
      outcome_code: "T4",
      content_code: "SO",
    },
  ],
  answers: [],
};

vi.mock("@/modules/student/api/practiceApi", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/modules/student/api/practiceApi")>();
  return {
    ...mod,
    savePracticeAnswers: vi.fn(async () => {}),
    getPracticeSession: vi.fn(),
    submitPracticeSession: vi.fn(async () => ({
      session_id: "s1",
      status: "completed",
      score: 1,
      max_score: 1,
      results: [],
      mastery_delta: [],
      rewards: null,
    })),
  };
});

// Stub player: phơi answer hiện tại + nút đổi đáp án — đủ cho cả 2 bài test.
vi.mock("@/core/exercise/QuestionPlayer", () => ({
  QuestionPlayer: ({
    answer,
    onAnswerChange,
  }: {
    answer?: unknown;
    onAnswerChange?: (a: unknown) => void;
  }) => (
    <div data-testid="qp" data-answer={String(answer ?? "")}>
      <button onClick={() => onAnswerChange?.("B")}>chọn B</button>
    </div>
  ),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function apiMocks() {
  return await import("@/modules/student/api/practiceApi");
}

describe("PracticeRunner — autosave đuôi sau submit", () => {
  it("nộp bài xong rồi unmount: không bắn thêm PUT answers nào sau lượt flush trước-submit", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    const { PracticeRunner } = await import("./PracticeRunner");
    const api = await apiMocks();
    const onSubmit = vi.fn();

    const { unmount } = render(
      <MemoryRouter>
        <PracticeRunner session={session} onSubmit={onSubmit} submitting={false} />
      </MemoryRouter>,
    );

    await user.click(screen.getByText("chọn B"));
    await user.click(screen.getByRole("button", { name: "Nộp bài" }));
    // Dialog xác nhận (radix AlertDialog) — nút action cùng nhãn "Nộp bài".
    const actions = await screen.findAllByRole("button", { name: "Nộp bài" });
    await user.click(actions[actions.length - 1]);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const callsAtSubmit = vi.mocked(api.savePracticeAnswers).mock.calls.length;
    expect(callsAtSubmit).toBe(1); // flush trước-submit

    unmount(); // page chuyển sang SessionResult → runner unmount
    expect(vi.mocked(api.savePracticeAnswers).mock.calls.length).toBe(callsAtSubmit);
  });

  it("submit LỖI thì autosave phải hoạt động lại (flush khi unmount vẫn bắn)", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    const { PracticeRunner } = await import("./PracticeRunner");
    const api = await apiMocks();
    const onSubmit = vi.fn();

    const { unmount, rerender } = render(
      <MemoryRouter>
        <PracticeRunner session={session} onSubmit={onSubmit} submitting={false} />
      </MemoryRouter>,
    );

    await user.click(screen.getByText("chọn B"));
    await user.click(screen.getByRole("button", { name: "Nộp bài" }));
    const actions = await screen.findAllByRole("button", { name: "Nộp bài" });
    await user.click(actions[actions.length - 1]);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    // Mutation submit thất bại → parent truyền submitError xuống.
    rerender(
      <MemoryRouter>
        <PracticeRunner
          session={session}
          onSubmit={onSubmit}
          submitting={false}
          submitError="Mạng lỗi"
        />
      </MemoryRouter>,
    );

    const before = vi.mocked(api.savePracticeAnswers).mock.calls.length;
    unmount();
    expect(vi.mocked(api.savePracticeAnswers).mock.calls.length).toBe(before + 1);
  });
});

describe("StudentPracticeSessionPage — resume phải chờ dữ liệu tươi", () => {
  it("cache stale (answers rỗng) + server có đáp án → runner chỉ mount sau refetch, player nhận đáp án đã lưu", async () => {
    const api = await apiMocks();
    const fresh: PracticeSession = {
      ...session,
      answers: [{ question_id: "q1", answer: "B" }],
    };
    // Refetch chậm một nhịp để chắc chắn giai đoạn "đang có cache stale" quan sát được.
    vi.mocked(api.getPracticeSession).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(fresh), 20)),
    );

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    // Mô phỏng cache từ lần mở phiên đầu (ngay sau khi tạo — chưa có answers).
    queryClient.setQueryData(["practice", "session", "s1"], session);

    const { StudentPracticeSessionPage } = await import("./StudentPracticeSessionPage");
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/student/practice/session/s1"]}>
          <Routes>
            <Route
              path="/student/practice/session/:sessionId"
              element={<StudentPracticeSessionPage />}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Trước khi refetch xong: KHÔNG được mount runner với bản stale answers rỗng.
    expect(screen.queryByTestId("qp")).toBeNull();

    // Sau refetch: runner mount với đáp án đã lưu.
    const qp = await screen.findByTestId("qp");
    expect(qp.getAttribute("data-answer")).toBe("B");
  });
});
