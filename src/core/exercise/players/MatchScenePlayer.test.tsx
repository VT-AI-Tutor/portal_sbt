import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderInteractionPlayer } from "./dispatch";
import { MatchScenePlayer } from "./MatchScenePlayer";

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

const payload = {
  layout: "scene",
  aspect: "5 / 2",
  items: [{ id: "tray", x: 14, y: 78, content: { blocks: [{ type: "image", url: "/tray.png", alt: "Khay" }] } }],
  targets: [{ id: "three", x: 14, y: 26, label: "3" }],
  correctAnswer: [{ left: "tray", right: "three" }],
  example: { item: "tray", target: "three", locked: true },
};

describe("MatchScenePlayer dispatch", () => {
  it("dispatches legacy scene, positions rich/image nodes, and hydrates canonical edges", () => {
    act(() => root.render(renderInteractionPlayer("matching", payload, {
      answer: [{ item: "tray", target: "three" }],
      submitted: true,
    })));

    const scene = container.querySelector<HTMLElement>('[data-matching-scene="true"]');
    expect(scene).not.toBeNull();
    expect(scene?.style.aspectRatio).toBe("5 / 2");
    expect(container.querySelector('img[alt="Khay"]')).not.toBeNull();
    expect(container.querySelectorAll("svg [data-edge-key]")).toHaveLength(1);
    expect(container.querySelectorAll("button:disabled").length).toBeGreaterThanOrEqual(2);
  });

  it("emits canonical edge arrays", () => {
    const onAnswerChange = vi.fn();
    act(() => root.render(renderInteractionPlayer("matching", { ...payload, example: undefined }, { onAnswerChange })));
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>("button"));
    act(() => buttons.find((button) => button.getAttribute("aria-label") === "Khay")?.click());
    act(() => buttons.find((button) => button.getAttribute("aria-label") === "3")?.click());
    expect(onAnswerChange).toHaveBeenCalledWith([{ item: "tray", target: "three" }]);
  });

  it("merges a default-locked example and blocks removal or alternate targets", () => {
    const onAnswerChange = vi.fn();
    const onStatusChange = vi.fn();
    act(() => root.render(renderInteractionPlayer("matching", {
      ...payload,
      correctAnswer: [],
      example: { item: "tray", target: "three" },
      targets: [...payload.targets, { id: "four", x: 40, y: 26, label: "4" }],
    }, { onAnswerChange, onStatusChange })));
    const source = container.querySelector<HTMLButtonElement>('button[aria-label="Khay"]')!;
    expect(source.disabled).toBe(true);
    expect(container.querySelectorAll("svg [data-edge-key]")).toHaveLength(1);
    act(() => source.click());
    act(() => Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.getAttribute("aria-label") === "4")?.click());
    expect(onAnswerChange).not.toHaveBeenCalled();
    act(() => Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "Kiểm tra")?.click());
    expect(onStatusChange).toHaveBeenLastCalledWith("success");
  });

  it("allows a locked:false example to be removed and emits the effective state", () => {
    const onAnswerChange = vi.fn();
    act(() => root.render(renderInteractionPlayer("matching", {
      ...payload,
      example: { item: "tray", target: "three", locked: false },
    }, { onAnswerChange })));
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>("button"));
    act(() => buttons.find((button) => button.getAttribute("aria-label") === "Khay")?.click());
    act(() => buttons.find((button) => button.getAttribute("aria-label") === "3")?.click());
    expect(onAnswerChange).toHaveBeenLastCalledWith([]);
    expect(container.querySelectorAll("svg [data-edge-key]")).toHaveLength(0);
  });

  it("renders and resolves direct imageUrl and image.url nodes", () => {
    act(() => root.render(renderInteractionPlayer("matching", {
      ...payload,
      example: undefined,
      items: [{ id: "tray", x: 14, y: 78, text: "Khay trực tiếp", imageUrl: "/direct-item.png" }],
      targets: [{ id: "three", x: 14, y: 26, label: "Đích trực tiếp", image: { url: "/direct-target.png" } }],
    }, {})));
    const images = Array.from(container.querySelectorAll<HTMLImageElement>("img"));
    expect(images.map((image) => image.alt)).toEqual(["Khay trực tiếp", "Đích trực tiếp"]);
    expect(images.every((image) => image.src.includes("direct-"))).toBe(true);
  });
});

