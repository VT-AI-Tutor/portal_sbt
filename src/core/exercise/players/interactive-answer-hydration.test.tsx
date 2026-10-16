/**
 * Bước A đồng bộ studio↔web — nhóm INTERACTIVE:
 *
 * 1. Kênh khôi phục qua prop `answer`: mount-với-answer phải hydrate lại lựa
 *    chọn đã lưu (không key-remount). Pikachu là ngoại lệ có chủ đích: emit là
 *    SỐ cặp đã ăn (lossy) → không khôi phục được, test chốt hành vi bỏ qua.
 * 2. Nút tự-chấm "Kiểm tra" bị ẩn ở gradeMode "parent" (luồng thi/parent-graded).
 * 3. revealCorrect === false (BUG-03 web): sau submit, ô ĐÚNG chưa chọn không
 *    được tô xanh (không lộ đáp án); ô SAI đã chọn vẫn tô đỏ.
 */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GradeModeContext, type GradeModeValue } from "./shared";
import { SelectWordsPlayer } from "./SelectWordsPlayer";
import { HighlightTextPlayer } from "./HighlightTextPlayer";
import { ImageColorClassifyPlayer } from "./ImageColorClassifyPlayer";
import { PathConnectPlayer } from "./PathConnectPlayer";
import { TileSelectPlayer } from "./TileSelectPlayer";
import { ImageChoiceSinglePlayer } from "./ImageChoiceSinglePlayer";
import { ImageChoiceMultiPlayer } from "./ImageChoiceMultiPlayer";
import { CheckboxTablePlayer } from "./CheckboxTablePlayer";
import { TrueFalseTablePlayer } from "./TrueFalseTablePlayer";
import { HotspotSinglePlayer } from "./HotspotSinglePlayer";
import { HotspotMultiPlayer } from "./HotspotMultiPlayer";
import { SpotDifferencePlayer } from "./SpotDifferencePlayer";
import { PikachuPlayer } from "./PikachuPlayer";
import { PathTrailPlayer } from "./PathTrailPlayer";

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

function render(node: ReactNode, gradeMode?: GradeModeValue) {
  act(() =>
    root.render(
      gradeMode ? (
        <GradeModeContext.Provider value={gradeMode}>{node}</GradeModeContext.Provider>
      ) : (
        node
      ),
    ),
  );
}

function buttons(): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll("button"));
}

function buttonByText(text: string): HTMLButtonElement {
  const btn = buttons().find((b) => b.textContent?.includes(text));
  expect(btn, `button chứa "${text}"`).toBeTruthy();
  return btn!;
}

const imageOptions = [
  { id: "a", imageUrl: "a.png", text: "A" },
  { id: "b", imageUrl: "b.png", text: "B" },
];

const hotspots = [
  { id: "h1", label: "H1", shape: "circle" as const, x: 0.25, y: 0.25, radius: 0.1 },
  { id: "h2", label: "H2", shape: "circle" as const, x: 0.75, y: 0.75, radius: 0.1 },
];

// ── 1. Restore qua prop `answer` ────────────────────────────────────────────

