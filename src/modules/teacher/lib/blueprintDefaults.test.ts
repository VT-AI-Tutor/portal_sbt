import { describe, expect, it } from "vitest";
import {
  buildDefaultMatrix,
  DEFAULT_TOTAL,
} from "@/modules/teacher/lib/blueprintDefaults";
import type { BlueprintCatalog } from "@/modules/teacher/api/teacherBlueprintApi";

const LEVELS = [
  { code: "biet" as const, label: "Nhận biết", order: 1 },
  { code: "hieu" as const, label: "Thông hiểu", order: 2 },
  { code: "vandung" as const, label: "Vận dụng", order: 3 },
  { code: "vandungcao" as const, label: "Vận dụng cao", order: 4 },
];

function catalog(
  topics: { code: string; counts: Partial<Record<string, number>> }[],
): BlueprintCatalog {
  return {
    levels: LEVELS,
    topics: topics.map((t) => {
      const counts = {
        biet: t.counts.biet ?? 0,
        hieu: t.counts.hieu ?? 0,
        vandung: t.counts.vandung ?? 0,
        vandungcao: t.counts.vandungcao ?? 0,
      };
      return {
        content_code: t.code,
        label: t.code,
        counts,
        total: Object.values(counts).reduce((a, b) => a + b, 0),
      };
    }),
    minutes_per_type: { default: 1.5 },
    has_bank: true,
  };
}

const totalOf = (cells: { count: number }[]) =>
  cells.reduce((sum, c) => sum + c.count, 0);

describe("ma trận mẫu", () => {
  it("điền đủ số câu mong muốn khi kho dư dả", () => {
    const rich = catalog([
      { code: "A", counts: { biet: 20, hieu: 20, vandung: 20, vandungcao: 20 } },
      { code: "B", counts: { biet: 20, hieu: 20, vandung: 20, vandungcao: 20 } },
    ]);
    const cells = buildDefaultMatrix(rich, 20);
    expect(totalOf(cells)).toBe(20);
  });

  it("bám tỷ lệ 40/30/20/10 theo mức nhận thức", () => {
    const rich = catalog([
      { code: "A", counts: { biet: 50, hieu: 50, vandung: 50, vandungcao: 50 } },
    ]);
    const byLevel = Object.fromEntries(
      buildDefaultMatrix(rich, 20).map((c) => [c.level_code, c.count]),
    );
    expect(byLevel).toEqual({ biet: 8, hieu: 6, vandung: 4, vandungcao: 2 });
  });

  it("KHÔNG ô nào vượt số câu kho thật có", () => {
    const thin = catalog([
      { code: "A", counts: { biet: 3, hieu: 1 } },
      { code: "B", counts: { biet: 2 } },
    ]);
    const cells = buildDefaultMatrix(thin, 20);

    for (const cell of cells) {
      const topic = thin.topics.find((t) => t.content_code === cell.content_code)!;
      expect(cell.count).toBeLessThanOrEqual(topic.counts[cell.level_code]);
    }
    // Kho chỉ có 6 câu thì mẫu tối đa 6 — bấm Sinh là chạy được ngay, không
    // phải nhờ trợ lý AI bù từ đầu.
    expect(totalOf(cells)).toBe(6);
  });

  it("chia theo tỷ lệ tồn kho, không chia đều", () => {
    // Chủ đề dày gấp bốn thì nhận nhiều hơn — chia đều là ép chủ đề mỏng phải
    // nhờ trợ lý AI trong khi chủ đề dày bỏ phí câu có sẵn.
    //
    // Kho dư dả ở CẢ BỐN mức để không có phần bù nào chen vào: bài kiểm tra này
    // soi đúng phép chia theo tỷ lệ, tách khỏi phép bù (test riêng bên dưới).
    const skewed = catalog([
      { code: "DAY", counts: { biet: 40, hieu: 40, vandung: 40, vandungcao: 40 } },
      { code: "MONG", counts: { biet: 10, hieu: 10, vandung: 10, vandungcao: 10 } },
    ]);
    const cells = buildDefaultMatrix(skewed, 20);

    const at = (code: string, level: string) =>
      cells.find((c) => c.content_code === code && c.level_code === level)?.count ?? 0;
    expect(at("DAY", "biet")).toBeGreaterThan(at("MONG", "biet"));
    expect(at("DAY", "hieu")).toBeGreaterThan(at("MONG", "hieu"));
    expect(totalOf(cells)).toBe(20);
  });

  it("bỏ qua chủ đề kho trống", () => {
    const mixed = catalog([
      { code: "CO", counts: { biet: 10 } },
      { code: "TRONG", counts: {} },
    ]);
    const codes = buildDefaultMatrix(mixed, 10).map((c) => c.content_code);
    expect(codes).not.toContain("TRONG");
  });

  it("bù từ mức còn dư khi một mức cạn kho", () => {
    // Kho chỉ có câu Nhận biết: phần của ba mức kia phải rơi về đó, chứ không
    // để đề mặc định hụt hơn nửa số câu.
    const onlyBiet = catalog([{ code: "A", counts: { biet: 30 } }]);
    const cells = buildDefaultMatrix(onlyBiet, 10);
    expect(totalOf(cells)).toBe(10);
    expect(cells.every((c) => c.level_code === "biet")).toBe(true);
  });

  it("kho rỗng thì trả bảng trống chứ không bịa", () => {
    expect(buildDefaultMatrix(catalog([]), 20)).toEqual([]);
    expect(buildDefaultMatrix(catalog([{ code: "A", counts: {} }]), 20)).toEqual([]);
  });

  it("đề kiểm tra dài hơn phiếu bài tập", () => {
    expect(DEFAULT_TOTAL.exam).toBeGreaterThan(DEFAULT_TOTAL.worksheet);
  });
});
