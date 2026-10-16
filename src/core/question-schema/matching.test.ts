import { describe, expect, it } from "vitest";
import {
  clampMatchEdges,
  clampMatchEdgesByHop,
  isOneToManyMatch,
  matchCardinalityByHop,
  matchCardinalityFromKey,
  matchEdgeKey,
  normalizeMatchEdges,
  sameMatchEdgeSet,
  resolveMatchingColumns,
  resolveMatchingInteraction,
  resolveMatchingItems,
  resolveMatchingPayload,
  toggleMatchEdge,
  triadCentreFanOutCeiling,
} from "./matching";

describe("matching compatibility", () => {
  it("lets canonical interaction and non-empty item arrays win over legacy aliases", () => {
    const payload = {
      display: { interactionType: "lines" },
      layout: "scene",
      leftItems: [{ id: "canonical-item" }],
      items: [{ id: "legacy" }],
      rightItems: [{ id: "canonical-target" }],
      targets: [{ id: "legacy-target" }],
    };
    expect(resolveMatchingInteraction(payload)).toBe("lines");
    expect(resolveMatchingItems(payload, "left").map(({ id }) => id)).toEqual(["canonical-item"]);
    expect(resolveMatchingItems(payload, "right").map(({ id }) => id)).toEqual(["canonical-target"]);
  });

  it("falls back to the populated legacy alias when the canonical mirror is a scaffolded empty array", () => {
    // Backend import writes `leftItems: []` / `rightItems: []` onto legacy
    // items/targets payloads — the real content must still render.
    const payload = {
      leftItems: [],
      rightItems: [],
      items: [{ id: "car73" }, { id: "car85" }],
      targets: [{ id: "n3" }, { id: "n4" }],
    };
    expect(resolveMatchingItems(payload, "left").map(({ id }) => id)).toEqual(["car73", "car85"]);
    expect(resolveMatchingItems(payload, "right").map(({ id }) => id)).toEqual(["n3", "n4"]);
  });

  it("keeps an empty result when both the canonical mirror and the alias are empty", () => {
    expect(resolveMatchingItems({ leftItems: [], items: [] }, "left")).toEqual([]);
    expect(resolveMatchingItems({ leftItems: [] }, "left")).toEqual([]);
    expect(resolveMatchingItems({ middleItems: [] }, "middle")).toEqual([]);
  });

  it.each([
    ["columns", "columns"],
    ["lines", "lines"],
    ["row", "rows"],
    ["radial", "radial"],
    ["chain", "chain"],
    ["scene", "scene"],
  ])(
    "maps legacy %s layout to %s",
    (layout, expected) => expect(resolveMatchingInteraction({ layout })).toBe(expected),
  );

  it("reads nxbgd display.layout aliases and keeps canonical interaction authoritative", () => {
    expect(resolveMatchingInteraction({ display: { layout: "columns" } })).toBe("columns");
    expect(resolveMatchingInteraction({ display: { layout: "lines" } })).toBe("lines");
    expect(resolveMatchingInteraction({
      display: { interactionType: "radial", layout: "columns" },
    })).toBe("radial");
  });

  it("normalizes every edge alias losslessly and removes only invalid/exact duplicates", () => {
    const items = new Set(["a", "b"]);
    const targets = new Set(["x", "y"]);
    expect(normalizeMatchEdges([
      { item: "a", target: "x" },
      { left: "a", right: "y" },
      { from: "b", to: "y" },
      { leftId: "a", rightId: "x" },
      { item: "missing", target: "x" },
      { item: "a", target: "missing" },
      null,
    ], items, targets)).toEqual([
      { item: "a", target: "x" },
      { item: "a", target: "y" },
      { item: "b", target: "y" },
    ]);
  });

  it("reads legacy records and aliases through one resolver", () => {
    expect(resolveMatchingPayload({
      items: [{ id: "a" }],
      targets: [{ id: "x" }],
      correctAnswer: { a: "x" },
    }).correctEdges).toEqual([{ item: "a", target: "x" }]);
    expect(normalizeMatchEdges({ left: "a", right: "x", locked: true })).toEqual([
      { item: "a", target: "x" },
    ]);
  });

  it("preserves both halves of a three-column chain and rejects cross-column shortcuts", () => {
    const resolved = resolveMatchingPayload({
      display: { interactionType: "chain" },
      leftItems: [{ id: "L1" }],
      middleItems: [{ id: "M1" }],
      rightItems: [{ id: "R1" }],
      correctAnswer: [
        { item: "L1", target: "M1" },
        { item: "M1", target: "R1" },
        { item: "L1", target: "R1" },
      ],
    });

    expect(resolved.middleItems.map(({ id }) => id)).toEqual(["M1"]);
    expect(resolved.correctEdges).toEqual([
      { item: "L1", target: "M1" },
      { item: "M1", target: "R1" },
    ]);
  });

  it("keeps ordinary two-column matching on left-to-right edges", () => {
    expect(resolveMatchingPayload({
      leftItems: [{ id: "L1" }],
      middleItems: [{ id: "M1" }],
      rightItems: [{ id: "R1" }],
      correctAnswer: [
        { item: "L1", target: "R1" },
        { item: "L1", target: "M1" },
        { item: "M1", target: "R1" },
      ],
    }).correctEdges).toEqual([{ item: "L1", target: "R1" }]);
  });

  it("reads the key only from correctAnswer — empty means no key (record-only)", () => {
    // Model single correctAnswer, không fallback. Rỗng → không cặp nào.
    expect(resolveMatchingPayload({
      items: [{ id: "a" }],
      targets: [{ id: "x" }],
      correctAnswer: {},
    }).correctEdges).toEqual([]);
    expect(resolveMatchingPayload({
      items: [{ id: "a" }],
      targets: [{ id: "x" }],
      correctAnswer: [],
    }).correctEdges).toEqual([]);
    // Có nội dung thì đọc bình thường.
    expect(resolveMatchingPayload({
      items: [{ id: "a" }],
      targets: [{ id: "x" }],
      correctAnswer: { a: "x" },
    }).correctEdges).toEqual([{ item: "a", target: "x" }]);
  });

  it("preserves both halves of a three-column chain and rejects cross-column shortcuts", () => {
    const resolved = resolveMatchingPayload({
      display: { interactionType: "chain" },
      leftItems: [{ id: "L1" }],
      middleItems: [{ id: "M1" }],
      rightItems: [{ id: "R1" }],
      correctAnswer: [
        { item: "L1", target: "M1" },
        { item: "M1", target: "R1" },
        { item: "L1", target: "R1" },
      ],
    });

    expect(resolved.middleItems.map(({ id }) => id)).toEqual(["M1"]);
    expect(resolved.correctEdges).toEqual([
      { item: "L1", target: "M1" },
      { item: "M1", target: "R1" },
    ]);
  });

  it("keeps ordinary two-column matching on left-to-right edges", () => {
    expect(resolveMatchingPayload({
      leftItems: [{ id: "L1" }],
      middleItems: [{ id: "M1" }],
      rightItems: [{ id: "R1" }],
      correctAnswer: [
        { item: "L1", target: "R1" },
        { item: "L1", target: "M1" },
        { item: "M1", target: "R1" },
      ],
    }).correctEdges).toEqual([{ item: "L1", target: "R1" }]);
  });

  it("compares exact valid edge sets and rejects unknown extras", () => {
    const expected = [{ item: "a", target: "x" }];
    const items = new Set(["a"]);
    const targets = new Set(["x"]);
    expect(sameMatchEdgeSet(expected, expected, items, targets)).toBe(true);
    expect(sameMatchEdgeSet([...expected, { item: "ghost", target: "x" }], expected, items, targets)).toBe(false);
    expect(sameMatchEdgeSet([...expected, { item: "a", target: "ghost" }], expected, items, targets)).toBe(false);
  });
});

