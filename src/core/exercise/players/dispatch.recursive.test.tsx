import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuestionPlayer } from "../QuestionPlayer";
import { AccentProvider } from "../skin/accent-context";
import { AudioAnchoredPlayer } from "./AudioAnchoredPlayer";
import { ChainMatchPlayer } from "./ChainMatchPlayer";
import { MatchingScenePlayer } from "./MatchingScenePlayer";
import { PathTrailPlayer } from "./PathTrailPlayer";
import { QuestionGroupPlayer } from "./QuestionGroupPlayer";
import { RendererCapabilityDiagnostic } from "./RendererCapabilityDiagnostic";
import { SingleChoicePlayer } from "./SingleChoicePlayer";
import { VideoAnchoredPlayer } from "./VideoAnchoredPlayer";
import { renderInteractionPlayer, type PlayerHandlers } from "./dispatch";
import { PLAYER_MANIFEST } from "./manifest";
import type { GradeModeValue } from "./shared";

// Test-only element inspection needs heterogeneous player prop records.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyElement = ReactElement<Record<string, any>>;
type DispatchElement = ReactElement<{ value: GradeModeValue; children: AnyElement }>;

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
  vi.restoreAllMocks();
});

function dispatch(type: string, payload: Record<string, unknown>, handlers: PlayerHandlers = {}) {
  return renderInteractionPlayer(type, payload, handlers) as DispatchElement;
}

/** Players render inside the AccentProvider identity boundary (dispatch wraps
 * once per resolved component); diagnostics render without it. */
function unwrapAccent(element: AnyElement): AnyElement {
  return element.type === AccentProvider
    ? (element.props.children as AnyElement)
    : element;
}

function content(element: DispatchElement): AnyElement {
  const child = element.props.children;
  return unwrapAccent(
    child.type === "fieldset" ? (child.props.children as AnyElement) : child,
  );
}

function expectDisabled(element: DispatchElement) {
  const fieldset = element.props.children;
  expect(fieldset.type).toBe("fieldset");
  expect(fieldset.props.disabled).toBe(true);
  expect(fieldset.props["data-player-disabled"]).toBe("true");
  return unwrapAccent(fieldset.props.children as AnyElement);
}

const choice = {
  type: "single_choice",
  options: [
    { id: "a", text: "A" },
    { id: "b", text: "B" },
  ],
  correctAnswer: "a",
};

describe("learner-facing title boundary", () => {
  it("never promotes any capability registry label into a player title", () => {
    for (const entry of PLAYER_MANIFEST) {
      const payload: Record<string, unknown> = {
        display: { interactionType: entry.interactionType },
      };
      // Loại nào render chẩn đoán thay vì player khi payload rỗng thì phải đưa
      // dữ liệu tối thiểu, nếu không phép quét này soi nhầm khối chẩn đoán
      // (không có prop `title`) chứ không phải player.
      if (entry.type === "path_trail") {
        payload.child = { type: "single_choice", options: [] };
      }
      if (entry.type === "coloring") {
        payload.regions = [{ id: "r1", label: "Ô 1" }];
      }
      if (entry.type === "crossword") {
        payload.entries = [{ id: "e1", startRow: 0, startCol: 0, direction: "across", length: 2 }];
      }

      const rendered = content(dispatch(entry.type, payload));
      expect(rendered.props.title, `${entry.type}/${entry.interactionType}`).toBe("");
      expect(rendered.props.title, entry.label).not.toBe(entry.label);
    }
  });
});

