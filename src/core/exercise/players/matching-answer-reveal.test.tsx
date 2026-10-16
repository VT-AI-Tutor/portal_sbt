/**
 * Khối "Đáp án đúng" của câu nối phải dựng lại chính thẻ item, không phải một
 * dòng chữ `trái → phải`: item chỉ có ảnh có `text` rỗng nên bản chữ cho ra
 * toàn mũi tên trống (ca b2_q2 "Nối từ phù hợp với hình", VBT Tiếng Việt 1).
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderInteractionPlayer } from "./dispatch";
import { chainRevealPaths } from "./ChainMatchPlayer";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const imageItem = (id: string, url: string, alt: string) => ({
  id,
  content: { blocks: [{ type: "image", url, alt, width: "160px" }] },
});
const textItem = (id: string, text: string) => ({
  id,
  content: { blocks: [{ type: "paragraph", content: [{ text, annotations: {} }] }] },
});
/** Ô vừa có ẢNH vừa có chữ — nhãn dài nhưng ảnh bên trong vẫn khoá `shrink-0`. */
const imageWithLabelItem = (id: string, url: string, text: string) => ({
  id,
  content: {
    blocks: [
      { type: "image", url, alt: text, width: "160px" },
      { type: "paragraph", content: [{ text, annotations: {} }] },
    ],
  },
});

const b2q2 = {
  leftItems: [
    imageItem("i_grandma", "/uploads/grandma.png", "Bà cụ đội nón"),
    imageItem("i_father", "/uploads/father.png", "Người bố"),
    imageItem("i_turtle", "/uploads/turtle.png", "Con ba ba"),
  ],
  rightItems: [textItem("t_baba", "ba ba"), textItem("t_ba2", "bà"), textItem("t_ba", "ba")],
  correctAnswer: { i_grandma: "t_ba2", i_father: "t_ba", i_turtle: "t_baba" },
};

/** Khối "Đáp án đúng" của PlayerShell. */
function revealBox(): HTMLElement {
  const heading = Array.from(container.querySelectorAll("p")).find(
    (p) => p.textContent?.trim() === "Đáp án đúng",
  );
  expect(heading).toBeTruthy();
  return heading!.parentElement as HTMLElement;
}

function render(interactionType: string) {
  act(() => {
    root.render(
      renderInteractionPlayer(
        "matching",
        { display: { interactionType }, ...b2q2 },
        { submitted: true },
      ),
    );
  });
}

/** Câu nối chuỗi ba cột, đã nộp → khối "Đáp án đúng" hiện ra. */
function renderChain(payload: Record<string, unknown>) {
  act(() => {
    root.render(
      renderInteractionPlayer(
        "matching",
        { display: { interactionType: "chain" }, ...payload },
        { submitted: true },
      ),
    );
  });
}

/** Nhãn đọc-được của từng HÀNG trong khối "Đáp án đúng". */
function rowLabels(): (string | null)[] {
  return Array.from(revealBox().querySelectorAll("li")).map((li) => li.getAttribute("aria-label"));
}

describe("matching — khối Đáp án đúng dựng bằng thẻ item", () => {
  it("rows: mỗi cặp hiện ẢNH bên trái và CHỮ bên phải, không phải mũi tên trống", () => {
    render("rows");
    const box = revealBox();
    const srcs = Array.from(box.querySelectorAll("img")).map((img) => img.getAttribute("src"));
    expect(srcs).toEqual(["/uploads/grandma.png", "/uploads/father.png", "/uploads/turtle.png"]);
    expect(box.textContent).toContain("bà");
    expect(box.textContent).toContain("ba ba");
  });

  it("ảnh trong khối đáp án bỏ qua `width` tác giả (khung tóm tắt cỡ cố định)", () => {
    render("rows");
    for (const img of Array.from(revealBox().querySelectorAll("img"))) {
      expect((img as HTMLImageElement).style.maxWidth).toBe("");
    }
  });

  it("ảnh chặn trần hai chiều, KHÔNG ép khung vuông (băng chữ dài vẫn đọc được)", () => {
    render("rows");
    const cls = revealBox().querySelector("img")!.getAttribute("class") ?? "";
    expect(cls).toContain("max-h-14");
    expect(cls).toContain("max-w-[10rem]");
    // Ép cạnh cố định là thứ làm băng chữ 900×120 co còn dải 8px.
    expect(cls).not.toMatch(/(^|\s)(sm:)?[hw]-1[46](\s|$)/);
  });

  it("ô toàn ảnh: `alt` lấy từ nhãn tác giả; ô có chữ thì `alt` rỗng, không đọc hai lần", () => {
    render("rows");
    const box = revealBox();
    expect(Array.from(box.querySelectorAll("img")).map((img) => img.getAttribute("alt"))).toEqual([
      "Bà cụ đội nón",
      "Người bố",
      "Con ba ba",
    ]);
  });

  it("columns dùng chung khối đó — ảnh cũng hiện đủ", () => {
    render("columns");
    expect(revealBox().querySelectorAll("img").length).toBe(3);
  });

  it("mỗi hàng có nhãn đọc được ghép từ `alt` tác giả (ô toàn ảnh vốn câm)", () => {
    render("rows");
    const labels = Array.from(revealBox().querySelectorAll("li")).map((li) =>
      li.getAttribute("aria-label"),
    );
    expect(labels).toEqual([
      "Bà cụ đội nón → bà",
      "Người bố → ba",
      "Con ba ba → ba ba",
    ]);
  });

  it("ảnh không có `alt` thì bỏ aria-label, để trình đọc đọc nội dung ô", () => {
    act(() => {
      root.render(
        renderInteractionPlayer(
          "matching",
          {
            display: { interactionType: "rows" },
            leftItems: [{ id: "l1", content: { blocks: [{ type: "image", url: "/uploads/x.png" }] } }],
            rightItems: [textItem("r1", "ba")],
            correctAnswer: { l1: "r1" },
          },
          { submitted: true },
        ),
      );
    });
    expect(revealBox().querySelector("li")?.getAttribute("aria-label")).toBeNull();
  });

  it("chain: ảnh hiện như ô trong bài", () => {
    renderChain({
      leftItems: [imageItem("a1", "/uploads/fish.png", "Con cá")],
      middleItems: [textItem("m1", "Rong rêu")],
      rightItems: [textItem("r1", "Đáy ao")],
      correctAnswer: [
        { item: "a1", target: "m1" },
        { item: "m1", target: "r1" },
      ],
    });
    expect(revealBox().querySelectorAll("img").length).toBe(1);
  });
});