describe("matching columns — canonical + legacy-synthesis titles (no re-import)", () => {
  it("prefers valid non-empty titleContent while preserving the plain title fallback", () => {
    const titleContent = {
      blocks: [{
        type: "paragraph",
        align: "right",
        content: [{ text: "Từ vựng giàu định dạng", annotations: { color: "#ed1c24" } }],
      }],
    };
    const resolved = resolveMatchingPayload({
      columns: [
        { id: "left", title: "Từ vựng", titleContent, items: [{ id: "L1" }] },
        { id: "right", title: "Nghĩa", items: [{ id: "R1" }] },
      ],
      correctAnswer: [{ item: "L1", target: "R1" }],
    });

    expect(resolved.leftTitle).toBe("Từ vựng");
    expect(resolved.leftTitleContent).toEqual(titleContent);
    expect(resolved.rightTitleContent).toBeUndefined();
  });

  it.each([
    { blocks: [] },
    { blocks: [{ type: "image", url: "title.png" }] },
    { blocks: [{ type: "paragraph", content: [{ text: "   ", annotations: {} }] }] },
  ])("falls back to title when titleContent is empty or invalid: $blocks", (titleContent) => {
    const resolved = resolveMatchingPayload({
      columns: [
        { id: "left", title: "Fallback", titleContent, items: [{ id: "L1" }] },
        { id: "right", items: [{ id: "R1" }] },
      ],
    });
    expect(resolved.leftTitle).toBe("Fallback");
    expect(resolved.leftTitleContent).toBeUndefined();
  });

  it("keeps independently styled titleContent for all three chain columns", () => {
    const content = (text: string, align: "left" | "center" | "right") => ({
      blocks: [{
        type: "paragraph",
        align,
        content: [{ text, annotations: { color: text } }],
      }],
    });
    const resolved = resolveMatchingPayload({
      display: { interactionType: "chain" },
      columns: [
        { id: "left", title: "L", titleContent: content("red", "left"), items: [{ id: "L1" }] },
        { id: "middle", title: "M", titleContent: content("green", "center"), items: [{ id: "M1" }] },
        { id: "right", title: "R", titleContent: content("blue", "right"), items: [{ id: "R1" }] },
      ],
    });
    expect(resolved.columns.map((column) => column.titleContent)).toEqual([
      content("red", "left"),
      content("green", "center"),
      content("blue", "right"),
    ]);
  });

  it("reads canonical columns[].title verbatim, even when the mirrors disagree", () => {
    const resolved = resolveMatchingColumns({
      columns: [
        { id: "left", title: "Từ vựng", items: [{ id: "L1" }] },
        { id: "right", title: "Nghĩa", items: [{ id: "R1" }] },
      ],
      leftItems: [{ id: "stale" }],
      rightItems: [{ id: "stale" }],
    });
    expect(resolved).toEqual([
      { id: "left", title: "Từ vựng", items: [{ id: "L1" }] },
      { id: "right", title: "Nghĩa", items: [{ id: "R1" }] },
    ]);
  });

  it("omits the title key entirely on canonical columns → resolves to an empty string, no auto-generated label", () => {
    const resolved = resolveMatchingColumns({
      columns: [
        { id: "left", items: [{ id: "L1" }] },
        { id: "right", items: [{ id: "R1" }] },
      ],
    });
    expect(resolved.map((c) => c.title)).toEqual(["", ""]);
  });

  it("LEGACY-SYNTHESIS: a pre-migration columnALabel/columnBLabel-only payload (no `columns` key) still resolves and renders a two-column title — no re-import", () => {
    const resolved = resolveMatchingColumns({
      leftItems: [{ id: "L1" }],
      rightItems: [{ id: "R1" }],
      columnALabel: "Từ vựng",
      columnBLabel: "Nghĩa",
    });
    expect(resolved).toEqual([
      { id: "left", title: "Từ vựng", items: [{ id: "L1" }] },
      { id: "right", title: "Nghĩa", items: [{ id: "R1" }] },
    ]);
    // resolveMatchingPayload surfaces the same titles for players/dispatch.
    const payload = resolveMatchingPayload({
      leftItems: [{ id: "L1" }],
      rightItems: [{ id: "R1" }],
      columnALabel: "Từ vựng",
      columnBLabel: "Nghĩa",
    });
    expect(payload.leftTitle).toBe("Từ vựng");
    expect(payload.rightTitle).toBe("Nghĩa");
  });

  it("LEGACY-SYNTHESIS: chain columnALabel/B/C titles synthesize per the nxbgd contract mapping", () => {
    const resolved = resolveMatchingColumns({
      display: { interactionType: "chain" },
      leftItems: [{ id: "L1" }],
      middleItems: [{ id: "M1" }],
      rightItems: [{ id: "R1" }],
      columnALabel: "Con vật",
      columnBLabel: "Thức ăn",
      columnCLabel: "Môi trường sống",
    });
    expect(resolved).toEqual([
      { id: "left", title: "Con vật", items: [{ id: "L1" }] },
      { id: "middle", title: "Thức ăn", items: [{ id: "M1" }] },
      { id: "right", title: "Môi trường sống", items: [{ id: "R1" }] },
    ]);
  });

  it("LEGACY-SYNTHESIS: evo's own chain field names (columnMiddleLabel for middle, columnBLabel for right) also render — evo's own already-authored titles are not lost", () => {
    const resolved = resolveMatchingColumns({
      display: { interactionType: "chain" },
      leftItems: [{ id: "L1" }],
      middleItems: [{ id: "M1" }],
      rightItems: [{ id: "R1" }],
      columnALabel: "Con vật",
      columnMiddleLabel: "Thức ăn",
      columnBLabel: "Môi trường sống",
    });
    expect(resolved).toEqual([
      { id: "left", title: "Con vật", items: [{ id: "L1" }] },
      { id: "middle", title: "Thức ăn", items: [{ id: "M1" }] },
      { id: "right", title: "Môi trường sống", items: [{ id: "R1" }] },
    ]);
  });

  it("detects chain via a non-empty middleItems mirror even without an explicit interactionType", () => {
    const resolved = resolveMatchingColumns({
      leftItems: [{ id: "L1" }],
      middleItems: [{ id: "M1" }],
      rightItems: [{ id: "R1" }],
      columnALabel: "Trái",
      columnMiddleLabel: "Giữa",
      columnBLabel: "Phải",
    });
    expect(resolved.map((c) => c.id)).toEqual(["left", "middle", "right"]);
    expect(resolved.map((c) => c.title)).toEqual(["Trái", "Giữa", "Phải"]);
  });

  it("no title fields anywhere → every column resolves to an empty string (renderer hides the header, never invents one)", () => {
    const resolved = resolveMatchingColumns({
      leftItems: [{ id: "L1" }],
      rightItems: [{ id: "R1" }],
    });
    expect(resolved.every((c) => c.title === "")).toBe(true);
  });
});

