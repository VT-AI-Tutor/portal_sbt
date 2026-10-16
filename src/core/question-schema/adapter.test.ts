import { describe, expect, it } from "vitest";
import {
  canonicalQuestionType,
  getQuestionPreviewText,
  mergeGroupSharedContent,
  normalizeType,
  toRenderableQuestion,
} from "./adapter";
import { questionTypeLabel } from "./question-types.generated";

describe("matching payload compatibility", () => {
  it("normalizes legacy items and targets aliases", () => {
    const question = toRenderableQuestion({
      payload: {
        type: "matching",
        items: [{ id: "item-1", text: "A" }],
        targets: [{ id: "target-1", text: "B" }],
        correctAnswer: { "item-1": "target-1" },
      },
    });

    expect(question.leftItems?.map((item) => item.id)).toEqual(["item-1"]);
    expect(question.rightItems?.map((item) => item.id)).toEqual(["target-1"]);
  });

  it("prefers canonical left/right fields when both shapes are present", () => {
    const question = toRenderableQuestion({
      payload: {
        type: "matching",
        leftItems: [{ id: "canonical-left", text: "A" }],
        rightItems: [{ id: "canonical-right", text: "B" }],
        items: [{ id: "legacy-left", text: "Old A" }],
        targets: [{ id: "legacy-right", text: "Old B" }],
      },
    });

    expect(question.leftItems?.map((item) => item.id)).toEqual(["canonical-left"]);
    expect(question.rightItems?.map((item) => item.id)).toEqual(["canonical-right"]);
  });

  it("keeps middleItems and both canonical chain edge directions", () => {
    const question = toRenderableQuestion({
      payload: {
        type: "matching",
        display: { interactionType: "chain" },
        leftItems: [{ id: "L1", text: "Left" }],
        middleItems: [{ id: "M1", text: "Middle" }],
        rightItems: [{ id: "R1", text: "Right" }],
        correctAnswer: [
          { item: "L1", target: "M1" },
          { item: "M1", target: "R1" },
        ],
      },
    });

    expect(question.middleItems?.map((item) => item.id)).toEqual(["M1"]);
    expect(question.correctAnswer).toEqual([
      { item: "L1", target: "M1" },
      { item: "M1", target: "R1" },
    ]);
  });

  it("projects canonical columns[].title onto the renderable question", () => {
    const titleContent = {
      blocks: [{
        type: "paragraph",
        align: "center" as const,
        content: [{ text: "Từ vựng", annotations: { color: "#ed1c24" } }],
      }],
    };
    const question = toRenderableQuestion({
      payload: {
        type: "matching",
        columns: [
          { id: "left", title: "Từ vựng", titleContent, items: [{ id: "L1", text: "A" }] },
          { id: "right", title: "Nghĩa", items: [{ id: "R1", text: "B" }] },
        ],
        leftItems: [{ id: "L1", text: "A" }],
        rightItems: [{ id: "R1", text: "B" }],
      },
    });

    expect(question.leftTitle).toBe("Từ vựng");
    expect(question.rightTitle).toBe("Nghĩa");
    expect(question.leftTitleContent).toEqual(titleContent);
    expect(question.rightTitleContent).toBeUndefined();
    expect(question.columns?.map((c) => ({ id: c.id, title: c.title }))).toEqual([
      { id: "left", title: "Từ vựng" },
      { id: "right", title: "Nghĩa" },
    ]);
    expect(question.columns?.[0].titleContent).toEqual(titleContent);
  });

  it("LEGACY-SYNTHESIS: synthesizes titles from columnALabel/columnBLabel with no `columns` key", () => {
    const question = toRenderableQuestion({
      payload: {
        type: "matching",
        leftItems: [{ id: "L1", text: "A" }],
        rightItems: [{ id: "R1", text: "B" }],
        columnALabel: "Từ vựng",
        columnBLabel: "Nghĩa",
      },
    });

    expect(question.leftTitle).toBe("Từ vựng");
    expect(question.rightTitle).toBe("Nghĩa");
  });

  it("leaves titles undefined when no title was ever authored (renderers hide the header)", () => {
    const question = toRenderableQuestion({
      payload: {
        type: "matching",
        leftItems: [{ id: "L1", text: "A" }],
        rightItems: [{ id: "R1", text: "B" }],
      },
    });

    expect(question.leftTitle).toBeUndefined();
    expect(question.rightTitle).toBeUndefined();
  });
});