describe("scene dispatch", () => {
  it("maps the dedicated scene player with canonical nodes, edges, media, and legacy answer hydration", () => {
    const rendered = dispatch(
      "matching",
      {
        layout: "scene",
        items: [{ id: "left", text: "Trái", x: 7, y: 40, imageUrl: "/left.png" }],
        targets: [
          { id: "right-1", label: "Phải 1", x: 91, y: 25 },
          { id: "right-2", content: { blocks: [{ type: "paragraph", text: "Phải 2" }] } },
        ],
        correctAnswer: [
          { item: "left", target: "right-1" },
          { left: "left", right: "right-2" },
        ],
        example: { from: "left", to: "right-1" },
        background: { url: "/scene.png", alt: "Cảnh", ratio: "5:2" },
        maxWidth: "680px",
      },
      { answer: { left: ["right-1", "right-2"] } },
    );

    const player = content(rendered);
    expect(player.type).toBe(MatchingScenePlayer);
    expect(player.props.answer).toEqual([
      { item: "left", target: "right-1" },
      { item: "left", target: "right-2" },
    ]);
    expect(player.props.correctEdges).toEqual([
      { item: "left", target: "right-1" },
      { item: "left", target: "right-2" },
    ]);
    expect(player.props.lockedExampleEdge).toEqual({ item: "left", target: "right-1" });
    expect(player.props.background).toMatchObject({ alt: "Cảnh", ratio: "5:2" });
    expect(player.props.background.url).toContain("/scene.png");
    expect(player.props.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "left", kind: "item", x: 7, y: 40 }),
        expect.objectContaining({ id: "right-1", kind: "target", x: 91, y: 25 }),
        expect.objectContaining({ id: "right-2", kind: "target", x: 82 }),
      ]),
    );
    expect(
      player.props.nodes.find((node: { id: string }) => node.id === "right-2").y,
    ).toBeCloseTo(100 / 1.5);
  });
});

describe("strict capability diagnostics", () => {
  it.each([
    ["future_type", {}, "UNKNOWN_TYPE"],
    ["single_choice", { display: { interactionType: "future" } }, "UNKNOWN_INTERACTION"],
    ["single_choice", { display: { layout: "spiral" } }, "UNSUPPORTED_LAYOUT"],
  ] as const)("returns %s failures as a top-level diagnostic", (type, payload, code) => {
    const diagnostic = content(dispatch(type, payload));
    expect(diagnostic.type).toBe(RendererCapabilityDiagnostic);
    expect(diagnostic.props.code).toBe(code);
    expect(diagnostic.props.scope).toBe("top-level");
  });

  it("renders unknown QuestionPlayer types instead of returning null", () => {
    act(() => {
      root.render(
        <QuestionPlayer
          question={{ id: "q-unknown", question_type: "future_type", payload: {} }}
          index={0}
        />,
      );
    });

    const alert = container.querySelector<HTMLElement>('[role="alert"]');
    expect(alert?.dataset.diagnosticCode).toBe("UNKNOWN_TYPE");
    expect(alert?.dataset.diagnosticScope).toBe("top-level");
    expect(alert?.textContent).toContain("future_type");
  });

  it("uses the unified legacy diagnostic for a wrapper missing its child", () => {
    const diagnostic = content(dispatch("path_trail", {}));
    expect(diagnostic.type).toBe(RendererCapabilityDiagnostic);
    expect(diagnostic.props).toMatchObject({
      code: "UNSUPPORTED_LEGACY_CAPABILITY",
      legacyCapability: "missing-child",
      scope: "top-level",
    });
  });

  it.each([
    ["grid_2", 2],
    ["grid_4", 4],
  ] as const)("dispatches a question_group with canonical %s", (layout, columns) => {
    const wrapper = content(
      dispatch("question_group", {
        display: { interactionType: "group", layout },
        children: [{ id: "child-a", ...choice }],
      }),
    );

    expect(wrapper.type).toBe(QuestionGroupPlayer);
    expect(wrapper.props.layout).toMatchObject({
      key: layout,
      mode: "grid",
      columns,
    });
  });

  it("marks a five-child image group as picture-led so its wrapper can cap desktop rows", () => {
    const wrapper = content(
      dispatch("question_group", {
        display: { interactionType: "group", layout: "grid_2" },
        children: Array.from({ length: 5 }, (_, index) => ({
          id: `picture-${index}`,
          type: "fill_blank",
          content: { blocks: [{ type: "image", url: `/picture-${index}.webp` }] },
        })),
      }),
    );

    expect(wrapper.type).toBe(QuestionGroupPlayer);
    expect(wrapper.props.pictureChildren).toEqual([true, true, true, true, true]);
  });

  it("does not mark a mixed-content group as picture-led", () => {
    const wrapper = content(
      dispatch("question_group", {
        display: { interactionType: "group", layout: "grid_2" },
        children: [
          { id: "picture", type: "fill_blank", content: { blocks: [{ type: "image", url: "/picture.webp" }] } },
          { id: "text", type: "fill_blank", content: { blocks: [{ type: "paragraph", text: "Đọc kỹ rồi trả lời câu hỏi này." }] } },
        ],
      }),
    );

    expect(wrapper.type).toBe(QuestionGroupPlayer);
    expect(wrapper.props.pictureChildren).toEqual([true, false]);
  });

  it("cờ ô tranh theo TỪNG con để một ô chữ không phủ quyết cả lưới (67251341/bai1)", () => {
    const wrapper = content(
      dispatch("question_group", {
        display: { interactionType: "group" },
        children: [
          { id: "a1", type: "fill_blank", content: { blocks: [{ type: "image", url: "/a1.webp" }] } },
          { id: "a2", type: "fill_blank", content: { blocks: [{ type: "image", url: "/a2.webp" }] } },
          { id: "a3", type: "fill_blank", content: { blocks: [{ type: "image", url: "/a3.webp" }] } },
          { id: "b", type: "fill_blank", content: { blocks: [{ type: "paragraph", text: "Viết số thích hợp vào chỗ chấm." }] } },
        ],
      }),
    );

    expect(wrapper.props.pictureChildren).toEqual([true, true, true, false]);
    expect(wrapper.props.layout).toMatchObject({ key: "list", authored: false });
  });

  it("keeps a non-canonical question_group layout as a diagnostic", () => {
    const diagnostic = content(
      dispatch("question_group", {
        display: { interactionType: "group", layout: "spiral" },
        children: [{ id: "child-a", ...choice }],
      }),
    );

    expect(diagnostic.type).toBe(RendererCapabilityDiagnostic);
    expect(diagnostic.props).toMatchObject({
      code: "UNSUPPORTED_LAYOUT",
      type: "question_group",
      interactionType: "group",
      layout: "spiral",
      scope: "top-level",
    });
  });
});