describe("isOneToManyMatch — answer-key cardinality", () => {
  it("is false when every left maps to exactly one target", () => {
    expect(isOneToManyMatch([
      { item: "l1", target: "r1" },
      { item: "l2", target: "r2" },
    ])).toBe(false);
  });

  it("is false for an empty answer key (default to one-to-one)", () => {
    expect(isOneToManyMatch([])).toBe(false);
  });

  it("is true when any left maps to more than one target", () => {
    expect(isOneToManyMatch([
      { item: "l1", target: "r1" },
      { item: "l1", target: "r2" },
      { item: "l2", target: "r3" },
    ])).toBe(true);
  });

  it("many-lefts-to-one-right is still one-to-one (each left owns one target)", () => {
    expect(isOneToManyMatch([
      { item: "l1", target: "r1" },
      { item: "l2", target: "r1" },
    ])).toBe(false);
  });
});

describe("toggleMatchEdge — singleTargetPerItem", () => {
  const base = [{ item: "l1", target: "r1" }];

  it("default (append) lets a left item fan out to multiple targets", () => {
    expect(toggleMatchEdge(base, "l1", "r2")).toEqual([
      { item: "l1", target: "r1" },
      { item: "l1", target: "r2" },
    ]);
  });

  it("singleTargetPerItem replaces the left item's existing edge (auto-dismiss)", () => {
    expect(toggleMatchEdge(base, "l1", "r2", { singleTargetPerItem: true })).toEqual([
      { item: "l1", target: "r2" },
    ]);
  });

  it("singleTargetPerItem leaves other left items' edges untouched", () => {
    const edges = [
      { item: "l1", target: "r1" },
      { item: "l2", target: "r2" },
    ];
    expect(toggleMatchEdge(edges, "l1", "r3", { singleTargetPerItem: true })).toEqual([
      { item: "l2", target: "r2" },
      { item: "l1", target: "r3" },
    ]);
  });

  it("re-clicking the exact same pair still toggles it off, even in single-target mode", () => {
    expect(toggleMatchEdge(base, "l1", "r1", { singleTargetPerItem: true })).toEqual([]);
  });
});

