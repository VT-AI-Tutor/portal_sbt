// @vitest-environment jsdom
/**
 * Việc 1 (lát "gắn liên kết bài giảng") — bảng tiến độ lớp cho MỘT bài giảng
 * đổi nguồn `linkId` sang `GET /{id}/links` (nguồn sự thật ClassMaterialLink)
 * thay vì suy từ `lecture.class_context` + dò ngược qua học liệu lớp như
 * trước — đường cũ đó chỉ tìm được MỘT lớp và đã hỏng ở ca hai lớp (giáo viên
 * dạy cả 6A lẫn 6B). Ca then chốt khác: máy chủ trả cả học sinh CHƯA học
 * (sections rỗng) — ô điểm phải hiện "—", KHÔNG được lọc mất dòng đó.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TeacherLecture } from "@/modules/teacher/api/teacherLectureApi";
import { teacherLectureApi } from "@/modules/teacher/api/teacherLectureApi";
import { LectureProgressDialog } from "./LectureProgressDialog";

const useAccessTokenMock = vi.fn<() => string | null>(() => "tok");
vi.mock("@/core/auth/AuthContext", () => ({
  useAccessToken: () => useAccessTokenMock(),
}));

vi.mock("@/modules/teacher/api/teacherLectureApi", () => ({
  teacherLectureApi: { links: vi.fn(), progress: vi.fn() },
}));

const mockedApi = teacherLectureApi as unknown as {
  links: ReturnType<typeof vi.fn>;
  progress: ReturnType<typeof vi.fn>;
};

const lecture: TeacherLecture = {
  id: "lec-1",
  title: "Phân số bằng nhau",
  subject_code: "toan",
  subject: "Toán",
  level: "4",
  content_code: "toan4.phan-so",
  outcome_codes: [],
  status: "ready",
  class_context: null,
  sections: [],
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-01T00:00:00Z",
};

const oneLink = [
  {
    link_id: "link-1",
    class_id: "c1",
    class_name: "Lớp 6A",
    session_id: "s1",
    session_title: "Tiết 1",
    release_at: null,
    visibility: "enrolled_only" as const,
  },
];

const twoLinks = [
  {
    link_id: "link-1",
    class_id: "c1",
    class_name: "Lớp 6A",
    session_id: "s1",
    session_title: "Tiết 1",
    release_at: null,
    visibility: "enrolled_only" as const,
  },
  {
    link_id: "link-2",
    class_id: "c2",
    class_name: "Lớp 6B",
    session_id: "s2",
    session_title: "Tiết 3",
    release_at: null,
    visibility: "enrolled_only" as const,
  },
];

function renderDialog(lec: TeacherLecture = lecture) {
  return render(
    <LectureProgressDialog open onOpenChange={() => {}} lecture={lec} />,
  );
}

describe("LectureProgressDialog — bảng tiến độ (1 liên kết)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.links.mockResolvedValue(oneLink);
    mockedApi.progress.mockResolvedValue([
      {
        student_id: "st-1",
        full_name: "Học Sinh Một",
        sections: {
          khoidong: { score: 1, max_score: 1, submitted_at: "2026-08-10T00:00:00Z" },
          hinhthanh: { score: 2, max_score: 2, submitted_at: "2026-08-10T00:00:00Z" },
          luyentap: { score: 1, max_score: 2, submitted_at: "2026-08-10T00:00:00Z" },
          vandung: { score: 2, max_score: 2, submitted_at: "2026-08-10T00:00:00Z" },
        },
        completed_at: "2026-08-10T00:05:00Z",
      },
      {
        student_id: "st-2",
        full_name: "Học Sinh Hai",
        sections: {},
        completed_at: null,
      },
    ]);
  });

  afterEach(cleanup);

  it("1 liên kết: mở thẳng bảng, không bắt chọn — hiện đúng 2 dòng, dòng chưa học hiện dấu gạch ngang cho mọi hoạt động", async () => {
    renderDialog();

    await waitFor(() => screen.getByText("Học Sinh Một"));
    expect(screen.getByText("Học Sinh Hai")).toBeTruthy();

    // Không hiện bộ chọn lớp/tiết khi chỉ có một liên kết.
    expect(screen.queryByRole("button", { name: /Lớp/ })).toBeNull();

    expect(mockedApi.links).toHaveBeenCalledWith("lec-1", "tok");
    expect(mockedApi.progress).toHaveBeenCalledWith("lec-1", "link-1", "tok");

    // Em đã học: điểm từng hoạt động hiện đúng.
    expect(screen.getByText("1/1")).toBeTruthy();
    expect(screen.getAllByText("2/2").length).toBe(2);

    // Em chưa học: TẤT CẢ 4 ô hoạt động hiện "—", không bị lọc khỏi bảng.
    const row2 = screen.getByText("Học Sinh Hai").closest("tr");
    expect(row2).not.toBeNull();
    const dashCells = row2!.querySelectorAll("td");
    // cột 0 = tên, cột 1..4 = 4 hoạt động đều "—", cột 5 = hoàn thành "—"
    expect(dashCells[1].textContent).toBe("—");
    expect(dashCells[2].textContent).toBe("—");
    expect(dashCells[3].textContent).toBe("—");
    expect(dashCells[4].textContent).toBe("—");
    expect(dashCells[5].textContent).toBe("—");
  });

  it("cột theo đúng thứ tự 4 hoạt động với nhãn tiếng Việt", async () => {
    renderDialog();
    await waitFor(() => screen.getByText("Học Sinh Một"));
    const headers = screen
      .getAllByRole("columnheader")
      .map((h) => h.textContent);
    expect(headers).toEqual([
      "Học sinh",
      "Khởi động",
      "Hình thành kiến thức",
      "Luyện tập",
      "Vận dụng",
      "Hoàn thành",
    ]);
  });

  it("mở lại phải hỏi lại máy chủ — không giữ bảng cũ từ lần mở trước (cả /links lẫn /progress)", async () => {
    const { rerender } = renderDialog();
    await waitFor(() => expect(mockedApi.progress).toHaveBeenCalledTimes(1));
    expect(mockedApi.links).toHaveBeenCalledTimes(1);

    rerender(
      <LectureProgressDialog open={false} onOpenChange={() => {}} lecture={lecture} />,
    );
    rerender(
      <LectureProgressDialog open onOpenChange={() => {}} lecture={lecture} />,
    );

    await waitFor(() => expect(mockedApi.progress).toHaveBeenCalledTimes(2));
    expect(mockedApi.links).toHaveBeenCalledTimes(2);
  });
});

describe("LectureProgressDialog — 0 liên kết", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.links.mockResolvedValue([]);
  });

  afterEach(cleanup);

  it("0 liên kết → hiện thông điệp rõ ràng, KHÔNG hiện bảng, KHÔNG gọi tiến độ", async () => {
    renderDialog();

    await waitFor(() =>
      screen.getByText("Bài giảng chưa gắn vào lớp nào."),
    );
    expect(screen.queryByRole("table")).toBeNull();
    expect(mockedApi.progress).not.toHaveBeenCalled();
  });
});

/**
 * Ca then chốt (chính là ca lát 1 làm hỏng): bài giảng gắn ở HAI lớp khác
 * nhau. /links trả về đủ hai — dialog phải hiện bộ chọn, và khi giáo viên
 * chọn lớp thứ hai thì phải gọi tiến độ với ĐÚNG link_id của lớp đó (khẳng
 * định GIÁ TRỊ tham số, không chỉ khẳng định có gọi).
 */