describe("coloring payload compatibility", () => {
  it("preserves canonical fields without promoting a manual answer key", () => {
    const question = toRenderableQuestion({
      id: "b56_q1_ep",
      question_type: "coloring",
      payload: {
        id: "b56_q1_ep",
        type: "coloring",
        image: { url: "/uploads/canonical-coloring-grid.png", altText: "Lưới tô màu" },
        imageUrl: "/uploads/coloring-grid.png",
        regions: [
          { id: "ep-c1", label: "tem" },
          { id: "ep-c3", label: "dép" },
        ],
        colors: ["#facc15"],
        correctAnswer: { "ep-c3": "#facc15" },
      },
    });

    expect(question).toMatchObject({
      type: "coloring",
      // `image` keeps the raw canonical block; `imageUrl` carries the EFFECTIVE
      // url the player renders — `image.url` wins over the flat legacy field,
      // the same precedence dispatch.tsx applies (both now read one resolver).
      image: { url: "/uploads/canonical-coloring-grid.png", altText: "Lưới tô màu" },
      imageUrl: "/uploads/canonical-coloring-grid.png",
      regions: [
        { id: "ep-c1", label: "tem" },
        { id: "ep-c3", label: "dép" },
      ],
      colors: ["#facc15"],
    });
    expect(question.correctAnswer).toBeUndefined();
  });

  it("preserves coloring fields for children nested in a question group", () => {
    const group = toRenderableQuestion({
      id: "b56_q1",
      question_type: "question_group",
      payload: {
        id: "b56_q1",
        type: "question_group",
        questions: [
          {
            id: "b56_q1_ep",
            type: "coloring",
            imageUrl: "/uploads/group-coloring-grid.png",
            regions: [{ id: "ep-c3", label: "dép" }],
            colors: ["#facc15"],
            correctAnswer: { "ep-c3": "#facc15" },
          },
        ],
      },
    });

    expect(group.nestedQuestions).toHaveLength(1);
    expect(group.nestedQuestions?.[0]).toMatchObject({
      type: "coloring",
      imageUrl: "/uploads/group-coloring-grid.png",
      regions: [{ id: "ep-c3", label: "dép" }],
      colors: ["#facc15"],
    });
    expect(group.nestedQuestions?.[0].correctAnswer).toBeUndefined();
  });
});

