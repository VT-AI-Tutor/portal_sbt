import { describe, expect, it } from "vitest";
import {
  buildLevelInsights, computeConclusion, computeComment,
  measurableComponents, remainingToScore, sampleStatus, wilsonInterval,
  SCORE_MIN_ATTEMPTS,
} from "./insights";

function lvl(code: string, rank: number, attempted: number, correct: number) {
  return { code, label: LABELS[code], rank, attempted, correct,
    percent: attempted > 0 ? Math.round((correct / attempted) * 1000) / 10 : 0 };
}
const LABELS: Record<string, string> = {
  biet: "Nhận biết", hieu: "Thông hiểu", vandung: "Vận dụng", vandungcao: "Vận dụng cao",
};

describe("sampleStatus", () => {
  it("phân bậc đúng biên 0/1/2/3/7/8/19/20", () => {
    expect(sampleStatus(0)).toBe("none");
    expect(sampleStatus(1)).toBe("locked");
    expect(sampleStatus(2)).toBe("locked");
    expect(sampleStatus(3)).toBe("provisional");
    expect(sampleStatus(7)).toBe("provisional");
    expect(sampleStatus(8)).toBe("solid");
    expect(sampleStatus(19)).toBe("solid");
    expect(sampleStatus(20)).toBe("confident");
  });
  it("remainingToScore", () => {
    expect(remainingToScore(0)).toBe(3);
    expect(remainingToScore(2)).toBe(1);
    expect(remainingToScore(5)).toBe(0);
  });
});

describe("measurableComponents (finding #2 review 2026-08-07)", () => {
  const c = (attempted: number, question_available: number) => ({ attempted, question_available });
  it("hết câu trong bank VÀ chưa có điểm thật -> bị loại (không áp dụng, không phải việc cần làm)", () => {
    const out = measurableComponents([c(0, 0), c(1, 0), c(SCORE_MIN_ATTEMPTS - 1, 0)]);
    expect(out).toEqual([]);
  });
  it("hết câu trong bank NHƯNG đã có điểm thật (đủ SCORE_MIN_ATTEMPTS) -> vẫn giữ", () => {
    const scored = c(SCORE_MIN_ATTEMPTS, 0);
    expect(measurableComponents([scored])).toEqual([scored]);
  });
  it("còn câu trong bank -> luôn giữ dù chưa luyện gì", () => {
    const untouched = c(0, 10);
    expect(measurableComponents([untouched])).toEqual([untouched]);
  });
});

describe("wilsonInterval", () => {
  it("hẹp dần khi n tăng", () => {
    const small = wilsonInterval(3, 5);
    const big = wilsonInterval(30, 50);
    expect(big.hi - big.lo).toBeLessThan(small.hi - small.lo);
  });
  it("nằm trong [0,100]", () => {
    const { lo, hi } = wilsonInterval(0, 3);
    expect(lo).toBeGreaterThanOrEqual(0);
    expect(hi).toBeLessThanOrEqual(100);
  });
});

describe("buildLevelInsights — bất thường gắn nhãn", () => {
  it("mức cao hơn mức thấp ≥20 điểm (cả hai có điểm) -> anomalous", () => {
    const out = buildLevelInsights([lvl("biet", 1, 10, 5) /*50%*/, lvl("hieu", 2, 10, 8) /*80%*/]);
    expect(out.find((l) => l.code === "hieu")!.anomalous).toBe(true);
    expect(out.find((l) => l.code === "biet")!.anomalous).toBe(false);
  });
  it("chênh dưới 20 hoặc mức trên chưa đủ bài -> không anomalous", () => {
    const a = buildLevelInsights([lvl("biet", 1, 10, 6), lvl("hieu", 2, 10, 7)]);
    expect(a.every((l) => !l.anomalous)).toBe(true);
    const b = buildLevelInsights([lvl("biet", 1, 10, 5), lvl("hieu", 2, 2, 2)]);
    expect(b.every((l) => !l.anomalous)).toBe(true);
  });
});

describe("computeConclusion", () => {
  const c = (ls: ReturnType<typeof lvl>[]) => computeConclusion(buildLevelInsights(ls));
  it("chưa làm bài nào -> empty", () => {
    expect(c([lvl("biet", 1, 0, 0), lvl("hieu", 2, 0, 0)]).kind).toBe("empty");
  });
  it("vững NB (>=60, >=3 câu), hụt TH -> break", () => {
    const r = c([lvl("biet", 1, 10, 8), lvl("hieu", 2, 10, 4)]);
    expect(r).toMatchObject({ kind: "break", masteredLabel: "Nhận biết", breakLabel: "Thông hiểu" });
  });
  it("hụt ngay mức đầu -> from_start", () => {
    expect(c([lvl("biet", 1, 10, 4), lvl("hieu", 2, 5, 4)]).kind).toBe("from_start");
  });
  it("vững hết các mức có điểm, mức trên chưa đủ bài -> insufficient kèm remaining", () => {
    const r = c([lvl("biet", 1, 10, 8), lvl("hieu", 2, 1, 1)]);
    expect(r).toMatchObject({ kind: "insufficient", masteredLabel: "Nhận biết", unscoredLabel: "Thông hiểu", remaining: 2 });
  });
  it("vững tất cả -> all_mastered", () => {
    expect(c([lvl("biet", 1, 10, 8), lvl("hieu", 2, 10, 7)]).kind).toBe("all_mastered");
  });
  it("mức anomalous bị bỏ qua khi kết luận", () => {
    // hieu 90% nhưng biet 50% -> hieu anomalous -> kết luận nói về biet (from_start)
    const r = c([lvl("biet", 1, 10, 5), lvl("hieu", 2, 10, 9)]);
    expect(r.kind).toBe("from_start");
  });
});

