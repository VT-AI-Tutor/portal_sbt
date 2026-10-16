// @vitest-environment jsdom
/**
 * GAP-231 Pha 2 (mo rong toan bo card): BE nay phat kem `label` (ten tieng
 * Viet, co the null) tren MOI dong mastery_delta, khong chi competency/
 * component nhu truoc. Quy tac hien tai:
 *  - Khong bao gio hien ma tho (`key`) cho hoc sinh: dong co label -> hien
 *    label (kem nhan nhom, tru khi label da bat dau bang ten nhom); dong
 *    khong co label -> an hoan toan.
 *  - "subject" van luon bi an (khong lien quan, co tu truoc).
 *  - Neu label da bat dau bang ten nhom (khong phan biet hoa/thuong, khong
 *    dau) thi KHONG lap lai ten nhom truoc label.
 *  - Dong "khong doi" (before_percent === after_percent) la nhieu -> bi an;
 *    nhung neu an het thi khong hien ca card (khong hien tieu de rong).
 *  - Cac dong con lai duoc nhom theo dimension, thu tu co dinh: Muc, Chu de,
 *    Ky nang, Nang luc, Thanh to; trong 1 nhom giu nguyen thu tu tuong doi.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type {
  PracticeSession,
  ReviewQuestion,
  SessionReview,
  SubmitResult,
} from "@/modules/student/api/practiceApi";
import { SessionResult } from "./SessionResult";

vi.mock("@/core/exercise/QuestionPlayer", () => ({
  QuestionPlayer: () => <div data-testid="player" />,
}));

const session: PracticeSession = {
  id: "s1",
  mode: "practice",
  source: "custom",
  subject_code: "toan",
  level: "4",
  framework_key: "gdpt-2018",
  ref: null,
  time_limit_seconds: null,
  status: "completed",
  started_at: "2026-07-24T00:00:00Z",
  questions: [
    {
      id: "q1",
      order: 0,
      question_text: "1+1?",
      question_type: "single_choice",
      payload: { options: [], correctAnswer: "A", score: 1 },
      level_code: "biet",
      outcome_code: "T4",
      content_code: "SO",
    },
  ],
  answers: [],
};

const baseResult: SubmitResult = {
  session_id: "s1",
  status: "completed",
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
  mastery_delta: [
    {
      dimension: "cognitive_level",
      key: "biet",
      before_percent: 40,
      after_percent: 55,
      label: "Biết",
    },
    {
      dimension: "content",
      key: "SO",
      before_percent: 30,
      after_percent: 45,
      label: "Số học",
    },
    {
      dimension: "subject",
      key: "toan",
      before_percent: 50,
      after_percent: 60,
      label: "Toán",
    },
    {
      dimension: "competency",
      key: "TOAN4.TD-LL",
      before_percent: 20,
      after_percent: 35,
      label: "Tư duy và lập luận toán học",
    },
    {
      dimension: "component",
      key: "TOAN4.TD-LL.GQVD",
      before_percent: 10,
      after_percent: 25,
      label: "Giải quyết vấn đề",
    },
  ],
  rewards: null,
};

afterEach(() => cleanup());

function setup(r: SubmitResult = baseResult) {
  render(
    <MemoryRouter>
      <SessionResult session={session} result={r} />
    </MemoryRouter>,
  );
}

describe("SessionResult — mastery delta", () => {
  it("mọi dimension có label thì hiện với nhãn nhóm + tên tiếng Việt", () => {
    setup();
    expect(screen.getByText(/Mức Biết/)).toBeTruthy();
    expect(screen.getByText(/Chủ đề Số học/)).toBeTruthy();
    expect(screen.getByText(/Năng lực Tư duy và lập luận toán học/)).toBeTruthy();
    expect(screen.getByText(/Thành tố Giải quyết vấn đề/)).toBeTruthy();
  });

  it("không bao giờ hiện mã thô (key) ra UI, cho mọi dimension", () => {
    setup({
      ...baseResult,
      mastery_delta: [
        ...baseResult.mastery_delta,
        {
          dimension: "outcome",
          key: "YCCĐ1.1.1",
          before_percent: 0,
          after_percent: 100,
          label: "Nhận biết số tự nhiên",
        },
      ],
    });
    expect(screen.queryByText(/TOAN4\.TD-LL/)).toBeNull();
    expect(screen.queryByText(/TOAN4\.TD-LL\.GQVD/)).toBeNull();
    expect(screen.queryByText(/YCCĐ1\.1\.1/)).toBeNull();
    expect(screen.getByText(/Kỹ năng Nhận biết số tự nhiên/)).toBeTruthy();
  });

  it("dòng không có label (label: null) thì bị ẩn, kể cả dimension cũ như cognitive_level", () => {
    setup({
      ...baseResult,
      mastery_delta: [
        {
          dimension: "cognitive_level",
          key: "biet",
          before_percent: 40,
          after_percent: 55,
          label: null,
        },
        baseResult.mastery_delta[3],
      ],
    });
    expect(screen.queryByText(/biet/i)).toBeNull();
    expect(screen.getByText(/Năng lực Tư duy và lập luận toán học/)).toBeTruthy();
  });

  it("dòng không có field label ở tất cả (response cũ, không phải null) không bị crash và bị ẩn", () => {
    const legacyRow = { ...baseResult.mastery_delta[0] } as Record<string, unknown>;
    delete legacyRow.label;
    expect(() =>
      setup({
        ...baseResult,
        mastery_delta: [legacyRow as SubmitResult["mastery_delta"][number]],
      }),
    ).not.toThrow();
    expect(screen.queryByText("Thay đổi năng lực")).toBeNull();
  });

  it("subject vẫn luôn bị ẩn dù có label", () => {
    setup();
    expect(screen.queryByText(/^Toán$/)).toBeNull();
    expect(screen.queryByText(/subject/i)).toBeNull();
  });

  it("nếu label đã bắt đầu bằng tên nhóm thì không lặp lại tên nhóm", () => {
    setup({
      ...baseResult,
      mastery_delta: [
        {
          dimension: "competency",
          key: "DL6.NLDL",
          before_percent: 0,
          after_percent: 10,
          label: "Năng lực địa lí",
        },
      ],
    });
    expect(screen.getByText("Năng lực địa lí")).toBeTruthy();
    expect(screen.queryByText(/Năng lực Năng lực địa lí/)).toBeNull();
  });

  it("nếu label KHÔNG bắt đầu bằng tên nhóm thì vẫn giữ tiền tố nhóm", () => {
    setup({
      ...baseResult,
      mastery_delta: [
        {
          dimension: "competency",
          key: "DL6.VDKT",
          before_percent: 0,
          after_percent: 50,
          label: "Vận dụng kiến thức, kĩ năng đã học",
        },
      ],
    });
    expect(
      screen.getByText(/Năng lực Vận dụng kiến thức, kĩ năng đã học/),
    ).toBeTruthy();
  });

  it("dòng 0% → 0% (không đổi) bị ẩn vì là nhiễu", () => {
    setup({
      ...baseResult,
      mastery_delta: [
        {
          dimension: "content",
          key: "DL6_S20",
          before_percent: 0,
          after_percent: 0,
          label: "Chủ đề không đổi",
        },
        baseResult.mastery_delta[3],
      ],
    });
    expect(screen.queryByText(/Chủ đề không đổi/)).toBeNull();
    expect(screen.getByText(/Năng lực Tư duy và lập luận toán học/)).toBeTruthy();
  });

  it("nếu không còn dòng nào sau khi lọc (không label, không đổi, hoặc subject) thì ẩn cả block 'Thay đổi năng lực'", () => {
    setup({
      ...baseResult,
      mastery_delta: [
        {
          dimension: "competency",
          key: "TOAN4.CHUA-CO-NHAN",
          before_percent: 20,
          after_percent: 35,
          label: null,
        },
        {
          dimension: "subject",
          key: "toan",
          before_percent: 50,
          after_percent: 60,
          label: "Toán",
        },
        {
          dimension: "content",
          key: "SO",
          before_percent: 30,
          after_percent: 30,
          label: "Số học",
        },
      ],
    });
    expect(screen.queryByText("Thay đổi năng lực")).toBeNull();
  });

  it("nhóm theo thứ tự cố định Mức → Chủ đề → Kỹ năng → Năng lực → Thành tố, bất kể thứ tự trong response", () => {
    setup({
      ...baseResult,
      mastery_delta: [
        {
          dimension: "component",
          key: "c1",
          before_percent: 0,
          after_percent: 10,
          label: "Alpha thành tố",
        },
        {
          dimension: "cognitive_level",
          key: "l1",
          before_percent: 0,
          after_percent: 10,
          label: "Alpha một",
        },
        {
          dimension: "competency",
          key: "n1",
          before_percent: 0,
          after_percent: 10,
          label: "Alpha năng lực",
        },
        {
          dimension: "content",
          key: "d1",
          before_percent: 0,
          after_percent: 10,
          label: "Alpha chủ đề",
        },
        {
          dimension: "outcome",
          key: "o1",
          before_percent: 0,
          after_percent: 10,
          label: "Alpha kỹ năng",
        },
      ],
    });
    const rows = screen.getAllByText(/Alpha/).map((el) => el.textContent);
    expect(rows).toEqual([
      "Mức Alpha một",
      "Chủ đề Alpha chủ đề",
      "Kỹ năng Alpha kỹ năng",
      "Năng lực Alpha năng lực",
      "Thành tố Alpha thành tố",
    ]);
  });

  it("giữ nguyên thứ tự tương đối trong cùng một nhóm", () => {
    setup({
      ...baseResult,
      mastery_delta: [
        {
          dimension: "content",
          key: "d1",
          before_percent: 0,
          after_percent: 10,
          label: "Số học nâng cao",
        },
        {
          dimension: "content",
          key: "d2",
          before_percent: 0,
          after_percent: 20,
          label: "Hình học cơ bản",
        },
      ],
    });
    const rows = screen.getAllByText(/^Chủ đề /).map((el) => el.textContent);
    expect(rows).toEqual([
      "Chủ đề Số học nâng cao",
      "Chủ đề Hình học cơ bản",
    ]);
  });
});

// ---------------------------------------------------------------------------
// Các khối mới của màn kết quả (2026-07-30 Pha 1)
// ---------------------------------------------------------------------------

function reviewQuestion(over: Partial<ReviewQuestion> = {}): ReviewQuestion {
  return {
    id: "q1",
    order: 0,
    question_text: "1+1?",
    question_type: "single_choice",
    payload: { options: [], correctAnswer: "A" },
    student_answer: "A",
    is_correct: true,
    gradable: true,
    points: 1,
    max_points: 1,
    tutor_tier_used: 0,
    difficulty: "easy",
    level_code: null,
    content_code: null,
    outcome_code: null,
    competency_code: null,
    component_code: null,
    level_label: null,
    content_label: null,
    outcome_label: null,
    competency_label: null,
    component_label: null,
    solution: null,
    ...over,
  };
}

const baseReview: SessionReview = {
  session_id: "s1",
  mode: "practice",
  source: "custom",
  subject_code: "toan",
  subject_name: "Toán",
  level: "4",
  ref: null,
  topic_label: null,
  score: 1,
  max_score: 1,
  questions: [],
  weak_points: [],
  topic_mastery: null,
};

function setupWithReview(opts: {
  review?: SessionReview | null;
  reviewError?: boolean;
  reviewLoading?: boolean;
}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <SessionResult
          session={session}
          result={baseResult}
          review={opts.review ?? null}
          reviewLoading={opts.reviewLoading}
          reviewError={opts.reviewError}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SessionResult — khối mới", () => {
  it("hiện đủ các khối mới khi có review", () => {
    setupWithReview({
      review: {
        ...baseReview,
        questions: [reviewQuestion()],
        weak_points: [
          {
            dimension: "component",
            code: "x",
            label: "Thao tác tư duy",
            wrong: 1,
            total: 1,
            theory: [],
          },
        ],
        topic_mastery: {
          dimension: "content",
          code: "c1",
          label: "Phân số",
          percent: 60,
          attempted: 10,
        },
      },
    });

    expect(screen.getByText("Năng lực chủ đề đang luyện")).toBeTruthy();
    expect(screen.getByText("Cần cải thiện")).toBeTruthy();
    expect(screen.getByText("Chi tiết bài làm")).toBeTruthy();
    expect(screen.getByText("Luyện tiếp")).toBeTruthy();
  });

  it("review lỗi vẫn hiện điểm và phần thưởng, kèm dòng báo nhẹ", () => {
    setupWithReview({ review: null, reviewError: true });

    expect(screen.getByText("Kết quả")).toBeTruthy();
    expect(screen.getByText(/Không tải được phần xem lại/)).toBeTruthy();
    expect(screen.queryByText("Chi tiết bài làm")).toBeNull();
  });
});
