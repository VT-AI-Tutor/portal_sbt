import { describe, it, expect, vi } from "vitest";
import React from "react";

// Make resolution deterministic: prefix stored /uploads paths with a fake API origin,
// pass everything else through unchanged (mirrors resolveAssetUrl's contract).
vi.mock("@/core/content/assetUrl", () => ({
  resolveAssetUrl: (u?: string) =>
    !u ? "" : u.startsWith("/") ? `https://api.test${u}` : u,
}));

import { renderInteractionPlayer, resolvePayloadMediaUrls } from "./dispatch";
import { MatchRadialPlayer } from "./MatchRadialPlayer";
import { FreeDrawPlayer } from "./FreeDrawPlayer";
import { CategorizePlayer } from "./CategorizePlayer";
import { TwoBucketSortPlayer } from "./TwoBucketSortPlayer";
import { CardSortPlayer } from "./CardSortPlayer";
import { LabelDiagramPlayer } from "./LabelDiagramPlayer";
import { TrueFalseTablePlayer } from "./TrueFalseTablePlayer";
import { TableFillPlayer } from "./TableFillPlayer";
import { ConnectPointsTask } from "../tasks/ConnectPointsTask";

// renderInteractionPlayer → GradeMode provider → AccentProvider → player.
type WrappedPlayer = React.ReactElement<{
  children: React.ReactElement<{ children: React.ReactElement<Record<string, unknown>> }>;
}>;

// Helper: unwrap renderInteractionPlayer → the inner player element.
function playerOf(type: string, payload: unknown) {
  const rendered = renderInteractionPlayer(type, payload as never, {} as never) as WrappedPlayer;
  return rendered.props.children.props.children;
}

describe("resolvePayloadMediaUrls", () => {
  it("resolves whitelisted media keys and leaves other fields untouched", () => {
    const payload = {
      title: "Nối cột",
      leftItems: [
        { id: "i_baba", content: { blocks: [{ type: "image", url: "/uploads/books/x/assets/baba.png" }] } },
      ],
      image: { url: "/uploads/books/x/assets/bg.png", altText: "bg" },
      imageA: "/uploads/a.png",
      imageB: "https://cdn.ext/b.png",
      backgroundImage: "/uploads/scene.png",
      correctAnswer: "/not/a/media/field", // key not whitelisted → unchanged
    };

    const out = resolvePayloadMediaUrls(payload);

    expect(out.leftItems[0].content.blocks[0].url).toBe("https://api.test/uploads/books/x/assets/baba.png");
    expect(out.image.url).toBe("https://api.test/uploads/books/x/assets/bg.png");
    expect(out.image.altText).toBe("bg");
    expect(out.imageA).toBe("https://api.test/uploads/a.png");
    expect(out.imageB).toBe("https://cdn.ext/b.png"); // external http passes through
    expect(out.backgroundImage).toBe("https://api.test/uploads/scene.png");
    expect(out.correctAnswer).toBe("/not/a/media/field"); // non-media key not rewritten
  });

  it("does not mutate the original payload", () => {
    const payload = { image: { url: "/uploads/x.png" } };
    const out = resolvePayloadMediaUrls(payload);
    expect(payload.image.url).toBe("/uploads/x.png");
    expect(out.image.url).toBe("https://api.test/uploads/x.png");
    expect(out).not.toBe(payload);
  });
});

describe("renderInteractionPlayer matching compatibility", () => {
  it("selects radial from top-level layout and renders legacy item aliases", () => {
    const rendered = renderInteractionPlayer(
      "matching",
      {
        layout: "radial",
        items: [{ id: "item-1", text: "A" }],
        targets: [{ id: "target-1", text: "B" }],
        correctAnswer: { "item-1": "target-1" },
      },
      {},
    ) as WrappedPlayer;

    const player = rendered.props.children.props.children;
    expect(player.type).toBe(MatchRadialPlayer);
    expect(player.props.leftItems).toEqual([{ id: "item-1", text: "A", imageUrl: undefined }]);
    expect(player.props.rightItems).toEqual([{ id: "target-1", text: "B", imageUrl: undefined }]);
  });

  it("lets display.interactionType override a conflicting legacy layout", () => {
    const rendered = renderInteractionPlayer(
      "matching",
      {
        layout: "row",
        display: { interactionType: "radial" },
        leftItems: [{ id: "item-1", text: "A" }],
        rightItems: [{ id: "target-1", text: "B" }],
      },
      {},
    ) as WrappedPlayer;

    expect(rendered.props.children.props.children.type).toBe(MatchRadialPlayer);
  });
});