describe("nested cloze dispatch", () => {
  it("renders an image-only cloze child's content before its input inside a question group", () => {
    act(() => {
      root.render(
        <QuestionPlayer
          question={{
            id: "b18_i2_q1",
            question_type: "question_group",
            payload: {
              type: "question_group",
              sharedContent: { blocks: [{ type: "paragraph", text: "Chọn thực hiện bài tập a hoặc b." }] },
              display: { layout: "grid_2" },
              questions: [
                {
                  id: "b18_i2_q1_1",
                  type: "cloze",
                  content: { blocks: [{ type: "image", url: "/uploads/books/demo/media/chim-khuou.webp", alt: "Chim khướu" }] },
                  blanks: [{ id: "blank_khuou" }],
                  correctAnswer: { blank_khuou: ["chim khướu"] },
                },
                {
                  id: "b18_i2_q1_2",
                  type: "cloze",
                  content: { blocks: [{ type: "image", url: "/uploads/books/demo/media/huou.webp", alt: "Hươu cao cổ" }] },
                  blanks: [{ id: "blank_huou" }],
                  correctAnswer: { blank_huou: ["hươu"] },
                },
              ],
            },
          }}
          index={0}
        />,
      );
    });

    const images = Array.from(container.querySelectorAll("img"));
    // web-own: base URL media theo env của web (localhost:13070), không pin
    // origin studio (localhost:8000) — chỉ pin path đã resolve tuyệt đối.
    // `resolveAssetUrl` chỉ ghép base khi env/config có API base (máy dev có
    // .env.local → tuyệt đối; checkout sạch/CI → giữ nguyên đường dẫn tương đối).
    // Phân giải kèm base giả để khẳng định PATH ở cả hai trường hợp — bản cũ
    // `new URL(src)` ném "Invalid URL" trên mọi máy không có .env.local.
    const sources = images.map((image) => String(image.getAttribute("src")));
    expect(sources.map((src) => new URL(src, "http://web.test").pathname)).toEqual([
      "/uploads/books/demo/media/chim-khuou.webp",
      "/uploads/books/demo/media/huou.webp",
    ]);
    expect(container.querySelectorAll('input[type="text"]')).toHaveLength(2);
  });

  it("hydrates saved values for inline cloze and fill-blank players", () => {
    act(() => {
      root.render(renderInteractionPlayer("cloze", {
        display: { interactionType: "inline" },
        content: { blocks: [{ type: "paragraph", text: "Câu {blank_1}." }] },
        correctAnswer: { blank_1: "đáp án" },
      }, { answer: { blank_1: "đã lưu" } }));
    });
    expect(container.querySelector<HTMLInputElement>("input")?.value).toBe("đã lưu");

    act(() => {
      root.render(renderInteractionPlayer("fill_blank", {
        display: { interactionType: "text" },
        content: { blocks: [{ type: "paragraph", text: "Câu {blank_2}." }] },
        correctAnswer: { blank_2: "đáp án" },
      }, { answer: { blank_2: "cũng đã lưu" } }));
    });
    expect(container.querySelector<HTMLInputElement>("input")?.value).toBe("cũng đã lưu");
  });

  it("keeps surrounding text when placeholders live inside a layout column", () => {
    act(() => {
      root.render(renderInteractionPlayer("cloze", {
        display: { interactionType: "inline" },
        content: {
          blocks: [{
            type: "layout",
            layout: "two-column",
            columns: [
              [{ type: "paragraph", text: "Trước {blank_1} sau" }],
              [{ type: "paragraph", text: "Nội dung cột phụ" }],
            ],
          }],
        },
        correctAnswer: { blank_1: "đúng" },
      }, {}));
    });

    expect(container.querySelectorAll('input[type="text"]')).toHaveLength(1);
    expect(container.textContent).toContain("Trước");
    expect(container.textContent).toContain("sau");
    expect(container.textContent).not.toContain("{blank_1}");
  });
});

