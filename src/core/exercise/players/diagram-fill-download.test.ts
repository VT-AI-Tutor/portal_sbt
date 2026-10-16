import { describe, it, expect } from "vitest";
import {
  answerImageFileName,
  diagramFillCellRect,
  layoutCellText,
  MIN_FONT_SIZE,
  paintAnswers,
  type MeasureText,
} from "./diagram-fill-download";

/** Mỗi ký tự rộng đúng nửa cỡ chữ — đủ để khoá luật xuống dòng / co cỡ. */
const measure: MeasureText = (text, fontSize) => text.length * fontSize * 0.5;

describe("diagramFillCellRect", () => {
  it("đọc x/y là TÂM ô, không phải góc trên trái", () => {
    // Player đặt node bằng left/top % kèm -translate-x-1/2 -translate-y-1/2.
    const rect = diagramFillCellRect({ id: "a", x: 0.5, y: 0.5, width: 0.1, height: 0.2 }, 1000, 500);
    expect(rect).toEqual({ x: 450, y: 200, width: 100, height: 100 });
  });

  it("nhận cả quy ước cũ x/y theo phần trăm 0..100", () => {
    const normalized = diagramFillCellRect({ id: "a", x: 0.25, y: 0.6, width: 0.09, height: 0.11 }, 2023, 1349);
    const legacy = diagramFillCellRect({ id: "a", x: 25, y: 60, width: 0.09, height: 0.11 }, 2023, 1349);
    expect(legacy).toEqual(normalized);
  });

  it("thiếu toạ độ thì bỏ qua node thay vì vẽ vào góc ảnh", () => {
    expect(diagramFillCellRect({ id: "a" }, 100, 100)).toBeNull();
    expect(diagramFillCellRect({ id: "a", x: 0.5 }, 100, 100)).toBeNull();
    // Ngoài 0..100 thì không phải tỉ lệ mà cũng không phải phần trăm.
    expect(diagramFillCellRect({ id: "a", x: 0.5, y: 250 }, 100, 100)).toBeNull();
  });

  it("giá trị >1 luôn hiểu là phần trăm, kể cả khi nhỏ", () => {
    // 2.5 là 2.5% chứ không phải toạ độ hỏng — giống hệt coordinatePercent.
    const rect = diagramFillCellRect({ id: "a", x: 50, y: 2.5, width: 0.1, height: 0.1 }, 1000, 1000);
    expect(rect).toMatchObject({ y: 25 - 50 });
  });

  it("không khai width/height thì dùng mặc định của player", () => {
    const rect = diagramFillCellRect({ id: "a", x: 0.5, y: 0.5 }, 1000, 1000);
    expect(rect).toMatchObject({ width: 200, height: 80 });
  });

  it("ô bé hơn sàn kẹp vẫn đủ chỗ đặt chữ", () => {
    const rect = diagramFillCellRect({ id: "a", x: 0.5, y: 0.5, width: 0.001, height: 0.001 }, 1000, 1000);
    expect(rect).toMatchObject({ width: 30, height: 20 });
  });
});

describe("layoutCellText", () => {
  const cell = { x: 0, y: 0, width: 200, height: 100 };

  it("ô trống không sinh dòng nào", () => {
    expect(layoutCellText("", cell, measure)).toBeNull();
    expect(layoutCellText("   ", cell, measure)).toBeNull();
  });

  it("chữ ngắn giữ nguyên một dòng ở cỡ to nhất", () => {
    const layout = layoutCellText("Ngủ dậy", cell, measure)!;
    expect(layout.lines).toEqual(["Ngủ dậy"]);
    expect(layout.fontSize).toBe(30); // height 100 × MAX_FONT_RATIO
  });

  it("chữ dài tự xuống dòng thay vì bị cắt như trên màn hình", () => {
    const layout = layoutCellText("Ăn sáng rồi đi học sớm", cell, measure)!;
    expect(layout.lines.length).toBeGreaterThan(1);
    expect(layout.lines.join(" ")).toBe("Ăn sáng rồi đi học sớm");
  });

  it("càng dài thì cỡ chữ càng co lại cho vừa ô", () => {
    const ngan = layoutCellText("Ngủ", cell, measure)!;
    const dai = layoutCellText("Đá bóng cùng các bạn trong xóm mỗi buổi chiều", cell, measure)!;
    expect(dai.fontSize).toBeLessThan(ngan.fontSize);
  });

  it("một từ dài hơn cả ô thì cắt nhỏ chứ không tràn ra ngoài", () => {
    const layout = layoutCellText("Praha-Bratislava-Budapest", { x: 0, y: 0, width: 60, height: 40 }, measure)!;
    expect(layout.lines.length).toBeGreaterThan(1);
    expect(layout.lines.join("")).toBe("Praha-Bratislava-Budapest");
  });

  it("dài quá mức vẫn in ra, chỉ là ở cỡ nhỏ nhất — không bỏ trắng bài làm", () => {
    const layout = layoutCellText("x".repeat(400), { x: 0, y: 0, width: 40, height: 20 }, measure)!;
    expect(layout.fontSize).toBe(MIN_FONT_SIZE);
    expect(layout.lines.length).toBeGreaterThan(0);
  });
});