/**
 * NXB (TV4 tập 1, bài 2 và bài 28): chuỗi ba cột phải hiện trên MỘT hàng. Khoá
 * đáp án lưu từng cạnh rời nên khối đáp án trước đây in ra hai hàng `a → m` và
 * `m → r`, học sinh phải tự ghép lại mới hiểu.
 *
 * Bốn nhánh của `chainRevealPaths` soi thẳng trên hàm thuần. Phủ nhánh bằng
 * cách render cả player thì mỗi ca tốn vài giây và lỗi báo ra là "aria-label
 * không khớp" — đọc không ra đang hỏng luật gộp nào.
 */
describe("chainRevealPaths — ghép cạnh rời thành chuỗi", () => {
  const L = (...ids: string[]) => new Set(ids);
  const e = (item: string, target: string) => ({ item, target });

  it("một vào một ra → đúng một chuỗi ba ô", () => {
    expect(chainRevealPaths([e("a", "m"), e("m", "r")], L("a")))
      .toEqual([["a", "m", "r"]]);
  });

  it("một vào NHIỀU ra → mỗi nhánh một chuỗi, không có gì phải bịa", () => {
    expect(chainRevealPaths([e("a", "m"), e("m", "r1"), e("m", "r2")], L("a")))
      .toEqual([["a", "m", "r1"], ["a", "m", "r2"]]);
  });

  it("NHIỀU vào một ra → cũng ghép, mọi hàng cùng đi qua một mắt xích thật", () => {
    expect(chainRevealPaths([e("a1", "m"), e("a2", "m"), e("m", "r")], L("a1", "a2")))
      .toEqual([["a1", "m", "r"], ["a2", "m", "r"]]);
  });

  it("NHIỀU vào NHIỀU ra (ô giữa là NHÓM) → in lại từng cạnh, KHÔNG ghép chéo", () => {
    // Dáng `triad` của Đạo đức 4: ghép chéo ra 2×2 = 4 hàng và bịa ra "a1 đi
    // với r1" — điều khoá không hề khai.
    expect(chainRevealPaths(
      [e("a1", "m"), e("a2", "m"), e("m", "r1"), e("m", "r2")],
      L("a1", "a2"),
    )).toEqual([["a1", "m"], ["a2", "m"], ["m", "r1"], ["m", "r2"]]);
  });

  it("khuyết đuôi / khuyết đầu → vẫn ra hàng hai ô, không nuốt mất", () => {
    expect(chainRevealPaths([e("a", "m1"), e("m2", "r")], L("a")))
      .toEqual([["a", "m1"], ["m2", "r"]]);
  });

  it("thứ tự hàng bám theo thứ tự tác giả khai, không phải thứ tự cột", () => {
    const edges = [e("a2", "m2"), e("m2", "r2"), e("a1", "m1"), e("m1", "r1")];
    expect(chainRevealPaths(edges, L("a1", "a2")))
      .toEqual([["a2", "m2", "r2"], ["a1", "m1", "r1"]]);
  });

  it("khoá rỗng → không hàng nào", () => {
    expect(chainRevealPaths([], L("a"))).toEqual([]);
  });
});