describe("LectureProgressDialog — nhiều liên kết (ca hai lớp)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.links.mockResolvedValue(twoLinks);
    mockedApi.progress.mockResolvedValue([]);
  });

  afterEach(cleanup);

  it("nhiều liên kết → hiện bộ chọn lớp/tiết, chưa gọi tiến độ cho tới khi chọn", async () => {
    renderDialog();

    await waitFor(() =>
      screen.getByRole("button", { name: "Lớp 6A · Tiết 1" }),
    );
    expect(
      screen.getByRole("button", { name: "Lớp 6B · Tiết 3" }),
    ).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    expect(mockedApi.progress).not.toHaveBeenCalled();
  });

  it("chọn lớp thứ hai (Lớp 6B) → gọi tiến độ với ĐÚNG link_id của lớp đó, không phải lớp đầu tiên", async () => {
    const user = userEvent.setup();
    renderDialog();

    const classBBtn = await screen.findByRole("button", {
      name: "Lớp 6B · Tiết 3",
    });
    await user.click(classBBtn);

    await waitFor(() =>
      expect(mockedApi.progress).toHaveBeenCalledTimes(1),
    );
    expect(mockedApi.progress).toHaveBeenCalledWith("lec-1", "link-2", "tok");
  });

  it("chọn lớp đầu tiên (Lớp 6A) → gọi tiến độ với đúng link-1", async () => {
    const user = userEvent.setup();
    renderDialog();

    const classABtn = await screen.findByRole("button", {
      name: "Lớp 6A · Tiết 1",
    });
    await user.click(classABtn);

    await waitFor(() =>
      expect(mockedApi.progress).toHaveBeenCalledTimes(1),
    );
    expect(mockedApi.progress).toHaveBeenCalledWith("lec-1", "link-1", "tok");
  });
});

describe("LectureProgressDialog — token rỗng trong khi đang mở", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    useAccessTokenMock.mockReturnValue("tok"); // trả nguyên trạng cho describe khác
  });

  it("token rỗng: báo lỗi thay vì treo khung xương chờ vĩnh viễn", async () => {
    useAccessTokenMock.mockReturnValue(null);

    render(
      <LectureProgressDialog open onOpenChange={() => {}} lecture={lecture} />,
    );

    await waitFor(() =>
      screen.getByText("Chưa xác thực — thử tải lại trang."),
    );
    expect(screen.queryByRole("table")).toBeNull();
    expect(mockedApi.links).not.toHaveBeenCalled();
    expect(mockedApi.progress).not.toHaveBeenCalled();
  });
});