describe("classification (buckets) category images", () => {
  // #562 — category (bucket) headers must carry images the same way item chips do,
  // whether the image is a direct `imageUrl` or an `image` block inside `content`.
  it("maps category imageUrl (direct field and content image block) alongside items", () => {
    const rendered = renderInteractionPlayer(
      "classification",
      {
        categories: [
          { id: "cat-fruit", label: "Trái cây", imageUrl: "/uploads/books/x/assets/fruit.png" },
          {
            id: "cat-veg",
            content: { blocks: [{ type: "image", url: "/uploads/books/x/assets/veg.png" }] },
          },
        ],
        items: [{ id: "item-1", imageUrl: "/uploads/books/x/assets/apple.png" }],
        correctAnswer: [{ itemId: "item-1", categoryId: "cat-fruit" }],
      },
      {},
    ) as WrappedPlayer;

    const player = rendered.props.children.props.children;
    expect(player.type).toBe(CategorizePlayer);
    expect(player.props.categories).toEqual([
      { id: "cat-fruit", label: "Trái cây", imageUrl: "https://api.test/uploads/books/x/assets/fruit.png" },
      { id: "cat-veg", label: "Ảnh 2", imageUrl: "https://api.test/uploads/books/x/assets/veg.png" },
    ]);
    expect((player.props.items as Array<{ imageUrl?: string }>)[0].imageUrl).toBe(
      "https://api.test/uploads/books/x/assets/apple.png",
    );
  });

  it("leaves category imageUrl undefined for text-only categories", () => {
    const rendered = renderInteractionPlayer(
      "classification",
      {
        categories: [{ id: "cat-a", label: "Nhóm A" }],
        items: [{ id: "item-1", text: "X" }],
        correctAnswer: [{ itemId: "item-1", categoryId: "cat-a" }],
      },
      {},
    ) as WrappedPlayer;

    expect(rendered.props.children.props.children.props.categories).toEqual([
      { id: "cat-a", label: "Nhóm A", imageUrl: undefined },
    ]);
  });
});

describe("drawing payload compatibility", () => {
  it("normalizes image.url and palette aliases while preserving canonical precedence", () => {
    const rendered = renderInteractionPlayer(
      "drawing",
      {
        image: { url: "/uploads/books/music/animals.png" },
        palette: ["#00A8E1", "#F7941E"],
        aspectRatio: 1.91,
        backgroundImage: "/uploads/canonical.png",
        colors: ["#111111"],
      },
      {},
    ) as WrappedPlayer;

    const player = rendered.props.children.props.children;
    expect(player.type).toBe(FreeDrawPlayer);
    expect(player.props.backgroundImage).toBe("https://api.test/uploads/canonical.png");
    expect(player.props.colors).toEqual(["#111111"]);
    expect(player.props.aspectRatio).toBe(1.91);
  });

  it("passes drawing aliases when canonical fields are absent", () => {
    const rendered = renderInteractionPlayer(
      "drawing",
      { image: { url: "/uploads/books/math/figure.png" }, palette: ["#123456"] },
      {},
    ) as WrappedPlayer;

    const player = rendered.props.children.props.children;
    expect(player.props.backgroundImage).toBe("https://api.test/uploads/books/math/figure.png");
    expect(player.props.colors).toEqual(["#123456"]);
  });

  // #822 — extraction writes backgroundImage as an image record ({url, altText}),
  // the drawing editor writes image.url. Reading only the string shape dropped a
  // perfectly good url and rendered a blank canvas.
  it("reads backgroundImage authored as an image record", () => {
    const rendered = renderInteractionPlayer(
      "drawing",
      {
        backgroundImage: { url: "/uploads/books/b/assets/map.png", altText: "Bản đồ" },
        image: { url: "/uploads/books/b/media/outline.png" },
        aspectRatio: 1.4,
      },
      {},
    ) as WrappedPlayer;

    const player = rendered.props.children.props.children;
    expect(player.type).toBe(FreeDrawPlayer);
    expect(player.props.backgroundImage).toBe("https://api.test/uploads/books/b/assets/map.png");
  });

  it("keeps the background url on a drawing child nested in a question_group", () => {
    const rendered = renderInteractionPlayer(
      "question_group",
      {
        display: { layout: "list" },
        questions: [
          {
            id: "b21_q4_a",
            type: "drawing",
            backgroundImage: { url: "/uploads/books/b/assets/map.png", altText: "Bản đồ" },
            image: { url: "/uploads/books/b/media/outline.png" },
            aspectRatio: 1.4,
            canvasHeight: "240px",
            colors: ["#111111"],
          },
        ],
      },
      {},
    ) as WrappedPlayer;

    const group = rendered.props.children.props.children;
    const children = group.props.children as Array<{
      id: string;
      type: string;
      render: (ctx: { onAnswerChange: (a: unknown) => void }) => WrappedPlayer;
    }>;
    expect(children).toHaveLength(1);
    expect(children[0].type).toBe("drawing");

    const child = children[0].render({ onAnswerChange: () => {} });
    const player = child.props.children.props.children;
    expect(player.type).toBe(FreeDrawPlayer);
    expect(player.props.backgroundImage).toBe("https://api.test/uploads/books/b/assets/map.png");
    // Sibling config must survive the recursive dispatch too.
    expect(player.props.aspectRatio).toBe(1.4);
    expect(player.props.canvasHeight).toBe("240px");
    expect(player.props.colors).toEqual(["#111111"]);
  });
});

