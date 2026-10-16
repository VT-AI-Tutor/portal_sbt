import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderInteractionPlayer } from "./dispatch";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("renderer fidelity regressions", () => {
  it.each(["fill_blank", "cloze"])("keeps rich-text runs around a blank for %s", (type) => {
    act(() => {
      root.render(
        renderInteractionPlayer(type, {
          content: {
            blocks: [{
              type: "paragraph",
              content: [
                { text: "0,25 ", annotations: {} },
                { text: "l", annotations: { italic: true } },
                { text: " = ", annotations: {} },
                { text: "{blank_1}", annotations: {} },
                { text: " ml", annotations: {} },
              ],
            }],
          },
          correctAnswer: { blank_1: ["250"] },
        }, {}),
      );
    });

    expect(container.querySelector("em")?.textContent).toBe("l");
    expect(container.querySelector('input[type="text"]')).not.toBeNull();
    expect(container.textContent).not.toContain("{blank_1}");
  });

  it("renders player rich-content audio, lists, and legacy line breaks", () => {
    act(() => {
      root.render(
        renderInteractionPlayer("essay", {
          content: {
            blocks: [
              { type: "paragraph", text: "Dòng một\nDòng hai" },
              { type: "list", items: ["Ý một", "Ý hai"] },
              { type: "audio", url: "/uploads/audio/question.mp3" },
            ],
          },
        }, {}),
      );
    });

    expect(container.textContent).toContain("Dòng một");
    expect(container.textContent).toContain("Dòng hai");
    expect(container.querySelectorAll("li")).toHaveLength(2);
    expect(container.querySelector("audio")).not.toBeNull();
  });

  it("enforces tickGroups per row without affecting independent groups or rows", () => {
    const onAnswerChange = vi.fn();
    const payload = {
      selfAssessment: true,
      table: {
        headers: [
          { id: "safe", label: "An toàn" },
          { id: "unsafe", label: "Không an toàn" },
          { id: "good", label: "Tốt" },
          { id: "bad", label: "Chưa tốt" },
        ],
        tickGroups: [["safe", "unsafe"], ["good", "bad"]],
        rows: [
          { id: "row-1", cells: [
            { columnId: "safe", cellType: "tick" },
            { columnId: "unsafe", cellType: "tick" },
            { columnId: "good", cellType: "tick" },
            { columnId: "bad", cellType: "tick" },
          ] },
          { id: "row-2", cells: [
            { columnId: "safe", cellType: "tick" },
            { columnId: "unsafe", cellType: "tick" },
            { columnId: "good", cellType: "tick" },
            { columnId: "bad", cellType: "tick" },
          ] },
        ],
      },
    };

    act(() => root.render(renderInteractionPlayer("table_completion", payload, { onAnswerChange })));
    const checkbox = (label: string) => container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;

    act(() => checkbox("row-1 safe").click());
    act(() => checkbox("row-1 good").click());
    expect(checkbox("row-1 safe").checked).toBe(true);
    expect(checkbox("row-1 good").checked).toBe(true);

    act(() => checkbox("row-1 unsafe").click());
    expect(checkbox("row-1 safe").checked).toBe(false);
    expect(checkbox("row-1 unsafe").checked).toBe(true);
    expect(checkbox("row-1 good").checked).toBe(true);
    expect(onAnswerChange).toHaveBeenLastCalledWith(expect.objectContaining({
      "row-1__safe": "false",
      "row-1__unsafe": "true",
      "row-1__good": "true",
    }));

    act(() => checkbox("row-2 safe").click());
    expect(checkbox("row-1 unsafe").checked).toBe(true);
    expect(checkbox("row-2 safe").checked).toBe(true);
  });
  it("uses top-level Đúng/Sai labels authored on a flat multi_true_false payload", () => {
    act(() =>
      root.render(
        renderInteractionPlayer(
          "multi_true_false",
          {
            statements: [{ id: "s1", text: "Phát biểu 1" }],
            statementLabel: "Ý kiến",
            trueLabel: "Đồng tình",
            falseLabel: "Không đồng tình",
          },
          {},
        ),
      ),
    );

    expect(container.textContent).toContain("Ý kiến");
    expect(container.textContent).toContain("Đồng tình");
    expect(container.textContent).toContain("Không đồng tình");
    expect(container.textContent).not.toContain("Nhận định");
  });

  it("keeps columns labels ahead of top-level ones when a table payload carries both", () => {
    act(() =>
      root.render(
        renderInteractionPlayer(
          "multi_true_false_table",
          {
            statements: [{ id: "s1", text: "Phát biểu 1" }],
            columns: { statement: "Cột nhận định", trueLabel: "Cột Đ", falseLabel: "Cột S" },
            statementLabel: "Ý kiến",
            trueLabel: "Đồng tình",
            falseLabel: "Không đồng tình",
          },
          {},
        ),
      ),
    );

    expect(container.textContent).toContain("Cột nhận định");
    expect(container.textContent).toContain("Cột Đ");
    expect(container.textContent).toContain("Cột S");
    expect(container.textContent).not.toContain("Ý kiến");
    expect(container.textContent).not.toContain("Đồng tình");
  });

  it("falls back to the default Đ/S labels when nothing is authored", () => {
    act(() =>
      root.render(
        renderInteractionPlayer(
          "multi_true_false",
          { statements: [{ id: "s1", text: "Phát biểu 1" }] },
          {},
        ),
      ),
    );

    expect(container.textContent).toContain("Nhận định");
    expect(container.textContent).toContain("Đ");
    expect(container.textContent).toContain("S");
  });

  it("renders an image-only row header for checkbox_table instead of dropping to the raw id (#590)", () => {
    act(() =>
      root.render(
        renderInteractionPlayer(
          "checkbox_table",
          {
            columns: [
              { id: "c1", label: "Có" },
              { id: "c2", label: "Không" },
            ],
            rows: [
              // Image-only row (no text) — content carries an image block.
              { id: "s1", content: { blocks: [{ type: "image", url: "/uploads/img/row-1.png" }] } },
              { id: "s2", label: "Hàng chữ" },
            ],
            correctAnswer: { s1: ["c1"], s2: ["c2"] },
          },
          {},
        ),
      ),
    );

    // Media URLs are resolved to an absolute origin by the dispatcher, so match the suffix.
    const img = container.querySelector('img[src$="/uploads/img/row-1.png"]');
    expect(img).not.toBeNull();
    // The raw statement id must never leak into the row header.
    expect(container.textContent).not.toContain("s1");
    // A text row still renders its label.
    expect(container.textContent).toContain("Hàng chữ");
  });

  it("renders a table cell whose label lives only in content.blocks next to its image (#562 class)", () => {
    act(() =>
      root.render(
        renderInteractionPlayer(
          "table_completion",
          {
            table: {
              headers: [
                { id: "viec", label: "Việc làm" },
                { id: "tick", label: "Đánh dấu" },
              ],
              rows: [
                {
                  id: "row-1",
                  cells: [
                    // Corpus shape (books/63-hoat-dong-trai-nghiem-4/data/bai31.json):
                    // image + paragraph inside `content`, no flat `text` at all.
                    {
                      columnId: "viec",
                      cellType: "static",
                      content: {
                        blocks: [
                          { type: "image", url: "/uploads/img/ve-sinh.png", align: "center" },
                          { type: "paragraph", text: "1. Giữ gìn vệ sinh cảnh quan" },
                        ],
                      },
                    },
                    { columnId: "tick", cellType: "tick" },
                  ],
                },
                {
                  id: "row-2",
                  cells: [
                    // A flat `text` still wins over any block text.
                    {
                      columnId: "viec",
                      cellType: "static",
                      text: "Nhãn phẳng",
                      content: { blocks: [{ type: "paragraph", text: "Nhãn khối" }] },
                    },
                    { columnId: "tick", cellType: "tick" },
                  ],
                },
              ],
            },
          },
          {},
        ),
      ),
    );

    expect(container.querySelector('img[src$="/uploads/img/ve-sinh.png"]')).not.toBeNull();
    expect(container.textContent).toContain("1. Giữ gìn vệ sinh cảnh quan");
    expect(container.textContent).toContain("Nhãn phẳng");
    expect(container.textContent).not.toContain("Nhãn khối");
  });

  it("renders a group-header row whose title lives only in content.blocks", () => {
    act(() =>
      root.render(
        renderInteractionPlayer(
          "table_completion",
          {
            table: {
              headers: [{ id: "c1", label: "Nội dung" }],
              rows: [
                {
                  id: "sec-1",
                  isGroupHeader: true,
                  cells: [
                    {
                      columnId: "c1",
                      cellType: "static",
                      content: {
                        blocks: [
                          {
                            type: "paragraph",
                            content: [{ text: "Nhóm 1", annotations: { bold: true } }],
                          },
                        ],
                      },
                    },
                  ],
                },
                { id: "row-1", cells: [{ columnId: "c1", cellType: "input" }] },
              ],
            },
          },
          {},
        ),
      ),
    );

    expect(container.textContent).toContain("Nhóm 1");
    // Authored marks survive the block → inline-HTML resolution.
    expect(container.querySelector("strong")?.textContent).toBe("Nhóm 1");
  });
});