describe("fill_blank / cloze answer-key compatibility", () => {
  it("fills blanks[] accepted answers from correctAnswer keyed by blankId", () => {
    const question = toRenderableQuestion({
      payload: {
        type: "cloze",
        content: { blocks: [{ type: "paragraph", text: "{blank_1} là thủ đô." }] },
        blanks: [{ id: "blank_1" }],
        correctAnswer: { blank_1: "Hà Nội" },
      },
    });

    expect(question.blanks).toEqual([
      { id: "blank_1", acceptedAnswers: ["Hà Nội"], caseSensitive: false, trimWhitespace: true },
    ]);
  });

  it("passes blanks[].width (display-only hint) through normalization; absent width stays absent", () => {
    const question = toRenderableQuestion({
      payload: {
        type: "cloze",
        content: { blocks: [{ type: "paragraph", text: "{blank_1} và {blank_2}." }] },
        blanks: [
          { id: "blank_1", width: "12rem" },
          { id: "blank_2" },
        ],
        correctAnswer: { blank_1: "a", blank_2: "b" },
      },
    });

    expect(question.blanks?.[0].width).toBe("12rem");
    expect(question.blanks?.[1]).not.toHaveProperty("width");
  });

  it("drops non-string blanks[].width values", () => {
    const question = toRenderableQuestion({
      payload: {
        type: "fill_blank",
        blanks: [{ id: "blank_1", width: 12 }],
        correctAnswer: { blank_1: "a" },
      },
    });

    expect(question.blanks?.[0]).not.toHaveProperty("width");
  });

  it("keeps an array of accepted answers per blank", () => {
    const question = toRenderableQuestion({
      payload: {
        type: "cloze",
        blanks: [{ id: "blank_1" }],
        correctAnswer: { blank_1: ["B, A, C", "B; A; C", "B A C"] },
      },
    });

    expect(question.blanks?.[0].acceptedAnswers).toEqual(["B, A, C", "B; A; C", "B A C"]);
  });

  it("synthesizes blanks from correctAnswer keys when no blanks[] array is present", () => {
    const question = toRenderableQuestion({
      payload: {
        type: "fill_blank",
        correctAnswer: { blank_1: "Hà Nội", blank_2: "1010" },
      },
    });

    expect(question.blanks?.map((b) => ({ id: b.id, acceptedAnswers: b.acceptedAnswers }))).toEqual([
      { id: "blank_1", acceptedAnswers: ["Hà Nội"] },
      { id: "blank_2", acceptedAnswers: ["1010"] },
    ]);
  });

  it("fills blank answers from correctAnswer, ignoring legacy blanks[].acceptedAnswers", () => {
    const question = toRenderableQuestion({
      payload: {
        type: "fill_blank",
        // Legacy field present but stale — correctAnswer is the single source of truth.
        blanks: [{ id: "blank_1", acceptedAnswers: ["từ cũ"] }],
        correctAnswer: { blank_1: "khác" },
      },
    });

    expect(question.blanks?.[0].acceptedAnswers).toEqual(["khác"]);
  });

  it("still supports a scalar correctAnswer with no blanks[] array", () => {
    const question = toRenderableQuestion({
      payload: {
        type: "fill_blank",
        correctAnswer: "42",
      },
    });

    expect(question.blanks?.[0]).toMatchObject({ id: "blank_1", acceptedAnswers: ["42"] });
  });
});

describe("table payload compatibility", () => {
  it("preserves normalized tick groups for table players", () => {
    const question = toRenderableQuestion({
      payload: {
        type: "table_completion",
        table: {
          headers: [{ id: "safe", label: "An toàn" }, { id: "unsafe", label: "Không an toàn" }],
          tickGroups: [["safe", "unsafe"]],
          rows: [{ id: "row-1", cells: [
            { columnId: "safe", cellType: "tick" },
            { columnId: "unsafe", cellType: "tick" },
          ] }],
        },
      },
    });

    expect(question.table?.tickGroups).toEqual([["safe", "unsafe"]]);
  });

  it("preserves only canonical 3–20rem input/essay dimensions", () => {
    const question = toRenderableQuestion({
      payload: {
        type: "table_completion",
        table: {
          headers: [
            { id: "answer", label: "Trả lời" },
            { id: "note", label: "Ghi chú" },
            { id: "bad", label: "Sai" },
            { id: "static", label: "Tĩnh" },
          ],
          rows: [{
            id: "row-1",
            cells: [
              { columnId: "answer", cellType: "input", width: "8.5rem", height: "4rem" },
              { columnId: "note", cellType: "essay", width: " 20rem ", height: " 10rem " },
              { columnId: "bad", cellType: "input", width: "50%", height: "21rem" },
              { columnId: "static", cellType: "static", width: "9rem", height: "9rem" },
            ],
          }],
        },
      },
    });

    expect(question.table?.rows[0].cells).toEqual([
      expect.objectContaining({ columnId: "answer", width: "8.5rem", height: "4rem" }),
      expect.objectContaining({ columnId: "note", width: "20rem", height: "10rem" }),
      expect.objectContaining({ columnId: "bad", width: undefined, height: undefined }),
      expect.objectContaining({ columnId: "static", width: undefined, height: undefined }),
    ]);
  });
});