describe("matching triad (3 cột, giữa là trung tâm — §5.9.3)", () => {
  const triadPayload = (correctAnswer: unknown) => ({
    display: { interactionType: "triad" },
    columns: [
      { id: "left", items: [{ id: "L1" }, { id: "L2" }] },
      { id: "middle", items: [{ id: "M1" }] },
      { id: "right", items: [{ id: "R1" }, { id: "R2" }] },
    ],
    leftItems: [{ id: "L1" }, { id: "L2" }],
    middleItems: [{ id: "M1" }],
    rightItems: [{ id: "R1" }, { id: "R2" }],
    correctAnswer,
  });

  it("keeps every spoke of a middle item fanning out to both sides", () => {
    const resolved = resolveMatchingPayload(triadPayload([
      { item: "L1", target: "M1" },
      { item: "L2", target: "M1" },
      { item: "M1", target: "R1" },
      { item: "M1", target: "R2" },
    ]));

    expect(resolved.middleItems.map(({ id }) => id)).toEqual(["M1"]);
    expect(resolved.correctEdges).toEqual([
      { item: "L1", target: "M1" },
      { item: "L2", target: "M1" },
      { item: "M1", target: "R1" },
      { item: "M1", target: "R2" },
    ]);
  });

  it("still drops a left→right shortcut, exactly like chain", () => {
    const resolved = resolveMatchingPayload(triadPayload([
      { item: "L1", target: "M1" },
      { item: "L1", target: "R1" },
    ]));

    expect(resolved.correctEdges).toEqual([{ item: "L1", target: "M1" }]);
  });

  it("synthesizes three columns from legacy mirrors when `columns` is absent", () => {
    const resolved = resolveMatchingPayload({
      display: { interactionType: "triad" },
      leftItems: [{ id: "L1" }],
      middleItems: [{ id: "M1" }],
      rightItems: [{ id: "R1" }],
      correctAnswer: [{ item: "L1", target: "M1" }, { item: "M1", target: "R1" }],
    });

    expect(resolved.middleItems.map(({ id }) => id)).toEqual(["M1"]);
    expect(resolved.correctEdges).toHaveLength(2);
  });

  it("hard cut: the old `hub` value no longer counts as three-column — chain-shaped edges are filtered out as invalid left→right pairs", () => {
    // Canonical `columns` present (so column synthesis is unaffected either way) —
    // this isolates the interactionType-only branch (resolveMatchingPayload's
    // isThreeColumn check), which used to also accept "hub".
    const resolved = resolveMatchingPayload(triadPayload([
      { item: "L1", target: "M1" },
      { item: "M1", target: "R1" },
    ]));
    const asHub = resolveMatchingPayload({
      ...triadPayload([{ item: "L1", target: "M1" }, { item: "M1", target: "R1" }]),
      display: { interactionType: "hub" },
    });

    // With "triad" recognized, both chain-shaped hops survive.
    expect(resolved.correctEdges).toEqual([
      { item: "L1", target: "M1" },
      { item: "M1", target: "R1" },
    ]);
    // With the old "hub" value, three-column detection no longer fires, so the
    // same edges are validated as two-column left→right and both are dropped
    // (neither "M1" is a right-column id, nor is "L1" paired straight to "R1").
    expect(asHub.correctEdges).toEqual([]);
  });
});

