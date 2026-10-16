// @vitest-environment jsdom
/**
 * StudentCompetencyPage (Task 8) — test cấp TRANG cho phần "ráp": những chỗ
 * hỏng mà không ai thấy.
 *
 * Hai lỗi câm được canh ở đây:
 * 1. Cổng trạng thái thẻ môn — bỏ `isScored` là in ngay % lên thẻ mới 1 câu:
 *    con số trông rất hợp lý, và đó đúng là hành vi spec cấm.
 * 2. Ánh xạ hành động → nguồn phiên — TypeScript nhận `level_code` lẫn `ref`
 *    trên MỌI `source`, nên nối nhầm nhánh sẽ tạo phiên sai nội dung mà không
 *    có lỗi ở đâu cả. Vì vậy assert bằng `toEqual` trên trọn payload.
 *
 * Không có jest-dom trong setup của app — dùng assertion DOM thuần.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type {
  CompetencyOverview,
  CompetencySubjectDetail,
} from "@/modules/student/api/practiceApi";

const navigateMock = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router-dom")>();
  return { ...mod, useNavigate: () => navigateMock };
});

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

vi.mock("@/core/auth/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1", email: "hs@example.com", level: "4" } }),
}));

const overviewMock = vi.fn();
const subjectMock = vi.fn();
const mutateMock = vi.fn();
/** Mặc định KHÔNG có phiên nào đang tạo; test khối E/D (finding #6, race hai
 * phiên) đặt biến này true. Dùng biến thay vì `mockReturnValueOnce` vì hook bị
 * gọi lại ở MỌI lần render (trang có một `useEffect` chọn môn mặc định khi
 * mount, tự kích thêm một lần render) — "once" sẽ bị "ăn" trước khi tới lượt
 * render mà test soi vào. */
let createSessionIsPending = false;
const createSessionMock = vi.fn(() => ({
  mutate: mutateMock,
  isPending: createSessionIsPending,
}));
vi.mock("@/modules/student/api/hooks", () => ({
  useCompetencyOverview: () => overviewMock(),
  useCompetencySubject: (code?: string) => subjectMock(code),
  useCreatePracticeSession: () => createSessionMock(),
}));

import { StudentCompetencyPage } from "./StudentCompetencyPage";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  createSessionIsPending = false;
});

// --- fixtures --------------------------------------------------------------

const FRAMEWORK = {
  key: "bloom",
  levels: [
    { code: "NB", label: "Nhận biết", rank: 1, description: "nhớ lại" },
    { code: "TH", label: "Thông hiểu", rank: 2, description: "giải thích" },
    { code: "VD", label: "Vận dụng", rank: 3, description: "áp dụng" },
  ],
};

type Level = CompetencySubjectDetail["cognitive_levels"][number];
type Topic = CompetencySubjectDetail["topics"][number];
type Component = CompetencySubjectDetail["components"][number];

function lvl(
  code: string,
  label: string,
  rank: number,
  attempted: number,
  correct: number,
): Level {
  return {
    code,
    label,
    rank,
    attempted,
    correct,
    percent: attempted > 0 ? Math.round((correct / attempted) * 100) : 0,
  };
}

function topic(
  content_code: string,
  label: string,
  attempted: number,
  percent: number,
): Topic {
  return { content_code, label, attempted, percent };
}

function comp(code: string, label: string, attempted: number): Component {
  return {
    code,
    label,
    attempted,
    correct: 0,
    percent: 0,
    question_available: 20,
  };
}

const EMPTY_LEVELS = [
  lvl("NB", "Nhận biết", 1, 0, 0),
  lvl("TH", "Thông hiểu", 2, 0, 0),
  lvl("VD", "Vận dụng", 3, 0, 0),
];

function detailOf(
  over: Partial<CompetencySubjectDetail> = {},
): CompetencySubjectDetail {
  return {
    subject_code: "toan",
    subject_name: "Toán",
    target_percent: 80,
    framework: FRAMEWORK,
    cognitive_levels: EMPTY_LEVELS,
    topics: [],
    competencies: [],
    components: [],
    ai_analysis: {
      text: "",
      source: "template",
      generated_at: "2026-08-07T00:00:00Z",
      upsell: false,
    },
    suggestions: [],
    ...over,
  };
}

