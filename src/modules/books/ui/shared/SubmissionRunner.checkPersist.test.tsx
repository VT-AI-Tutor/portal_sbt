// @vitest-environment jsdom
/**
 * CHẤM NGAY (instant marking, Owner 31/7): runner KHÔNG còn nút "Kiểm tra"/"Lưu bài"
 * per-câu — player self-grade từng thao tác (gradeMode "self" mặc định). Test cũ pin
 * trạng thái "đã kiểm tra" persist; kỳ vọng MỚI:
 *  - chrome runner không render nút Kiểm tra/Lưu bài;
 *  - "Làm lại" CHỈ hiện khi câu đã có đáp án (Owner 31/7);
 *  - QuestionPlayer nhận gradeMode/submitted UNDEFINED (player tự chấm);
 *  - đáp án per-câu vẫn giữ khi điều hướng qua lại (kênh answers + hydrate).
 *
 * CHẤM KÍN (marking="sealed", bài GV giao — Owner 31/7 phương án B):
 *  - QuestionPlayer nhận gradeMode="parent", KHÔNG submitted/result → không
 *    verdict nào lộ ra khi đang làm;
 *  - vẫn không nút Kiểm tra per-câu (UX mới giữ);
 *  - Nộp bài vẫn chấm client-side và gửi kèm results (server cần verdict).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const exercise = {
  id: "ex1",
  title: "Bài",
  instructions: null,
  durationMinutes: null,
  questions: [
    { id: "q1", type: "essay", content: "Câu 1", options: [] },
    { id: "q2", type: "essay", content: "Câu 2", options: [] },
  ],
};

// SubmissionRunner đọc useAuth() để lấy tên học sinh cho hộp thoại chia sẻ
// (PR #189). Test render runner trần, không có AuthProvider — mock ở đây thay
// vì bọc provider, để test giữ nguyên phạm vi: điều hướng + lưu đáp án.
vi.mock("@/core/auth/AuthContext", () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock("@/modules/books/api/assessmentApi", () => ({
  getExercise: vi.fn(async () => exercise),
  getCurrentAttempt: vi.fn(async () => null),
  startAttempt: vi.fn(async () => ({
    attemptId: "a1",
    startedAt: "2026-01-01T00:00:00Z",
  })),
  saveAnswers: vi.fn(async () => {}),
  submitAttempt: vi.fn(),
  getSubmission: vi.fn(),
  // null = "không có dữ liệu xem lại" (LCMS/BE chưa lên) — màn kết quả vẫn ra phần điểm.
  getSubmissionReview: vi.fn().mockResolvedValue(null),
  uploadAttemptFile: vi.fn(),
  listHistory: vi.fn(async () => []),
}));

// Stub player: phơi answer/submitted/gradeMode + nút emit đáp án để khẳng định
// hợp đồng self-mode (không truyền submitted/gradeMode) và kênh answers.
vi.mock("@/core/exercise/QuestionPlayer", () => ({
  QuestionPlayer: ({
    index,
    answer,
    submitted,
    onAnswerChange,
    ...rest
  }: {
    index: number;
    answer?: unknown;
    submitted?: boolean;
    onAnswerChange?: (a: unknown) => void;
  } & Record<string, unknown>) => (
    <div data-testid="qp">
      Q{index} answer={String(answer ?? "∅")} submitted={String(submitted)}{" "}
      gradeMode={String((rest as { gradeMode?: string }).gradeMode)}
      <button
        type="button"
        onClick={() => onAnswerChange?.(`trả lời ${index}`)}
      >
        emit-answer
      </button>
      <button
        type="button"
        onClick={() =>
          onAnswerChange?.({ answers: { c1: "A" }, order: ["c1"] })
        }
      >
        emit-envelope
      </button>
    </div>
  ),
}));

afterEach(cleanup);

async function importRunner() {
  return (await import("./SubmissionRunner")).SubmissionRunner;
}

describe("SubmissionRunner — chấm ngay, không còn nút Kiểm tra per-câu", () => {
  it("không có nút Kiểm tra/Lưu bài; player self-mode; đáp án giữ khi điều hướng", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    const SubmissionRunner = await importRunner();

    render(
      <MemoryRouter>
        <SubmissionRunner exerciseId="ex1" lessonTitle="Bài học" />
      </MemoryRouter>,
    );

    // Không còn nút Kiểm tra/Lưu bài; "Làm lại" ẨN khi chưa có đáp án
    // (Owner 31/7) — anchor màn playing bằng nút điều hướng.
    await screen.findByRole("button", { name: /Câu tiếp|Nộp bài/ });
    expect(screen.queryByRole("button", { name: /Làm lại/ })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /^(Kiểm tra|Lưu bài)$/ }),
    ).toBeNull();

    // Player chạy self-mode: KHÔNG truyền gradeMode="parent", KHÔNG truyền submitted.
    expect(screen.getByTestId("qp").textContent).toContain(
      "gradeMode=undefined",
    );
    expect(screen.getByTestId("qp").textContent).toContain(
      "submitted=undefined",
    );

    // Trả lời câu 1 → sang câu 2 → quay lại: đáp án câu 1 vẫn còn (kênh answers).
    await user.click(screen.getByRole("button", { name: /emit-answer/ }));
    await user.click(screen.getByRole("button", { name: /Câu tiếp/ }));
    await waitFor(() =>
      expect(screen.getByTestId("qp").textContent).toContain("Q1 answer=∅"),
    );
    await user.click(screen.getByRole("button", { name: /Câu trước/ }));
    await waitFor(() =>
      expect(screen.getByTestId("qp").textContent).toContain(
        "Q0 answer=trả lời 0",
      ),
    );
  });

  it("câu wrapper: autosave gửi Record phẳng {childId: answer}, không gửi envelope {answers, order}", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    const api = await import("@/modules/books/api/assessmentApi");
    (api.saveAnswers as ReturnType<typeof vi.fn>).mockClear();
    (api.getExercise as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ...exercise,
      questions: [
        {
          id: "g1",
          type: "question_group",
          content: "Nhóm",
          options: [],
          payload: {
            questions: [{ id: "c1", type: "single_choice", correctAnswer: "A" }],
          },
        },
        { id: "q2", type: "essay", content: "Câu 2", options: [] },
      ],
    });
    const SubmissionRunner = await importRunner();

    render(
      <MemoryRouter>
        <SubmissionRunner exerciseId="ex1" lessonTitle="Bài học" />
      </MemoryRouter>,
    );

    await user.click(
      await screen.findByRole("button", { name: /emit-envelope/ }),
    );
    await user.click(screen.getByRole("button", { name: /Câu tiếp/ }));

    await waitFor(() =>
      expect(api.saveAnswers).toHaveBeenCalledWith(
        "a1",
        [{ questionId: "g1", answer: { c1: "A" } }],
        expect.arrayContaining([
          expect.objectContaining({ questionId: "g1", isCorrect: true }),
        ]),
      ),
    );
  });

  it("'Làm lại' đẩy việc xoá đáp án xuống server (answer=null) để hub đếm đúng", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    const api = await import("@/modules/books/api/assessmentApi");
    (api.saveAnswers as ReturnType<typeof vi.fn>).mockClear();
    const SubmissionRunner = await importRunner();

    render(
      <MemoryRouter>
        <SubmissionRunner exerciseId="ex1" lessonTitle="Bài học" />
      </MemoryRouter>,
    );

    // Trả lời câu 1 → "Làm lại" hiện → bấm để xoá đáp án.
    await user.click(await screen.findByRole("button", { name: /emit-answer/ }));
    await user.click(screen.getByRole("button", { name: /Làm lại/ }));

    // Việc xoá phải được GỬI lên server dưới dạng answer rỗng, không chỉ xoá local.
    await waitFor(() =>
      expect(api.saveAnswers).toHaveBeenCalledWith(
        "a1",
        [{ questionId: "q1", answer: null }],
        expect.arrayContaining([
          expect.objectContaining({ questionId: "q1" }),
        ]),
      ),
    );
    // UI cũng xoá đáp án hiển thị.
    await waitFor(() =>
      expect(screen.getByTestId("qp").textContent).toContain("Q0 answer=∅"),
    );
  });

  it("Tiếp tục bài dở → nhảy tới câu chưa làm, câu đã trả lời hydrate lại đáp án", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    const api = await import("@/modules/books/api/assessmentApi");
    // Server trả về current-attempt có sẵn đáp án câu 1 (chỉ {questionId, answer}).
    (api.getCurrentAttempt as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      attemptId: "a1",
      startedAt: "2026-01-01T00:00:00Z",
      answers: [{ questionId: "q1", answer: "đáp án cũ" }],
    });
    const SubmissionRunner = await importRunner();

    render(
      <MemoryRouter>
        {/* Màn intro đã chuyển lên hub của BookLessonPage — hub quyết định
            tiếp-tục-hay-làm-mới rồi truyền xuống qua startMode. */}
        <SubmissionRunner
          exerciseId="ex1"
          lessonTitle="Bài học"
          startMode="resume"
        />
      </MemoryRouter>,
    );

    // Resume nhảy tới câu chưa làm (câu 2).
    await waitFor(() =>
      expect(screen.getByTestId("qp").textContent).toContain("Q1"),
    );
    // Về câu 1: đáp án cũ được hydrate qua prop `answer` (không còn cờ đã-kiểm-tra).
    await user.click(screen.getByRole("button", { name: /Câu trước/ }));
    await waitFor(() =>
      expect(screen.getByTestId("qp").textContent).toContain(
        "Q0 answer=đáp án cũ",
      ),
    );
    expect(
      screen.queryByRole("button", { name: /^(Kiểm tra|Lưu bài)$/ }),
    ).toBeNull();
  });
});

