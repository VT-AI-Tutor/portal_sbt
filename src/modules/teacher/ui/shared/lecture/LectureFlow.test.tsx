// @vitest-environment jsdom
/**
 * Test cấp component cho ba phát hiện Quan trọng của review Task 13 vòng 1:
 * (1) cổng hoàn tất chặn bản dở/hỏng, (2) trạng thái bận theo từng hoạt động
 * không bị hai thao tác song song ghi đè nhau, (3) `initialLecture` nhảy
 * thẳng vào bước duyệt để "Tiếp tục soạn" có lối vào thật.
 *
 * Mock toàn bộ hook chạm mạng (khuôn StudentCompetencyPage.test.tsx) — chỉ
 * còn logic + hiển thị thật của LectureFlow chạy trong test.
 */
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TeacherLecture } from "@/modules/teacher/api/teacherLectureApi";

vi.mock("@/core/auth/AuthContext", () => ({
  useAccessToken: () => "tok",
}));

const confirmMock = vi.fn().mockResolvedValue(true);
vi.mock("@/core/ui/confirm", () => ({
  useConfirm: () => confirmMock,
}));

vi.mock("@/core/reference", () => ({
  useSubjects: () => ({ data: [], isLoading: false }),
  useLevels: () => ({ data: [], isLoading: false }),
}));

vi.mock("@/modules/teacher/hooks/useTeacherClasses", () => ({
  useTeacherClasses: () => ({ data: [], isLoading: false }),
}));