function subject(
  subject_code: string,
  subject_name: string,
  attempted: number,
  mastery_percent: number,
): CompetencyOverview["subjects"][number] {
  return {
    subject_code,
    subject_name,
    mastery_percent,
    attempted,
    correct: 0,
    last_activity_at: null,
  };
}

function overviewOf(
  subjects: CompetencyOverview["subjects"],
): CompetencyOverview {
  return { level: "4", framework: FRAMEWORK, subjects };
}

function renderPage(
  overview: CompetencyOverview,
  detail: CompetencySubjectDetail | undefined,
) {
  overviewMock.mockReturnValue({
    data: overview,
    isLoading: false,
    isError: false,
    error: null,
  });
  subjectMock.mockReturnValue({
    data: detail,
    isLoading: false,
    isError: false,
    error: null,
  });
  return render(
    <MemoryRouter>
      <StudentCompetencyPage />
    </MemoryRouter>,
  );
}

/** Thẻ môn trong picker — lọc theo tên môn để assert bó gọn trong ĐÚNG thẻ đó,
 * không ăn nhầm số % của phần chi tiết bên dưới. */
function chipFor(subjectName: string): HTMLElement {
  const chip = screen
    .getAllByRole("button")
    .find((b) => (b.textContent ?? "").includes(subjectName));
  if (!chip) throw new Error(`Không tìm thấy thẻ môn "${subjectName}"`);
  return chip;
}

/**
 * Đếm CÂU caveat "kết quả còn sơ bộ" (dải cảnh báo của trang và câu nhận xét
 * của khối E đều dùng cụm này). Cố ý KHÔNG đếm chữ "sơ bộ" trơn: LevelLadder
 * dùng nó làm nhãn dữ liệu trên từng hàng và trong chú thích ("kết quả sơ bộ
 * (còn ít bài)") — đó là nhãn, không phải câu caveat lặp.
 */
function countCaveat(text: string): number {
  return text.match(/kết quả còn sơ bộ/gi)?.length ?? 0;
}

// --- tests -----------------------------------------------------------------

describe("StudentCompetencyPage — ba trạng thái thẻ môn", () => {
  it("≥3 câu hiện %, 1–2 câu và 0 câu TUYỆT ĐỐI không hiện số", () => {
    renderPage(
      overviewOf([
        subject("toan", "Toán", 12, 72),
        // BE vẫn gửi mastery_percent=50 cho môn mới 2 câu — thẻ không được in nó ra.
        subject("van", "Ngữ văn", 2, 50),
        subject("anh", "Tiếng Anh", 0, 0),
      ]),
      detailOf({
        cognitive_levels: [lvl("NB", "Nhận biết", 1, 12, 9)],
      }),
    );

    expect(chipFor("Toán").textContent).toContain("72%");

    const van = chipFor("Ngữ văn").textContent ?? "";
    expect(van).toContain("Mới bắt đầu");
    expect(van).toContain("còn 1 câu");
    expect(van).not.toMatch(/%/);
    expect(van).not.toContain("50");

    const anh = chipFor("Tiếng Anh").textContent ?? "";
    expect(anh).toContain("Chưa làm bài");
    expect(anh).toContain("bắt đầu ngay");
    expect(anh).not.toMatch(/%/);
  });
});

