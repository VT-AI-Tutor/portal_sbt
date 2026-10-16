// @vitest-environment jsdom
/**
 * StudentLectureViewer (Task 14) — mở một bài giảng đã phát cho lớp: đọc +
 * slide + quiz nhúng. Player thật bị mock (khuôn nhà) vì viewer chỉ NHÚNG,
 * không tự chấm — chấm là việc của máy chủ qua `submitSection`.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { StudentLectureView } from "@/modules/teacher/api/teacherLectureApi";

vi.mock("@/core/auth/AuthContext", () => ({
  useAccessToken: () => "tok-hs-1",
}));

const showMock = vi.fn();
const submitSectionMock = vi.fn();
vi.mock("@/modules/student/api/studentLectureApi", () => ({
  studentLectureApi: {
    show: (...args: unknown[]) => showMock(...args),
    submitSection: (...args: unknown[]) => submitSectionMock(...args),
  },
}));

// Lệ nhà: giả lập player để test không phụ thuộc nội tại của nó. Thêm nút bấm
// đáp án qua onAnswerChange để (b) kiểm được payload thật sự gửi lên máy chủ.
vi.mock("@/core/exercise/QuestionPlayer", () => ({
  QuestionPlayer: ({
    index,
    onAnswerChange,
  }: {
    index: number;
    onAnswerChange?: (a: unknown) => void;
  }) => (
    <div data-testid={`qp-${index}`}>
      <button onClick={() => onAnswerChange?.("A")}>Chọn A</button>
    </div>
  ),
}));

const fixture: StudentLectureView = {
  id: "lec-1",
  title: "Phép cộng trong phạm vi 10",
  subject_code: "toan",
  subject: "Toán",
  level: "1",
  content_code: "SO",
  outcome_codes: [],
  status: "ready",
  class_context: null,
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-01T00:00:00Z",
  sections: [
    {
      key: "khoidong",
      title: "Khởi động",
      objective: "Gợi mở bài học",
      blocks: [{ type: "heading", content: "Chào các em" }],
      slides: [],
      questions: [],
      progress: null,
      generated_at: "2026-08-01T00:00:00Z",
      edited_at: null,
    },
    {
      key: "hinhthanh",
      title: "Hình thành kiến thức",
      objective: "Dạy phép cộng",
      blocks: [{ type: "text", content: "1 + 1 = 2" }],
      slides: [],
      questions: [],
      progress: null,
      generated_at: "2026-08-01T00:00:00Z",
      edited_at: null,
    },
    {
      key: "luyentap",
      title: "Luyện tập",
      objective: "Làm quiz",
      blocks: [],
      slides: [],
      questions: [
        {
          id: "q1",
          type: "single_choice",
          content: "1 + 1 = ?",
          options: [
            { id: "A", content: "2" },
            { id: "B", content: "3" },
          ],
          payload: null,
          points: 1,
        },
      ],
      progress: null,
      generated_at: "2026-08-01T00:00:00Z",
      edited_at: null,
    },
    {
      key: "vandung",
      title: "Vận dụng",
      objective: "Áp dụng thực tế",
      blocks: [],
      slides: [],
      questions: [],
      progress: null,
      generated_at: "2026-08-01T00:00:00Z",
      edited_at: null,
    },
  ],
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function setup() {
  const { userEvent } = await import("@testing-library/user-event");
  const user = userEvent.setup();
  const { StudentLectureViewer } = await import("./StudentLectureViewer");
  render(
    <MemoryRouter initialEntries={["/student/lectures/link-1"]}>
      <Routes>
        <Route
          path="/student/lectures/:linkId"
          element={<StudentLectureViewer />}
        />
      </Routes>
    </MemoryRouter>,
  );
  return user;
}

describe("StudentLectureViewer", () => {
  it("render đủ 4 hoạt động với tiêu đề đúng", async () => {
    showMock.mockResolvedValue(fixture);
    await setup();

    expect(await screen.findByText("Khởi động")).toBeTruthy();
    expect(screen.getByText("Hình thành kiến thức")).toBeTruthy();
    expect(screen.getByText("Luyện tập")).toBeTruthy();
    expect(screen.getByText("Vận dụng")).toBeTruthy();
  });

  it("bấm 'Nộp phần này' gọi submitSection với đáp án hiện có", async () => {
    showMock.mockResolvedValue(fixture);
    submitSectionMock.mockResolvedValue({
      score: 1,
      max_score: 1,
      results: [
        {
          question_id: "q1",
          is_correct: true,
          points: 1,
          max_points: 1,
          gradable: true,
        },
      ],
    });
    const user = await setup();

    await screen.findByText("Luyện tập");
    await user.click(screen.getByText("Chọn A"));
    await user.click(screen.getByRole("button", { name: "Nộp phần này" }));

    await waitFor(() => expect(submitSectionMock).toHaveBeenCalledTimes(1));
    expect(submitSectionMock).toHaveBeenCalledWith(
      "link-1",
      "luyentap",
      { q1: "A" },
      "tok-hs-1",
    );
  });

  it("sau khi máy chủ trả kết quả, điểm của phần hiện ra", async () => {
    showMock.mockResolvedValue(fixture);
    submitSectionMock.mockResolvedValue({
      score: 1,
      max_score: 1,
      results: [
        {
          question_id: "q1",
          is_correct: true,
          points: 1,
          max_points: 1,
          gradable: true,
        },
      ],
    });
    const user = await setup();

    await screen.findByText("Luyện tập");
    await user.click(screen.getByText("Chọn A"));
    await user.click(screen.getByRole("button", { name: "Nộp phần này" }));

    expect(await screen.findByText(/Điểm: 1\/1/)).toBeTruthy();
  });

  it("C1 — hoạt động đã có progress khi tải: hiện điểm NGAY, ẩn nút Nộp phần này; hoạt động chưa nộp vẫn hiện nút", async () => {
    const fixtureWithProgress: StudentLectureView = {
      ...fixture,
      sections: fixture.sections.map((s) =>
        s.key === "luyentap"
          ? {
              ...s,
              progress: {
                submitted_at: "2026-08-19T00:00:00Z",
                score: 2,
                max_score: 2,
                results: [
                  {
                    question_id: "q1",
                    is_correct: true,
                    points: 1,
                    max_points: 1,
                    gradable: true,
                  },
                ],
              },
            }
          : { ...s, progress: null },
      ),
    };
    showMock.mockResolvedValue(fixtureWithProgress);
    await setup();

    // Điểm hiện NGAY khi mở màn — KHÔNG cần bấm Nộp trước.
    expect(await screen.findByText(/Điểm: 2\/2/)).toBeTruthy();
    // Đã nộp rồi thì không còn nút nộp lại — nộp đè sẽ mất điểm cũ (C1).
    expect(
      screen.queryByRole("button", { name: "Nộp phần này" }),
    ).toBeNull();
    // Không hề gọi submitSection chỉ vì hiển thị dữ liệu đã có sẵn.
    expect(submitSectionMock).not.toHaveBeenCalled();
  });

  it("C1 — hoạt động CHƯA nộp (progress null) vẫn hiện nút Nộp phần này như cũ", async () => {
    const fixtureNoProgress: StudentLectureView = {
      ...fixture,
      sections: fixture.sections.map((s) => ({ ...s, progress: null })),
    };
    showMock.mockResolvedValue(fixtureNoProgress);
    await setup();

    await screen.findByText("Luyện tập");
    expect(
      screen.getByRole("button", { name: "Nộp phần này" }),
    ).toBeTruthy();
  });
});