vi.mock("@/modules/teacher/hooks/useTeacherBlueprint", () => ({
  useBlueprintCatalog: () => ({ data: undefined, isLoading: false }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

const createMutateAsync = vi.fn();
const updateMutateAsync = vi.fn();
const regenerateMutateAsync = vi.fn();
const finalizeMutateAsync = vi.fn();
const attachMutate = vi.fn();

vi.mock("@/modules/teacher/hooks/useTeacherLectures", () => ({
  useClassSessions: () => ({ data: [], isLoading: false }),
  useCreateLecture: () => ({
    mutateAsync: createMutateAsync,
    isPending: false,
  }),
  useUpdateLectureSection: () => ({
    mutateAsync: updateMutateAsync,
    isPending: false,
  }),
  useRegenerateLectureSection: () => ({
    mutateAsync: regenerateMutateAsync,
    isPending: false,
  }),
  useFinalizeLecture: () => ({
    mutateAsync: finalizeMutateAsync,
    isPending: false,
  }),
  useAttachLectureMaterial: () => ({ mutate: attachMutate, isPending: false }),
}));

// Task tiếp theo: "Sinh lại phần này" trên hoạt động THIẾU quiz phải bốc/gắn
// quiz luôn qua `generateSectionWithQuiz` (dây chuyền thật của lectureDraft.ts,
// không viết bản thứ hai) — mock riêng export này, giữ nguyên phần còn lại của
// module (generateLectureDraft không dùng trong các test này).
const generateSectionWithQuizMock = vi.hoisted(() => vi.fn());
vi.mock("@/modules/teacher/lib/lectureDraft", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/modules/teacher/lib/lectureDraft")
  >();
  return { ...actual, generateSectionWithQuiz: generateSectionWithQuizMock };
});

import { LectureFlow } from "./LectureFlow";

function makeLecture(overrides: Partial<TeacherLecture> = {}): TeacherLecture {
  return {
    id: "lec-1",
    title: "Phân số — Toán 6",
    subject_code: "TOAN",
    subject: "Toán",
    level: "6",
    content_code: "PHANSO",
    outcome_codes: [],
    status: "draft",
    class_context: null,
    // question_ids MẶC ĐỊNH đã gắn quiz — hầu hết test ở file này kiểm hành vi
    // KHÔNG liên quan quiz (bận theo hoạt động, tiếp tục bản nháp...), để rỗng
    // sẽ vô tình rơi vào nhánh bốc-bù-quiz mới của handleRegenerate. Test riêng
    // cho nhánh bốc bù quiz tự override question_ids: [] ở dưới.
    sections: [
      {
        key: "khoidong",
        title: "Khởi động",
        objective: "",
        blocks: [{ type: "text", content: "Nội dung khởi động" }],
        slides: [],
        question_ids: ["q-khoidong"],
        generated_at: "2026-08-20T00:00:00Z",
        edited_at: null,
      },
      {
        key: "hinhthanh",
        title: "Hình thành kiến thức",
        objective: "",
        blocks: [{ type: "text", content: "Nội dung hình thành" }],
        slides: [],
        question_ids: ["q-hinhthanh"],
        generated_at: "2026-08-20T00:00:00Z",
        edited_at: null,
      },
      {
        key: "luyentap",
        title: "Luyện tập",
        objective: "",
        blocks: [{ type: "text", content: "Nội dung luyện tập" }],
        slides: [],
        question_ids: ["q-luyentap"],
        generated_at: "2026-08-20T00:00:00Z",
        edited_at: null,
      },
      {
        key: "vandung",
        title: "Vận dụng",
        objective: "",
        blocks: [{ type: "text", content: "Nội dung vận dụng" }],
        slides: [],
        question_ids: ["q-vandung"],
        generated_at: "2026-08-20T00:00:00Z",
        edited_at: null,
      },
    ],
    created_at: "2026-08-20T00:00:00Z",
    updated_at: "2026-08-20T00:00:00Z",
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  confirmMock.mockResolvedValue(true);
});

describe("LectureFlow — tiếp tục bản nháp (Phát hiện 3)", () => {
  it("nhận initialLecture thì vào THẲNG bước duyệt, hiện đúng nội dung của bài giảng đó — không phải form trống", () => {
    const lecture = makeLecture();
    render(<LectureFlow initialLecture={lecture} onDone={vi.fn()} />);

    // Bước duyệt: nội dung THẬT của bài giảng đã lên màn ngay.
    expect(screen.getByText("Nội dung khởi động")).toBeTruthy();
    expect(screen.getByText("Nội dung hình thành")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Hoàn tất bài giảng/ }),
    ).toBeTruthy();

    // KHÔNG phải bước form — không có ô khai hay nút Sinh bài giảng.
    expect(screen.queryByLabelText("Tên bài giảng")).toBeNull();
    expect(screen.queryByRole("button", { name: "Sinh bài giảng" })).toBeNull();
  });
});

describe("LectureFlow — cổng hoàn tất (Phát hiện 1)", () => {
  it("khoá nút Hoàn tất khi còn hoạt động rỗng cả khối lẫn slide — dây chuyền đổ giữa chừng", () => {
    const lecture = makeLecture({
      sections: [
        {
          key: "khoidong",
          title: "Khởi động",
          objective: "",
          blocks: [{ type: "text", content: "A" }],
          slides: [],
          question_ids: [],
          generated_at: null,
          edited_at: null,
        },
        {
          key: "hinhthanh",
          title: "Hình thành kiến thức",
          objective: "",
          blocks: [],
          slides: [],
          question_ids: [],
          generated_at: null,
          edited_at: null,
        },
        {
          key: "luyentap",
          title: "Luyện tập",
          objective: "",
          blocks: [{ type: "text", content: "B" }],
          slides: [],
          question_ids: [],
          generated_at: null,
          edited_at: null,
        },
        {
          key: "vandung",
          title: "Vận dụng",
          objective: "",
          blocks: [{ type: "text", content: "C" }],
          slides: [],
          question_ids: [],
          generated_at: null,
          edited_at: null,
        },
      ],
    });

    render(<LectureFlow initialLecture={lecture} onDone={vi.fn()} />);

    const finalizeButton = screen.getByRole("button", {
      name: /Hoàn tất bài giảng/,
    });
    expect((finalizeButton as HTMLButtonElement).disabled).toBe(true);
    expect(
      screen.getByTestId("lecture-finalize-blockers").textContent,
    ).toContain("Hình thành kiến thức");
  });

  it("mở nút Hoàn tất khi mọi hoạt động đủ nội dung và không còn lỗi", () => {
    const lecture = makeLecture();
    render(<LectureFlow initialLecture={lecture} onDone={vi.fn()} />);

    const finalizeButton = screen.getByRole("button", {
      name: /Hoàn tất bài giảng/,
    });
    expect((finalizeButton as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByTestId("lecture-finalize-blockers")).toBeNull();
  });
});

describe("LectureFlow — trạng thái bận theo từng hoạt động (Phát hiện 2)", () => {
  it("Sinh lại ở một hoạt động đang chạy không bị Lưu ở hoạt động khác ghi đè trạng thái bận", async () => {
    const user = userEvent.setup();
    const lecture = makeLecture();

    let resolveRegenerate!: (v: unknown) => void;
    regenerateMutateAsync.mockReturnValue(
      new Promise((resolve) => {
        resolveRegenerate = resolve;
      }),
    );
    updateMutateAsync.mockResolvedValue(lecture);

    render(<LectureFlow initialLecture={lecture} onDone={vi.fn()} />);

    const regenButtons = screen.getAllByRole("button", {
      name: /Sinh lại phần này/,
    }) as HTMLButtonElement[];
    const saveButtons = screen.getAllByRole("button", {
      name: /Lưu phần này/,
    }) as HTMLButtonElement[];

    // Hoạt động 0 (khởi động): bấm Sinh lại — mutation CHƯA resolve, còn treo.
    await user.click(regenButtons[0]);
    await waitFor(() => expect(regenButtons[0].disabled).toBe(true));

    // Hoạt động 1 (hình thành): bấm Lưu TRONG LÚC hoạt động 0 còn đang chạy.
    await user.click(saveButtons[1]);
    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalled());

    // Bận của B không ghi đè bận của A: nút Sinh lại của A vẫn khoá.
    expect(regenButtons[0].disabled).toBe(true);
    // B đã xong (mutation resolve ngay) — nút Lưu của B mở lại được.
    await waitFor(() => expect(saveButtons[1].disabled).toBe(false));

    // A xong sau — nút Sinh lại của A mở lại đúng lúc, không bị B khoá hộ.
    await act(async () => {
      resolveRegenerate({ ai_disabled: false, quiz: null, lecture });
    });
    await waitFor(() => expect(regenButtons[0].disabled).toBe(false));
  });
});

describe("LectureFlow — bốc bù quiz khi Sinh lại phần này trên bản nháp Tiếp tục soạn", () => {
  it("hoạt động ĐÃ có nội dung nhưng CHƯA gắn quiz: Sinh lại phần này bốc/gắn quiz qua generateSectionWithQuiz, không đụng đường regenerate cũ", async () => {
    const user = userEvent.setup();
    const base = makeLecture();
    // Rớt mạng đúng bước bốc/gắn quiz: khoidong có nội dung, máy chủ CÓ đề
    // xuất quiz thật (count>0) nhưng question_ids vẫn rỗng — đây mới đúng là
    // ca sectionMissingQuiz() nhận diện (khác với quiz vắng mặt/count===0).
    const lecture = {
      ...base,
      sections: base.sections.map((s, i) =>
        i === 0
          ? { ...s, question_ids: [], quiz: { count: 2, level_code: "biet" as const } }
          : s,
      ),
    };
    const updatedLecture = {
      ...base,
      sections: base.sections.map((s, i) =>
        i === 0 ? { ...s, question_ids: ["new-q"] } : s,
      ),
    };
    generateSectionWithQuizMock.mockResolvedValueOnce({
      lecture: updatedLecture,
      aiDisabled: false,
    });

    render(<LectureFlow initialLecture={lecture} onDone={vi.fn()} />);

    expect(screen.getByText("Chưa có câu hỏi trắc nghiệm")).toBeTruthy();
    // 3 hoạt động còn lại (hinhthanh/luyentap/vandung) đã có sẵn quiz từ trước.
    expect(
      screen.getAllByText("1 câu hỏi trắc nghiệm đã gắn").length,
    ).toBe(3);

    const regenButtons = screen.getAllByRole("button", {
      name: /Sinh lại phần này/,
    });
    await user.click(regenButtons[0]);

    await waitFor(() =>
      expect(generateSectionWithQuizMock).toHaveBeenCalledTimes(1),
    );
    expect(regenerateMutateAsync).not.toHaveBeenCalled();

    const [lectureId, key, , , usedSet] = generateSectionWithQuizMock.mock
      .calls[0] as [string, string, unknown, string, Set<string>];
    expect(lectureId).toBe(lecture.id);
    expect(key).toBe("khoidong");
    expect(usedSet instanceof Set).toBe(true);

    // khoidong giờ cũng đã gắn quiz — không còn "Chưa có câu hỏi trắc nghiệm".
    await waitFor(() =>
      expect(screen.queryByText("Chưa có câu hỏi trắc nghiệm")).toBeNull(),
    );
    expect(
      screen.getAllByText("1 câu hỏi trắc nghiệm đã gắn").length,
    ).toBe(4);
  });

  it("hoạt động ĐÃ có quiz: Sinh lại phần này vẫn đi đường cũ (chỉ đổi nội dung), không gọi generateSectionWithQuiz — không re-roll quiz đã duyệt", async () => {
    const user = userEvent.setup();
    const lecture = makeLecture(); // mặc định mọi hoạt động đã có question_ids

    regenerateMutateAsync.mockResolvedValueOnce({
      ai_disabled: false,
      quiz: null,
      lecture,
    });

    render(<LectureFlow initialLecture={lecture} onDone={vi.fn()} />);

    const regenButtons = screen.getAllByRole("button", {
      name: /Sinh lại phần này/,
    });
    await user.click(regenButtons[0]);

    await waitFor(() => expect(regenerateMutateAsync).toHaveBeenCalledTimes(1));
    expect(generateSectionWithQuizMock).not.toHaveBeenCalled();
  });
});

describe("LectureFlow — review vòng 2 (Nghiêm trọng): quiz.count===0 và quiz vắng mặt KHÔNG bị coi là thiếu quiz", () => {
  it("nội dung có + quiz:{count:0} (máy chủ ĐÃ XÉT, không cần) — KHÔNG chặn hoàn tất, và Sinh lại phần này KHÔNG đi vào nhánh bốc quiz", async () => {
    const user = userEvent.setup();
    const base = makeLecture();
    const lecture = {
      ...base,
      sections: base.sections.map((s, i) =>
        i === 0 ? { ...s, question_ids: [], quiz: { count: 0 } } : s,
      ),
    };

    render(<LectureFlow initialLecture={lecture} onDone={vi.fn()} />);

    // KHÔNG bị chặn hoàn tất dù question_ids rỗng — máy chủ đã xét, không
    // cần quiz cho hoạt động này (ca HỢP LỆ, khác hẳn "bốc quiz hỏng").
    const finalizeButton = screen.getByRole("button", {
      name: /Hoàn tất bài giảng/,
    });
    expect((finalizeButton as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByTestId("lecture-finalize-blockers")).toBeNull();

    regenerateMutateAsync.mockResolvedValueOnce({
      ai_disabled: false,
      quiz: null,
      lecture,
    });
    const regenButtons = screen.getAllByRole("button", {
      name: /Sinh lại phần này/,
    });
    await user.click(regenButtons[0]);

    // Không rơi vào vòng lặp sinh-lại-vô-ích: đi đường cũ (chỉ nội dung),
    // không gọi generateSectionWithQuiz để rồi máy chủ tiếp tục trả
    // không-cần-quiz, question_ids vẫn rỗng, lại bị coi là "thiếu" lần nữa.
    await waitFor(() =>
      expect(regenerateMutateAsync).toHaveBeenCalledTimes(1),
    );
    expect(generateSectionWithQuizMock).not.toHaveBeenCalled();
  });

  it("nội dung có + KHÔNG có khoá quiz (bài giảng cũ trước khi máy chủ lưu trường này) — KHÔNG chặn hoàn tất", () => {
    const base = makeLecture();
    const lecture = {
      ...base,
      sections: base.sections.map((s, i) =>
        i === 0 ? { ...s, question_ids: [] } : s,
      ),
    };

    render(<LectureFlow initialLecture={lecture} onDone={vi.fn()} />);

    const finalizeButton = screen.getByRole("button", {
      name: /Hoàn tất bài giảng/,
    });
    expect((finalizeButton as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByTestId("lecture-finalize-blockers")).toBeNull();
  });

  it("nội dung có + quiz:{count:2} + question_ids rỗng — CHẶN, thông điệp nêu đúng 'thiếu câu hỏi trắc nghiệm', KHÔNG lẫn với 'chưa xong nội dung'", () => {
    const base = makeLecture();
    const lecture = {
      ...base,
      sections: base.sections.map((s, i) =>
        i === 0
          ? { ...s, question_ids: [], quiz: { count: 2, level_code: "biet" as const } }
          : s,
      ),
    };

    render(<LectureFlow initialLecture={lecture} onDone={vi.fn()} />);

    const finalizeButton = screen.getByRole("button", {
      name: /Hoàn tất bài giảng/,
    });
    expect((finalizeButton as HTMLButtonElement).disabled).toBe(true);

    const blockersText =
      screen.getByTestId("lecture-finalize-blockers").textContent ?? "";
    expect(blockersText).toContain("thiếu câu hỏi trắc nghiệm");
    expect(blockersText).toContain("Khởi động");
    expect(blockersText).not.toContain("chưa xong nội dung");
  });
});