describe("matchCardinalityFromKey — trần suy từ đáp án", () => {
  it("song ánh 1-1 khoá cả hai chiều ở 1", () => {
    expect(matchCardinalityFromKey([
      { item: "l1", target: "r1" },
      { item: "l2", target: "r2" },
      { item: "l3", target: "r3" },
    ])).toEqual({ maxOutDegree: 1, maxInDegree: 1 });
  });

  it("một-nhiều nâng trần RA, giữ trần VÀO ở 1", () => {
    expect(matchCardinalityFromKey([
      { item: "l1", target: "r1" },
      { item: "l1", target: "r2" },
      { item: "l2", target: "r3" },
    ])).toEqual({ maxOutDegree: 2, maxInDegree: 1 });
  });

  it("nhiều-một nâng trần VÀO, giữ trần RA ở 1", () => {
    expect(matchCardinalityFromKey([
      { item: "l1", target: "r1" },
      { item: "l2", target: "r1" },
    ])).toEqual({ maxOutDegree: 1, maxInDegree: 2 });
  });

  it("lấy MAX toàn cục, không phải trần riêng từng ô", () => {
    // l1 có 2 đích, l2 có 1 — trần ra là 2 cho CẢ HAI, nếu không thì
    // số nét cho phép ở mỗi ô chính là một nửa lời giải.
    expect(matchCardinalityFromKey([
      { item: "l1", target: "r1" },
      { item: "l1", target: "r2" },
      { item: "l2", target: "r1" },
    ])).toEqual({ maxOutDegree: 2, maxInDegree: 2 });
  });

  it("khoá rỗng giữ trần ra 1 (hành vi đang chạy) và không bịa trần vào", () => {
    expect(matchCardinalityFromKey([])).toEqual({
      maxOutDegree: 1,
      maxInDegree: Number.POSITIVE_INFINITY,
    });
  });
});

