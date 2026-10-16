/**
 * Generated A./B./C. option prefixes are presentation-driven (never content-
 * driven): hidden for plain checkbox in "list" layout (the per-row tick marker
 * already identifies the option), kept for radio, circle/color_fill variants
 * and every other layout (see showGeneratedOptionLabels in shared.tsx).
 * web-own: pill chrome mọi layout — "pill không phải layout" (Owner 30/7):
 * radio không còn nhánh radio-row theo list, pill luôn in chữ cái "A.".
 * The circle variant shows the bare letter inside CircleLetterMarker (no "."
 * suffix) — the letter itself is what the pen circles.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { showGeneratedOptionLabels } from "./shared";
import { renderInteractionPlayer } from "./dispatch";
import { MultiChoicePlayer } from "./MultiChoicePlayer";
import { SingleChoicePlayer } from "./SingleChoicePlayer";

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

describe("showGeneratedOptionLabels", () => {
  it("hides labels only for plain checkbox in list layout", () => {
    expect(showGeneratedOptionLabels("checkbox", "list")).toBe(false);
    // Faithful (không cờ): radio list là radio-row, không in chữ cái.
    expect(showGeneratedOptionLabels("radio", "list")).toBe(false);
    // web-own look qua cờ presentation.choicePill (playful bật): radio là pill
    // mọi layout — chữ cái luôn hiện (Owner 30/7).
    expect(showGeneratedOptionLabels("radio", "list", { choicePill: true })).toBe(true);
    expect(showGeneratedOptionLabels("checkbox", "list", { choicePill: true })).toBe(false);
  });

  it("keeps labels for circle/color_fill variants and non-list layouts", () => {
    expect(showGeneratedOptionLabels("circle", "list")).toBe(true);
    expect(showGeneratedOptionLabels("color_fill", "list")).toBe(true);
    expect(showGeneratedOptionLabels("checkbox", "inline")).toBe(true);
    expect(showGeneratedOptionLabels("radio", "grid_2")).toBe(true);
  });
});

describe("player label rendering", () => {
  const options = [
    { id: "1", text: "Rèn luyện phẩm chất." },
    { id: "2", text: "Gặt hái thành công." },
  ];

  it("MultiChoicePlayer (checkbox, list) renders no generated labels", () => {
    act(() => {
      root.render(
        <MultiChoicePlayer title="Q" options={options} correctIds={["1"]} layout="list" />,
      );
    });
    expect(container.textContent).not.toContain("A.");
    expect(container.textContent).toContain("Rèn luyện phẩm chất.");
  });

  it("MultiChoicePlayer keeps labels in inline layout and the bare letter for circle variant", () => {
    act(() => {
      root.render(
        <MultiChoicePlayer title="Q" options={options} correctIds={["1"]} layout="inline" />,
      );
    });
    expect(container.textContent).toContain("A.");
    act(() => {
      root.render(
        <MultiChoicePlayer title="Q" options={options} correctIds={["1"]} layout="list" variant="circle" />,
      );
    });
    // Circle renders the letter inside CircleLetterMarker (the thing the pen
    // circles) — no "." suffix like the pill/inline label.
    expect(container.textContent).toContain("A");
    expect(container.textContent).toContain("B");
    expect(container.textContent).not.toContain("A.");
  });

  // web-own: pill chrome mọi layout — "pill không phải layout" (Owner 30/7):
  // radio list giờ là pill bo tròn và LUÔN in chữ cái tham chiếu "A.".
  it("SingleChoicePlayer (radio, list) renders generated labels on the pill", () => {
    act(() => {
      root.render(
        <SingleChoicePlayer title="Q" options={options} correctId="1" layout="list" />,
      );
    });
    expect(container.textContent).toContain("A.");
    const firstOption = container.querySelector<HTMLButtonElement>('[role="radio"]');
    expect(firstOption?.classList.contains("rounded-full")).toBe(true);
    expect(firstOption?.classList.contains("border-4")).toBe(true);
  });

  it("SingleChoicePlayer keeps labels in pill layout and the bare letter for circle variant", () => {
    act(() => {
      root.render(
        <SingleChoicePlayer title="Q" options={options} correctId="1" layout="inline" />,
      );
    });
    expect(container.textContent).toContain("A.");
    act(() => {
      root.render(
        <SingleChoicePlayer title="Q" options={options} correctId="1" layout="list" variant="circle" />,
      );
    });
    // Circle renders the letter inside CircleLetterMarker — no "." suffix.
    expect(container.textContent).toContain("A");
    expect(container.textContent).toContain("B");
    expect(container.textContent).not.toContain("A.");
  });

  /**
   * "Khoanh tròn" phải là HÌNH TRÒN, không phải elip (Owner 9/8: "tôi muốn một
   * hình tròn"). Bản trước dùng 16/14 — bẹt 14%, cộng `-rotate-6` nên đọc ra
   * hình bầu dục nghiêng. Khoá ở đây vì đường vẽ là chuỗi `d` thuần, không có
   * gì khác chặn nó bẹt trở lại.
   */
  it("vòng khoanh là HÌNH TRÒN — hai bán kính bằng nhau", () => {
    act(() => {
      root.render(
        <SingleChoicePlayer title="Q" options={options} correctId="1" layout="list" variant="circle" />,
      );
    });
    const path = container.querySelector("svg path");
    const d = path?.getAttribute("d") ?? "";
    const arc = /A\s+([\d.]+)\s+([\d.]+)\s/.exec(d);
    expect(arc, `không đọc được bán kính từ d="${d}"`).toBeTruthy();
    const [rx, ry] = [Number(arc![1]), Number(arc![2])];
    expect(rx).toBe(ry);
    // Xoay một hình tròn không đổi gì — lớp `rotate` còn sót lại chỉ gây hiểu lầm.
    expect(path?.closest("svg")?.getAttribute("class") ?? "").not.toMatch(/rotate-/);
  });
});