describe("question_group children compatibility", () => {
  const child = (id: string) => ({
    id,
    type: "single_choice",
    options: [{ id: "a", text: "A" }],
    correctAnswer: "a",
  });

  it.each(["children", "subQuestions", "questions"] as const)(
    "builds nested questions from payload.%s",
    (field) => {
      const question = toRenderableQuestion({
        payload: {
          type: "question_group",
          [field]: [child("child-1"), child("child-2")],
        },
      });

      expect(question.nestedQuestions?.map((nested) => nested.id)).toEqual([
        "child-1",
        "child-2",
      ]);
    }
  );

  it("keeps the dispatcher's key precedence: children > subQuestions > questions", () => {
    const question = toRenderableQuestion({
      payload: {
        type: "question_group",
        children: [child("from-children")],
        subQuestions: [child("from-sub-questions")],
        questions: [child("from-questions")],
      },
    });

    expect(question.nestedQuestions?.map((nested) => nested.id)).toEqual(["from-children"]);
  });

  it("falls back to subQuestions when children is absent", () => {
    const question = toRenderableQuestion({
      payload: {
        type: "question_group",
        subQuestions: [child("from-sub-questions")],
        questions: [child("from-questions")],
      },
    });

    expect(question.nestedQuestions?.map((nested) => nested.id)).toEqual([
      "from-sub-questions",
    ]);
  });

  it("synthesizes ids for children authored without one", () => {
    const question = toRenderableQuestion({
      id: "group-1",
      payload: {
        type: "question_group",
        subQuestions: [{ type: "essay" }, { type: "essay" }],
      },
    });

    expect(question.nestedQuestions?.map((nested) => nested.id)).toEqual([
      "group-1_1",
      "group-1_2",
    ]);
  });

  it("yields an empty list when no child key is present", () => {
    const question = toRenderableQuestion({
      payload: { type: "question_group" },
    });

    expect(question.nestedQuestions).toEqual([]);
  });
});