describe("question_group stem dedup", () => {
  const stem = "Đọc đoạn văn trong SGK trang 165 và trả lời câu hỏi.";
  const stemBlocks = { blocks: [{ type: "paragraph", text: stem }] };

  it("drops the group's own content when sharedContent exists (extraction data duplicates the stem)", () => {
    const wrapper = content(
      dispatch("question_group", {
        content: stemBlocks,
        sharedContent: stemBlocks,
        children: [{ id: "child-a", ...choice }],
      }),
    );
    expect(wrapper.type).toBe(QuestionGroupPlayer);
    expect(wrapper.props.richContent).toBeUndefined();
    expect(wrapper.props.sharedContent).toEqual(stemBlocks);
  });

  it("keeps content as the only stem source when sharedContent is absent", () => {
    const wrapper = content(
      dispatch("question_group", {
        content: stemBlocks,
        children: [{ id: "child-a", ...choice }],
      }),
    );
    expect(wrapper.props.richContent).toEqual(stemBlocks);
    expect(wrapper.props.sharedContent).toBeUndefined();
  });

  it("renders the duplicated stem exactly once", () => {
    act(() => {
      root.render(
        <QuestionPlayer
          question={{
            id: "q-group-dup",
            question_type: "question_group",
            payload: {
              type: "question_group",
              content: stemBlocks,
              sharedContent: stemBlocks,
              children: [{ id: "child-a", ...choice }],
            },
          }}
          index={0}
        />,
      );
    });

    const text = container.textContent ?? "";
    expect(text.split(stem).length - 1).toBe(1);
  });
});

