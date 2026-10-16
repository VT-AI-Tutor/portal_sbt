// @vitest-environment jsdom
/**
 * Test cấp TRANG cho phát hiện 3 của review Task 13 vòng 1: nút "Tiếp tục
 * soạn" trên một bản nháp phải mở LectureFlow VỚI đúng bản nháp đó
 * (initialLecture), không phải mở luồng soạn mới với form trống.
 *
 * `LectureFlow` bị mock nông (chỉ đọc prop) — hành vi "nhảy thẳng vào bước
 * duyệt, hiện đúng nội dung" đã có LectureFlow.test.tsx chứng minh riêng ở
 * cấp component; test này chỉ chứng minh trang GẮN đúng bản nháp vào đúng
 * chỗ khi giáo viên bấm nút.
 */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TeacherLecture } from "@/modules/teacher/api/teacherLectureApi";

const lecturesMock = vi.fn();
vi.mock("@/modules/teacher/hooks/useTeacherLectures", () => ({
  useTeacherLectures: () => lecturesMock(),
}));

const lectureFlowSpy = vi.fn();
vi.mock("@/modules/teacher/ui/shared/lecture/LectureFlow", () => ({
  LectureFlow: (props: {
    initialLecture?: TeacherLecture;
    onDone: () => void;
  }) => {
    lectureFlowSpy(props);
    return (
      <div data-testid="lecture-flow">
        {props.initialLecture
          ? `tiếp tục: ${props.initialLecture.title}`
          : "mới"}
      </div>
    );
  },
}));

vi.mock("@/modules/teacher/ui/shared/lecture/LectureAttachDialog", () => ({
  LectureAttachDialog: () => null,
}));

const progressDialogSpy = vi.fn();
vi.mock("@/modules/teacher/ui/shared/lecture/LectureProgressDialog", () => ({
  LectureProgressDialog: (props: { lecture: TeacherLecture }) => {
    progressDialogSpy(props);
    return <div data-testid="lecture-progress-dialog">{props.lecture.title}</div>;
  },
}));

import { TeacherLecturesPage } from "./TeacherLecturesPage";

const draft: TeacherLecture = {
  id: "lec-1",
  title: "Phân số dở dang",
  subject_code: "TOAN",
  subject: "Toán",
  level: "6",
  content_code: "PHANSO",
  outcome_codes: [],
  status: "draft",
  class_context: null,
  sections: [],
  created_at: "2026-08-20T00:00:00Z",
  updated_at: "2026-08-20T00:00:00Z",
};

const ready: TeacherLecture = { ...draft, id: "lec-2", status: "ready" };
const readyAttached: TeacherLecture = {
  ...ready,
  id: "lec-3",
  class_context: { class_id: "c1", session_id: "s1" },
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("TeacherLecturesPage — tiếp tục bản nháp (Phát hiện 3)", () => {
  it("bấm Tiếp tục soạn trên bài giảng nháp mở LectureFlow với đúng bản nháp đó — không phải form trống", async () => {
    const user = userEvent.setup();
    lecturesMock.mockReturnValue({
      data: [draft],
      isLoading: false,
      error: null,
    });

    render(<TeacherLecturesPage />);

    await user.click(screen.getByRole("button", { name: "Tiếp tục soạn" }));

    expect(screen.getByTestId("lecture-flow").textContent).toBe(
      "tiếp tục: Phân số dở dang",
    );
    expect(lectureFlowSpy).toHaveBeenCalledWith(
      expect.objectContaining({ initialLecture: draft }),
    );
  });

  it("bấm Soạn bài giảng mới mở LectureFlow KHÔNG kèm initialLecture", async () => {
    const user = userEvent.setup();
    lecturesMock.mockReturnValue({ data: [], isLoading: false, error: null });

    render(<TeacherLecturesPage />);

    await user.click(
      screen.getByRole("button", { name: /Soạn bài giảng mới/ }),
    );

    expect(screen.getByTestId("lecture-flow").textContent).toBe("mới");
    expect(lectureFlowSpy).toHaveBeenCalledWith(
      expect.objectContaining({ initialLecture: undefined }),
    );
  });

  it("bài giảng đã hoàn tất KHÔNG có nút Tiếp tục soạn — chỉ Gắn vào tiết", () => {
    lecturesMock.mockReturnValue({
      data: [ready],
      isLoading: false,
      error: null,
    });

    render(<TeacherLecturesPage />);

    expect(screen.queryByRole("button", { name: "Tiếp tục soạn" })).toBeNull();
    expect(screen.getByRole("button", { name: /Gắn vào tiết/ })).toBeTruthy();
  });
});

describe("TeacherLecturesPage — nút Tiến độ (Việc 2, lát gắn liên kết bài giảng)", () => {
  // Không còn khoá theo `class_context` — bài giảng `ready` là bấm được
  // ngay, kể cả khi chưa gắn lớp nào (LectureProgressDialog tự hỏi /links và
  // báo rõ "chưa gắn vào lớp nào", không cần đoán trước ở trang danh sách).
  it("bài giảng ready CHƯA gắn lớp nào: nút Tiến độ vẫn bấm được ngay, không còn khoá", () => {
    lecturesMock.mockReturnValue({
      data: [ready], // class_context: null
      isLoading: false,
      error: null,
    });

    render(<TeacherLecturesPage />);

    const btn = screen.getByRole("button", {
      name: /Tiến độ/,
    }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("bài giảng ready ĐÃ gắn lớp: bấm Tiến độ mở LectureProgressDialog đúng bài giảng", async () => {
    const user = userEvent.setup();
    lecturesMock.mockReturnValue({
      data: [readyAttached],
      isLoading: false,
      error: null,
    });

    render(<TeacherLecturesPage />);

    const btn = screen.getByRole("button", {
      name: /Tiến độ/,
    }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    expect(screen.queryByTestId("lecture-progress-dialog")).toBeNull();

    await user.click(btn);

    expect(screen.getByTestId("lecture-progress-dialog").textContent).toBe(
      readyAttached.title,
    );
    expect(progressDialogSpy).toHaveBeenCalledWith(
      expect.objectContaining({ lecture: readyAttached }),
    );
  });
});
