/**
 * SBT-73 — lời idle của mascot giữ định dạng gợi ý người soạn (nghiêng, đậm…).
 * Trước đây `hint` bị ghép thành chuỗi trơn nên vần *ăc, âc* mất chữ nghiêng.
 */
import { describe, expect, it } from "vitest";
import { mascotIdleMessage, mascotInstruction } from "./mascotInstruction";

/** Đúng `hint` của b33_i3_q2 (VBT Tiếng Việt 2). */
const b33Hint = {
  blocks: [
    {
      type: "paragraph",
      content: [
        { text: "Em quan sát từng hình rồi tìm từ ngữ có tiếng chứa một trong các vần ", annotations: {} },
        { text: "ăc", annotations: { italic: true } },
        { text: ", ", annotations: {} },
        { text: "âc", annotations: { italic: true } },
        { text: ", ", annotations: {} },
        { text: "ăt ", annotations: { italic: true } },
        { text: "hoặc ", annotations: {} },
        { text: "ât ", annotations: { italic: true } },
        { text: "để điền vào ô trống dưới mỗi hình nhé!", annotations: {} },
      ],
    },
  ],
};

describe("mascotIdleMessage", () => {
  it("gợi ý có chữ nghiêng → trả các run, giữ đúng run nào nghiêng", () => {
    const message = mascotIdleMessage("question_group", { hint: b33Hint });
    expect(Array.isArray(message)).toBe(true);
    const runs = message as Exclude<typeof message, string>;
    expect(runs.filter((r) => r.annotations.italic).map((r) => r.text)).toEqual(["ăc", "âc", "ăt ", "ât "]);
    // Chữ ghép lại y hệt bản chuỗi trơn — chỉ thêm định dạng, không đổi câu chữ.
    expect(runs.map((r) => r.text).join("")).toBe(mascotInstruction("question_group", { hint: b33Hint }));
  });

  it("gợi ý chữ trơn → vẫn là CHUỖI như trước, không đổi một ký tự", () => {
    const payload = {
      hint: { blocks: [{ type: "paragraph", content: [{ text: "Em chọn câu đúng nhé!", annotations: {} }] }] },
    };
    expect(mascotIdleMessage("multiple_choice", payload)).toBe("Em chọn câu đúng nhé!");
  });

  it("không có gợi ý → lời nhắc theo interaction như cũ", () => {
    const payload = { display: { interactionType: "word_bank" }, hint: { blocks: [] } };
    expect(mascotIdleMessage("cloze", payload)).toBe(mascotInstruction("cloze", payload));
    expect(mascotIdleMessage("cloze", payload)).toBe("Kéo từ trong hộp từ vào chỗ trống nhé!");
  });

  it("nhiều block → nối bằng một dấu cách, cắt khoảng trắng hai đầu mỗi block", () => {
    const message = mascotIdleMessage("cloze", {
      hint: {
        blocks: [
          { type: "paragraph", content: [{ text: "  Đọc kĩ ", annotations: {} }, { text: "đề", annotations: { bold: true } }, { text: "  ", annotations: {} }] },
          { type: "paragraph", content: [{ text: "rồi làm nhé!", annotations: {} }] },
        ],
      },
    }) as Exclude<ReturnType<typeof mascotIdleMessage>, string>;
    expect(message.map((r) => r.text).join("")).toBe("Đọc kĩ đề rồi làm nhé!");
    expect(message.find((r) => r.text === "đề")?.annotations.bold).toBe(true);
  });

  it("annotations thiếu / sai kiểu từ kho schemaless → coi như không định dạng", () => {
    const payload = {
      hint: { blocks: [{ type: "paragraph", content: [{ text: "Viết " }, { text: "câu", annotations: "italic" }, { text: " nhé!", annotations: null }] }] },
    };
    expect(mascotIdleMessage("essay", payload)).toBe("Viết câu nhé!");
  });

  it("hint chuỗi của hangman không bị mascot nói lại", () => {
    expect(mascotIdleMessage("hangman", { hint: "Thủ đô của Việt Nam" })).toBe(
      mascotInstruction("hangman", { hint: "Thủ đô của Việt Nam" }),
    );
  });

  it("gợi ý HTML cũ (block chỉ có `text`) → giữ nghiêng/đậm, giải mã entity", () => {
    const payload = {
      hint: {
        blocks: [
          { type: "paragraph", text: "Tìm vần <em>ăc</em>,&nbsp;<strong>âc</strong> &amp; <i>ăt</i>, <b>ât</b> nhé!" },
        ],
      },
    };
    const message = mascotIdleMessage("question_group", payload);
    expect(Array.isArray(message)).toBe(true);
    const runs = message as Exclude<typeof message, string>;
    expect(runs.map((r) => r.text).join("")).toBe("Tìm vần ăc, âc & ăt, ât nhé!");
    expect(runs.filter((r) => r.annotations.italic).map((r) => r.text)).toEqual(["ăc", "ăt"]);
    expect(runs.filter((r) => r.annotations.bold).map((r) => r.text)).toEqual(["âc", "ât"]);
    expect(mascotInstruction("question_group", payload)).toBe("Tìm vần ăc, âc & ăt, ât nhé!");
  });

  it("gợi ý HTML cũ không định dạng → chuỗi đã bỏ thẻ và giải mã entity", () => {
    const payload = { hint: { blocks: [{ type: "paragraph", text: "<p>Đọc &quot;kĩ&quot;&nbsp;đề</p>" }] } };
    expect(mascotIdleMessage("essay", payload)).toBe("Đọc \"kĩ\" đề");
  });

  it("annotations chỉ nhận giá trị thật: chuỗi \"false\", màu default, code, link không làm thành định dạng", () => {
    const hint = (annotations: unknown) => ({
      hint: { blocks: [{ type: "paragraph", content: [{ text: "Viết ", annotations: {} }, { text: "câu", annotations }] }] },
    });
    for (const annotations of [
      { italic: "false" },
      { bold: "true" },
      { color: "default" },
      { color: "" },
      { code: true },
      { link: { href: "https://evovi.vn" } },
    ]) {
      expect(mascotIdleMessage("essay", hint(annotations)), JSON.stringify(annotations)).toBe("Viết câu");
    }
    const colored = mascotIdleMessage("essay", hint({ color: "rgb(236, 1, 140)", italic: "false" }));
    expect(Array.isArray(colored)).toBe(true);
    const run = (colored as Exclude<typeof colored, string>).find((r) => r.text === "câu");
    expect(run?.annotations).toEqual({ color: "rgb(236, 1, 140)" });
  });
});