describe("recursive wrapper inheritance", () => {
  it("propagates child answer, result, submitted, disabled, grade mode, and status fallback", () => {
    const onStatusChange = vi.fn();
    const wrapper = expectDisabled(
      dispatch(
        "question_group",
        { children: [{ id: "child-a", ...choice }] },
        {
          answer: { answers: { "child-a": "b" } },
          result: { results: { "child-a": "incorrect" } },
          submitted: true,
          disabled: true,
          gradeMode: "parent",
          onStatusChange,
        },
      ),
    );
    expect(wrapper.type).toBe(QuestionGroupPlayer);

    const nested = wrapper.props.children[0].render({
      onAnswerChange: vi.fn(),
    }) as DispatchElement;
    expect(nested.props.value).toEqual({ mode: "parent", result: "incorrect" });
    const child = expectDisabled(nested);
    expect(child.type).toBe(SingleChoicePlayer);
    expect(child.props).toMatchObject({ answer: "b", submitted: true, compact: true });
    expect(child.props.onStatusChange).toBe(onStatusChange);
  });

  it.each([
    ["children", "children[0]"],
    ["subQuestions", "subQuestions[0]"],
    ["questions", "questions[0]"],
  ] as const)("marks unknown %s entries as nested at %s", (field, path) => {
    const wrapper = content(
      dispatch("question_group", { [field]: [{ id: "nested", type: "future_type" }] }),
    );
    const nested = wrapper.props.children[0].render({
      onAnswerChange: vi.fn(),
    }) as DispatchElement;
    const diagnostic = content(nested);

    expect(diagnostic.type).toBe(RendererCapabilityDiagnostic);
    expect(diagnostic.props).toMatchObject({
      code: "UNKNOWN_TYPE",
      path,
      scope: "nested",
    });
  });

  it.each([
    [
      { id: "nested", type: "single_choice", display: { interactionType: "future" } },
      "UNKNOWN_INTERACTION",
    ],
    [
      { id: "nested", type: "single_choice", display: { layout: "spiral" } },
      "UNSUPPORTED_LAYOUT",
    ],
    [{ id: "nested", type: "path_trail" }, "UNSUPPORTED_LEGACY_CAPABILITY"],
  ] as const)("keeps nested resolver failure %s strict", (childQuestion, code) => {
    const wrapper = content(
      dispatch("question_group", { children: [childQuestion] }),
    );
    const nested = wrapper.props.children[0].render({
      onAnswerChange: vi.fn(),
    }) as DispatchElement;
    const diagnostic = content(nested);

    expect(diagnostic.type).toBe(RendererCapabilityDiagnostic);
    expect(diagnostic.props).toMatchObject({ code, path: "children[0]", scope: "nested" });
  });

  it("uses the single-child answer/result envelopes for path trails", () => {
    const wrapper = content(
      dispatch(
        "path_trail",
        { child: { id: "trail-question", ...choice } },
        {
          answer: { answer: "b", progress: 0.5 },
          result: { results: { answer: "correct" } },
          gradeMode: "parent",
          submitted: true,
        },
      ),
    );
    expect(wrapper.type).toBe(PathTrailPlayer);

    const nested = wrapper.props.child.render({ onAnswerChange: vi.fn() }) as DispatchElement;
    expect(nested.props.value).toEqual({ mode: "parent", result: "correct" });
    expect(content(nested).props).toMatchObject({ answer: "b", submitted: true, compact: true });
  });

  it.each([
    ["video", VideoAnchoredPlayer],
    ["audio", AudioAnchoredPlayer],
  ] as const)("propagates state through %s media anchors", (interactionType, Player) => {
    const wrapper = expectDisabled(
      dispatch(
        "media_anchored",
        {
          display: { interactionType },
          videoUrl: "/video.mp4",
          audioUrl: "/audio.mp3",
          anchors: [{ id: "anchor-1", time: 12, question: choice }],
        },
        {
          answer: { "anchor-1": "b" },
          result: { "anchor-1": "incorrect" },
          submitted: true,
          disabled: true,
          gradeMode: "parent",
        },
      ),
    );
    expect(wrapper.type).toBe(Player);

    const nested = wrapper.props.anchors[0].render({ onAnswerChange: vi.fn() }) as DispatchElement;
    expect(nested.props.value).toEqual({ mode: "parent", result: "incorrect" });
    const child = expectDisabled(nested);
    expect(child.type).toBe(SingleChoicePlayer);
    expect(child.props).toMatchObject({ answer: "b", submitted: true, compact: true });
  });
});