describe("StudentCompetencyPage — môn chưa làm bài giữ nguyên khung màn", () => {
  it("dựng đủ hero + khối B + khối C + khối D, không có % ở đâu cả", () => {
    const { container } = renderPage(
      overviewOf([subject("toan", "Toán", 0, 0)]),
      detailOf({
        competencies: [
          comp("tu-duy", "Tư duy và lập luận", 0),
          comp("mo-hinh", "Mô hình hoá", 0),
          comp("giai-quyet", "Giải quyết vấn đề", 0),
        ],
      }),
    );

    // hero mời làm bài
    expect(screen.getByText(/chưa làm bài nào/i)).toBeTruthy();
    // KHÔNG bị thay bằng mỗi thẻ trắng — cả ba khối vẫn còn
    expect(screen.getByText("Độ vững theo mức đề")).toBeTruthy();
    expect(screen.getByText("Chân dung năng lực")).toBeTruthy();
    expect(screen.getByText("Chủ đề cần củng cố")).toBeTruthy();
    expect(screen.getByText(/sẽ xếp hàng ở đây/)).toBeTruthy();
    // bậc thang nói việc cần làm cho từng mức
    expect(screen.getAllByText(/Còn 3 câu nữa để đánh giá/).length).toBe(3);

    const text = container.textContent ?? "";
    expect(text).not.toMatch(/%/); // không vẽ chỗ thiếu dữ liệu thành 0%
    expect(text).not.toMatch(/chưa có dữ liệu/i);
    expect(text).not.toMatch(/không đủ mẫu/i);
    expect(text).not.toMatch(/N\/A/i);
  });

  it("khung nhận thức hỏng (cognitive_levels rỗng) KHÔNG được xoá lịch sử chủ đề của em", () => {
    renderPage(
      overviewOf([subject("toan", "Toán", 6, 50)]),
      detailOf({
        cognitive_levels: [],
        topics: [topic("t-phan-so", "Phân số", 6, 50)],
      }),
    );

    // đây là em CÓ làm bài — không được rơi vào hero "chưa làm bài nào"
    expect(screen.queryByText(/chưa làm bài nào/i)).toBeNull();
    expect(screen.getByText("Phân số")).toBeTruthy();
    expect(screen.queryByText(/sẽ xếp hàng ở đây/)).toBeNull();
    expect(screen.getByRole("button", { name: /^Luyện →$/ })).toBeTruthy();
  });
});

describe("StudentCompetencyPage — bậc thang chiếm trọn bề ngang khi không có competency (finding #1)", () => {
  it("không có competency (khung thiếu cho lớp) -> lưới 1 cột, không radar", () => {
    const { getByTestId } = renderPage(
      overviewOf([subject("toan", "Toán", 10, 80)]),
      detailOf({ cognitive_levels: [lvl("NB", "Nhận biết", 1, 10, 8)], competencies: [] }),
    );
    const grid = getByTestId("ladder-radar-grid");
    expect(grid.className).toContain("grid-cols-1");
    expect(grid.className).not.toContain("lg:grid-cols-2");
    expect(screen.queryByText("Chân dung năng lực")).toBeNull();
  });

  it("có competency -> lưới 2 cột (radar đi kèm bậc thang)", () => {
    const { getByTestId } = renderPage(
      overviewOf([subject("toan", "Toán", 10, 80)]),
      detailOf({
        cognitive_levels: [lvl("NB", "Nhận biết", 1, 10, 8)],
        competencies: [comp("tu-duy", "Tư duy và lập luận", 8)],
      }),
    );
    const grid = getByTestId("ladder-radar-grid");
    expect(grid.className).toContain("lg:grid-cols-2");
    expect(screen.getByText("Chân dung năng lực")).toBeTruthy();
  });
});

describe("StudentCompetencyPage — radar hiện MỌI competency của lớp, kể cả chưa có dữ liệu", () => {
  it("competency chưa làm (attempted=0, question_available=0) VẪN hiện làm trục ghost", () => {
    const { getByTestId } = renderPage(
      overviewOf([subject("toan", "Toán", 10, 80)]),
      detailOf({
        cognitive_levels: [lvl("NB", "Nhận biết", 1, 10, 8)],
        competencies: [
          { ...comp("chua-lam", "Chưa làm", 0), question_available: 0 },
          comp("da-lam", "Đã làm", 8),
        ],
      }),
    );
    // Không còn lọc theo question_available: mọi competency của lớp đều lên trục.
    expect(screen.getByText("Chân dung năng lực")).toBeTruthy();
    expect(getByTestId("ladder-radar-grid").className).toContain("lg:grid-cols-2");
  });
});

