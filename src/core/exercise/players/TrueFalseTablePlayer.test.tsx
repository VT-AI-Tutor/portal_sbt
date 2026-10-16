/**
 * #392 — multi_true_false_table optional 4th "Tình huống" (situation) column.
 * When columns.situation + statements[].situation are present the table shows
 * Tình huống | Phát biểu | Đúng | Sai with situation and statement kept in
 * separate cells; legacy payloads without situation still render 3 columns.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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

const richBlock = (text: string) => ({ blocks: [{ type: "paragraph", content: [{ text, annotations: {} }] }] });

describe("multi_true_false_table situation column (#392)", () => {
  it("renders 4 columns keeping situation and statement in separate cells", () => {
    act(() => {
      root.render(
        renderInteractionPlayer(
          "multi_true_false_table",
          {
            columns: { situation: "Tình huống", statement: "Phát biểu", trueLabel: "Đúng", falseLabel: "Sai" },
            statements: [
              {
                id: "s1",
                situation: richBlock("Thấy khát nước, em đi lấy nước uống."),
                content: richBlock("Khát nước là thông tin, đi lấy nước uống là quyết định."),
              },
            ],
            correctAnswer: { s1: true },
          },
          {},
        ),
      );
    });

    const headers = Array.from(container.querySelectorAll("th")).map((th) => th.textContent?.trim());
    expect(headers).toContain("Tình huống");
    expect(headers).toContain("Phát biểu");
    expect(headers).toContain("Đúng");
    expect(headers).toContain("Sai");

    // Situation and statement live in two DIFFERENT cells, not concatenated.
    const cells = Array.from(container.querySelectorAll("td"));
    const sitCell = cells.find((c) => c.textContent?.includes("Thấy khát nước"));
    const stmtCell = cells.find((c) => c.textContent?.includes("Khát nước là thông tin"));
    expect(sitCell).toBeTruthy();
    expect(stmtCell).toBeTruthy();
    expect(sitCell).not.toBe(stmtCell);
    expect(sitCell!.textContent).not.toContain("Khát nước là thông tin");
  });

  it("renders legacy 3-column layout when no situation is present", () => {
    act(() => {
      root.render(
        renderInteractionPlayer(
          "multi_true_false_table",
          {
            columns: { statement: "Nhận định", trueLabel: "Đ", falseLabel: "S" },
            statements: [{ id: "s1", content: richBlock("Trái Đất quay quanh Mặt Trời.") }],
            correctAnswer: { s1: true },
          },
          {},
        ),
      );
    });
    const headers = Array.from(container.querySelectorAll("th")).map((th) => th.textContent?.trim());
    expect(headers).not.toContain("Tình huống");
    // 3 header cells: Nhận định | Đ | S.
    expect(container.querySelectorAll("thead th").length).toBe(3);
  });
});

// Owner 8/8 (bai33 tam giác): nhãn "a)" từng đứng trơ một dòng vì nội dung
// nhận định render qua <div> block-level rơi xuống dưới nhãn inline. Ô nhận
// định giờ là flex row: nhãn cột trái shrink-0, nội dung cột phải.
describe("statement label sits on the same row as its content", () => {
  it("wraps label + body in a flex row when the statement has a label", () => {
    act(() => {
      root.render(
        renderInteractionPlayer(
          "multi_true_false",
          {
            statements: [
              { id: "s1", label: "a)", content: richBlock("Diện tích ABM bằng diện tích ANC.") },
            ],
            correctAnswer: { s1: true },
          },
          {},
        ),
      );
    });
    const label = Array.from(container.querySelectorAll("td span")).find(
      (s) => s.textContent?.trim() === "a)",
    )!;
    const row = label.parentElement!;
    expect(row.className).toContain("flex");
    expect(label.className).toContain("shrink-0");
    // Nội dung nằm trong cột phải của CÙNG hàng flex, không rơi xuống dòng.
    const body = row.querySelector("div.min-w-0");
    expect(body?.textContent).toContain("Diện tích ABM");
  });
});