describe("question_group shared-content block merge (issue #442, b21_q21)", () => {
  const instructionText = "Viết số thích hợp vào chỗ chấm (theo mẫu).";
  const exampleAlt = "Mẫu: khay bánh ma-ca-rong";
  // b21_q21 shape: content holds the full shared area (incl. the example
  // image); sharedContent is a fabricated 1-paragraph copy of the stem only.
  const b21Content = {
    blocks: [
      { type: "paragraph", text: "Tiết 6", style: "context-box", align: "center" },
      { type: "paragraph", text: instructionText },
      {
        type: "image",
        url: "assets/images/bai1_t6q1_a.png",
        alt: exampleAlt,
        width: "30%",
        align: "center",
      },
      { type: "paragraph", text: "Mẫu: 13 gồm 1 chục và 3 đơn vị.", align: "center" },
    ],
  };
  const b21Shared = { blocks: [{ type: "paragraph", text: instructionText }] };

  it("merges content-only blocks into sharedContent instead of dropping content", () => {
    const wrapper = content(
      dispatch("question_group", {
        content: b21Content,
        sharedContent: b21Shared,
        children: [{ id: "child-a", ...choice }],
      }),
    );
    expect(wrapper.type).toBe(QuestionGroupPlayer);
    // content is a superset of shared → content's blocks in content order.
    expect(wrapper.props.sharedContent).toEqual(b21Content);
    expect(wrapper.props.richContent).toBeUndefined();
  });

  it("renders the example image and the duplicated instruction exactly once, in order", () => {
    act(() => {
      root.render(
        <QuestionPlayer
          question={{
            id: "b21_q21",
            question_type: "question_group",
            payload: {
              type: "question_group",
              display: { layout: "grid_2" },
              content: b21Content,
              sharedContent: b21Shared,
              subQuestions: [
                { id: "b21_q21_b", ...choice },
                { id: "b21_q21_c", ...choice },
                { id: "b21_q21_d", ...choice },
              ],
            },
          }}
          index={0}
        />,
      );
    });

    // The content-only image block survives the merge.
    const images = container.querySelectorAll(`img[alt="${exampleAlt}"]`);
    expect(images).toHaveLength(1);
    expect(images[0].getAttribute("src")).toContain("bai1_t6q1_a.png");

    // The duplicated instruction paragraph renders exactly once.
    const text = container.textContent ?? "";
    expect(text.split(instructionText).length - 1).toBe(1);

    // Block order is preserved: title → instruction → example caption.
    const tietIdx = text.indexOf("Tiết 6");
    const instructionIdx = text.indexOf(instructionText);
    const mauIdx = text.indexOf("Mẫu: 13 gồm 1 chục và 3 đơn vị.");
    expect(tietIdx).toBeGreaterThanOrEqual(0);
    expect(instructionIdx).toBeGreaterThan(tietIdx);
    expect(mauIdx).toBeGreaterThan(instructionIdx);

    // All three children still render.
    expect(
      container.querySelector('[data-layout-region="question-group-children"]')
        ?.children,
    ).toHaveLength(3);
  });

  // Live DB shape: the backend-synced sharedContent is ONE paragraph whose
  // text is the CONCATENATION of every content paragraph (newlines included).
  // Regression: that paragraph must not survive the merge next to the block
  // breakdown — it was rendered as a bold <h2> summary duplicating all text.
  const b21ConcatenatedShared = {
    blocks: [
      {
        type: "paragraph",
        text:
          "Tiết 6\nViết số thích hợp vào chỗ chấm (theo mẫu).\nMẫu: 13 gồm 1 chục và 3 đơn vị.",
      },
    ],
  };

  it("shared text renders exactly once when sharedContent is a concatenated stem paragraph (live b21_q21)", () => {
    act(() => {
      root.render(
        <QuestionPlayer
          question={{
            id: "b21_q21",
            question_type: "question_group",
            payload: {
              type: "question_group",
              display: { layout: "grid_2" },
              content: b21Content,
              sharedContent: b21ConcatenatedShared,
              subQuestions: [
                { id: "b21_q21_b", ...choice },
                { id: "b21_q21_c", ...choice },
                { id: "b21_q21_d", ...choice },
              ],
            },
          }}
          index={0}
        />,
      );
    });

    const text = container.textContent ?? "";
    // Every shared text piece appears exactly ONCE in the DOM.
    expect(text.split(instructionText).length - 1).toBe(1);
    expect(text.split("Tiết 6").length - 1).toBe(1);
    expect(text.split("Mẫu: 13 gồm 1 chục và 3 đơn vị.").length - 1).toBe(1);

    // No heading re-renders the whole concatenated stem above the breakdown.
    const headings = Array.from(container.querySelectorAll("h2"));
    expect(
      headings.filter((h) => (h.textContent ?? "").includes("\n")),
    ).toHaveLength(0);

    // The example image still survives the merge.
    expect(container.querySelectorAll(`img[alt="${exampleAlt}"]`)).toHaveLength(1);

    // Children still render under grid_2.
    expect(
      container.querySelector('[data-layout-region="question-group-children"]')
        ?.children,
    ).toHaveLength(3);
  });
});