describe("matchCardinalityByHop — trần theo từng chặng", () => {
  const ids = {
    leftIds: new Set(["L1", "L2"]),
    middleIds: new Set(["M1", "M2"]),
    rightIds: new Set(["R1", "R2"]),
  };

  it("chain một-một khoá cả hai chặng ở 1/1", () => {
    expect(matchCardinalityByHop([
      { item: "L1", target: "M1" }, { item: "M1", target: "R1" },
      { item: "L2", target: "M2" }, { item: "M2", target: "R2" },
    ], ids)).toEqual({
      leftToMiddle: { maxOutDegree: 1, maxInDegree: 1 },
      middleToRight: { maxOutDegree: 1, maxInDegree: 1 },
    });
  });

  it("triad ra hai cardinality KHÁC NHAU trong cùng một câu", () => {
    expect(matchCardinalityByHop([
      { item: "L1", target: "M1" }, { item: "L2", target: "M1" },
      { item: "M1", target: "R1" }, { item: "M1", target: "R2" },
    ], ids)).toEqual({
      leftToMiddle: { maxOutDegree: 1, maxInDegree: 2 },
      middleToRight: { maxOutDegree: 2, maxInDegree: 1 },
    });
  });

  it("chặng không có cạnh nào trong khoá thì không siết chặng đó", () => {
    expect(matchCardinalityByHop([
      { item: "L1", target: "M1" },
      { item: "L2", target: "M2" },
    ], ids)).toEqual({
      leftToMiddle: { maxOutDegree: 1, maxInDegree: 1 },
      middleToRight: {
        maxOutDegree: Number.POSITIVE_INFINITY,
        maxInDegree: Number.POSITIVE_INFINITY,
      },
    });
  });

  it("cạnh không nối hai cột kề bị bỏ khi đếm", () => {
    expect(matchCardinalityByHop([
      { item: "L1", target: "M1" },
      { item: "L1", target: "R1" },
      { item: "M1", target: "R1" },
    ], ids).leftToMiddle).toEqual({ maxOutDegree: 1, maxInDegree: 1 });
  });

  it("centreFanOutCeiling chỉ đổi chiều RA của chặng giữa→phải", () => {
    // Khoá triad viết dạng Record không giữ nổi một-nhiều từ ô giữa; chiều
    // còn lại vẫn đọc được nên vẫn siết.
    expect(matchCardinalityByHop([
      { item: "L1", target: "M1" }, { item: "L2", target: "M1" },
      { item: "M1", target: "R1" },
    ], ids, { centreFanOutCeiling: 2 })).toEqual({
      leftToMiddle: { maxOutDegree: 1, maxInDegree: 2 },
      middleToRight: { maxOutDegree: 2, maxInDegree: 1 },
    });
  });

  it("trần đếm theo ô không siết hơn trần đọc thẳng từ khoá", () => {
    expect(matchCardinalityByHop([
      { item: "M1", target: "R1" }, { item: "M1", target: "R2" },
      { item: "M2", target: "R1" },
    ], ids, { centreFanOutCeiling: 1 }).middleToRight.maxOutDegree).toBe(2);
  });
});

describe("triadCentreFanOutCeiling — trần toả của tâm đếm theo số ô cột phải", () => {
  const ids = { middleIds: new Set(["M1", "M2"]), rightIds: new Set(["R1", "R2", "R3"]) };

  it("một tâm duy nhất trong khoá thì được cả cột phải", () => {
    expect(triadCentreFanOutCeiling([
      { item: "L1", target: "M1" }, { item: "M1", target: "R1" },
    ], ids)).toBe(3);
  });

  it("mỗi ô giữa khác trong khoá giữ lại một ô phải cho mình", () => {
    expect(triadCentreFanOutCeiling([
      { item: "M1", target: "R1" }, { item: "M2", target: "R2" },
    ], ids)).toBe(2);
  });

  it("khoá không nói gì về chặng giữa→phải thì trần là cả cột phải", () => {
    expect(triadCentreFanOutCeiling([{ item: "L1", target: "M1" }], ids)).toBe(3);
  });

  it("không bao giờ tụt xuống 0, kể cả khi khoá đông tâm hơn ô phải", () => {
    expect(triadCentreFanOutCeiling([
      { item: "M1", target: "R1" }, { item: "M2", target: "R2" },
    ], { middleIds: new Set(["M1", "M2"]), rightIds: new Set(["R1"]) })).toBe(1);
  });

  it("GIỚI HẠN ĐÃ BIẾT: dùng chung bị Record nuốt thì guard im, tâm bị ghim một nét", () => {
    // Đáp án in trên sách: M1→{R1,R2}, M2→{R1}, M3→{R3}. Record chỉ giữ một đích
    // mỗi tâm nên quan hệ dùng chung ở R1 biến mất, không đích nào lặp.
    const wide = { middleIds: new Set(["M1", "M2", "M3"]), rightIds: new Set(["R1", "R2", "R3"]) };
    expect(triadCentreFanOutCeiling([
      { item: "M1", target: "R2" }, { item: "M2", target: "R1" }, { item: "M3", target: "R3" },
    ], wide)).toBe(1);
  });

  it("hai tâm dùng chung một ô phải thì bỏ hẳn phép trừ", () => {
    // Tập đích không rời nhau nên "mỗi tâm khác giữ một ô" không còn đúng: trừ
    // đi là cắt mất nét của đáp án hợp lệ.
    expect(triadCentreFanOutCeiling([
      { item: "M1", target: "R1" }, { item: "M2", target: "R1" },
    ], ids)).toBe(3);
  });
});

