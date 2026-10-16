import { describe, expect, it } from "vitest";
import { matchingColumnLabelShape } from "./MatchingColumnLabel";
import type { RichContent } from "@/core/question-schema";
import { reservedChainLabelShape } from "./ChainMatchPlayer";

/**
 * Luật chừa chỗ cho hàng nhãn của nối chuỗi, tách khỏi player để test thẳng.
 * File chỉ có ở repo này (luật web-own) nên bước copy từ studio không đè.
 */
describe("matchingColumnLabelShape", () => {
  it("không khai gì ⇒ none", () => {
    expect(matchingColumnLabelShape(undefined, undefined, "blue")).toBe("none");
  });

  it("nhãn 1–2 ký tự + có tông ⇒ badge", () => {
    expect(matchingColumnLabelShape("A", undefined, "blue")).toBe("badge");
    expect(matchingColumnLabelShape("10", undefined, "blue")).toBe("badge");
  });

  it("không có tông thì nhãn ngắn vẫn là chữ", () => {
    expect(matchingColumnLabelShape("A", undefined, undefined)).toBe("text");
  });

  it("nhãn dài ⇒ text", () => {
    expect(matchingColumnLabelShape("Việc nên làm", undefined, "blue")).toBe("text");
  });

  /** Ca từng lọt: rich rỗng phải rơi về `title`, y như thân component. */
  it("titleContent rỗng ⇒ đọc theo title", () => {
    const empty: RichContent = { blocks: [{ type: "paragraph", content: [] }] };
    expect(matchingColumnLabelShape("A", empty, "blue")).toBe("badge");
  });

  it("titleContent có chữ thì thắng title", () => {
    const rich: RichContent = {
      blocks: [{ type: "paragraph", content: [{ text: "Việc nên làm", annotations: {} }] }],
    };
    expect(matchingColumnLabelShape("A", rich, "blue")).toBe("text");
  });
});

describe("reservedChainLabelShape", () => {
  it("cả ba cột trống ⇒ không chừa chỗ", () => {
    expect(reservedChainLabelShape(["none", "none", "none"])).toBeNull();
  });

  it("có huy hiệu ⇒ chừa cỡ huy hiệu, kể cả khi cột khác là chữ", () => {
    expect(reservedChainLabelShape(["none", "badge", "text"])).toBe("badge");
  });

  it("chỉ có nhãn chữ ⇒ chừa một dòng chữ", () => {
    expect(reservedChainLabelShape(["none", "text", "none"])).toBe("text");
  });
});