describe("khôi phục answer (mount-với-answer)", () => {
  it("SelectWordsPlayer: chip theo word index đã lưu về trạng thái selected", () => {
    render(
      <SelectWordsPlayer title="Q" passage="một hai ba" correctWords={[1]} answer={[1]} />,
    );
    const chip = Array.from(container.querySelectorAll('span[role="button"]')).find(
      (el) => el.textContent === "hai",
    ) as HTMLElement;
    expect(chip).toBeTruthy();
    // web-own: default skin web là playful CHỈ-CỜ (không token màu) → chip
    // selected nhận fallback playful bg-yellow-300 (studio: studioSkin bg-blue-50).
    expect(chip.classList.contains("bg-yellow-300")).toBe(true);
  });

  it("HighlightTextPlayer: segment id đã lưu về aria-pressed", () => {
    render(
      <HighlightTextPlayer
        title="Q"
        segments={[
          { id: "s1", text: "mưa" },
          { id: "s2", text: " nắng" },
        ]}
        correctIds={["s1"]}
        answer={["s1"]}
      />,
    );
    const seg = Array.from(container.querySelectorAll('span[role="button"]')).find(
      (el) => el.textContent === "mưa",
    ) as HTMLElement;
    expect(seg).toBeTruthy();
    expect(seg.getAttribute("aria-pressed")).toBe("true");
  });

  it("ImageColorClassifyPlayer: vùng đã tô hiện lại đúng màu", () => {
    render(
      <ImageColorClassifyPlayer
        title="Q"
        imageUrl="img.png"
        categories={[{ id: "c1", label: "Đỏ", color: "#ef4444" }]}
        items={[{ id: "r1", label: "Vùng 1", shape: "rect", x: 0.1, y: 0.1, width: 0.2, height: 0.2 }]}
        correctMappings={{ r1: "c1" }}
        answer={{ r1: "c1" }}
      />,
    );
    const region = container.querySelector('div[title="Vùng 1"]') as HTMLElement;
    expect(region).toBeTruthy();
    // Nền vùng chỉ nhận màu category khi assignments[item.id] tồn tại. (Không
    // có mặt nạ nét vẽ trong jsdom nên vùng đi lối tô hình học.)
    expect(region.style.backgroundColor).toBe("rgba(239, 68, 68, 0.333)");
    expect(region.textContent).toBe("");
  });

  it("PathConnectPlayer: đường đã đi được vẽ lại (số đoạn nối + badge thứ tự)", () => {
    render(
      <PathConnectPlayer
        title="Q"
        nodes={[
          { id: "n1", label: "1", x: 0.1, y: 0.1 },
          { id: "n2", label: "2", x: 0.5, y: 0.5 },
          { id: "n3", label: "3", x: 0.9, y: 0.9 },
        ]}
        correctPath={["n1", "n2", "n3"]}
        answer={["n1", "n2"]}
      />,
    );
    expect(container.querySelectorAll("svg line").length).toBe(1);
  });

  it("TileSelectPlayer (single): id đã lưu về aria-checked", () => {
    render(
      <TileSelectPlayer
        title="Q"
        options={[
          { id: "a", text: "A" },
          { id: "b", text: "B" },
        ]}
        correctId="b"
        answer="b"
      />,
    );
    expect(buttonByText("B").getAttribute("aria-checked")).toBe("true");
    expect(buttonByText("A").getAttribute("aria-checked")).toBe("false");
  });

  it("ImageChoiceSinglePlayer: id đã lưu về aria-checked", () => {
    render(
      <ImageChoiceSinglePlayer title="Q" options={imageOptions} correctId="b" answer="a" />,
    );
    expect(buttonByText("A").getAttribute("aria-checked")).toBe("true");
  });

  it("ImageChoiceMultiPlayer: mảng id đã lưu về aria-checked", () => {
    render(
      <ImageChoiceMultiPlayer title="Q" options={imageOptions} correctIds={["b"]} answer={["b"]} />,
    );
    expect(buttonByText("B").getAttribute("aria-checked")).toBe("true");
    expect(buttonByText("A").getAttribute("aria-checked")).toBe("false");
  });

  it("CheckboxTablePlayer: Record<rowId, colId[]> đã lưu về aria-pressed", () => {
    render(
      <CheckboxTablePlayer
        title="Q"
        columns={[
          { id: "c1", label: "Chẵn" },
          { id: "c2", label: "Lẻ" },
        ]}
        rows={[
          { id: "r1", label: "Hai" },
          { id: "r2", label: "Ba" },
        ]}
        correctCells={{ r1: ["c1"], r2: ["c2"] }}
        answer={{ r1: ["c1"] }}
      />,
    );
    const rowEl = Array.from(container.querySelectorAll("tr")).find((tr) =>
      tr.textContent?.includes("Hai"),
    )!;
    const [c1Btn, c2Btn] = Array.from(rowEl.querySelectorAll("button"));
    expect(c1Btn.getAttribute("aria-pressed")).toBe("true");
    expect(c2Btn.getAttribute("aria-pressed")).toBe("false");
  });

  it("TrueFalseTablePlayer: Record<stmtId, boolean> đã lưu tô lại ô Đ/S", () => {
    render(
      <TrueFalseTablePlayer
        title="Q"
        statements={[
          { id: "s1", text: "Một", correct: true },
          { id: "s2", text: "Hai", correct: false },
        ]}
        answer={{ s1: true }}
      />,
    );
    const rowEl = Array.from(container.querySelectorAll("tr")).find((tr) =>
      tr.textContent?.includes("Một"),
    )!;
    const [dBtn, sBtn] = Array.from(rowEl.querySelectorAll("button"));
    // instant chưa chấm (khôi phục không phát verdict) → trạng thái "selected".
    // web-own: default skin web là playful RỖNG (studio: optionCard("selected")
    // = bg-blue-50) → ô selected nhận fallback của chính player.
    // Fallback đó là NỀN ĐẶC `bg-indigo-500` (trước là `bg-indigo-100`): sọc
    // chẵn/lẻ thân bảng cũng ra bg-indigo-100 nên nền nhạt bị nuốt ở hàng lẻ —
    // xem cellBtn trong TrueFalseTablePlayer.tsx. Ô chưa chọn để nền trắng.
    expect(dBtn.classList.contains("bg-indigo-500")).toBe(true);
    expect(sBtn.classList.contains("bg-indigo-500")).toBe(false);
    expect(sBtn.classList.contains("bg-white")).toBe(true);
  });

  it("HotspotSinglePlayer: id đã lưu hiện marker neo tại tâm hotspot", () => {
    render(
      <HotspotSinglePlayer
        title="Q"
        imageUrl="img.png"
        hotspots={hotspots}
        correctId="h1"
        answer="h1"
      />,
    );
    expect(container.querySelector('[data-hotspot-marker="h1"]')).toBeTruthy();
  });

  it("HotspotMultiPlayer: mảng id đã lưu bật ring của đúng hotspot", () => {
    render(
      <HotspotMultiPlayer
        title="Q"
        imageUrl="img.png"
        hotspots={hotspots}
        correctIds={["h1"]}
        answer={["h1"]}
      />,
    );
    const m1 = container.querySelector('[data-hotspot-marker="h1"]') as HTMLElement;
    const m2 = container.querySelector('[data-hotspot-marker="h2"]') as HTMLElement;
    // Hotspot chưa chọn giữ viền transparent; hotspot khôi phục thì không.
    expect(m2.style.borderColor).toBe("transparent");
    expect(m1.style.borderColor).not.toBe("transparent");
  });

  it("SpotDifferencePlayer: mảng id đã tìm thấy khôi phục bộ đếm", () => {
    render(
      <SpotDifferencePlayer
        title="Q"
        imageA="a.png"
        imageB="b.png"
        differences={[
          { id: "d1", x: 0.2, y: 0.2 },
          { id: "d2", x: 0.8, y: 0.8 },
        ]}
        answer={["d1"]}
      />,
    );
    expect(container.textContent).toContain("Đã tìm: 1 / 2");
  });

  it("PikachuPlayer: KHÔNG khôi phục (emit = số cặp, lossy) — mount với answer không đổi bảng", () => {
    render(
      <PikachuPlayer
        title="Q"
        tiles={[
          { id: "t1", symbol: "🐱" },
          { id: "t2", symbol: "🐱" },
        ]}
        answer={1}
      />,
    );
    // Bảng vẫn nguyên: chưa cặp nào bị xoá dù answer nói 1 cặp.
    expect(container.textContent).toContain("Đã ăn: 0 / 1");
    expect(buttons().length).toBe(2);
  });

  it("PathTrailPlayer: envelope {answer:[...]} hydrate lại thanh tiến độ", () => {
    render(
      <PathTrailPlayer
        title="Q"
        totalSteps={3}
        child={{ id: "c", render: () => null }}
        answer={{ answer: ["n1", "n2"], progress: 2 / 3, stepIndex: 2 }}
      />,
    );
    expect(container.textContent).toContain("Bước 2 / 3");
  });
});