describe("StudentCompetencyPage — Chân dung năng lực vẽ theo THÀNH TỐ", () => {
  it("1 competency + 3 thành tố -> radar (không rơi về thanh ngang)", () => {
    // Ca thật của Khoa học tự nhiên: khung chỉ có MỘT competency ("Năng lực khoa
    // học") nên nguồn cũ không bao giờ đủ 3 trục; thành tố thì có 3.
    const { getByTestId, queryAllByTestId } = renderPage(
      overviewOf([subject("khtn", "Khoa học tự nhiên", 61, 100)]),
      detailOf({
        cognitive_levels: [lvl("NB", "Nhận biết", 1, 61, 61)],
        competencies: [comp("NLKH", "Năng lực khoa học", 61)],
        components: [
          comp("TP1", "Nhận thức khoa học", 52),
          comp("TP2", "Tìm hiểu tự nhiên", 6),
          comp("TP3", "Vận dụng kiến thức", 3),
        ],
      }),
    );

    expect(screen.getByText("Chân dung năng lực")).toBeTruthy();
    expect(getByTestId("radar-svg")).toBeTruthy();
    expect(queryAllByTestId("component-bar-row")).toHaveLength(0);
  });

  it("chưa có thành tố -> lui về competency như trước, không vỡ màn", () => {
    const { queryAllByTestId } = renderPage(
      overviewOf([subject("toan", "Toán", 20, 50)]),
      detailOf({
        cognitive_levels: [lvl("NB", "Nhận biết", 1, 20, 10)],
        competencies: [comp("NL1", "Năng lực một", 20)],
        components: [],
      }),
    );

    expect(screen.getByText("Chân dung năng lực")).toBeTruthy();
    // Một competency = một trục: dưới ngưỡng 3 nên vẫn là thanh ngang, như cũ.
    expect(queryAllByTestId("component-bar-row")).toHaveLength(1);
  });

  it("không competency lẫn thành tố -> ẩn hẳn thẻ, lưới 1 cột", () => {
    const { getByTestId } = renderPage(
      overviewOf([subject("toan", "Toán", 20, 50)]),
      detailOf({
        cognitive_levels: [lvl("NB", "Nhận biết", 1, 20, 10)],
        competencies: [],
        components: [],
      }),
    );

    expect(screen.queryByText("Chân dung năng lực")).toBeNull();
    expect(getByTestId("ladder-radar-grid").className).toContain("grid-cols-1");
  });
});

describe("StudentCompetencyPage — khoá nút hành động khi có phiên đang tạo (finding #6)", () => {
  it("một phiên đang tạo -> nút Luyện của CÁC chủ đề KHÁC và CTA nhận xét đều bị khoá", () => {
    createSessionIsPending = true;
    renderPage(
      overviewOf([subject("toan", "Toán", 20, 60)]),
      detailOf({
        cognitive_levels: [
          lvl("NB", "Nhận biết", 1, 10, 9),
          lvl("TH", "Thông hiểu", 2, 10, 3),
          lvl("VD", "Vận dụng", 3, 0, 0),
        ],
        topics: [
          topic("t-hinh-hoc", "Hình học", 10, 50),
          topic("t-so-hoc", "Số học", 10, 80),
        ],
      }),
    );

    const luyenButtons = screen
      .getAllByRole("button")
      .filter((b) => (b.textContent ?? "").trim() === "Luyện →");
    expect(luyenButtons.length).toBeGreaterThan(0);
    for (const b of luyenButtons) expect(b).toHaveProperty("disabled", true);

    const commentCta = screen.getByRole("button", { name: /Luyện 10 câu Thông hiểu/ });
    expect(commentCta).toHaveProperty("disabled", true);
  });
});

