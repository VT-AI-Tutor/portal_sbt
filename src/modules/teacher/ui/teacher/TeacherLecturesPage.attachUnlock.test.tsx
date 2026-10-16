// @vitest-environment jsdom
/**
 * Việc 2 (lát "gắn liên kết bài giảng") — bản gốc của file này (I1, review
 * Task 13) chứng minh: gắn thành công phải vá NGAY cache `class_context`
 * trên danh sách để mở khoá nút "Tiến độ". Cách vá cache đó đã BỎ HẲN — nút
 * "Tiến độ" không còn khoá theo `class_context` nữa (xem
 * `TeacherLecturesPage.test.tsx` — bài giảng `ready` bấm được ngay bất kể đã
 * gắn lớp hay chưa), nên không còn gì để "mở khoá".
 *
 * File này giữ lại vai trò kiểm tra DÂY CHUYỀN THẬT (TeacherLecturesPage →
 * `useAttachLectureMaterial` thật → QueryClient thật, chỉ giả lập ở biên
 * API `teacherLectureApi.attach`) cho phần còn có ý nghĩa: gắn thành công
 * phải LÀM MỚI danh sách bài giảng (invalidate `teacher-lectures`) thay vì
 * vá cache thủ công — đúng thay thế mà `useTeacherLectures.ts` mô tả.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TeacherLecture } from "@/modules/teacher/api/teacherLectureApi";

vi.mock("@/core/auth/AuthContext", () => ({
  useAccessToken: () => "tok-gv-1",
}));

const listMock = vi.fn();
const attachMock = vi.fn();
vi.mock("@/modules/teacher/api/teacherLectureApi", () => ({
  teacherLectureApi: {
    list: (...args: unknown[]) => listMock(...args),
    attach: (...args: unknown[]) => attachMock(...args),
  },
}));

vi.mock("@/modules/teacher/ui/shared/lecture/LectureFlow", () => ({
  LectureFlow: () => null,
}));

vi.mock("@/modules/teacher/ui/shared/lecture/LectureProgressDialog", () => ({
  LectureProgressDialog: () => <div data-testid="progress-dialog" />,
}));

// Dialog giả — dùng THẬT `useAttachLectureMaterial` (không mock hook) để phần
// làm mới cache trong onSuccess của hook chạy đúng như production.
vi.mock("@/modules/teacher/ui/shared/lecture/LectureAttachDialog", async () => {
  const React = await import("react");
  const { useAttachLectureMaterial } = await import(
    "@/modules/teacher/hooks/useTeacherLectures"
  );
  function LectureAttachDialog({
    lecture,
    onOpenChange,
  }: {
    lecture: TeacherLecture;
    onOpenChange: (open: boolean) => void;
  }) {
    const attach = useAttachLectureMaterial();
    return React.createElement(
      "button",
      {
        onClick: () =>
          attach.mutate(
            {
              lectureId: lecture.id,
              input: { class_id: "c9", session_id: "s9" },
            },
            { onSuccess: () => onOpenChange(false) },
          ),
      },
      "Gắn giả (test)",
    );
  }
  return { LectureAttachDialog };
});

import { TeacherLecturesPage } from "./TeacherLecturesPage";

const readyUnattached: TeacherLecture = {
  id: "lec-1",
  title: "Phân số bằng nhau",
  subject_code: "toan",
  subject: "Toán",
  level: "6",
  content_code: "toan6.phan-so",
  outcome_codes: [],
  status: "ready",
  class_context: null,
  sections: [],
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-01T00:00:00Z",
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TeacherLecturesPage />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("TeacherLecturesPage — gắn qua teacherLectureApi.attach làm mới danh sách (Việc 2)", () => {
  it("nút Tiến độ đã bấm được TỪ TRƯỚC khi gắn (không còn khoá theo class_context)", async () => {
    listMock.mockResolvedValue([readyUnattached]);

    renderPage();

    const progressBtn = (await screen.findByRole("button", {
      name: /Tiến độ/,
    })) as HTMLButtonElement;
    expect(progressBtn.disabled).toBe(false);
  });

  it("gắn thành công gọi teacherLectureApi.attach đúng lectureId/input, và LÀM MỚI danh sách bài giảng (invalidate) thay vì vá cache class_context thủ công", async () => {
    const user = userEvent.setup();
    listMock.mockResolvedValue([readyUnattached]);
    attachMock.mockResolvedValue({
      link_id: "link-9",
      class_id: "c9",
      class_name: "Lớp 6C",
      session_id: "s9",
      session_title: "Tiết 2",
      release_at: null,
      visibility: "enrolled_only",
    });

    renderPage();

    await screen.findByRole("button", { name: /Tiến độ/ });
    expect(listMock).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /Gắn vào tiết/ }));
    await user.click(screen.getByRole("button", { name: "Gắn giả (test)" }));

    await waitFor(() => expect(attachMock).toHaveBeenCalledTimes(1));
    expect(attachMock).toHaveBeenCalledWith(
      "lec-1",
      { class_id: "c9", session_id: "s9" },
      "tok-gv-1",
    );

    // Danh sách phải được tải lại (invalidate → refetch), KHÔNG còn vá thẳng
    // class_context trên cache như bản trước.
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2));
  });
});