/**
 * Issue #660 — the letter shown must be the one printed in the book. Vietnamese
 * books skip letters (A, B, C, D, E, **G** — no F), so an index-derived letter
 * renders "F" where the data and the answer key say "G". The letter lives in
 * `options[].id`, which is also what `correctAnswer` references.
 */
describe("the option id is the letter (issue #660)", () => {
  const skipF = [
    { id: "A", text: "Phương án A" },
    { id: "B", text: "Phương án B" },
    { id: "G", text: "Phương án G" },
  ];

  it("MultiChoicePlayer renders the id, not A/B/C by index", () => {
    act(() => {
      root.render(
        <MultiChoicePlayer title="Q" options={skipF} correctIds={["A"]} layout="list" variant="circle" />,
      );
    });
    expect(container.textContent).toContain("G");
    expect(container.textContent).not.toContain("C");
  });

  it("SingleChoicePlayer renders the id, not A/B/C by index", () => {
    act(() => {
      root.render(
        <SingleChoicePlayer title="Q" options={skipF} correctId="A" layout="list" variant="circle" />,
      );
    });
    expect(container.textContent).toContain("G");
    expect(container.textContent).not.toContain("C");
  });

  it("renders a whole skipped-letter sequence in order", () => {
    act(() => {
      root.render(
        <MultiChoicePlayer
          title="Câu hỏi"
          options={["A", "B", "C", "D", "E", "G"].map((l) => ({ id: l, text: `Ý ${l}` }))}
          correctIds={["A"]}
          layout="list"
          variant="circle"
        />,
      );
    });
    const markers = [...container.querySelectorAll("span")]
      .filter((el) => el.childElementCount === 0)
      .map((el) => el.textContent?.trim())
      .filter((t) => t && /^[A-Z]$/.test(t));
    expect(markers).toEqual(["A", "B", "C", "D", "E", "G"]);
    expect(markers).not.toContain("F");
  });

  it("preserves the case of a lowercase id (books printing a) b) c))", () => {
    act(() => {
      root.render(
        <SingleChoicePlayer
          title="Q"
          options={[{ id: "a", text: "Một" }, { id: "b", text: "Hai" }]}
          correctId="a"
          layout="inline"
        />,
      );
    });
    expect(container.textContent).toContain("a.");
    expect(container.textContent).toContain("b.");
  });

  it("leaves opaque ids on the positional letter", () => {
    act(() => {
      root.render(
        <SingleChoicePlayer
          title="Q"
          options={[{ id: "o1", text: "Một" }, { id: "o2", text: "Hai" }]}
          correctId="o1"
          layout="inline"
        />,
      );
    });
    expect(container.textContent).toContain("A.");
    expect(container.textContent).toContain("B.");
  });

  it("leaves numeric ids on the positional letter (not verified against the book)", () => {
    act(() => {
      root.render(
        <SingleChoicePlayer
          title="Q"
          options={[{ id: "1", text: "Một" }, { id: "2", text: "Hai" }]}
          correctId="1"
          layout="inline"
        />,
      );
    });
    expect(container.textContent).toContain("A.");
    expect(container.textContent).toContain("B.");
  });
});

/**
 * The id must survive the dispatch layer. Payload shaped like the reported
 * question b34_q2 (books/61-hoat-dong-trai-nghiem-2/data/bai34.json), which
 * carries the letters in `id` and no `label` at all.
 */
describe("dispatch carries the option id through to the player (issue #660)", () => {
  it("renders G for the 6th option, never F", () => {
    const payload = {
      type: "multiple_choice",
      content: { blocks: [{ type: "paragraph", text: "Chọn các ý đúng" }] },
      display: { interactionType: "circle", layout: "list" },
      options: ["A", "B", "C", "D", "E", "G"].map((l) => ({
        id: l,
        content: { blocks: [{ type: "paragraph", text: `Ý ${l}` }] },
      })),
      correctAnswer: ["A", "C", "E", "G"],
    };
    act(() => {
      root.render(renderInteractionPlayer("multiple_choice", payload, {}));
    });
    const markers = [...container.querySelectorAll("span")]
      .filter((el) => el.childElementCount === 0)
      .map((el) => el.textContent?.trim())
      .filter((t) => t && /^[A-Z]$/.test(t));
    expect(markers).toEqual(["A", "B", "C", "D", "E", "G"]);
    expect(markers).not.toContain("F");
  });
});
