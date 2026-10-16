// @vitest-environment jsdom
/**
 * I1 (review cuối, giữ nguyên phần đổ mặc định) — `lecture.class_context`
 * (lớp/tiết chọn LÚC SOẠN, tuỳ chọn) vẫn là giá trị mặc định tiện lợi cho
 * form gắn: bỏ trống lúc soạn rồi gắn ở đây thì nút "Gắn vào tiết" khoá tới
 * khi tự chọn; có sẵn thì bấm được ngay không cần chọn lại. Phần khoá nút
 * "Tiến độ" theo `class_context` đã BỎ (xem TeacherLecturesPage.test.tsx) —
 * test này chỉ còn chứng minh hành vi đổ mặc định của CHÍNH form gắn.
 *
 * Việc 2 — đổi sang gọi `teacherLectureApi.attach` qua hook
 * `useAttachLectureMaterial` (tên hook giữ nguyên, đổi shape tham số):
 * `{ lectureId, input: { class_id, session_id, ... } }`, KHÔNG còn
 * `material_id`/`material_type`/`title_snapshot` (đường /attach nhận
 * `class_id`+`session_id`, máy chủ tự điền `material_type`).
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TeacherLecture } from "@/modules/teacher/api/teacherLectureApi";

const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: (...a: unknown[]) => toastSuccessMock(...a), error: (...a: unknown[]) => toastErrorMock(...a) },
}));

const mutateMock = vi.fn();
vi.mock("@/modules/teacher/hooks/useTeacherLectures", () => ({
  useAttachLectureMaterial: () => ({ mutate: mutateMock, isPending: false }),
  useClassSessions: (classId?: string) => ({
    data:
      classId === "c1" ? [{ id: "s1", title: "Tiết 1" }] : [],
    isLoading: false,
  }),
}));

vi.mock("@/modules/teacher/hooks/useTeacherClasses", () => ({
  useTeacherClasses: () => ({
    data: [{ id: "c1", name: "Lớp 6A" }],
    isLoading: false,
  }),
}));

import { LectureAttachDialog } from "./LectureAttachDialog";

const lecture: TeacherLecture = {
  id: "lec-1",
  title: "Phân số bằng nhau",
  subject_code: "toan",
  subject: "Toán",
  level: "6",
  content_code: "toan6.phan-so",
  outcome_codes: [],
  status: "ready",
  class_context: { class_id: "c1", session_id: "s1" },
  sections: [],
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-01T00:00:00Z",
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("LectureAttachDialog — đổ sẵn class_context (I1)", () => {
  it("mở hộp thoại với bài giảng có class_context: nút Gắn vào tiết bấm được NGAY, không cần chọn lại", async () => {
    const user = (await import("@testing-library/user-event")).default;
    const u = user.setup();
    render(
      <LectureAttachDialog open onOpenChange={() => {}} lecture={lecture} />,
    );

    const submit = screen.getByRole("button", {
      name: "Gắn vào tiết",
    }) as HTMLButtonElement;
    expect(submit.disabled).toBe(false);

    await u.click(submit);

    // Việc 2 — gọi teacherLectureApi.attach qua { lectureId, input }, KHÔNG
    // còn material_id/material_type/title_snapshot (đường /attach nhận
    // class_id+session_id, máy chủ tự điền material_type).
    expect(mutateMock).toHaveBeenCalledTimes(1);
    const [payload] = mutateMock.mock.calls[0];
    expect(payload.lectureId).toBe("lec-1");
    expect(payload.input).toEqual({
      class_id: "c1",
      session_id: "s1",
      visibility: "enrolled_only",
      release_at: undefined,
    });
    expect(payload.input).not.toHaveProperty("material_id");
    expect(payload.input).not.toHaveProperty("material_type");
    expect(payload.input).not.toHaveProperty("title_snapshot");
  });

  it("bài giảng chưa có class_context nào vẫn giữ hành vi cũ: nút khoá tới khi tự chọn", () => {
    const bare: TeacherLecture = { ...lecture, class_context: null };
    render(<LectureAttachDialog open onOpenChange={() => {}} lecture={bare} />);

    const submit = screen.getByRole("button", {
      name: "Gắn vào tiết",
    }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });
});

describe("LectureAttachDialog — báo lỗi máy chủ bằng tiếng Việt (Việc 2)", () => {
  it("409 bài giảng chưa hoàn tất: hiện đúng thông điệp máy chủ trả về", async () => {
    const user = (await import("@testing-library/user-event")).default;
    const u = user.setup();
    mutateMock.mockImplementation((_v, opts) => {
      opts?.onError?.(
        new Error(
          'Bài giảng chưa hoàn tất — phải bấm "Hoàn tất" trước khi gắn vào lớp.',
        ),
      );
    });

    render(
      <LectureAttachDialog open onOpenChange={() => {}} lecture={lecture} />,
    );
    await u.click(screen.getByRole("button", { name: "Gắn vào tiết" }));

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith(
        expect.stringContaining("chưa hoàn tất"),
      ),
    );
  });

  it("409 đã gắn đúng cặp lớp+tiết này rồi: hiện đúng thông điệp máy chủ trả về", async () => {
    const user = (await import("@testing-library/user-event")).default;
    const u = user.setup();
    mutateMock.mockImplementation((_v, opts) => {
      opts?.onError?.(
        new Error("Bài giảng đã được gắn vào tiết này rồi."),
      );
    });

    render(
      <LectureAttachDialog open onOpenChange={() => {}} lecture={lecture} />,
    );
    await u.click(screen.getByRole("button", { name: "Gắn vào tiết" }));

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith(
        expect.stringContaining("đã được gắn vào tiết này rồi"),
      ),
    );
  });
});
