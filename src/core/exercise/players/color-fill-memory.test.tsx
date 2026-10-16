/**
 * web-own: khoá mục H checklist WEB-OWN PATCHES (apps/learner/scripts/
 * detokenize-players.mjs). File chỉ có ở repo này — copy đè player từ studio
 * nuốt phần nối sổ nhớ màu thì bộ này đỏ.
 *
 * Lỗi gốc (ĐĐ4 b6_q6, ĐĐ5 b5_q5_mc): tô nhiều màu → sang câu khác → quay lại
 * thì mọi ô thành tím. Đi đúng đường runner: QuestionPlayer → dispatch → player.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { QuestionPlayer, type PlayerQuestion } from "@/core/exercise/QuestionPlayer";
import {
  ColorFillMemoryProvider,
  createColorFillMemory,
  forgetColorFill,
  type ColorFillMemory,
} from "./color-fill-memory";

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

const PINK = "rgb(236, 72, 153)"; // COLOR_FILL_PALETTE[1]
const ORANGE = "rgb(245, 158, 11)"; // COLOR_FILL_PALETTE[2]
const PURPLE = "rgb(168, 85, 247)"; // mặc định multiple_choice

const options = [
  { id: "A", text: "Nhặt rác" },
  { id: "B", text: "Bẻ cành cây" },
  { id: "C", text: "Tưới cây" },
];

const multi: PlayerQuestion = {
  id: "b5_q5_mc",
  question_type: "multiple_choice",
  payload: { options, correctAnswer: ["A", "C"], display: { interactionType: "color_fill" } },
};
const single: PlayerQuestion = {
  id: "q_single",
  question_type: "single_choice",
  payload: { options, correctAnswer: "A", display: { interactionType: "color_fill" } },
};
const other: PlayerQuestion = {
  id: "q_other",
  question_type: "single_choice",
  payload: { options, correctAnswer: "A" },
};

/** Dựng như runner: mỗi câu một key, đáp án do "runner" giữ. */
function show(q: PlayerQuestion, answers: Record<string, unknown>, store?: ColorFillMemory) {
  const player = (
    <QuestionPlayer
      key={q.id}
      question={q}
      index={0}
      answer={answers[q.id]}
      onAnswerChange={(a) => {
        answers[q.id] = a;
      }}
      // Bài trong sách chấm câm: không verdict xanh/đỏ đè lên màu tô.
      gradeMode="silent"
    />
  );
  act(() => {
    root.render(store ? <ColorFillMemoryProvider store={store}>{player}</ColorFillMemoryProvider> : player);
  });
}

const cards = (role: "checkbox" | "radio") =>
  Array.from(container.querySelectorAll<HTMLButtonElement>(`[role="${role}"]`));
const crayon = (i: number) =>
  container.querySelectorAll<HTMLButtonElement>("[data-color-fill-palette] button")[i];

describe("color_fill giữ màu khi rời câu rồi quay lại", () => {
  it("multiple_choice: mỗi ô giữ đúng màu đã tô, bút giữ màu đang cầm", () => {
    const store = createColorFillMemory();
    const answers: Record<string, unknown> = {};

    show(multi, answers, store);
    act(() => crayon(1).click()); // hồng
    act(() => cards("checkbox")[0].click());
    act(() => crayon(2).click()); // vàng cam
    act(() => cards("checkbox")[2].click());

    show(other, answers, store);
    show(multi, answers, store);

    expect(answers[multi.id]).toEqual(["A", "C"]);
    const [a, b, c] = cards("checkbox");
    expect(a.style.backgroundColor).toBe(PINK);
    expect(b.style.backgroundColor).toBe("");
    expect(c.style.backgroundColor).toBe(ORANGE);
    expect(crayon(2).getAttribute("aria-pressed")).toBe("true");
  });

  it("single_choice: ô đã chọn giữ màu đã tô", () => {
    const store = createColorFillMemory();
    const answers: Record<string, unknown> = {};

    show(single, answers, store);
    act(() => crayon(1).click());
    act(() => cards("radio")[1].click());

    show(other, answers, store);
    show(single, answers, store);

    expect(answers[single.id]).toBe("B");
    expect(cards("radio")[1].style.backgroundColor).toBe(PINK);
  });

  it("câu con trong question_group không ghi đè màu của nhau", () => {
    const store = createColorFillMemory();
    const answers: Record<string, unknown> = {};
    const child = (id: string) => ({
      id,
      type: "multiple_choice",
      options,
      correctAnswer: ["A"],
      display: { interactionType: "color_fill" },
    });
    const group: PlayerQuestion = {
      id: "g1",
      question_type: "question_group",
      payload: { display: { interactionType: "group" }, children: [child("c1"), child("c2")] },
    };

    show(group, answers, store);
    const palettes = () => container.querySelectorAll("[data-color-fill-palette]");
    act(() => palettes()[0].querySelectorAll("button")[1].click()); // c1: hồng
    act(() => cards("checkbox")[0].click());
    act(() => palettes()[1].querySelectorAll("button")[2].click()); // c2: vàng cam
    act(() => cards("checkbox")[3].click());

    show(other, answers, store);
    show(group, answers, store);

    const all = cards("checkbox");
    expect(all[0].style.backgroundColor).toBe(PINK);
    expect(all[3].style.backgroundColor).toBe(ORANGE);
  });

  it("lượt làm mới (sổ mới) hoặc không có sổ → về màu mặc định như cũ", () => {
    const answers: Record<string, unknown> = {};
    const first = createColorFillMemory();

    show(multi, answers, first);
    act(() => crayon(1).click());
    act(() => cards("checkbox")[0].click());

    show(other, answers, createColorFillMemory());
    show(multi, answers, createColorFillMemory());
    expect(cards("checkbox")[0].style.backgroundColor).toBe(PURPLE);

    show(other, answers);
    show(multi, answers);
    expect(cards("checkbox")[0].style.backgroundColor).toBe(PURPLE);
  });

  it("Làm lại (forgetColorFill) → câu dựng lại với bút và ô về mặc định", () => {
    const store = createColorFillMemory();
    const answers: Record<string, unknown> = {};

    show(multi, answers, store);
    act(() => crayon(1).click()); // hồng
    act(() => cards("checkbox")[0].click());

    delete answers[multi.id];
    forgetColorFill(store, multi.id);
    show(other, answers, store);
    show(multi, answers, store);

    expect(crayon(4).getAttribute("aria-pressed")).toBe("true"); // tím mặc định
    act(() => cards("checkbox")[0].click());
    expect(cards("checkbox")[0].style.backgroundColor).toBe(PURPLE);
  });
});

describe("forgetColorFill", () => {
  it("xoá câu và mọi câu con, không đụng câu khác trùng tiền tố", () => {
    const memo = { fills: {}, brush: PINK };
    const store = createColorFillMemory();
    for (const key of ["g", "g/c1", "g/c2", "g2", "g2/c1"]) store.set(key, memo);

    forgetColorFill(store, "g");

    expect([...store.keys()]).toEqual(["g2", "g2/c1"]);
  });
});