describe("StudentCompetencyPage — API chưa có trường competencies", () => {
  it("BE cũ không trả competencies: trang vẫn render, chỉ mất thẻ radar", () => {
    // Mô phỏng API cũ chưa trả `competencies` — radar (đọc field này) phải ẩn
    // mà trang không vỡ.
    const stale: Omit<CompetencySubjectDetail, "competencies"> & {
      competencies?: Component[];
    } = detailOf({ cognitive_levels: [lvl("NB", "Nhận biết", 1, 10, 8)] });
    delete stale.competencies;

    expect(() =>
      renderPage(
        overviewOf([subject("toan", "Toán", 10, 80)]),
        stale as CompetencySubjectDetail,
      ),
    ).not.toThrow();

    expect(screen.getByText("Độ vững theo mức đề")).toBeTruthy();
    expect(screen.getByText("Chủ đề cần củng cố")).toBeTruthy();
    expect(screen.queryByText("Chân dung năng lực")).toBeNull();
  });
});

describe("StudentCompetencyPage — hành động của nhận xét ánh xạ đúng nguồn phiên", () => {
  it('kind "level" -> source custom + level_code', () => {
    renderPage(
      overviewOf([subject("toan", "Toán", 20, 60)]),
      detailOf({
        cognitive_levels: [
          lvl("NB", "Nhận biết", 1, 10, 9),
          lvl("TH", "Thông hiểu", 2, 10, 3),
          lvl("VD", "Vận dụng", 3, 0, 0),
        ],
      }),
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Luyện 10 câu Thông hiểu/ }),
    );

    expect(mutateMock).toHaveBeenCalledTimes(1);
    expect(mutateMock.mock.calls[0][0]).toEqual({
      mode: "practice",
      source: "custom",
      subject_code: "toan",
      level: "4",
      level_code: "TH",
      question_count: 10,
    });
  });

  it('kind "topic" -> source topic + ref.content_code', () => {
    renderPage(
      overviewOf([subject("toan", "Toán", 30, 73)]),
      detailOf({
        cognitive_levels: [
          lvl("NB", "Nhận biết", 1, 10, 9),
          lvl("TH", "Thông hiểu", 2, 10, 7),
          lvl("VD", "Vận dụng", 3, 10, 6),
        ],
        topics: [
          topic("t-hinh-hoc", "Hình học", 10, 50),
          topic("t-so-hoc", "Số học", 10, 80),
        ],
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: /^Luyện chủ đề này/ }));

    expect(mutateMock.mock.calls[0][0]).toEqual({
      mode: "practice",
      source: "topic",
      subject_code: "toan",
      level: "4",
      ref: { content_code: "t-hinh-hoc" },
      question_count: 10,
    });
  });

  it('kind "general" -> source library, và caveat "sơ bộ" chỉ nói MỘT lần', () => {
    const { container } = renderPage(
      overviewOf([subject("toan", "Toán", 4, 75)]),
      detailOf({
        cognitive_levels: [
          lvl("NB", "Nhận biết", 1, 4, 3),
          lvl("TH", "Thông hiểu", 2, 0, 0),
          lvl("VD", "Vận dụng", 3, 0, 0),
        ],
      }),
    );

    // khối E đã tự nói "kết quả còn sơ bộ" -> trang không dựng thêm dải cùng nghĩa
    expect(countCaveat(container.textContent ?? "")).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: /Làm thêm 10 câu/ }));

    expect(mutateMock.mock.calls[0][0]).toEqual({
      mode: "practice",
      source: "library",
      subject_code: "toan",
      level: "4",
      question_count: 10,
    });
  });

  it("đủ bài nhưng mức nào cũng mỏng -> dải cảnh báo dựng, vẫn chỉ MỘT caveat", () => {
    const { container } = renderPage(
      overviewOf([subject("toan", "Toán", 12, 60)]),
      detailOf({
        cognitive_levels: [
          lvl("NB", "Nhận biết", 1, 6, 5),
          lvl("TH", "Thông hiểu", 2, 6, 2),
          lvl("VD", "Vận dụng", 3, 0, 0),
        ],
      }),
    );

    const text = container.textContent ?? "";
    expect(text).toContain("Kết quả còn sơ bộ");
    expect(countCaveat(text)).toBe(1);
  });
});