describe("non-item side image mapping (#562 class — parity across players)", () => {
  const IMG = (name: string) => ({ blocks: [{ type: "image", url: `/uploads/${name}.png` }] });
  const R = (name: string) => `https://api.test/uploads/${name}.png`;

  it("classification/two_bucket: buckets carry category images (TwoBucketSortPlayer)", () => {
    const player = playerOf("classification", {
      display: { interactionType: "two_bucket" },
      categories: [
        { id: "c1", content: IMG("b1") },
        { id: "c2", label: "Nhóm 2" },
      ],
      items: [{ id: "i1", text: "x" }],
      correctAnswer: [{ itemId: "i1", categoryId: "c1" }],
    });
    expect(player.type).toBe(TwoBucketSortPlayer);
    const buckets = player.props.buckets as Array<{ imageUrl?: string; label: string }>;
    expect(buckets[0].imageUrl).toBe(R("b1"));
    expect(buckets[1].imageUrl).toBeUndefined();
    expect(buckets[1].label).toBe("Nhóm 2");
  });

  it("card_sort: category piles carry images (CardSortPlayer)", () => {
    const player = playerOf("card_sort", {
      categories: [{ id: "c1", imageUrl: "/uploads/cat.png" }, { id: "c2", label: "Text" }],
      cards: [{ id: "k1", text: "x" }],
      correctAnswer: [{ cardId: "k1", categoryId: "c1" }],
    });
    expect(player.type).toBe(CardSortPlayer);
    const cats = player.props.categories as Array<{ imageUrl?: string }>;
    expect(cats[0].imageUrl).toBe("https://api.test/uploads/cat.png");
    expect(cats[1].imageUrl).toBeUndefined();
  });

  it("labeling: label chips carry images (LabelDiagramPlayer)", () => {
    const player = playerOf("labeling", {
      image: { url: "/uploads/diagram.png" },
      labels: [{ id: "l1", content: IMG("lbl") }, { id: "l2", text: "Chữ" }],
      targets: [{ id: "t1", x: 0.5, y: 0.5 }],
      correctAnswer: [{ labelId: "l1", targetId: "t1" }],
    });
    expect(player.type).toBe(LabelDiagramPlayer);
    const labels = player.props.labels as Array<{ imageUrl?: string }>;
    expect(labels[0].imageUrl).toBe(R("lbl"));
    expect(labels[1].imageUrl).toBeUndefined();
  });

  it("connect_points: points carry images (ConnectPointsTask)", () => {
    const player = playerOf("connect_points", {
      points: [
        { id: "p1", x: 0.2, y: 0.3, content: IMG("pt") },
        { id: "p2", label: "B", x: 0.8, y: 0.7 },
      ],
      correctAnswer: [{ from: "p1", to: "p2" }],
    });
    expect(player.type).toBe(ConnectPointsTask);
    const points = player.props.points as Array<{ imageUrl?: string; label: string }>;
    expect(points[0].imageUrl).toBe(R("pt"));
    expect(points[1].imageUrl).toBeUndefined();
    expect(points[1].label).toBe("B");
  });

  it("connect_points: the background scan resolves to the API origin (ConnectPointsTask)", () => {
    const player = playerOf("connect_points", {
      backgroundImage: "/uploads/books/x/exercise_images/bai33.png",
      points: [
        { id: "p1", label: "A", x: 0.2, y: 0.3 },
        { id: "p2", label: "B", x: 0.8, y: 0.7 },
      ],
      correctAnswer: [{ from: "p1", to: "p2" }],
    });
    expect(player.type).toBe(ConnectPointsTask);
    expect(player.props.backgroundImage).toBe("https://api.test/uploads/books/x/exercise_images/bai33.png");
  });

  it("multi_true_false: statement + situation carry images (TrueFalseTablePlayer)", () => {
    const player = playerOf("multi_true_false", {
      statements: [
        { id: "s1", content: IMG("stmt"), situation: IMG("sit") },
        { id: "s2", text: "Nhận định chữ" },
      ],
      correctAnswer: { s1: true, s2: false },
    });
    expect(player.type).toBe(TrueFalseTablePlayer);
    const stmts = player.props.statements as Array<{ imageUrl?: string; situationImageUrl?: string }>;
    expect(stmts[0].imageUrl).toBe(R("stmt"));
    expect(stmts[0].situationImageUrl).toBe(R("sit"));
    expect(stmts[1].imageUrl).toBeUndefined();
  });

  it("table_completion: static cells carry images (TableFillPlayer)", () => {
    const player = playerOf("table_completion", {
      table: {
        headers: [{ id: "h1", label: "H" }],
        rows: [
          { id: "r1", cells: [{ columnId: "h1", cellType: "text", content: IMG("cell") }] },
          { id: "r2", cells: [{ columnId: "h1", cellType: "text", text: "chữ" }] },
        ],
      },
      correctAnswer: {},
    });
    expect(player.type).toBe(TableFillPlayer);
    // GAP-229: dispatch truyền mô hình ĐÃ GIẢI (`bodyRows`), không còn `rows` thô.
    const table = player.props.table as { bodyRows: Array<{ cells: Array<{ imageUrl?: string }> }> };
    const rows = table.bodyRows;
    expect(rows[0].cells[0].imageUrl).toBe(R("cell"));
    expect(rows[1].cells[0].imageUrl).toBeUndefined();
  });
});
