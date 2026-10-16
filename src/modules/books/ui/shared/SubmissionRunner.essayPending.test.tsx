// @vitest-environment jsdom
/**
 * SBT line 34a — lượt vừa nộp có câu GV chấm tay thì phải "chờ chấm" dù server trả
 * "graded"; chế độ review thì tin server để lần đã chấm hiện điểm thật.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const exerciseWith = (type: string, payload?: Record<string, unknown>) => ({
  id: "ex1",
  title: "Bài",
  instructions: null,
  durationMinutes: null,
  questions: [
    {
      id: "q1",
      type,
      content: "Câu 1",
      options: [],
      ...(payload ? { payload } : {}),
    },
  ],
});

// Đổi giữa các ca để phủ nhiều loại câu chờ GV chấm.
let currentExercise = exerciseWith("essay");

vi.mock("@/core/auth/AuthContext", () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock("@/modules/books/api/assessmentApi", () => ({
  getExercise: vi.fn(async () => currentExercise),
  getCurrentAttempt: vi.fn(async () => null),
  startAttempt: vi.fn(async () => ({
    attemptId: "a1",
    startedAt: "2026-01-01T00:00:00Z",
  })),
  saveAnswers: vi.fn(async () => {}),
  // Server auto-chấm trắc nghiệm → trả "graded" NGAY dù câu tự luận chưa chấm tay.
  submitAttempt: vi.fn(async () => ({
    submissionId: "s1",
    gradingStatus: "graded",
  })),
  getSubmission: vi.fn(async () => ({
    submissionId: "s1",
    gradingStatus: "graded",
    score: 8,
    maxScore: 10,
    submittedAt: "2026-01-01T00:00:00Z",
    gradedAt: null,
    teacherComment: null,
  })),
  getSubmissionReview: vi.fn().mockResolvedValue(null),
  getSubmittedAttempt: vi.fn(async () => null),
  uploadAttemptFile: vi.fn(),
  listHistory: vi.fn(async () => []),
}));

vi.mock("@/core/exercise/QuestionPlayer", () => ({
  QuestionPlayer: () => <div data-testid="qp" />,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  currentExercise = exerciseWith("essay");
});

describe("SubmissionRunner — trạng thái câu GV phải chấm tay (SBT line 34a)", () => {
  it("lượt vừa nộp: câu tự luận + server graded → 'Chờ giáo viên chấm', KHÔNG hiện điểm", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    const { SubmissionRunner } = await import("./SubmissionRunner");

    render(
      <MemoryRouter>
        <SubmissionRunner exerciseId="ex1" lessonTitle="Bài học" />
      </MemoryRouter>,
    );

    // Vào màn làm bài rồi nộp (câu tự luận để trống → hộp thoại xác nhận).
    await user.click(await screen.findByRole("button", { name: /Nộp bài/ }));
    await user.click(
      await screen.findByRole("button", { name: /Vẫn nộp bài/ }),
    );
    // Nộp xong runner ở lại soát bài (chấm tại chỗ) — bấm "Hoàn thành" mới ra màn điểm.
    await user.click(await screen.findByRole("button", { name: /Hoàn thành/ }));

    await screen.findByText(/Đã nộp bài!/);
    // Chờ chấm, KHÔNG khoe điểm auto (8/10) khi còn câu tự luận.
    expect(screen.getByText(/Chờ giáo viên chấm/)).toBeTruthy();
    expect(screen.queryByText("8")).toBeNull();
  });

  it("chế độ review: câu tự luận đã được GV chấm (graded) → hiện ĐIỂM thật, không kẹt chờ chấm", async () => {
    const { SubmissionRunner } = await import("./SubmissionRunner");

    render(
      <MemoryRouter>
        <SubmissionRunner
          exerciseId="ex1"
          lessonTitle="Bài học"
          startMode="review"
          reviewSubmissionId="s1"
        />
      </MemoryRouter>,
    );

    await screen.findByText(/Đã nộp bài!/);
    // Xem lại lần nộp đã chấm xong → điểm thật hiện, không bị ép "chờ chấm".
    expect(screen.getByText("8")).toBeTruthy();
    expect(screen.queryByText(/Chờ giáo viên chấm/)).toBeNull();
  });

  // Luật là "có câu nào máy không chấm được", không phải riêng chữ "essay":
  // SUBJECTIVE_QUESTION_TYPES còn drawing/upload_answer/speaking… (grading.ts).
  it("lượt vừa nộp: câu VẼ (drawing) cũng phải là 'Chờ giáo viên chấm'", async () => {
    currentExercise = exerciseWith("drawing");
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    const { SubmissionRunner } = await import("./SubmissionRunner");

    render(
      <MemoryRouter>
        <SubmissionRunner exerciseId="ex1" lessonTitle="Bài học" />
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("button", { name: /Nộp bài/ }));
    await user.click(
      await screen.findByRole("button", { name: /Vẫn nộp bài/ }),
    );
    await user.click(await screen.findByRole("button", { name: /Hoàn thành/ }));

    await screen.findByText(/Đã nộp bài!/);
    expect(screen.getByText(/Chờ giáo viên chấm/)).toBeTruthy();
    expect(screen.queryByText("8")).toBeNull();
  });

  // `subQuestions` là dạng gần như mọi dữ liệu sách thật dùng.
  it("câu tự luận LỒNG trong question_group cũng phải là 'Chờ giáo viên chấm'", async () => {
    currentExercise = exerciseWith("question_group", {
      type: "question_group",
      subQuestions: [
        { id: "s1", type: "single_choice", correctAnswer: "a" },
        { id: "s2", type: "essay" },
      ],
    });
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    const { SubmissionRunner } = await import("./SubmissionRunner");

    render(
      <MemoryRouter>
        <SubmissionRunner exerciseId="ex1" lessonTitle="Bài học" />
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("button", { name: /Nộp bài/ }));
    await user.click(
      await screen.findByRole("button", { name: /Vẫn nộp bài/ }),
    );
    await user.click(await screen.findByRole("button", { name: /Hoàn thành/ }));

    await screen.findByText(/Đã nộp bài!/);
    expect(screen.getByText(/Chờ giáo viên chấm/)).toBeTruthy();
    expect(screen.queryByText("8")).toBeNull();
  });

  // Ca ĐỐI CHỨNG: thiếu nó thì lỗi "ép chờ chấm cho MỌI bài" vẫn xanh cả suite.
  it("lượt vừa nộp: bài CHỈ có trắc nghiệm → hiện ĐIỂM, không bị ép chờ chấm", async () => {
    currentExercise = exerciseWith("single_choice");
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    const { SubmissionRunner } = await import("./SubmissionRunner");

    render(
      <MemoryRouter>
        <SubmissionRunner exerciseId="ex1" lessonTitle="Bài học" />
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("button", { name: /Nộp bài/ }));
    await user.click(
      await screen.findByRole("button", { name: /Vẫn nộp bài/ }),
    );
    await user.click(await screen.findByRole("button", { name: /Hoàn thành/ }));

    await screen.findByText(/Đã nộp bài!/);
    expect(screen.getByText("8")).toBeTruthy();
    expect(screen.queryByText(/Chờ giáo viên chấm/)).toBeNull();
  });

  // `media_anchored` treo câu con ở `anchors[].question` — không qua resolver chung.
  it("câu tự luận trong anchor của media_anchored cũng phải là 'Chờ giáo viên chấm'", async () => {
    currentExercise = exerciseWith("media_anchored", {
      type: "media_anchored",
      anchors: [
        {
          id: "a1",
          question: { id: "n1", type: "single_choice", correctAnswer: "a" },
        },
        { id: "a2", question: { id: "n2", type: "essay" } },
      ],
    });
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    const { SubmissionRunner } = await import("./SubmissionRunner");

    render(
      <MemoryRouter>
        <SubmissionRunner exerciseId="ex1" lessonTitle="Bài học" />
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("button", { name: /Nộp bài/ }));
    await user.click(
      await screen.findByRole("button", { name: /Vẫn nộp bài/ }),
    );
    await user.click(await screen.findByRole("button", { name: /Hoàn thành/ }));

    await screen.findByText(/Đã nộp bài!/);
    expect(screen.getByText(/Chờ giáo viên chấm/)).toBeTruthy();
    expect(screen.queryByText("8")).toBeNull();
  });
});
