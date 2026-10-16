/**
 * web-own: file này CHỈ có ở evo-books-web-sbt, cố ý.
 *
 * SBT-69 — đường kẻ bảng quá mờ. Studio kẻ ô bằng `orange-50` / `orange-100` /
 * `divide-border` (~slate-200) và viền ngoài trắng; trên nền trắng học sinh gần
 * như không thấy ranh giới hàng/cột (ghi nhận ở "Hoàn thành bảng sau (theo
 * mẫu)", Tiết 1 · Bài 1/4). Repo này kẻ mọi nét bằng `slate-300`.
 *
 * Ba player bảng KHÔNG web-own — bước 2 của quy trình sync chép đè cả file. Màu
 * nét kẻ vì thế nằm trong `WEB_OWN_CLASS_PATCHES` của
 * `apps/learner/scripts/detokenize-players.mjs` (bước 3 tự đặt lại), còn viền
 * ngoài nằm ở `panel("table")` của skin (file merge tay). Studio đổi chuỗi class
 * thì regex hết khớp TRONG IM LẶNG — file này đỏ ngay ở bước 6.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderInteractionPlayer } from "./dispatch";
import { PLAYER_ACCENTS, type PlayerAccentName } from "../skin/accents";
import { SkinProvider } from "../skin";
import { corporateSkin, playfulAccentSkin } from "../skin/skins";

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

const RULE = "slate-300";
/** Các màu nét kẻ cũ — mờ tới mức học sinh không thấy. */
const FAINT = /\b(?:divide|border)-(?:orange-50|orange-100|border|slate-200)\b/;

const richBlock = (text: string) => ({
  blocks: [{ type: "paragraph", content: [{ text, annotations: {} }] }],
});

/** Class của mọi phần tử mang nét kẻ ô trong bảng: tbody, tr, th, td. */
const ruleBearers = () =>
  Array.from(container.querySelectorAll("table tbody, table tr, table th, table td")).map(
    (el) => el.getAttribute("class") ?? "",
  );

function expectStrongRules() {
  const classes = ruleBearers();
  expect(classes.length).toBeGreaterThan(0);
  for (const cls of classes) expect(cls).not.toMatch(FAINT);
  // Nét ngang giữa các hàng thân bảng.
  expect(container.querySelector("table tbody")?.className).toContain(`divide-${RULE}`);
  // Viền ngoài: các ca ở đây render không có SkinProvider (playfulSkin không có
  // `panel`), nên đây là nhánh `?? fallback` của player.
  const panel = container.querySelector("table")?.closest('[class*="rounded-[24px]"]');
  expect(panel?.className).toContain(`border-${RULE}`);
  expect(panel?.className).not.toContain("border-white");
}

describe("WEB-OWN · đường kẻ bảng đủ đậm (SBT-69)", () => {
  it("bảng điền (table_completion): nét dọc, nét ngang và đáy tiêu đề đều slate-300", () => {
    act(() => {
      root.render(
        renderInteractionPlayer(
          "table_completion",
          {
            table: {
              headers: [
                { id: "label", label: "" },
                { id: "a", label: "a" },
                { id: "b", label: "b" },
              ],
              rows: [
                {
                  id: "r1",
                  cells: [
                    { columnId: "label", cellType: "static", text: "Số hạng" },
                    { columnId: "a", cellType: "static", text: "9" },
                    { columnId: "b", cellType: "static", text: "8" },
                  ],
                },
                {
                  id: "r2",
                  cells: [
                    { columnId: "label", cellType: "static", text: "Tổng" },
                    { columnId: "a", cellType: "static", text: "12" },
                    { columnId: "b", cellType: "input", acceptedAnswers: ["13"] },
                  ],
                },
              ],
            },
          },
          {},
        ),
      );
    });

    expectStrongRules();
    const bodyRows = Array.from(container.querySelectorAll("table tbody tr"));
    for (const tr of bodyRows) expect(tr.className).toContain(`divide-${RULE}`);
    for (const th of Array.from(container.querySelectorAll("table thead th"))) {
      expect(th.className).toContain(`border-${RULE}`);
    }
  });

  it("bảng Đúng/Sai (multi_true_false)", () => {
    act(() => {
      root.render(
        renderInteractionPlayer(
          "multi_true_false",
          {
            statements: [
              { id: "s_a", label: "a)", content: richBlock("Chào hỏi người lớn tuổi.") },
              { id: "s_b", label: "b)", content: richBlock("Chen ngang khi người khác nói.") },
            ],
            correctAnswer: { s_a: true, s_b: false },
          },
          {},
        ),
      );
    });

    expectStrongRules();
    // Nét dọc giữa các cột của thân bảng.
    const tds = Array.from(container.querySelectorAll("table tbody td"));
    expect(tds.some((td) => td.className.includes(`border-${RULE}`))).toBe(true);
  });

  it("bảng đánh dấu (checkbox_table)", () => {
    act(() => {
      root.render(
        renderInteractionPlayer(
          "checkbox_table",
          {
            id: "q",
            type: "checkbox_table",
            version: 2,
            display: { interactionType: "rows" },
            columns: [
              { id: "bay", label: "Biết bay" },
              { id: "boi", label: "Biết bơi" },
            ],
            rows: [
              { id: "chim", content: richBlock("Con chim") },
              { id: "ca", content: richBlock("Con cá") },
            ],
            correctAnswer: { chim: ["bay"], ca: ["boi"] },
          },
          {},
        ),
      );
    });

    expectStrongRules();
    const tds = Array.from(container.querySelectorAll("table tbody td"));
    expect(tds.every((td) => td.className.includes(`border-${RULE}`))).toBe(true);
  });

  it("viền ngoài panel('table') là slate-300, không còn viền trắng — mọi accent, cả hai skin", () => {
    for (const skin of [playfulAccentSkin, corporateSkin]) {
      for (const name of Object.keys(PLAYER_ACCENTS) as PlayerAccentName[]) {
        const panel = skin.forAccent(PLAYER_ACCENTS[name]).panel?.("table") ?? "";
        expect(panel, `${skin.name}/${name}`).toContain(`border-${RULE}`);
        expect(panel, `${skin.name}/${name}`).not.toContain("border-white");
      }
    }
  });

  it("khung gợi ý ô chữ KHÔNG đổi theo — vẫn viền trắng cũ, không slate-300", () => {
    for (const skin of ["playful", "corporate"] as const) {
      act(() => {
        root.render(
          <SkinProvider skin={skin}>
            {renderInteractionPlayer(
              "crossword",
              {
                size: { rows: 1, cols: 3 },
                entries: [{ id: "a", direction: "across", startRow: 0, startCol: 0, length: 3, clue: "Con mèo" }],
              },
              { instantFeedback: false },
            )}
          </SkinProvider>,
        );
      });
      const clues = Array.from(container.querySelectorAll("div")).find(
        (el) => el.className.includes("space-y-4") && el.textContent?.includes("Con mèo"),
      );
      expect(clues?.className, skin).toContain("border-4 border-white");
      expect(clues?.className, skin).not.toContain(`border-${RULE}`);
    }
  });
});
