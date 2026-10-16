import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { RichContentBlock } from "@/core/question-schema";
import { RichContentBlocks } from "./shared";

/**
 * WEB13 — a `content.blocks` table whose `headers` are the question-schema
 * column objects `{ id, label }` rendered its header row as EMPTY cells, so the
 * columns were unlabelled (VBT Toán 1 T2 Bài 17 Câu 3/Câu 6, Toán 3 T1 Bài 33
 * Câu 1, Toán 4 T1 Bài 33 Câu 8 — Câu 6 was unanswerable without the weekday
 * names). The block type says `headers?: string[]`, real payloads say otherwise.
 */
describe("RichContentBlocks table headers", () => {
  const render = (block: RichContentBlock) =>
    renderToString(<RichContentBlocks blocks={[block]} />);

  it("renders object headers by their label (Bài 17 Câu 3 shape)", () => {
    const html = render({
      type: "table",
      headers: [
        { id: "col_1", label: "Ngày" },
        { id: "col_2", label: "Buổi sáng" },
        { id: "col_3", label: "Buổi chiều" },
      ],
      rows: [["Thứ Hai", "2", "3"]],
    } as unknown as RichContentBlock);

    expect(html).toContain("Ngày");
    expect(html).toContain("Buổi sáng");
    expect(html).toContain("Buổi chiều");
    // No blank header cell left behind.
    expect(html).not.toMatch(/<th[^>]*>\s*<span[^>]*>\s*<\/span>\s*<\/th>/);
  });

  it("still renders plain string headers unchanged (Bài 15 shape)", () => {
    const html = render({
      type: "table",
      headers: ["Ngày", "Buổi sáng"],
      rows: [["Thứ Hai", "2"]],
    } as unknown as RichContentBlock);

    expect(html).toContain("Ngày");
    expect(html).toContain("Buổi sáng");
  });

  it("accepts the alternate label keys and canonical runs", () => {
    const html = render({
      type: "table",
      headers: [
        { id: "a", title: "Thành phố" },
        { id: "b", name: "Hà Nội" },
        { id: "c", label: [{ text: "Oulu", annotations: { bold: true } }] },
        { id: "d", text: "Sydney" },
      ],
      rows: [["1", "2", "3", "4"]],
    } as unknown as RichContentBlock);

    expect(html).toContain("Thành phố");
    expect(html).toContain("Hà Nội");
    expect(html).toContain("<strong>Oulu</strong>");
    expect(html).toContain("Sydney");
  });

  it("drops the header layer entirely when every label is blank", () => {
    const html = render({
      type: "table",
      headers: [{ id: "col_1" }, { id: "col_2" }],
      rows: [["a", "b"]],
    } as unknown as RichContentBlock);

    // A row of empty <th> is the bug; no <thead> at all is the correct output.
    expect(html).not.toContain("<thead");
    expect(html).toContain("<tbody");
  });

  it("resolves object CELLS too, instead of blanking them", () => {
    const html = render({
      type: "table",
      headers: ["Loại phương tiện", "Số lượng"],
      rows: [[{ text: "Xe đạp" }, { label: "12" }]],
    } as unknown as RichContentBlock);

    expect(html).toContain("Xe đạp");
    expect(html).toContain("12");
  });

  it("never leaks [object Object]", () => {
    const html = render({
      type: "table",
      headers: [{ id: "col_1", label: "Thứ" }],
      rows: [[{ unexpected: true }]],
    } as unknown as RichContentBlock);

    expect(html).not.toContain("[object Object]");
  });
});