describe("SubmissionRunner — báo số câu còn đáp án lên hub (SBT_1308 đỏ #41)", () => {
  it("trả lời rồi 'Làm lại' → báo 1 rồi về 0 (câu đã xoá không tính là đã làm)", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    const onAnsweredCountChange = vi.fn();
    const SubmissionRunner = await importRunner();

    render(
      <MemoryRouter>
        <SubmissionRunner
          exerciseId="ex1"
          lessonTitle="Bài học"
          onAnsweredCountChange={onAnsweredCountChange}
        />
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("button", { name: /emit-answer/ }));
    await waitFor(() =>
      expect(onAnsweredCountChange).toHaveBeenLastCalledWith(1),
    );

    // Hub tin số này thay vì attempt của server — LCMS bỏ qua lệnh xoá nên
    // attempt trả về vẫn còn câu vừa "Làm lại" (hub từng báo dư).
    await user.click(screen.getByRole("button", { name: /Làm lại/ }));
    await waitFor(() =>
      expect(onAnsweredCountChange).toHaveBeenLastCalledWith(0),
    );
  });
});

describe('SubmissionRunner — marking="sealed" (bài GV giao chấm kín)', () => {
  it("player nhận gradeMode=parent, không submitted, không banner instant, không nút Kiểm tra", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    const SubmissionRunner = await importRunner();

    render(
      <MemoryRouter>
        <SubmissionRunner
          exerciseId="ex1"
          lessonTitle="Bài giao"
          marking="sealed"
        />
      </MemoryRouter>,
    );

    await screen.findByRole("button", { name: /Câu tiếp|Nộp bài/ });

    // Câu mô tả chấm kín/chấm ngay từng nằm ở màn intro của runner; intro đã
    // chuyển lên hub nên ở đây chỉ còn chốt: đang làm bài KHÔNG lộ "chấm ngay".
    expect(screen.queryByText(/chấm ngay khi em làm/)).toBeNull();

    // Player chạy parent-mode CÂM: gradeMode="parent" nhưng KHÔNG submitted/result
    // → không verdict nào hiển thị khi đang làm.
    expect(screen.getByTestId("qp").textContent).toContain("gradeMode=parent");
    expect(screen.getByTestId("qp").textContent).toContain(
      "submitted=undefined",
    );

    // UX mới giữ: không nút Kiểm tra/Lưu bài; "Làm lại" chỉ hiện khi có đáp án.
    expect(
      screen.queryByRole("button", { name: /^(Kiểm tra|Lưu bài)$/ }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: /Làm lại/ })).toBeNull();
    await user.click(screen.getByRole("button", { name: /emit-answer/ }));
    expect(screen.getByRole("button", { name: /Làm lại/ })).toBeTruthy();
  });

  it("Nộp bài vẫn chấm ngầm client-side và gửi kèm results", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    const api = await import("@/modules/books/api/assessmentApi");
    // 1 câu single_choice chấm được — stub player emit "trả lời 0" = đáp án đúng.
    (api.getExercise as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ...exercise,
      questions: [
        {
          id: "q1",
          type: "single_choice",
          content: "Câu 1",
          options: [],
          correctAnswer: "trả lời 0",
          points: 2,
        },
      ],
    });
    (api.submitAttempt as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      submissionId: "s1",
      gradingStatus: "graded",
    });
    (api.getSubmission as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      submissionId: "s1",
      gradingStatus: "graded",
      score: 2,
      maxScore: 2,
      submittedAt: "2026-01-01T00:00:00Z",
      gradedAt: null,
      teacherComment: null,
    });
    const SubmissionRunner = await importRunner();

    render(
      <MemoryRouter>
        <SubmissionRunner
          exerciseId="ex1"
          lessonTitle="Bài giao"
          marking="sealed"
        />
      </MemoryRouter>,
    );

    await user.click(
      await screen.findByRole("button", { name: /emit-answer/ }),
    );
    await user.click(screen.getByRole("button", { name: /Nộp bài/ }));
    // Nộp xong runner ở lại soát bài (chấm tại chỗ) — bấm "Hoàn thành" mới ra màn điểm.
    await user.click(await screen.findByRole("button", { name: /Hoàn thành/ }));

    // Submit gửi kèm results chấm ngầm (gradeByType) — verdict server cần.
    await waitFor(() =>
      expect(
        (api.submitAttempt as ReturnType<typeof vi.fn>).mock.calls.length,
      ).toBe(1),
    );
    const [, payload] = (api.submitAttempt as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(payload.results).toEqual([
      { questionId: "q1", isCorrect: true, points: 2, gradable: true },
    ]);
    expect(payload.answers).toEqual([
      { questionId: "q1", answer: "trả lời 0" },
    ]);

    // Điểm chỉ hiện SAU khi nộp — màn kết quả vẫn đầy đủ.
    await screen.findByText(/Đã nộp bài!/);
  });
});