// ── 2. Ẩn nút "Kiểm tra" ở gradeMode parent ─────────────────────────────────

describe('gradeMode "parent" ẩn nút tự-chấm', () => {
  const parent: GradeModeValue = { mode: "parent" };

  const cases: Array<[string, ReactNode]> = [
    [
      "SelectWordsPlayer",
      <SelectWordsPlayer key="sw" title="Q" passage="một hai" correctWords={[0]} instantFeedback={false} />,
    ],
    [
      "HighlightTextPlayer",
      <HighlightTextPlayer
        key="ht"
        title="Q"
        segments={[{ id: "s1", text: "mưa" }]}
        correctIds={["s1"]}
        instantFeedback={false}
      />,
    ],
    [
      "TileSelectPlayer (multiple)",
      <TileSelectPlayer
        key="ts"
        title="Q"
        options={[
          { id: "a", text: "A" },
          { id: "b", text: "B" },
        ]}
        correctId=""
        multiple
        correctIds={["a", "b"]}
        instantFeedback={false}
      />,
    ],
    [
      "ImageChoiceMultiPlayer",
      <ImageChoiceMultiPlayer
        key="icm"
        title="Q"
        options={imageOptions}
        correctIds={["b"]}
        instantFeedback={false}
      />,
    ],
    [
      "CheckboxTablePlayer",
      <CheckboxTablePlayer
        key="cbt"
        title="Q"
        columns={[{ id: "c1", label: "C1" }]}
        rows={[{ id: "r1", label: "R1" }]}
        correctCells={{ r1: ["c1"] }}
        instantFeedback={false}
      />,
    ],
    [
      "TrueFalseTablePlayer",
      <TrueFalseTablePlayer
        key="tft"
        title="Q"
        statements={[{ id: "s1", text: "Một", correct: true }]}
        instantFeedback={false}
      />,
    ],
    [
      "HotspotMultiPlayer",
      <HotspotMultiPlayer
        key="hm"
        title="Q"
        imageUrl="img.png"
        hotspots={hotspots}
        correctIds={["h1"]}
        instantFeedback={false}
      />,
    ],
  ];

  for (const [name, node] of cases) {
    it(`${name}: parent mode không render "Kiểm tra"`, () => {
      render(node, parent);
      expect(buttons().some((b) => b.textContent?.includes("Kiểm tra"))).toBe(false);
    });
  }

  it('sanity: gradeMode self (mặc định) VẪN render "Kiểm tra" khi instant tắt', () => {
    render(
      <ImageChoiceMultiPlayer
        title="Q"
        options={imageOptions}
        correctIds={["b"]}
        instantFeedback={false}
      />,
    );
    expect(buttons().some((b) => b.textContent?.includes("Kiểm tra"))).toBe(true);
  });
});

