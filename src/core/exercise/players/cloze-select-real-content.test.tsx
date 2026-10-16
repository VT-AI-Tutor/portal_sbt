// @vitest-environment jsdom
/**
 * Hồi quy bám NỘI DUNG THẬT: Tiếng Việt 1 bài 38
 * (`nxbgd-sbt-digital/books/22-tieng-viet-1/data/bai38.json`).
 *
 * Câu này khai `options` ở CẤP PAYLOAD theo spec §5.6.2 từ lâu, nhưng trước
 * 2026-08-02 không ai cài nên nó render 6 ô GÕ TAY trong khi tác giả muốn
 * dropdown. Đo tại commit trước bản vá: select=0, input=6.
 *
 * Nó cũng phủ một nhánh khác hẳn các test kia: nội dung ("Điền ai, ay hay ây?")
 * KHÔNG có marker chỗ trống, nên parseCloze đi đường DỰ PHÒNG — dựng một ô cho
 * mỗi phần tử `blanks[]` từ before/after/image. Test dùng payload có marker sẽ
 * không bao giờ chạm nhánh này.
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

/** Nguyên văn payload của bài 38 (chỉ giữ các trường liên quan tới render ô). */
const tv1Bai38 = {
  display: { interactionType: "picture" },
  options: ["ai", "ay", "ây"],
  content: { blocks: [{ type: "paragraph", text: "Điền ai, ay hay ây?" }] },
  blanks: [
    { id: "blank_cay", image: "assets/images/bai38_q1_cay.png", before: "lùm c", after: "" },
    { id: "blank_trai", image: "assets/images/bai38_q1_trai.png", before: "bạn tr", after: "" },
    { id: "blank_tay", image: "assets/images/bai38_q1_tay.png", before: "bàn t", after: "" },
    { id: "blank_maybay", image: "assets/images/bai38_q1_maybay.png", before: "m", after: "ˊ bay" },
    { id: "blank_may", image: "assets/images/bai38_q1_may.png", before: "đám m", after: "" },
    { id: "blank_gai", image: "assets/images/bai38_q1_gai.png", before: "bạn g", after: "ˊ" },
  ],
  correctAnswer: {
    blank_cay: "ây",
    blank_trai: "ai",
    blank_tay: "ay",
    blank_maybay: "ay",
    blank_may: "ây",
    blank_gai: "ai",
  },
};

describe("Nội dung thật — TV1 bài 38 (cloze picture + options dùng chung)", () => {
  it("cả 6 ô đều là dropdown, không còn ô gõ tay", () => {
    act(() =>
      root.render(<>{renderInteractionPlayer("cloze", tv1Bai38, { questionId: "q" })}</>),
    );

    expect(container.querySelectorAll("select")).toHaveLength(6);
    expect(container.querySelectorAll("input")).toHaveLength(0);
  });

  it("mỗi ô có đủ 3 lựa chọn dùng chung + mục trống dẫn nhập", () => {
    act(() =>
      root.render(<>{renderInteractionPlayer("cloze", tv1Bai38, { questionId: "q" })}</>),
    );

    for (const el of Array.from(container.querySelectorAll("select"))) {
      expect(el.querySelectorAll("option")).toHaveLength(4);
      expect(Array.from(el.querySelectorAll("option")).map((o) => o.value)).toEqual([
        "",
        "ai",
        "ay",
        "ây",
      ]);
    }
  });

  it("chữ dẫn của từng ô (before/after) vẫn hiện quanh dropdown", () => {
    act(() =>
      root.render(<>{renderInteractionPlayer("cloze", tv1Bai38, { questionId: "q" })}</>),
    );

    expect(container.textContent).toContain("lùm c");
    expect(container.textContent).toContain("đám m");
    expect(container.textContent).toContain("ˊ bay");
  });
});