describe("mergeGroupSharedContent (issue #442)", () => {
  const para = (text: string, extra: Record<string, unknown> = {}) => ({
    type: "paragraph",
    text,
    ...extra,
  });
  const image = (url: string, extra: Record<string, unknown> = {}) => ({
    type: "image",
    url,
    ...extra,
  });

  it("returns undefined when shared is absent or empty", () => {
    expect(mergeGroupSharedContent(undefined, { blocks: [para("A")] })).toBeUndefined();
    expect(mergeGroupSharedContent({ blocks: [] }, { blocks: [para("A")] })).toBeUndefined();
    expect(mergeGroupSharedContent("   ", { blocks: [para("A")] })).toBeUndefined();
  });

  it("returns shared as-is when content is absent or empty", () => {
    const shared = { blocks: [para("Đọc đoạn văn.")] };
    expect(mergeGroupSharedContent(shared, undefined)).toBe(shared);
    expect(mergeGroupSharedContent(shared, { blocks: [] })).toBe(shared);
    expect(mergeGroupSharedContent("Đọc đoạn văn.", undefined)).toBe("Đọc đoạn văn.");
  });

  it("returns shared unchanged on a full identical duplicate", () => {
    const shared = { blocks: [para("Đọc đoạn văn trong SGK.")] };
    const content = { blocks: [para("Đọc đoạn văn trong SGK.")] };
    expect(mergeGroupSharedContent(shared, content)).toBe(shared);
  });

  it("returns content in content order when content is a superset (b21_q21 shape)", () => {
    const contentBlocks = [
      para("Tiết 6", { style: "context-box", align: "center" }),
      para("Viết số thích hợp vào chỗ chấm (theo mẫu)."),
      image("assets/images/bai1_t6q1_a.png", {
        alt: "Mẫu: khay bánh ma-ca-rong",
        width: "30%",
        align: "center",
      }),
      para("Mẫu: 13 gồm 1 chục và 3 đơn vị.", { align: "center" }),
    ];
    const shared = { blocks: [para("Viết số thích hợp vào chỗ chấm (theo mẫu).")] };
    const merged = mergeGroupSharedContent(shared, { blocks: contentBlocks });

    expect(merged).toEqual({ blocks: contentBlocks });
    const blocks = (merged as unknown as { blocks: Array<Record<string, unknown>> }).blocks;
    expect(blocks).toHaveLength(4);
    expect(blocks[2].type).toBe("image");
    expect(
      blocks.filter((b) => (b.text as string | undefined)?.includes("Viết số thích hợp")),
    ).toHaveLength(1);
  });

  it("keeps shared blocks first, then content-only blocks, on partial overlap", () => {
    const shared = { blocks: [para("Chung"), para("Chỉ có ở shared")] };
    const content = { blocks: [para("Chung"), para("Chỉ có ở content")] };
    const merged = mergeGroupSharedContent(shared, content) as unknown as {
      blocks: Array<Record<string, unknown>>;
    };

    expect(merged.blocks.map((b) => b.text)).toEqual([
      "Chung",
      "Chỉ có ở shared",
      "Chỉ có ở content",
    ]);
  });

  it("keeps all blocks when shared and content are disjoint", () => {
    const shared = { blocks: [para("A")] };
    const content = { blocks: [image("a.png"), para("B")] };
    const merged = mergeGroupSharedContent(shared, content) as unknown as {
      blocks: Array<Record<string, unknown>>;
    };

    expect(merged.blocks.map((b) => b.text ?? b.url)).toEqual(["A", "a.png", "B"]);
  });

  it("dedupes text against canonical run-based blocks with collapsed whitespace", () => {
    const shared = {
      blocks: [
        { type: "paragraph", content: [{ text: "  Viết   số thích hợp. ", annotations: {} }] },
      ],
    };
    const content = { blocks: [para("Viết số thích hợp."), image("b.png")] };
    const merged = mergeGroupSharedContent(shared, content) as unknown as {
      blocks: Array<Record<string, unknown>>;
    };

    // Content is a superset → content order, dup paragraph once.
    expect(merged.blocks).toHaveLength(2);
    expect(merged.blocks[0].text).toBe("Viết số thích hợp.");
    expect(merged.blocks[1].url).toBe("b.png");
  });

  it("dedupes media blocks with suffix-tolerant URLs", () => {
    const shared = { blocks: [image("/uploads/books/abc/assets/bai1.png")] };
    const content = { blocks: [image("assets/bai1.png"), para("Chú thích")] };
    const merged = mergeGroupSharedContent(shared, content) as unknown as {
      blocks: Array<Record<string, unknown>>;
    };

    expect(merged.blocks).toHaveLength(2);
    expect(merged.blocks.filter((b) => b.type === "image")).toHaveLength(1);
  });

  it("converts a string shared to a paragraph and merges when content has blocks", () => {
    const merged = mergeGroupSharedContent("Đề chung", {
      blocks: [image("c.png")],
    }) as unknown as { blocks: Array<Record<string, unknown>> };

    expect(merged.blocks).toHaveLength(2);
    expect(merged.blocks[0].type).toBe("paragraph");
    expect(merged.blocks[1].url).toBe("c.png");
  });

  it("never dedupes unknown block types", () => {
    const custom = { type: "custom_widget", text: "same" };
    const merged = mergeGroupSharedContent(
      { blocks: [custom] },
      { blocks: [{ ...custom }] },
    ) as unknown as { blocks: Array<Record<string, unknown>> };

    expect(merged.blocks).toHaveLength(2);
  });

  // ── Concatenated fabricated shared (live b21_q21 duplication regression) ──

  const liveContentBlocks = [
    para("Tiết 6", { style: "context-box", align: "center" }),
    para("Viết số thích hợp vào chỗ chấm (theo mẫu)."),
    image("assets/images/bai1_t6q1_a.png", { alt: "Mẫu: khay bánh ma-ca-rong" }),
    para("Mẫu: 13 gồm 1 chục và 3 đơn vị.", { align: "center" }),
  ];
  // Backend-synced stem: ONE run-based paragraph concatenating every content
  // paragraph (exact DB shape of b21_q21's fabricated sharedContent).
  const liveConcatenatedShared = {
    blocks: [
      {
        type: "paragraph",
        content: [
          {
            text: "Tiết 6\nViết số thích hợp vào chỗ chấm (theo mẫu).\nMẫu: 13 gồm 1 chục và 3 đơn vị.",
            annotations: {},
          },
        ],
      },
    ],
  };

  it("drops a 1-paragraph shared whose text is the concatenation of content's paragraphs (live b21_q21)", () => {
    const merged = mergeGroupSharedContent(liveConcatenatedShared, {
      blocks: liveContentBlocks,
    });

    // Content covers all of shared's text → content wins, in content order.
    expect(merged).toEqual({ blocks: liveContentBlocks });
    const blocks = (merged as unknown as { blocks: Array<Record<string, unknown>> }).blocks;
    expect(blocks).toHaveLength(4);
    expect(blocks[2].type).toBe("image");
    // The concatenated stem paragraph must NOT survive next to the breakdown.
    expect(
      blocks.filter((b) => (b.text as string | undefined)?.includes("\n")),
    ).toHaveLength(0);
  });

  it("getQuestionPreviewText contains each shared paragraph exactly once (subtitle derivation)", () => {
    const preview = getQuestionPreviewText({
      id: "b21_q21",
      question_type: "question_group",
      payload: {
        type: "question_group",
        content: { blocks: liveContentBlocks },
        sharedContent: liveConcatenatedShared,
        subQuestions: [],
      },
    } as unknown as Parameters<typeof getQuestionPreviewText>[0]);

    const instruction = "Viết số thích hợp vào chỗ chấm (theo mẫu).";
    expect(preview.split(instruction).length - 1).toBe(1);
    expect(preview.split("Tiết 6").length - 1).toBe(1);
    expect(preview.split("Mẫu: 13 gồm 1 chục và 3 đơn vị.").length - 1).toBe(1);
  });

  it("substring coverage respects word boundaries (\"6\" is not covered by \"65\")", () => {
    const shared = { blocks: [para("6")] };
    const content = { blocks: [para("Tiết 65"), image("d.png")] };
    const merged = mergeGroupSharedContent(shared, content) as unknown as {
      blocks: Array<Record<string, unknown>>;
    };

    // "6" is not a whole word inside "Tiết 65" → shared paragraph survives.
    expect(merged.blocks.map((b) => b.text ?? b.url)).toEqual(["6", "Tiết 65", "d.png"]);
  });

  it("drops content paragraphs already contained in shared's joined text (reverse coverage)", () => {
    const shared = {
      blocks: [para("Đọc đoạn văn.\nTrả lời câu hỏi."), image("e.png")],
    };
    const content = { blocks: [para("Đọc đoạn văn."), para("Trả lời câu hỏi.")] };
    const merged = mergeGroupSharedContent(shared, content);

    // Every content block is covered by shared → full duplicate → shared as-is.
    expect(merged).toBe(shared);
  });
});

