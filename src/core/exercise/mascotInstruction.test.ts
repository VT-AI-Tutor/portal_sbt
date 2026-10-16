import { describe, expect, it } from "vitest";
import {
  mascotInstruction,
  MASCOT_FALLBACK_INSTRUCTION,
} from "./mascotInstruction";
import { PLAYER_MANIFEST } from "./players/manifest";

describe("mascotInstruction", () => {
  it("phủ đủ mọi cặp (type × interaction) và alias của manifest", () => {
    const pairs = PLAYER_MANIFEST.flatMap((entry) =>
      [entry.interactionType, ...(entry.aliases ?? [])].map((interactionType) => ({
        type: entry.type,
        interactionType,
      })),
    );
    const missing = pairs
      .filter(
        ({ type, interactionType }) =>
          mascotInstruction(type, { display: { interactionType } }) ===
          MASCOT_FALLBACK_INSTRUCTION,
      )
      .map(({ type, interactionType }) => `${type}:${interactionType}`);
    expect(missing).toEqual([]);
  });

  it("lời nhắc mặc định của mỗi type = defaultInteraction của manifest", () => {
    const wrong = PLAYER_MANIFEST.filter(
      (entry) =>
        entry.default &&
        mascotInstruction(entry.type) !==
          mascotInstruction(entry.type, {
            display: { interactionType: entry.interactionType },
          }),
    ).map((entry) => `${entry.type}:${entry.interactionType}`);
    expect(wrong).toEqual([]);
  });

  it("nói theo thao tác thật của từng interaction, không theo vở giấy", () => {
    // radio là chạm chọn — chỉ interaction `circle` mới thật sự khoanh tròn.
    expect(mascotInstruction("single_choice")).toBe("Chọn đáp án đúng nhé!");
    expect(
      mascotInstruction("single_choice", { display: { interactionType: "circle" } }),
    ).toBe("Khoanh tròn vào đáp án đúng nhé!");
    expect(
      mascotInstruction("single_choice", { display: { interactionType: "color_fill" } }),
    ).toBe("Tô màu ô có đáp án đúng nhé!");
    // true_false là bấm nút Đúng/Sai trên máy, không phải "ghi Đ/S vào ô trống".
    expect(mascotInstruction("true_false")).toBe("Chọn Đúng hoặc Sai nhé!");
    expect(
      mascotInstruction("true_false", { display: { interactionType: "yes_no" } }),
    ).toBe("Chọn Có hoặc Không nhé!");
    // essay là viết câu trả lời, không phải tập viết / luyện viết chữ.
    expect(mascotInstruction("essay")).toBe("Viết câu trả lời của em nhé!");
    expect(mascotInstruction("drawing")).toBe("Vẽ bài của em nào!");
  });

  it("chọn đúng interaction khi payload dùng alias/layout cũ", () => {
    expect(
      mascotInstruction("single_choice", { layout: "image-grid" }),
    ).toBe("Chọn hình đúng nhé!");
    expect(
      mascotInstruction("matching", { display: { layout: "row" } }),
    ).toBe("Nối ý ở hàng trên với ý phù hợp ở hàng dưới nhé!");
  });

  it("ánh xạ type legacy sang cặp tương ứng", () => {
    expect(mascotInstruction("short_answer")).toBe("Viết câu trả lời ngắn của em nhé!");
    expect(mascotInstruction("free_draw")).toBe("Vẽ bài của em nào!");
  });

  it("ưu tiên gợi ý người soạn viết trong payload", () => {
    expect(
      mascotInstruction("matching", {
        display: { interactionType: "radial" },
        hint: {
          blocks: [
            {
              type: "paragraph",
              content: [{ text: "Đọc kĩ ô ở giữa ", annotations: {} }, { text: "trước nhé!" }],
            },
          ],
        },
      }),
    ).toBe("Đọc kĩ ô ở giữa trước nhé!");
    // Block chỉ có `text` là dạng của toàn bộ fixture trong repo, và `text` được
    // phần còn lại của app coi là HTML cũ nên phải bỏ thẻ.
    expect(
      mascotInstruction("fill_blank", {
        hint: { blocks: [{ type: "paragraph", text: "Tìm từ <b>tả tiếng cười</b> nhé!" }] },
      }),
    ).toBe("Tìm từ tả tiếng cười nhé!");
    // hangman dùng `hint` chuỗi làm gợi ý của trò chơi, player đã in rồi.
    expect(mascotInstruction("hangman", { hint: "Thủ đô của Việt Nam" })).toBe(
      "Đoán từng chữ cái để tìm ra từ nhé!",
    );
    // hint rỗng (dữ liệu API luôn có khoá này) không được nuốt lời nhắc theo interaction.
    expect(
      mascotInstruction("matching", {
        display: { interactionType: "radial" },
        hint: { blocks: [] },
      }),
    ).toBe("Nối các ý xung quanh với ý ở giữa nhé!");
  });

  it("trả lời nhắc chung khi type lạ hoặc trống", () => {
    expect(mascotInstruction(undefined)).toBe(MASCOT_FALLBACK_INSTRUCTION);
    expect(mascotInstruction("khong_ton_tai")).toBe(MASCOT_FALLBACK_INSTRUCTION);
  });
});