describe("resolveMatchingPayload — trần đếm theo ô chỉ áp cho triad khai bằng Record", () => {
  const columns = {
    leftItems: [{ id: "L1" }],
    middleItems: [{ id: "M1" }, { id: "M2" }],
    rightItems: [{ id: "R1" }, { id: "R2" }],
  };
  const fanOut = (payload: Record<string, unknown>) =>
    resolveMatchingPayload(payload).cardinalityByHop.middleToRight.maxOutDegree;

  it("triad + Record: tâm bị trần đếm theo ô thay cho vô hạn", () => {
    expect(fanOut({
      ...columns,
      display: { interactionType: "triad" },
      correctAnswer: { L1: "M1", M1: "R1" },
    })).toBe(2);
  });

  it("triad + Record dùng chung ô phải: giữ đủ nét cho đáp án thật", () => {
    // Đáp án thật M1→{R1,R2}, M2→{R1}; Record chỉ giữ được một nét mỗi tâm.
    expect(fanOut({
      ...columns,
      display: { interactionType: "triad" },
      correctAnswer: { L1: "M1", M1: "R1", M2: "R1" },
    })).toBe(2);
  });

  it("triad khai bằng MẢNG cạnh: trần đọc thẳng từ khoá, không đếm theo ô", () => {
    expect(fanOut({
      ...columns,
      display: { interactionType: "triad" },
      correctAnswer: [{ item: "M1", target: "R1" }],
    })).toBe(1);
  });

  it("chain khai bằng Record: không đụng tới, vẫn một nét", () => {
    expect(fanOut({
      ...columns,
      display: { interactionType: "chain" },
      correctAnswer: { L1: "M1", M1: "R1" },
    })).toBe(1);
  });
});

describe("toggleMatchEdge — trần hai chiều", () => {
  it("chạm trần VÀO thì đẩy nét cũ nhất của ô đích ra", () => {
    const edges = [{ item: "l1", target: "r1" }];
    expect(toggleMatchEdge(edges, "l2", "r1", { maxOutDegree: 1, maxInDegree: 1 })).toEqual([
      { item: "l2", target: "r1" },
    ]);
  });

  it("trần vào 2 vẫn cho hai nguồn cùng đổ vào một đích", () => {
    const edges = [{ item: "l1", target: "r1" }];
    expect(toggleMatchEdge(edges, "l2", "r1", { maxOutDegree: 1, maxInDegree: 2 })).toEqual([
      { item: "l1", target: "r1" },
      { item: "l2", target: "r1" },
    ]);
  });

  it("trần ra 2 bỏ ĐÚNG cạnh cũ nhất, không xoá sạch cạnh của ô", () => {
    const edges = [
      { item: "l1", target: "r1" },
      { item: "l1", target: "r2" },
    ];
    expect(toggleMatchEdge(edges, "l1", "r3", { maxOutDegree: 2 })).toEqual([
      { item: "l1", target: "r2" },
      { item: "l1", target: "r3" },
    ]);
  });

  it("singleTargetPerItem là alias của maxOutDegree 1", () => {
    const edges = [{ item: "l1", target: "r1" }];
    expect(toggleMatchEdge(edges, "l1", "r2", { singleTargetPerItem: true }))
      .toEqual(toggleMatchEdge(edges, "l1", "r2", { maxOutDegree: 1 }));
  });

  it("cạnh mẫu ĐƯỢC ĐẾM vào bậc nhưng không bị chọn làm nạn nhân", () => {
    const sample = { item: "l1", target: "r1" };
    const protectedKeys = new Set([matchEdgeKey(sample)]);
    // Trần vào 1, nạn nhân duy nhất ở r1 là cạnh mẫu ⇒ thao tác rỗng.
    expect(toggleMatchEdge([sample], "l2", "r1", { maxInDegree: 1, protectedKeys }))
      .toEqual([sample]);
  });

  it("vẫn nối được khi còn nạn nhân hợp lệ bên cạnh cạnh mẫu", () => {
    const sample = { item: "l1", target: "r1" };
    const protectedKeys = new Set([matchEdgeKey(sample)]);
    const edges = [sample, { item: "l2", target: "r2" }];
    expect(toggleMatchEdge(edges, "l3", "r2", { maxInDegree: 1, protectedKeys })).toEqual([
      sample,
      { item: "l3", target: "r2" },
    ]);
  });

  it("bấm lại chính cạnh mẫu đã khoá không gỡ được nó", () => {
    const sample = { item: "l1", target: "r1" };
    const protectedKeys = new Set([matchEdgeKey(sample)]);
    expect(toggleMatchEdge([sample], "l1", "r1", { protectedKeys })).toEqual([sample]);
  });

  it("không có trần thì vẫn cộng thêm như cũ", () => {
    const edges = [{ item: "l1", target: "r1" }];
    expect(toggleMatchEdge(edges, "l1", "r2")).toEqual([
      { item: "l1", target: "r1" },
      { item: "l1", target: "r2" },
    ]);
  });
});

