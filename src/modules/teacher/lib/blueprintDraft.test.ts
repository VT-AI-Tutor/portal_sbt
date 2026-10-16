import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  distributePoints,
  estimateMinutes,
  generateDraft,
  levelShares,
  totalCells,
} from "@/modules/teacher/lib/blueprintDraft";
import type {
  BlueprintCell,
  PaperBlueprintInput,
} from "@/modules/teacher/api/teacherBlueprintApi";

const pickCell = vi.hoisted(() => vi.fn());
const generateCell = vi.hoisted(() => vi.fn());

vi.mock("@/modules/teacher/api/teacherBlueprintApi", () => ({
  teacherBlueprintApi: { pickCell, generateCell },
}));

function question(id: string) {
  return {
    id,
    source: "library" as const,
    question_type: "single_choice",
    question_text: `Câu ${id}`,
    options: [],
    payload: null,
    difficulty: "medium",
    cell: { content_code: "PHANSO", level_code: "biet" },
  };
}

const CELLS: BlueprintCell[] = [
  { content_code: "PHANSO", level_code: "biet", count: 2 },
  { content_code: "PHANSO", level_code: "hieu", count: 2 },
];

function input(over: Partial<PaperBlueprintInput> = {}): PaperBlueprintInput {
  return {
    title: "Đề thử",
    kind: "exam",
    subject: "Toán",
    subject_code: "toan",
    level: "6",
    total_points: 10,
    printable_only: true,
    cells: CELLS,
    ...over,
  };
}

const labels = { topicLabel: (c: string) => c, levelLabel: (c: string) => c };

beforeEach(() => {
  pickCell.mockReset();
  generateCell.mockReset();
});

describe("chia điểm", () => {
  it("dồn phần lẻ vào câu cuối để tổng khớp đúng", () => {
    expect(distributePoints(3, 10)).toEqual([3.25, 3.25, 3.5]);
    expect(distributePoints(4, 10)).toEqual([2.5, 2.5, 2.5, 2.5]);
  });

  it("cùng kết quả với phép chia của máy chủ ở mọi cỡ đề thường gặp", () => {
    for (const n of [5, 7, 9, 12, 20, 25]) {
      const sum = distributePoints(n, 10).reduce((a, b) => a + b, 0);
      expect(Math.round(sum * 100) / 100).toBe(10);
    }
  });
});

describe("sinh bản nháp", () => {
  it("bốc kho trước rồi mới nhờ trợ lý AI bù đúng phần thiếu", async () => {
    pickCell
      .mockResolvedValueOnce({ questions: [question("a"), question("b")], missing: 0 })
      .mockResolvedValueOnce({ questions: [question("c")], missing: 1 });
    generateCell.mockResolvedValueOnce({
      saved: [{ ...question("ai-1"), source: "ai" }],
      rejected: [],
      ai_disabled: false,
    });

    const results = await generateDraft(input(), "token", labels);

    // Ô đầu kho đủ → KHÔNG gọi trợ lý AI. Gọi thừa là tốn tiền thật.
    expect(generateCell).toHaveBeenCalledTimes(1);
    expect(generateCell.mock.calls[0][0].count).toBe(1);
    expect(results[0].items).toHaveLength(2);
    expect(results[1].items.map((q) => q.source)).toEqual(["library", "ai"]);
  });

  it("không để câu của ô trước rơi lại vào ô sau", async () => {
    pickCell
      .mockResolvedValueOnce({ questions: [question("a"), question("b")], missing: 0 })
      .mockResolvedValueOnce({ questions: [question("c"), question("d")], missing: 0 });

    await generateDraft(input(), "token", labels);

    // Lượt bốc thứ hai phải mang theo id của hai câu đã lấy ở lượt đầu.
    expect(pickCell.mock.calls[1][0].exclude_ids).toEqual(
      expect.arrayContaining(["a", "b"]),
    );
  });

  it("chia đều thang điểm NGAY khi sinh xong, không bắt giáo viên bấm chia lại", async () => {
    pickCell
      .mockResolvedValueOnce({ questions: [question("a"), question("b")], missing: 0 })
      .mockResolvedValueOnce({ questions: [question("c"), question("d")], missing: 0 });

    const results = await generateDraft(input(), "token", labels);
    const points = results.flatMap((r) => r.items.map((q) => q.points));

    expect(points).toEqual([2.5, 2.5, 2.5, 2.5]);
    expect(points.reduce((a, b) => a + b, 0)).toBe(10);
  });

  it("phiếu bài tập giữ 1 điểm mỗi câu", async () => {
    pickCell
      .mockResolvedValueOnce({ questions: [question("a"), question("b")], missing: 0 })
      .mockResolvedValueOnce({ questions: [question("c")], missing: 1 });
    generateCell.mockResolvedValueOnce({ saved: [], rejected: [], ai_disabled: true });

    const results = await generateDraft(
      input({ kind: "worksheet", total_points: undefined }),
      "token",
      labels,
    );

    expect(results.flatMap((r) => r.items.map((q) => q.points))).toEqual([1, 1, 1]);
  });

  it("một ô hỏng chỉ hỏng ô đó, các ô khác vẫn giữ nguyên", async () => {
    pickCell
      .mockRejectedValueOnce(new Error("Mạng lỗi"))
      .mockResolvedValueOnce({ questions: [question("c"), question("d")], missing: 0 });

    const results = await generateDraft(input(), "token", labels);

    expect(results[0].error).toBe("Mạng lỗi");
    expect(results[0].items).toHaveLength(0);
    expect(results[1].items).toHaveLength(2);
  });

  it("trợ lý AI tắt thì ô thiếu báo rõ chứ không nổ", async () => {
    pickCell
      .mockResolvedValueOnce({ questions: [question("a")], missing: 1 })
      .mockResolvedValueOnce({ questions: [], missing: 2 });
    generateCell.mockResolvedValue({ saved: [], rejected: [], ai_disabled: true });

    const results = await generateDraft(input(), "token", labels);

    expect(results[0].aiDisabled).toBe(true);
    expect(results[0].missing).toBe(1);
    expect(results.every((r) => r.error === undefined)).toBe(true);
  });
});

describe("phép cộng trên ma trận", () => {
  it("cộng tổng số câu và tỷ lệ theo mức", () => {
    expect(totalCells(CELLS)).toBe(4);

    const shares = levelShares(CELLS, [
      { code: "biet", label: "Nhận biết", order: 1 },
      { code: "hieu", label: "Thông hiểu", order: 2 },
      { code: "vandung", label: "Vận dụng", order: 3 },
      { code: "vandungcao", label: "Vận dụng cao", order: 4 },
    ]);
    expect(shares.map((s) => s.percent)).toEqual([50, 50, 0, 0]);
  });

  it("ước lượng thời gian theo dạng câu, dạng lạ rơi về mặc định", () => {
    const table = { single_choice: 1, essay: 8, default: 1.5 };
    expect(estimateMinutes(["single_choice", "single_choice", "essay"], table)).toBe(10);
    expect(estimateMinutes(["dang_moi"], table)).toBe(2);
  });
});