// Owner 8/8: câu con trong ô của wrapper bỏ padding MÀN của PlayerShell —
// vỏ ô (p-3 sm:p-4) là lớp padding duy nhất; shell cấp cao giữ nguyên.
describe("nested child shell padding", () => {
  it("child shells drop the screen padding; the group's own shell keeps it", () => {
    act(() => {
      root.render(
        <QuestionPlayer
          question={{
            id: "pad_q",
            question_type: "question_group",
            payload: {
              type: "question_group",
              display: { layout: "grid_2" },
              content: { blocks: [{ type: "paragraph", text: "Đề bài" }] },
              subQuestions: [
                { id: "pad_q_a", ...choice },
                { id: "pad_q_b", ...choice },
              ],
            },
          }}
          index={0}
        />,
      );
    });

    const shells = Array.from(container.querySelectorAll<HTMLElement>("div.relative.flex-1"));
    // Marker padding màn: md:p-4 (PR #148 giảm nửa từ md:p-8 — đừng khoá số cũ).
    const screenPadded = shells.filter((s) => s.className.includes("md:p-4"));
    const nestedShells = shells.filter((s) => !s.className.includes("md:p-4"));
    // Shell cấp cao của nhóm giữ padding màn; hai shell con bỏ.
    expect(screenPadded).toHaveLength(1);
    expect(nestedShells).toHaveLength(2);
    // Và CHỈ shell cấp cao mới khai cắt/cuộn. Ở câu con, lớp cắt không bao giờ
    // cuộn (cao bằng nội dung) nhưng lại xén hiệu ứng phóng của thẻ nằm sát mép
    // — từ lúc `nested` bỏ padding màn thì thẻ đáp án chạm đúng mép lớp này.
    expect(screenPadded[0].className).toContain("overflow-y-auto");
    for (const shell of nestedShells) {
      expect(shell.className).not.toContain("overflow-y-auto");
      expect(shell.parentElement?.className).not.toContain("overflow-hidden");
    }
    // Con phải nằm TRONG shell cấp cao (sanity: đúng shell bị kiểm).
    expect(nestedShells.every((s) => screenPadded[0].contains(s))).toBe(true);

    // Vỏ ô giữ padding ĐỀU 4 cạnh (p-1.5 sm:p-2 — Owner 12/8 giảm nửa): pt-0
    // (ce48878) từng làm câu con không có header dính sát mép trên ô — hồi ở
    // PR #150, xem QuestionGroupPlayer.test.tsx.
    const tile = container.querySelector<HTMLElement>(
      '[data-layout-region="question-group-children"] > div',
    );
    expect(tile?.className).toContain("p-1.5");
    expect(tile?.className).toContain("sm:p-2");
    expect(tile?.className).not.toContain("pt-0");
  });
});