describe("clampMatchEdges — siết lúc nạp lại bài", () => {
  it("cắt bài vượt trần ra, giữ các cạnh sớm nhất", () => {
    const edges = [
      { item: "l1", target: "r1" },
      { item: "l1", target: "r2" },
      { item: "l1", target: "r3" },
    ];
    expect(clampMatchEdges(edges, { maxOutDegree: 2, maxInDegree: Infinity })).toEqual([
      { item: "l1", target: "r1" },
      { item: "l1", target: "r2" },
    ]);
  });

  it("cắt theo trần vào", () => {
    const edges = [
      { item: "l1", target: "r1" },
      { item: "l2", target: "r1" },
      { item: "l3", target: "r2" },
    ];
    expect(clampMatchEdges(edges, { maxOutDegree: 1, maxInDegree: 1 })).toEqual([
      { item: "l1", target: "r1" },
      { item: "l3", target: "r2" },
    ]);
  });

  it("cạnh mẫu được giữ kể cả khi nó không đứng sớm nhất", () => {
    const sample = { item: "l2", target: "r1" };
    const edges = [{ item: "l1", target: "r1" }, sample];
    expect(clampMatchEdges(
      edges,
      { maxOutDegree: 1, maxInDegree: 1 },
      new Set([matchEdgeKey(sample)]),
    )).toEqual([sample]);
  });

  it("bài đã hợp lệ thì giữ nguyên thứ tự, không đụng gì", () => {
    const edges = [
      { item: "l1", target: "r1" },
      { item: "l2", target: "r2" },
    ];
    expect(clampMatchEdges(edges, { maxOutDegree: 1, maxInDegree: 1 })).toEqual(edges);
  });
});

describe("clampMatchEdgesByHop — siết ba cột theo từng chặng", () => {
  const ids = {
    leftIds: new Set(["L1", "L2"]),
    middleIds: new Set(["M1", "M2"]),
    rightIds: new Set(["R1", "R2"]),
  };

  it("mỗi chặng siết theo trần của riêng nó", () => {
    const edges = [
      { item: "L1", target: "M1" },
      { item: "L2", target: "M1" },
      { item: "M1", target: "R1" },
      { item: "M1", target: "R2" },
    ];
    // Chặng 1 nhiều-một (vào 2), chặng 2 một-nhiều (ra 2) — không cạnh nào bị cắt.
    expect(clampMatchEdgesByHop(edges, {
      leftToMiddle: { maxOutDegree: 1, maxInDegree: 2 },
      middleToRight: { maxOutDegree: 2, maxInDegree: 1 },
    }, ids)).toEqual(edges);
  });

  it("chặng 1 bị siết không kéo theo chặng 2", () => {
    const edges = [
      { item: "L1", target: "M1" },
      { item: "L2", target: "M1" },
      { item: "M1", target: "R1" },
    ];
    expect(clampMatchEdgesByHop(edges, {
      leftToMiddle: { maxOutDegree: 1, maxInDegree: 1 },
      middleToRight: { maxOutDegree: 1, maxInDegree: 1 },
    }, ids)).toEqual([
      { item: "L1", target: "M1" },
      { item: "M1", target: "R1" },
    ]);
  });

  it("cạnh không nối hai cột kề bị bỏ", () => {
    expect(clampMatchEdgesByHop([{ item: "L1", target: "R1" }], {
      leftToMiddle: { maxOutDegree: 1, maxInDegree: 1 },
      middleToRight: { maxOutDegree: 1, maxInDegree: 1 },
    }, ids)).toEqual([]);
  });
});