// ── 3. revealCorrect === false (BUG-03 web) ─────────────────────────────────

describe("revealCorrect=false: không lộ ô đúng chưa chọn sau submit", () => {
  it("ImageChoiceMultiPlayer: đáp án sai → ô đúng chưa chọn KHÔNG xanh, ô sai đã chọn vẫn đỏ", () => {
    render(
      <ImageChoiceMultiPlayer
        title="Q"
        options={imageOptions}
        correctIds={["b"]}
        answer={["a"]}
        submitted
      />,
      { mode: "parent", result: "incorrect", revealCorrect: false },
    );
    const correctUnpicked = buttonByText("B");
    const wrongPicked = buttonByText("A");
    expect(correctUnpicked.classList.contains("bg-green-50")).toBe(false);
    expect(wrongPicked.classList.contains("bg-red-50")).toBe(true);
  });

  it("ImageChoiceMultiPlayer: mặc định (revealCorrect undefined) vẫn tô xanh ô đúng sau submit", () => {
    render(
      <ImageChoiceMultiPlayer
        title="Q"
        options={imageOptions}
        correctIds={["b"]}
        answer={["a"]}
        submitted
      />,
      { mode: "parent", result: "incorrect" },
    );
    expect(buttonByText("B").classList.contains("bg-green-50")).toBe(true);
  });

  it("TileSelectPlayer: revealCorrect=false → tile đúng chưa chọn không xanh", () => {
    render(
      <TileSelectPlayer
        title="Q"
        options={[
          { id: "a", text: "A" },
          { id: "b", text: "B" },
        ]}
        correctId="b"
        answer="a"
        submitted
      />,
      { mode: "parent", result: "incorrect", revealCorrect: false },
    );
    // web-own: default skin web là playful RỖNG → fallback TileSelect:
    // correct-reveal → bg-green-500, wrong → bg-red-500 (studio skin: bg-green-50/bg-red-50).
    expect(buttonByText("B").classList.contains("bg-green-500")).toBe(false);
    expect(buttonByText("A").classList.contains("bg-red-500")).toBe(true);
  });

  it("ImageChoiceSinglePlayer: revealCorrect=false → ô đúng chưa chọn không xanh", () => {
    render(
      <ImageChoiceSinglePlayer
        title="Q"
        options={imageOptions}
        correctId="b"
        answer="a"
        submitted
      />,
      { mode: "parent", result: "incorrect", revealCorrect: false },
    );
    expect(buttonByText("B").classList.contains("bg-green-50")).toBe(false);
    expect(buttonByText("A").classList.contains("bg-red-50")).toBe(true);
  });
});