describe("#706 matching example prop plumbing", () => {
  it("#706: forwards the FULL example array to the chain player (no [0] truncation)", () => {
    // Chốt hồi quy cho `exampleEdges[0]` cũ ở nhánh scene: mẫu của chuỗi là HAI
    // cạnh (`24 → Gấp 2 lần → 48`), cắt còn một cạnh là đúng khe hở mà #706 vá.
    const element = content(dispatch("matching", {
      type: "matching",
      display: { interactionType: "chain" },
      columns: [
        { id: "left", items: [{ id: "L24", text: "24" }] },
        { id: "middle", items: [{ id: "M2", text: "Gấp 2 lần" }] },
        { id: "right", items: [{ id: "R48", text: "48" }] },
      ],
      correctAnswer: [
        { item: "L24", target: "M2" },
        { item: "M2", target: "R48" },
      ],
      example: [
        { item: "L24", target: "M2" },
        { item: "M2", target: "R48" },
      ],
    }));

    expect(element.type).toBe(ChainMatchPlayer);
    expect(element.props.exampleEdges).toEqual([
      { item: "L24", target: "M2" },
      { item: "M2", target: "R48" },
    ]);
    expect(element.props.exampleLocked).toBe(true);
  });
});

describe("question_group với con hotspot correctAnswer {count}", () => {
  // Đúng shape studio soạn (v2.0): key `children`, content block text phẳng,
  // con hotspot chấm theo SỐ LƯỢNG vùng đã chọn ({count}) — vùng nào cũng được.
  const groupPayload = {
    type: "question_group",
    sharedContent: { blocks: [{ type: "paragraph", text: "Tô màu số bông hoa ở mỗi hàng theo số cho trước." }] },
    children: [
      {
        id: "r1",
        type: "hotspot",
        display: { interactionType: "multiple" },
        content: { blocks: [{ type: "paragraph", text: "Tô màu 2 bông hoa." }] },
        image: { url: "/hang-1.png", altText: "Năm bông hoa" },
        hotspots: [
          { id: "f1", shape: "circle", x: 0.1, y: 0.5, radius: 0.075 },
          { id: "f2", shape: "circle", x: 0.3, y: 0.5, radius: 0.075 },
          { id: "f3", shape: "circle", x: 0.5, y: 0.5, radius: 0.075 },
          { id: "f4", shape: "circle", x: 0.7, y: 0.5, radius: 0.075 },
          { id: "f5", shape: "circle", x: 0.9, y: 0.5, radius: 0.075 },
        ],
        correctAnswer: { count: 2 },
      },
    ],
  };

  it("con hotspot trong nhóm chấm theo số lượng: chọn 2 vùng BẤT KỲ → marker xanh", () => {
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    act(() => {
      root.render(
        <QuestionPlayer
          question={{ id: "q-group-hotspot-count", question_type: "question_group", payload: groupPayload }}
          index={0}
        />,
      );
    });

    expect(container.textContent).toContain("Tô màu 2 bông hoa.");

    const img = container.querySelector<HTMLElement>('img[alt="Năm bông hoa"]')!;
    const target = img.parentElement!;
    target.getBoundingClientRect = () =>
      ({ x: 0, y: 0, left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100, toJSON: () => ({}) }) as DOMRect;

    const clickAt = (x: number, y: number) =>
      act(() => {
        target.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: x, clientY: y }));
      });
    const green = ["#22c55e", "rgb(34, 197, 94)"];
    const marker = (id: string) => container.querySelector<HTMLElement>(`[data-hotspot-marker="${id}"]`)!;

    // f1 + f4 (hai vùng BẤT KỲ) — đủ 2 là đúng, không cần cặp cụ thể nào.
    clickAt(10, 50);
    expect(green).not.toContain(marker("f1").style.borderColor);
    clickAt(70, 50);
    expect(green).toContain(marker("f1").style.borderColor);
    expect(green).toContain(marker("f4").style.borderColor);
    vi.unstubAllGlobals();
  });
});