describe("paintAnswers", () => {
  /**
   * jsdom không có canvas thật, nhưng `paintAnswers` chỉ cần một context biết
   * đo chữ và ghi lại lệnh vẽ — đủ để khoá phần hay hỏng nhất: vẽ ô NÀO.
   */
  const fakeCtx = () => {
    const drawn: { text: string; x: number; y: number }[] = [];
    const ctx = {
      font: "",
      fillStyle: "",
      textAlign: "" as CanvasTextAlign,
      textBaseline: "" as CanvasTextBaseline,
      measureText: (text: string) => ({ width: text.length * 8 }),
      fillText: (text: string, x: number, y: number) => drawn.push({ text, x, y }),
    };
    return { ctx: ctx as unknown as CanvasRenderingContext2D, drawn };
  };

  const O = (id: string, x: number, y: number) => ({ id, x, y, width: 0.2, height: 0.2 });

  it("chỉ vẽ ô có đáp án, bỏ qua ô trống và ô không có toạ độ", () => {
    const { ctx, drawn } = fakeCtx();
    paintAnswers(
      ctx,
      [O("a", 0.25, 0.5), O("b", 0.75, 0.5), { id: "khong_toa_do" }],
      { a: "Ngủ dậy", b: "   ", khong_toa_do: "Lạc chỗ" },
      1000,
      1000,
    );
    expect(drawn.map((d) => d.text)).toEqual(["Ngủ dậy"]);
  });

  it("vẽ vào TÂM ô đúng theo toạ độ node", () => {
    const { ctx, drawn } = fakeCtx();
    paintAnswers(ctx, [O("a", 0.25, 0.5)], { a: "Ngủ" }, 1000, 1000);
    expect(drawn[0].x).toBe(250);
    expect(drawn[0].y).toBe(500);
  });

  it("KHÔNG vẽ node lạ — người gọi phải lọc fillable trước", () => {
    // Bài đã lưu có thể còn khoá của node nay là nhãn tĩnh. Hợp đồng là người
    // gọi truyền vào node điền được; ca này khoá đúng hợp đồng đó.
    const { ctx, drawn } = fakeCtx();
    paintAnswers(ctx, [O("a", 0.25, 0.5)], { a: "Ngủ", nhan_tinh: "Chữ cũ" }, 1000, 1000);
    expect(drawn.map((d) => d.text)).toEqual(["Ngủ"]);
  });
});

describe("answerImageFileName", () => {
  it("bỏ dấu tiếng Việt để mọi hệ điều hành mở được", () => {
    expect(answerImageFileName("Thời gian biểu của em")).toBe("thoi-gian-bieu-cua-em.png");
  });

  it("tiêu đề dài bị cắt nhưng không để lại gạch nối cuối tên", () => {
    const name = answerImageFileName("Em hãy lập thời gian biểu của mình theo mẫu gợi ý sau đây nhé");
    expect(name.endsWith("-.png")).toBe(false);
    expect(name.endsWith(".png")).toBe(true);
  });

  it("tiêu đề rỗng vẫn ra tên dùng được", () => {
    expect(answerImageFileName(undefined)).toBe("bai-lam.png");
    expect(answerImageFileName("!!!")).toBe("bai-lam.png");
  });
});