describe("matching chain — mỗi chuỗi một hàng a → m → r", () => {
  it("ghép hai cạnh dùng chung ô giữa thành một hàng", () => {
    renderChain({
      leftItems: [textItem("a1", "Mùa xuân")],
      middleItems: [textItem("m1", "Mơ là cánh én")],
      rightItems: [textItem("r1", "Vì muốn gọi mùa xuân trở về")],
      correctAnswer: [
        { item: "a1", target: "m1" },
        { item: "m1", target: "r1" },
      ],
    });
    expect(rowLabels()).toEqual(["Mùa xuân → Mơ là cánh én → Vì muốn gọi mùa xuân trở về"]);
  });

  it("hàng ba ô nằm LIỀN một dòng; ô nhãn ngắn không bị bóp gãy chữ", () => {
    renderChain({
      leftItems: [textItem("a1", "Mùa xuân")],
      middleItems: [textItem("m1", "Mơ là cánh én")],
      rightItems: [textItem("r1", "Vì muốn gọi mùa xuân ấm áp, tươi vui trở về.")],
      correctAnswer: [
        { item: "a1", target: "m1" },
        { item: "m1", target: "r1" },
      ],
    });
    const row = revealBox().querySelector("li")!;
    // Xuống dòng chỉ còn là đường lùi của màn hẹp (< 640px), nơi ô ẢNH không co
    // được sẽ làm hàng tràn ra ngoài.
    expect(row.className).toContain("sm:flex-nowrap");
    const chips = Array.from(row.children).filter((el) => !el.hasAttribute("aria-hidden"));
    // Phần co dồn hết vào ô DÀI NHẤT; hai ô ngắn giữ nguyên bề rộng.
    expect(chips.map((el) => el.className.includes("shrink-0"))).toEqual([true, true, false]);
  });

  it("hàng không có ô nào nhường được chỗ → cho XUỐNG DÒNG, không ép liền dòng", () => {
    // Ba nhãn đều ngắn (ô ảnh cũng vào đây: nhãn của nó là `alt`, mà ảnh khoá
    // `shrink-0` nên không nhường nổi một px). Ép liền dòng ở đây chỉ có thể
    // kết thúc bằng tràn — ảnh trào qua viền bo của chính ô nó.
    renderChain({
      leftItems: [textItem("a1", "Cây thông")],
      middleItems: [textItem("m1", "Cạn")],
      rightItems: [textItem("r1", "Chim")],
      correctAnswer: [
        { item: "a1", target: "m1" },
        { item: "m1", target: "r1" },
      ],
    });
    const row = revealBox().querySelector("li")!;
    expect(row.className).toContain("flex-wrap");
    expect(row.className).not.toContain("flex-nowrap");
    const chips = Array.from(row.children).filter((el) => !el.hasAttribute("aria-hidden"));
    expect(chips.every((el) => el.className.includes("shrink-0"))).toBe(true);
  });

  it("ô vừa ẢNH vừa chữ dài KHÔNG được tính là ô gánh", () => {
    // Nhãn dài nên nhìn qua tưởng gánh được, nhưng ảnh bên trong khoá
    // `shrink-0`: cho ô này co là co KHUNG, ảnh giữ nguyên cỡ và trào qua viền
    // bo. Cả hàng phải rơi về đường xuống dòng như hàng toàn nhãn ngắn.
    renderChain({
      leftItems: [
        imageWithLabelItem("a1", "/uploads/fish.png", "Con cá bơi trong hồ nước trong"),
      ],
      middleItems: [textItem("m1", "Rong rêu")],
      rightItems: [textItem("r1", "Đáy ao")],
      correctAnswer: [
        { item: "a1", target: "m1" },
        { item: "m1", target: "r1" },
      ],
    });
    const row = revealBox().querySelector("li")!;
    expect(row.className).not.toContain("flex-nowrap");
    const chips = Array.from(row.children).filter((el) => !el.hasAttribute("aria-hidden"));
    expect(chips.every((el) => el.className.includes("shrink-0"))).toBe(true);
    // Khoá bề rộng mà không có trần thì ô rộng bằng max-content: chữ dài nằm
    // trọn một dòng, tràn ra ngoài và bị `overflow-hidden` của PlayerShell XÉN.
    expect(chips.every((el) => el.className.includes("max-w-full"))).toBe(true);
  });

  it("cạnh MẪU ngoài khoá vẫn nối liền chuỗi, không đứt thành mảnh cụt", () => {
    renderChain({
      leftItems: [textItem("a1", "24"), textItem("a2", "15")],
      middleItems: [textItem("m1", "Gấp 2 lần"), textItem("m2", "Gấp 3 lần")],
      rightItems: [textItem("r1", "48"), textItem("r2", "45")],
      // Chuỗi mẫu vẽ sẵn trên đề, KHÔNG nằm trong khoá vì không bị chấm.
      example: [
        { item: "a1", target: "m1" },
        { item: "m1", target: "r1" },
      ],
      correctAnswer: [
        { item: "a2", target: "m2" },
        { item: "m2", target: "r2" },
      ],
    });
    expect(rowLabels()).toEqual(["24 → Gấp 2 lần → 48", "15 → Gấp 3 lần → 45"]);
  });
});