describe("MatchScenePlayer (legacy) self-check feedback + echo hydration", () => {
  const scenePayload = {
    layout: "scene",
    items: [
      { id: "i1", x: 15, y: 30, text: "Một" },
      { id: "i2", x: 15, y: 70, text: "Hai" },
    ],
    targets: [
      { id: "t1", x: 80, y: 30, label: "Đích A" },
      { id: "t2", x: 80, y: 70, label: "Đích B" },
    ],
    correctAnswer: [
      { left: "i1", right: "t1" },
      { left: "i2", right: "t2" },
    ],
  };

  function sceneButton(text: string): HTMLButtonElement {
    const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (candidate) => candidate.textContent?.includes(text),
    );
    if (!button) throw new Error(`Không tìm thấy nút: ${text}`);
    return button;
  }

  it("button mode: a wrong Kiểm tra marks wrong nodes/edges red + shows the feedback line, and re-pairing clears it", () => {
    act(() => root.render(<MatchScenePlayer title="Q" payload={scenePayload} instantFeedback={false} />));
    act(() => sceneButton("Một").click());
    act(() => sceneButton("Đích B").click()); // i1 -> t2 (sai)
    act(() => sceneButton("Hai").click());
    act(() => sceneButton("Đích A").click()); // i2 -> t1 (sai)
    act(() => sceneButton("Kiểm tra").click());

    expect(sceneButton("Một").className).toContain("border-red-500");
    expect(sceneButton("Hai").className).toContain("border-red-500");
    const lines = Array.from(container.querySelectorAll<SVGLineElement>("svg line"));
    expect(lines.length).toBe(2);
    expect(lines.every((line) => line.getAttribute("stroke") === "#ef4444")).toBe(true);
    // Surface học sinh: dòng chữ phản hồi bị ẩn (presentation.hideInlineFeedback,
    // Owner 4/8) — phản hồi thật là MÀU per-element + âm thanh, assert quanh đây.
    expect(container.textContent).not.toContain("Chưa đúng, thử lại nhé!");
    // No green reveal while the pupil can still retry.
    expect(container.querySelector(".border-green-500")).toBeNull();

    act(() => sceneButton("Một").click());
    act(() => sceneButton("Đích B").click()); // gỡ cặp sai -> xoá trạng thái sai
    expect(container.textContent).not.toContain("Chưa đúng, thử lại nhé!");
    expect(sceneButton("Hai").className).not.toContain("border-red-500");
  });

  it("keeps the in-progress selection when the parent merely echoes the reported answer back", () => {
    const renderPlayer = (answer?: unknown) =>
      act(() => root.render(<MatchScenePlayer title="Q" payload={scenePayload} answer={answer} instantFeedback={false} />));

    renderPlayer(undefined);
    act(() => sceneButton("Một").click());
    act(() => sceneButton("Đích A").click()); // i1 -> t1
    act(() => sceneButton("Hai").click()); // select i2, pairing in progress
    expect(sceneButton("Hai").className).toContain("border-fuchsia-500");

    // Host stores the reported answer and passes it back down (new array
    // identity, same semantic content) — the selection must survive.
    renderPlayer([{ item: "i1", target: "t1" }]);
    expect(sceneButton("Hai").className).toContain("border-fuchsia-500");
    // ...and the pairing can be completed.
    act(() => sceneButton("Đích B").click());
    expect(container.querySelectorAll("svg line")).toHaveLength(2);

    // A semantically different parent answer still rehydrates.
    renderPlayer([]);
    expect(container.querySelectorAll("svg line")).toHaveLength(0);
  });

  it("recordOnly (no key): no Kiểm tra button even in button mode", () => {
    act(() =>
      root.render(
        <MatchScenePlayer
          title="Q"
          payload={{ ...scenePayload, correctAnswer: [] }}
          instantFeedback={false}
        />,
      ),
    );
    expect(container.textContent).not.toContain("Kiểm tra");
  });
});