describe("blanks[].input passthrough (issue #444)", () => {
  it("passes a fully valid input config through normalization", () => {
    const question = toRenderableQuestion({
      payload: {
        type: "fill_blank",
        blanks: [
          { id: "blank_1", input: { mode: "single_line", size: "long" } },
          { id: "blank_2", input: { mode: "multiline", size: "full", rows: 4 } },
        ],
        correctAnswer: { blank_1: "a", blank_2: "b" },
      },
    });

    expect(question.blanks?.[0].input).toEqual({ mode: "single_line", size: "long" });
    expect(question.blanks?.[1].input).toEqual({ mode: "multiline", size: "full", rows: 4 });
  });

  it("omits the input key entirely when the payload has none (backward compat)", () => {
    const question = toRenderableQuestion({
      payload: {
        type: "fill_blank",
        blanks: [{ id: "blank_1" }],
        correctAnswer: { blank_1: "a" },
      },
    });

    expect(question.blanks?.[0]).not.toHaveProperty("input");
  });

  it("drops invalid enum values but keeps the valid parts", () => {
    const question = toRenderableQuestion({
      payload: {
        type: "cloze",
        blanks: [
          { id: "blank_1", input: { mode: "vertical", size: "long", rows: 3 } },
          { id: "blank_2", input: { mode: "multiline", size: "12rem" } },
        ],
        correctAnswer: { blank_1: "a", blank_2: "b" },
      },
    });

    // Unknown mode dropped; valid size + rows kept.
    expect(question.blanks?.[0].input).toEqual({ size: "long", rows: 3 });
    // Arbitrary CSS in size dropped (whitelist only); valid mode kept.
    expect(question.blanks?.[1].input).toEqual({ mode: "multiline" });
  });

  it("drops non-positive/non-integer rows and caps rows at 10", () => {
    const question = toRenderableQuestion({
      payload: {
        type: "fill_blank",
        blanks: [
          { id: "blank_1", input: { mode: "multiline", rows: 0 } },
          { id: "blank_2", input: { mode: "multiline", rows: 2.5 } },
          { id: "blank_3", input: { mode: "multiline", rows: 99 } },
        ],
        correctAnswer: { blank_1: "a", blank_2: "b", blank_3: "c" },
      },
    });

    expect(question.blanks?.[0].input).toEqual({ mode: "multiline" });
    expect(question.blanks?.[1].input).toEqual({ mode: "multiline" });
    expect(question.blanks?.[2].input).toEqual({ mode: "multiline", rows: 10 });
  });

  it("drops the input key when nothing valid remains or it is not an object", () => {
    const question = toRenderableQuestion({
      payload: {
        type: "fill_blank",
        blanks: [
          { id: "blank_1", input: { mode: "huge", rows: -1 } },
          { id: "blank_2", input: "multiline" },
          { id: "blank_3", input: ["multiline"] },
        ],
        correctAnswer: { blank_1: "a", blank_2: "b", blank_3: "c" },
      },
    });

    expect(question.blanks?.[0]).not.toHaveProperty("input");
    expect(question.blanks?.[1]).not.toHaveProperty("input");
    expect(question.blanks?.[2]).not.toHaveProperty("input");
  });

  it("keeps input independent from the legacy width hint (both pass through)", () => {
    const question = toRenderableQuestion({
      payload: {
        type: "fill_blank",
        blanks: [{ id: "blank_1", width: "12rem", input: { size: "short" } }],
        correctAnswer: { blank_1: "a" },
      },
    });

    expect(question.blanks?.[0].width).toBe("12rem");
    expect(question.blanks?.[0].input).toEqual({ size: "short" });
  });
});

