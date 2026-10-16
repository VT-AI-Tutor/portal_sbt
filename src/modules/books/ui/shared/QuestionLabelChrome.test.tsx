// @vitest-environment jsdom
/**
 * Nhãn của câu đang mở phải hiện ở CẢ HAI runner — khách
 * (StandaloneExerciseRunner) và học sinh đã đăng nhập (SubmissionRunner):
 * tiêu đề phần, bộ đếm theo mạch ở thanh đầu và nút nghe ghi âm. Số bài tập
 * chỉ nằm ở thanh đầu, KHÔNG in lại trước câu lệnh.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { MemoryRouter } from "react-router-dom";
import type { QuestionLabel } from "./lessonSections";

// `title` ở đây là tên BÀI mà LCMS trả cho exercise — đúng thứ KHÔNG được
// hiện lên làm tiêu đề phần.
const exercise = {
  id: "ex1",
  title: "Tôi là học sinh lớp",
  instructions: null,
  durationMinutes: null,
  questions: [{ id: "q1", type: "essay", content: "Câu 1", options: [] }],
};

const readingLabel = (ordinal: number, lineTotal: number): QuestionLabel => ({
  line: "ĐỌC",
  sectionLabel: "BÀI ĐỌC",
  ordinal,
  lineTotal,
});

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

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
  getSubmissionReview: vi.fn().mockResolvedValue(null),
  uploadAttemptFile: vi.fn(),
  listHistory: vi.fn(async () => []),
}));

vi.mock("@/core/exercise/QuestionPlayer", () => ({
  QuestionPlayer: ({ index }: { index: number }) => <div>Q{index}</div>,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("nhãn câu hỏi", () => {
  it("khách chưa đăng nhập thấy tiêu đề phần và bộ đếm theo mạch", async () => {
    const { StandaloneExerciseRunner } =
      await import("./StandaloneExerciseRunner");
    render(
      <StandaloneExerciseRunner
        lessonTitle="Bài 1"
        questions={[{ id: "q1", question_type: "essay", payload: {} }]}
        questionLabelById={{ q1: readingLabel(2, 3) }}
      />,
    );

    expect(screen.getByTestId("question-section-title").textContent).toBe(
      "BÀI ĐỌC",
    );
    // Số bài tập đã có ở thanh đầu và dải nhảy nhanh, nên không in lại trước
    // câu lệnh.
    expect(screen.queryByTestId("question-ordinal")).toBeNull();
    expect(document.body.textContent).toContain("ĐỌC · Bài 2/3");
  });

  it("học sinh đã đăng nhập cũng thấy nhãn phần, không lộ tên bài", async () => {
    const { SubmissionRunner } = await import("./SubmissionRunner");
    render(
      <MemoryRouter>
        <SubmissionRunner
          exerciseId="ex1"
          lessonTitle="Bài 1"
          questionLabelById={{
            q1: {
              line: "ĐỌC",
              sectionLabel: "BÀI ĐỌC",
              ordinal: 4,
              lineTotal: 5,
            },
          }}
        />
      </MemoryRouter>,
    );

    expect(await screen.findByText("BÀI ĐỌC")).toBeTruthy();
    expect(screen.queryByTestId("question-ordinal")).toBeNull();
    expect(document.body.textContent).toContain("ĐỌC · Bài 4/5");
    expect(screen.queryByText("Tôi là học sinh lớp")).toBeNull();
  });

  it("dải nhảy nhanh đánh số lại từ 1 khi sang mạch khác", async () => {
    const { StandaloneExerciseRunner } =
      await import("./StandaloneExerciseRunner");
    render(
      <StandaloneExerciseRunner
        lessonTitle="Bài 1"
        questions={[
          { id: "q1", question_type: "essay", payload: {} },
          { id: "q2", question_type: "essay", payload: {} },
          { id: "q3", question_type: "essay", payload: {} },
        ]}
        questionLabelById={{
          q1: readingLabel(1, 2),
          q2: readingLabel(2, 2),
          q3: { line: "VIẾT", sectionLabel: "", ordinal: 1, lineTotal: 1 },
        }}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Tới bài 2 của ĐỌC" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Tới bài 1 của VIẾT" }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Tới câu 3" })).toBeNull();
  });

  it("mạch khác ĐỌC: khu vực trên đầu câu để trống, kể cả khi có tên phần", async () => {
    const { StandaloneExerciseRunner } =
      await import("./StandaloneExerciseRunner");
    render(
      <StandaloneExerciseRunner
        lessonTitle="Bài 1"
        questions={[{ id: "q1", question_type: "essay", payload: {} }]}
        questionLabelById={{
          q1: {
            line: "VẬN DỤNG",
            sectionLabel: "",
            ordinal: 1,
            lineTotal: 1,
          },
        }}
      />,
    );

    // Tên mạch chỉ được xuất hiện ở bộ đếm đầu màn, không ở khối trên câu hỏi.
    expect(document.body.textContent).toContain("VẬN DỤNG · Bài 1/1");
    expect(screen.queryByTestId("question-section-title")).toBeNull();
    expect(screen.queryByRole("button", { name: "Nghe bài đọc" })).toBeNull();
  });

  it("nút nghe bài đọc chỉ hiện ở mạch ĐỌC", async () => {
    const { StandaloneExerciseRunner } =
      await import("./StandaloneExerciseRunner");
    const questions = [{ id: "q1", question_type: "essay", payload: {} }];

    const { unmount } = render(
      <StandaloneExerciseRunner
        lessonTitle="Bài 1"
        questions={questions}
        questionLabelById={{ q1: readingLabel(1, 1) }}
        readingAudioUrl="https://media/bai-doc.mp3"
      />,
    );
    expect(screen.getByRole("button", { name: "Nghe bài đọc" })).toBeTruthy();
    unmount();

    render(
      <StandaloneExerciseRunner
        lessonTitle="Bài 1"
        questions={questions}
        questionLabelById={{
          q1: { line: "VIẾT", sectionLabel: "", ordinal: 1, lineTotal: 1 },
        }}
        readingAudioUrl="https://media/bai-doc.mp3"
      />,
    );
    expect(screen.queryByRole("button", { name: "Nghe bài đọc" })).toBeNull();
  });

  it("bài đọc chưa có ghi âm: nút vẫn hiện, bấm thì báo thiếu file", async () => {
    const user = userEvent.setup();
    const { StandaloneExerciseRunner } =
      await import("./StandaloneExerciseRunner");
    render(
      <StandaloneExerciseRunner
        lessonTitle="Bài 1"
        questions={[{ id: "q1", question_type: "essay", payload: {} }]}
        questionLabelById={{ q1: readingLabel(1, 1) }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Nghe bài đọc" }));

    expect(toast.error).toHaveBeenCalledWith(
      "Bài đọc này chưa có file ghi âm.",
    );
  });

  it("nút nhả dấu tạm dừng khi file bị dừng từ chỗ khác", async () => {
    const { StandaloneExerciseRunner } =
      await import("./StandaloneExerciseRunner");
    render(
      <StandaloneExerciseRunner
        lessonTitle="Bài 1"
        questions={[{ id: "q1", question_type: "essay", payload: {} }]}
        questionLabelById={{ q1: readingLabel(1, 1) }}
        readingAudioUrl="https://media/bai-doc.mp3"
      />,
    );
    const button = screen.getByRole("button", { name: "Nghe bài đọc" });
    const audio = document.querySelector("audio")!;

    fireEvent.play(audio);
    expect(button.getAttribute("aria-pressed")).toBe("true");

    // Thoát bài tập dừng file qua pauseMediaIn, không qua nút — trạng thái nút
    // vẫn phải theo kịp, nếu không nó kẹt ở dấu tạm dừng.
    fireEvent.pause(audio);
    expect(button.getAttribute("aria-pressed")).toBe("false");
  });

  it("thiếu nhãn một câu thì bộ đếm và dải nhảy nhanh lùi về đánh số cả bài", async () => {
    const { StandaloneExerciseRunner } =
      await import("./StandaloneExerciseRunner");
    render(
      <StandaloneExerciseRunner
        lessonTitle="Bài 1"
        questions={[
          { id: "q1", question_type: "essay", payload: {} },
          // Câu của một lesson_item không tên — toLessonSections lọc bỏ phần đó
          // nên câu này không có nhãn.
          { id: "q2", question_type: "essay", payload: {} },
        ]}
        questionLabelById={{ q1: readingLabel(1, 1) }}
      />,
    );

    expect(document.body.textContent).toContain("Câu 1 / 2");
    expect(document.body.textContent).not.toContain("ĐỌC · Bài");
    expect(screen.getByRole("button", { name: "Tới câu 2" })).toBeTruthy();
  });

  it("file ghi âm hỏng chỉ báo SAU khi học sinh bấm nghe", async () => {
    const { StandaloneExerciseRunner } =
      await import("./StandaloneExerciseRunner");
    render(
      <StandaloneExerciseRunner
        lessonTitle="Bài 1"
        questions={[{ id: "q1", question_type: "essay", payload: {} }]}
        questionLabelById={{ q1: readingLabel(1, 1) }}
        readingAudioUrl="https://media/hong.mp3"
      />,
    );

    // Trình duyệt tự dò file lúc mở câu cũng nổ `error` — chưa bấm thì im.
    fireEvent.error(document.querySelector("audio")!);
    expect(toast.error).not.toHaveBeenCalled();

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Nghe bài đọc" }));
    fireEvent.error(document.querySelector("audio")!);

    expect(toast.error).toHaveBeenCalledWith(
      "Bài đọc này chưa có file ghi âm.",
    );
  });

  it("sách không chia mạch: câu có ghi âm vẫn được nút nghe", async () => {
    const { StandaloneExerciseRunner } =
      await import("./StandaloneExerciseRunner");
    render(
      <StandaloneExerciseRunner
        lessonTitle="Bài 1"
        questions={[
          {
            id: "q1",
            question_type: "essay",
            payload: { audioUrl: "https://media/cau-1.mp3" },
          },
        ]}
      />,
    );

    expect(document.body.textContent).toContain("Câu 1 / 1");
    expect(
      screen.getByRole("button", { name: "Nghe ghi âm bài tập" }),
    ).toBeTruthy();
  });
});