describe("computeComment", () => {
  const mk = (
    ls: ReturnType<typeof lvl>[],
    topics: { content_code: string; label: string; percent: number; attempted: number }[] = [],
    targetPercent = 75,
  ) => {
    const ins = buildLevelInsights(ls);
    return computeComment(ins, topics, computeConclusion(ins), targetPercent);
  };
  it("tổng câu < 8 -> điều kiện hoá + action general, không nêu mức yếu", () => {
    const r = mk([lvl("biet", 1, 3, 2), lvl("hieu", 2, 3, 1)])!;
    expect(r.text).toContain("Dựa trên 6 câu");
    expect(r.action.kind).toBe("general");
    expect(r.text).not.toContain("yếu nhất");
  });
  it("break -> nói điểm gãy + action level đúng mã", () => {
    const r = mk([lvl("biet", 1, 10, 8), lvl("hieu", 2, 10, 4)])!;
    expect(r.text).toContain("Nhận biết");
    expect(r.text).toContain("Thông hiểu");
    expect(r.action).toMatchObject({ kind: "level", levelCode: "hieu" });
  });
  it("tối đa 2 câu", () => {
    const r = mk([lvl("biet", 1, 10, 8), lvl("hieu", 2, 10, 4)])!;
    expect(r.text.split(/(?<=[.!?])\s+/).length).toBeLessThanOrEqual(2);
  });
  it("hai mức bằng điểm (chênh <8) -> không tuyên bố mức nào yếu hơn", () => {
    // cả hai dưới mốc, chênh 5 điểm -> from_start nói mức ĐẦU thang, không so sánh hơn kém
    const r = mk([lvl("biet", 1, 10, 5), lvl("hieu", 2, 10, 5)])!;
    expect(r.text).not.toMatch(/yếu nhất|kém nhất/);
  });
  it("all_mastered + chủ đề yếu rõ rệt (cách ≥8) -> action topic", () => {
    const topics = [
      { content_code: "C1", label: "Phân số", percent: 55, attempted: 10 },
      { content_code: "C2", label: "Hình học", percent: 80, attempted: 10 },
    ];
    const r = mk([lvl("biet", 1, 10, 9), lvl("hieu", 2, 10, 8)], topics)!;
    expect(r.action).toMatchObject({ kind: "topic", contentCode: "C1" });
  });
  it("mốc chủ đề yếu ĂN THEO targetPercent của radar, không đóng cứng 75 (finding #4)", () => {
    // 78% dưới target 80 -> radar vẽ topic này DƯỚI nét đứt mục tiêu; câu
    // nhận xét phải nói tới nó (từng bị bỏ sót vì so với literal 75 cũ).
    const topics = [{ content_code: "C1", label: "Phân số", percent: 78, attempted: 10 }];
    const r78at80 = mk([lvl("biet", 1, 10, 9), lvl("hieu", 2, 10, 8)], topics, 80)!;
    expect(r78at80.action).toMatchObject({ kind: "topic", contentCode: "C1" });
    // Cùng dữ liệu nhưng target thấp hơn percent -> KHÔNG còn "yếu" theo mục tiêu đó.
    const r78at70 = mk([lvl("biet", 1, 10, 9), lvl("hieu", 2, 10, 8)], topics, 70)!;
    expect(r78at70.action.kind).not.toBe("topic");
  });
  it("empty -> null", () => {
    expect(mk([lvl("biet", 1, 0, 0)])).toBeNull();
  });

  it("from_start dựa trên mức mẫu ít (provisional) -> điều kiện hoá", () => {
    // biet: 5 câu (provisional, 3-7), 40% -> from_start; hieu 10 câu 80% (anomalous, bị loại khỏi kết luận)
    const r = mk([lvl("biet", 1, 5, 2), lvl("hieu", 2, 10, 8)])!;
    expect(r.text).toContain("Dựa trên số ít câu em đã làm");
    expect(r.text.split(/(?<=[.!?])\s+/).length).toBeLessThanOrEqual(2);
  });
  it("from_start dựa trên mức mẫu đủ (>=8 câu) -> không điều kiện hoá", () => {
    const r = mk([lvl("biet", 1, 10, 4), lvl("hieu", 2, 10, 4)])!;
    expect(r.text).not.toContain("Dựa trên số ít câu em đã làm");
  });
  it("insufficient dựa trên mức đã vững nhưng mẫu ít (provisional) -> điều kiện hoá", () => {
    // biet: 6 câu (provisional), 83% -> vững; hieu: 2 câu -> chưa đủ mẫu
    const r = mk([lvl("biet", 1, 6, 5), lvl("hieu", 2, 2, 2)])!;
    expect(r.text).toContain("Dựa trên số ít câu em đã làm");
    expect(r.text.split(/(?<=[.!?])\s+/).length).toBeLessThanOrEqual(2);
  });
  it("insufficient dựa trên mức đã vững với mẫu đủ (>=8 câu) -> không điều kiện hoá", () => {
    const r = mk([lvl("biet", 1, 10, 8), lvl("hieu", 2, 1, 1)])!;
    expect(r.text).not.toContain("Dựa trên số ít câu em đã làm");
  });
});