/**
 * Pin nhãn loại câu cho alias v1.0: `free_draw` phải ra "Vẽ tự do", KHÔNG rơi
 * fallback `essay` ("Tự luận") và KHÔNG hiện slug thô. Đây là đường CHÍNH
 * (adapter → questionTypeLabel); đường badge của PracticeRunner được pin riêng
 * ở `PracticeRunner.selfcheck.test.tsx` — cả hai phải dùng chung bộ alias này.
 */
describe("alias loại câu v1.0 → nhãn", () => {
  it("toRenderableQuestion gấp free_draw về drawing", () => {
    const question = toRenderableQuestion({ question_type: "free_draw" });
    expect(question.type).toBe("drawing");
    expect(questionTypeLabel(question.type)).toBe("Vẽ tự do");
  });

  it("canonicalQuestionType: alias gấp, type đã chuẩn giữ nguyên", () => {
    expect(canonicalQuestionType("free_draw")).toBe("drawing");
    expect(canonicalQuestionType("drawing")).toBe("drawing");
    expect(canonicalQuestionType("single_choice")).toBe("single_choice");
  });

  it("canonicalQuestionType KHÔNG nuốt type lạ về essay (khác normalizeType)", () => {
    expect(canonicalQuestionType("short_answer")).toBe("short_answer");
    expect(normalizeType("short_answer")).toBe("essay");
  });
});
