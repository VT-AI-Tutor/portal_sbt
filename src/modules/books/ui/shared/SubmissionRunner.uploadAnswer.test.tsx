// @vitest-environment jsdom
/**
 * Câu upload_answer dưới provider LCMS: SubmissionRunner phải BƠM onUploadFile
 * xuống player (chỉ khi IS_LCMS && attemptId) và, khi nộp, đưa file đã upload
 * vào answer.files của câu — đúng hợp đồng PUT answer / POST submit của LCMS.
 *
 * Đây là chốt hồi quy cho đúng chỗ người dùng vấp: nếu onUploadFile lại undefined
 * (vd gate sai, hoặc rơi xuống StandaloneExerciseRunner) thì chọn file không gọi
 * upload và nộp bài không mang file — ca này sẽ đỏ.
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
    {
      id: "q1",
      type: "upload_answer",
      content: "Nộp file",
      // Payload thật của LCMS (đúng shape demo): type + content blocks + cấu hình file.
      payload: {
        type: "upload_answer",
        content: { blocks: [{ type: "paragraph", content: [{ text: "Nộp file ảnh em vẽ lên" }] }] },
        allowedFileTypes: ["image/png", "image/jpeg"],
        maxFileSizeMB: 10,
        correctAnswer: null,
      },
    },
  ],
};

const uploadAttemptFile = vi.fn(async () => ({
  fileId: "F1",
  fileUrl: "http://media.test/f1.png",
}));
const submitAttempt = vi.fn(async () => ({
  submissionId: "s1",
  gradingStatus: "graded",
}));
const saveAnswers = vi.fn(async () => {});

vi.mock("@/core/auth/AuthContext", () => ({ useAuth: () => ({ user: null }) }));

// IS_LCMS = getApiProvider() === "lcms" (module-level trong SubmissionRunner).
vi.mock("@/core/api/config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/core/api/config")>()),
  getApiProvider: () => "lcms",
}));

vi.mock("@/modules/books/api/assessmentApi", () => ({
  getExercise: vi.fn(async () => exercise),
  getCurrentAttempt: vi.fn(async () => null),
  startAttempt: vi.fn(async () => ({ attemptId: "a1", startedAt: "2026-01-01T00:00:00Z" })),
  saveAnswers,
  submitAttempt,
  uploadAttemptFile,
  getSubmission: vi.fn(async () => ({
    submissionId: "s1",
    gradingStatus: "graded",
    score: 1,
    maxScore: 1,
    submittedAt: "2026-01-01T00:00:00Z",
    gradedAt: "2026-01-01T00:00:00Z",
    teacherComment: null,
  })),
  getSubmissionReview: vi.fn(async () => null),
  getSubmittedAttempt: vi.fn(async () => null),
  listHistory: vi.fn(async () => []),
}));

// Player giả mô phỏng UploadTask: nút "chọn file" gọi onUploadFile rồi emit
// answer {files:[…]} đúng như UploadTask thật làm sau khi upload xong.
vi.mock("@/core/exercise/QuestionPlayer", () => ({
  QuestionPlayer: (props: Record<string, unknown>) => {
    const onUploadFile = props.onUploadFile as
      | ((f: File) => Promise<{ fileId: string; fileUrl: string }>)
      | undefined;
    const onAnswerChange = props.onAnswerChange as (a: unknown) => void;
    return (
      <div data-testid="qp">
        onUploadFile={String(!!onUploadFile)}
        <button
          type="button"
          onClick={async () => {
            const res = await onUploadFile!(
              new File(["x"], "bai-lam.png", { type: "image/png" }),
            );
            onAnswerChange({
              files: [{ fileUrl: res.fileUrl, fileId: res.fileId, name: "bai-lam.png" }],
            });
          }}
        >
          chọn file
        </button>
      </div>
    );
  },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SubmissionRunner — upload_answer dưới LCMS", () => {
  it("bơm onUploadFile; chọn file gọi upload; nộp bài mang answer.files", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    const { SubmissionRunner } = await import("./SubmissionRunner");

    render(
      <MemoryRouter>
        <SubmissionRunner exerciseId="ex1" lessonTitle="Bài" marking="silent" />
      </MemoryRouter>,
    );

    // onUploadFile phải tới player (IS_LCMS && attemptId) — chính chỗ vấp của user.
    const qp = await screen.findByTestId("qp");
    expect(qp.textContent).toContain("onUploadFile=true");

    // Chọn file → gọi upload thật (mock) với đúng file.
    await user.click(screen.getByRole("button", { name: "chọn file" }));
    await waitFor(() => expect(uploadAttemptFile).toHaveBeenCalledTimes(1));
    expect((uploadAttemptFile.mock.calls[0] as unknown[])[0]).toBe("a1");

    // Nộp bài → payload answers mang file vào answer.files của câu.
    await user.click(await screen.findByRole("button", { name: /Nộp bài/ }));
    await waitFor(() => expect(submitAttempt).toHaveBeenCalledTimes(1));
    const [attemptId, payload] = submitAttempt.mock.calls[0] as unknown as [
      string,
      { answers?: Array<{ questionId: string; answer: unknown }> },
    ];
    expect(attemptId).toBe("a1");
    const q1 = payload.answers?.find((a) => a.questionId === "q1");
    expect(q1?.answer).toEqual({
      files: [{ fileUrl: "http://media.test/f1.png", fileId: "F1", name: "bai-lam.png" }],
    });
  });
});
